import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { Icon } from '../icon/icon';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Fenêtre modale accessible (motif ARIA « dialog ») :
 * focus placé dans la fenêtre à l'ouverture, Tab bloqué à l'intérieur, Échap pour fermer,
 * focus rendu à l'élément d'origine à la fermeture.
 */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  template: ` <!-- Clic sur le fond = confort souris ; au clavier : Échap ou bouton « Fermer » -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div class="backdrop" (click)="closed.emit()"></div>
    <div class="modal card" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId">
      <header class="row-between">
        <h2 [id]="titleId">{{ title() }}</h2>
        <button
          type="button"
          class="btn btn-ghost btn-icon"
          (click)="closed.emit()"
          aria-label="Fermer"
        >
          <app-icon name="x" />
        </button>
      </header>
      <ng-content />
    </div>`,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 300;
      display: grid;
      place-items: center;
      padding: 1rem;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgb(16 41 74 / 45%);
      animation: fade 0.18s ease-out;
    }
    .modal {
      position: relative;
      width: min(560px, 100%);
      max-height: 90vh;
      overflow: auto;
      padding: 1.4rem;
      animation: pop 0.18s ease-out;
    }
    h2 {
      margin: 0;
      font-size: 1.2rem;
    }
    header {
      margin-bottom: 1rem;
    }
    @keyframes pop {
      from {
        transform: scale(0.96);
        opacity: 0;
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  `,
  host: {
    '(document:keydown.escape)': 'closed.emit()',
    '(keydown.tab)': 'trap($event)',
    '(keydown.shift.tab)': 'trap($event)',
  },
})
export class Modal implements OnDestroy {
  readonly title = input('');
  readonly closed = output<void>();

  private static nextId = 0;
  protected titleId = `modal-title-${++Modal.nextId}`;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private opener = document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => {
      // Premier champ du formulaire s'il y en a un, sinon le bouton « Fermer »
      const els = this.focusables();
      (els.find((e) => e.matches('input, select, textarea')) ?? els[0])?.focus();
    });
  }

  private focusables() {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        `.modal ${FOCUSABLE.split(', ').join(', .modal ')}`,
      ),
    );
  }

  /** Garde le focus dans la fenêtre */
  protected trap(e: Event) {
    const ev = e as KeyboardEvent;
    const els = this.focusables();
    if (!els.length) return;
    const [first, last] = [els[0], els[els.length - 1]];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  ngOnDestroy() {
    this.opener?.focus?.();
  }
}
