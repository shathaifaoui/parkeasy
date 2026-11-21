import { Pipe, PipeTransform } from '@angular/core';

/** « 10:00 » */
@Pipe({ name: 'hour' })
export class HourPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    return v
      ? new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '—';
  }
}
