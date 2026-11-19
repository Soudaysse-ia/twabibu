import { Check } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { cn } from '@twabibu/ui';
import { formatTime } from '@twabibu/utils';
import type { Order, OrderStatus } from '@/lib/pharmacy-types';

const t = fr.pharmacy;

/** Order timeline: the expected steps for its mode, with the time each one happened. */
export function OrderStatusSteps({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') {
    const at = order.events.find((e) => e.status === 'CANCELLED');
    return (
      <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
        {t.orderStatus.CANCELLED}
        {at ? ` à ${formatTime(new Date(at.at))}` : ''}
        {at?.note ? ` · ${at.note}` : ''}
      </p>
    );
  }
  const steps: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', order.mode === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY', 'DELIVERED'];
  const reached = steps.indexOf(order.status);
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((s, i) => {
        const event = order.events.find((e) => e.status === s);
        const done = i <= reached;
        return (
          <li key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn('inline-flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold', done ? 'border-success bg-success text-white' : 'border-border bg-surface text-text-muted')}>
                {done ? <Check aria-hidden="true" size={14} /> : i + 1}
              </span>
              {i < steps.length - 1 ? <span className={cn('w-0.5 flex-1', i < reached ? 'bg-success' : 'bg-border')} /> : null}
            </div>
            <div className="pb-4">
              <p className={cn('text-sm font-medium', done ? 'text-ink' : 'text-text-muted')}>
                {s === 'DELIVERED' && order.mode === 'PICKUP' ? 'Retirée' : t.orderStatus[s]}
                {i === reached ? <span className="sr-only"> (étape actuelle)</span> : null}
              </p>
              {event ? <p className="text-xs text-text-muted">{formatTime(new Date(event.at))}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
