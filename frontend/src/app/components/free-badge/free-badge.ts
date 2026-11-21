import { Component, input } from '@angular/core';

/** Pastille « 32 places libres » (verte) / « Plus que 3 places » (orange) / « Complet » (rouge) */
@Component({
  selector: 'app-free',
  template: ` @if (closed()) {
      <span class="badge badge-cancelled">Fermé sur ce créneau</span>
    } @else if (free() === 0) {
      <span class="badge badge-cancelled">Complet</span>
    } @else if (free() <= 5) {
      <span class="badge badge-pending"
        >Plus que {{ free() }} place{{ free() > 1 ? 's' : '' }}</span
      >
    } @else {
      <span class="badge badge-confirmed">{{ free() }} places libres</span>
    }`,
})
export class FreeBadge {
  readonly free = input.required<number>();
  readonly closed = input(false);
}
