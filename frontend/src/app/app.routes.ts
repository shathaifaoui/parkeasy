import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards';

// Architecture de l'information (Objectif 02) — chaque écran est chargé à la demande (lazy loading).
// data.preload : pages du parcours public préchargées en arrière-plan (voir core/selective-preloading.ts).
export const routes: Routes = [
  {
    path: '',
    title: 'ParkEasy — Réservez votre place de parking',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  {
    path: 'parkings',
    data: { preload: true },
    title: 'Rechercher un parking · ParkEasy',
    loadComponent: () => import('./pages/search/search').then((m) => m.SearchPage),
  },
  {
    path: 'parkings/:id',
    data: { preload: true },
    title: 'Détail du parking · ParkEasy',
    loadComponent: () =>
      import('./pages/parking-detail/parking-detail').then((m) => m.ParkingDetailPage),
  },
  {
    path: 'reserver/:id',
    title: 'Réservation · ParkEasy',
    canActivate: [roleGuard('driver')],
    loadComponent: () => import('./pages/reserve/reserve').then((m) => m.ReservePage),
  },
  {
    path: 'mes-reservations',
    title: 'Mes réservations · ParkEasy',
    canActivate: [roleGuard('driver')],
    loadComponent: () =>
      import('./pages/my-reservations/my-reservations').then((m) => m.MyReservationsPage),
  },
  {
    path: 'favoris',
    title: 'Favoris · ParkEasy',
    canActivate: [roleGuard('driver')],
    loadComponent: () => import('./pages/favorites/favorites').then((m) => m.FavoritesPage),
  },
  {
    path: 'profil',
    title: 'Profil · ParkEasy',
    canActivate: [roleGuard('driver', 'manager', 'admin')],
    loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage),
  },
  {
    path: 'gestion',
    title: 'Tableau de bord · ParkEasy',
    canActivate: [roleGuard('manager')],
    loadComponent: () => import('./pages/manager/dashboard/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: 'gestion/parkings',
    title: 'Parkings & places · ParkEasy',
    canActivate: [roleGuard('manager')],
    loadComponent: () =>
      import('./pages/manager/parkings/parkings').then((m) => m.ManagerParkingsPage),
  },
  {
    path: 'gestion/reservations',
    title: 'Réservations reçues · ParkEasy',
    canActivate: [roleGuard('manager')],
    loadComponent: () =>
      import('./pages/manager/reservations/reservations').then((m) => m.ManagerReservationsPage),
  },
  {
    path: 'admin',
    title: 'Supervision · ParkEasy',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminPage),
  },
  {
    path: 'admin/messages',
    title: 'Messages reçus · ParkEasy',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/admin/messages/messages').then((m) => m.AdminMessagesPage),
  },
  {
    path: 'aide',
    data: { preload: true },
    title: 'Aide et contact · ParkEasy',
    loadComponent: () => import('./pages/help/help').then((m) => m.HelpPage),
  },
  {
    path: 'connexion',
    data: { preload: true },
    title: 'Connexion · ParkEasy',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'inscription',
    data: { preload: true },
    title: 'Créer un compte · ParkEasy',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/register').then((m) => m.RegisterPage),
  },
  {
    path: '**',
    title: 'Page introuvable · ParkEasy',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundPage),
  },
];
