import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { ROLE_LABEL, Vehicle } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../components/icon/icon';
import { DateFrPipe } from '../../pipes/date-fr-pipe';

const PREFS_KEY = 'parkeasy_notif_prefs';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, FormsModule, Icon, DateFrPipe],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfilePage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  protected auth = inject(AuthService);

  protected readonly roleLabel = computed(() =>
    this.auth.user() ? ROLE_LABEL[this.auth.user()!.role] : '',
  );
  protected readonly initials = computed(() => {
    const u = this.auth.user();
    return u ? (u.first_name[0] + u.last_name[0]).toUpperCase() : '';
  });

  protected info = this.fb.nonNullable.group({
    first_name: [
      this.auth.user()?.first_name ?? '',
      [Validators.required, Validators.maxLength(60)],
    ],
    last_name: [this.auth.user()?.last_name ?? '', [Validators.required, Validators.maxLength(60)]],
    phone: [this.auth.user()?.phone ?? '', Validators.pattern(/^[0-9 +]{8,15}$/)],
  });
  protected pwd = this.fb.nonNullable.group({
    current: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly vehicles = signal<Vehicle[]>([]);
  protected vForm = this.fb.nonNullable.group({
    plate: ['', [Validators.required, Validators.maxLength(15)]],
    brand: [''],
    model: [''],
  });

  // Préférences de notification (enregistrées sur cet appareil)
  protected readonly prefs = signal(this.readPrefs());

  constructor() {
    if (this.auth.isDriver()) this.api.vehicles().subscribe((v) => this.vehicles.set(v));
  }

  saveInfo() {
    if (this.info.invalid) return this.info.markAllAsTouched();
    this.api.updateMe(this.info.getRawValue()).subscribe({
      next: (u) => {
        this.auth.setUser(u);
        this.toast.success('Informations enregistrées');
        this.info.markAsPristine();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  changePassword() {
    if (this.pwd.invalid) return this.pwd.markAllAsTouched();
    this.api.changePassword(this.pwd.getRawValue()).subscribe({
      next: (r) => {
        this.toast.success(r.message);
        this.pwd.reset();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  addVehicle() {
    if (this.vForm.invalid) return this.vForm.markAllAsTouched();
    this.api.addVehicle(this.vForm.getRawValue()).subscribe({
      next: (v) => {
        this.vehicles.update((l) => [...l, { ...v, reservations: 0 }]);
        this.vForm.reset();
        this.toast.success(`Véhicule ${v.plate} ajouté`);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  removeVehicle(v: Vehicle) {
    if (!confirm(`Supprimer le véhicule ${v.plate} ?`)) return;
    this.api.deleteVehicle(v.id).subscribe({
      next: () => {
        this.vehicles.update((l) => l.filter((x) => x.id !== v.id));
        this.toast.success('Véhicule supprimé');
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  setPref(key: string, value: boolean) {
    this.prefs.update((p) => ({ ...p, [key]: value }));
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs()));
    } catch {
      /* stockage indisponible */
    }
  }

  private readPrefs(): Record<string, boolean> {
    const d = { confirm: true, reminder: true, review: true, news: false };
    try {
      return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch {
      return d;
    }
  }
}
