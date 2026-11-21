import Link from 'next/link';
import { Mail } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { buttonClasses, Card, cn } from '@twabibu/ui';

/** « Vous ne trouvez pas votre réponse ? » block at the end of the help centre and beside each article. */
export function HelpContactCard({ compact = false }: { compact?: boolean }) {
  return (
    <Card
      className={cn(
        'flex gap-4 p-5',
        compact ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between sm:p-6',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Mail aria-hidden="true" size={18} />
        </span>
        <div>
          <h2 className="font-bold text-ink">{fr.help.otherQuestion}</h2>
          <p className="text-sm text-text-muted">{fr.help.otherQuestionText}</p>
        </div>
      </div>
      <Link
        href="/contact"
        className={cn(buttonClasses({ variant: 'secondary' }), 'self-start', !compact && 'sm:self-auto')}
      >
        {fr.help.contactCta}
      </Link>
    </Card>
  );
}
