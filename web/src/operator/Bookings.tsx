import { useEffect, useState } from 'react'
import { opDayBookings, type DayBooking } from '../api'
import { href, navigate } from '../lib/router'
import BookingRow from './BookingRow'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'
import { isoDay } from './Today'

export default function Bookings({ params }: { params: URLSearchParams }) {
  const t = useOpT()
  const guard = useGuard()
  const [todayIso] = useState(() => isoDay(new Date()))
  const date = params.get('date') ?? todayIso
  const [loaded, setLoaded] = useState<{ date: string; list: DayBooking[] } | null>(null)
  const list = loaded?.date === date ? loaded.list : null
  const setList = (f: (l: DayBooking[] | null) => DayBooking[] | null) =>
    setLoaded((c) => { const n = f(c?.date === date ? c.list : null); return n ? { date, list: n } : null })
  useEffect(() => {
    opDayBookings(date).then((l) => setLoaded({ date, list: l }), guard)
  }, [date, guard])
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-wide m-0 text-4xl font-black">{t.bookings.title}</h1>
      <label className="flex items-center gap-3 font-semibold">
        {t.bookings.date}
        <input type="date" value={date} onChange={(e) => navigate(href('operator/bookings', { date: e.target.value }))} className="min-h-11 border-2 border-ink bg-card px-3" />
      </label>
      {list && list.length === 0 && <p className="m-0 border-2 border-dashed border-ink p-4">{t.bookings.empty}</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {list?.map((b) => <BookingRow key={b.id} b={b} onChange={(nb) => setList((l) => l?.map((x) => (x.id === nb.id ? nb : x)) ?? null)} />)}
      </ul>
    </div>
  )
}
