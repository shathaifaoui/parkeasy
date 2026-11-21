import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ParkingCard } from '../../core/models';
import { SearchState } from '../../core/search-state.service';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../components/icon/icon';
import { DateFrPipe } from '../../pipes/date-fr-pipe';
import { Empty } from '../../components/empty-state/empty-state';
import { ErrorState } from '../../components/error-state/error-state';
import { Skeleton } from '../../components/skeleton/skeleton';
import { errorMessage } from '../../core/auth.interceptor';
import { ParkingTile } from '../../components/parking-tile/parking-tile';

@Component({
  selector: 'app-favorites',
  imports: [RouterLink, Icon, ParkingTile, Skeleton, ErrorState, Empty, DateFrPipe],
  template: ` <div class="page">
    <div class="page-head">
      <div>
        <h1>Mes parkings favoris</h1>
        <p>Retrouvez en un clic les parkings que vous utilisez souvent.</p>
      </div>
    </div>
    @if (failed()) {
      <app-error-state title="Vos favoris n'ont pas pu être chargés" (retry)="load()" />
    } @else if (list(); as items) {
      <h2 class="sr-only">Liste de vos parkings favoris</h2>
      <div class="grid fade-in">
        @for (p of items; track p.id) {
          <div class="fav">
            <app-parking-tile [parking]="p" [query]="state.toQuery()" />
            <div class="row-between bar">
              <span class="muted small">Ajouté le {{ p.added_at | dateFr: 'short' }}</span>
              <button class="btn btn-sm btn-ghost remove" (click)="remove(p)">
                <app-icon name="heart" [size]="15" [filled]="true" /> Retirer
              </button>
            </div>
          </div>
        } @empty {
          <div class="card full">
            <app-empty
              icon="heart"
              text="Vous n'avez pas encore de favori. Ajoutez-en depuis la fiche d'un parking."
            >
              <a routerLink="/parkings" class="btn btn-sm btn-primary"
                >Rechercher un parking</a
              ></app-empty
            >
          </div>
        }
      </div>
    } @else {
      <app-skeleton variant="tile" [count]="3" label="Chargement de vos favoris…" />
    }
  </div>`,
  styles: `
    .bar {
      padding: 0.4rem 0.2rem 0;
    }
    .remove {
      color: var(--red);
    }
    .full {
      grid-column: 1 / -1;
    }
  `,
})
export class FavoritesPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected state = inject(SearchState);
  protected readonly list = signal<ParkingCard[] | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    this.load();
  }

  load() {
    this.failed.set(false);
    this.list.set(null);
    this.api
      .favorites()
      .subscribe({ next: (l) => this.list.set(l), error: () => this.failed.set(true) });
  }

  /** Retrait optimiste : la carte disparaît tout de suite et revient si l'API refuse */
  remove(p: ParkingCard) {
    const before = this.list();
    this.list.update((l) => (l ?? []).filter((x) => x.id !== p.id));
    this.api.setFavorite(p.id, false).subscribe({
      next: () => this.toast.info(`${p.name} retiré de vos favoris`),
      error: (e) => {
        this.list.set(before);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
