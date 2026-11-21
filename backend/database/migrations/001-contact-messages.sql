-- =====================================================================
--  Migration 001 (Objectif 04) : messages envoyés depuis la page « Aide & contact »
--  Idempotente : exécutée à chaque démarrage de l'API, sans effet si déjà appliquée.
-- =====================================================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,   -- renseigné si l'auteur est connecté
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL,
  topic       VARCHAR(20)  NOT NULL CHECK (topic IN ('reservation', 'parking', 'account', 'other')),
  message     VARCHAR(2000) NOT NULL,
  status      VARCHAR(10)  NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  handled_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status, created_at DESC);

-- Deux messages de démonstration (uniquement si la table est vide)
INSERT INTO contact_messages (name, email, topic, message, created_at)
SELECT * FROM (VALUES
  ('Amel Ben Ali', 'amel.benali@mail.tn', 'reservation',
   'Bonjour, ma réservation est toujours « en attente » alors que j''arrive dans une heure. Le gestionnaire est-il prévenu ?', NOW() - INTERVAL '3 hours'),
  ('Hichem Trabelsi', 'hichem.t@mail.tn', 'parking',
   'Je gère un parking de 40 places à La Marsa. Quels documents faut-il pour que mon parking soit validé ?', NOW() - INTERVAL '1 day')
) AS demo(name, email, topic, message, created_at)
WHERE NOT EXISTS (SELECT 1 FROM contact_messages);
