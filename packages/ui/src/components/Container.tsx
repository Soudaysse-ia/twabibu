import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

/** 1200 px column with the 16 / 24 / 32 px side gutters of the design system. */
export function Container({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8', className)} {...rest} />;
}
