// Tests d'intégration de l'API (node --test) sur une base PostgreSQL dédiée « parkeasy_test »,
// recréée à chaque exécution (la base de démonstration « parkeasy » n'est pas touchée).
try { process.loadEnvFile(require('path').join(__dirname, '..', '.env')); } catch { /* valeurs par défaut */ }
process.env.PGDATABASE = (process.env.PGDATABASE || 'parkeasy') + '_test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { initDb, closeDb } = require('../src/db');
const { createApp } = require('../src/app');
const { at } = require('../database/seed');

let server, base;
const api = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const login = async (email, password) => (await api('POST', '/api/auth/login', { email, password })).body.token;
const DAY = 9; // créneaux de test dans 9 jours : aucune réservation de démonstration à cette date

let youssef, sami, leila, admin, vehicleId, cvId, space12;

before(async () => {
  await initDb({ reset: true });
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
  [youssef, sami, leila, admin] = await Promise.all([
    login('youssef@parkeasy.tn', 'Youssef123!'), login('sami@parkeasy.tn', 'Sami123!'),
    login('leila@parkeasy.tn', 'Leila123!'), login('admin@parkeasy.tn', 'Admin123!'),
  ]);
  vehicleId = (await api('GET', '/api/vehicles', null, youssef)).body[0].id;
  const search = await api('GET', `/api/parkings?q=CentreVille&start=${encodeURIComponent(at(DAY, 10))}&end=${encodeURIComponent(at(DAY, 14))}`);
  cvId = search.body.results[0].id;
  const spaces = (await api('GET', `/api/parkings/${cvId}/spaces?start=${encodeURIComponent(at(DAY, 10))}&end=${encodeURIComponent(at(DAY, 14))}`)).body;
  space12 = spaces.find((s) => s.code === 'P-12').id;
});
after(async () => {
  server.close();
  await closeDb();
});

const reserve = (space, h1, h2, token = youssef, day = DAY) =>
  api('POST', '/api/reservations', { space_id: space, vehicle_id: vehicleId, start: at(day, h1), end: at(day, h2) }, token);

