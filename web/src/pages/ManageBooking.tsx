import { useEffect, useState } from 'react'
import { cancelBooking, getBooking, type Booking } from '../api'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/items'

export default function ManageBooking({ token }: { token: string }) {
  const { t, lang } = useI18n()
  const [b, setB] = useState<Booking | null | 'missing'>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    getBooking(token).then(setB, () => setB('missing'))
  }, [token])

  if (b === null) return <p className="pt-8 font-mono">…</p>
  if (b === 'missing') return <h1 className="font-wide pt-8 text-3xl font-black">{t.booking.notFound}</h1>

  const when = new Date(b.slot_start).toLocaleString(lang, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  async function cancel() {
    try {
      setB(await cancelBooking(token))
      setAsking(false)
    } catch {
      setError(true)
    }
  }
  return (
    <div data-testid="manage-booking" className="flex max-w-2xl flex-col gap-4 pt-8">
      <h1 className="font-wide m-0 text-[40px] leading-none font-black">{t.booking.manageTitle}</h1>
      <p className="m-0 font-mono text-[40px] font-semibold">{b.code}</p>
      <p data-testid="booking-status" className="m-0 self-start bg-ink px-3 py-1 font-bold text-card">{t.booking.status[b.status] ?? b.status}</p>
      <p className="m-0"><b>{t.booking.when}:</b> {when}</p>
      <p className="m-0">{b.item.descr} · {b.item.found_place} · {formatDate(b.item.date)}</p>
      {b.status === 'booked' && !asking && (
        <button type="button" onClick={() => setAsking(true)} className="min-h-11 self-start border-2 border-ink bg-card px-4 font-bold">{t.booking.cancel}</button>
      )}
      {asking && (
        <div role="alertdialog" aria-label={t.booking.cancel} className="flex flex-col gap-3 border-2 border-ink bg-manila p-4">
          <p className="m-0">{t.booking.cancelAsk}</p>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} className="min-h-11 border-2 border-ink bg-signal px-4 font-bold">{t.booking.yesCancel}</button>
            <button type="button" onClick={() => setAsking(false)} className="min-h-11 border-2 border-ink bg-card px-4 font-bold">{t.booking.keep}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="m-0">{t.booking.error}</p>}
    </div>
  )
}
