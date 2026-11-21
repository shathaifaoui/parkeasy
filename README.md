# ParkEasy — Recherche, comparaison et réservation de places de parking

**Projet Web 2025/2026, Objectif 03 : développement et intégration des fonctionnalités principales.**
Équipe : Chadha Ifaoui & Meysem Guerbej.

ParkEasy permet aux **automobilistes** de rechercher, comparer et réserver une place de parking. Les **gestionnaires** y publient leurs parkings, leurs places et suivent les réservations reçues. L'**administrateur** supervise la plateforme.
Le site réalise le MCD/MLD, les 14 règles de gestion et les 13 maquettes de l'Objectif 02.

---

## 1. Lancement rapide

### Prérequis
- **[Node.js](https://nodejs.org) 20.19 ou plus récent** (22 LTS recommandé)
- **PostgreSQL 14 ou plus récent** (16 recommandé), au choix :
  - **installé sur la machine** ([installeur Windows / macOS](https://www.postgresql.org/download/)) ; notez le mot de passe choisi pour l'utilisateur `postgres` ;
  - **avec Docker** : `docker compose up -d` à la racine lance un PostgreSQL 16 déjà configuré.

> L'extension `btree_gist`, utilisée par la contrainte anti-chevauchement, est fournie avec PostgreSQL. Elle est activée automatiquement.

### Démarrage

```bash
# à la racine du projet (dossier ParkEasy/)
npm run setup     # installe les dépendances et crée backend/.env, environ 1 à 2 min
```

Ouvrez **`backend/.env`** et indiquez le **mot de passe de votre utilisateur `postgres`** (par défaut : `postgres`) :

```ini
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=votre_mot_de_passe
PGDATABASE=parkeasy
```

```bash
npm start         # lance l'API (port 3000) ET le site Angular (port 4200)
```

Ouvrir **http://localhost:4200**.

> Au **premier lancement**, l'API crée la base `parkeasy`, exécute `backend/database/schema.sql` (11 tables, contraintes, index) puis insère les données de démonstration :
> - 8 parkings à Tunis, Ariana et Sousse, soit 206 places ;
> - environ 5 700 réservations réparties sur 14 jours passés et 5 jours à venir ;
> - environ 600 avis.
>
> Vous pouvez ensuite explorer la base avec **pgAdmin** ou `psql -U postgres -d parkeasy`.

| Commande (racine) | Rôle |
|---|---|
| `npm start` | Lance le backend et le frontend ensemble |
| `npm test` | Lance les 12 tests automatisés de l'API sur une base séparée `parkeasy_test` |
| `npm run reset-db` | Recrée la base avec des données de démo fraîches (dates recalculées à partir d'aujourd'hui), puis démarre l'API |
| `npm run build` | Compile le frontend pour la production |

**En cas de problème :** le message « Connexion à PostgreSQL impossible » signifie que PostgreSQL n'est pas lancé ou que le mot de passe dans `backend/.env` est incorrect. Si le port 3000 ou 4200 est déjà utilisé (par un autre projet lancé), arrêtez-le d'abord.

### Comptes de démonstration (remplissage en un clic depuis la page Connexion)

| Profil | E-mail | Mot de passe |
|---|---|---|
| Automobiliste (persona **Youssef**) | `youssef@parkeasy.tn` | `Youssef123!` |
| Gestionnaire (persona **Sami**, 4 parkings dont 1 en attente) | `sami@parkeasy.tn` | `Sami123!` |
| Gestionnaire (Leila, 4 parkings) | `leila@parkeasy.tn` | `Leila123!` |
| Administrateur | `admin@parkeasy.tn` | `Admin123!` |
| Autres automobilistes | `amel.benali@mail.tn`, `karim.saidi@mail.tn`… | `Driver123!` |

---

## 2. Choix techniques

| Couche | Technologie | Justification |
|---|---|---|
| Frontend | **Angular 20** : composants *standalone*, *signals*, formulaires réactifs, *guards* par rôle, *lazy loading* | Framework annoncé dans l'Objectif 02. Une route Angular correspond à chaque écran de l'architecture de l'information. |
| Carte | **Leaflet** + tuiles **OpenStreetMap** | Carte interactive gratuite et sans clé d'API. Chaque repère affiche le tarif du parking (maquette 2). |
| Styles | SCSS + variables CSS reprenant la **charte graphique** de l'Objectif 02 | Couleurs bleu foncé, bleu action, vert, turquoise, orange et rouge ; cartes arrondies à 14 px. |
| Backend | **Node.js + Express 5**, API REST/JSON, **JWT** + **bcrypt** | Le même langage côté client et serveur. L'API revérifie les droits du rôle à chaque requête. |
| Base de données | **PostgreSQL** (driver `pg`) | Schéma identique au **dictionnaire de données** de l'Objectif 02. La règle RG10 est garantie par la contrainte `EXCLUDE USING gist`. La colonne `reference` est générée (`'RES-' ‖ (id + 1000)`). Les dates utilisent `TIMESTAMPTZ`, évaluées à l'heure de Tunis. |
| Tests | `node:test` | Tests d'intégration de l'API, qui vérifient les règles de gestion. |

### Architecture

```
 Angular (4200)  ──/api (proxy)──▶  Express (3000)  ──SQL──▶  PostgreSQL « parkeasy »
 composants, services,              routes par profil,         11 tables, EXCLUDE gist,
 guards, Leaflet                    JWT, règles métier         colonne générée, index
```

---

## 3. Fonctionnalités développées (écrans de l'Objectif 02)

| Route | Écran (maquette) | Profil | Fonctionnalités |
|---|---|---|---|
| `/` | Accueil (1) | tous | Formulaire zone / date / arrivée / départ, chiffres clés réels, parcours en 4 étapes, parkings populaires (note, tarif, places libres) |
| `/parkings` | Recherche & carte (2) | tous | Rappel modifiable de la recherche, filtres (prix max, places libres sur le créneau, services), **carte Leaflet** avec le tarif sur chaque repère, résultats comparables (note, distance, total estimé, places libres), tri par prix, note, places ou distance (« Autour de moi » par géolocalisation), favoris |
| `/parkings/:id` | Détail (3) | tous | Galerie photos, note moyenne et favori, tarif, places libres, horaires, capacité, équipements, avis vérifiés, encadré de réservation avec total recalculé en direct, itinéraire |
| `/reserver/:id` | Réservation (4) | automobiliste | Étapes, créneau avec **durée calculée**, **plan interactif par niveau** (libre, réservée, PMR, borne, moto, hors service), récapitulatif en direct, choix ou ajout d'un véhicule, confirmation → « en attente » |
| `/mes-reservations` | Suivi (5) | automobiliste | Onglets à venir / passées / annulées, statut coloré **et** libellé, itinéraire, **annulation avant le début**, **avis 1 à 5** après une réservation terminée |
| `/favoris` · `/profil` | Profil (6) | connectés | Informations personnelles, **véhicules** (immatriculation unique), préférences de notification, mot de passe |
| `/gestion` | Tableau de bord (7) | gestionnaire | Indicateurs du jour (places, libres maintenant, réservations, revenus), **taux d'occupation** par heure, semaine ou mois (graphique SVG), occupation par parking avec seuil d'alerte à 85 %, dernières réservations, alerte « à confirmer » |
| `/gestion/parkings` | Parkings & places (8) | gestionnaire | Choix du parking et statut de publication, informations modifiables, équipements, photos, **plan des places en temps réel**, **mise hors service / remise en service**, ajout de places, création d'un parking (« en validation ») |
| `/gestion/reservations` | Réservations reçues (9) | gestionnaire | Recherche (référence, client, immatriculation, place), filtres parking, période et statut, tableau paginé, **confirmer / refuser en un clic** |
| `/admin` | Supervision (10) | administrateur | Indicateurs globaux, **validation ou refus des nouveaux parkings**, gestion des comptes (suspendre, réactiver) |
| (mobile) | Version mobile (11) | tous | Responsive : menu latéral repliable, **barre d'onglets en bas d'écran** pour l'automobiliste, carte et liste empilées |

Autres éléments : cloche de **notifications** propre à chaque rôle (réservations à confirmer, à évaluer, parkings à valider), toasts de confirmation, page 404, retour automatique à la page demandée après connexion (le créneau choisi est conservé).

### Règles de gestion

| Règle | Où elle est garantie |
|---|---|
| RG1 rôle unique, compte suspendu | `CHECK` en base, connexion refusée, rôle et statut relus en base à chaque requête |
| RG2 immatriculation unique | `UNIQUE (plate)` + format vérifié |
| RG3–RG4 gestionnaire, zone, tarif, horaires | Clés étrangères, `CHECK (open_24h OR horaires renseignés)` ; une réservation hors des horaires d'ouverture est refusée |
| RG5 parking en attente | Statut `pending` à la création ; invisible jusqu'à la validation par l'admin |
| RG6–RG7 places, hors service | `UNIQUE (parking_id, code)` ; une place hors service n'est pas réservable |
| RG9–RG10 créneau, **aucun chevauchement** | `CHECK (end_at > start_at)` + **`EXCLUDE USING gist`** ; l'erreur 23P01 devient HTTP 409 et le plan est rafraîchi |
| RG11 montant | Calculé **en SQL** (tarif × heures entamées) et figé dans la réservation |
| RG12 cycle de vie | En attente → confirmée (gestionnaire) → terminée (automatique) ; annulation avant le début ; une demande non confirmée à l'heure d'arrivée expire |
| RG13 favoris | Table `favorites` (clé primaire composée) |
| RG14 avis | Un seul par réservation (`UNIQUE`) et seulement si elle est terminée |

---

## 4. Structure du projet

```
ParkEasy/
├── package.json                 # scripts globaux (setup, start, test)
├── docker-compose.yml           # option : PostgreSQL 16 avec Docker
├── backend/
│   ├── .env.example             # connexion PostgreSQL, fuseau horaire
│   ├── database/
│   │   ├── schema.sql           # 11 tables conformes au MLD, EXCLUDE gist, colonne générée
│   │   ├── queries.sql          # requêtes clés (recherche, réservation, tableau de bord…)
│   │   ├── seed.js              # données de démonstration (dates relatives à aujourd'hui)
│   │   └── parkeasy_dump.sql    # export pg_dump complet (import manuel facultatif)
│   ├── src/
│   │   ├── server.js · app.js · db.js
│   │   ├── business.js          # créneaux, disponibilités, montant, cycle de vie
│   │   ├── middleware/auth.js   # JWT + contrôle des rôles
│   │   └── routes/              # auth, parkings, driver, manager, admin, notifications
│   └── tests/api.test.js        # 12 tests (RG1, RG2, RG5, RG7, RG10, RG11, RG12, RG14…)
└── frontend/
    ├── proxy.conf.json          # /api → localhost:3000
    ├── public/img/              # illustrations des parkings
    └── src/app/
        ├── core/                # modèles, ApiService, AuthService, SearchState, guards
        ├── shared/              # icônes, cartes, carte Leaflet, graphique, formulaire de recherche
        └── pages/               # home, search, parking-detail, reserve, my-reservations,
                                 # favorites, profile, manager/*, admin, auth
```

---

## 5. API REST (principales routes)

| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | public |
| GET / PUT | `/api/auth/me` · PUT `/api/auth/password` | connecté |
| GET | `/api/zones` · `/api/amenities` · `/api/stats` | public |
| GET | `/api/parkings?zone=&q=&start=&end=&maxPrice=&available=1&amenities=&sort=&lat=&lng=` | public |
| GET | `/api/parkings/:id` · `/api/parkings/:id/spaces?start=&end=` | public |
| GET / POST / DELETE | `/api/vehicles` | automobiliste |
| POST | `/api/reservations` · `/api/reservations/:id/cancel` · `/api/reservations/:id/review` | automobiliste |
| GET | `/api/reservations/me?tab=upcoming\|past\|cancelled` | automobiliste |
| GET / POST / DELETE | `/api/favorites[/:parkingId]` | automobiliste |
| GET | `/api/notifications` | connecté |
| GET | `/api/manager/dashboard?period=day\|week\|month` | gestionnaire |
| GET / POST / PUT | `/api/manager/parkings[/:id]` · POST `/:id/spaces` · `/:id/photos` | gestionnaire |
| PATCH | `/api/manager/spaces/:id` · `/api/manager/reservations/:id` | gestionnaire |
| GET | `/api/manager/reservations?parking=&status=&from=&to=&q=&page=` | gestionnaire |
| GET / PATCH | `/api/admin/stats` · `/api/admin/parkings` · `/api/admin/users` | administrateur |

---

## 6. Scénario de test conseillé (environ 10 minutes)

1. **Accueil** (visiteur) : choisir une date et un créneau, puis **Rechercher**.
2. **Recherche** : cocher le service *Borne de recharge* puis **Appliquer** ; trier par note ; survoler un résultat pour voir son repère s'activer sur la carte.
3. Ouvrir un parking → **Réserver une place** : la connexion est demandée. Choisir **Youssef**. On revient sur la réservation avec le même créneau.
4. **Réservation** : changer de niveau, choisir une place verte. Le récapitulatif et le total se mettent à jour en direct. Cliquer **Confirmer** pour obtenir « Demande envoyée ! » avec la référence RES-xxxx.
5. **Mes réservations** : annuler la nouvelle réservation. Dans l'onglet **Passées**, laisser un **avis** (étoiles et commentaire) ; il apparaît ensuite sur la fiche du parking.
6. **Profil** : ajouter un véhicule (ex. `230 TU 1111`). Essayer `215 TU 4587`, déjà utilisé : il est refusé.
7. Se déconnecter puis se connecter en **Sami** (gestionnaire) :
   - **Tableau de bord** : indicateurs et courbe d'occupation (Jour / Semaine / Mois) ;
   - **Parkings & places** : cliquer une place, **Mettre hors service**, puis **Remettre en service** ;
   - **Réservations** : onglet *En attente*, cliquer **Confirmer** sur une demande ; Youssef la voit alors « Confirmée ».
8. Se connecter en **Admin** : **valider le Parking Ennasr** (en attente). Il apparaît désormais dans la recherche publique. Suspendre puis réactiver un compte.
9. **Anti-chevauchement** : réserver deux fois la même place sur deux créneaux qui se recoupent (deux onglets). La seconde demande est refusée avec le message « Cette place vient d'être réservée sur ce créneau ».
10. **Mobile** : outils de développement (F12) → mode mobile : barre d'onglets en bas, carte au-dessus de la liste.
11. `npm test` : les 12 tests passent.

Pour repartir de données propres : `npm run reset-db`.

---

## 7. Compatibilité et accessibilité

Testé sous Chromium (Playwright) en 1440 px et en 390 px. Le site n'utilise que des API web standard : Chrome, Firefox, Edge et Safari récents.

Accessibilité : HTML sémantique, `lang="fr"`, lien d'évitement, focus visible, libellés et attributs ARIA (plan des places, onglets, modales), statuts toujours accompagnés d'un texte (la couleur n'est jamais le seul indicateur), cibles tactiles d'au moins 44 px sur mobile, `prefers-reduced-motion`.
