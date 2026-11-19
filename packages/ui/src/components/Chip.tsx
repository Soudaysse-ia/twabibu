import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '../cn';

/** Filter chip (white, radius 16, height 32). */
export function Chip({ selected, className, type = 'button', ...rest }: { selected?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-text hover:border-primary',
        className,
      )}
      {...rest}
    />
  );
}

/** Time slot (40 px). `null` renders the em-dash placeholder of an empty cell. */
export function SlotChip({ label, selected, className, ...rest }: { label: string | null; selected?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  if (label === null) {
    return (
      <span aria-hidden="true" className={cn('flex h-10 items-center justify-center text-sm text-text-muted', className)}>
        —
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'flex h-10 items-center justify-center rounded-md text-sm font-medium tabular-nums transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected ? 'bg-primary text-white' : 'bg-slot text-ink hover:bg-primary hover:text-white',
        className,
      )}
      {...rest}
    >
      {label}
    </button>
  );
}

export function Badge({ tone = 'info', className, ...rest }: { tone?: 'info' | 'success' | 'warning' | 'pharmacy' } & HTMLAttributes<HTMLSpanElement>) {
  const tones = {
    info: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    pharmacy: 'bg-pharmacy-soft text-pharmacy',
  } as const;
  return <span className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-medium', tones[tone], className)} {...rest} />;
}
