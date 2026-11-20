import { Info } from 'lucide-react';
import type { HelpBlock } from '@twabibu/i18n';

/**
 * Renders the structured text of the help centre and the legal pages (WEB-02). Plain text only: React escapes every
 * string, so content can never inject markup.
 */
export function ContentBlocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="flex flex-col gap-4 text-base leading-relaxed text-text">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'p':
            return <p key={i}>{block.text}</p>;
          case 'list':
            return (
              <ul key={i} className="flex list-disc flex-col gap-2 pl-5 marker:text-primary">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case 'steps':
            return (
              <ol key={i} className="flex flex-col gap-3">
                {block.items.map((item, n) => (
                  <li key={item} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
                    >
                      {n + 1}
                    </span>
                    <span className="pt-0.5">{item}</span>
                  </li>
                ))}
              </ol>
            );
          case 'note':
            return (
              <p key={i} className="flex gap-3 rounded-md bg-primary-soft p-4 text-sm text-ink">
                <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-primary" />
                <span>{block.text}</span>
              </p>
            );
        }
      })}
    </div>
  );
}
