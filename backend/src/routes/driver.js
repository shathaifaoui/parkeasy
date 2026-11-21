// Espace automobiliste : véhicules (RG2), réservations (RG9 à RG12), avis (RG14), favoris (RG13)
const router = require('express').Router();
const { db } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../validate');
const B = require('../business');

const driver = requireRole('driver');
const PLATE_RE = /^[0-9]{1,3}\s?(TU|TUN|تونس|RS|NT)\s?[0-9]{1,4}$/i;

// ---------- Véhicules ----------
router.get('/vehicles', driver, async (req, res) => {
  res.json(await db.all(
    `SELECT v.*, (SELECT COUNT(*) FROM reservations r WHERE r.vehicle_id = v.id) AS reservations
     FROM vehicles v WHERE owner_id = ? ORDER BY id`, [req.user.id]));
});

router.post(
  '/vehicles',
  driver,
  validate({
    plate: { label: "L'immatriculation", required: true, maxLength: 15 },
    brand: { label: 'La marque', maxLength: 40 },
    model: { label: 'Le modèle', maxLength: 40 },
  }),
  async (req, res) => {
    const plate = req.body.plate.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!PLATE_RE.test(plate)) return res.status(400).json({ message: 'Immatriculation invalide (format attendu : 215 TU 4587)' });
    if (await db.get('SELECT id FROM vehicles WHERE plate = ?', [plate]))
      return res.status(409).json({ message: 'Cette immatriculation est déjà enregistrée' });
    const id = await db.insert('INSERT INTO vehicles (owner_id, plate, brand, model) VALUES (?,?,?,?)',
      [req.user.id, plate, req.body.brand?.trim() || null, req.body.model?.trim() || null]);
    res.status(201).json(await db.get('SELECT * FROM vehicles WHERE id = ?', [id]));
  }
);

router.delete('/vehicles/:id', driver, async (req, res) => {
  const v = await db.get('SELECT id FROM vehicles WHERE id = ? AND owner_id = ?', [Number(req.params.id) || 0, req.user.id]);
  if (!v) return res.status(404).json({ message: 'Véhicule introuvable' });
  if (await db.get('SELECT 1 FROM reservations WHERE vehicle_id = ? LIMIT 1', [v.id]))
    return res.status(409).json({ message: 'Ce véhicule est lié à des réservations et ne peut pas être supprimé' });
  await db.run('DELETE FROM vehicles WHERE id = ?', [v.id]);
  res.json({ message: 'Véhicule supprimé' });
});

// ---------- Réservations ----------
// POST /api/reservations — { space_id, vehicle_id, start, end }
router.post(
  '/reservations',
  driver,
  validate({
    space_id: { label: 'La place', required: true, int: true },
    vehicle_id: { label: 'Le véhicule', required: true, int: true },
    start: { label: "L'arrivée", required: true, date: true },
    end: { label: 'Le départ', required: true, date: true },
  }),
  async (req, res) => {
    await B.refreshStatuses(true);
    const slot = B.readSlot(req.body, { required: true });
    if (slot.error) return res.status(400).json({ message: slot.error });
    if (new Date(slot.start) < Date.now() - 5 * 60e3) return res.status(400).json({ message: "L'heure d'arrivée est déjà passée" });

    const vehicle = await db.get('SELECT id FROM vehicles WHERE id = ? AND owner_id = ?', [Number(req.body.vehicle_id), req.user.id]);
    if (!vehicle) return res.status(400).json({ message: 'Choisissez un de vos véhicules' });

    const { rows } = await db.raw(
      `SELECT s.id, s.state, p.status, p.name, ${B.OPEN_ON_SLOT('$2', '$3')} AS open_on_slot
       FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id WHERE s.id = $1`,
      [Number(req.body.space_id), slot.start, slot.end]
    );
    const space = rows[0];
    if (!space || space.status !== 'active') return res.status(404).json({ message: 'Place introuvable' });
    if (space.state !== 'in_service') return res.status(409).json({ message: 'Cette place est hors service' });
    if (!space.open_on_slot) return res.status(400).json({ message: "Le parking est fermé sur une partie de ce créneau (voir ses horaires d'ouverture)" });

    try {
      // RG11 : montant calculé en SQL et figé ; RG10 : la contrainte d'exclusion protège la place
      const { rows: created } = await db.raw(
        `INSERT INTO reservations (driver_id, space_id, vehicle_id, start_at, end_at, amount)
         SELECT $1, s.id, $3, $4, $5, ${B.AMOUNT('$4', '$5')}
         FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id WHERE s.id = $2
         RETURNING id, reference, amount, status`,
        [req.user.id, space.id, vehicle.id, slot.start, slot.end]
      );
      const r = await db.get(`${B.RESERVATION_SELECT} WHERE r.id = ?`, [created[0].id]);
      res.status(201).json(r);
    } catch (e) {
      if (e.code === '23P01')
        return res.status(409).json({ message: 'Cette place vient d’être réservée sur ce créneau. Choisissez une autre place.' });
      throw e;
    }
  }
);

