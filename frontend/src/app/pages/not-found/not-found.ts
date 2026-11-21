import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: ` <div class="page center nf">
    <p class="code">404</p>
    <h1>Page introuvable</h1>
    <p class="muted">La page demandée n'existe pas ou a été déplacée.</p>
    <a routerLink="/" class="btn btn-primary">Retour à l'accueil</a>
  </div>`,
  styles: `
    .nf {
      margin: 0 auto;
    }
    .code {
      font-size: 5rem;
      font-weight: 900;
      color: var(--blue);
      margin: 2rem 0 0;
      letter-spacing: -0.05em;
    }
  `,
})
export class NotFoundPage {}
