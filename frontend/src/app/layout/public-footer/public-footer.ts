import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../../components/brand/brand';

/** Pied de page des visiteurs */
@Component({
  selector: 'app-public-footer',
  imports: [RouterLink, Brand],
  template: ` <footer class="footer">
    <div class="container foot">
      <div>
        <app-brand />
        <p class="small">
          Rechercher, comparer et réserver une place de parking en Tunisie.<br />Projet Web
          {{ year - 1 }}/{{ year }}, SUP'COM
        </p>
      </div>
      <nav class="cols" aria-label="Liens du pied de page">
        <div>
          <h2>Automobilistes</h2>
          <a routerLink="/parkings">Trouver un parking</a
          ><a routerLink="/inscription">Créer un compte</a>
        </div>
        <div>
          <h2>Gestionnaires</h2>
          <a routerLink="/inscription" [queryParams]="{ profil: 'gestionnaire' }"
            >Publier mon parking</a
          ><a routerLink="/connexion">Espace gestionnaire</a>
        </div>
        <div>
          <h2>Aide</h2>
          <a routerLink="/aide">Questions fréquentes</a
          ><a routerLink="/aide" fragment="contact">Nous contacter</a>
        </div>
      </nav>
    </div>
  </footer>`,
  styles: `
    .footer {
      background: #fff;
      border-top: 1px solid var(--border);
      padding: 2rem 0;
      margin-top: 3rem;
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
      justify-content: space-between;
    }
    p {
      margin: 0.6rem 0 0;
      color: var(--text-2);
    }
    .cols {
      display: flex;
      flex-wrap: wrap;
      gap: 2.5rem;
    }
    .cols div {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    h2 {
      font-size: 0.9rem;
      margin: 0 0 0.2rem;
    }
    a {
      color: var(--text-2);
      text-decoration: none;
      font-size: 0.9rem;
      padding: 0.15rem 0;
      &:hover {
        color: var(--blue);
        text-decoration: underline;
      }
    }
  `,
})
export class PublicFooter {
  protected year = new Date().getFullYear();
}
