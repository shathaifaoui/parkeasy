import { Component, Pipe, PipeTransform, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ParkingCard, ReservationStatus, STATUS_LABEL } from '../core/models';
import { Icon } from './icon';

// ---------------------------------------------------------------- Pipes

/** 2,5 TND · 10,00 TND (decimals = 2 pour les totaux) */
@Pipe({ name: 'tnd' })
export class TndPipe implements PipeTransform {
  transform(v: number | null | undefined, decimals: 0 | 1 | 2 = 1): string {
    if (v === null || v === undefined) return '—';
    const min = decimals === 2 ? 2 : 0;
    const max = decimals === 0 ? 0 : 2;
    return `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max })} TND`;
  }
}

/** « jeu. 20 nov. 2026 » ; format 'short' → 20/11/2026 ; 'day' → jeudi 20 novembre */
@Pipe({ name: 'dateFr' })
export class DateFrPipe implements PipeTransform {
  transform(v: string | Date | null | undefined, format: 'medium' | 'short' | 'day' | 'datetime' = 'medium'): string {
    if (!v) return '—';
    const d = typeof v === 'string' && v.length === 10 ? new Date(v + 'T00:00:00') : new Date(v);
    const opts: Record<string, Intl.DateTimeFormatOptions> = {
      medium: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
      short: { day: '2-digit', month: '2-digit', year: 'numeric' },
      day: { weekday: 'long', day: 'numeric', month: 'long' },
      datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    };
    return d.toLocaleString('fr-FR', opts[format]);
  }
}

/** « 10:00 » */
@Pipe({ name: 'hour' })
export class HourPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    return v ? new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
  }
}

/** Durée entre deux dates : « 4 h », « 1 h 30 » */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(start: string, end: string): string {
    const m = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    const h = Math.floor(m / 60);
    const r = m % 60;
    return h ? `${h} h${r ? ' ' + String(r).padStart(2, '0') : ''}` : `${r} min`;
  }
}

// ---------------------------------------------------------------- Badges

@Component({
  selector: 'app-status',
  template: `<span class="badge" [class]="'badge badge-' + status()">{{ label() }}</span>`,
})
export class StatusBadge {
  status = input.required<ReservationStatus | string>();
  label = computed(() => STATUS_LABEL[this.status() as ReservationStatus] ?? ({ pending: 'En validation', active: 'Actif', suspended: 'Suspendu' } as Record<string, string>)[this.status()] ?? this.status());
}

/** Pastille « 32 places libres » (verte) / « Plus que 3 places » (orange) / « Complet » (rouge) */
@Component({
  selector: 'app-free',
  template: `
    @if (closed()) { <span class="badge badge-cancelled">Fermé sur ce créneau</span> }
    @else if (free() === 0) { <span class="badge badge-cancelled">Complet</span> }
    @else if (free() <= 5) { <span class="badge badge-pending">Plus que {{ free() }} place{{ free() > 1 ? 's' : '' }}</span> }
    @else { <span class="badge badge-confirmed">{{ free() }} places libres</span> }`,
})
export class FreeBadge {
  free = input.required<number>();
  closed = input(false);
}

/** Note en étoiles (lecture seule ou interactive) */
@Component({
  selector: 'app-stars',
  imports: [Icon],
  template: `
    <span class="stars" [class.interactive]="interactive()" role="img" [attr.aria-label]="'Note ' + (value() ?? 0) + ' sur 5'">
      @for (i of [1, 2, 3, 4, 5]; track i) {
        @if (interactive()) {
          <button type="button" (click)="rate.emit(i)" [attr.aria-label]="i + ' étoile(s)'" [class.on]="i <= (value() ?? 0)">
            <app-icon name="star" [size]="size()" [filled]="i <= (value() ?? 0)" />
          </button>
        } @else {
          <span [class.on]="i <= Math.round(value() ?? 0)"><app-icon name="star" [size]="size()" [filled]="i <= Math.round(value() ?? 0)" /></span>
        }
      }
    </span>`,
  styles: `
    .stars { display:inline-flex; gap:1px; color:#d5dbe6; }
    .on { color:#f5a524; }
    button { background:none; border:0; padding:2px; cursor:pointer; color:#d5dbe6; border-radius:6px; }
    button.on { color:#f5a524; }
    button:hover { transform: scale(1.12); }
  `,
})
export class Stars {
  value = input<number | null>(0);
  size = input(14);
  interactive = input(false);
  rate = output<number>();
  protected Math = Math;
}

