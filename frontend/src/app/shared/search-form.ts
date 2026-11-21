import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Zone } from '../core/models';
import { SearchState, ymd } from '../core/search-state.service';
import { Icon } from './icon';

/** Formulaire de recherche : zone, date, arrivée, départ (accueil, résultats, mobile) */
@Component({
  selector: 'app-search-form',
  imports: [FormsModule, Icon],
  template: `
    <form class="sf" [class.hero]="variant() === 'hero'" (ngSubmit)="submit()" role="search" aria-label="Rechercher une place">
      <div class="field where">
        <label for="sf-zone">Où ?</label>
        <div class="input-icon">
          <app-icon name="pin" [size]="16" />
          <select id="sf-zone" class="input" name="zone" [ngModel]="state.zone()" (ngModelChange)="state.zone.set($event)">
            <option [ngValue]="null">Toutes les zones</option>
            @for (city of cities(); track city.name) {
              <optgroup [label]="city.name">
                @for (z of city.zones; track z.id) { <option [ngValue]="z.id">{{ z.city }}, {{ z.name }}</option> }
              </optgroup>
            }
          </select>
        </div>
      </div>
      <div class="field">
        <label for="sf-date">Date</label>
        <div class="input-icon"><app-icon name="calendar" [size]="16" />
          <input id="sf-date" class="input" type="date" name="date" [min]="today" [ngModel]="state.date()" (ngModelChange)="state.date.set($event)" required /></div>
      </div>
      <div class="field">
        <label for="sf-start">Arrivée</label>
        <div class="input-icon"><app-icon name="clock" [size]="16" />
          <input id="sf-start" class="input" type="time" step="900" name="start" [ngModel]="state.start()" (ngModelChange)="onStart($event)" required /></div>
      </div>
      <div class="field">
        <label for="sf-end">Départ</label>
        <div class="input-icon"><app-icon name="clock" [size]="16" />
          <input id="sf-end" class="input" type="time" step="900" name="end" [ngModel]="state.end()" (ngModelChange)="state.end.set($event)" required /></div>
      </div>
      <button class="btn btn-primary submit" type="submit"><app-icon name="search" [size]="16" /> {{ label() }}</button>
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
    </form>`,
  styles: `
    .sf { display:grid; grid-template-columns: 1.6fr 1fr .8fr .8fr auto; gap:.7rem; align-items:end; }
    .sf.hero { background:#fff; padding:1rem; border-radius:16px; box-shadow: var(--shadow-lg); }
    .sf > * { min-width:0; }
    .submit { min-height:42px; }
    .err { grid-column: 1 / -1; margin:0; color: var(--red); font-weight:600; font-size:.88rem; }
    @media (max-width: 900px) { .sf { grid-template-columns: 1fr 1fr; } .where, .submit { grid-column: 1 / -1; } }
  `,
})
export class SearchForm {
  protected state = inject(SearchState);
  private api = inject(ApiService);
  private router = inject(Router);

  variant = input<'hero' | 'compact'>('hero');
  label = input('Rechercher');
  /** Si fourni, le parent gère la soumission ; sinon navigation vers /parkings */
  searched = output<void>();
  navigate = input(true);

  protected today = ymd(new Date());
  protected error = signal('');
  private zones = toSignal(this.api.zones$, { initialValue: [] });
  protected cities = computed(() => {
    const map = new Map<string, Zone[]>();
    for (const z of this.zones()) map.set(z.city, [...(map.get(z.city) ?? []), z]);
    return [...map.entries()].map(([name, zones]) => ({ name, zones }));
  });

  /** Garde une durée cohérente quand on avance l'heure d'arrivée */
  onStart(v: string) {
    const prevMinutes = this.state.minutes();
    this.state.start.set(v);
    if (this.state.minutes() <= 0 && v) {
      const [h, m] = v.split(':').map(Number);
      const end = Math.min(23 * 60 + 45, h * 60 + m + Math.max(60, prevMinutes > 0 ? prevMinutes : 120));
      this.state.end.set(`${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`);
    }
  }

  submit() {
    if (!this.state.valid()) return this.error.set("L'heure de départ doit être après l'heure d'arrivée.");
    if (this.state.isPast()) return this.error.set("L'heure d'arrivée est déjà passée.");
    this.error.set('');
    this.searched.emit();
    if (this.navigate()) this.router.navigate(['/parkings'], { queryParams: this.state.toQuery() });
  }
}
