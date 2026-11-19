import QRCode from 'qrcode';
import { formatDateLong } from '@twabibu/utils';
import { SITE_URL } from '@/lib/env';
import { ageOf, type PrescriptionDoc } from '@/lib/medical-types';

/**
 * Printable prescription (SPEC-14 §Sortie): prescriber header, patient, lines, QR code that opens the public
 * verification page. A5-friendly, black on white, readable when photocopied.
 */
export async function PrescriptionDocument({ doc }: { doc: PrescriptionDoc }) {
  const verifyUrl = doc.qrCode ? `${SITE_URL}/o/${doc.qrCode}` : null;
  const qr = verifyUrl ? await QRCode.toString(verifyUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }) : null;
  const signed = doc.signedAt ? new Date(doc.signedAt) : null;
  return (
    <article className="mx-auto flex w-full max-w-[640px] flex-col gap-6 bg-white p-8 text-[13px] leading-5 text-black shadow-card print:max-w-none print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#1956B4] pb-4">
        <div>
          <p className="font-heading text-lg font-bold text-black">{doc.prescriber.name}</p>
          <p>{doc.prescriber.speciality}</p>
          <p>{doc.prescriber.organization}</p>
          {doc.prescriber.address ? <p>{doc.prescriber.address}</p> : null}
          {doc.prescriber.phone ? <p>Tél. {doc.prescriber.phone}</p> : null}
          {doc.prescriber.licenseNumber ? <p>Autorisation d’exercer n° {doc.prescriber.licenseNumber}</p> : null}
        </div>
        <img src="/brand/twabibu-bleu.svg" alt="Twabibu" className="h-10 w-auto" />
      </header>

      <div className="flex flex-wrap justify-between gap-2">
        <p>
          <span className="text-[#5D7186]">Patient :</span>{' '}
          <strong>
            {doc.patient ? `${doc.patient.firstName} ${doc.patient.lastName}` : '—'}
          </strong>
          {doc.patient?.birthDate ? ` · ${ageOf(doc.patient.birthDate)}` : ''}
        </p>
        <p>{signed ? `Fait le ${formatDateLong(signed)}` : 'Non signée'}</p>
      </div>

      <h1 className="font-heading text-xl font-bold tracking-wide text-black uppercase">Ordonnance</h1>

      <ol className="flex flex-col gap-4">
        {doc.lines.map((l, i) => (
          <li key={i} className="flex gap-3">
            <span className="font-bold">{i + 1}.</span>
            <div>
              <p className="font-bold">
                {l.label}
                {l.form ? <span className="font-normal"> ({l.form})</span> : null}
                {!l.substitutable ? <span className="ml-2 text-[11px] font-bold uppercase">Non substituable</span> : null}
              </p>
              <p>{l.posologyText}</p>
              <p className="text-[#5D7186]">
                {[l.durationDays ? `Pendant ${l.durationDays} jour${l.durationDays > 1 ? 's' : ''}` : null, l.quantity ? `${l.quantity} boîte${l.quantity > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {doc.notes ? <p className="text-[#5D7186]">Note au pharmacien : {doc.notes}</p> : null}

      <footer className="mt-4 flex items-end justify-between gap-4 border-t border-[#D3DCEA] pt-4">
        <div className="text-[11px] text-[#5D7186]">
          <p>Signée électroniquement sur Twabibu{signed ? ` le ${signed.toLocaleDateString('fr-FR', { timeZone: 'Indian/Comoro' })}` : ''}.</p>
          {doc.expiresAt ? <p>Valable jusqu’au {new Date(doc.expiresAt).toLocaleDateString('fr-FR', { timeZone: 'Indian/Comoro' })}.</p> : null}
          {doc.qrCode ? (
            <p>
              Vérification : scannez le code ou saisissez <strong className="text-black">{doc.qrCode}</strong> sur twabibu.km/o
            </p>
          ) : null}
          {doc.contentHash ? <p className="break-all">Empreinte : {doc.contentHash.slice(0, 16)}</p> : null}
        </div>
        {qr ? <div aria-label="QR code de vérification" className="size-24 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} /> : null}
      </footer>
    </article>
  );
}
