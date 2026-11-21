const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

/** Dossier produit par « npm run build » (frontend Angular compilé) */
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser');

/**
 * @param {{ serveFrontend?: boolean }} options serveFrontend : sert aussi le site compilé (mode production, un seul port)
 */
function createApp({ serveFrontend = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(compression()); // gzip des réponses JSON et des fichiers statiques
  app.use((_req, res, next) => {
    // En-têtes de sécurité de base
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'ParkEasy API' }));
  app.use('/api/auth', require('./routes/auth').router);
  app.use('/api', require('./routes/parkings').router);
  app.use('/api', require('./routes/driver'));
  app.use('/api', require('./routes/notifications'));
  app.use('/api', require('./routes/contact'));
  app.use('/api/manager', require('./routes/manager'));
  app.use('/api/admin', require('./routes/admin'));

  app.use('/api', (_req, res) => res.status(404).json({ message: 'Route API introuvable' }));

  // Mode production : fichiers du frontend (noms avec empreinte → cache d'un an ; index.html jamais mis en cache)
  if (serveFrontend && fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, file) => {
        if (!/-[A-Z0-9]{8}\.(js|css)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    }));
    // Toute autre URL renvoie l'application Angular (routage côté client)
    app.get('/{*splat}', (_req, res) => res.setHeader('Cache-Control', 'no-cache').sendFile(path.join(FRONTEND_DIST, 'index.html')));
  }

  // Gestion centralisée des erreurs (dont les erreurs PostgreSQL)
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON invalide' });
    if (err.code === '23P01') return res.status(409).json({ message: 'Cette place est déjà réservée sur ce créneau' });
    if (err.code === '23505') return res.status(409).json({ message: 'Cet élément existe déjà' });
    if (['22P02', '23514', '23502', '22007', '22008', '23503'].includes(err.code)) return res.status(400).json({ message: 'Données invalides' });
    if (err.status && err.status < 500) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  });
  return app;
}

module.exports = { createApp, FRONTEND_DIST };
