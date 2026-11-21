// Supervision de la plateforme (administrateur)
const router = require('express').Router();
const { db } = require('../db');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../validate');

router.use(requireRole('admin'));

// GET /api/admin/stats — indicateurs globaux
router.get('/stats', async (_req, res) => {
  res.json(await db.get(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'driver')                     AS drivers,
      (SELECT COUNT(*) FROM users WHERE role = 'manager')                    AS managers,
      (SELECT COUNT(*) FROM users WHERE status = 'suspended')                AS suspended,
      (SELECT COUNT(*) FROM parkings WHERE status = 'active')                AS parkings_active,
      (SELECT COUNT(*) FROM parkings WHERE status = 'pending')               AS parkings_pending,
      (SELECT COUNT(*) FROM parking_spaces)                                  AS spaces,
      (SELECT COUNT(*) FROM reservations WHERE created_at >= NOW() - INTERVAL '30 days') AS reservations_30d,
      (SELECT COALESCE(SUM(amount), 0) FROM reservations
        WHERE status IN ('confirmed', 'completed') AND start_at >= NOW() - INTERVAL '30 days') AS revenue_30d,
      (SELECT ROUND(AVG(rating), 1) FROM reviews)                            AS rating,
      (SELECT COUNT(*) FROM contact_messages WHERE status = 'new')           AS messages_new`));
});

// GET /api/admin/parkings?status=pending|active|suspended
router.get('/parkings', async (req, res) => {
  const status = ['pending', 'active', 'suspended'].includes(req.query.status) ? req.query.status : 'pending';
  res.json(await db.all(
    `SELECT p.id, p.name, p.address, p.hourly_rate, p.open_24h, to_char(p.opening_time, 'HH24:MI') AS opening_time,
            to_char(p.closing_time, 'HH24:MI') AS closing_time, p.status, p.created_at, p.description,
            z.name AS zone, z.city, u.first_name || ' ' || u.last_name AS manager, u.email AS manager_email,
            (SELECT COUNT(*) FROM parking_spaces s WHERE s.parking_id = p.id) AS spaces,
            ARRAY(SELECT a.label FROM parking_amenities pa JOIN amenities a ON a.id = pa.amenity_id WHERE pa.parking_id = p.id) AS amenities,
            (SELECT url FROM parking_photos ph WHERE ph.parking_id = p.id ORDER BY position LIMIT 1) AS photo
     FROM parkings p JOIN zones z ON z.id = p.zone_id JOIN users u ON u.id = p.manager_id
     WHERE p.status = ? ORDER BY p.created_at DESC`, [status]));
});

// PATCH /api/admin/parkings/:id — { status: active | suspended } (validation RG5)
router.patch('/parkings/:id', validate({ status: { label: 'Le statut', required: true, in: ['active', 'suspended'] } }), async (req, res) => {
  const n = await db.run('UPDATE parkings SET status = ? WHERE id = ?', [req.body.status, Number(req.params.id) || 0]);
  if (!n) return res.status(404).json({ message: 'Parking introuvable' });
  res.json({ message: req.body.status === 'active' ? 'Parking validé et publié' : 'Parking suspendu : il n\'est plus visible' });
});

// GET /api/admin/users?q=&role=&status=
router.get('/users', async (req, res) => {
  const where = ['TRUE'];
  const params = [];
  if (['driver', 'manager', 'admin'].includes(req.query.role)) { where.push('u.role = ?'); params.push(req.query.role); }
  if (['active', 'suspended'].includes(req.query.status)) { where.push('u.status = ?'); params.push(req.query.status); }
  if (req.query.q) { where.push(`(u.first_name || ' ' || u.last_name ILIKE ? OR u.email ILIKE ?)`); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  res.json(await db.all(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.status, u.created_at,
       (SELECT COUNT(*) FROM reservations r WHERE r.driver_id = u.id) AS reservations,
       (SELECT COUNT(*) FROM parkings p WHERE p.manager_id = u.id) AS parkings
     FROM users u WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT 100`, params));
});

// PATCH /api/admin/users/:id — { status: active | suspended }
router.patch('/users/:id', validate({ status: { label: 'Le statut', required: true, in: ['active', 'suspended'] } }), async (req, res) => {
  const u = await db.get('SELECT id, role FROM users WHERE id = ?', [Number(req.params.id) || 0]);
  if (!u) return res.status(404).json({ message: 'Utilisateur introuvable' });
  if (u.role === 'admin') return res.status(400).json({ message: 'Un compte administrateur ne peut pas être suspendu' });
  await db.run('UPDATE users SET status = ? WHERE id = ?', [req.body.status, u.id]);
  res.json({ message: req.body.status === 'suspended' ? 'Compte suspendu' : 'Compte réactivé' });
});

// GET /api/admin/messages?status=new|done|all — messages reçus via la page « Aide & contact »
router.get('/messages', async (req, res) => {
  const status = ['new', 'done'].includes(req.query.status) ? req.query.status : null;
  res.json(await db.all(
    `SELECT m.id, m.name, m.email, m.topic, m.message, m.status, m.created_at, m.handled_at, u.role AS author_role
     FROM contact_messages m LEFT JOIN users u ON u.id = m.user_id
     WHERE (?::text IS NULL OR m.status = ?) ORDER BY m.status = 'done', m.created_at DESC LIMIT 200`, [status, status]));
});

// PATCH /api/admin/messages/:id — { status: new | done }
router.patch('/messages/:id', validate({ status: { label: 'Le statut', required: true, in: ['new', 'done'] } }), async (req, res) => {
  const n = await db.run(
    `UPDATE contact_messages SET status = ?, handled_at = CASE WHEN ? = 'done' THEN NOW() ELSE NULL END WHERE id = ?`,
    [req.body.status, req.body.status, req.params.id]);
  if (!n) return res.status(404).json({ message: 'Message introuvable' });
  res.json({ id: Number(req.params.id), status: req.body.status });
});

module.exports = router;
