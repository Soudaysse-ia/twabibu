import { cn } from '../cn';

/**
 * Official Twabibu logo. Served from /brand (copied from assets/brand/). Never recompose it in text.
 * `white` on blue backgrounds, `blue` on light backgrounds.
 */
export function Logo({ tone = 'white', className, height = 40 }: { tone?: 'white' | 'blue'; className?: string; height?: number }) {
  const ratio = 1110 / 410;
  return (
    <img
      src={tone === 'white' ? '/brand/twabibu-blanc.svg' : '/brand/twabibu-bleu.svg'}
      alt="Twabibu"
      width={Math.round(height * ratio)}
      height={height}
      className={cn('block h-auto', className)}
      style={{ height, width: 'auto' }}
    />
  );
}
