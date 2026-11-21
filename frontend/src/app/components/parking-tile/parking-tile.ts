import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ParkingCard } from '../../core/models';
import { Icon } from '../icon/icon';
import { TndPipe } from '../../pipes/tnd-pipe';
import { FreeBadge } from '../free-badge/free-badge';

/** Carte verticale (accueil, favoris) */
@Component({
  selector: 'app-parking-tile',
  imports: [RouterLink, Icon, TndPipe, FreeBadge],
  template: ` @let p = parking();
    <a class="tile card" [routerLink]="['/parkings', p.id]" [queryParams]="query()">
      <div
        class="photo"
        [style.background-image]="'url(' + (p.photo || '/img/parking-1.svg') + ')'"
      ></div>
      <div class="body">
        <div class="row-between">
          <h3>{{ p.name }}</h3>
          @if (p.rating) {
            <span class="rating"
              ><app-icon name="star" [size]="13" [filled]="true" /> {{ p.rating }}</span
            >
          }
        </div>
        <p class="muted small addr"><app-icon name="pin" [size]="13" /> {{ p.address }}</p>
        <div class="row-between">
          <span
            ><strong class="price">{{ p.hourly_rate | tnd }}</strong>
            <span class="muted small">/ heure</span></span
          >
          <app-free [free]="p.free_spaces" [closed]="!p.open_on_slot" />
        </div>
      </div>
    </a>`,
  styles: `
    .tile {
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      height: 100%;
      transition:
        transform 0.15s,
        box-shadow 0.15s;
    }
    .tile:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lg);
    }
    .photo {
      height: 140px;
      background-size: cover;
      background-position: center;
    }
    .body {
      padding: 0.9rem 1rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    h3 {
      font-size: 1rem;
      margin: 0;
    }
    .addr {
      display: flex;
      gap: 0.3rem;
      align-items: center;
      margin: 0;
    }
    .rating {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-weight: 700;
      font-size: 0.88rem;
      color: var(--star);
    }
    .price {
      font-size: 1.05rem;
    }
  `,
})
export class ParkingTile {
  readonly parking = input.required<ParkingCard>();
  readonly query = input<Record<string, unknown>>({});
}
