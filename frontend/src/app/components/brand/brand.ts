import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Logo ParkEasy (réutilisé dans l'en-tête, le menu latéral et le pied de page) */
@Component({
  selector: 'app-brand',
  imports: [RouterLink],
  template: `<a routerLink="/" class="brand" aria-label="ParkEasy, retour à l'accueil">
    <span class="logo" aria-hidden="true">P</span><span>Park<b>Easy</b></span></a
  >`,
  styles: `
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--navy);
      text-decoration: none;
    }
    b {
      color: var(--blue);
    }
    .logo {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: var(--blue);
      color: #fff;
      font-weight: 800;
    }
  `,
})
export class Brand {}
