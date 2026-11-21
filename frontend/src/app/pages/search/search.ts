import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { ParkingCard } from '../../core/models';
import { SearchState } from '../../core/search-state.service';
import { ToastService } from '../../core/toast.service';
import { Icon, amenityIcon } from '../../components/icon/icon';
import { ParkingMap } from '../../components/parking-map/parking-map';
import { SearchForm } from '../../components/search-form/search-form';
import { DateFrPipe } from '../../pipes/date-fr-pipe';
import { Empty } from '../../components/empty-state/empty-state';
import { ErrorState } from '../../components/error-state/error-state';
import { Skeleton } from '../../components/skeleton/skeleton';
import { ParkingRow } from '../../components/parking-row/parking-row';

@Component({
  selector: 'app-search',
  imports: [
    FormsModule,
    Icon,
    SearchForm,
    ParkingMap,
    ParkingRow,
    Skeleton,
    ErrorState,
    Empty,
    DateFrPipe,
  ],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchPage {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  protected state = inject(SearchState);

  protected readonly zones = toSignal(this.api.zones$, { initialValue: [] });
  protected readonly amenities = toSignal(this.api.amenities$, { initialValue: [] });
  protected amenityIcon = amenityIcon;

  // Filtres (appliqués à la demande)
  protected readonly maxPrice = signal(6);
  protected readonly onlyAvailable = signal(true);
  protected readonly selectedAmenities = signal<number[]>([]);
  protected readonly sort = signal<'price' | 'rating' | 'places' | 'distance'>('price');
  protected readonly q = signal('');

  protected readonly results = signal<ParkingCard[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly editing = signal(false);
  protected readonly showFilters = signal(false);
  protected readonly hovered = signal<number | null>(null);
  protected readonly position = signal<[number, number] | null>(null);
  protected readonly favorites = signal<Set<number>>(new Set());

  protected readonly zoneLabel = computed(() => {
    const z = this.zones().find((x) => x.id === this.state.zone());
    return z ? `${z.city}, ${z.name}` : this.q() ? `« ${this.q()} »` : 'Toutes les zones';
  });
  protected readonly durationLabel = computed(() => {
    const m = this.state.minutes();
    return `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) : ''}`;
  });
  protected readonly navQuery = computed(() => this.state.toQuery());
  protected readonly activeFilters = computed(
    () =>
      (this.maxPrice() < 6 ? 1 : 0) +
      this.selectedAmenities().length +
      (this.onlyAvailable() ? 1 : 0),
  );

  constructor() {
    this.route.queryParamMap.subscribe((qp) => {
      this.state.fromQuery(qp);
      this.q.set(qp.get('q') ?? '');
      this.load();
    });
    if (this.auth.isDriver())
      this.api.favorites().subscribe((f) => this.favorites.set(new Set(f.map((p) => p.id))));
  }

  load() {
    if (!this.state.valid()) return;
    this.loading.set(true);
    this.failed.set(false);
    const pos = this.position();
    this.api
      .search({
        ...this.state.slot(),
        zone: this.state.zone(),
        q: this.q() || null,
        maxPrice: this.maxPrice() < 6 ? this.maxPrice() : null,
        available: this.onlyAvailable() ? 1 : null,
        amenities: this.selectedAmenities().join(',') || null,
        sort: this.sort(),
        lat: pos?.[0],
        lng: pos?.[1],
      })
      .subscribe({
        next: (r) => {
          this.results.set(r.results);
          this.loading.set(false);
        },
        error: (e) => {
          // Première recherche en échec : état d'erreur avec « Réessayer » ; sinon on garde les résultats affichés
          if (!this.results()) this.failed.set(true);
          else this.toast.error(errorMessage(e));
          this.loading.set(false);
        },
      });
  }

  toggleAmenity(id: number, on: boolean) {
    this.selectedAmenities.update((l) => (on ? [...l, id] : l.filter((x) => x !== id)));
  }

  apply() {
    this.showFilters.set(false);
    this.load();
  }

  clearFilters() {
    this.maxPrice.set(6);
    this.onlyAvailable.set(false);
    this.selectedAmenities.set([]);
    this.load();
  }

  clearQuery() {
    this.router.navigate([], { queryParams: { q: null }, queryParamsHandling: 'merge' });
  }

  onSearched() {
    this.editing.set(false);
    this.router.navigate([], { queryParams: { ...this.state.toQuery(), q: null } });
  }

  setSort(v: 'price' | 'rating' | 'places' | 'distance') {
    if (v === 'distance' && !this.position()) return this.locate();
    this.sort.set(v);
    this.load();
  }

  /** « Autour de moi » : géolocalisation du navigateur, tri par distance */
  locate() {
    if (!navigator.geolocation)
      return this.toast.error("La géolocalisation n'est pas disponible sur ce navigateur.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.position.set([p.coords.latitude, p.coords.longitude]);
        this.sort.set('distance');
        this.load();
      },
      () =>
        this.toast.error('Position refusée : autorisez la localisation pour trier par distance.'),
      { timeout: 8000 },
    );
  }

  scrollTo(id: number) {
    this.hovered.set(id);
    document.getElementById(`res-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** Favori optimiste : le cœur change immédiatement, puis revient en arrière si l'API refuse */
  toggleFavorite(id: number) {
    const on = !this.favorites().has(id);
    const flip = (value: boolean) =>
      this.favorites.update((s) => {
        const n = new Set(s);
        if (value) n.add(id);
        else n.delete(id);
        return n;
      });
    flip(on);
    this.api.setFavorite(id, on).subscribe({
      next: () => this.toast.success(on ? 'Ajouté à vos favoris' : 'Retiré de vos favoris'),
      error: (e) => {
        flip(!on);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
