import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ManagerDashboard } from '../../../core/models';
import { AreaChart } from '../../../components/area-chart/area-chart';
import { Icon } from '../../../components/icon/icon';
import { DateFrPipe } from '../../../pipes/date-fr-pipe';
import { HourPipe } from '../../../pipes/hour-pipe';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { ErrorState } from '../../../components/error-state/error-state';
import { StatusBadge } from '../../../components/status-badge/status-badge';
import { TndPipe } from '../../../pipes/tnd-pipe';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    Icon,
    AreaChart,
    StatusBadge,
    TndPipe,
    HourPipe,
    DateFrPipe,
    Skeleton,
    ErrorState,
  ],
  template: ` <div class="page">
    @if (data(); as d) {
      <div class="page-head">
        <div>
          <h1>Bonjour {{ auth.user()?.first_name }} 👋</h1>
          <p>Aperçu de l'activité de vos parkings — {{ today | dateFr: 'day' }}</p>
        </div>
        <!-- 5. Alerte : réservations à confirmer -->
        @if (d.kpi.pending) {
          <div class="alert alert-warning pending">
            <app-icon name="bell" [size]="18" />
            <span
              ><b>{{ d.kpi.pending }} réservation{{ d.kpi.pending > 1 ? 's' : '' }}</b> en attente
              de confirmation</span
            >
            <a
              routerLink="/gestion/reservations"
              [queryParams]="{ status: 'pending' }"
              class="btn btn-primary btn-sm"
              >Traiter</a
            >
          </div>
        }
      </div>

      <!-- 1. Indicateurs du jour -->
      <div class="kpis">
        <div class="kpi">
          <span class="ico"><app-icon name="grid" /></span>
          <div>
            <strong>{{ d.kpi.total_spaces }}</strong><span>Places totales</span>
          </div>
        </div>
        <div class="kpi">
          <span class="ico green"><app-icon name="car" /></span>
          <div>
            <strong>{{ d.kpi.free_now }}</strong><span>Places libres maintenant</span>
          </div>
        </div>
        <div class="kpi">
          <span class="ico teal"><app-icon name="calendar" /></span>
          <div>
            <strong>{{ d.kpi.reservations_today }}</strong><span>Réservations aujourd'hui</span>
          </div>
        </div>
        <div class="kpi">
          <span class="ico orange"><app-icon name="tag" /></span>
          <div>
            <strong>{{ d.kpi.revenue_today | tnd: 0 }}</strong><span>Revenus du jour</span>
          </div>
        </div>
      </div>

      <div class="two">
        <!-- 2. Taux d'occupation -->
        <section class="card">
          <div class="card-title">
            <h2>
              Taux d'occupation
              {{
                period() === 'day'
                  ? "(aujourd'hui)"
                  : period() === 'week'
                    ? '(7 jours)'
                    : '(30 jours)'
              }}
            </h2>
            <div class="segmented" role="group" aria-label="Période du graphique">
              <button
                type="button"
                [class.on]="period() === 'day'"
                [attr.aria-pressed]="period() === 'day'"
                (click)="load('day')"
              >
                Jour
              </button>
              <button
                type="button"
                [class.on]="period() === 'week'"
                [attr.aria-pressed]="period() === 'week'"
                (click)="load('week')"
              >
                Semaine
              </button>
              <button
                type="button"
                [class.on]="period() === 'month'"
                [attr.aria-pressed]="period() === 'month'"
                (click)="load('month')"
              >
                Mois
              </button>
            </div>
          </div>
          <app-area-chart [data]="d.occupancy" />
        </section>

        <!-- 3. Occupation par parking avec seuil d'alerte -->
        <section class="card">
          <div class="card-title">
            <h2>Occupation par parking</h2>
            <span class="muted small">en ce moment</span>
          </div>
          <div class="stack occ">
            @for (p of d.parkings; track p.id) {
              @let rate = p.total ? (p.occupied / p.total) * 100 : 0;
              <div>
                <div class="row-between small">
                  <b>{{ p.name }}</b>
                  @if (p.status !== 'active') {
                    <app-status [status]="p.status" />
                  } @else {
                    <span class="muted">{{ p.occupied }} / {{ p.total }} places</span>
                  }
                </div>
                <div
                  class="progress"
                  [class.danger]="rate >= d.alert_threshold"
                  [class.warn]="rate >= 60 && rate < d.alert_threshold"
                >
                  <span [style.width.%]="rate"></span>
                </div>
              </div>
            }
          </div>
          <p class="muted small">Seuil d'alerte : {{ d.alert_threshold }} % d'occupation</p>
        </section>
      </div>

      <!-- 4. Dernières réservations -->
      <section class="card">
        <div class="card-title">
          <h2>Dernières réservations</h2>
          <a routerLink="/gestion/reservations" class="small strong">Voir tout →</a>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Parking / Place</th>
                <th>Créneau</th>
                <th>Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              @for (r of d.latest; track r.id) {
                <tr>
                  <td>
                    <b>{{ r.reference }}</b>
                  </td>
                  <td>{{ r.first_name[0] }}. {{ r.last_name }}</td>
                  <td>{{ r.parking.replace('Parking ', '') }} / {{ r.space_code }}</td>
                  <td>
                    {{ r.start_at | dateFr: 'short' }}
                    <span class="sub">{{ r.start_at | hour }}–{{ r.end_at | hour }}</span>
                  </td>
                  <td>
                    <b>{{ r.amount | tnd }}</b>
                  </td>
                  <td><app-status [status]="r.status" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    } @else if (failed()) {
      <app-error-state title="Le tableau de bord n'a pas pu être chargé" (retry)="load(period())" />
    } @else {
      <app-skeleton variant="kpi" [count]="4" label="Chargement du tableau de bord…" />
      <app-skeleton variant="card" [count]="2" label="" />
    }
  </div>`,
  styles: `
    .pending {
      align-items: center;
      gap: 0.7rem;
    }
    .kpis {
      margin-bottom: 1rem;
    }
    .two {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
    }
    @media (max-width: 1000px) {
      .two {
        grid-template-columns: 1fr;
      }
    }
    .occ {
      gap: 0.9rem;
      margin-bottom: 0.8rem;
    }
    .occ .progress {
      margin-top: 0.35rem;
    }
    a {
      text-decoration: none;
    }
  `,
})
export class DashboardPage {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  protected readonly data = signal<ManagerDashboard | null>(null);
  protected readonly period = signal<'day' | 'week' | 'month'>('day');
  protected readonly failed = signal(false);
  protected today = new Date();

  constructor() {
    this.load('day');
  }

  load(p: 'day' | 'week' | 'month') {
    this.period.set(p);
    this.failed.set(false);
    this.api.dashboard(p).subscribe({
      next: (d) => this.data.set(d),
      // Un échec lors d'un changement de période garde les données déjà affichées
      error: () => {
        if (!this.data()) this.failed.set(true);
      },
    });
  }
}
