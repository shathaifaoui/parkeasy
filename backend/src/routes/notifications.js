// Notifications (cloche de la barre supérieure), adaptées à chaque profil
const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const B = require('../business');

router.get('/notifications', requireAuth, async (req, res) => {
  await B.refreshStatuses();
  const { id, role } = req.user;
  let items = [];
  if (role === 'driver') {
    const rows = await db.all(
      `${B.RESERVATION_SELECT} WHERE r.driver_id = ? AND (
          (r.status IN ('pending', 'confirmed') AND r.start_at > NOW() AND r.start_at < NOW() + INTERVAL '3 days')
          OR (r.status = 'completed' AND rv.id IS NULL AND r.end_at > NOW() - INTERVAL '14 days')
          OR (r.status = 'cancelled' AND r.cancelled_at > NOW() - INTERVAL '3 days'))
       ORDER BY r.start_at DESC LIMIT 8`, [id]);
    items = rows.map((r) => ({
      type: r.status,
      text: {
        pending: `${r.reference} en attente de confirmation — ${r.parking}`,
        confirmed: `${r.reference} confirmée — ${r.parking}, place ${r.space_code}`,
        completed: `Donnez votre avis sur ${r.parking} (${r.reference})`,
        cancelled: `${r.reference} annulée — ${r.parking}`,
      }[r.status],
      link: '/mes-reservations',
      date: r.start_at,
    }));
  } else if (role === 'manager') {
    const rows = await db.all(`${B.RESERVATION_SELECT} WHERE p.manager_id = ? AND r.status = 'pending' ORDER BY r.start_at LIMIT 8`, [id]);
    items = rows.map((r) => ({ type: 'pending', text: `${r.reference} à confirmer — ${r.parking}, ${r.space_code}`, link: '/gestion/reservations', date: r.start_at }));
  } else {
    const rows = await db.all(`SELECT id, name, created_at FROM parkings WHERE status = 'pending' ORDER BY created_at DESC LIMIT 8`);
    items = rows.map((p) => ({ type: 'pending', text: `Nouveau parking à valider : ${p.name}`, link: '/admin', date: p.created_at }));
    const msgs = await db.all(`SELECT name, created_at FROM contact_messages WHERE status = 'new' ORDER BY created_at DESC LIMIT 5`);
    items.push(...msgs.map((m) => ({ type: 'pending', text: `Nouveau message de ${m.name}`, link: '/admin/messages', date: m.created_at })));
  }
  res.json({ count: items.filter((i) => i.type === 'pending' || i.type === 'completed').length, items });
});

module.exports = router;
