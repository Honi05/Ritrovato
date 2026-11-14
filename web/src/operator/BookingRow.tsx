import { useState } from 'react'
import { opPatchBooking, type DayBooking } from '../api'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

export default function BookingRow({ b, onChange }: { b: DayBooking; onChange: (b: DayBooking) => void }) {
  const t = useOpT()
  const guard = useGuard()
  const [asking, setAsking] = useState<null | 'collected' | 'no_show' | 'cancelled'>(null)
  const act = (s: 'collected' | 'no_show' | 'cancelled') =>
    opPatchBooking(b.id, s).then(onChange, guard).finally(() => setAsking(null))
  const btn = 'min-h-10 border-2 border-ink bg-card px-3 text-sm font-semibold'
  return (
    <li data-testid="booking-row" className="flex flex-wrap items-center gap-4 border-2 border-ink bg-card p-3">
      <span className="font-mono text-lg font-semibold">{b.slot_start.slice(11)}</span>
      {b.item.photo_url && <img src={b.item.photo_url} alt="" className="size-14 border-2 border-ink object-cover" />}
      <span className="flex min-w-0 flex-[1_1_220px] flex-col">
        <b className="font-mono">{b.code}</b>
        <span>{b.name} · {b.contact}</span>
        <span className="text-sm text-muted">{b.item.descr}</span>
      </span>
      <span className="font-mono text-xs uppercase">{t.bstatus[b.status]}</span>
      {b.status === 'booked' && !asking && (
        <span className="flex gap-2">
          <button type="button" className={`${btn} bg-signal`} onClick={() => act('collected')}>{t.act.collected}</button>
          <button type="button" className={btn} onClick={() => setAsking('no_show')}>{t.act.no_show}</button>
          <button type="button" className={btn} onClick={() => setAsking('cancelled')}>{t.act.cancel}</button>
        </span>
      )}
      {asking && (
        <span className="flex gap-2">
          <button type="button" className={`${btn} bg-signal`} onClick={() => act(asking)}>{t.act.confirm}: {asking === 'no_show' ? t.act.no_show : t.act.cancel}</button>
          <button type="button" className={btn} onClick={() => setAsking(null)}>{t.act.back}</button>
        </span>
      )}
    </li>
  )
}
