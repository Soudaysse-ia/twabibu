import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'navy' | 'accent' | 'ghost' | 'onPrimary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-body font-medium transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-active uppercase tracking-wide',
  secondary: 'bg-surface text-primary border border-border hover:bg-background-soft',
  navy: 'bg-navy text-white hover:opacity-90',
  accent: 'bg-accent text-ink hover:bg-accent-hover uppercase tracking-wide',
  ghost: 'text-primary hover:bg-primary-soft',
  onPrimary: 'bg-surface text-primary hover:bg-primary-soft font-bold',
  /** Destructive confirmation (cancel, refuse). */
  danger: 'bg-danger text-white hover:opacity-90 uppercase tracking-wide',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-sm',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export function buttonClasses({ variant = 'primary', size = 'md', fullWidth }: CommonProps = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full');
}

export function Button({ variant, size, fullWidth, iconLeft, iconRight, className, children, type = 'button', ...rest }: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn(buttonClasses({ variant, size, fullWidth }), className)} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

/** Same look as Button, for navigation. */
export function ButtonLink({ variant, size, fullWidth, iconLeft, iconRight, className, children, ...rest }: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={cn(buttonClasses({ variant, size, fullWidth }), className)} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </a>
  );
}
