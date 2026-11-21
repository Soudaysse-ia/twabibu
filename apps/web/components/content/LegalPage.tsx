import Link from 'next/link';
import { FileWarning } from 'lucide-react';
import { fr, LEGAL_STATUS, type LegalDocument } from '@twabibu/i18n';
import { Card, Container } from '@twabibu/ui';
import { ContentBlocks } from './ContentBlocks';

/** About, legal notice, privacy and terms (WEB-02): one layout, a table of contents for the long documents. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const withToc = doc.sections.length > 4;
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold text-ink">{doc.title}</h1>
          {doc.legal ? (
            <p className="text-sm text-text-muted">{fr.legal.updatedOn(LEGAL_STATUS.updatedOn)}</p>
          ) : null}
          {doc.intro ? <p className="text-lg text-text">{doc.intro}</p> : null}
        </header>

        {doc.legal && LEGAL_STATUS.draft ? (
          <p
            role="note"
            className="flex gap-3 rounded-md border border-warning bg-warning-soft p-4 text-sm text-ink"
          >
            <FileWarning aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-warning" />
            <span>
              <strong>{fr.legal.draftLabel}.</strong> {LEGAL_STATUS.draftNotice}
            </span>
          </p>
        ) : null}

        {withToc ? (
          <Card className="p-5">
            <nav aria-labelledby="toc-title">
              <h2 id="toc-title" className="mb-3 text-sm font-bold text-ink">
                {fr.legal.toc}
              </h2>
              <ol className="grid list-decimal gap-1.5 pl-5 text-sm sm:grid-cols-2">
                {doc.sections.map((s, i) => (
                  <li key={s.title}>
                    <Link href={`#section-${i + 1}`} className="text-primary hover:underline">
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          </Card>
        ) : null}

        {doc.sections.map((s, i) => (
          <section
            key={s.title}
            id={`section-${i + 1}`}
            aria-labelledby={`section-${i + 1}-title`}
            className="flex scroll-mt-24 flex-col gap-3"
          >
            <h2 id={`section-${i + 1}-title`} className="text-xl font-bold text-ink">
              {s.title}
            </h2>
            <ContentBlocks blocks={s.body} />
          </section>
        ))}
      </div>
    </Container>
  );
}