// ---------------------------------------------------------------- Cartes de parking

/** Carte verticale (accueil, favoris) */
@Component({
  selector: 'app-parking-tile',
  imports: [RouterLink, Icon, TndPipe, FreeBadge],
  template: `
    @let p = parking();
    <a class="tile card" [routerLink]="['/parkings', p.id]" [queryParams]="query()">
      <div class="photo" [style.background-image]="'url(' + (p.photo || '/img/parking-1.svg') + ')'"></div>
      <div class="body">
        <div class="row-between">
          <h3>{{ p.name }}</h3>
          @if (p.rating) { <span class="rating"><app-icon name="star" [size]="13" [filled]="true" /> {{ p.rating }}</span> }
        </div>
        <p class="muted small addr"><app-icon name="pin" [size]="13" /> {{ p.address }}</p>
        <div class="row-between">
          <span><strong class="price">{{ p.hourly_rate | tnd }}</strong> <span class="muted small">/ heure</span></span>
          <app-free [free]="p.free_spaces" [closed]="!p.open_on_slot" />
        </div>
      </div>
    </a>`,
  styles: `
    .tile { display:flex; flex-direction:column; padding:0; overflow:hidden; text-decoration:none; color:inherit; height:100%;
      transition: transform .15s, box-shadow .15s; }
    .tile:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
    .photo { height:140px; background-size:cover; background-position:center; }
    .body { padding:.9rem 1rem 1rem; display:flex; flex-direction:column; gap:.4rem; }
    h3 { font-size:1rem; margin:0; }
    .addr { display:flex; gap:.3rem; align-items:center; margin:0; }
    .rating { display:inline-flex; align-items:center; gap:.2rem; font-weight:700; font-size:.88rem; color:#b7791f; }
    .price { font-size:1.05rem; }
  `,
})
export class ParkingTile {
  parking = input.required<ParkingCard>();
  query = input<Record<string, unknown>>({});
}

/** Carte horizontale des résultats de recherche (comparaison) */
@Component({
  selector: 'app-parking-row',
  imports: [RouterLink, Icon, TndPipe, FreeBadge],
  template: `
    @let p = parking();
    <article class="row-card card" [class.active]="active()" (mouseenter)="hover.emit(p.id)" (mouseleave)="hover.emit(null)">
      <a class="photo" [routerLink]="['/parkings', p.id]" [queryParams]="query()" [style.background-image]="'url(' + (p.photo || '/img/parking-1.svg') + ')'"
         [attr.aria-label]="'Voir ' + p.name"></a>
      <div class="body">
        <div class="row-between top">
          <a class="name" [routerLink]="['/parkings', p.id]" [queryParams]="query()">{{ p.name }}</a>
          @if (showFavorite()) {
            <button type="button" class="fav" [class.on]="favorite()" (click)="toggleFavorite.emit(p.id)"
                    [attr.aria-label]="favorite() ? 'Retirer des favoris' : 'Ajouter aux favoris'">
              <app-icon name="heart" [size]="18" [filled]="favorite()" />
            </button>
          }
        </div>
        <p class="meta small">
          @if (p.rating) { <span class="rating"><app-icon name="star" [size]="12" [filled]="true" /> {{ p.rating }}</span>
            <span class="muted">({{ p.reviews }} avis)</span> · }
          @if (p.distance !== null && p.distance !== undefined) { <span class="muted"><app-icon name="navigation" [size]="11" /> {{ formatDistance(p.distance) }}</span> · }
          <span class="muted">{{ p.zone }}</span>
        </p>
        <p class="price"><strong>{{ p.hourly_rate | tnd }}</strong><span class="muted">/h</span> · total <strong>{{ p.estimated_total | tnd: 2 }}</strong></p>
        <div class="row-between">
          <app-free [free]="p.free_spaces" [closed]="!p.open_on_slot" />
          <a class="btn btn-primary btn-sm" [routerLink]="['/parkings', p.id]" [queryParams]="query()">Voir</a>
        </div>
      </div>
    </article>`,
  styles: `
    .row-card { display:flex; gap:.9rem; padding:.75rem; border:1.5px solid var(--border); transition: border-color .15s, box-shadow .15s; }
    .row-card.active, .row-card:hover { border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-100); }
    .photo { width:96px; flex-shrink:0; border-radius:10px; background-size:cover; background-position:center; min-height:96px; }
    .body { flex:1; min-width:0; display:flex; flex-direction:column; gap:.25rem; }
    .name { font-weight:700; color:var(--navy); text-decoration:none; } .name:hover { color:var(--blue); }
    .meta, .price { margin:0; } .price { font-size:.92rem; }
    .rating { display:inline-flex; align-items:center; gap:.2rem; font-weight:700; color:#b7791f; }
    .fav { background:none; border:0; color:#9aa6b8; cursor:pointer; padding:.2rem; border-radius:8px; }
    .fav.on { color: var(--red); }
    .top { align-items:flex-start; }
  `,
})
export class ParkingRow {
  parking = input.required<ParkingCard>();
  query = input<Record<string, unknown>>({});
  active = input(false);
  favorite = input(false);
  showFavorite = input(false);
  hover = output<number | null>();
  toggleFavorite = output<number>();
  formatDistance(km: number) {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
  }
}

