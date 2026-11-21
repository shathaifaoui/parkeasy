import { Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

/** État d'erreur : explique ce qui s'est passé et propose de réessayer */
@Component({
  selector: 'app-error-state',
  imports: [Icon],
  template: ` <div class="err card" role="alert">
    <span class="ico" aria-hidden="true"><app-icon name="alert" [size]="24" /></span>
    <div>
      <h2>{{ title() }}</h2>
      <p>{{ text() }}</p>
      <button type="button" class="btn btn-sm btn-primary" (click)="retry.emit()">
        <app-icon name="refresh" [size]="15" /> Réessayer
      </button>
    </div>
  </div>`,
  styles: `
    .err {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      border-color: #f2c4c4;
    }
    .ico {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: var(--red-bg);
      color: #b33232;
      flex-shrink: 0;
    }
    h2 {
      font-size: 1.05rem;
      margin: 0 0 0.25rem;
    }
    p {
      color: var(--text-2);
      margin: 0 0 0.75rem;
    }
  `,
})
export class ErrorState {
  readonly title = input('Impossible de charger ces informations');
  readonly text = input("Le serveur n'a pas répondu. Vérifiez votre connexion puis réessayez.");
  retry = output<void>();
}
