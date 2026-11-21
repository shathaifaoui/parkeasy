import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Brand } from '../../components/brand/brand';
import { Icon } from '../../components/icon/icon';

interface MenuItem {
  label: string;
  icon: string;
  link: string;
  exact?: boolean;
}

/** Menu de chaque profil (architecture de l'information, Objectif 02) */
const MENUS: Record<string, MenuItem[]> = {
  driver: [
    { label: 'Accueil', icon: 'home', link: '/', exact: true },
    { label: 'Rechercher', icon: 'search', link: '/parkings' },
    { label: 'Mes réservations', icon: 'list', link: '/mes-reservations' },
    { label: 'Favoris', icon: 'heart', link: '/favoris' },
    { label: 'Profil', icon: 'user', link: '/profil' },
  ],
  manager: [
    { label: 'Tableau de bord', icon: 'home', link: '/gestion', exact: true },
    { label: 'Parkings & places', icon: 'building', link: '/gestion/parkings' },
    { label: 'Réservations', icon: 'list', link: '/gestion/reservations' },
    { label: 'Profil', icon: 'settings', link: '/profil' },
  ],
  admin: [
    { label: 'Supervision', icon: 'grid', link: '/admin', exact: true },
    { label: 'Messages', icon: 'bell', link: '/admin/messages' },
    { label: 'Parkings publiés', icon: 'search', link: '/parkings' },
    { label: 'Profil', icon: 'settings', link: '/profil' },
  ],
};

/** Menu latéral des espaces connectés (tiroir sur tablette et mobile) */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Brand, Icon],
  template: ` <aside
      class="sidebar"
      [class.open]="open()"
      aria-label="Menu principal"
      [attr.inert]="hidden() ? '' : null"
    >
      <div class="head">
        <app-brand />
        <button
          type="button"
          class="btn btn-ghost btn-icon close"
          (click)="closed.emit()"
          aria-label="Fermer le menu"
        >
          <app-icon name="x" />
        </button>
      </div>
      <nav
        aria-label="Menu de l'espace {{
          auth.role() === 'manager'
            ? 'gestionnaire'
            : auth.role() === 'admin'
              ? 'administrateur'
              : 'automobiliste'
        }}"
      >
        @for (m of menu(); track m.link) {
          <a
            [routerLink]="m.link"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: !!m.exact }"
          >
            <app-icon [name]="m.icon" [size]="18" /> {{ m.label }}
          </a>
        }
      </nav>
      <div class="help">
        @if (auth.isManager()) {
          <span class="small">Espace gestionnaire</span>
          <a routerLink="/gestion/parkings" class="small strong">Gérer mes parkings</a>
        } @else {
          <span class="small">Besoin d'aide ?</span>
          <a routerLink="/aide" class="small strong">Centre d'aide et contact</a>
        }
      </div>
    </aside>
    @if (open()) {
      <div class="scrim" (click)="closed.emit()" aria-hidden="true"></div>
    }`,
  styleUrl: './app-sidebar.scss',
})
export class AppSidebar {
  protected auth = inject(AuthService);
  /** Tiroir ouvert (tablette / mobile) */
  readonly open = input(false);
  /** Vrai quand le tiroir est fermé sur petit écran : le menu sort de l'ordre de tabulation */
  readonly hidden = input(false);
  closed = output<void>();
  protected readonly menu = computed(() => MENUS[this.auth.role() ?? 'driver']);
}
