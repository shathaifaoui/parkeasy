import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../components/icon/icon';

const samePasswords = (g: AbstractControl): ValidationErrors | null =>
  g.get('password')?.value === g.get('confirm')?.value ? null : { mismatch: true };

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  template: ` <div class="auth-page">
    <div class="card box wide">
      <span class="logo">P</span>
      <h1>Créer un compte</h1>
      <p class="muted">Choisissez votre profil : vous pourrez commencer tout de suite.</p>

      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="roles" role="radiogroup" aria-label="Profil">
          <label class="role" [class.on]="form.controls.role.value === 'driver'">
            <input type="radio" formControlName="role" value="driver" />
            <app-icon name="car" [size]="22" /><b>Automobiliste</b
            ><span class="muted small">Je cherche et réserve des places</span>
          </label>
          <label class="role" [class.on]="form.controls.role.value === 'manager'">
            <input type="radio" formControlName="role" value="manager" />
            <app-icon name="building" [size]="22" /><b>Gestionnaire</b
            ><span class="muted small">Je publie et gère mes parkings</span>
          </label>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="fn">Prénom</label
            ><input id="fn" class="input" formControlName="first_name" autocomplete="given-name" />
            @if (bad('first_name')) {
              <span class="error">Prénom obligatoire</span>
            }
          </div>
          <div class="field">
            <label for="ln">Nom</label
            ><input id="ln" class="input" formControlName="last_name" autocomplete="family-name" />
            @if (bad('last_name')) {
              <span class="error">Nom obligatoire</span>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="em">E-mail</label
            ><input
              id="em"
              type="email"
              class="input"
              formControlName="email"
              autocomplete="email"
            />
            @if (bad('email')) {
              <span class="error">E-mail invalide</span>
            }
          </div>
          <div class="field">
            <label for="ph">Téléphone</label
            ><input
              id="ph"
              type="tel"
              class="input"
              formControlName="phone"
              autocomplete="tel"
              placeholder="ex. 22 345 678"
            />
            @if (bad('phone')) {
              <span class="error">Numéro invalide</span>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="pw">Mot de passe</label
            ><input
              id="pw"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="new-password"
            />
            <span class="hint">8 caractères minimum</span>
            @if (bad('password')) {
              <span class="error">8 caractères minimum</span>
            }
          </div>
          <div class="field">
            <label for="pw2">Confirmation</label
            ><input
              id="pw2"
              type="password"
              class="input"
              formControlName="confirm"
              autocomplete="new-password"
            />
            @if (form.hasError('mismatch') && form.controls.confirm.touched) {
              <span class="error">Les mots de passe diffèrent</span>
            }
          </div>
        </div>
        @if (form.controls.role.value === 'manager') {
          <p class="alert alert-info small">
            <app-icon name="info" [size]="16" /> Vos parkings seront visibles après validation par
            l'administrateur de la plateforme.
          </p>
        }
        @if (error(); as e) {
          <p class="alert alert-error" role="alert">{{ e }}</p>
        }
        <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
          {{ loading() ? 'Création…' : 'Créer mon compte' }}
        </button>
      </form>
      <p class="center small">
        Déjà inscrit ?
        <a routerLink="/connexion" [queryParams]="{ retour: retour }">Se connecter</a>
      </p>
    </div>
  </div>`,
  styleUrl: './auth.scss',
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private qp = inject(ActivatedRoute).snapshot.queryParamMap;
  protected retour = this.qp.get('retour');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected form = this.fb.nonNullable.group(
    {
      role: [this.qp.get('profil') === 'gestionnaire' ? 'manager' : 'driver', Validators.required],
      first_name: ['', [Validators.required, Validators.maxLength(60)]],
      last_name: ['', [Validators.required, Validators.maxLength(60)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.pattern(/^[0-9 +]{8,15}$/)],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: samePasswords },
  );

  bad(name: keyof typeof this.form.controls) {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(
        this.form.hasError('mismatch')
          ? 'Les mots de passe ne correspondent pas.'
          : 'Veuillez corriger les champs indiqués.',
      );
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { confirm: _confirm, ...body } = this.form.getRawValue(); // la confirmation n'est pas envoyée à l'API
    this.auth.register(body).subscribe({
      next: (r) => {
        this.toast.success(`Bienvenue sur ParkEasy, ${r.user.first_name} !`);
        const go = r.user.role === 'manager' ? '/gestion/parkings' : this.retour || '/profil';
        this.router.navigateByUrl(go);
        if (r.user.role === 'driver' && !this.retour)
          this.toast.info('Ajoutez votre véhicule pour pouvoir réserver.');
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
