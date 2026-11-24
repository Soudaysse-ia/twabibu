'use client';

import { Plus, Trash2 } from 'lucide-react';
import { WEEKDAYS, type OpeningHoursInput } from '@twabibu/contracts';
import { fr } from '@twabibu/i18n';
import { fieldClass } from './Drawer';

const t = fr.practiceEdit;
const MAX_RANGES = 3;
/** 16 px in fields on a phone, so that the browser does not zoom in. */
const timeClass = `${fieldClass.replace(' text-sm ', ' text-base sm:text-sm ')} min-w-0 px-2 sm:w-28`;
/**
 * Quarter hours from 05:00 to 23:45, always written 24-hour style: a time field follows the phone's language and
 * shows « 02:30 PM » on a phone set in English, which does not fit and is not how the Comoros write hours.
 */
const QUARTERS = Array.from({ length: (24 - 5) * 4 }, (_, i) => {
  const m = 5 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // A time saved off the quarter (08:10) stays selectable.
  const options = QUARTERS.includes(value) ? QUARTERS : [...QUARTERS, value].sort();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={timeClass}>
      {options.map((q) => (
        <option key={q} value={q}>
          {q}
        </option>
      ))}
    </select>
  );
}

/** Week of opening hours (PRO-06): each day closed or open with up to three ranges. */
export function HoursEditor({
  value,
  onChange,
}: {
  value: OpeningHoursInput;
  onChange: (v: OpeningHoursInput) => void;
}) {
  const set = (day: (typeof WEEKDAYS)[number], ranges: [string, string][]) =>
    onChange({ ...value, [day]: ranges });
  const monday = value.mon ?? [];

  return (
    <div className="flex flex-col gap-2">
      {WEEKDAYS.map((day) => {
        const ranges = value[day] ?? [];
        const label = t.days[day]!;
        return (
          <fieldset
            key={day}
            className="flex min-w-0 flex-col gap-2 border-b border-border py-2 last:border-b-0 sm:flex-row sm:items-start"
          >
            <legend className="sr-only">{label}</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink sm:w-40">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={ranges.length > 0}
                onChange={(e) => set(day, e.target.checked ? [['08:00', '12:00']] : [])}
              />
              {label}
              <span className="text-xs font-normal text-text-muted">{ranges.length ? t.open : t.closed}</span>
            </label>
            {ranges.length ? (
              <div className="flex flex-1 flex-col gap-2">
                {ranges.map(([start, end], i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-text">
                    <label className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
                      {t.from}
                      <TimeSelect
                        value={start}
                        onChange={(v) =>
                          set(
                            day,
                            ranges.map((r, j) => (j === i ? [v, r[1]] : r)),
                          )
                        }
                      />
                    </label>
                    <label className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
                      {t.to}
                      <TimeSelect
                        value={end}
                        onChange={(v) =>
                          set(
                            day,
                            ranges.map((r, j) => (j === i ? [r[0], v] : r)),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={t.removeRange(label)}
                      onClick={() =>
                        set(
                          day,
                          ranges.filter((_, j) => j !== i),
                        )
                      }
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-danger hover:bg-danger-soft"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                ))}
                {ranges.length < MAX_RANGES ? (
                  <button
                    type="button"
                    onClick={() => set(day, [...ranges, ['14:00', '17:00']])}
                    className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline"
                  >
                    <Plus aria-hidden="true" size={16} />
                    {t.addRange}
                  </button>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        );
      })}
      {monday.length ? (
        <button
          type="button"
          onClick={() => onChange({ ...value, tue: monday, wed: monday, thu: monday, fri: monday })}
          className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
        >
          {t.copyMonday}
        </button>
      ) : null}
    </div>
  );
}
