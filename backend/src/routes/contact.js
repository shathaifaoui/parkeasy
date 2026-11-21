// Page « Aide & contact » : envoi d'un message à l'équipe ParkEasy (Objectif 04)
const router = require('express').Router();
const { db } = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../validate');

// Limite simple anti-abus : 5 messages par adresse IP et par tranche de 10 minutes
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const list = (hits.get(req.ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= 5) return res.status(429).json({ message: 'Trop de messages envoyés. Réessayez dans quelques minutes.' });
  list.push(now);
  hits.set(req.ip, list);
  next();
}

// POST /api/contact — { name, email, topic, message }
router.post(
  '/contact',
  rateLimit,
  optionalAuth,
  validate({
    name: { label: 'Le nom', required: true, maxLength: 120 },
    email: { label: "L'e-mail", required: true, email: true, maxLength: 160 },
    topic: { label: 'Le sujet', required: true, in: ['reservation', 'parking', 'account', 'other'] },
    message: { label: 'Le message', required: true, minLength: 10, maxLength: 2000 },
  }),
  async (req, res) => {
    const { name, email, topic, message } = req.body;
    const id = await db.insert(
      'INSERT INTO contact_messages (user_id, name, email, topic, message) VALUES (?, ?, ?, ?, ?)',
      [req.user?.id ?? null, name.trim(), email.trim().toLowerCase(), topic, message.trim()]
    );
    res.status(201).json({ id, message: 'Message envoyé' });
  }
);

module.exports = router;
