import { Component, computed, input } from '@angular/core';
import { ReservationStatus, STATUS_LABEL } from '../../core/models';

@Component({
  selector: 'app-status',
  template: `<span class="badge" [class]="'badge badge-' + status()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<ReservationStatus | string>();
  readonly label = computed(
    () =>
      STATUS_LABEL[this.status() as ReservationStatus] ??
      (
        { pending: 'En validation', active: 'Actif', suspended: 'Suspendu' } as Record<
          string,
          string
        >
      )[this.status()] ??
      this.status(),
  );
}
