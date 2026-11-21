import { Component, computed, input } from '@angular/core';

/**
 * Squelettes de chargement : reprennent la forme du contenu attendu
 * (cartes, lignes de résultats, tableau, indicateurs) pour éviter les sauts de mise en page.
 */
@Component({
  selector: 'app-skeleton',
  template: ` <div class="sk" [class]="'sk sk-' + variant()" role="status" aria-busy="true">
    <span class="sr-only">{{ label() }}</span>
    @for (i of items(); track i) {
      @switch (variant()) {
        @case ('tile') {
          <div class="card tile" aria-hidden="true">
            <div class="b photo"></div>
            <div class="pad">
              <div class="b l70"></div>
              <div class="b l90 sm"></div>
              <div class="b l40"></div>
            </div>
          </div>
        }
        @case ('row') {
          <div class="card row" aria-hidden="true">
            <div class="b thumb"></div>
            <div class="grow">
              <div class="b l50"></div>
              <div class="b l80 sm"></div>
              <div class="b l60 sm"></div>
              <div class="b l30"></div>
            </div>
          </div>
        }
        @case ('kpi') {
          <div class="kpi-sk" aria-hidden="true">
            <div class="b ico"></div>
            <div class="grow">
              <div class="b l40 big"></div>
              <div class="b l70 sm"></div>
            </div>
          </div>
        }
        @case ('table') {
          <div class="trow" aria-hidden="true">
            <div class="b l20"></div>
            <div class="b l30"></div>
            <div class="b l15"></div>
            <div class="b l20"></div>
          </div>
        }
        @default {
          <div class="card block" aria-hidden="true">
            <div class="b l40"></div>
            <div class="b l90 sm"></div>
            <div class="b l80 sm"></div>
            <div class="b l60 sm"></div>
          </div>
        }
      }
    }
  </div>`,
  styleUrl: './skeleton.scss',
})
export class Skeleton {
  readonly variant = input<'tile' | 'row' | 'kpi' | 'table' | 'card'>('card');
  readonly count = input(3);
  readonly label = input('Chargement en cours…');
  protected readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
