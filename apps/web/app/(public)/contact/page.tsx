import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@twabibu/i18n';
import { Card, Container } from '@twabibu/ui';
import { ContactForm } from '@/components/ContactForm';

export const metadata: Metadata = { title: fr.contact.title, description: fr.contact.intro };

const t = fr.contact;

/** Contact page (WEB-02): what to check first, then the form. */
export default function Page() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold text-ink">{t.title}</h1>
            <p className="text-lg text-text">{t.intro}</p>
          </header>
          <Card className="p-5 sm:p-6">
            <ContactForm />
          </Card>
        </div>
        <aside aria-labelledby="before-title" className="flex flex-col gap-4">
          <h2 id="before-title" className="text-lg font-bold text-ink">
            {t.beforeTitle}
          </h2>
          <ul className="flex flex-col gap-3 text-sm text-text">
            <li>
              {t.beforeHelp}{' '}
              <Link href="/aide" className="font-medium text-primary hover:underline">
                {fr.help.title}
              </Link>
            </li>
            <li>{t.beforeAppointment}</li>
            <li className="rounded-md bg-danger-soft p-3 font-medium text-danger">{t.emergency}</li>
          </ul>
        </aside>
      </div>
    </Container>
  );
}
