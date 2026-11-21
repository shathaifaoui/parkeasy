import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { AdminParking, AdminStats, AdminUser, ROLE_LABEL } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../components/icon/icon';
import { DateFrPipe } from '../../pipes/date-fr-pipe';
import { Empty } from '../../components/empty-state/empty-state';
import { Skeleton } from '../../components/skeleton/skeleton';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { TndPipe } from '../../pipes/tnd-pipe';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink, Icon, StatusBadge, TndPipe, DateFrPipe, Skeleton, Empty],
  template: ` <div class="page">
    <div class="page-head">
      <div>
        <h1>Supervision de la plateforme</h1>
        <p>Validez les nouveaux parkings et gérez les comptes.</p>
      </div>
      <button class="btn btn-sm" (click)="refresh()">
        <app-icon name="refresh" [size]="15" /> Actualiser
      </button>
    </div>

    <!-- 1. Indicateurs globaux -->
    @if (stats(); as s) {
      <div class="kpis">
        <div class="kpi">
          <span class="ico"><app-icon name="users" /></span>
          <div>
            <strong>{{ s.drivers }}</strong><span>Automobilistes</span>
          </div>
        </div>
        <div class="kpi">
          <span class="ico teal"><app-icon name="building" /></span>
          <div>
            <strong>{{ s.managers }}</strong><span>Gestionnaires</span>
          </div>
        </div>
        <div class="kpi">
          <span class="ico green"><app-icon name="parking" /></span>
          <div>
            <strong>{{ s.parkings_active }}</strong><span
              >Parkings actifs · {{ s.spaces }} places</span
            >
          </div>
        </div>
        <div class="kpi">
          <span class="ico orange"><app-icon name="alert" /></span>
          <div>
            <strong>{{ s.parkings_pending }}</strong><span>Parkings à valider</span>
          </div>
        </div>
        <div class="kpi">
          <span class="ico"><app-icon name="calendar" /></span>
          <div>
            <strong>{{ s.reservations_30d.toLocaleString('fr-FR') }}</strong><span
              >Réservations (30 j)</span
            >
          </div>
        </div>
        <div class="kpi">
          <span class="ico green"><app-icon name="wallet" /></span>
          <div>
            <strong>{{ s.revenue_30d | tnd: 0 }}</strong><span
              >Volume (30 j) · ★ {{ s.rating }}</span
            >
          </div>
        </div>
        <a class="kpi kpi-link" routerLink="/admin/messages">
          <span class="ico orange"><app-icon name="bell" /></span>
          <div>
            <strong>{{ s.messages_new }}</strong><span
              >Message{{ s.messages_new > 1 ? 's' : '' }} à traiter</span
            >
          </div>
        </a>
      </div>
    }

    <div class="cols">
      <!-- 2. Validation des nouveaux parkings -->
      <section class="card">
        <div class="card-title">
          <h2>Parkings</h2>
          <div class="segmented" role="group" aria-label="Filtrer les parkings">
            <button
              type="button"
              [class.on]="pStatus() === 'pending'"
              [attr.aria-pressed]="pStatus() === 'pending'"
              (click)="loadParkings('pending')"
            >
              À valider
            </button>
            <button
              type="button"
              [class.on]="pStatus() === 'active'"
              [attr.aria-pressed]="pStatus() === 'active'"
              (click)="loadParkings('active')"
            >
              Actifs
            </button>
            <button
              type="button"
              [class.on]="pStatus() === 'suspended'"
              [attr.aria-pressed]="pStatus() === 'suspended'"
              (click)="loadParkings('suspended')"
            >
              Suspendus
            </button>
          </div>
        </div>
        @if (parkings(); as list) {
          <div class="stack">
            @for (p of list; track p.id) {
              <article class="pk">
                <div
                  class="ph"
                  [style.background-image]="'url(' + (p.photo || '/img/parking-1.svg') + ')'"
                ></div>
                <div class="grow">
                  <div class="row">
                    <b>{{ p.name }}</b><app-status [status]="p.status" />
                  </div>
                  <span class="muted small">{{ p.address }} · {{ p.zone }}, {{ p.city }}</span>
                  <!-- 3. Contrôle des informations -->
                  <span class="small"
                    >{{ p.hourly_rate | tnd }}/h · {{ p.spaces }} places ·
                    {{ p.open_24h ? '24h/24' : p.opening_time + '–' + p.closing_time }}</span
                  >
                  <span class="small muted"
                    >Gestionnaire : {{ p.manager }} ({{ p.manager_email }}) · créé le
                    {{ p.created_at | dateFr: 'short' }}</span
                  >
                  @if (p.amenities.length) {
                    <span class="small muted">{{ p.amenities.join(' · ') }}</span>
                  }
                </div>
                <div class="acts">
                  @if (p.status !== 'active') {
                    <button class="btn btn-sm btn-success" (click)="setParking(p, 'active')">
                      <app-icon name="check" [size]="14" />
                      {{ p.status === 'pending' ? 'Valider' : 'Réactiver' }}
                    </button>
                  }
                  @if (p.status !== 'suspended') {
                    <button class="btn btn-sm btn-danger" (click)="setParking(p, 'suspended')">
                      {{ p.status === 'pending' ? 'Refuser' : 'Suspendre' }}
                    </button>
                  }
                  @if (p.status === 'active') {
                    <a class="btn btn-sm btn-ghost" [routerLink]="['/parkings', p.id]">Voir</a>
                  }
                </div>
              </article>
            } @empty {
              <app-empty
                icon="check"
                [text]="
                  pStatus() === 'pending'
                    ? 'Aucun parking en attente de validation.'
                    : 'Aucun parking.'
                "
              />
            }
          </div>
        } @else {
          <app-skeleton variant="table" [count]="5" label="Chargement…" />
        }
      </section>

      <!-- 4. Gestion des comptes -->
      <section class="card">
        <div class="card-title"><h2>Comptes</h2></div>
        <form class="ufilters" (ngSubmit)="loadUsers()">
          <div class="input-icon grow">
            <app-icon name="search" [size]="16" /><input
              class="input"
              name="q"
              [(ngModel)]="uq"
              placeholder="Nom ou e-mail"
              aria-label="Rechercher un compte"
            />
          </div>
          <select
            class="input"
            name="role"
            [(ngModel)]="urole"
            (ngModelChange)="loadUsers()"
            aria-label="Rôle"
          >
            <option value="">Tous les rôles</option>
            <option value="driver">Automobilistes</option>
            <option value="manager">Gestionnaires</option>
            <option value="admin">Administrateurs</option>
          </select>
        </form>
        @if (users(); as list) {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Activité</th>
                  <th>Statut</th>
                  <th><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (u of list; track u.id) {
                  <tr>
                    <td>
                      {{ u.first_name }} {{ u.last_name }}<span class="sub">{{ u.email }}</span>
                    </td>
                    <td>{{ roleLabel[u.role] }}</td>
                    <td class="small">
                      {{
                        u.role === 'manager'
                          ? u.parkings + ' parking(s)'
                          : u.role === 'driver'
                            ? u.reservations + ' réserv.'
                            : '—'
                      }}
                    </td>
                    <td>
                      <span class="badge" [class]="'badge badge-' + u.status">{{
                        u.status === 'active' ? 'Actif' : 'Suspendu'
                      }}</span>
                    </td>
                    <td class="r">
                      @if (u.role !== 'admin') {
                        @if (u.status === 'active') {
                          <button class="btn btn-sm btn-danger" (click)="setUser(u, 'suspended')">
                            Suspendre
                          </button>
                        } @else {
                          <button class="btn btn-sm btn-success" (click)="setUser(u, 'active')">
                            Réactiver
                          </button>
                        }
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <app-skeleton variant="table" [count]="5" label="Chargement…" />
        }
      </section>
    </div>
  </div>`,
  styles: `
    .kpi-link {
      text-decoration: none;
      color: inherit;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }
    .kpi-link:hover {
      border-color: var(--blue);
      box-shadow: 0 0 0 3px var(--blue-100);
    }
    .kpis {
      margin-bottom: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    }
    td.small {
      white-space: nowrap;
    }
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 1100px) {
      .cols {
        grid-template-columns: 1fr;
      }
    }
    .pk {
      display: flex;
      gap: 0.9rem;
      padding: 0.8rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
      .grow {
        flex: 1;
        min-width: 200px;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
    }
    .ph {
      width: 78px;
      height: 62px;
      border-radius: 9px;
      background-size: cover;
      flex-shrink: 0;
    }
    .acts {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .ufilters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.8rem;
      flex-wrap: wrap;
      .grow {
        flex: 1;
        min-width: 180px;
      }
      select {
        width: auto;
      }
    }
    .r {
      text-align: right;
    }
  `,
})
export class AdminPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected roleLabel = ROLE_LABEL;

  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly parkings = signal<AdminParking[] | null>(null);
  protected readonly users = signal<AdminUser[] | null>(null);
  protected readonly pStatus = signal<'pending' | 'active' | 'suspended'>('pending');
  protected uq = '';
  protected urole = '';

  constructor() {
    this.refresh();
  }

  refresh() {
    this.api.adminStats().subscribe((s) => this.stats.set(s));
    this.loadParkings(this.pStatus());
    this.loadUsers();
  }

  loadParkings(s: 'pending' | 'active' | 'suspended') {
    this.pStatus.set(s);
    this.parkings.set(null);
    this.api.adminParkings(s).subscribe((l) => this.parkings.set(l));
  }

  loadUsers() {
    this.api.adminUsers({ q: this.uq, role: this.urole }).subscribe((l) => this.users.set(l));
  }

  setParking(p: AdminParking, status: 'active' | 'suspended') {
    if (
      status === 'suspended' &&
      !confirm(
        `${p.status === 'pending' ? 'Refuser' : 'Suspendre'} « ${p.name} » ? Il ne sera plus visible des automobilistes.`,
      )
    )
      return;
    this.api.setParkingStatus(p.id, status).subscribe({
      next: (r) => {
        this.toast.success(r.message);
        this.refresh();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  setUser(u: AdminUser, status: 'active' | 'suspended') {
    if (
      status === 'suspended' &&
      !confirm(
        `Suspendre le compte de ${u.first_name} ${u.last_name} ? Il ne pourra plus se connecter.`,
      )
    )
      return;
    this.api.setUserStatus(u.id, status).subscribe({
      next: (r) => {
        this.toast.success(r.message);
        this.loadUsers();
        this.api.adminStats().subscribe((s) => this.stats.set(s));
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
