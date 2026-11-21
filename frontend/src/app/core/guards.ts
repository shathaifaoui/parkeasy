import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

/**
 * Routes protégées par rôle. Un visiteur est redirigé vers la connexion
 * (puis ramené à la page demandée), un autre profil vers son propre espace.
 * L'API vérifie aussi les droits à chaque requête (JWT).
 */
export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();
    if (!user) return router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
    return roles.includes(user.role) ? true : router.createUrlTree([auth.home()]);
  };

/** Connexion / inscription : inutiles si déjà connecté */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree([auth.home()]) : true;
};
