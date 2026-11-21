-- =====================================================================
--  ParkEasy — Schéma PostgreSQL (conforme au MLD de l'Objectif 02)
--  11 tables : users, vehicles, zones, parkings, parking_spaces,
--  reservations, amenities, parking_amenities, parking_photos,
--  favorites, reviews
--  Exécuté automatiquement au premier démarrage de l'API.
-- =====================================================================

-- Nécessaire pour la contrainte d'exclusion (égalité sur un entier + chevauchement d'intervalles)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- RG1 : un rôle unique, compte actif ou suspendu
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(60)  NOT NULL,
  last_name     VARCHAR(60)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,                       -- bcrypt
  phone         VARCHAR(20),
  role          VARCHAR(10)  NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'manager', 'admin')),
  status        VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- RG2 : un automobiliste enregistre un ou plusieurs véhicules (immatriculation unique)
CREATE TABLE vehicles (
  id        SERIAL PRIMARY KEY,
  owner_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plate     VARCHAR(15) NOT NULL UNIQUE,
  brand     VARCHAR(40),
  model     VARCHAR(40)
);

CREATE TABLE zones (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(80) NOT NULL,
  city  VARCHAR(60) NOT NULL,
  UNIQUE (name, city)
);

-- RG3, RG4, RG5 : un gestionnaire, une zone, un tarif, des horaires ; en attente avant validation
CREATE TABLE parkings (
  id            SERIAL PRIMARY KEY,
  manager_id    INTEGER      NOT NULL REFERENCES users(id),
  zone_id       INTEGER      NOT NULL REFERENCES zones(id),
  name          VARCHAR(120) NOT NULL,
  address       VARCHAR(200) NOT NULL,
  latitude      NUMERIC(9,6),
  longitude     NUMERIC(9,6),
  description   TEXT,
  hourly_rate   NUMERIC(6,2) NOT NULL CHECK (hourly_rate >= 0),     -- TND / heure
  open_24h      BOOLEAN      NOT NULL DEFAULT FALSE,
  opening_time  TIME,
  closing_time  TIME,
  status        VARCHAR(10)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- horaires obligatoires si le parking n'est pas ouvert 24h/24
  CHECK (open_24h OR (opening_time IS NOT NULL AND closing_time IS NOT NULL AND closing_time > opening_time))
);

-- RG6, RG7 : places (code unique dans le parking), type, mise hors service
CREATE TABLE parking_spaces (
  id          SERIAL PRIMARY KEY,
  parking_id  INTEGER     NOT NULL REFERENCES parkings(id) ON DELETE CASCADE,
  code        VARCHAR(10) NOT NULL,
  level       VARCHAR(10) NOT NULL DEFAULT 'RDC',
  type        VARCHAR(10) NOT NULL DEFAULT 'standard' CHECK (type IN ('standard', 'pmr', 'electric', 'moto')),
  state       VARCHAR(15) NOT NULL DEFAULT 'in_service' CHECK (state IN ('in_service', 'out_of_service')),
  UNIQUE (parking_id, code)
);

-- RG9 à RG12 : réservation d'une place, pour un véhicule, sur un créneau [début, fin[
CREATE TABLE reservations (
  id            SERIAL PRIMARY KEY,
  reference     VARCHAR(12) GENERATED ALWAYS AS ('RES-' || (id + 1000)) STORED UNIQUE,
  driver_id     INTEGER      NOT NULL REFERENCES users(id),
  space_id      INTEGER      NOT NULL REFERENCES parking_spaces(id),
  vehicle_id    INTEGER      NOT NULL REFERENCES vehicles(id),
  start_at      TIMESTAMPTZ  NOT NULL,
  end_at        TIMESTAMPTZ  NOT NULL,
  amount        NUMERIC(8,2) NOT NULL CHECK (amount >= 0),           -- RG11 : figé à la réservation
  status        VARCHAR(10)  NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  cancelled_at  TIMESTAMPTZ,
  CHECK (end_at > start_at),
  -- RG10 : aucune place réservée deux fois sur un même créneau (garanti par PostgreSQL)
  CONSTRAINT no_overlapping_reservation EXCLUDE USING gist (
    space_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status IN ('pending', 'confirmed'))
);

-- RG8 : équipements et photos
CREATE TABLE amenities (
  id     SERIAL PRIMARY KEY,
  label  VARCHAR(40) NOT NULL UNIQUE,
  icon   VARCHAR(30)
);

CREATE TABLE parking_amenities (
  parking_id  INTEGER NOT NULL REFERENCES parkings(id) ON DELETE CASCADE,
  amenity_id  INTEGER NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (parking_id, amenity_id)
);

CREATE TABLE parking_photos (
  id          SERIAL PRIMARY KEY,
  parking_id  INTEGER      NOT NULL REFERENCES parkings(id) ON DELETE CASCADE,
  url         VARCHAR(255) NOT NULL,
  position    SMALLINT     NOT NULL DEFAULT 0
);

-- RG13 : favoris
CREATE TABLE favorites (
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parking_id  INTEGER     NOT NULL REFERENCES parkings(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, parking_id)
);

-- RG14 : un avis (1 à 5) par réservation terminée
CREATE TABLE reviews (
  id              SERIAL PRIMARY KEY,
  reservation_id  INTEGER      NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  rating          SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         VARCHAR(500),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parkings_zone_status ON parkings(zone_id, status);
CREATE INDEX idx_spaces_parking       ON parking_spaces(parking_id);
CREATE INDEX idx_reservations_driver  ON reservations(driver_id);
CREATE INDEX idx_reservations_space   ON reservations(space_id, start_at);
