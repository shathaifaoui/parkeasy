import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, EMPTY, timer, switchMap } from 'rxjs';

/**
 * Préchargement sélectif : seules les pages marquées `data: { preload: true }` (parcours public)
 * sont téléchargées en arrière-plan, 2 s après l'affichage de la première page.
 * Les espaces gestionnaire / administrateur restent chargés à la demande.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloading implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    // Connexion lente ou mode « économie de données » : pas de préchargement
    const conn = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (conn?.saveData || /2g/.test(conn?.effectiveType ?? '')) return EMPTY;
    return route.data?.['preload'] ? timer(2000).pipe(switchMap(load)) : EMPTY;
  }
}
