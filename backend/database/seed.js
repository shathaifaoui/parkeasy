// Données de démonstration (référentiels, comptes, parkings, réservations, avis)
const bcrypt = require('bcryptjs');

// Générateur pseudo-aléatoire déterministe : les mêmes données à chaque réinitialisation
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2026);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Dates à l'heure de Tunis (UTC+1, pas d'heure d'été)
const tunisToday = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
function at(dayOffset, hour, minute = 0) {
  const d = new Date(tunisToday() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dayOffset);
  const hh = String(Math.floor(hour)).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${d.toISOString().slice(0, 10)}T${hh}:${mm}:00+01:00`;
}

const AMENITIES = [
  ['Sécurité 24/7', 'shield'], ['Couvert', 'roof'], ['Vidéosurveillance', 'camera'],
  ['Borne de recharge', 'bolt'], ['Accès PMR', 'accessible'], ['Lavage', 'wash'], ['Ascenseur', 'elevator'],
];

const ZONES = [
  ['Centre-ville', 'Tunis'], ['Les Berges du Lac', 'Tunis'], ['Belvédère', 'Tunis'], ['La Marsa', 'Tunis'],
  ['Bab Bhar', 'Tunis'], ['Ennasr', 'Ariana'], ['Menzah', 'Ariana'], ['Médina', 'Sousse'],
];

const COMMENTS = [
  [5, 'Très bien situé, sécurisé et propre. Réservation simple.'],
  [4, 'Accès facile, un peu étroit au niveau -2.'],
  [5, 'Personnel accueillant, place disponible comme prévu.'],
  [4, 'Pratique pour aller au centre, je recommande.'],
  [3, 'Correct mais la sortie est un peu longue aux heures de pointe.'],
  [5, 'Parfait pour un rendez-vous au centre-ville.'],
  [4, 'Bon rapport qualité-prix.'],
  [2, 'Éclairage insuffisant au sous-sol.'],
  [5, 'Borne de recharge fonctionnelle, top !'],
  [4, 'Réservation confirmée rapidement par le gestionnaire.'],
];

async function bulkInsert(db, table, cols, rows) {
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const values = chunk.map((r, j) => `(${cols.map((_, k) => `$${j * cols.length + k + 1}`).join(',')})`).join(',');
    // les paramètres sont déjà au format $n : on passe par une requête brute
    await db.raw(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values}`, chunk.flat());
  }
}

