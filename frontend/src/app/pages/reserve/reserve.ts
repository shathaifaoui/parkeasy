import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import {
  ParkingDetail,
  Reservation,
  SPACE_TYPE_LABEL,
  SpaceAvailability,
  Vehicle,
} from '../../core/models';
import { SearchState, ymd } from '../../core/search-state.service';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../components/icon/icon';
import { DateFrPipe } from '../../pipes/date-fr-pipe';
import { HourPipe } from '../../pipes/hour-pipe';
import { Skeleton } from '../../components/skeleton/skeleton';
import { TndPipe } from '../../pipes/tnd-pipe';

@Component({
  selector: 'app-reserve',
  imports: [FormsModule, DecimalPipe, RouterLink, Icon, TndPipe, DateFrPipe, HourPipe, Skeleton],
  templateUrl: './reserve.html',
  styleUrl: './reserve.scss',
})
export class ReservePage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected state = inject(SearchState);

  readonly id = input.required<string>();
  readonly date = input<string>();
  readonly start = input<string>();
  readonly end = input<string>();

  protected readonly parking = signal<ParkingDetail | null>(null);
  protected readonly spaces = signal<SpaceAvailability[]>([]);
  protected readonly vehicles = signal<Vehicle[] | null>(null);
  protected readonly level = signal<string>('');
  protected readonly selected = signal<SpaceAvailability | null>(null);
  protected readonly vehicleId = signal<number | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<Reservation | null>(null);
  protected today = ymd(new Date());
  protected typeLabel = SPACE_TYPE_LABEL;

  // Ajout rapide d'un véhicule
  protected newPlate = '';
  protected newBrand = '';
  protected readonly addingVehicle = signal(false);

  protected readonly levelSpaces = computed(() =>
    this.spaces().filter((s) => s.level === this.level()),
  );
  protected readonly freeCount = computed(
    () => this.spaces().filter((s) => s.availability === 'free').length,
  );
  protected readonly total = computed(
    () => (this.parking()?.hourly_rate ?? 0) * this.state.billedHours(),
  );
  protected readonly vehicle = computed(
    () => this.vehicles()?.find((v) => v.id === this.vehicleId()) ?? null,
  );
  protected readonly step = computed(() =>
    !this.state.valid() ? 1 : !this.selected() ? 2 : !this.vehicleId() ? 3 : 4,
  );
  protected readonly openOnSlot = computed(() => this.parking()?.open_on_slot ?? true);

  constructor() {
    effect(() => {
      const [d, s, e] = [this.date(), this.start(), this.end()];
      untracked(() => this.state.set({ date: d, start: s, end: e }));
    });
    this.api.vehicles().subscribe((v) => {
      this.vehicles.set(v);
      if (v.length) this.vehicleId.set(v[0].id);
    });
    // Disponibilités rechargées à chaque changement de créneau
    let timer: ReturnType<typeof setTimeout>;
    effect(() => {
      const id = Number(this.id());
      const valid = this.state.valid();
      const slot = this.state.slot();
      clearTimeout(timer);
      if (!valid) return;
      timer = setTimeout(() => this.load(id, slot), 200);
    });
  }

  load(id: number, slot: { start: string; end: string }) {
    this.api.parking(id, slot).subscribe({
      next: (p) => {
        this.parking.set(p);
        if (!this.level()) this.level.set(p.levels[0] ?? 'RDC');
      },
      error: (e) => this.error.set(errorMessage(e, 'Parking introuvable')),
    });
    this.api.spaces(id, slot).subscribe((list) => {
      this.spaces.set(list);
      const sel = this.selected();
      if (sel) {
        const now = list.find((s) => s.id === sel.id);
        if (!now || now.availability !== 'free') {
          this.selected.set(null);
          this.toast.info(
            `La place ${sel.code} n'est plus libre sur ce créneau : choisissez-en une autre.`,
          );
        }
      }
    });
  }

  pick(s: SpaceAvailability) {
    if (s.availability !== 'free') return;
    this.selected.set(this.selected()?.id === s.id ? null : s);
  }

  addVehicle() {
    if (!this.newPlate.trim()) return;
    this.api.addVehicle({ plate: this.newPlate, brand: this.newBrand }).subscribe({
      next: (v) => {
        this.vehicles.update((l) => [...(l ?? []), v]);
        this.vehicleId.set(v.id);
        this.newPlate = '';
        this.newBrand = '';
        this.addingVehicle.set(false);
        this.toast.success(`Véhicule ${v.plate} ajouté`);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  confirm() {
    const s = this.selected();
    const v = this.vehicleId();
    if (!s || !v) return;
    if (this.state.isPast()) return this.toast.error("L'heure d'arrivée est déjà passée.");
    this.sending.set(true);
    this.api.reserve({ space_id: s.id, vehicle_id: v, ...this.state.slot() }).subscribe({
      next: (r) => {
        this.done.set(r);
        this.sending.set(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (e) => {
        this.sending.set(false);
        this.toast.error(errorMessage(e));
        // Place prise entre-temps (contrainte d'exclusion PostgreSQL) : on rafraîchit le plan
        this.load(Number(this.id()), this.state.slot());
      },
    });
  }
}
