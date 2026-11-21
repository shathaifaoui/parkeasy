import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import { errorMessage } from '../../../core/auth.interceptor';
import { ManagedParking, ManagedSpace, SPACE_TYPE_LABEL } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { Icon, amenityIcon } from '../../../components/icon/icon';
import { Empty } from '../../../components/empty-state/empty-state';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { Modal } from '../../../components/modal/modal';
import { StatusBadge } from '../../../components/status-badge/status-badge';
import { TndPipe } from '../../../pipes/tnd-pipe';

const LIVE_LABEL: Record<ManagedSpace['live_state'], string> = {
  free: 'Libre',
  reserved: 'Réservée',
  occupied: 'Occupée',
  out_of_service: 'Hors service',
};

@Component({
  selector: 'app-manager-parkings',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    Icon,
    StatusBadge,
    TndPipe,
    Skeleton,
    Empty,
    Modal,
  ],
  templateUrl: './parkings.html',
  styleUrl: './parkings.scss',
})
export class ManagerParkingsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  protected readonly zones = toSignal(this.api.zones$, { initialValue: [] });
  protected readonly amenities = toSignal(this.api.amenities$, { initialValue: [] });
  protected amenityIcon = amenityIcon;
  protected liveLabel = LIVE_LABEL;
  protected typeLabel = SPACE_TYPE_LABEL;

  protected readonly list = signal<{ id: number; name: string; status: string }[] | null>(null);
  protected readonly current = signal<ManagedParking | null>(null);
  protected readonly level = signal('');
  protected readonly selected = signal<ManagedSpace | null>(null);
  protected readonly editing = signal(false);
  protected readonly creating = signal(false);
  protected readonly addingSpaces = signal(false);
  protected readonly addingPhoto = signal(false);
  protected photoUrl = '';

  protected readonly levelSpaces = computed(
    () => this.current()?.spaces.filter((s) => s.level === this.level()) ?? [],
  );
  protected readonly counts = computed(() => {
    const c = { free: 0, reserved: 0, occupied: 0, out_of_service: 0 };
    for (const s of this.levelSpaces()) c[s.live_state]++;
    return c;
  });
  protected readonly amenityLabels = computed(() => {
    const ids = this.current()?.amenity_ids ?? [];
    return this.amenities().filter((a) => ids.includes(a.id));
  });

  // Formulaire commun (modification et création)
  protected form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    address: ['', [Validators.required, Validators.maxLength(200)]],
    zone_id: [0, [Validators.required, Validators.min(1)]],
    hourly_rate: [2, [Validators.required, Validators.min(0), Validators.max(100)]],
    open_24h: [false],
    opening_time: ['07:00'],
    closing_time: ['22:00'],
    description: [''],
    latitude: [null as number | null],
    longitude: [null as number | null],
    amenity_ids: [[] as number[]],
    levels: [1, [Validators.min(1), Validators.max(6)]],
    spaces_per_level: [10, [Validators.min(1), Validators.max(60)]],
  });
  protected spacesForm = this.fb.nonNullable.group({
    level: ['', Validators.required],
    count: [4, [Validators.required, Validators.min(1), Validators.max(60)]],
    type: ['standard' as string],
  });

  constructor() {
    this.loadList();
  }

  loadList(selectId?: number) {
    this.api.myParkings().subscribe((l) => {
      this.list.set(l);
      const id = selectId ?? this.current()?.id ?? l[0]?.id;
      if (id) this.open(id);
    });
  }

  open(id: number) {
    this.api.managedParking(id).subscribe((p) => {
      const keepLevel = this.current()?.id === id && p.levels.includes(this.level());
      this.current.set(p);
      if (!keepLevel) this.level.set(p.levels[0] ?? 'RDC');
      const sel = this.selected();
      this.selected.set(sel ? (p.spaces.find((s) => s.id === sel.id) ?? null) : null);
    });
  }

  select(id: number) {
    this.selected.set(null);
    this.editing.set(false);
    this.open(id);
  }

  // ---- Informations ----
  startEdit() {
    const p = this.current()!;
    this.form.reset({
      name: p.name,
      address: p.address,
      zone_id: p.zone_id,
      hourly_rate: p.hourly_rate,
      open_24h: p.open_24h,
      opening_time: p.opening_time ?? '07:00',
      closing_time: p.closing_time ?? '22:00',
      description: p.description ?? '',
      latitude: p.latitude,
      longitude: p.longitude,
      amenity_ids: [...p.amenity_ids],
      levels: 1,
      spaces_per_level: 10,
    });
    this.editing.set(true);
  }

  startCreate() {
    this.form.reset({ zone_id: this.zones()[0]?.id ?? 0, amenity_ids: [] });
    this.creating.set(true);
  }

  toggleAmenity(id: number) {
    const ids = this.form.controls.amenity_ids.value;
    this.form.controls.amenity_ids.setValue(
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  private payload() {
    const v = this.form.getRawValue();
    return {
      ...v,
      zone_id: Number(v.zone_id),
      hourly_rate: Number(v.hourly_rate),
      latitude: v.latitude || null,
      longitude: v.longitude || null,
    };
  }

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const p = this.current()!;
    this.api.updateParking(p.id, this.payload()).subscribe({
      next: (r) => {
        this.toast.success(r.message);
        this.editing.set(false);
        this.loadList(p.id);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  create() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.api.createParking(this.payload()).subscribe({
      next: (r) => {
        this.toast.success(r.message);
        this.creating.set(false);
        this.loadList(r.id);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  useMyPosition() {
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        this.form.patchValue({
          latitude: +pos.coords.latitude.toFixed(6),
          longitude: +pos.coords.longitude.toFixed(6),
        }),
      () => this.toast.error('Position indisponible : saisissez les coordonnées manuellement.'),
    );
  }

  // ---- Places ----
  pick(s: ManagedSpace) {
    this.selected.set(this.selected()?.id === s.id ? null : s);
  }

  setState(state: 'in_service' | 'out_of_service') {
    const s = this.selected();
    if (!s) return;
    this.api.setSpaceState(s.id, state).subscribe({
      next: (r) => {
        if (r.upcoming && state === 'out_of_service') this.toast.info(r.message);
        else this.toast.success(r.message);
        this.open(this.current()!.id);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  openAddSpaces() {
    this.spacesForm.reset({ level: this.level(), count: 4, type: 'standard' });
    this.addingSpaces.set(true);
  }

  addSpaces() {
    if (this.spacesForm.invalid) return this.spacesForm.markAllAsTouched();
    const v = this.spacesForm.getRawValue();
    this.api.addSpaces(this.current()!.id, { ...v, count: Number(v.count) }).subscribe({
      next: (r) => {
        this.toast.success(r.message);
        this.addingSpaces.set(false);
        this.level.set(v.level);
        this.open(this.current()!.id);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  // ---- Photos ----
  addPhoto() {
    const url = this.photoUrl.trim();
    if (!url) return;
    this.api.addPhoto(this.current()!.id, url).subscribe({
      next: (r) => {
        this.toast.success(r.message);
        this.photoUrl = '';
        this.addingPhoto.set(false);
        this.open(this.current()!.id);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  removePhoto(id: number) {
    if (!confirm('Supprimer cette photo ?')) return;
    this.api.deletePhoto(id).subscribe({
      next: () => this.open(this.current()!.id),
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
