// Recherche, comparaison et détail des parkings (accès public)
const router = require('express').Router();
const { db } = require('../db');
const { optionalAuth } = require('../middleware/auth');
const B = require('../business');

const int = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

// GET /api/zones · /api/amenities · /api/stats
router.get('/zones', async (_req, res) => {
  res.json(await db.all(`SELECT z.*, (SELECT COUNT(*) FROM parkings p WHERE p.zone_id = z.id AND p.status = 'active') AS parkings
                         FROM zones z ORDER BY z.city DESC, z.name`));
});

router.get('/amenities', async (_req, res) => {
  res.json(await db.all('SELECT * FROM amenities ORDER BY id'));
});

router.get('/stats', async (_req, res) => {
  res.json(await db.get(`
    SELECT (SELECT COUNT(*) FROM parkings WHERE status = 'active') AS parkings,
           (SELECT COUNT(*) FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id WHERE p.status = 'active') AS spaces,
           (SELECT ROUND(AVG(rating), 1) FROM reviews) AS satisfaction,
           (SELECT COUNT(*) FROM reservations WHERE status IN ('confirmed', 'completed')) AS reservations`));
});

/**
 * GET /api/parkings — recherche et comparaison
 * ?zone=&city=&q=&start=&end=&maxPrice=&available=1&amenities=1,4&sort=price|rating|distance|places&lat=&lng=&limit=
 */
router.get('/parkings', async (req, res) => {
  await B.refreshStatuses();
  const slot = B.readSlot(req.query);
  if (slot.error) return res.status(400).json({ message: slot.error });

  const params = [slot.start, slot.end];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  const where = [`p.status = 'active'`];
  const q = req.query;
  if (int(q.zone)) where.push(`p.zone_id = ${p(int(q.zone))}`);
  if (q.city) where.push(`z.city = ${p(q.city)}`);
  if (q.q) { const t = p(`%${q.q}%`); where.push(`(p.name ILIKE ${t} OR p.address ILIKE ${t} OR z.name ILIKE ${t} OR z.city ILIKE ${t})`); }
  if (Number(q.maxPrice) > 0) where.push(`p.hourly_rate <= ${p(Number(q.maxPrice))}`);
  const amen = String(q.amenities || '').split(',').map(int).filter(Boolean);
  if (amen.length) where.push(`(SELECT COUNT(*) FROM parking_amenities pa WHERE pa.parking_id = p.id AND pa.amenity_id = ANY(${p(amen)}::int[])) = ${amen.length}`);

  const lat = Number(q.lat), lng = Number(q.lng);
  const hasPos = Number.isFinite(lat) && Number.isFinite(lng) && q.lat !== undefined && q.lng !== undefined;
  const distance = hasPos ? `ROUND(${B.DISTANCE(p(lat), p(lng))}::numeric, 2)` : 'NULL::numeric';

  const order = {
    price: 'hourly_rate, free_spaces DESC',
    rating: 'rating DESC NULLS LAST, reviews DESC',
    places: 'free_spaces DESC, hourly_rate',
    distance: hasPos ? 'distance, hourly_rate' : 'hourly_rate',
  }[q.sort] || 'hourly_rate, free_spaces DESC';

  let sql = `SELECT * FROM (SELECT ${B.PARKING_CARD}, ${distance} AS distance ${B.PARKING_FROM} WHERE ${where.join(' AND ')}) t`;
  if (q.available === '1' || q.available === 'true') sql += ' WHERE free_spaces > 0 AND open_on_slot';
  sql += ` ORDER BY ${order}`;
  if (int(q.limit)) sql += ` LIMIT ${p(Math.min(50, int(q.limit)))}`;

  const { rows } = await db.raw(sql, params);
  res.json({ slot, results: rows });
});

// GET /api/parkings/:id?start=&end= — détail d'un parking
router.get('/parkings/:id', optionalAuth, async (req, res) => {
  const id = int(req.params.id);
  if (!id) return res.status(404).json({ message: 'Parking introuvable' });
  await B.refreshStatuses();
  const slot = B.readSlot(req.query);
  if (slot.error) return res.status(400).json({ message: slot.error });

  const { rows } = await db.raw(
    `SELECT ${B.PARKING_CARD}, p.description, p.manager_id,
       ARRAY(SELECT DISTINCT level FROM parking_spaces s WHERE s.parking_id = p.id) AS levels
     ${B.PARKING_FROM} WHERE p.id = $3`,
    [slot.start, slot.end, id]
  );
  const parking = rows[0];
  // Un parking non publié n'est visible que par son gestionnaire et l'administrateur (RG5)
  const privileged = req.user && (req.user.role === 'admin' || req.user.id === parking?.manager_id);
  if (!parking || (parking.status !== 'active' && !privileged)) return res.status(404).json({ message: 'Parking introuvable' });

  const [photos, amenities, reviews, fav] = await Promise.all([
    db.all('SELECT id, url, position FROM parking_photos WHERE parking_id = ? ORDER BY position, id', [id]),
    db.all('SELECT a.* FROM parking_amenities pa JOIN amenities a ON a.id = pa.amenity_id WHERE pa.parking_id = ? ORDER BY a.id', [id]),
    db.all(
      `SELECT v.id, v.rating, v.comment, v.created_at, u.first_name, LEFT(u.last_name, 1) AS last_initial
       FROM reviews v JOIN reservations r ON r.id = v.reservation_id JOIN parking_spaces s ON s.id = r.space_id
       JOIN users u ON u.id = r.driver_id WHERE s.parking_id = ? ORDER BY v.created_at DESC LIMIT 6`,
      [id]
    ),
    req.user ? db.get('SELECT 1 FROM favorites WHERE user_id = ? AND parking_id = ?', [req.user.id, id]) : null,
  ]);
  parking.levels.sort((a, b) => levelOrder(a) - levelOrder(b));
  res.json({ ...parking, slot, photos, amenities_list: amenities, latest_reviews: reviews, is_favorite: !!fav });
});

// GET /api/parkings/:id/spaces?start=&end= — plan des places et disponibilité sur le créneau
router.get('/parkings/:id/spaces', async (req, res) => {
  const id = int(req.params.id);
  if (!id) return res.status(404).json({ message: 'Parking introuvable' });
  await B.refreshStatuses();
  const slot = B.readSlot(req.query);
  if (slot.error) return res.status(400).json({ message: slot.error });
  const spaces = await db.raw(
    `SELECT s.id, s.code, s.level, s.type, s.state,
       CASE WHEN s.state = 'out_of_service' THEN 'out_of_service'
            WHEN EXISTS (SELECT 1 FROM reservations r WHERE r.space_id = s.id AND r.status IN ${B.ACTIVE}
                         AND tstzrange(r.start_at, r.end_at) && tstzrange($1::timestamptz, $2::timestamptz)) THEN 'reserved'
            ELSE 'free' END AS availability
     FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id
     WHERE s.parking_id = $3 AND p.status = 'active' ORDER BY s.id`,
    [slot.start, slot.end, id]
  );
  res.json(spaces.rows);
});

/** Ordre d'affichage des niveaux (comme les maquettes) : -1, -2, -3, RDC, 1, 2… */
function levelOrder(l) {
  if (l === 'RDC') return 10;
  const n = Number(l);
  if (!Number.isFinite(n)) return 99;
  return n < 0 ? -n : 10 + n;
}

module.exports = { router, levelOrder };
