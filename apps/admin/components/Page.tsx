import { Card } from '@twabibu/ui';

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

export function Loading({ error }: { error?: string | null }) {
  return error ? (
    <p role="alert" className="text-danger">
      {error}
    </p>
  ) : (
    <p className="text-text-muted">Chargement…</p>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <Card className="text-text">{children}</Card>;
}

export function Notice({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p role={message.ok ? 'status' : 'alert'} aria-live="polite" className={message.ok ? 'rounded-md bg-success-soft px-3 py-2 text-sm text-success' : 'rounded-md bg-danger-soft px-3 py-2 text-sm text-danger'}>
      {message.text}
    </p>
  );
}
