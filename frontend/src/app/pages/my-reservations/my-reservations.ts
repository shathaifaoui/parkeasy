import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { Reservation } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../components/icon/icon';
import { DateFrPipe } from '../../pipes/date-fr-pipe';
import { DurationPipe } from '../../pipes/duration-pipe';
import { Empty } from '../../components/empty-state/empty-state';
import { HourPipe } from '../../pipes/hour-pipe';
import { ErrorState } from '../../components/error-state/error-state';
import { Skeleton } from '../../components/skeleton/skeleton';
import { Modal } from '../../components/modal/modal';
import { Stars } from '../../components/stars/stars';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { TndPipe } from '../../pipes/tnd-pipe';

type Tab = 'upcoming' | 'past' | 'cancelled';

@Component({
  selector: 'app-my-reservations',
  imports: [
    FormsModule,
    RouterLink,
    Icon,
    StatusBadge,
    TndPipe,
    DateFrPipe,
    HourPipe,
    DurationPipe,
    Skeleton,
    ErrorState,
    Empty,
    Modal,
    Stars,
  ],
  templateUrl: './my-reservations.html',
  styleUrl: './my-reservations.scss',
})
export class MyReservationsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  protected readonly tab = signal<Tab>('upcoming');
  protected readonly list = signal<Reservation[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly counts = signal<Record<string, number>>({});
  protected readonly reviewing = signal<Reservation | null>(null);
  protected readonly cancelling = signal<Reservation | null>(null);
  protected readonly rating = signal(5);
  protected comment = '';
  protected tabs: { v: Tab; label: string }[] = [
    { v: 'upcoming', label: 'À venir' },
    { v: 'past', label: 'Passées' },
    { v: 'cancelled', label: 'Annulées' },
  ];

  constructor() {
    this.load();
  }

  select(t: Tab) {
    this.tab.set(t);
    this.load();
  }

  load() {
    this.list.set(null);
    this.failed.set(false);
    this.api.myReservations(this.tab()).subscribe({
      next: (r) => {
        this.list.set(r.results);
        this.counts.set(r.counts);
      },
      error: () => this.failed.set(true),
    });
  }

  /** Onglets accessibles au clavier : flèches gauche/droite, Début, Fin (motif ARIA « tabs ») */
  onTabKey(e: KeyboardEvent) {
    const i = this.tabs.findIndex((t) => t.v === this.tab());
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: this.tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const t = this.tabs[(next + this.tabs.length) % this.tabs.length].v;
    this.select(t);
    document.getElementById('tab-' + t)?.focus();
  }

  canCancel(r: Reservation) {
    return (
      ['pending', 'confirmed'].includes(r.status) && new Date(r.start_at).getTime() > Date.now()
    );
  }

  isOngoing(r: Reservation) {
    const now = Date.now();
    return (
      r.status === 'confirmed' &&
      new Date(r.start_at).getTime() <= now &&
      new Date(r.end_at).getTime() > now
    );
  }

  directions(r: Reservation) {
    return `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`;
  }

  confirmCancel() {
    const r = this.cancelling();
    if (!r) return;
    this.api.cancel(r.id).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.cancelling.set(null);
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  openReview(r: Reservation) {
    this.rating.set(5);
    this.comment = '';
    this.reviewing.set(r);
  }

  sendReview() {
    const r = this.reviewing();
    if (!r) return;
    this.api.review(r.id, { rating: this.rating(), comment: this.comment }).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.reviewing.set(null);
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
