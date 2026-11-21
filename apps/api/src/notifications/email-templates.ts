import { formatDateLong, formatTime } from '@twabibu/utils';

/**
 * Transactional e-mails (SPEC-08, ADR-016). Rules: plain French, no medical information
 * (no motive, no diagnosis), always the practitioner, the date, the address and where to manage.
 * Every e-mail has a text version for basic mail apps.
 */
export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface AppointmentEmailData {
  firstName: string;
  practitionerName: string;
  address: string;
  startsAt: Date;
  manageUrl: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function when(d: Date): string {
  const long = formatDateLong(d);
  return `${long.charAt(0).toUpperCase()}${long.slice(1)} à ${formatTime(d)}`;
}

/** Light layout in the Twabibu colours, readable without images (many mail apps block them). */
function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:#2B4162">${p}</p>`).join('');
  const button = cta
    ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#2A6BCB;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;font-size:14px">${esc(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#E8EEF7;font-family:Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8EEF7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#2A6BCB;padding:18px 24px;color:#ffffff;font-family:Montserrat,Arial,sans-serif;font-size:22px;font-weight:800">Twabibu</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-family:Montserrat,Arial,sans-serif;font-size:20px;color:#0B2A5B">${esc(title)}</h1>
${body}${button}
</td></tr>
<tr><td style="padding:16px 24px;background:#F3F6FB;font-size:12px;line-height:18px;color:#5D7186">À vos côtés, dans chaque temps de soin.<br>En cas d’urgence, rendez-vous à l’hôpital le plus proche. Ce message est automatique, merci de ne pas y répondre.</td></tr>
</table></td></tr></table></body></html>`;
}

function appointmentEmail(subject: string, title: string, intro: string, d: AppointmentEmailData, outro: string, ctaLabel: string): RenderedEmail {
  const details = `${when(d.startsAt)}<br>${esc(d.practitionerName)}<br>${esc(d.address)}`;
  return {
    subject,
    text: `Bonjour ${d.firstName},\n\n${intro}\n\n${when(d.startsAt)}\n${d.practitionerName}\n${d.address}\n\n${outro}\n${ctaLabel} : ${d.manageUrl}\n\nTwabibu, à vos côtés dans chaque temps de soin.`,
    html: layout(title, [`Bonjour ${esc(d.firstName)},`, esc(intro), `<strong style="color:#0B2A5B">${details}</strong>`, esc(outro)], { label: ctaLabel, url: d.manageUrl }),
  };
}

export interface ReminderEmailData extends AppointmentEmailData {
  /** Present when the practice asks patients to confirm they will come. */
  confirmUrl?: string;
  /** Account holders can stop reminders from their account. */
  preferencesUrl?: string;
}

export const emailTemplates = {
  otp: (code: string): RenderedEmail => ({
    subject: `Votre code Twabibu : ${code}`,
    text: `Votre code de connexion Twabibu est ${code}.\nIl est valable 5 minutes. Ne le communiquez à personne : Twabibu ne vous le demandera jamais.`,
    html: layout('Votre code de connexion', [
      'Saisissez ce code sur Twabibu pour continuer :',
      `<span style="display:inline-block;font-size:30px;letter-spacing:8px;font-weight:bold;color:#0B2A5B;background:#E6EEF9;padding:10px 16px;border-radius:8px">${esc(code)}</span>`,
      'Il est valable 5 minutes. Ne le communiquez à personne : Twabibu ne vous le demandera jamais.',
    ]),
  }),

  appointmentBooked: (d: AppointmentEmailData) =>
    appointmentEmail(`Rendez-vous confirmé le ${formatDateLong(d.startsAt)}`, 'Votre rendez-vous est confirmé', 'Votre rendez-vous est confirmé :', d, 'Vous recevrez un rappel la veille. Si vous ne pouvez pas venir, annulez-le pour libérer la place.', 'Gérer mon rendez-vous'),

  appointmentPending: (d: AppointmentEmailData) =>
    appointmentEmail('Demande de rendez-vous envoyée', 'Votre demande est envoyée', 'Le cabinet doit valider votre demande de rendez-vous :', d, 'Vous recevrez sa réponse par e-mail.', 'Voir ma demande'),

  /** The practice accepted an online request (SPEC-05 §Règles 6). */
  appointmentAccepted: (d: AppointmentEmailData) =>
    appointmentEmail(`Rendez-vous confirmé le ${formatDateLong(d.startsAt)}`, 'Votre demande est acceptée', 'Le cabinet a accepté votre demande. Votre rendez-vous est confirmé :', d, 'Vous recevrez un rappel la veille. Si vous ne pouvez pas venir, annulez-le pour libérer la place.', 'Gérer mon rendez-vous'),

  /** The practice declined an online request: no reason is sent, the patient can pick another time. */
  appointmentRefused: (d: AppointmentEmailData) =>
    appointmentEmail('Votre demande de rendez-vous n’a pas été acceptée', 'Votre demande n’a pas été acceptée', 'Le cabinet ne peut pas vous recevoir à l’horaire demandé :', d, 'Vous pouvez choisir un autre créneau en ligne.', 'Choisir un autre créneau'),

  appointmentRescheduled: (d: AppointmentEmailData) =>
    appointmentEmail(`Rendez-vous déplacé au ${formatDateLong(d.startsAt)}`, 'Votre rendez-vous a été déplacé', 'Le cabinet a déplacé votre rendez-vous. Nouvelle date :', d, 'Si cet horaire ne vous convient pas, contactez le cabinet.', 'Voir mon rendez-vous'),

  appointmentCancelledByPractice: (d: AppointmentEmailData) =>
    appointmentEmail('Votre rendez-vous est annulé', 'Le cabinet a annulé votre rendez-vous', 'Nous sommes désolés : le cabinet a dû annuler ce rendez-vous :', d, 'Vous pouvez reprendre rendez-vous en ligne.', 'Reprendre rendez-vous'),

  appointmentCancelledByPatient: (d: AppointmentEmailData) =>
    appointmentEmail('Annulation confirmée', 'Votre rendez-vous est annulé', 'Nous confirmons l’annulation de ce rendez-vous :', d, 'Le créneau a été libéré pour un autre patient.', 'Reprendre rendez-vous'),
  /** Order status for the patient. Never the products: an order reveals a treatment. */
  /** Reminder before the appointment. The main button confirms presence when the practice asks for it. */
  appointmentReminder: (d: ReminderEmailData): RenderedEmail => {
    const details = `${when(d.startsAt)}<br>${esc(d.practitionerName)}<br>${esc(d.address)}`;
    const cancel = `Vous ne pouvez pas venir ? <a href="${esc(d.manageUrl)}" style="color:#2A6BCB">Annulez votre rendez-vous</a> pour libérer la place.`;
    const stop = d.preferencesUrl ? `<span style="font-size:12px;color:#5D7186">Vous ne souhaitez plus de rappels ? <a href="${esc(d.preferencesUrl)}" style="color:#5D7186">Réglez vos préférences</a>.</span>` : null;
    const textLines = [
      `Bonjour ${d.firstName},`,
      '',
      'Petit rappel de votre rendez-vous :',
      '',
      when(d.startsAt),
      d.practitionerName,
      d.address,
      '',
      ...(d.confirmUrl ? [`Le cabinet vous demande de confirmer votre présence : ${d.confirmUrl}`, ''] : []),
      `Vous ne pouvez pas venir ? Annulez pour libérer la place : ${d.manageUrl}`,
      ...(d.preferencesUrl ? ['', `Ne plus recevoir de rappels : ${d.preferencesUrl}`] : []),
      '',
      'Twabibu, à vos côtés dans chaque temps de soin.',
    ];
    return {
      subject: `Rappel : rendez-vous le ${formatDateLong(d.startsAt)} à ${formatTime(d.startsAt)}`,
      text: textLines.join('\n'),
      html: layout(
        'Rappel de votre rendez-vous',
        [`Bonjour ${esc(d.firstName)},`, 'Petit rappel de votre rendez-vous :', `<strong style="color:#0B2A5B">${details}</strong>`, ...(d.confirmUrl ? ['Le cabinet vous demande de confirmer votre présence.'] : []), cancel, ...(stop ? [stop] : [])],
        d.confirmUrl ? { label: 'Je confirme ma présence', url: d.confirmUrl } : { label: 'Voir mon rendez-vous', url: d.manageUrl },
      ),
    };
  },

  orderStatus: (d: OrderEmailData): RenderedEmail => {
    const copy = ORDER_COPY[d.status];
    const courier = d.status === 'OUT_FOR_DELIVERY' && d.courier ? ` Livreur : ${d.courier.name}, ${d.courier.phone}.` : '';
    const intro = `${copy.text}${courier}`;
    return {
      subject: `${copy.subject} · ${d.pharmacyName}`,
      text: `Bonjour ${d.firstName},\n\n${intro}\n\n${d.pharmacyName}\n${d.pharmacyAddress}\nCommande n° ${d.reference}\n\nSuivre ma commande : ${d.url}\n\nTwabibu, à vos côtés dans chaque temps de soin.`,
      html: layout(copy.subject, [`Bonjour ${esc(d.firstName)},`, esc(intro), `<strong style="color:#0B2A5B">${esc(d.pharmacyName)}<br>${esc(d.pharmacyAddress)}<br>Commande n° ${esc(d.reference)}</strong>`], {
        label: 'Suivre ma commande',
        url: d.url,
      }),
    };
  },

  /** The pharmacy answered a prescription sent by the patient (availability and price are in the account, not in the e-mail). */
  prescriptionAnswered: (d: { firstName: string; pharmacyName: string; url: string }): RenderedEmail => ({
    subject: `${d.pharmacyName} a répondu à votre demande`,
    text: `Bonjour ${d.firstName},\n\n${d.pharmacyName} a vérifié votre ordonnance et vous indique la disponibilité et le prix.\nConsultez la réponse et confirmez votre commande : ${d.url}\n\nTwabibu, à vos côtés dans chaque temps de soin.`,
    html: layout('La pharmacie a répondu', [`Bonjour ${esc(d.firstName)},`, `${esc(d.pharmacyName)} a vérifié votre ordonnance et vous indique la disponibilité et le prix.`, 'Consultez la réponse dans votre compte, puis confirmez la commande si elle vous convient.'], {
      label: 'Voir la réponse',
      url: d.url,
    }),
  }),

  /** Alert for the pharmacy team: something is waiting in Twabibu Pharma. */
  pharmacyNewRequest: (d: { pharmacyName: string; kind: 'ORDER' | 'PRESCRIPTION'; url: string }): RenderedEmail => {
    const what = d.kind === 'ORDER' ? 'Une nouvelle commande' : 'Une nouvelle ordonnance';
    return {
      subject: `${what} pour ${d.pharmacyName}`,
      text: `${what} vous attend dans Twabibu Pharma.\n${d.url}`,
      html: layout(`${what} vous attend`, [`${what} vous attend dans Twabibu Pharma.`, 'Répondez rapidement : le patient est prévenu par e-mail à chaque étape.'], { label: 'Ouvrir Twabibu Pharma', url: d.url }),
    };
  },
  /** Back-office decision on a practitioner or pharmacy file (SPEC-11 §2). */
  proWelcome: (d: { name: string; url: string }): RenderedEmail => {
    const subject = 'Bienvenue sur Twabibu Pro';
    const lines = [
      'Votre compte professionnel est créé. Vous pouvez dès maintenant régler votre agenda, vos motifs et vos horaires.',
      'Votre profil sera visible des patients après la vérification de votre dossier par l’équipe Twabibu (sous 48 h ouvrées). Nous pourrons vous appeler pour confirmer votre identité.',
    ];
    return {
      subject,
      text: `Bonjour ${d.name},\n\n${lines.join('\n\n')}\n\n${d.url}\n\nTwabibu, à vos côtés dans chaque temps de soin.`,
      html: layout(subject, [`Bonjour ${esc(d.name)},`, ...lines.map(esc)], { label: 'Ouvrir mon espace', url: d.url }),
    };
  },
  verificationDecision: (d: { name: string; decision: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'SUSPENDED' | 'REACTIVATED'; message?: string; url: string }): RenderedEmail => {
    const copy = {
      VERIFIED: ['Votre profil est vérifié', 'Bonne nouvelle : votre dossier est validé. Votre profil est maintenant visible des patients sur Twabibu.'],
      CHANGES_REQUESTED: ['Votre dossier est à compléter', 'L’équipe Twabibu a besoin d’un complément pour valider votre dossier.'],
      REJECTED: ['Votre dossier n’a pas été validé', 'L’équipe Twabibu ne peut pas valider votre dossier pour le moment. Votre profil n’est pas visible des patients.'],
      SUSPENDED: ['Votre structure est suspendue', 'Votre structure est suspendue sur Twabibu : elle n’est plus visible des patients et l’espace professionnel est fermé.'],
      REACTIVATED: ['Votre structure est réactivée', 'Votre structure est de nouveau active sur Twabibu.'],
    }[d.decision];
    const paragraphs = [`Bonjour ${esc(d.name)},`, esc(copy[1]!), ...(d.message ? [`<strong style="color:#0B2A5B">Message de l’équipe :</strong> ${esc(d.message)}`] : [])];
    return {
      subject: copy[0]!,
      text: `Bonjour ${d.name},\n\n${copy[1]}${d.message ? `\n\nMessage de l’équipe : ${d.message}` : ''}\n\n${d.url}\n\nTwabibu, à vos côtés dans chaque temps de soin.`,
      html: layout(copy[0]!, paragraphs, { label: 'Ouvrir mon espace', url: d.url }),
    };
  },

  /** Contact form (WEB-02), sent to the support address only. The sender's text is escaped and never shown as HTML. */
  contactMessage: (d: { name: string; email: string; topicLabel: string; message: string; receivedAt: Date }): RenderedEmail => ({
    subject: `Contact (${d.topicLabel}) : ${d.name}`,
    text: `Nouveau message reçu par le formulaire de contact.\n\nDe : ${d.name} <${d.email}>\nProfil : ${d.topicLabel}\nReçu : ${when(d.receivedAt)}\n\n${d.message}\n\nRépondez directement à ${d.email}.`,
    html: layout('Nouveau message de contact', [
      `<strong style="color:#0B2A5B">De :</strong> ${esc(d.name)} &lt;${esc(d.email)}&gt;<br><strong style="color:#0B2A5B">Profil :</strong> ${esc(d.topicLabel)}<br><strong style="color:#0B2A5B">Reçu :</strong> ${esc(when(d.receivedAt))}`,
      esc(d.message).replace(/\r?\n/g, '<br>'),
      `Répondez directement à ${esc(d.email)}.`,
    ]),
  }),
} as const;

export interface OrderEmailData {
  firstName: string;
  pharmacyName: string;
  pharmacyAddress: string;
  reference: string;
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  courier?: { name: string; phone: string } | null;
  url: string;
}

const ORDER_COPY: Record<OrderEmailData['status'], { subject: string; text: string }> = {
  PENDING: { subject: 'Commande envoyée', text: 'Votre commande est envoyée à la pharmacie. Elle vous répondra rapidement.' },
  ACCEPTED: { subject: 'Commande acceptée', text: 'La pharmacie a accepté votre commande.' },
  PREPARING: { subject: 'Commande en préparation', text: 'La pharmacie prépare votre commande.' },
  READY: { subject: 'Commande prête', text: 'Votre commande est prête : vous pouvez la retirer à la pharmacie. Le paiement se fait sur place.' },
  OUT_FOR_DELIVERY: { subject: 'Commande en livraison', text: 'Votre commande est en route. Le paiement se fait à la livraison.' },
  DELIVERED: { subject: 'Commande remise', text: 'Votre commande vous a été remise. Merci de votre confiance.' },
  CANCELLED: { subject: 'Commande annulée', text: 'Votre commande est annulée. Contactez la pharmacie pour toute question.' },
};

export type EmailTemplate = keyof typeof emailTemplates;
