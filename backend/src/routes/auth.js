const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { validate } = require('../validate');

const findUser = (id) =>
  db.get('SELECT id, first_name, last_name, email, phone, role, status, created_at FROM users WHERE id = ?', [id]);

// POST /api/auth/register — automobiliste ou gestionnaire (l'administrateur n'est pas ouvert à l'inscription)
router.post(
  '/register',
  validate({
    first_name: { label: 'Le prénom', required: true, maxLength: 60 },
    last_name: { label: 'Le nom', required: true, maxLength: 60 },
    email: { label: "L'e-mail", required: true, email: true },
    password: { label: 'Le mot de passe', required: true, minLength: 8 },
    phone: { label: 'Le téléphone', tel: true },
    role: { label: 'Le profil', required: true, in: ['driver', 'manager'] },
  }),
  async (req, res) => {
    const b = req.body;
    const email = b.email.trim().toLowerCase();
    if (await db.get('SELECT id FROM users WHERE email = ?', [email]))
      return res.status(409).json({ message: 'Un compte existe déjà avec cet e-mail' });
    const id = await db.insert(
      'INSERT INTO users (first_name, last_name, email, password_hash, phone, role) VALUES (?,?,?,?,?,?)',
      [b.first_name.trim(), b.last_name.trim(), email, bcrypt.hashSync(b.password, 10), b.phone?.trim() || null, b.role]
    );
    const user = await findUser(id);
    res.status(201).json({ token: signToken(user), user });
  }
);

// POST /api/auth/login
router.post(
  '/login',
  validate({ email: { label: "L'e-mail", required: true }, password: { label: 'Le mot de passe', required: true } }),
  async (req, res) => {
    const row = await db.get('SELECT id, password_hash, status FROM users WHERE email = ?', [req.body.email.trim().toLowerCase()]);
    if (!row || !bcrypt.compareSync(req.body.password, row.password_hash))
      return res.status(401).json({ message: 'E-mail ou mot de passe incorrect' });
    if (row.status === 'suspended')
      return res.status(403).json({ message: "Ce compte est suspendu. Contactez l'administrateur de la plateforme." });
    const user = await findUser(row.id);
    res.json({ token: signToken(user), user });
  }
);

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  res.json(await findUser(req.user.id));
});

// PUT /api/auth/me — informations personnelles
router.put(
  '/me',
  requireAuth,
  validate({
    first_name: { label: 'Le prénom', required: true, maxLength: 60 },
    last_name: { label: 'Le nom', required: true, maxLength: 60 },
    phone: { label: 'Le téléphone', tel: true },
  }),
  async (req, res) => {
    const b = req.body;
    await db.run('UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?', [b.first_name.trim(), b.last_name.trim(), b.phone?.trim() || null, req.user.id]);
    res.json(await findUser(req.user.id));
  }
);

// PUT /api/auth/password
router.put(
  '/password',
  requireAuth,
  validate({
    current: { label: 'Le mot de passe actuel', required: true },
    password: { label: 'Le nouveau mot de passe', required: true, minLength: 8 },
  }),
  async (req, res) => {
    const row = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(req.body.current, row.password_hash))
      return res.status(400).json({ message: 'Le mot de passe actuel est incorrect' });
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(req.body.password, 10), req.user.id]);
    res.json({ message: 'Mot de passe modifié' });
  }
);

module.exports = { router, findUser };