// ---------------------------------------------------------------- Divers

@Component({
  selector: 'app-loader',
  template: `<div class="loader" role="status"><span></span><span></span><span></span><p class="sr-only">Chargement…</p></div>`,
  styles: `.loader { display:flex; gap:.4rem; justify-content:center; padding:3rem 0; }
    span { width:.65rem; height:.65rem; border-radius:50%; background:var(--blue); animation:b 1s infinite ease-in-out; }
    span:nth-child(2) { animation-delay:.15s } span:nth-child(3) { animation-delay:.3s }
    @keyframes b { 0%,80%,100% { transform:scale(.4); opacity:.4 } 40% { transform:scale(1); opacity:1 } }`,
})
export class Loader {}

@Component({
  selector: 'app-empty',
  imports: [Icon],
  template: `<div class="empty"><span class="ico"><app-icon [name]="icon()" [size]="26" /></span><p>{{ text() }}</p><ng-content /></div>`,
  styles: `.empty { text-align:center; padding:2.5rem 1rem; color:var(--muted); }
    .ico { display:inline-grid; place-items:center; width:56px; height:56px; border-radius:16px; background:var(--blue-50); color:var(--blue); margin-bottom:.6rem; }
    p { margin:0 0 .75rem; }`,
})
export class Empty {
  icon = input('info');
  text = input('Aucun élément');
}

/** Fenêtre modale accessible */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div class="modal card" role="dialog" aria-modal="true" [attr.aria-label]="title()">
      <header class="row-between">
        <h2>{{ title() }}</h2>
        <button type="button" class="btn btn-ghost btn-icon" (click)="close.emit()" aria-label="Fermer"><app-icon name="x" /></button>
      </header>
      <ng-content />
    </div>`,
  styles: `
    :host { position:fixed; inset:0; z-index:300; display:grid; place-items:center; padding:1rem; }
    .backdrop { position:absolute; inset:0; background:rgb(16 41 74 / 45%); }
    .modal { position:relative; width:min(560px, 100%); max-height:90vh; overflow:auto; padding:1.4rem; animation: pop .18s ease-out; }
    h2 { margin:0; font-size:1.2rem; }
    header { margin-bottom:1rem; }
    @keyframes pop { from { transform: scale(.96); opacity:0 } }
  `,
  host: { '(document:keydown.escape)': 'close.emit()' },
})
export class Modal {
  title = input('');
  close = output<void>();
}
