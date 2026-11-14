import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, bookItem, getSlots, type BookingResult, type Item, type Slot } from '../api'
import { useI18n } from '../i18n'
import { pickupIcs } from '../lib/ics'
import { href } from '../lib/router'

const WEEKDAYS_OPEN = new Set([1, 2, 3, 4, 5]) // Mon–Fri; the server is the authority

function nextDays(n: number) {
  const out: string[] = []
  const d = new Date()
  for (let i = 1; out.length < n && i <= 14; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)
    if (WEEKDAYS_OPEN.has(x.getDay())) {
      out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`)
    }
  }
  return out
}

export default function BookingPanel({ item, onBooked }: { item: Item; onBooked: () => void }) {
  const { t, lang } = useI18n()
  const days = useMemo(() => nextDays(10), [])
  const [day, setDay] = useState(days[0])
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<BookingResult | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    getSlots(day).then((r) => live && setSlots(r.slots), () => live && setSlots([]))
    return () => {
      live = false
    }
  }, [day, reload])

  const label = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!slot) return
    setBusy(true)
    setError(null)
    try {
      setDone(await bookItem(item.id, { name, contact, slot_start: slot }))
      onBooked()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : ''
      if (err instanceof ApiError && err.status === 409 && msg.includes('slot_taken')) {
        setError(t.booking.slotTaken)
        setSlot(null)
        setSlots(null)
        setReload((n) => n + 1)
      } else if (err instanceof ApiError && err.status === 409) setError(t.booking.itemTaken)
      else if (err instanceof ApiError && err.status === 429) setError(t.booking.tooMany)
      else setError(t.booking.error)
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Confirmation item={item} done={done} />

  const field = 'min-h-11 min-w-0 border-2 border-ink bg-card px-3 text-base'
  return (
    <form onSubmit={submit} data-testid="booking-panel" className="flex min-w-0 flex-col gap-4 border-2 border-ink bg-card p-4">
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 font-mono text-xs font-semibold uppercase">{t.booking.day}</legend>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button key={d} type="button" data-day={d} aria-pressed={d === day} onClick={() => { if (d === day) return; setDay(d); setSlot(null); setSlots(null) }}
              className={`min-h-11 flex-none border-2 border-ink px-3 font-semibold ${d === day ? 'bg-ink text-card' : 'bg-card'}`}>
              {label(d)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 font-mono text-xs font-semibold uppercase">{t.booking.time}</legend>
        {slots === null && <p className="m-0 font-mono text-sm">…</p>}
        {slots && slots.filter((s) => s.free).length === 0 && <p className="m-0">{t.booking.noSlots}</p>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
          {slots?.filter((s) => s.free).map((s) => (
            <button key={s.start} type="button" data-testid="slot" aria-pressed={s.start === slot} onClick={() => setSlot(s.start)}
              className={`min-h-11 border-2 border-ink font-mono ${s.start === slot ? 'bg-ink text-card' : 'bg-card'}`}>
              {s.start.slice(11)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 font-semibold">
        {t.booking.name}
        <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        {t.booking.contact}
        <input required minLength={3} maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} className={field} autoComplete="email" />
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" required checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 size-5" />
        <span>{t.booking.ack}</span>
      </label>
      {error && <p role="alert" className="m-0 border-l-[6px] border-signal bg-paper px-3 py-2 font-semibold">{error}</p>}
      <button type="submit" disabled={!slot || busy} className="min-h-12 border-2 border-ink bg-signal px-5 font-bold disabled:opacity-50">
        {busy ? t.booking.sending : t.booking.confirm}
      </button>
    </form>
  )
}

function Confirmation({ item, done }: { item: Item; done: BookingResult }) {
  const { t, lang } = useI18n()
  const [copied, setCopied] = useState(false)
  const manage = `${location.origin}${location.pathname}${href(`booking/${done.manage_token}`)}`
  const when = new Date(done.slot_start).toLocaleString(lang, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const ics = () => {
    const url = URL.createObjectURL(pickupIcs({ code: done.code, slotStart: done.slot_start, title: `${t.booking.done}: ${item.descr}`, location: 'Ufficio Oggetti Rinvenuti, Roma', url: manage }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ritrovato-${done.code}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section data-testid="booking-done" aria-live="polite" className="flex min-w-0 flex-col gap-3 border-2 border-ink bg-manila p-5">
      <h3 className="font-wide m-0 text-2xl font-black">{t.booking.done}</h3>
      <div>
        <span className="font-mono text-xs font-semibold uppercase">{t.booking.code}</span>
        <p data-testid="booking-code" className="m-0 font-mono text-[44px] leading-none font-semibold">{done.code}</p>
      </div>
      <p className="m-0"><b>{t.booking.when}:</b> {when}</p>
      <p className="m-0">{t.booking.bring}</p>
      <p className="m-0 text-sm">{t.booking.saveLink}</p>
      <div className="flex flex-wrap gap-2">
        <input readOnly value={manage} aria-label={t.booking.saveLink} className="min-h-11 min-w-0 flex-1 border-2 border-ink bg-card px-2 font-mono text-xs" />
        <button type="button" onClick={() => navigator.clipboard?.writeText(manage).then(() => setCopied(true))} className="min-h-11 border-2 border-ink bg-card px-3 font-semibold">
          {copied ? t.booking.copied : t.booking.copy}
        </button>
        <button type="button" onClick={ics} className="min-h-11 border-2 border-ink bg-card px-3 font-semibold">{t.booking.calendar}</button>
      </div>
    </section>
  )
}
