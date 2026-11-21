import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Brand } from '../../components/brand/brand';
import { Icon } from '../../components/icon/icon';

/** Barre de navigation des visiteurs (non connectés), repliable sur mobile */
@Component({
  selector: 'app-public-header',
  imports: [RouterLink, RouterLinkActive, Brand, Icon],
  templateUrl: './public-header.html',
  styleUrl: './public-header.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class PublicHeader {
  protected readonly open = signal(false);

  /** Ferme le menu mobile (touche Échap ou navigation) */
  close() {
    this.open.set(false);
  }
}
