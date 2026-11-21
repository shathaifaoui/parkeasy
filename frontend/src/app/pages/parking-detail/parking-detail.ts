import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { ParkingDetail } from '../../core/models';
import { SearchState, ymd } from '../../core/search-state.service';
import { ToastService } from '../../core/toast.service';
import { Icon, amenityIcon } from '../../components/icon/icon';
import { DateFrPipe } from '../../pipes/date-fr-pipe';
import { Empty } from '../../components/empty-state/empty-state';
import { FreeBadge } from '../../components/free-badge/free-badge';
import { Skeleton } from '../../components/skeleton/skeleton';
import { ErrorState } from '../../components/error-state/error-state';
import { Stars } from '../../components/stars/stars';
import { TndPipe } from '../../pipes/tnd-pipe';

@Component({
  selector: 'app-parking-detail',
  imports: [
    FormsModule,
    RouterLink,
    Icon,
    TndPipe,
    FreeBadge,
    Stars,
    Skeleton,
    ErrorState,
    Empty,
    DateFrPipe,
  ],
  templateUrl: './parking-detail.html',
  styleUrl: './parking-detail.scss',
})
export class ParkingDetailPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  protected state = inject(SearchState);

  readonly id = input.required<string>();
  /** Critères éventuellement transmis dans l'URL depuis la recherche */
  readonly date = input<string>();
  readonly start = input<string>();
  readonly end = input<string>();

  protected readonly parking = signal<ParkingDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly photo = signal(0);
  protected today = ymd(new Date());
  protected amenityIcon = amenityIcon;

  protected readonly levelsLabel = computed(() => {
    const p = this.parking();
    if (!p) return '';
    const n = p.levels.length;
    return `${n} niveau${n > 1 ? 'x' : ''} • ${p.total_spaces} places`;
  });
  protected readonly hoursLabel = computed(() => {
    const p = this.parking();
    return !p ? '' : p.open_24h ? 'Ouvert 24h/24' : `Ouvert ${p.opening_time} – ${p.closing_time}`;
  });

  constructor() {
    effect(() => {
      const [d, s, e] = [this.date(), this.start(), this.end()];
      untracked(() => this.state.set({ date: d, start: s, end: e }));
    });
    // Recharge le détail (places libres, total) à chaque changement de créneau
    let timer: ReturnType<typeof setTimeout>;
    effect(() => {
      const id = Number(this.id());
      const slot = this.state.valid() ? this.state.slot() : undefined;
      clearTimeout(timer);
      timer = setTimeout(() => this.load(id, slot), 200);
    });
  }

  load(id: number, slot?: { start: string; end: string }) {
    this.failed.set(false);
    this.api.parking(id, slot).subscribe({
      next: (p) => this.parking.set(p),
      error: (e: HttpErrorResponse) => {
        // 404 : parking inexistant (message définitif) ; autre erreur : possibilité de réessayer
        if (e.status === 404 || e.status === 400)
          this.error.set(errorMessage(e, 'Parking introuvable'));
        else if (!this.parking()) this.failed.set(true);
      },
    });
  }

  retry() {
    this.load(Number(this.id()), this.state.valid() ? this.state.slot() : undefined);
  }

  toggleFavorite() {
    const p = this.parking();
    if (!p) return;
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/connexion'], { queryParams: { retour: this.router.url } });
      return;
    }
    this.api.setFavorite(p.id, !p.is_favorite).subscribe({
      next: (r) => {
        this.parking.set({ ...p, is_favorite: r.is_favorite });
        this.toast.success(r.is_favorite ? 'Ajouté à vos favoris' : 'Retiré de vos favoris');
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  reserve() {
    const p = this.parking();
    if (!p) return;
    if (!this.state.valid())
      return this.toast.error("L'heure de départ doit être après l'heure d'arrivée.");
    if (this.state.isPast()) return this.toast.error("L'heure d'arrivée est déjà passée.");
    const url = this.router.createUrlTree(['/reserver', p.id], {
      queryParams: this.state.toQuery(),
    });
    if (!this.auth.isLoggedIn()) {
      this.toast.info('Connectez-vous pour réserver : votre créneau est conservé.');
      this.router.navigate(['/connexion'], {
        queryParams: { retour: this.router.serializeUrl(url) },
      });
    } else {
      this.router.navigateByUrl(url);
    }
  }
}
