import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast.service';

/** Zone d'affichage des notifications éphémères (annoncées aux lecteurs d'écran) */
@Component({
  selector: 'app-toast-outlet',
  template: ` <div class="toasts" aria-live="polite" aria-atomic="false">
    @for (t of toast.toasts(); track t.id) {
      <div [class]="'toast toast-' + t.type" [attr.role]="t.type === 'error' ? 'alert' : 'status'">
        <span>{{ t.text }}</span>
        <button type="button" (click)="toast.dismiss(t.id)" aria-label="Fermer la notification">
          ×
        </button>
      </div>
    }
  </div>`,
  styles: `
    .toasts {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      left: 1rem;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
      z-index: 400;
      pointer-events: none;
    }
    @media (max-width: 700px) {
      .toasts {
        bottom: 5rem;
      }
    }
    .toast {
      pointer-events: auto;
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      max-width: 420px;
      padding: 0.8rem 1rem;
      border-radius: 12px;
      color: #fff;
      box-shadow: var(--shadow-lg);
      animation: slide 0.25s ease-out;
      font-size: 0.92rem;
    }
    button {
      background: none;
      border: 0;
      color: inherit;
      font-size: 1.3rem;
      line-height: 1;
      cursor: pointer;
      opacity: 0.85;
      min-width: 28px;
    }
    .toast-success {
      background: #137a50;
    }
    .toast-error {
      background: #b33232;
    }
    .toast-info {
      background: var(--navy);
    }
    @keyframes slide {
      from {
        transform: translateY(12px);
        opacity: 0;
      }
    }
  `,
})
export class ToastOutlet {
  protected toast = inject(ToastService);
}
