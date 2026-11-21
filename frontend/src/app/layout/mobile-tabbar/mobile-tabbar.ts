import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../components/icon/icon';

/** Barre d'onglets en bas d'écran (automobiliste, mobile — maquette 11) */
@Component({
  selector: 'app-mobile-tabbar',
  imports: [RouterLink, RouterLinkActive, Icon],
  template: ` <nav class="tabbar" aria-label="Navigation mobile">
    @for (t of tabs; track t.link) {
      <a [routerLink]="t.link" routerLinkActive="active" ariaCurrentWhenActive="page"
        ><app-icon [name]="t.icon" /><span>{{ t.label }}</span></a
      >
    }
  </nav>`,
  styles: `
    .tabbar {
      display: none;
    }
    @media (max-width: 700px) {
      .tabbar {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 70;
        background: #fff;
        border-top: 1px solid var(--border);
        padding: 0.35rem 0 max(0.35rem, env(safe-area-inset-bottom));
      }
      a {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;
        min-height: 48px;
        justify-content: center;
        font-size: 0.72rem;
        color: var(--text-2);
        text-decoration: none;
        font-weight: 600;
        transition: color 0.15s;
      }
      a.active {
        color: var(--blue);
      }
    }
  `,
})
export class MobileTabbar {
  protected tabs = [
    { link: '/parkings', icon: 'search', label: 'Rechercher' },
    { link: '/mes-reservations', icon: 'list', label: 'Réservations' },
    { link: '/favoris', icon: 'heart', label: 'Favoris' },
    { link: '/profil', icon: 'user', label: 'Profil' },
  ];
}
