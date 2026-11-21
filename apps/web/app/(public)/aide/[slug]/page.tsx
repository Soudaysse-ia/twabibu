import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fr, HELP_ARTICLES, HELP_AUDIENCES, helpArticle } from '@twabibu/i18n';
import { buttonClasses, cn, Container } from '@twabibu/ui';
import { ContentBlocks } from '@/components/content/ContentBlocks';
import { HelpContactCard } from '@/components/content/HelpContactCard';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = helpArticle((await params).slug);
  return article ? { title: `${article.title} · ${fr.help.title}`, description: article.summary } : {};
}

/** One help article (WEB-02), with the other articles for the same audience. */
export default async function Page({ params }: Props) {
  const article = helpArticle((await params).slug);
  if (!article) notFound();
  const related = HELP_ARTICLES.filter((a) => a.audience === article.audience && a.slug !== article.slug);

  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="flex flex-col gap-6">
          <Link
            href="/aide"
            className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
          >
            {fr.help.back}
          </Link>
          <header className="flex flex-col gap-2">
            <p className="text-xs font-bold tracking-wide text-text-muted uppercase">
              {HELP_AUDIENCES[article.audience].title}
            </p>
            <h1 className="text-3xl font-bold text-ink">{article.title}</h1>
            <p className="text-lg text-text">{article.summary}</p>
          </header>
          <ContentBlocks blocks={article.body} />
          {article.action ? (
            <Link
              href={article.action.href}
              className={cn(buttonClasses({ variant: 'primary' }), 'self-start')}
            >
              {article.action.label}
            </Link>
          ) : null}
        </article>

        <aside className="flex flex-col gap-6">
          {related.length ? (
            <nav aria-labelledby="related-title" className="flex flex-col gap-2">
              <h2 id="related-title" className="text-sm font-bold text-ink">
                {fr.help.related}
              </h2>
              <ul className="flex flex-col">
                {related.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/aide/${a.slug}`}
                      className="flex min-h-11 items-center border-b border-border py-2 text-sm text-text hover:text-primary"
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <HelpContactCard compact />
        </aside>
      </div>
    </Container>
  );
}
