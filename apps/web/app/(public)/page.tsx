import Link from 'next/link';
import { CalendarCheck, ChevronRight, CircleHelp, ClipboardList, Cross, ShieldCheck, Smartphone, Stethoscope } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { buttonClasses, Card, CardTitle, Container } from '@twabibu/ui';
import { AvailabilityPreview } from '@/components/AvailabilityPreview';
import { SearchBar } from '@/components/SearchBar';

// Slots in the preview are computed from the current time.
export const dynamic = 'force-dynamic';

const BENEFIT_ICONS = [CalendarCheck, ClipboardList, Cross];

export default function HomePage() {
  const t = fr.home;
  return (
    <>
      {/* Hero: flat blue band, no decorative shapes (art direction 12/11/2026). */}
      <section aria-labelledby="hero-title" className="bg-primary text-white">
        <Container className="grid items-center gap-10 pt-10 pb-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pt-14 lg:pb-16">
          <div className="flex min-w-0 flex-col gap-5">
            <h1 id="hero-title" className="font-heading text-[28px] leading-9 font-bold text-white sm:text-[32px] sm:leading-10">
              {t.title}
            </h1>
            <p className="max-w-xl text-base text-white/90">{t.subtitle}</p>
            <SearchBar className="mt-2" />
            <p className="text-xs font-bold tracking-[0.14em] text-white/85 uppercase">{fr.brand.tagline}</p>
          </div>
          <div className="min-w-0">
            <AvailabilityPreview />
          </div>
        </Container>
      </section>

      {/* Duty pharmacies: the public entry point of the pharmacy module (SPEC-15). */}
      <Container className="-mt-6 sm:-mt-8">
        <div className="relative flex flex-col gap-4 rounded-md border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-pharmacy-soft text-pharmacy">
              <Cross aria-hidden="true" size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold">{t.dutyTitle}</h2>
              <p className="text-text">{t.dutyText}</p>
            </div>
          </div>
          <Link
            href="/pharmacies-de-garde"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-pharmacy px-4 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pharmacy"
          >
            {t.dutyCta}
            <ChevronRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </Container>

      <Container className="flex flex-col gap-16 py-16">
        <section aria-labelledby="companion-title" className="flex flex-col gap-8">
          <h2 id="companion-title" className="text-center text-2xl font-bold">
            {t.companionTitle}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {t.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i]!;
              return (
                <Card key={b.title} className="flex flex-col gap-3 p-6">
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Icon aria-hidden="true" size={22} />
                  </span>
                  <h3 className="text-base font-bold">{b.title}</h3>
                  <p className="text-text">{b.text}</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="steps-title" className="flex flex-col gap-8">
          <h2 id="steps-title" className="text-center text-2xl font-bold">
            {t.stepsTitle}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {t.steps.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-md bg-background-soft p-5">
                <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-bold">{s.title}</h3>
                  <p className="text-text">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="privacy-title">
          <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ShieldCheck aria-hidden="true" size={26} />
            </span>
            <div className="flex-1">
              <h2 id="privacy-title" className="text-xl font-bold">
                {t.privacyTitle}
              </h2>
              <p className="mt-1 max-w-2xl text-text">{t.privacyText}</p>
            </div>
            <Link href="/confidentialite" className={buttonClasses({ variant: 'secondary' })}>
              {t.privacyCta}
            </Link>
          </Card>
        </section>

        <section aria-label="Pour les professionnels" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="flex flex-col gap-4 border-l-4 border-l-primary p-6 sm:p-8">
            <CardTitle as="h2" icon={<Stethoscope aria-hidden="true" size={16} />} className="text-xl">
              {t.proTitle}
            </CardTitle>
            <p className="text-text">{t.proIntro}</p>
            <ul className="grid gap-2">
              {t.proPoints.map((p) => (
                <li key={p} className="flex gap-2 text-text">
                  <ChevronRight aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-primary" />
                  {p}
                </li>
              ))}
            </ul>
            <Link href="/pro" className={buttonClasses({ variant: 'primary' }) + ' self-start'}>
              {t.proCta}
            </Link>
          </Card>
          <Card className="flex flex-col gap-4 border-l-4 border-l-pharmacy p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-pharmacy-soft text-pharmacy">
                <Cross aria-hidden="true" size={16} />
              </span>
              {t.pharmaTitle}
            </h2>
            <p className="text-text">{t.pharmaText}</p>
            <Link href="/pharma" className={buttonClasses({ variant: 'secondary' }) + ' mt-auto self-start'}>
              {t.pharmaCta}
            </Link>
          </Card>
        </section>

        <section aria-labelledby="apps-title" className="grid gap-4 md:grid-cols-2">
          <Card className="flex gap-4 p-6">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Smartphone aria-hidden="true" size={22} />
            </span>
            <div>
              <h2 id="apps-title" className="text-lg font-bold">
                {t.appsTitle}
              </h2>
              <p className="text-text">{t.appsText}</p>
            </div>
          </Card>
          <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <CircleHelp aria-hidden="true" size={22} />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{t.helpTitle}</h2>
              <p className="text-text">{t.helpText}</p>
            </div>
            <Link href="/aide" className={buttonClasses({ variant: 'primary', size: 'sm' }) + ' self-start sm:self-center'}>
              {t.helpCta}
            </Link>
          </Card>
        </section>
      </Container>
    </>
  );
}
