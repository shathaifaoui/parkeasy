-- =====================================================================
--  ParkEasy — Requêtes SQL clés utilisées par l'API (PostgreSQL)
--  (version lisible ; dans le code elles sont paramétrées $1, $2…)
-- =====================================================================

-- 1. RECHERCHER & COMPARER  (GET /api/parkings)
--    Places libres sur le créneau [$1, $2[, total estimé (RG11), note moyenne
SELECT p.id, p.name, p.hourly_rate,
       (SELECT COUNT(*) FROM parking_spaces s
         WHERE s.parking_id = p.id AND s.state = 'in_service'
           AND NOT EXISTS (SELECT 1 FROM reservations r
                           WHERE r.space_id = s.id AND r.status IN ('pending', 'confirmed')
                             AND tstzrange(r.start_at, r.end_at) && tstzrange($1, $2))) AS free_spaces,
       CEIL(EXTRACT(EPOCH FROM ($2::timestamptz - $1::timestamptz)) / 3600) * p.hourly_rate AS estimated_total,
       rv.rating
FROM parkings p
JOIN zones z ON z.id = p.zone_id
LEFT JOIN (SELECT s.parking_id, ROUND(AVG(v.rating), 1) AS rating
           FROM reviews v JOIN reservations r ON r.id = v.reservation_id
           JOIN parking_spaces s ON s.id = r.space_id GROUP BY s.parking_id) rv ON rv.parking_id = p.id
WHERE p.status = 'active'            -- RG5 : seuls les parkings validés
  AND p.zone_id = $3                 -- filtre zone (facultatif)
  AND p.hourly_rate <= $4            -- filtre prix maximum (facultatif)
ORDER BY p.hourly_rate, free_spaces DESC;

-- 2. PLAN DES PLACES  (GET /api/parkings/:id/spaces)
SELECT s.id, s.code, s.level, s.type,
       CASE WHEN s.state = 'out_of_service' THEN 'out_of_service'
            WHEN EXISTS (SELECT 1 FROM reservations r WHERE r.space_id = s.id AND r.status IN ('pending', 'confirmed')
                         AND tstzrange(r.start_at, r.end_at) && tstzrange($1, $2)) THEN 'reserved'
            ELSE 'free' END AS availability
FROM parking_spaces s WHERE s.parking_id = $3 ORDER BY s.id;

-- 3. RÉSERVER  (POST /api/reservations)
--    Montant calculé en SQL et figé (RG11) ; la contrainte EXCLUDE refuse tout
--    chevauchement (RG10, erreur 23P01 -> HTTP 409), même en cas de requêtes simultanées.
INSERT INTO reservations (driver_id, space_id, vehicle_id, start_at, end_at, amount)
SELECT $1, s.id, $3, $4, $5, CEIL(EXTRACT(EPOCH FROM ($5::timestamptz - $4::timestamptz)) / 3600) * p.hourly_rate
FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id
WHERE s.id = $2
RETURNING id, reference, amount, status;

-- 4. CYCLE DE VIE AUTOMATIQUE (RG12) — exécuté par l'API toutes les 30 s au plus
UPDATE reservations SET status = 'completed' WHERE status = 'confirmed' AND end_at <= NOW();
UPDATE reservations SET status = 'cancelled', cancelled_at = NOW() WHERE status = 'pending' AND start_at <= NOW();

-- 5. ANNULATION par l'automobiliste, possible seulement avant le début (RG12)
UPDATE reservations SET status = 'cancelled', cancelled_at = NOW()
WHERE id = $1 AND driver_id = $2 AND status IN ('pending', 'confirmed') AND start_at > NOW();

-- 6. TABLEAU DE BORD GESTIONNAIRE — taux d'occupation heure par heure aujourd'hui
WITH spaces AS (SELECT s.id FROM parking_spaces s JOIN parkings p ON p.id = s.parking_id
                WHERE p.manager_id = $1 AND p.status = 'active' AND s.state = 'in_service'),
     hours  AS (SELECT h, (CURRENT_DATE + make_interval(hours => h))::timestamptz AS t FROM generate_series(7, 21) h)
SELECT h, ROUND(100.0 * COUNT(DISTINCT r.space_id) / NULLIF((SELECT COUNT(*) FROM spaces), 0)) AS occupancy
FROM hours LEFT JOIN reservations r
  ON r.space_id IN (SELECT id FROM spaces) AND r.status <> 'cancelled'
 AND tstzrange(r.start_at, r.end_at) && tstzrange(hours.t, hours.t + INTERVAL '1 hour')
GROUP BY h ORDER BY h;

-- 7. REVENUS DU JOUR d'un gestionnaire
SELECT COALESCE(SUM(r.amount), 0) AS revenue_today
FROM reservations r JOIN parking_spaces s ON s.id = r.space_id JOIN parkings p ON p.id = s.parking_id
WHERE p.manager_id = $1 AND r.status IN ('confirmed', 'completed') AND r.start_at::date = CURRENT_DATE;
