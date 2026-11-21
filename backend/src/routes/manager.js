// Espace gestionnaire : tableau de bord, parkings & places (RG3 à RG8), réservations reçues (RG12)
const router = require('express').Router();
const { db } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../validate');
const B = require('../business');
const { levelOrder } = require('./parkings');

router.use(requireRole('manager'));

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const own = (req, parkingId) => db.get('SELECT * FROM parkings WHERE id = ? AND manager_id = ?', [Number(parkingId) || 0, req.user.id]);

// ---------- Tableau de bord ----------
// GET /api/manager/dashboard?period=day|week|month
router.get('/dashboard', async (req, res) => {
  await B.refreshStatuses();
  const m = req.user.id;
  const kpi = await db.get(
    `SELECT
       (SELECT COUNT(*) FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id WHERE p.manager_id = ?) AS total_spaces,
       (SELECT COUNT(*) FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id
         WHERE p.manager_id = ? AND s.state = 'in_service'
           AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.space_id = s.id AND r.status IN ${B.ACTIVE}
                           AND tstzrange(r.start_at, r.end_at) @> NOW())) AS free_now,
       (SELECT COUNT(*) FROM reservations r JOIN parking_spaces s ON s.id = r.space_id JOIN parkings p ON p.id = s.parking_id
         WHERE p.manager_id = ? AND r.status <> 'cancelled' AND r.start_at::date = CURRENT_DATE) AS reservations_today,
       (SELECT COALESCE(SUM(r.amount), 0) FROM reservations r JOIN parking_spaces s ON s.id = r.space_id JOIN parkings p ON p.id = s.parking_id
         WHERE p.manager_id = ? AND r.status IN ('confirmed', 'completed') AND r.start_at::date = CURRENT_DATE) AS revenue_today,
       (SELECT COUNT(*) FROM reservations r JOIN parking_spaces s ON s.id = r.space_id JOIN parkings p ON p.id = s.parking_id
         WHERE p.manager_id = ? AND r.status = 'pending') AS pending,
       (SELECT COUNT(*) FROM parkings WHERE manager_id = ?) AS parkings`,
    [m, m, m, m, m, m]
  );

  // Taux d'occupation : heure par heure aujourd'hui, ou jour par jour (7 / 30 jours)
  const period = ['week', 'month'].includes(req.query.period) ? req.query.period : 'day';
  let occupancy;
  if (period === 'day') {
    occupancy = await db.all(
      `WITH spaces AS (SELECT s.id FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id
                       WHERE p.manager_id = ? AND p.status = 'active' AND s.state = 'in_service'),
            hours AS (SELECT h, (CURRENT_DATE + make_interval(hours => h))::timestamptz AS t FROM generate_series(7, 21) h)
       SELECT LPAD(h::text, 2, '0') || 'h' AS label,
              ROUND(100.0 * COUNT(DISTINCT r.space_id) / NULLIF((SELECT COUNT(*) FROM spaces), 0)) AS value
       FROM hours LEFT JOIN reservations r
         ON r.space_id IN (SELECT id FROM spaces) AND r.status <> 'cancelled'
        AND tstzrange(r.start_at, r.end_at) && tstzrange(hours.t, hours.t + INTERVAL '1 hour')
       GROUP BY h ORDER BY h`,
      [m]
    );
  } else {
    const days = period === 'week' ? 6 : 29;
    occupancy = await db.all(
      `WITH spaces AS (SELECT s.id FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id
                       WHERE p.manager_id = ? AND p.status = 'active' AND s.state = 'in_service'),
            days AS (SELECT d::date AS d FROM generate_series(CURRENT_DATE - ?::int, CURRENT_DATE, INTERVAL '1 day') d)
       SELECT to_char(d, 'DD/MM') AS label,
              LEAST(100, ROUND(100.0 * COALESCE(SUM(EXTRACT(EPOCH FROM (
                LEAST(r.end_at, (d + 1)::timestamptz) - GREATEST(r.start_at, d::timestamptz))) / 3600), 0)
                / NULLIF((SELECT COUNT(*) FROM spaces) * 15, 0))) AS value
       FROM days LEFT JOIN reservations r
         ON r.space_id IN (SELECT id FROM spaces) AND r.status <> 'cancelled'
        AND tstzrange(r.start_at, r.end_at) && tstzrange(d::timestamptz, (d + 1)::timestamptz)
       GROUP BY d ORDER BY d`,
      [m, days]
    );
  }

  const parkings = await db.all(
    `SELECT p.id, p.name, p.status,
       (SELECT COUNT(*) FROM parking_spaces s WHERE s.parking_id = p.id) AS total,
       (SELECT COUNT(DISTINCT r.space_id) FROM reservations r JOIN parking_spaces s ON s.id = r.space_id
         WHERE s.parking_id = p.id AND r.status IN ${B.ACTIVE} AND tstzrange(r.start_at, r.end_at) @> NOW()) AS occupied
     FROM parkings p WHERE p.manager_id = ? ORDER BY p.id`,
    [m]
  );
  const latest = await db.all(`${B.RESERVATION_SELECT} WHERE p.manager_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 6`, [m]);
  res.json({ kpi, period, occupancy, parkings, latest, alert_threshold: 85 });
});

