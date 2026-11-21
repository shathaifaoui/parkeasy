import { Pipe, PipeTransform } from '@angular/core';

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
