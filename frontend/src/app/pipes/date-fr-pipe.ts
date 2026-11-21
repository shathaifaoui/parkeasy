import { Pipe, PipeTransform } from '@angular/core';

/** « jeu. 20 nov. 2026 » ; format 'short' → 20/11/2026 ; 'day' → jeudi 20 novembre */
@Pipe({ name: 'dateFr' })
export class DateFrPipe implements PipeTransform {
  transform(
    v: string | Date | null | undefined,
    format: 'medium' | 'short' | 'day' | 'datetime' = 'medium',
  ): string {
    if (!v) return '—';
    const d = typeof v === 'string' && v.length === 10 ? new Date(v + 'T00:00:00') : new Date(v);
    const opts: Record<string, Intl.DateTimeFormatOptions> = {
      medium: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
      short: { day: '2-digit', month: '2-digit', year: 'numeric' },
      day: { weekday: 'long', day: 'numeric', month: 'long' },
      datetime: {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    };
    return d.toLocaleString('fr-FR', opts[format]);
  }
}
