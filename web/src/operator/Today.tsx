import { useEffect, useState } from 'react'
import { opDayBookings, opListItems, type DayBooking } from '../api'
import { useI18n } from '../i18n'
import { href } from '../lib/router'
import BookingRow from './BookingRow'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

// eslint-disable-next-line react-refresh/only-export-components
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function Today() {
  const t = useOpT()
  const guard = useGuard()
  const [list, setList] = useState<DayBooking[] | null>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [week, setWeek] = useState<number | null>(null)

  useEffect(() => {
    const now = new Date()
    opDayBookings(isoDay(now)).then(setList, guard)
    opListItems({ status: 'available', limit: 1 }).then((r) => setAvailable(r.total), guard)
    const days = Array.from({ length: 7 }, (_, i) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)))
    Promise.all(days.map(opDayBookings)).then((all) => setWeek(all.flat().filter((b) => b.status === 'booked').length), guard)
  }, [guard])

  const { lang } = useI18n()
  const [now] = useState(() => new Date())
  const stat = 'flex min-w-[200px] flex-1 flex-col gap-2 border-2 border-ink bg-card p-4'
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">
            {now.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <h1 className="font-wide m-0 text-4xl font-black">{t.today.title}</h1>
        </div>
        <a href={href('operator/new')} className="min-h-12 border-2 border-ink bg-signal px-5 py-3 text-lg font-bold text-ink no-underline shadow-[6px_6px_0_#111] transition-transform hover:-translate-y-0.5 hover:text-ink">{t.today.log}</a>
      </div>
      <div className="flex flex-wrap gap-4">
        <a href={href('operator/items', { status: 'available' })} className={`${stat} text-ink no-underline hover:bg-paper hover:text-ink`}>
          <span className="font-mono text-xs font-semibold tracking-[0.08em] uppercase">{t.today.available}</span>
          <span data-testid="count-available" className="font-wide m-0 text-5xl font-black">{available ?? '…'}</span>
        </a>
        <a href={href('operator/bookings')} className={`${stat} text-ink no-underline hover:bg-paper hover:text-ink`}>
          <span className="font-mono text-xs font-semibold tracking-[0.08em] uppercase">{t.today.week}</span>
          <span className="font-wide m-0 text-5xl font-black">{week ?? '…'}</span>
        </a>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-3 border-b-2 border-ink pb-2 text-xl font-extrabold">
          {t.today.list}
          {list && <span className="bg-ink px-2 font-mono text-sm text-card">{list.length}</span>}
        </h2>
        {list && list.length === 0 && <p className="m-0 border-2 border-dashed border-ink p-4">{t.today.none}</p>}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {list?.map((b) => <BookingRow key={b.id} b={b} onChange={(nb) => setList((l) => l?.map((x) => (x.id === nb.id ? nb : x)) ?? null)} />)}
        </ul>
      </section>
    </div>
  )
}
