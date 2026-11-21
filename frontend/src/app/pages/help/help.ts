import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/auth.interceptor';
import { ContactTopic, TOPIC_LABEL } from '../../core/models';
import { Icon } from '../../components/icon/icon';

interface Faq {
  q: string;
  a: string;
  link?: { label: string; to: string };
}

/** Page « Aide & contact » : questions fréquentes + formulaire de contact (sitemap, Objectif 02) */
@Component({
  selector: 'app-help',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './help.html',
  styleUrl: './help.scss',
})
export class HelpPage {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  protected auth = inject(AuthService);

  protected topics = Object.entries(TOPIC_LABEL) as [ContactTopic, string][];
  protected readonly sending = signal(false);
  protected readonly sent = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected faqGroups: { title: string; icon: string; items: Faq[] }[] = [
    {
      title: 'Réserver une place',
      icon: 'calendar',
      items: [
        {
          q: 'Comment réserver une place ?',
          a: "Choisissez une zone et un créneau sur l'accueil, comparez les parkings, puis choisissez votre place sur le plan. La demande est envoyée au gestionnaire, qui la confirme.",
          link: { label: 'Rechercher un parking', to: '/parkings' },
        },
        {
          q: 'Combien vais-je payer ?',
          a: "Le montant est calculé à partir du tarif horaire du parking et du nombre d'heures entamées. Il est affiché avant la confirmation et figé dans la réservation.",
        },
        {
          q: 'Ma réservation est « en attente ». Que faire ?',
          a: "Le gestionnaire doit la confirmer. Si elle n'est pas confirmée à l'heure d'arrivée, elle expire automatiquement et la place est libérée.",
        },
        {
          q: 'Puis-je annuler ?',
          a: "Oui, depuis « Mes réservations », tant que le créneau n'a pas commencé.",
          link: { label: 'Mes réservations', to: '/mes-reservations' },
        },
      ],
    },
    {
      title: 'Gérer un parking',
      icon: 'building',
      items: [
        {
          q: 'Comment publier mon parking ?',
          a: "Créez un compte gestionnaire, puis ajoutez votre parking (adresse, tarif, horaires, places). Il reste « en validation » jusqu'à son approbation par l'administrateur.",
          link: { label: 'Créer un compte gestionnaire', to: '/inscription' },
        },
        {
          q: 'Une place est en travaux. Comment la bloquer ?',
          a: "Dans « Parkings & places », cliquez la place puis « Mettre hors service ». Elle n'est plus réservable jusqu'à sa remise en service.",
        },
      ],
    },
    {
      title: 'Mon compte',
      icon: 'user',
      items: [
        {
          q: 'Pourquoi mon immatriculation est-elle refusée ?',
          a: "Une immatriculation ne peut être enregistrée que sur un seul compte. Vérifiez le format (ex. 230 TU 1111) ou contactez-nous si elle est utilisée par quelqu'un d'autre.",
        },
        {
          q: 'Mon compte est suspendu.',
          a: "Un administrateur a suspendu l'accès. Écrivez-nous avec le formulaire ci-dessous pour connaître la raison.",
        },
      ],
    },
  ];

  protected form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    topic: ['reservation' as ContactTopic, Validators.required],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  constructor() {
    // Utilisateur connecté : nom et e-mail préremplis
    const u = this.auth.user();
    if (u) this.form.patchValue({ name: `${u.first_name} ${u.last_name}`, email: u.email });
  }

  /** Vrai si le champ est invalide et que l'utilisateur l'a déjà quitté (ou a tenté d'envoyer) */
  protected invalid(name: 'name' | 'email' | 'message') {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Accessibilité : le focus va sur le premier champ en erreur
      document.querySelector<HTMLElement>('form .ng-invalid:not(form)')?.focus();
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    this.api.sendContact(this.form.getRawValue()).subscribe({
      next: (r) => {
        this.sent.set(r.id);
        this.sending.set(false);
        this.form.controls.message.reset('');
      },
      error: (e) => {
        this.error.set(
          errorMessage(e, "Le message n'a pas pu être envoyé. Réessayez dans un instant."),
        );
        this.sending.set(false);
      },
    });
  }

  newMessage() {
    this.sent.set(null);
    this.form.controls.message.markAsUntouched();
  }
}
