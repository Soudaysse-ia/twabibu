import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { smsTemplates, toGsm } from './sms-templates.js';

const GSM7 = /^[A-Za-z0-9 @£$¥\n\r_!"#%&'()*+,\-./:;<=>?¡¿ÄÖÑÜ§äöñüà]*$/;

describe('SMS templates', () => {
  const longCase = {
    practitionerName: 'Dr Mohamed-Abdallah Saïd Ben Youssouf El-Maarouf',
    locality: 'Nioumachoua-Ouallah',
    startsAt: new Date('2026-11-13T07:20:00Z'),
    manageUrl: 'twabibu.km/mon-compte/rendez-vous',
  };

  it('fits in one SMS and uses only GSM-7 characters, even with long names', () => {
    for (const text of [
      smsTemplates.otp('482193'),
      smsTemplates.appointmentBooked(longCase),
      smsTemplates.appointmentPending(longCase),
      smsTemplates.appointmentAccepted(longCase),
      smsTemplates.appointmentRefused({ ...longCase, manageUrl: 'twabibu.km/medecin-generaliste/moroni/amina-said' }),
      smsTemplates.appointmentRescheduled(longCase),
      smsTemplates.appointmentCancelledByPractice({ ...longCase, manageUrl: 'twabibu.km/medecin-generaliste/moroni/amina-said' }),
      smsTemplates.appointmentCancelledByPatient({ ...longCase, manageUrl: 'twabibu.km/medecin-generaliste/moroni/amina-said' }),
      smsTemplates.appointmentReminder({ ...longCase, manageUrl: 'twabibu.km/medecin-generaliste/nioumachoua/mohamed-abdallah-said' }),
    ]) {
      assert.ok(text.length <= 160, `${text.length} chars: ${text}`);
      assert.match(text, GSM7, text);
    }
  });

  it('keeps the reminder link whole and drops the place first when space runs out', () => {
    const short = smsTemplates.appointmentReminder({ ...longCase, practitionerName: 'Dr Amina Saïd', locality: 'Moroni' });
    assert.equal(short, 'Twabibu : rappel RDV ven. 13 nov. 10:20 avec Dr Amina Said, Moroni. Gerer : twabibu.km/mon-compte/rendez-vous');
    const long = smsTemplates.appointmentReminder({ ...longCase, manageUrl: 'twabibu.km/medecin-generaliste/nioumachoua/mohamed-abdallah-said-ben-y' });
    assert.ok(long.length <= 160 && long.endsWith('twabibu.km/medecin-generaliste/nioumachoua/mohamed-abdallah-said-ben-y'), long);
  });

  it('shows the local time of the Comoros and no medical information', () => {
    const text = smsTemplates.appointmentBooked({ ...longCase, practitionerName: 'Dr Amina Saïd', locality: 'Moroni' });
    assert.equal(text, 'Twabibu : RDV confirme ven. 13 nov. 10:20 avec Dr Amina Said, Moroni. Gerer : twabibu.km/mon-compte/rendez-vous');
  });

  it('strips accents and typographic quotes', () => {
    assert.equal(toGsm('Médecin « généraliste » à l’hôpital'), 'Medecin " generaliste " a l\'hopital');
  });
});