// ---------- Parkings ----------
router.get('/parkings', async (req, res) => {
  res.json(await db.all(
    `SELECT p.id, p.name, p.status, p.hourly_rate, z.name AS zone,
       (SELECT COUNT(*) FROM parking_spaces s WHERE s.parking_id = p.id) AS total_spaces
     FROM parkings p JOIN zones z ON z.id = p.zone_id WHERE p.manager_id = ? ORDER BY p.id`, [req.user.id]));
});

// GET /api/manager/parkings/:id — informations + plan des places en temps réel
router.get('/parkings/:id', async (req, res) => {
  const p = await own(req, req.params.id);
  if (!p) return res.status(404).json({ message: 'Parking introuvable' });
  await B.refreshStatuses();
  const [info, amenities, photos, spaces] = await Promise.all([
    db.get(`SELECT p.*, to_char(p.opening_time, 'HH24:MI') AS opening_time, to_char(p.closing_time, 'HH24:MI') AS closing_time,
              z.name AS zone, z.city FROM parkings p JOIN zones z ON z.id = p.zone_id WHERE p.id = ?`, [p.id]),
    db.all('SELECT amenity_id FROM parking_amenities WHERE parking_id = ?', [p.id]),
    db.all('SELECT * FROM parking_photos WHERE parking_id = ? ORDER BY position, id', [p.id]),
    db.all(
      `SELECT s.*,
         CASE WHEN s.state = 'out_of_service' THEN 'out_of_service'
              WHEN EXISTS (SELECT 1 FROM reservations r WHERE r.space_id = s.id AND r.status IN ${B.ACTIVE}
                           AND tstzrange(r.start_at, r.end_at) @> NOW()) THEN 'occupied'
              WHEN EXISTS (SELECT 1 FROM reservations r WHERE r.space_id = s.id AND r.status IN ${B.ACTIVE}
                           AND r.start_at > NOW() AND r.start_at::date = CURRENT_DATE) THEN 'reserved'
              ELSE 'free' END AS live_state,
         (SELECT COUNT(*) FROM reservations r WHERE r.space_id = s.id AND r.status IN ${B.ACTIVE} AND r.end_at > NOW()) AS upcoming
       FROM parking_spaces s WHERE s.parking_id = ? ORDER BY s.id`,
      [p.id]
    ),
  ]);
  const levels = [...new Set(spaces.map((s) => s.level))].sort((a, b) => levelOrder(a) - levelOrder(b));
  res.json({ ...info, amenity_ids: amenities.map((a) => a.amenity_id), photos, spaces, levels });
});

const parkingRules = {
  name: { label: 'Le nom', required: true, maxLength: 120 },
  address: { label: "L'adresse", required: true, maxLength: 200 },
  zone_id: { label: 'La zone', required: true, int: true },
  hourly_rate: { label: 'Le tarif horaire', required: true, min: 0, max: 100 },
  description: { label: 'La description', maxLength: 1000 },
  latitude: { label: 'La latitude', min: -90, max: 90 },
  longitude: { label: 'La longitude', min: -180, max: 180 },
};

function checkHours(b) {
  if (b.open_24h) return null;
  if (!TIME_RE.test(b.opening_time || '') || !TIME_RE.test(b.closing_time || ''))
    return "Les horaires d'ouverture et de fermeture sont obligatoires (format HH:MM) si le parking n'est pas ouvert 24h/24";
  if (b.closing_time <= b.opening_time) return "L'heure de fermeture doit être après l'heure d'ouverture";
  return null;
}

async function saveAmenities(tx, parkingId, ids) {
  await tx.run('DELETE FROM parking_amenities WHERE parking_id = ?', [parkingId]);
  for (const a of [...new Set((ids || []).map(Number).filter(Boolean))]) {
    await tx.run('INSERT INTO parking_amenities (parking_id, amenity_id) SELECT ?, id FROM amenities WHERE id = ?', [parkingId, a]);
  }
}

