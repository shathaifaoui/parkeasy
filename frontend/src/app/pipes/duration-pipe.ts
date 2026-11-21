import { Pipe, PipeTransform } from '@angular/core';

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
