import { BadgeCheck, MapPin } from 'lucide-react';
import { computeSlots, groupSlotsByDay } from '@twabibu/availability';
import { fr } from '@twabibu/i18n';
import { Badge, SlotChip } from '@twabibu/ui';
import { addDaysToDateKey, DEFAULT_TIMEZONE, formatDayHeader, formatKmf, formatTime, toDateKey, zonedToUtc } from '@twabibu/utils';

const DAYS = 5;
const PER_DAY = 3;

/**
 * Example practitioner card on the home page. The slots are computed by the real availability engine
 * (@twabibu/availability) from example opening hours, so the grid always shows the next five days.
 * The practitioner is fictional and labelled as an example.
 */
export function AvailabilityPreview({ now = new Date() }: { now?: Date }) {
  const today = toDateKey(now, DEFAULT_TIMEZONE);
  const { slots } = computeSlots({
    agenda: { timezone: DEFAULT_TIMEZONE, slotStepMinutes: 20, bookingHorizonDays: 30, minNoticeMinutes: 120, onlineBookingEnabled: true, blockHolidays: true },
    motive: { id: 'example', durationMinutes: 20, isOnline: true, newPatientsAllowed: true },
    rules: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 8 * 60, endMinutes: 12 * 60, motiveIds: [], capacity: 1, recurrence: 'WEEKLY' as const })),
    absences: [],
    holidays: [],
    // A few booked appointments so the grid looks like a real day.
    appointments: Array.from({ length: DAYS }, (_, d) => addDaysToDateKey(today, d)).flatMap((day, d) =>
      [8 * 60 + 20 * ((d * 2) % 6), 9 * 60 + 20 * ((d + 1) % 3)].map((m) => ({ startsAt: zonedToUtc(day, m), endsAt: zonedToUtc(day, m + 20) })),
    ),
    locks: [],
    range: { from: zonedToUtc(today, 0), to: zonedToUtc(addDaysToDateKey(today, DAYS), 0) },
    now,
    context: { isKnownPatient: false, source: 'ONLINE' },
  });
  const byDay = new Map(groupSlotsByDay(slots, DEFAULT_TIMEZONE).map((d) => [d.date, d.slots]));
  const days = Array.from({ length: DAYS }, (_, i) => addDaysToDateKey(today, i));

  return (
    <div className="rounded-md bg-surface p-4 text-text shadow-float sm:p-5" aria-label="Exemple de fiche soignant avec ses disponibilités">
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-heading text-sm font-bold text-primary">
          AS
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-primary">Dr Amina Saïd</p>
            <Badge tone="success">
              <BadgeCheck aria-hidden="true" size={12} /> Vérifié
            </Badge>
          </div>
          <p className="text-sm">{fr.home.previewSpeciality}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
            <MapPin aria-hidden="true" size={12} /> {fr.home.previewPlace} · à partir de {formatKmf(5000)}
          </p>
        </div>
        <Badge className="shrink-0">Exemple</Badge>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1.5 text-center sm:gap-2">
        {days.map((day) => {
          const header = formatDayHeader(zonedToUtc(day, 12 * 60));
          const daySlots = (byDay.get(day) ?? []).slice(0, PER_DAY);
          return (
            <div key={day} className="flex min-w-0 flex-col gap-1.5">
              <div className="mb-0.5 leading-tight">
                <p className="truncate text-xs font-bold text-ink capitalize">{header.weekday.slice(0, 3)}.</p>
                <p className="truncate text-xs text-text-muted">{header.day}</p>
              </div>
              {Array.from({ length: PER_DAY }, (_, i) => {
                const slot = daySlots[i];
                return slot ? (
                  <SlotChip key={i} label={formatTime(slot.startsAt)} tabIndex={-1} aria-hidden="true" className="pointer-events-none text-xs sm:text-sm" />
                ) : (
                  <SlotChip key={i} label={null} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
