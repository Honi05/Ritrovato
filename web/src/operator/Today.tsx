import { useEffect, useState } from 'react'
import { opDayBookings, opListItems, type DayBooking } from '../api'
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-wide m-0 text-4xl font-black">{t.today.title}</h1>
        <a href={href('operator/new')} className="min-h-12 border-2 border-ink bg-signal px-5 py-3 text-lg font-bold text-ink no-underline">{t.today.log}</a>
      </div>
      <dl className="m-0 flex flex-wrap gap-6 font-mono">
        <div><dt className="text-xs uppercase">{t.today.available}</dt><dd data-testid="count-available" className="m-0 text-3xl font-semibold">{available ?? '…'}</dd></div>
        <div><dt className="text-xs uppercase">{t.today.week}</dt><dd className="m-0 text-3xl font-semibold">{week ?? '…'}</dd></div>
      </dl>
      {list && list.length === 0 && <p className="m-0 border-2 border-dashed border-ink p-4">{t.today.none}</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {list?.map((b) => <BookingRow key={b.id} b={b} onChange={(nb) => setList((l) => l?.map((x) => (x.id === nb.id ? nb : x)) ?? null)} />)}
      </ul>
    </div>
  )
}
