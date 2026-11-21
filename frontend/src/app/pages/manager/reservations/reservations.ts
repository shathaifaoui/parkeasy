import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import { errorMessage } from '../../../core/auth.interceptor';
import { Paged, Reservation } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { Icon } from '../../../components/icon/icon';
import { DateFrPipe } from '../../../pipes/date-fr-pipe';
import { Empty } from '../../../components/empty-state/empty-state';
import { HourPipe } from '../../../pipes/hour-pipe';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { StatusBadge } from '../../../components/status-badge/status-badge';
import { TndPipe } from '../../../pipes/tnd-pipe';

@Component({
  selector: 'app-manager-reservations',
  imports: [FormsModule, Icon, StatusBadge, TndPipe, DateFrPipe, HourPipe, Skeleton, Empty],
  template: ` <div class="page">
    <div class="page-head">
      <div>
        <h1>Réservations reçues</h1>
        <p>Confirmez ou refusez les demandes des automobilistes.</p>
      </div>
    </div>

    <!-- 1. Recherche et filtres -->
    <form class="card filters" (ngSubmit)="go(1)">
      <div class="input-icon grow">
        <app-icon name="search" [size]="16" />
        <input
          class="input"
          name="q"
          [(ngModel)]="q"
          placeholder="N° RES, client, immatriculation, place…"
          aria-label="Rechercher"
        />
      </div>
      <select
        class="input"
        name="parking"
        [(ngModel)]="parking"
        (ngModelChange)="go(1)"
        aria-label="Parking"
      >
        <option [ngValue]="null">Tous les parkings</option>
        @for (p of parkings(); track p.id) {
          <option [ngValue]="p.id">{{ p.name }}</option>
        }
      </select>
      <input
        class="input"
        type="date"
        name="from"
        [(ngModel)]="from"
        (ngModelChange)="go(1)"
        aria-label="Du"
      />
      <input
        class="input"
        type="date"
        name="to"
        [(ngModel)]="to"
        (ngModelChange)="go(1)"
        aria-label="Au"
      />
      <button class="btn" type="submit">Rechercher</button>
    </form>

    <!-- 2. Filtre par statut -->
    <div class="tabs" role="tablist">
      @for (s of statuses; track s.v) {
        <button
          role="tab"
          [class.on]="status() === s.v"
          [attr.aria-selected]="status() === s.v"
          (click)="setStatus(s.v)"
        >
          {{ s.label }}
          @if (s.v && data()) {
            <span class="n">{{ data()!.counts[s.v] || 0 }}</span>
          }
        </button>
      }
    </div>

    <!-- 3. Tableau détaillé avec pagination -->
    <section class="card">
      @if (data(); as d) {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Véhicule</th>
                <th>Parking / Place</th>
                <th>Créneau</th>
                <th>Montant</th>
                <th>Statut</th>
                <th class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of d.results; track r.id) {
                <tr>
                  <td>
                    <b>{{ r.reference }}</b><span class="sub"
                      >le {{ r.created_at | dateFr: 'short' }}</span
                    >
                  </td>
                  <td>
                    {{ r.first_name }} {{ r.last_name
                    }}<span class="sub">{{ r.driver_phone || '—' }}</span>
                  </td>
                  <td>
                    <span class="plate">{{ r.plate }}</span>
                  </td>
                  <td>
                    {{ r.parking.replace('Parking ', '')
                    }}<span class="sub">{{ r.space_code }} · niveau {{ r.level }}</span>
                  </td>
                  <td>
                    {{ r.start_at | dateFr: 'short'
                    }}<span class="sub">{{ r.start_at | hour }} – {{ r.end_at | hour }}</span>
                  </td>
                  <td>
                    <b>{{ r.amount | tnd }}</b>
                  </td>
                  <td><app-status [status]="r.status" /></td>
                  <!-- 4. Confirmer ou refuser en un clic -->
                  <td class="r">
                    @if (r.status === 'pending') {
                      <div class="acts">
                        <button
                          class="btn btn-sm btn-success"
                          (click)="set(r, 'confirmed')"
                          [disabled]="busy() === r.id"
                        >
                          <app-icon name="check" [size]="14" /> Confirmer
                        </button>
                        <button
                          class="btn btn-sm btn-danger"
                          (click)="set(r, 'cancelled')"
                          [disabled]="busy() === r.id"
                        >
                          <app-icon name="x" [size]="14" /> Refuser
                        </button>
                      </div>
                    } @else if (r.status === 'confirmed' && future(r)) {
                      <button
                        class="btn btn-sm btn-ghost"
                        (click)="set(r, 'cancelled')"
                        [disabled]="busy() === r.id"
                      >
                        Annuler
                      </button>
                    } @else {
                      <span class="muted small">—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <app-empty icon="list" text="Aucune réservation pour ces critères." />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pager row-between">
          <span class="muted small"
            >{{ d.total }} réservation(s) · page {{ d.page }} / {{ d.pages }}</span
          >
          <div class="row">
            <button class="btn btn-sm" (click)="go(d.page - 1)" [disabled]="d.page <= 1">
              <app-icon name="chevron-left" [size]="14" /> Précédent
            </button>
            <button class="btn btn-sm" (click)="go(d.page + 1)" [disabled]="d.page >= d.pages">
              Suivant <app-icon name="chevron-right" [size]="14" />
            </button>
          </div>
        </div>
      } @else {
        <app-skeleton variant="table" [count]="8" label="Chargement des réservations…" />
      }
    </section>

    <!-- 5. Rappel : chevauchement impossible -->
    <p class="alert alert-info small note">
      <app-icon name="shield" [size]="18" />
      <span
        >Une même place ne peut jamais être réservée deux fois sur des créneaux qui se chevauchent :
        la règle est garantie par la contrainte <code>EXCLUDE USING gist</code> de PostgreSQL, même
        si deux automobilistes réservent au même instant.</span
      >
    </p>
  </div>`,
  styles: `
    .filters {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
      padding: 0.8rem;
      margin-bottom: 1rem;
      .grow {
        flex: 1;
        min-width: 220px;
      }
      select,
      input[type='date'] {
        width: auto;
      }
    }
    .r {
      text-align: right;
    }
    .acts {
      display: flex;
      gap: 0.35rem;
      justify-content: flex-end;
    }
    .plate {
      font-family: Consolas, monospace;
      font-size: 0.82rem;
      background: #eef2f8;
      padding: 0.15rem 0.4rem;
      border-radius: 5px;
      white-space: nowrap;
    }
    .pager {
      margin-top: 0.9rem;
      flex-wrap: wrap;
    }
    .note {
      margin-top: 1rem;
      align-items: center;
      code {
        background: #fff;
        padding: 0 0.3rem;
        border-radius: 4px;
      }
    }
  `,
})
export class ManagerReservationsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private qp = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly parkings = signal<{ id: number; name: string }[]>([]);
  protected readonly data = signal<Paged<Reservation> | null>(null);
  protected readonly status = signal<string>(this.qp.get('status') ?? '');
  protected readonly busy = signal<number | null>(null);
  protected q = this.qp.get('q') ?? '';
  protected parking: number | null = null;
  protected from = '';
  protected to = '';
  protected statuses = [
    { v: '', label: 'Toutes' },
    { v: 'pending', label: 'En attente' },
    { v: 'confirmed', label: 'Confirmées' },
    { v: 'completed', label: 'Terminées' },
    { v: 'cancelled', label: 'Annulées' },
  ];

  constructor() {
    this.api.myParkings().subscribe((p) => this.parkings.set(p));
    inject(ActivatedRoute).queryParamMap.subscribe((m) => {
      if (m.has('q')) this.q = m.get('q') ?? '';
      this.go(1);
    });
  }

  setStatus(s: string) {
    this.status.set(s);
    this.go(1);
  }

  go(page: number) {
    this.api
      .managerReservations({
        q: this.q,
        parking: this.parking,
        status: this.status(),
        from: this.from,
        to: this.to,
        page,
      })
      .subscribe((d) => this.data.set(d));
  }

  future(r: Reservation) {
    return new Date(r.start_at).getTime() > Date.now();
  }

  set(r: Reservation, status: 'confirmed' | 'cancelled') {
    if (
      status === 'cancelled' &&
      !confirm(`${r.status === 'pending' ? 'Refuser' : 'Annuler'} la réservation ${r.reference} ?`)
    )
      return;
    this.busy.set(r.id);
    this.api.setReservationStatus(r.id, status).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.busy.set(null);
        this.go(this.data()?.page ?? 1);
      },
      error: (e) => {
        this.toast.error(errorMessage(e));
        this.busy.set(null);
      },
    });
  }
}
