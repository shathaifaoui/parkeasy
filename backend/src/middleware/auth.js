const jwt = require('jsonwebtoken');
const { db } = require('../db');

const SECRET = process.env.JWT_SECRET || 'parkeasy-dev-secret-a-changer-en-production';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
}

/** Ajoute req.user si un jeton valide est présent (sans bloquer sinon) */
async function optionalAuth(req, _res, next) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) {
    try {
      const { id } = jwt.verify(h.slice(7), SECRET);
      // Rôle et statut relus en base : un compte suspendu perd l'accès immédiatement
      const u = await db.get('SELECT id, role, status FROM users WHERE id = ?', [id]);
      if (u && u.status === 'active') req.user = u;
    } catch {
      /* jeton invalide : on ignore */
    }
  }
  next();
}

/** Exige une connexion, et éventuellement un ou plusieurs rôles */
const requireRole = (...roles) => (req, res, next) =>
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ message: 'Authentification requise' });
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ message: 'Accès non autorisé pour votre profil' });
    next();
  });

module.exports = { signToken, optionalAuth, requireAuth: requireRole(), requireRole };