// POST /api/manager/parkings — nouveau parking « en attente » de validation (RG5)
router.post(
  '/parkings',
  validate({ ...parkingRules, levels: { label: 'Le nombre de niveaux', required: true, int: true, min: 1, max: 6 }, spaces_per_level: { label: 'Le nombre de places par niveau', required: true, int: true, min: 1, max: 60 } }),
  async (req, res) => {
    const b = req.body;
    const err = checkHours(b);
    if (err) return res.status(400).json({ message: err });
    if (!(await db.get('SELECT id FROM zones WHERE id = ?', [Number(b.zone_id)]))) return res.status(400).json({ message: 'Zone inconnue' });

    const id = await db.transaction(async (tx) => {
      const pid = await tx.insert(
        `INSERT INTO parkings (manager_id, zone_id, name, address, latitude, longitude, description, hourly_rate, open_24h, opening_time, closing_time)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [req.user.id, Number(b.zone_id), b.name.trim(), b.address.trim(), b.latitude ?? null, b.longitude ?? null, b.description?.trim() || null,
          Number(b.hourly_rate), !!b.open_24h, b.open_24h ? null : b.opening_time, b.open_24h ? null : b.closing_time]
      );
      await saveAmenities(tx, pid, b.amenity_ids);
      const levels = ['RDC', '-1', '-2', '-3', '1', '2'].slice(0, Number(b.levels));
      let num = 1;
      for (const level of levels) {
        for (let k = 1; k <= Number(b.spaces_per_level); k++, num++) {
          await tx.run('INSERT INTO parking_spaces (parking_id, code, level) VALUES (?,?,?)', [pid, `P-${String(num).padStart(2, '0')}`, level]);
        }
      }
      await tx.run('INSERT INTO parking_photos (parking_id, url, position) VALUES (?, ?, 0)', [pid, `/img/parking-${1 + (pid % 6)}.svg`]);
      return pid;
    });
    res.status(201).json({ id, message: "Parking créé : il sera visible après validation par l'administrateur." });
  }
);

// PUT /api/manager/parkings/:id — informations et équipements
router.put('/parkings/:id', validate(parkingRules), async (req, res) => {
  const p = await own(req, req.params.id);
  if (!p) return res.status(404).json({ message: 'Parking introuvable' });
  const b = req.body;
  const err = checkHours(b);
  if (err) return res.status(400).json({ message: err });
  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE parkings SET name = ?, address = ?, zone_id = ?, latitude = ?, longitude = ?, description = ?, hourly_rate = ?,
         open_24h = ?, opening_time = ?, closing_time = ? WHERE id = ?`,
      [b.name.trim(), b.address.trim(), Number(b.zone_id), b.latitude ?? null, b.longitude ?? null, b.description?.trim() || null,
        Number(b.hourly_rate), !!b.open_24h, b.open_24h ? null : b.opening_time, b.open_24h ? null : b.closing_time, p.id]
    );
    await saveAmenities(tx, p.id, b.amenity_ids);
  });
  res.json({ message: 'Parking mis à jour (les réservations existantes conservent leur montant).' });
});

// POST /api/manager/parkings/:id/spaces — { level, count, type }
router.post(
  '/parkings/:id/spaces',
  validate({
    level: { label: 'Le niveau', required: true, maxLength: 10 },
    count: { label: 'Le nombre de places', required: true, int: true, min: 1, max: 60 },
    type: { label: 'Le type', required: true, in: ['standard', 'pmr', 'electric', 'moto'] },
  }),
  async (req, res) => {
    const p = await own(req, req.params.id);
    if (!p) return res.status(404).json({ message: 'Parking introuvable' });
    await db.transaction(async (tx) => {
      const { n } = await tx.get(`SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) AS n FROM parking_spaces WHERE parking_id = ?`, [p.id]);
      for (let i = 1; i <= Number(req.body.count); i++) {
        await tx.run('INSERT INTO parking_spaces (parking_id, code, level, type) VALUES (?,?,?,?)',
          [p.id, `P-${String(n + i).padStart(2, '0')}`, req.body.level.trim(), req.body.type]);
      }
    });
    res.status(201).json({ message: `${req.body.count} place(s) ajoutée(s)` });
  }
);

// PATCH /api/manager/spaces/:id — { state: in_service | out_of_service } (RG7)
router.patch('/spaces/:id', validate({ state: { label: "L'état", required: true, in: ['in_service', 'out_of_service'] } }), async (req, res) => {
  const s = await db.get(
    `SELECT s.* FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id WHERE s.id = ? AND p.manager_id = ?`,
    [Number(req.params.id) || 0, req.user.id]
  );
  if (!s) return res.status(404).json({ message: 'Place introuvable' });
  await db.run('UPDATE parking_spaces SET state = ? WHERE id = ?', [req.body.state, s.id]);
  const upcoming = (await db.get(`SELECT COUNT(*) AS n FROM reservations WHERE space_id = ? AND status IN ${B.ACTIVE} AND end_at > NOW()`, [s.id])).n;
  res.json({
    message: req.body.state === 'out_of_service'
      ? `Place ${s.code} mise hors service : elle n'est plus réservable.${upcoming ? ` Attention : ${upcoming} réservation(s) à venir à traiter.` : ''}`
      : `Place ${s.code} remise en service.`,
    upcoming,
  });
});

