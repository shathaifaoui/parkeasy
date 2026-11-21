import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SearchState } from './search-state.service';

describe('SearchState', () => {
  let state: SearchState;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    state = TestBed.inject(SearchState);
  });

  it('refuse un créneau dont le départ précède l’arrivée', () => {
    state.set({ date: '2030-01-10', start: '14:00', end: '10:00' });
    expect(state.valid()).toBeFalse();
  });

  it('calcule la durée d’un créneau valide', () => {
    state.set({ date: '2030-01-10', start: '10:00', end: '14:30' });
    expect(state.valid()).toBeTrue();
    expect(state.minutes()).toBe(270);
  });
});
