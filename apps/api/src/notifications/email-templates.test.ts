import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emailTemplates } from './email-templates.js';

describe('e-mail templates', () => {
  const data = { firstName: 'Amina', practitionerName: 'Dr Saïd <script>', address: 'Route de la Corniche, Moroni', startsAt: new Date('2026-11-13T07:20:00Z'), manageUrl: 'https://twabibu.km/mon-compte/rendez-vous' };

  it('shows the Comoros local time and the link, in text and HTML', () => {
    const e = emailTemplates.appointmentBooked(data);
    assert.equal(e.subject, 'Rendez-vous confirmé le vendredi 13 novembre 2026');
    assert.ok(e.text.includes('Vendredi 13 novembre 2026 à 10:20'));
    assert.ok(e.text.includes('https://twabibu.km/mon-compte/rendez-vous'));
    assert.ok(e.html.includes('href="https://twabibu.km/mon-compte/rendez-vous"'));
  });

  it('escapes names in HTML', () => {
    const e = emailTemplates.appointmentCancelledByPractice(data);
    assert.ok(!e.html.includes('<script>'));
    assert.ok(e.html.includes('Dr Saïd &lt;script&gt;'));
  });

  it('reminds with a confirmation button only when the practice asks, and never shows the motive', () => {
    const plain = emailTemplates.appointmentReminder(data);
    assert.equal(plain.subject, 'Rappel : rendez-vous le vendredi 13 novembre 2026 à 10:20');
    assert.ok(plain.html.includes('Voir mon rendez-vous'));
    assert.ok(!plain.html.includes('Je confirme'));
    const asked = emailTemplates.appointmentReminder({ ...data, confirmUrl: 'https://twabibu.km/rendez-vous/abc/confirmer?t=x', preferencesUrl: 'https://twabibu.km/mon-compte/profil#rappels' });
    assert.ok(asked.html.includes('href="https://twabibu.km/rendez-vous/abc/confirmer?t=x"'));
    assert.ok(asked.text.includes('Ne plus recevoir de rappels : https://twabibu.km/mon-compte/profil#rappels'));
    assert.ok(!asked.html.includes('<script>'));
  });

  it('puts the code in the subject so it can be read from the notification', () => {
    const e = emailTemplates.otp('482193');
    assert.equal(e.subject, 'Votre code Twabibu : 482193');
    assert.ok(e.html.includes('482193'));
  });

  it('offers other times when the practice cancels, as booking links, escaped', () => {
    const plain = emailTemplates.appointmentCancelledByPractice(data);
    assert.equal(plain.subject, 'Votre rendez-vous est annulé');
    const offered = emailTemplates.appointmentCancelledByPractice({
      ...data,
      manageUrl: 'https://twabibu.km/medecin-generaliste/moroni/amina-said/reserver?motif=m1',
      alternatives: [{ startsAt: new Date('2026-11-16T06:00:00Z'), url: 'https://twabibu.km/x/reserver?motif=m1&creneau=a"b' }],
    });
    assert.equal(offered.subject, 'Votre rendez-vous est annulé : choisissez un autre horaire');
    assert.ok(offered.html.includes('Lundi 16 novembre 2026 à 09:00'));
    assert.ok(offered.html.includes('creneau=a&quot;b'), 'links are escaped');
    assert.ok(offered.text.includes('- Lundi 16 novembre 2026 à 09:00 : https://twabibu.km/x/reserver?motif=m1&creneau=a"b'));
    assert.ok(offered.html.includes('Voir toutes les disponibilités'));
  });
});
