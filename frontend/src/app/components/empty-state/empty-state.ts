import { Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-empty',
  imports: [Icon],
  template: `<div class="empty">
    <span class="ico"><app-icon [name]="icon()" [size]="26" /></span>
    <p>{{ text() }}</p>
    <ng-content />
  </div>`,
  styles: `
    .empty {
      text-align: center;
      padding: 2.5rem 1rem;
      color: var(--muted);
    }
    .ico {
      display: inline-grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: var(--blue-50);
      color: var(--blue);
      margin-bottom: 0.6rem;
    }
    p {
      margin: 0 0 0.75rem;
    }
  `,
})
export class Empty {
  readonly icon = input('info');
  readonly text = input('Aucun élément');
}
