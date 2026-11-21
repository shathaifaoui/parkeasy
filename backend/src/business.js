// Logique métier partagée : créneaux, recherche, disponibilités, cycle de vie (RG9 à RG12)
const { db } = require('./db');

/** Statuts qui bloquent une place (RG10) */
const ACTIVE = `('pending', 'confirmed')`;

/** Créneau par défaut : prochaine heure pleine, pour 2 heures */
function defaultSlot() {
  const s = new Date();
  s.setMinutes(0, 0, 0);
  s.setHours(s.getHours() + 1);
  return { start: s.toISOString(), end: new Date(s.getTime() + 2 * 3600e3).toISOString() };
}

/** Lit et valide un créneau [start, end[ ; renvoie { start, end } ou { error } */
function readSlot(src, { required = false } = {}) {
  if (!src.start && !src.end) return required ? { error: 'Le créneau (début et fin) est obligatoire' } : defaultSlot();
  const s = new Date(src.start);
  const e = new Date(src.end);
  if (isNaN(s) || isNaN(e)) return { error: 'Créneau invalide' };
  if (e <= s) return { error: "L'heure de départ doit être après l'heure d'arrivée" };
  if (e - s > 72 * 3600e3) return { error: 'Une réservation ne peut pas dépasser 72 heures' };
  return { start: s.toISOString(), end: e.toISOString() };
}

/** Condition SQL : le parking p est ouvert sur tout le créneau ($s, $e) — heures évaluées à Tunis */
const OPEN_ON_SLOT = (s, e) => `(p.open_24h OR (
    ${s}::timestamptz::date = (${e}::timestamptz - INTERVAL '1 second')::date
    AND ${s}::timestamptz::time >= p.opening_time
    AND (${e}::timestamptz::time <= p.closing_time OR ${e}::timestamptz::time = '00:00' AND p.closing_time = '23:59')))`;

/** Sous-requête : places en service et libres sur le créneau ($s, $e) */
const FREE_SPACES = (s, e) => `(SELECT COUNT(*) FROM parking_spaces s
    WHERE s.parking_id = p.id AND s.state = 'in_service'
      AND NOT EXISTS (SELECT 1 FROM reservations r
                      WHERE r.space_id = s.id AND r.status IN ${ACTIVE}
                        AND tstzrange(r.start_at, r.end_at) && tstzrange(${s}::timestamptz, ${e}::timestamptz)))`;

/** Montant RG11 : tarif horaire × heures entamées */
const AMOUNT = (s, e) => `(CEIL(EXTRACT(EPOCH FROM (${e}::timestamptz - ${s}::timestamptz)) / 3600) * p.hourly_rate)`;

/** Colonnes d'une carte « parking » (liste, favoris, accueil) pour un créneau $1/$2 */
const PARKING_CARD = `
  p.id, p.name, p.address, p.latitude, p.longitude, p.hourly_rate, p.open_24h,
  to_char(p.opening_time, 'HH24:MI') AS opening_time, to_char(p.closing_time, 'HH24:MI') AS closing_time,
  p.status, z.id AS zone_id, z.name AS zone, z.city,
  (SELECT COUNT(*) FROM parking_spaces s WHERE s.parking_id = p.id) AS total_spaces,
  ${FREE_SPACES('$1', '$2')} AS free_spaces,
  ${AMOUNT('$1', '$2')} AS estimated_total,
  ${OPEN_ON_SLOT('$1', '$2')} AS open_on_slot,
  rv.rating, COALESCE(rv.reviews, 0) AS reviews,
  (SELECT url FROM parking_photos ph WHERE ph.parking_id = p.id ORDER BY position, id LIMIT 1) AS photo,
  ARRAY(SELECT a.label FROM parking_amenities pa JOIN amenities a ON a.id = pa.amenity_id
        WHERE pa.parking_id = p.id ORDER BY a.id) AS amenities`;

const PARKING_FROM = `
  FROM parkings p
  JOIN zones z ON z.id = p.zone_id
  LEFT JOIN (SELECT s.parking_id, ROUND(AVG(v.rating), 1) AS rating, COUNT(*) AS reviews
             FROM reviews v JOIN reservations r ON r.id = v.reservation_id
             JOIN parking_spaces s ON s.id = r.space_id GROUP BY s.parking_id) rv ON rv.parking_id = p.id`;

/** Distance en km (formule de Haversine) entre le parking et ($lat, $lng) */
const DISTANCE = (lat, lng) => `(6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(p.latitude - ${lat}) / 2), 2) +
    COS(RADIANS(${lat})) * COS(RADIANS(p.latitude)) * POWER(SIN(RADIANS(p.longitude - ${lng}) / 2), 2))))`;

/**
 * RG12 — fait avancer le cycle de vie automatiquement :
 *  - confirmée dont le créneau est passé  -> terminée
 *  - en attente non confirmée avant le début -> annulée (expirée)
 * Exécuté au plus toutes les 30 secondes.
 */
let lastRefresh = 0;
async function refreshStatuses(force = false) {
  if (!force && Date.now() - lastRefresh < 30_000) return;
  lastRefresh = Date.now();
  await db.run(`UPDATE reservations SET status = 'completed' WHERE status = 'confirmed' AND end_at <= NOW()`);
  await db.run(`UPDATE reservations SET status = 'cancelled', cancelled_at = NOW() WHERE status = 'pending' AND start_at <= NOW()`);
}

/** Colonnes d'une réservation enrichie (parking, place, véhicule, client) */
const RESERVATION_SELECT = `
  SELECT r.id, r.reference, r.start_at, r.end_at, r.amount, r.status, r.created_at, r.cancelled_at,
         s.id AS space_id, s.code AS space_code, s.level, s.type AS space_type,
         p.id AS parking_id, p.name AS parking, p.address, p.latitude, p.longitude, p.manager_id,
         v.id AS vehicle_id, v.plate, v.brand, v.model,
         u.id AS driver_id, u.first_name, u.last_name, u.phone AS driver_phone,
         rv.rating AS review_rating, rv.comment AS review_comment,
         (SELECT url FROM parking_photos ph WHERE ph.parking_id = p.id ORDER BY position, id LIMIT 1) AS photo
  FROM reservations r
  JOIN parking_spaces s ON s.id = r.space_id
  JOIN parkings p       ON p.id = s.parking_id
  JOIN vehicles v       ON v.id = r.vehicle_id
  JOIN users u          ON u.id = r.driver_id
  LEFT JOIN reviews rv  ON rv.reservation_id = r.id`;

module.exports = {
  ACTIVE, defaultSlot, readSlot, OPEN_ON_SLOT, FREE_SPACES, AMOUNT, PARKING_CARD, PARKING_FROM, DISTANCE,
  refreshStatuses, RESERVATION_SELECT,
};
