import { useState } from 'react'
import { opDraft, type Draft, type ItemFields } from '../api'
import { useI18n } from '../i18n'
import { CATEGORIES, COLOURS } from '../lib/colours'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

export type FormValue = ItemFields & { draft_id?: string }
const today = () => new Date().toISOString().slice(0, 10)
// eslint-disable-next-line react-refresh/only-export-components
export const emptyForm = (): FormValue => ({ category: '', brand: null, colour: null, descr: '', found_place: '', found_at: today() })

const PLACES_KEY = 'ritrovato.op.places'
// eslint-disable-next-line react-refresh/only-export-components
export function recentPlaces(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PLACES_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}
// eslint-disable-next-line react-refresh/only-export-components
export function rememberPlace(p: string) {
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify([p, ...recentPlaces().filter((x) => x !== p)].slice(0, 12)))
  } catch {
    // datalist just stays shorter
  }
}

export default function ItemForm({ initial, photoUrl, busy, submitLabel, onSubmit }: {
  initial: FormValue
  photoUrl: string | null
  busy: boolean
  submitLabel: string
  onSubmit: (v: FormValue) => void
}) {
  const t = useOpT()
  const { t: pub } = useI18n()
  const guard = useGuard()
  const [v, setV] = useState<FormValue>(initial)
  const [photo, setPhoto] = useState<string | null>(photoUrl)
  const [reading, setReading] = useState(false)
  const [aiFailed, setAiFailed] = useState(false)
  const [suggested, setSuggested] = useState<Set<keyof ItemFields>>(new Set())

  const set = <K extends keyof FormValue>(k: K, val: FormValue[K]) => {
    setV((x) => ({ ...x, [k]: val }))
    setSuggested((s) => { const n = new Set(s); n.delete(k as keyof ItemFields); return n })
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setReading(true)
    setAiFailed(false)
    setPhoto(URL.createObjectURL(file))
    try {
      const d: Draft = await opDraft(file)
      setV((x) => {
        const s = d.suggested
        const next = { ...x, draft_id: d.draft_id }
        if (!s) return next
        const filled = new Set<keyof ItemFields>()
        if (s.category && !x.category) { next.category = s.category; filled.add('category') }
        if (s.brand && !x.brand) { next.brand = s.brand; filled.add('brand') }
        if (s.colour && !x.colour) { next.colour = s.colour; filled.add('colour') }
        if (s.descr && !x.descr) { next.descr = s.descr; filled.add('descr') }
        setSuggested(filled)
        return next
      })
      if (!d.suggested) setAiFailed(true)
    } catch (e) {
      guard(e)
      setAiFailed(true)
      setPhoto(photoUrl)
    } finally {
      setReading(false)
    }
  }

  const tag = (k: keyof ItemFields) => suggested.has(k) && <span className="ml-2 bg-manila px-1.5 font-mono text-[11px] uppercase">{t.form.suggested}</span>
  const field = 'min-h-11 w-full border-2 border-ink bg-card px-3 text-base'
  const label = 'flex flex-col gap-1 font-semibold'
  return (
    <form
      data-testid="item-form"
      onSubmit={(e) => { e.preventDefault(); rememberPlace(v.found_place.trim()); onSubmit(v) }}
      className="flex max-w-2xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <span className="font-semibold">{t.form.photo}</span>
        {photo && <img src={photo} alt="" className="max-h-72 self-start border-2 border-ink object-contain" />}
        <label className="min-h-11 cursor-pointer self-start border-2 border-ink bg-card px-4 py-2 font-semibold">
          {photo ? t.form.replacePhoto : t.form.takePhoto}
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" data-testid="photo-input"
            onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {reading && <p className="m-0 animate-pulse font-mono text-sm" data-testid="reading">{t.form.reading}</p>}
        {aiFailed && <p className="m-0 text-sm">{t.form.aiFailed}</p>}
      </div>
      <fieldset disabled={reading} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <label className={label}><span>{t.form.category}{tag('category')}</span>
          <select required value={v.category} onChange={(e) => set('category', e.target.value)} className={field}>
            <option value="" disabled>{t.form.none}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{pub.categories[c] ?? c}</option>)}
          </select>
        </label>
        <label className={label}><span>{t.form.brand}{tag('brand')}</span>
          <input maxLength={40} value={v.brand ?? ''} onChange={(e) => set('brand', e.target.value || null)} className={field} />
        </label>
        <label className={label}><span>{t.form.colour}{tag('colour')}</span>
          <select value={v.colour ?? ''} onChange={(e) => set('colour', e.target.value || null)} className={field}>
            <option value="">{t.form.none}</option>
            {COLOURS.map((c) => <option key={c} value={c}>{pub.colours[c] ?? c}</option>)}
          </select>
        </label>
        <label className={label}><span>{t.form.descr}{tag('descr')}</span>
          <textarea required minLength={3} maxLength={500} rows={3} value={v.descr} onChange={(e) => set('descr', e.target.value)} className={`${field} py-2`} />
        </label>
        <label className={label}>{t.form.place}
          <input required minLength={2} maxLength={120} list="op-places" value={v.found_place} onChange={(e) => set('found_place', e.target.value)} className={field} />
          <datalist id="op-places">{recentPlaces().map((p) => <option key={p} value={p} />)}</datalist>
        </label>
        <label className={label}>{t.form.date}
          <input required type="date" max={today()} value={v.found_at} onChange={(e) => set('found_at', e.target.value)} className={field} />
        </label>
        <button type="submit" disabled={busy || reading} className="min-h-12 self-start border-2 border-ink bg-signal px-6 text-lg font-bold">
          {busy ? t.form.saving : submitLabel}
        </button>
      </fieldset>
    </form>
  )
}
