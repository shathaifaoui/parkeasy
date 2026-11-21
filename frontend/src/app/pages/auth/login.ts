import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../components/icon/icon';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  template: ` <div class="auth-page">
    <div class="card box">
      <span class="logo">P</span>
      <h1>Connexion</h1>
      <p class="muted">
        Accédez à vos réservations, à votre espace gestionnaire ou à la supervision.
      </p>
      @if (retour()) {
        <p class="alert alert-info small">
          <app-icon name="info" [size]="16" /> Connectez-vous pour continuer : votre recherche est
          conservée.
        </p>
      }

      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="email">E-mail</label>
          <input
            id="email"
            class="input"
            type="email"
            formControlName="email"
            autocomplete="email"
          />
        </div>
        <div class="field">
          <label for="pwd">Mot de passe</label>
          <div class="pwd">
            <input
              id="pwd"
              class="input"
              [type]="show() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="btn btn-ghost btn-icon"
              (click)="show.set(!show())"
              [attr.aria-label]="show() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
            >
              <app-icon name="eye" />
            </button>
          </div>
        </div>
        @if (error(); as e) {
          <p class="alert alert-error" role="alert">{{ e }}</p>
        }
        <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
          {{ loading() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>
      <p class="center small">
        Pas encore de compte ?
        <a routerLink="/inscription" [queryParams]="{ retour: retour() }">Créer un compte</a>
      </p>

      <div class="demo">
        <strong class="small">Comptes de démonstration</strong>
        <button type="button" (click)="fill('youssef@parkeasy.tn', 'Youssef123!')">
          <span class="badge badge-blue">Automobiliste</span> Youssef Jmail
        </button>
        <button type="button" (click)="fill('sami@parkeasy.tn', 'Sami123!')">
          <span class="badge badge-confirmed">Gestionnaire</span> Sami Trabelsi
        </button>
        <button type="button" (click)="fill('admin@parkeasy.tn', 'Admin123!')">
          <span class="badge badge-pending">Administrateur</span> Admin ParkEasy
        </button>
      </div>
    </div>
  </div>`,
  styleUrl: './auth.scss',
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected readonly retour = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('retour'));
  protected readonly show = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  fill(email: string, password: string) {
    this.form.setValue({ email, password });
  }

  submit() {
    if (this.form.invalid) return this.error.set('Renseignez votre e-mail et votre mot de passe.');
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (r) => {
        this.toast.success(`Bienvenue ${r.user.first_name} !`);
        const retour = this.retour();
        // Le lien de retour n'est suivi que s'il correspond aux droits du profil
        const allowed = retour && (r.user.role === 'driver' || !retour.startsWith('/reserver'));
        this.router.navigateByUrl(allowed ? retour : this.auth.home());
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
