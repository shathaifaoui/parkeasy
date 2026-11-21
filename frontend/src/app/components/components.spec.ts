import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ErrorState } from './error-state/error-state';
import { FreeBadge } from './free-badge/free-badge';
import { Skeleton } from './skeleton/skeleton';
import { Stars } from './stars/stars';

beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));

describe('Skeleton', () => {
  it('affiche autant de blocs que demandé et un texte pour les lecteurs d’écran', async () => {
    const f = TestBed.createComponent(Skeleton);
    f.componentRef.setInput('variant', 'tile');
    f.componentRef.setInput('count', 4);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('.tile').length).toBe(4);
    expect(el.querySelector('[role="status"]')?.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('.sr-only')?.textContent).toContain('Chargement');
  });
});

describe('ErrorState', () => {
  it('émet « retry » au clic sur Réessayer', async () => {
    const f = TestBed.createComponent(ErrorState);
    let retried = 0;
    f.componentInstance.retry.subscribe(() => retried++);
    await f.whenStable();
    (f.nativeElement as HTMLElement).querySelector('button')!.click();
    expect(retried).toBe(1);
    expect((f.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe('FreeBadge', () => {
  const render = async (free: number, closed = false) => {
    const f = TestBed.createComponent(FreeBadge);
    f.componentRef.setInput('free', free);
    f.componentRef.setInput('closed', closed);
    await f.whenStable();
    return (f.nativeElement as HTMLElement).textContent!.trim();
  };
  it('indique toujours l’état par un texte (pas seulement par la couleur)', async () => {
    expect(await render(32)).toBe('32 places libres');
    expect(await render(3)).toBe('Plus que 3 places');
    expect(await render(0)).toBe('Complet');
    expect(await render(10, true)).toBe('Fermé sur ce créneau');
  });
});

describe('Stars', () => {
  it('décrit la note pour les lecteurs d’écran', async () => {
    const f = TestBed.createComponent(Stars);
    f.componentRef.setInput('value', 4);
    await f.whenStable();
    expect(
      (f.nativeElement as HTMLElement).querySelector('[role="img"]')?.getAttribute('aria-label'),
    ).toBe('Note 4 sur 5');
  });
});
