import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { AppSidebar } from './layout/app-sidebar/app-sidebar';
import { AppTopbar } from './layout/app-topbar/app-topbar';
import { MobileTabbar } from './layout/mobile-tabbar/mobile-tabbar';
import { PublicFooter } from './layout/public-footer/public-footer';
import { PublicHeader } from './layout/public-header/public-header';
import { ToastOutlet } from './layout/toast-outlet/toast-outlet';

/**
 * Coquille de l'application : choisit la mise en page selon le profil
 * (visiteur → en-tête + pied de page ; connecté → menu latéral + barre supérieure).
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    AppSidebar,
    AppTopbar,
    MobileTabbar,
    PublicHeader,
    PublicFooter,
    ToastOutlet,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:keydown.escape)': 'drawerOpen.set(false)' },
})
export class App {
  protected auth = inject(AuthService);
  private router = inject(Router);
  private title = inject(Title);

  protected readonly drawerOpen = signal(false);
  /** Écran < 1024 px : le menu latéral devient un tiroir */
  protected readonly compact = signal(false);
  /** Texte lu par les lecteurs d'écran à chaque changement de page */
  protected readonly announcement = signal('');

  private readonly publicHeader = viewChild(PublicHeader);
  private readonly topbar = viewChild(AppTopbar);

  constructor() {
    const mq = matchMedia('(max-width: 1023px)');
    this.compact.set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => this.compact.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));

    let first = true;
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.drawerOpen.set(false);
        this.publicHeader()?.close();
        this.topbar()?.closeMenus();
        if (first) return void (first = false);
        // Accessibilité : annonce le titre de la nouvelle page et place le focus sur le contenu
        setTimeout(() => {
          this.announcement.set(this.title.getTitle());
          if (!location.hash) document.getElementById('contenu')?.focus({ preventScroll: true });
        });
      });
  }
}
