import Link from 'next/link';
import { REFERENCE_ISLANDS, REFERENCE_SPECIALITIES } from '@twabibu/contracts';
import { fr } from '@twabibu/i18n';
import { Container, Logo } from '@twabibu/ui';

const FOOTER_SPECIALITIES = REFERENCE_SPECIALITIES.filter((s) => s.group !== 'PHARMACY' && s.group !== 'LAB').slice(0, 12);

/** Light footer with SEO links (art direction: no dark band at the bottom of the page). */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Logo tone="blue" height={44} />
          <p className="max-w-xs text-sm text-text-muted">{fr.brand.tagline}</p>
          <p className="max-w-xs text-xs text-text-muted">{fr.footer.emergency}</p>
        </div>
        <nav aria-labelledby="footer-specialities">
          <h2 id="footer-specialities" className="mb-3 text-sm font-bold">
            {fr.footer.specialitiesTitle}
          </h2>
          <ul className="grid gap-1.5 text-sm">
            {FOOTER_SPECIALITIES.map((s) => (
              <li key={s.slug}>
                <Link href={`/recherche?q=${s.slug}`} className="text-text hover:text-primary hover:underline">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-islands">
          <h2 id="footer-islands" className="mb-3 text-sm font-bold">
            {fr.footer.islandsTitle}
          </h2>
          <ul className="grid gap-1.5 text-sm">
            {REFERENCE_ISLANDS.map((i) => (
              <li key={i.code}>
                <Link href={`/recherche?ou=${i.slug}`} className="text-text hover:text-primary hover:underline">
                  {i.name} <span className="text-text-muted">({i.frenchName})</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/pharmacies-de-garde" className="text-text hover:text-primary hover:underline">
                {fr.footer.dutyPharmacies}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-company">
          <h2 id="footer-company" className="mb-3 text-sm font-bold">
            {fr.footer.companyTitle}
          </h2>
          <ul className="grid gap-1.5 text-sm">
            {[
              ['/a-propos', fr.footer.about],
              ['/aide', fr.footer.help],
              ['/pro', fr.footer.pro],
              ['/pharma', fr.footer.pharma],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href!} className="text-text hover:text-primary hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-border bg-background-soft">
        <Container className="flex flex-col gap-3 py-5 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {fr.footer.copyright}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              ['/cgu', fr.footer.terms],
              ['/confidentialite', fr.footer.privacy],
              ['/mentions-legales', fr.footer.legalNotice],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href!} className="hover:text-primary hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}
