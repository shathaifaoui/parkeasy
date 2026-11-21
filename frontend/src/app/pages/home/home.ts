import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SearchState } from '../../core/search-state.service';
import { Icon } from '../../components/icon/icon';
import { SearchForm } from '../../components/search-form/search-form';
import { ErrorState } from '../../components/error-state/error-state';
import { Skeleton } from '../../components/skeleton/skeleton';
import { ParkingCard } from '../../core/models';
import { ParkingTile } from '../../components/parking-tile/parking-tile';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, SearchForm, ParkingTile, Skeleton, ErrorState],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  protected state = inject(SearchState);

  protected readonly stats = toSignal(this.api.stats());
  // Parkings populaires : les mieux notés de Tunis, disponibilités sur le créneau en cours
  protected readonly popular = signal<ParkingCard[] | null>(null);
  protected readonly popularFailed = signal(false);

  protected steps = [
    { icon: 'search', title: 'Rechercher', text: 'Zone, date et durée' },
    { icon: 'grid', title: 'Comparer', text: 'Tarifs, services, places' },
    { icon: 'check', title: 'Réserver', text: 'Place et créneau garantis' },
    { icon: 'list', title: 'Suivre', text: 'Depuis votre espace' },
  ];

  constructor() {
    this.loadPopular();
  }

  loadPopular() {
    this.popularFailed.set(false);
    this.popular.set(null);
    this.api.search({ city: 'Tunis', sort: 'rating', limit: 3, ...this.state.slot() }).subscribe({
      next: (r) => this.popular.set(r.results),
      error: () => this.popularFailed.set(true),
    });
  }
}
