/** Minimal iCalendar file for "Ajouter à mon calendrier" (RFC 5545). */
export function buildIcs(e: { uid: string; startsAt: string; endsAt: string; title: string; location: string; description?: string }): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Twabibu//FR',
    'BEGIN:VEVENT',
    `UID:${e.uid}@twabibu.km`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(e.startsAt)}`,
    `DTEND:${fmt(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}
