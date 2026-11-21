import { DurationPipe } from './duration-pipe';
import { TndPipe } from './tnd-pipe';

describe('TndPipe', () => {
  const pipe = new TndPipe();
  it('affiche un tarif horaire à la française', () => {
    expect(pipe.transform(2.5).replace(/\s/g, ' ')).toBe('2,5 TND');
  });
  it('affiche un total avec deux décimales', () => {
    expect(pipe.transform(10, 2).replace(/\s/g, ' ')).toBe('10,00 TND');
  });
  it('affiche un tiret si la valeur est absente', () => {
    expect(pipe.transform(null)).toBe('—');
  });
});

describe('DurationPipe', () => {
  const pipe = new DurationPipe();
  it('calcule une durée en heures et minutes', () => {
    expect(pipe.transform('2026-11-21T10:00:00Z', '2026-11-21T11:30:00Z')).toBe('1 h 30');
    expect(pipe.transform('2026-11-21T10:00:00Z', '2026-11-21T14:00:00Z')).toBe('4 h');
    expect(pipe.transform('2026-11-21T10:00:00Z', '2026-11-21T10:45:00Z')).toBe('45 min');
  });
});
