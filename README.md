# ParkEasy

Site de recherche, de comparaison et de réservation de places de parking à Tunis.

Projet Web 2025/2026 (SUP'COM), objectif 4 : finalisation du frontend et optimisation du site.
Équipe : Chadha Ifaoui et Meysem Guerbej.

Le site a trois types d'utilisateurs :

- les automobilistes cherchent un parking, comparent les tarifs et réservent une place ;
- les gestionnaires publient leurs parkings et confirment les réservations ;
- l'administrateur valide les nouveaux parkings et gère les comptes.

Il reprend le modèle de données, les 14 règles de gestion et les maquettes de l'objectif 2.

## Installation

Il faut :

- Node.js 20.19 ou plus récent ([nodejs.org](https://nodejs.org)) ;
- PostgreSQL 14 ou plus récent ([postgresql.org](https://www.postgresql.org/download/)). Sans installation, `docker compose up -d` lance un PostgreSQL 16 déjà configuré.

Dans le dossier du projet :

```bash
npm run setup
```

Cette commande installe les dépendances et crée le fichier `backend/.env`. Ouvrez-le et mettez le mot de passe de votre utilisateur `postgres` :

```ini
PGPASSWORD=votre_mot_de_passe
```

Puis :

```bash
npm start
```

Le site est sur http://localhost:4200 (l'API tourne sur le port 3000).

Au premier lancement, l'API crée la base `parkeasy` et la remplit avec des données de démonstration : 8 parkings à Tunis, Ariana et Sousse, environ 5 700 réservations et 600 avis. Les dates sont calculées à partir du jour du lancement. Pour repartir de zéro : `npm run reset-db`.

Si le message « Connexion à PostgreSQL impossible » s'affiche, PostgreSQL n'est pas démarré ou le mot de passe dans `backend/.env` est faux.

### Autres commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run prod` | compile le site et le sert avec l'API sur http://localhost:3000 |
| `npm test` | tests de l'API (14), sur une base séparée `parkeasy_test` |
| `npm run test:front` | tests Angular (10), Chrome nécessaire |
| `npm run lint` | vérification du code avec ESLint |
| `npm run format` | mise en forme du code du frontend avec Prettier |
| `npm run reset-db` | recrée la base avec des données neuves |

### Comptes de test

Sur la page de connexion, un clic sur un compte remplit le formulaire.

| Profil | E-mail | Mot de passe |
|---|---|---|
| Automobiliste (Youssef) | youssef@parkeasy.tn | Youssef123! |
| Gestionnaire (Sami, 4 parkings dont 1 en attente) | sami@parkeasy.tn | Sami123! |
| Gestionnaire (Leila, 4 parkings) | leila@parkeasy.tn | Leila123! |
| Administrateur | admin@parkeasy.tn | Admin123! |
| Autres automobilistes | amel.benali@mail.tn, karim.saidi@mail.tn… | Driver123! |

## Technologies

- **Frontend** : Angular 20 (composants standalone, signals, sans zone.js, formulaires réactifs, guards par rôle, pages chargées à la demande), SCSS avec les couleurs de notre charte graphique.
- **Carte** : Leaflet avec les fonds OpenStreetMap, gratuits et sans clé d'API.
- **Backend** : Node.js et Express 5, API REST en JSON, connexion par JWT, mots de passe hachés avec bcrypt.
- **Base de données** : PostgreSQL. Le schéma suit le dictionnaire de données de l'objectif 2. Une contrainte `EXCLUDE USING gist` empêche deux réservations de se chevaucher sur la même place.
- **Tests et qualité** : `node:test` pour l'API, Jasmine et Karma pour Angular, ESLint et Prettier.

```
Angular (port 4200)  --/api-->  Express (port 3000)  --SQL-->  PostgreSQL
```

## Pages

| Route | Contenu | Pour qui |
|---|---|---|
| `/` | Accueil : formulaire de recherche, chiffres clés, parkings populaires | tous |
| `/parkings` | Recherche : filtres, carte avec le tarif de chaque parking, tri, favoris | tous |
| `/parkings/:id` | Fiche d'un parking : photos, tarif, horaires, équipements, avis | tous |
| `/aide` | Questions fréquentes et formulaire de contact | tous |
| `/reserver/:id` | Réservation : créneau et choix de la place sur le plan | automobiliste |
| `/mes-reservations` | Réservations à venir, passées et annulées ; annulation et avis | automobiliste |
| `/favoris`, `/profil` | Favoris, informations personnelles, véhicules, mot de passe | connecté |
| `/gestion` | Tableau de bord : indicateurs et taux d'occupation | gestionnaire |
| `/gestion/parkings` | Modification des parkings, plan des places, mise hors service | gestionnaire |
| `/gestion/reservations` | Réservations reçues : recherche, filtres, confirmer ou refuser | gestionnaire |
| `/admin` | Validation des parkings, gestion des comptes | administrateur |
| `/admin/messages` | Messages envoyés depuis la page d'aide | administrateur |

Sur mobile, le menu se replie et l'automobiliste a une barre d'onglets en bas de l'écran. Chaque rôle a aussi sa cloche de notifications.

### Règles de gestion

| Règle | Comment elle est appliquée |
|---|---|
| RG1 un seul rôle par compte, compte suspendu | contrainte `CHECK` ; rôle et statut relus en base à chaque requête |
| RG2 immatriculation unique | contrainte `UNIQUE` et vérification du format |
| RG3-RG4 gestionnaire, zone, tarif, horaires | clés étrangères ; réservation refusée en dehors des horaires d'ouverture |
| RG5 nouveau parking en attente | invisible dans la recherche tant que l'admin ne l'a pas validé |
| RG6-RG7 places, place hors service | code unique par parking ; une place hors service ne peut pas être réservée |
| RG9-RG10 créneau, pas de chevauchement | `CHECK (end_at > start_at)` et `EXCLUDE USING gist` ; en cas de conflit, l'API renvoie une erreur 409 |
| RG11 montant | calculé en SQL (tarif × heures commencées) et enregistré avec la réservation |
| RG12 cycle de vie | en attente, puis confirmée par le gestionnaire, puis terminée ; annulation possible avant le début ; une demande non confirmée à l'heure d'arrivée expire |
| RG13 favoris | table `favorites` |
| RG14 avis | un seul par réservation, et seulement une fois la réservation terminée |

## Structure du projet

```
ParkEasy/
├── package.json             scripts communs (setup, start, prod, test, lint)
├── docker-compose.yml       PostgreSQL avec Docker (facultatif)
├── backend/
│   ├── database/            schema.sql, seed.js, migrations/, requêtes et export de la base
│   ├── src/                 serveur Express, routes par rôle, règles métier, connexion JWT
│   └── tests/api.test.js    14 tests
└── frontend/
    ├── public/              images, robots.txt, sitemap.xml
    └── src/app/
        ├── core/            modèles, services, guards
        ├── layout/          en-tête, pied de page, menus, notifications
        ├── components/      composants réutilisables (cartes, badges, fenêtre modale…)
        ├── pipes/           formats des prix, dates et durées
        └── pages/           une page par dossier
```

## API

| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET, PUT | `/api/auth/me`, `/api/auth/password` | connecté |
| GET | `/api/zones`, `/api/amenities`, `/api/stats` | public |
| GET | `/api/parkings` (filtres : zone, créneau, prix, services, tri, position) | public |
| GET | `/api/parkings/:id`, `/api/parkings/:id/spaces` | public |
| POST | `/api/contact` (5 messages par 10 minutes et par adresse IP) | public |
| GET, POST, DELETE | `/api/vehicles`, `/api/favorites` | automobiliste |
| GET, POST | `/api/reservations/me`, `/api/reservations`, annulation, avis | automobiliste |
| GET | `/api/notifications` | connecté |
| GET, POST, PUT, PATCH | `/api/manager/...` (tableau de bord, parkings, places, réservations) | gestionnaire |
| GET, PATCH | `/api/admin/...` (statistiques, parkings, comptes, messages) | administrateur |

## Scénario de test (environ 10 minutes)

1. Sur l'accueil, choisir une date et un créneau, puis lancer la recherche.
2. Filtrer par « Borne de recharge », trier par note, survoler un résultat pour voir son repère sur la carte.
3. Ouvrir un parking et cliquer sur « Réserver une place ». Se connecter avec Youssef : on revient sur la réservation avec le même créneau.
4. Choisir une place libre sur le plan et confirmer. Une référence RES-xxxx s'affiche.
5. Dans « Mes réservations », annuler cette réservation, puis laisser un avis sur une réservation passée.
6. Dans le profil, ajouter le véhicule `230 TU 1111`. Essayer `215 TU 4587` : il est refusé car déjà utilisé.
7. Se connecter avec Sami (gestionnaire) : regarder le tableau de bord, mettre une place hors service puis la remettre, confirmer une réservation en attente.
8. Se connecter en admin : valider le Parking Ennasr, qui apparaît ensuite dans la recherche.
9. Ouvrir deux onglets et réserver la même place sur deux créneaux qui se recoupent : la seconde demande est refusée.
10. Envoyer un message depuis la page Aide, puis le marquer comme traité dans Admin > Messages.
11. Avec les outils de développement (F12), passer en affichage mobile.

## Changements de l'objectif 4

- Deux nouvelles pages, Aide et contact et Messages reçus, avec leur partie backend et une migration SQL.
- Le frontend est réorganisé : un dossier par composant, et la mise en page (en-tête, menus, pied de page) dans `layout/`.
- Les pages affichent un squelette pendant le chargement, et un message avec un bouton « Réessayer » en cas d'erreur.
- Accessibilité : contrastes corrigés, onglets et fenêtres modales utilisables au clavier, titre de la page annoncé aux lecteurs d'écran. L'outil axe-core ne trouve plus d'erreur sur les 17 pages testées.
- Performances : le code chargé au démarrage passe de 425 kB à 337 kB, grâce à Angular sans zone.js et à la carte chargée après la liste. Lighthouse donne 100 en accessibilité et en SEO sur les pages publiques.
- Correction d'un bug : la base était recréée à chaque démarrage, ce qui effaçait les réservations.

Les mesures détaillées sont dans le rapport de l'objectif 4.

## Compatibilité

Testé avec Chromium en 1440 px et 390 px de large. Le site n'utilise que des fonctionnalités web standard et devrait fonctionner sur les versions récentes de Chrome, Firefox, Edge et Safari.
