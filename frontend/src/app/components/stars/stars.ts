import { Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

/** Note en étoiles (lecture seule ou interactive) */
@Component({
  selector: 'app-stars',
  imports: [Icon],
  template: ` <span
    class="stars"
    [class.interactive]="interactive()"
    role="img"
    [attr.aria-label]="'Note ' + (value() ?? 0) + ' sur 5'"
  >
    @for (i of [1, 2, 3, 4, 5]; track i) {
      @if (interactive()) {
        <button
          type="button"
          (click)="rate.emit(i)"
          [attr.aria-label]="i + ' étoile(s)'"
          [class.on]="i <= (value() ?? 0)"
        >
          <app-icon name="star" [size]="size()" [filled]="i <= (value() ?? 0)" />
        </button>
      } @else {
        <span [class.on]="i <= Math.round(value() ?? 0)"
          ><app-icon name="star" [size]="size()" [filled]="i <= Math.round(value() ?? 0)"
        /></span>
      }
    }
  </span>`,
  styles: `
    .stars {
      display: inline-flex;
      gap: 1px;
      color: #d5dbe6;
    }
    .on {
      color: #f5a524;
    }
    button {
      background: none;
      border: 0;
      padding: 2px;
      cursor: pointer;
      color: #d5dbe6;
      border-radius: 6px;
    }
    button.on {
      color: #f5a524;
    }
    button:hover {
      transform: scale(1.12);
    }
  `,
})
export class Stars {
  readonly value = input<number | null>(0);
  readonly size = input(14);
  readonly interactive = input(false);
  rate = output<number>();
  protected Math = Math;
}
