import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService, TOKEN_KEY } from './auth.service';
import { ToastService } from './toast.service';

/** Ajoute le jeton JWT et gère les erreurs réseau / session expirée */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // AuthService est résolu à la demande (il utilise lui-même HttpClient -> évite une dépendance circulaire)
  const injector = inject(Injector);
  const toast = inject(ToastService);
  const token = localStorage.getItem(TOKEN_KEY);
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0 || err.status === 504) {
        toast.error("Serveur injoignable. Vérifiez que l'API est lancée (npm start).");
      } else if (err.status === 401 && token && !req.url.includes('/auth/login')) {
        injector.get(AuthService).logout();
        toast.error('Votre session a expiré, veuillez vous reconnecter.');
      }
      return throwError(() => err);
    }),
  );
};

/** Extrait un message lisible d'une erreur HTTP */
export function errorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (err instanceof HttpErrorResponse) return err.error?.message ?? fallback;
  return fallback;
}
