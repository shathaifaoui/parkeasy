import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, interval, startWith, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Notification, ROLE_LABEL } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../components/icon/icon';
import { DateFrPipe } from '../../pipes/date-fr-pipe';

/** Barre supérieure des espaces connectés : recherche, notifications, menu du compte */
@Component({
  selector: 'app-topbar',
  imports: [RouterLink, Icon, DateFrPipe],
  templateUrl: './app-topbar.html',
  styleUrl: './app-topbar.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenus()',
  },
})
export class AppTopbar {
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  /** Demande d'ouverture du menu latéral (tablette / mobile) */
  menuToggle = output<void>();

  protected readonly bellOpen = signal(false);
  protected readonly userOpen = signal(false);
  protected readonly notifs = signal<{ count: number; items: Notification[] }>({
    count: 0,
    items: [],
  });

  protected readonly roleLabel = computed(() =>
    this.auth.role() ? ROLE_LABEL[this.auth.role()!] : '',
  );
  protected readonly initials = computed(() => {
    const u = this.auth.user();
    return u ? (u.first_name[0] + u.last_name[0]).toUpperCase() : '';
  });
  protected readonly searchPlaceholder = computed(() =>
    this.auth.isManager()
      ? 'Rechercher une réservation, un client, une place…'
      : 'Rechercher un parking, une adresse ou une ville…',
  );

  constructor() {
    // Notifications : interrogées toutes les 60 secondes tant que l'utilisateur est connecté
    let sub: Subscription | undefined;
    effect((onCleanup) => {
      this.notifs.set({ count: 0, items: [] });
      if (this.auth.isLoggedIn()) {
        sub = interval(60_000)
          .pipe(
            startWith(0),
            switchMap(() => this.api.notifications()),
          )
          .subscribe((n) => this.notifs.set(n));
      }
      onCleanup(() => sub?.unsubscribe());
    });
  }

  /** Recherche rapide (formulaire HTML simple : @angular/forms n'est pas chargé au démarrage) */
  search(e: Event, input: HTMLInputElement) {
    e.preventDefault();
    const q = input.value.trim();
    if (this.auth.isManager())
      this.router.navigate(['/gestion/reservations'], { queryParams: { q } });
    else this.router.navigate(['/parkings'], { queryParams: { q: q || null } });
    input.value = '';
  }

  closeMenus() {
    this.bellOpen.set(false);
    this.userOpen.set(false);
  }

  protected onDocumentClick(e: Event) {
    const t = e.target as HTMLElement;
    if (!t.closest('.bell-wrap')) this.bellOpen.set(false);
    if (!t.closest('.user-wrap')) this.userOpen.set(false);
  }

  logout() {
    this.auth.logout();
    this.toast.info('Vous êtes déconnecté.');
  }
}
