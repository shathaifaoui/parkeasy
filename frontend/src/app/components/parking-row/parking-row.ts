import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ParkingCard } from '../../core/models';
import { Icon } from '../icon/icon';
import { TndPipe } from '../../pipes/tnd-pipe';
import { FreeBadge } from '../free-badge/free-badge';

/** Carte horizontale des résultats de recherche (comparaison) */
@Component({
  selector: 'app-parking-row',
  imports: [RouterLink, Icon, TndPipe, FreeBadge],
  template: ` @let p = parking();
    <article
      class="row-card card"
      [class.active]="active()"
      (mouseenter)="hover.emit(p.id)"
      (mouseleave)="hover.emit(null)"
    >
      <a
        class="photo"
        [routerLink]="['/parkings', p.id]"
        [queryParams]="query()"
        [style.background-image]="'url(' + (p.photo || '/img/parking-1.svg') + ')'"
        [attr.aria-label]="'Voir ' + p.name"
      ></a>
      <div class="body">
        <div class="row-between top">
          <a class="name" [routerLink]="['/parkings', p.id]" [queryParams]="query()">{{
            p.name
          }}</a>
          @if (showFavorite()) {
            <button
              type="button"
              class="fav"
              [class.on]="favorite()"
              (click)="toggleFavorite.emit(p.id)"
              [attr.aria-label]="favorite() ? 'Retirer des favoris' : 'Ajouter aux favoris'"
            >
              <app-icon name="heart" [size]="18" [filled]="favorite()" />
            </button>
          }
        </div>
        <p class="meta small">
          @if (p.rating) {
            <span class="rating"
              ><app-icon name="star" [size]="12" [filled]="true" /> {{ p.rating }}</span
            >
            <span class="muted">({{ p.reviews }} avis)</span> ·
          }
          @if (p.distance !== null && p.distance !== undefined) {
            <span class="muted"
              ><app-icon name="navigation" [size]="11" /> {{ formatDistance(p.distance) }}</span
            >
            ·
          }
          <span class="muted">{{ p.zone }}</span>
        </p>
        <p class="price">
          <strong>{{ p.hourly_rate | tnd }}</strong><span class="muted">/h</span> · total
          <strong>{{ p.estimated_total | tnd: 2 }}</strong>
        </p>
        <div class="row-between">
          <app-free [free]="p.free_spaces" [closed]="!p.open_on_slot" />
          <a
            class="btn btn-primary btn-sm"
            [routerLink]="['/parkings', p.id]"
            [queryParams]="query()"
            >Voir</a
          >
        </div>
      </div>
    </article>`,
  styles: `
    .row-card {
      display: flex;
      gap: 0.9rem;
      padding: 0.75rem;
      border: 1.5px solid var(--border);
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }
    .row-card.active,
    .row-card:hover {
      border-color: var(--blue);
      box-shadow: 0 0 0 3px var(--blue-100);
    }
    .photo {
      width: 96px;
      flex-shrink: 0;
      border-radius: 10px;
      background-size: cover;
      background-position: center;
      min-height: 96px;
    }
    .body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .name {
      font-weight: 700;
      color: var(--navy);
      text-decoration: none;
    }
    .name:hover {
      color: var(--blue);
    }
    .meta,
    .price {
      margin: 0;
    }
    .price {
      font-size: 0.92rem;
    }
    .rating {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-weight: 700;
      color: var(--star);
    }
    .fav {
      background: none;
      border: 0;
      color: #9aa6b8;
      cursor: pointer;
      padding: 0.2rem;
      border-radius: 8px;
    }
    .fav.on {
      color: var(--red);
    }
    .top {
      align-items: flex-start;
    }
  `,
})
export class ParkingRow {
  readonly parking = input.required<ParkingCard>();
  readonly query = input<Record<string, unknown>>({});
  readonly active = input(false);
  readonly favorite = input(false);
  readonly showFavorite = input(false);
  hover = output<number | null>();
  toggleFavorite = output<number>();
  formatDistance(km: number) {
    return km < 1
      ? `${Math.round(km * 1000)} m`
      : `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
  }
}
