import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../../core/api.service';
import { errorMessage } from '../../../core/auth.interceptor';
import { ContactMessage, ROLE_LABEL, TOPIC_LABEL } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { Empty } from '../../../components/empty-state/empty-state';
import { ErrorState } from '../../../components/error-state/error-state';
import { Icon } from '../../../components/icon/icon';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { DateFrPipe } from '../../../pipes/date-fr-pipe';

type Filter = 'new' | 'done' | 'all';

/** Administrateur : messages reçus via la page « Aide & contact » (lecture + mise à jour du statut) */
@Component({
  selector: 'app-admin-messages',
  imports: [Icon, Empty, ErrorState, Skeleton, DateFrPipe],
  template: ` <div class="page">
    <div class="page-head">
      <div>
        <h1>Messages reçus</h1>
        <p>Questions envoyées depuis la page « Aide et contact ».</p>
      </div>
      <div class="segmented" role="group" aria-label="Filtrer les messages">
        @for (f of filters; track f.value) {
          <button
            type="button"
            [class.on]="filter() === f.value"
            [attr.aria-pressed]="filter() === f.value"
            (click)="load(f.value)"
          >
            {{ f.label }}
          </button>
        }
      </div>
    </div>

    @if (failed()) {
      <app-error-state title="Impossible de charger les messages" (retry)="load(filter())" />
    } @else if (all(); as list) {
      <p class="muted small count" aria-live="polite">
        {{ list.length }} message{{ list.length > 1 ? 's' : ''
        }}{{ filter() === 'new' ? ' à traiter' : '' }}
      </p>
      <div class="stack">
        @for (m of list; track m.id) {
          <article class="card msg" [class.done]="m.status === 'done'">
            <header class="row-between">
              <div>
                <h2>
                  {{ m.name }} <span class="badge badge-blue">{{ topicLabel[m.topic] }}</span>
                  @if (m.author_role) {
                    <span class="badge badge-completed">{{ roleLabel[m.author_role] }}</span>
                  }
                </h2>
                <a
                  class="small"
                  [href]="
                    'mailto:' + m.email + '?subject=ParkEasy%20-%20votre%20message%20n%C2%B0' + m.id
                  "
                  >{{ m.email }}</a
                >
              </div>
              <span class="small when">{{ m.created_at | dateFr: 'datetime' }}</span>
            </header>
            <p class="body">{{ m.message }}</p>
            <footer class="row-between">
              @if (m.status === 'done') {
                <span class="badge badge-confirmed"
                  ><app-icon name="check" [size]="13" /> Traité le
                  {{ m.handled_at | dateFr: 'short' }}</span
                >
                <button
                  type="button"
                  class="btn btn-sm btn-ghost"
                  (click)="setStatus(m, 'new')"
                  [disabled]="busy() === m.id"
                >
                  Rouvrir
                </button>
              } @else {
                <span class="badge badge-pending">À traiter</span>
                <button
                  type="button"
                  class="btn btn-sm btn-success"
                  (click)="setStatus(m, 'done')"
                  [disabled]="busy() === m.id"
                >
                  <app-icon name="check" [size]="15" /> Marquer comme traité
                </button>
              }
            </footer>
          </article>
        } @empty {
          <div class="card">
            <app-empty
              icon="check"
              [text]="
                filter() === 'new' ? 'Aucun message à traiter. Tout est à jour.' : 'Aucun message.'
              "
            />
          </div>
        }
      </div>
    } @else {
      <app-skeleton variant="card" [count]="3" label="Chargement des messages…" />
    }
  </div>`,
  styles: `
    .count {
      margin: 0 0 0.6rem;
    }
    .msg {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      transition:
        opacity 0.2s,
        border-color 0.2s;
    }
    .msg.done {
      opacity: 0.75;
    }
    h2 {
      font-size: 1rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
      margin: 0 0 0.1rem;
    }
    .when {
      color: var(--text-2);
      white-space: nowrap;
    }
    .body {
      white-space: pre-line;
      margin: 0;
      color: var(--text);
    }
    header {
      align-items: flex-start;
    }
  `,
})
export class AdminMessagesPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected filters: { value: Filter; label: string }[] = [
    { value: 'new', label: 'À traiter' },
    { value: 'done', label: 'Traités' },
    { value: 'all', label: 'Tous' },
  ];
  protected topicLabel = TOPIC_LABEL;
  protected roleLabel = ROLE_LABEL as Record<string, string>;
  protected readonly filter = signal<Filter>('new');
  protected readonly all = signal<ContactMessage[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal<number | null>(null);

  constructor() {
    this.load('new');
  }

  load(f: Filter) {
    this.filter.set(f);
    this.all.set(null);
    this.failed.set(false);
    this.api.adminMessages(f).subscribe({
      next: (l) => this.all.set(l),
      error: () => this.failed.set(true),
    });
  }

  /** Mise à jour optimiste : l'interface change tout de suite, et revient en arrière si l'API refuse */
  setStatus(m: ContactMessage, status: 'new' | 'done') {
    const before = this.all();
    this.busy.set(m.id);
    const patch = (l: ContactMessage[] | null) =>
      (l ?? [])
        .map((x) =>
          x.id === m.id
            ? { ...x, status, handled_at: status === 'done' ? new Date().toISOString() : null }
            : x,
        )
        .filter((x) => this.filter() === 'all' || x.status === this.filter());
    this.all.update(patch);
    this.api.setMessageStatus(m.id, status).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(
          status === 'done'
            ? `Message de ${m.name} marqué comme traité`
            : `Message de ${m.name} rouvert`,
        );
      },
      error: (e) => {
        this.all.set(before);
        this.busy.set(null);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