// Photos
router.post('/parkings/:id/photos', validate({ url: { label: "L'URL de la photo", required: true, maxLength: 255 } }), async (req, res) => {
  const p = await own(req, req.params.id);
  if (!p) return res.status(404).json({ message: 'Parking introuvable' });
  const url = req.body.url.trim();
  if (!/^(https?:\/\/|\/img\/)/.test(url)) return res.status(400).json({ message: "L'URL doit commencer par http(s)://" });
  await db.run(`INSERT INTO parking_photos (parking_id, url, position)
                VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM parking_photos WHERE parking_id = ?))`, [p.id, url, p.id]);
  res.status(201).json({ message: 'Photo ajoutée' });
});

router.delete('/photos/:id', async (req, res) => {
  const n = await db.run(
    `DELETE FROM parking_photos ph USING parkings p WHERE ph.id = ? AND p.id = ph.parking_id AND p.manager_id = ?`,
    [Number(req.params.id) || 0, req.user.id]
  );
  if (!n) return res.status(404).json({ message: 'Photo introuvable' });
  res.json({ message: 'Photo supprimée' });
});

// ---------- Réservations reçues ----------
// GET /api/manager/reservations?parking=&status=&from=&to=&q=&page=
router.get('/reservations', async (req, res) => {
  await B.refreshStatuses();
  const q = req.query;
  const where = ['p.manager_id = ?'];
  const params = [req.user.id];
  if (Number(q.parking)) { where.push('p.id = ?'); params.push(Number(q.parking)); }
  if (['pending', 'confirmed', 'cancelled', 'completed'].includes(q.status)) { where.push('r.status = ?'); params.push(q.status); }
  if (q.from && !isNaN(Date.parse(q.from))) { where.push('r.start_at::date >= ?::date'); params.push(q.from); }
  if (q.to && !isNaN(Date.parse(q.to))) { where.push('r.start_at::date <= ?::date'); params.push(q.to); }
  if (q.q) {
    where.push(`(r.reference ILIKE ? OR u.first_name || ' ' || u.last_name ILIKE ? OR v.plate ILIKE ? OR s.code ILIKE ?)`);
    params.push(...Array(4).fill(`%${q.q}%`));
  }
  const pageSize = 10;
  const page = Math.max(1, Number(q.page) || 1);
  const base = `${B.RESERVATION_SELECT} WHERE ${where.join(' AND ')}`;
  const [{ total }, rows, counts] = await Promise.all([
    db.get(`SELECT COUNT(*) AS total FROM (${base}) t`, params),
    db.all(`${base} ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.start_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params),
    db.get(`SELECT COUNT(*) FILTER (WHERE r.status = 'pending') AS pending, COUNT(*) FILTER (WHERE r.status = 'confirmed') AS confirmed,
                   COUNT(*) FILTER (WHERE r.status = 'completed') AS completed, COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled
            FROM reservations r JOIN parking_spaces s ON s.id = r.space_id JOIN parkings p ON p.id = s.parking_id WHERE p.manager_id = ?`, [req.user.id]),
  ]);
  res.json({ total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), counts, results: rows });
});

// PATCH /api/manager/reservations/:id — { status: confirmed | cancelled }
router.patch('/reservations/:id', validate({ status: { label: 'Le statut', required: true, in: ['confirmed', 'cancelled'] } }), async (req, res) => {
  await B.refreshStatuses(true);
  const r = await db.get(`${B.RESERVATION_SELECT} WHERE r.id = ? AND p.manager_id = ?`, [Number(req.params.id) || 0, req.user.id]);
  if (!r) return res.status(404).json({ message: 'Réservation introuvable' });
  const { status } = req.body;
  const ok = (status === 'confirmed' && r.status === 'pending') ||
             (status === 'cancelled' && ['pending', 'confirmed'].includes(r.status) && new Date(r.start_at) > Date.now());
  if (!ok) return res.status(400).json({ message: `Impossible de passer la réservation ${r.reference} de « ${r.status} » à « ${status} »` });
  await db.run(`UPDATE reservations SET status = ?, cancelled_at = CASE WHEN ?::text = 'cancelled' THEN NOW() ELSE cancelled_at END WHERE id = ?`,
    [status, status, r.id]);
  res.json({ message: status === 'confirmed' ? `Réservation ${r.reference} confirmée` : `Réservation ${r.reference} refusée` });
});

module.exports = router;
