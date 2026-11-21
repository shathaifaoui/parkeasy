import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { User } from './models';

interface AuthResponse {
  token: string;
  user: User;
}

export const TOKEN_KEY = 'parkeasy_token';
const USER_KEY = 'parkeasy_user';

/** Gestion de l'état d'authentification (signals + localStorage) */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly _user = signal<User | null>(this.read<User>(USER_KEY));
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly role = computed(() => this._user()?.role ?? null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly isDriver = computed(() => this._user()?.role === 'driver');
  readonly isManager = computed(() => this._user()?.role === 'manager');
  /** Page d'accueil de l'espace connecté selon le rôle */
  readonly home = computed(
    () =>
      ({ driver: '/parkings', manager: '/gestion', admin: '/admin' })[
        this._user()?.role ?? 'driver'
      ],
  );

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  constructor() {
    // Rafraîchit le profil au démarrage (et déconnecte si le jeton a expiré)
    if (this.token) {
      this.http.get<User>('/api/auth/me').subscribe({
        next: (u) => this.setUser(u),
        error: () => this.logout(false),
      });
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((r) => this.store(r)));
  }

  register(body: Record<string, unknown>) {
    return this.http.post<AuthResponse>('/api/auth/register', body).pipe(tap((r) => this.store(r)));
  }

  setUser(u: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    this._user.set(u);
  }

  logout(redirect = true) {
    // On quitte d'abord la page protégée, puis on efface la session :
    // évite qu'un écran réservé soit ré-affiché un instant sans jeton.
    if (redirect) this.router.navigateByUrl('/').then(() => this.clear());
    else this.clear();
  }

  private clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
  }

  private store(r: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, r.token);
    this.setUser(r.user);
  }

  private read<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  }
}
