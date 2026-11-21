import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, HeartPulse, Pill, Stethoscope } from 'lucide-react';
import { fr, HELP_ARTICLES, HELP_AUDIENCES, type HelpAudience } from '@twabibu/i18n';
import { Card, Container } from '@twabibu/ui';
import { HelpContactCard } from '@/components/content/HelpContactCard';

export const metadata: Metadata = { title: fr.help.title, description: fr.help.intro };

const ICONS: Record<HelpAudience, typeof HeartPulse> = {
  PATIENT: HeartPulse,
  PRACTITIONER: Stethoscope,
  PHARMACY: Pill,
};

/** Help centre (WEB-02): articles grouped for patients, practitioners and pharmacies. */
export default function Page() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-3xl font-bold text-ink">{fr.help.title}</h1>
          <p className="text-lg text-text">{fr.help.intro}</p>
        </header>

        {(Object.keys(HELP_AUDIENCES) as HelpAudience[]).map((audience) => {
          const Icon = ICONS[audience];
          const articles = HELP_ARTICLES.filter((a) => a.audience === audience);
          return (
            <section key={audience} aria-labelledby={`help-${audience}`} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <div>
                  <h2 id={`help-${audience}`} className="text-xl font-bold text-ink">
                    {HELP_AUDIENCES[audience].title}
                  </h2>
                  <p className="text-sm text-text-muted">{HELP_AUDIENCES[audience].intro}</p>
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {articles.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/aide/${a.slug}`}
                      className="group block h-full rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <Card className="flex h-full min-h-11 items-start justify-between gap-3 p-4 transition-colors group-hover:border-primary">
                        <span className="flex flex-col gap-1">
                          <span className="font-bold text-ink group-hover:text-primary">{a.title}</span>
                          <span className="text-sm text-text-muted">{a.summary}</span>
                        </span>
                        <ChevronRight
                          aria-hidden="true"
                          size={18}
                          className="mt-0.5 shrink-0 text-text-muted group-hover:text-primary"
                        />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <HelpContactCard />
      </div>
    </Container>
  );
}