// GET /api/reservations/me?tab=upcoming|past|cancelled
router.get('/reservations/me', driver, async (req, res) => {
  await B.refreshStatuses();
  const tab = req.query.tab || 'upcoming';
  const where = {
    upcoming: `r.status IN ('pending', 'confirmed')`,
    past: `r.status = 'completed'`,
    cancelled: `r.status = 'cancelled'`,
  }[tab] || `TRUE`;
  const order = tab === 'upcoming' ? 'r.start_at ASC' : 'r.start_at DESC';
  const [list, counts] = await Promise.all([
    db.all(`${B.RESERVATION_SELECT} WHERE r.driver_id = ? AND ${where} ORDER BY ${order}`, [req.user.id]),
    db.get(`SELECT COUNT(*) FILTER (WHERE status IN ('pending','confirmed')) AS upcoming,
                   COUNT(*) FILTER (WHERE status = 'completed') AS past,
                   COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
            FROM reservations WHERE driver_id = ?`, [req.user.id]),
  ]);
  res.json({ counts, results: list });
});

router.get('/reservations/:id', requireRole('driver', 'manager', 'admin'), async (req, res) => {
  const r = await db.get(`${B.RESERVATION_SELECT} WHERE r.id = ?`, [Number(req.params.id) || 0]);
  const allowed = r && (req.user.role === 'admin' || r.driver_id === req.user.id || r.manager_id === req.user.id);
  if (!allowed) return res.status(404).json({ message: 'Réservation introuvable' });
  res.json(r);
});

// POST /api/reservations/:id/cancel — annulation possible avant le début (RG12)
router.post('/reservations/:id/cancel', driver, async (req, res) => {
  const n = await db.run(
    `UPDATE reservations SET status = 'cancelled', cancelled_at = NOW()
     WHERE id = ? AND driver_id = ? AND status IN ('pending', 'confirmed') AND start_at > NOW()`,
    [Number(req.params.id) || 0, req.user.id]
  );
  if (!n) return res.status(400).json({ message: 'Cette réservation ne peut plus être annulée (créneau commencé ou déjà traitée)' });
  res.json({ message: 'Réservation annulée : la place est de nouveau disponible.' });
});

// POST /api/reservations/:id/review — un avis par réservation terminée (RG14)
router.post(
  '/reservations/:id/review',
  driver,
  validate({
    rating: { label: 'La note', required: true, int: true, min: 1, max: 5 },
    comment: { label: 'Le commentaire', maxLength: 500 },
  }),
  async (req, res) => {
    const r = await db.get('SELECT id, status FROM reservations WHERE id = ? AND driver_id = ?', [Number(req.params.id) || 0, req.user.id]);
    if (!r) return res.status(404).json({ message: 'Réservation introuvable' });
    if (r.status !== 'completed') return res.status(400).json({ message: 'Un avis ne peut porter que sur une réservation terminée' });
    if (await db.get('SELECT 1 FROM reviews WHERE reservation_id = ?', [r.id]))
      return res.status(409).json({ message: 'Vous avez déjà donné votre avis sur cette réservation' });
    await db.run('INSERT INTO reviews (reservation_id, rating, comment) VALUES (?,?,?)', [r.id, Number(req.body.rating), req.body.comment?.trim() || null]);
    res.status(201).json({ message: 'Merci pour votre avis !' });
  }
);

// ---------- Favoris ----------
router.get('/favorites', driver, async (req, res) => {
  const slot = B.defaultSlot();
  const { rows } = await db.raw(
    `SELECT ${B.PARKING_CARD}, f.added_at ${B.PARKING_FROM}
     JOIN favorites f ON f.parking_id = p.id AND f.user_id = $3
     ORDER BY f.added_at DESC`,
    [slot.start, slot.end, req.user.id]
  );
  res.json(rows);
});

router.post('/favorites/:parkingId', driver, async (req, res) => {
  const id = Number(req.params.parkingId) || 0;
  if (!(await db.get(`SELECT id FROM parkings WHERE id = ? AND status = 'active'`, [id]))) return res.status(404).json({ message: 'Parking introuvable' });
  await db.run('INSERT INTO favorites (user_id, parking_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [req.user.id, id]);
  res.status(201).json({ is_favorite: true });
});

router.delete('/favorites/:parkingId', driver, async (req, res) => {
  await db.run('DELETE FROM favorites WHERE user_id = ? AND parking_id = ?', [req.user.id, Number(req.params.parkingId) || 0]);
  res.json({ is_favorite: false });
});

module.exports = router;