async function seed(db) {
  const amenityId = {};
  for (const [label, icon] of AMENITIES) amenityId[label] = await db.insert('INSERT INTO amenities (label, icon) VALUES (?, ?)', [label, icon]);
  const zoneId = {};
  for (const [name, city] of ZONES) zoneId[name] = await db.insert('INSERT INTO zones (name, city) VALUES (?, ?)', [name, city]);

  const hash = (p) => bcrypt.hashSync(p, 8);
  const user = (first, last, email, pwd, role, phone = null, status = 'active') =>
    db.insert(
      'INSERT INTO users (first_name, last_name, email, password_hash, phone, role, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [first, last, email, hash(pwd), phone, role, status, at(-60 - Math.floor(rand() * 200), 10)]
    );

  // ----- Comptes de démonstration -----
  await user('Admin', 'ParkEasy', 'admin@parkeasy.tn', 'Admin123!', 'admin');
  const sami = await user('Sami', 'Trabelsi', 'sami@parkeasy.tn', 'Sami123!', 'manager', '98 456 123');
  const leila = await user('Leila', 'Ben Amor', 'leila@parkeasy.tn', 'Leila123!', 'manager', '97 222 333');
  const youssef = await user('Youssef', 'Jmail', 'youssef@parkeasy.tn', 'Youssef123!', 'driver', '22 345 678');

  const autres = [
    ['Amel', 'Ben Ali'], ['Karim', 'Saidi'], ['Mariem', 'Gharbi'], ['Skander', 'Trabelsi'], ['Ines', 'Mansouri'],
    ['Omar', 'Kefi'], ['Nour', 'Hammami'], ['Aziz', 'Riahi'], ['Salma', 'Zouari'], ['Hamza', 'Chaabane'],
  ];
  const drivers = [youssef];
  for (const [f, l] of autres) {
    drivers.push(await user(f, l, `${f.toLowerCase()}.${l.toLowerCase().replace(/\s/g, '')}@mail.tn`, 'Driver123!', 'driver', `2${Math.floor(1e6 + rand() * 8e6)}`));
  }
  await user('Walid', 'Mejri', 'walid.mejri@mail.tn', 'Driver123!', 'driver', null, 'suspended');

  // Véhicules
  const brands = [['Volkswagen', 'Golf'], ['Kia', 'Picanto'], ['Peugeot', '208'], ['Renault', 'Clio'], ['Hyundai', 'i20'], ['Toyota', 'Yaris'], ['Seat', 'Ibiza']];
  const vehicleOf = {};
  vehicleOf[youssef] = [
    await db.insert('INSERT INTO vehicles (owner_id, plate, brand, model) VALUES (?,?,?,?)', [youssef, '215 TU 4587', 'Volkswagen', 'Golf']),
    await db.insert('INSERT INTO vehicles (owner_id, plate, brand, model) VALUES (?,?,?,?)', [youssef, '198 TU 1203', 'Kia', 'Picanto']),
  ];
  let n = 1000;
  for (const d of drivers.slice(1)) {
    const [b, m] = pick(brands);
    vehicleOf[d] = [await db.insert('INSERT INTO vehicles (owner_id, plate, brand, model) VALUES (?,?,?,?)', [d, `${180 + (n % 60)} TU ${n++ * 7 % 9000 + 1000}`, b, m])];
  }

  // ----- Parkings -----
  const PARKINGS = [
    { name: 'Parking CentreVille', manager: sami, zone: 'Centre-ville', address: 'Avenue Habib Bourguiba, Tunis', lat: 36.79985, lng: 10.18535, rate: 2.5, h24: true, levels: ['-1', '-2', 'RDC'], perLevel: 24, amen: ['Sécurité 24/7', 'Couvert', 'Vidéosurveillance', 'Borne de recharge', 'Accès PMR', 'Ascenseur'], photos: [1, 2, 3], desc: "Parking souterrain au cœur de Tunis, à deux pas de l'avenue Habib Bourguiba et du théâtre municipal. Accès direct par ascenseur." },
    { name: 'Parking Lac 1', manager: sami, zone: 'Les Berges du Lac', address: 'Rue du Lac Biwa, Les Berges du Lac', lat: 36.83285, lng: 10.23325, rate: 3, open: '07:00', close: '23:00', levels: ['-1', '-2'], perLevel: 16, amen: ['Sécurité 24/7', 'Couvert', 'Vidéosurveillance', 'Lavage'], photos: [4, 2], desc: 'Parking couvert au pied des bureaux et des restaurants des Berges du Lac.' },
    { name: 'Parking Ennasr', manager: sami, zone: 'Ennasr', address: 'Avenue Hédi Nouira, Ennasr 2', lat: 36.86160, lng: 10.16500, rate: 1.5, open: '06:00', close: '22:00', levels: ['RDC'], perLevel: 12, amen: ['Vidéosurveillance', 'Accès PMR'], photos: [5], desc: 'Nouveau parking en plein air près des commerces de Ennasr.', status: 'pending' },
    { name: 'Parking Gare Barcelone', manager: leila, zone: 'Bab Bhar', address: 'Place Barcelone, Tunis', lat: 36.79515, lng: 10.18045, rate: 1.5, h24: true, levels: ['RDC'], perLevel: 16, amen: ['Sécurité 24/7', 'Vidéosurveillance'], photos: [5, 6], desc: 'Idéal pour prendre le train ou le métro léger : sortie directe sur la place Barcelone.' },
    { name: 'Parking Belvédère', manager: leila, zone: 'Belvédère', address: 'Avenue Taïeb Mhiri, Tunis', lat: 36.81705, lng: 10.17345, rate: 2, open: '06:00', close: '22:00', levels: ['-1', 'RDC'], perLevel: 12, amen: ['Couvert', 'Vidéosurveillance', 'Accès PMR'], photos: [6, 1], desc: 'À proximité du parc du Belvédère et des cliniques du quartier.' },
    { name: 'Parking La Marsa Plage', manager: leila, zone: 'La Marsa', address: 'Avenue Habib Bourguiba, La Marsa', lat: 36.88395, lng: 10.32905, rate: 2, open: '08:00', close: '20:00', levels: ['RDC'], perLevel: 14, amen: ['Sécurité 24/7', 'Accès PMR'], photos: [4], desc: 'À 2 minutes à pied de la plage et de la corniche de La Marsa.' },
    { name: 'Parking Menzah 6', manager: leila, zone: 'Menzah', address: 'Rue Ibn Khaldoun, El Menzah 6', lat: 36.84405, lng: 10.17905, rate: 1, h24: true, levels: ['RDC'], perLevel: 12, amen: ['Vidéosurveillance'], photos: [3], desc: 'Parking de quartier économique, accessible jour et nuit.' },
    { name: 'Parking Médina Sousse', manager: sami, zone: 'Médina', address: 'Boulevard Hassouna Ayachi, Sousse', lat: 35.82770, lng: 10.63950, rate: 1.5, open: '07:00', close: '22:00', levels: ['RDC', '1'], perLevel: 12, amen: ['Sécurité 24/7', 'Couvert', 'Borne de recharge'], photos: [2, 6], desc: 'Aux portes de la médina de Sousse, idéal pour les visites et le shopping.' },
  ];

  const spaces = []; // { id, parking, open, close }
  for (const p of PARKINGS) {
    p.id = await db.insert(
      `INSERT INTO parkings (manager_id, zone_id, name, address, latitude, longitude, description, hourly_rate, open_24h,
        opening_time, closing_time, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.manager, zoneId[p.zone], p.name, p.address, p.lat, p.lng, p.desc, p.rate, !!p.h24, p.open ?? null, p.close ?? null,
        p.status ?? 'active', p.status === 'pending' ? at(-1, 15) : at(-150, 9)]
    );
    for (const a of p.amen) await db.run('INSERT INTO parking_amenities VALUES (?, ?)', [p.id, amenityId[a]]);
    for (const [i, ph] of p.photos.entries()) await db.run('INSERT INTO parking_photos (parking_id, url, position) VALUES (?,?,?)', [p.id, `/img/parking-${ph}.svg`, i]);

    let num = 1;
    for (const level of p.levels) {
      for (let k = 1; k <= p.perLevel; k++, num++) {
        const pos = k % 8;
        const type = k === 1 || k === 13 ? 'pmr' : pos === 7 ? 'electric' : k === p.perLevel ? 'moto' : 'standard';
        const state = (p.name === 'Parking CentreVille' && num === 15) || (p.name === 'Parking Lac 1' && num === 20) ? 'out_of_service' : 'in_service';
        const id = await db.insert('INSERT INTO parking_spaces (parking_id, code, level, type, state) VALUES (?,?,?,?,?)',
          [p.id, `P-${String(num).padStart(2, '0')}`, level, type, state]);
        if (state === 'in_service' && p.status !== 'pending') {
          spaces.push({ id, p, open: p.h24 ? 7 : parseInt(p.open), close: p.h24 ? 22 : parseInt(p.close), code: `P-${String(num).padStart(2, '0')}` });
        }
      }
    }
  }

  // ----- Réservations de Youssef (scénario du persona) -----
  const cv = PARKINGS[0];
  const spaceOf = (p, code) => spaces.find((s) => s.p === p && s.code === code).id;
  const resa = []; // lignes : driver, space, vehicle, start, end, amount, status, created, cancelled
  const reserved = new Set(); // "spaceId|day" déjà utilisés pour Youssef
  const addRes = (driver, space, rate, day, h1, h2, status) => {
    const created = at(Math.min(day, 0) - 1, 18);
    resa.push([driver, space, pick(vehicleOf[driver]), at(day, h1), at(day, h2), Math.ceil(h2 - h1) * rate, status, created, status === 'cancelled' ? at(Math.min(day, 0) - 1, 20) : null]);
    reserved.add(`${space}|${day}`);
  };
  addRes(youssef, spaceOf(cv, 'P-12'), cv.rate, 2, 10, 14, 'pending');
  addRes(youssef, spaceOf(PARKINGS[1], 'P-05'), PARKINGS[1].rate, 4, 9, 12, 'confirmed');
  addRes(youssef, spaceOf(cv, 'P-03'), cv.rate, -3, 9, 11, 'completed');
  addRes(youssef, spaceOf(PARKINGS[3], 'P-08'), PARKINGS[3].rate, -10, 14, 16, 'completed');
  addRes(youssef, spaceOf(PARKINGS[4], 'P-02'), PARKINGS[4].rate, -6, 15, 17, 'cancelled');

  // ----- Activité simulée : 14 jours passés, aujourd'hui et 5 jours à venir -----
  const nowH = (Date.now() / 3600e3 + 1) % 24; // heure actuelle à Tunis
  const autresDrivers = drivers.slice(1);
  for (const s of spaces) {
    for (let day = -14; day <= 5; day++) {
      if (reserved.has(`${s.id}|${day}`)) continue;
      const busy = day === 0 ? 0.75 : day > 0 ? 0.35 - day * 0.05 : 0.72;
      let h = s.open + Math.floor(rand() * 3);
      while (h < s.close - 1 && rand() < busy) {
        const dur = 1 + Math.floor(rand() * 4);
        const end = Math.min(h + dur, s.close);
        const isPast = day < 0 || (day === 0 && end <= nowH);
        const started = day < 0 || (day === 0 && h <= nowH);
        let status;
        if (isPast) status = rand() < 0.1 ? 'cancelled' : 'completed';
        else if (started) status = 'confirmed';
        else status = rand() < (day === 0 ? 0.12 : 0.22) ? 'pending' : rand() < 0.08 ? 'cancelled' : 'confirmed';
        const driver = pick(autresDrivers);
        resa.push([driver, s.id, vehicleOf[driver][0], at(day, h), at(day, end), Math.ceil(end - h) * s.p.rate, status,
          at(Math.min(day, 0) - 1 - Math.floor(rand() * 3), 8 + Math.floor(rand() * 12)), status === 'cancelled' ? at(Math.min(day, 0) - 1, 21) : null]);
        h = end + Math.floor(rand() * 3);
      }
    }
  }
  await bulkInsert(db, 'reservations', ['driver_id', 'space_id', 'vehicle_id', 'start_at', 'end_at', 'amount', 'status', 'created_at', 'cancelled_at'], resa);

  // ----- Avis sur une partie des réservations terminées (pas celles de Youssef : il pourra en laisser) -----
  const done = await db.all(`SELECT id, end_at FROM reservations WHERE status = 'completed' AND driver_id <> ? ORDER BY id`, [youssef]);
  const reviews = [];
  for (const r of done) {
    if (rand() < 0.12) {
      const [rating, comment] = pick(COMMENTS);
      reviews.push([r.id, rating, comment, r.end_at]);
    }
  }
  await bulkInsert(db, 'reviews', ['reservation_id', 'rating', 'comment', 'created_at'], reviews);

  // Favoris de Youssef
  await db.run('INSERT INTO favorites (user_id, parking_id) VALUES (?, ?), (?, ?)', [youssef, cv.id, youssef, PARKINGS[1].id]);
}

module.exports = { seed, at };
