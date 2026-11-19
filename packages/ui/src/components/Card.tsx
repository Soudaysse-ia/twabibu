import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-border bg-surface p-5 shadow-card', className)} {...rest} />;
}

/** Card title with a round icon, as on Doctolib profile sections (14 px Montserrat). */
export function CardTitle({ icon, children, as: Tag = 'h3', className }: { icon?: ReactNode; children: ReactNode; as?: 'h2' | 'h3'; className?: string }) {
  return (
    <Tag className={cn('flex items-center gap-2 font-heading text-sm font-bold text-navy', className)}>
      {icon ? <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</span> : null}
      {children}
    </Tag>
  );
}
