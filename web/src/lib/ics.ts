/** Calendar file for a pickup slot; built in the browser, nothing leaves the device. */
export function pickupIcs(opts: { code: string; slotStart: string; title: string; location: string; url: string }) {
  const stamp = (s: string) => s.replace(/[-:]/g, '') + '00' // "2026-11-16T09:00" → "20261116T090000"
  const [d, t] = opts.slotStart.split('T')
  const [h, m] = t.split(':').map(Number)
  const endMin = h * 60 + m + 15
  const end = `${d}T${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritrovato//Pickup//EN', 'BEGIN:VEVENT',
    `UID:${opts.code}@ritrovato`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=Europe/Rome:${stamp(opts.slotStart)}`,
    `DTEND;TZID=Europe/Rome:${stamp(end)}`,
    `SUMMARY:${esc(opts.title)}`, `LOCATION:${esc(opts.location)}`, `DESCRIPTION:${esc(opts.code + '\n' + opts.url)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' })
}
