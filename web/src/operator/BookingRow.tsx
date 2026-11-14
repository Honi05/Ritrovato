import { useState } from 'react'
import { opPatchBooking, type DayBooking } from '../api'
import { useGuard } from './OperatorApp'
import StatusBadge from './StatusBadge'
import { useOpT } from './strings'

export default function BookingRow({ b, onChange }: { b: DayBooking; onChange: (b: DayBooking) => void }) {
  const t = useOpT()
  const guard = useGuard()
  const [asking, setAsking] = useState<null | 'collected' | 'no_show' | 'cancelled'>(null)
  const act = (s: 'collected' | 'no_show' | 'cancelled') =>
    opPatchBooking(b.id, s).then(onChange, guard).finally(() => setAsking(null))
  const btn = 'min-h-10 cursor-pointer border-2 border-ink bg-card px-3 text-sm font-semibold hover:bg-paper'
  const done = b.status !== 'booked'
  return (
    <li data-testid="booking-row" className={`flex flex-wrap items-stretch border-2 border-ink bg-card ${done ? 'opacity-70' : ''}`}>
      <span className="flex min-w-20 items-center justify-center bg-ink px-3 py-2 font-mono text-lg font-semibold text-card">{b.slot_start.slice(11)}</span>
      <span className="flex flex-[1_1_320px] flex-wrap items-center gap-4 p-3">
        {b.item.photo_url && <img src={b.item.photo_url} alt="" className="size-14 border-2 border-ink object-cover" />}
        <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <b className="font-mono tracking-[0.04em]">{b.code}</b>
          <span className="font-semibold">{b.name} <span className="font-normal text-muted">· {b.contact}</span></span>
          <span className="text-sm text-muted">{b.item.descr}</span>
        </span>
        <StatusBadge kind={b.status} label={t.bstatus[b.status]} />
        {b.status === 'booked' && !asking && (
          <span className="flex flex-wrap gap-2">
            <button type="button" className={`${btn} bg-signal hover:bg-signal`} onClick={() => act('collected')}>{t.act.collected}</button>
            <button type="button" className={btn} onClick={() => setAsking('no_show')}>{t.act.no_show}</button>
            <button type="button" className={btn} onClick={() => setAsking('cancelled')}>{t.act.cancel}</button>
          </span>
        )}
        {asking && (
          <span className="flex flex-wrap gap-2">
            <button type="button" className={`${btn} bg-signal hover:bg-signal`} onClick={() => act(asking)}>{t.act.confirm}: {asking === 'no_show' ? t.act.no_show : t.act.cancel}</button>
            <button type="button" className={btn} onClick={() => setAsking(null)}>{t.act.back}</button>
          </span>
        )}
      </span>
    </li>
  )
}
