// Chargement de la configuration (backend/.env) — fonctionnalité native de Node.js ≥ 20.12
try {
  process.loadEnvFile(require('path').join(__dirname, '..', '.env'));
} catch {
  /* pas de fichier .env : valeurs par défaut (postgres / postgres sur localhost:5432) */
}

const { initDb, config } = require('./db');
const fs = require('fs');
const { createApp, FRONTEND_DIST } = require('./app');

const PORT = process.env.PORT || 3000;
const reset = process.argv.includes('--reset');
// --prod : l'API sert aussi le frontend compilé (npm run build) → site complet sur http://localhost:3000
const prod = process.argv.includes('--prod');

initDb({ reset })
  .then(() => {
    createApp({ serveFrontend: prod }).listen(PORT, () => {
      console.log(`\n  🅿️  ParkEasy API démarrée sur http://localhost:${PORT}/api`);
      if (prod) {
        console.log(fs.existsSync(FRONTEND_DIST)
          ? `     Site (version de production) : http://localhost:${PORT}`
          : '     Frontend non compilé : lancez d\'abord « npm run build »');
      }
      console.log(`     PostgreSQL : ${config.user}@${config.host}:${config.port}/${config.database}\n`);
    });
  })
  .catch(() => process.exit(1));
