import { Injectable, computed, effect, signal } from '@angular/core';
import { ParamMap } from '@angular/router';

/** 'YYYY-MM-DD' de la date locale */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Combine une date et une heure locales en ISO 8601 (UTC) */
export function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}
const hm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const KEY = 'parkeasy_search';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface SearchCriteria {
  zone: number | null;
  date: string;
  start: string;
  end: string;
}

function defaults(): SearchCriteria {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  if (d.getHours() >= 20 || d.getHours() < 7) {
    if (d.getHours() >= 20) d.setDate(d.getDate() + 1);
    d.setHours(10);
  }
  const e = new Date(d.getTime() + 2 * 3600e3);
  return { zone: null, date: ymd(d), start: hm(d), end: hm(e) };
}

/**
 * Critères de recherche partagés entre l'accueil, les résultats, le détail et la réservation
 * (zone, date, arrivée, départ). Conservés le temps de la session et repris depuis l'URL.
 */
@Injectable({ providedIn: 'root' })
export class SearchState {
  readonly zone = signal<number | null>(null);
  readonly date = signal('');
  readonly start = signal('');
  readonly end = signal('');

  /** Créneau ISO envoyé à l'API */
  readonly slot = computed(() => ({
    start: toIso(this.date(), this.start()),
    end: toIso(this.date(), this.end()),
  }));
  /** Durée en minutes */
  readonly minutes = computed(
    () => (new Date(this.slot().end).getTime() - new Date(this.slot().start).getTime()) / 60000,
  );
  /** Heures entamées (RG11) */
  readonly billedHours = computed(() => Math.max(0, Math.ceil(this.minutes() / 60)));
  readonly valid = computed(() => this.minutes() > 0);
  readonly isPast = computed(() => new Date(this.slot().start).getTime() < Date.now() - 5 * 60e3);

  constructor() {
    let saved: Partial<SearchCriteria> = {};
    try {
      saved = JSON.parse(sessionStorage.getItem(KEY) || '{}');
    } catch {
      /* ignore */
    }
    const d = defaults();
    const useSaved = saved.date && saved.date >= ymd(new Date());
    this.set(useSaved ? { ...d, ...saved } : d);
    effect(() => {
      try {
        sessionStorage.setItem(
          KEY,
          JSON.stringify({
            zone: this.zone(),
            date: this.date(),
            start: this.start(),
            end: this.end(),
          }),
        );
      } catch {
        /* stockage indisponible */
      }
    });
  }

  set(c: Partial<SearchCriteria>) {
    if (c.zone !== undefined) this.zone.set(c.zone ? Number(c.zone) : null);
    if (c.date && /^\d{4}-\d{2}-\d{2}$/.test(c.date)) this.date.set(c.date);
    if (c.start && TIME_RE.test(c.start)) this.start.set(c.start);
    if (c.end && TIME_RE.test(c.end)) this.end.set(c.end);
  }

  /** Reprend les critères présents dans l'URL (?zone=&date=&start=&end=) */
  fromQuery(q: ParamMap) {
    this.set({
      zone: q.has('zone') ? Number(q.get('zone')) || null : undefined,
      date: q.get('date') ?? undefined,
      start: q.get('start') ?? undefined,
      end: q.get('end') ?? undefined,
    });
  }

  toQuery() {
    return {
      zone: this.zone() ?? undefined,
      date: this.date(),
      start: this.start(),
      end: this.end(),
    };
  }
}