test('recherche : parkings actifs uniquement, total estimé = tarif × heures', async () => {
  const r = await api('GET', `/api/parkings?start=${encodeURIComponent(at(DAY, 10))}&end=${encodeURIComponent(at(DAY, 14))}&sort=price`);
  assert.equal(r.status, 200);
  assert.ok(r.body.results.length >= 6);
  assert.ok(!r.body.results.some((p) => p.name === 'Parking Ennasr'), 'un parking en attente ne doit pas apparaître (RG5)');
  const cv = r.body.results.find((p) => p.name === 'Parking CentreVille');
  assert.equal(cv.estimated_total, 10); // 2,5 TND × 4 h
  const prices = r.body.results.map((p) => p.hourly_rate);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test('RG10 : chevauchement refusé, créneau adjacent accepté (intervalle [début, fin[)', async () => {
  const first = await reserve(space12, 10, 14);
  assert.equal(first.status, 201);
  assert.match(first.body.reference, /^RES-\d+$/);
  assert.equal(first.body.status, 'pending');
  assert.equal((await reserve(space12, 13, 15)).status, 409);
  assert.equal((await reserve(space12, 14, 16)).status, 201);
});

test('RG10 : deux demandes simultanées sur la même place -> une seule acceptée', async () => {
  const [a, b] = await Promise.all([reserve(space12, 18, 19), reserve(space12, 18, 20)]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
});

test('RG11 : montant arrondi à l\'heure entamée (1 h 30 -> 2 h)', async () => {
  const r = await api('POST', '/api/reservations', { space_id: space12 + 1, vehicle_id: vehicleId, start: at(DAY, 8), end: at(DAY, 9, 30) }, youssef);
  assert.equal(r.status, 201);
  assert.equal(r.body.amount, 5); // 2,5 TND × 2 h
});

test('RG12 : annulation -> la place redevient réservable', async () => {
  const r = await reserve(space12 + 2, 10, 12);
  assert.equal((await reserve(space12 + 2, 11, 12)).status, 409);
  const c = await api('POST', `/api/reservations/${r.body.id}/cancel`, null, youssef);
  assert.equal(c.status, 200);
  assert.equal((await reserve(space12 + 2, 11, 12)).status, 201);
});

test('horaires : réservation refusée hors des heures d\'ouverture', async () => {
  const lac = (await api('GET', '/api/parkings?q=Lac%201')).body.results[0]; // 07:00 – 23:00
  const sp = (await api('GET', `/api/parkings/${lac.id}/spaces`)).body.find((s) => s.availability !== 'out_of_service');
  const r = await api('POST', '/api/reservations', { space_id: sp.id, vehicle_id: vehicleId, start: at(DAY, 5), end: at(DAY, 8) }, youssef);
  assert.equal(r.status, 400);
  assert.match(r.body.message, /fermé/);
});

test('gestionnaire : confirmation ; un autre gestionnaire ne peut pas y toucher', async () => {
  const r = await reserve(space12 + 5, 15, 17); // P-17 (P-15 est hors service dans les données de démo)
  assert.equal(r.status, 201);
  assert.equal((await api('PATCH', `/api/manager/reservations/${r.body.id}`, { status: 'confirmed' }, leila)).status, 404);
  const ok = await api('PATCH', `/api/manager/reservations/${r.body.id}`, { status: 'confirmed' }, sami);
  assert.equal(ok.status, 200);
  const mine = await api('GET', '/api/reservations/me?tab=upcoming', null, youssef);
  assert.equal(mine.body.results.find((x) => x.id === r.body.id).status, 'confirmed');
  assert.equal((await api('GET', '/api/manager/dashboard', null, youssef)).status, 403);
});

test('RG7 : une place hors service n\'est plus réservable', async () => {
  const s = space12 + 4;
  assert.equal((await api('PATCH', `/api/manager/spaces/${s}`, { state: 'out_of_service' }, sami)).status, 200);
  assert.equal((await reserve(s, 10, 11)).status, 409);
  await api('PATCH', `/api/manager/spaces/${s}`, { state: 'in_service' }, sami);
  assert.equal((await reserve(s, 10, 11)).status, 201);
});

test('RG14 : avis seulement sur une réservation terminée, une seule fois', async () => {
  const past = (await api('GET', '/api/reservations/me?tab=past', null, youssef)).body.results[0];
  assert.equal((await api('POST', `/api/reservations/${past.id}/review`, { rating: 5, comment: 'Parfait' }, youssef)).status, 201);
  assert.equal((await api('POST', `/api/reservations/${past.id}/review`, { rating: 4 }, youssef)).status, 409);
  const upcoming = (await api('GET', '/api/reservations/me?tab=upcoming', null, youssef)).body.results[0];
  assert.equal((await api('POST', `/api/reservations/${upcoming.id}/review`, { rating: 4 }, youssef)).status, 400);
});

test('RG5 : nouveau parking en attente, visible après validation admin', async () => {
  const zones = (await api('GET', '/api/zones')).body;
  const c = await api('POST', '/api/manager/parkings', {
    name: 'Parking Test', address: 'Rue de test', zone_id: zones[0].id, hourly_rate: 2, open_24h: false,
    opening_time: '08:00', closing_time: '20:00', levels: 1, spaces_per_level: 5, amenity_ids: [1, 2],
  }, sami);
  assert.equal(c.status, 201);
  const visible = async () => (await api('GET', '/api/parkings?q=Parking%20Test')).body.results.length;
  assert.equal(await visible(), 0);
  assert.equal((await api('PATCH', `/api/admin/parkings/${c.body.id}`, { status: 'active' }, admin)).status, 200);
  assert.equal(await visible(), 1);
});

test('RG1 : un compte suspendu ne peut plus se connecter', async () => {
  const users = (await api('GET', '/api/admin/users?q=karim', null, admin)).body;
  await api('PATCH', `/api/admin/users/${users[0].id}`, { status: 'suspended' }, admin);
  const r = await api('POST', '/api/auth/login', { email: users[0].email, password: 'Driver123!' });
  assert.equal(r.status, 403);
});

test('RG2 : véhicule — immatriculation unique et format vérifié', async () => {
  assert.equal((await api('POST', '/api/vehicles', { plate: '215 TU 4587' }, youssef)).status, 409);
  assert.equal((await api('POST', '/api/vehicles', { plate: 'abc' }, youssef)).status, 400);
  assert.equal((await api('POST', '/api/vehicles', { plate: '230 tu 1111', brand: 'Fiat' }, youssef)).status, 201);
});

// ---------------------------------------------------------------- Objectif 04

test('Aide & contact : message validé, enregistré, visible et traité par l’administrateur', async () => {
  assert.equal((await api('POST', '/api/contact', { name: 'Test', email: 'pas-un-email', topic: 'other', message: 'Bonjour, une question.' })).status, 400);
  assert.equal((await api('POST', '/api/contact', { name: 'Test', email: 'test@mail.tn', topic: 'other', message: 'court' })).status, 400);
  const sent = await api('POST', '/api/contact', { name: 'Lina Test', email: 'lina@mail.tn', topic: 'reservation', message: 'Ma réservation RES-1234 est-elle confirmée ?' }, youssef);
  assert.equal(sent.status, 201);
  // Réservé à l'administrateur
  assert.equal((await api('GET', '/api/admin/messages', null, sami)).status, 403);
  const inbox = (await api('GET', '/api/admin/messages?status=new', null, admin)).body;
  const msg = inbox.find((m) => m.id === sent.body.id);
  assert.equal(msg.author_role, 'driver');
  assert.equal((await api('PATCH', `/api/admin/messages/${msg.id}`, { status: 'done' }, admin)).status, 200);
  const done = (await api('GET', '/api/admin/messages?status=done', null, admin)).body;
  assert.ok(done.some((m) => m.id === msg.id && m.handled_at));
});

test('démarrage : la base existante est conservée (pas de réinitialisation à chaque lancement)', async () => {
  const before = (await api('GET', '/api/stats')).body.reservations;
  await initDb(); // second démarrage sans --reset
  assert.equal((await api('GET', '/api/stats')).body.reservations, before);
});
