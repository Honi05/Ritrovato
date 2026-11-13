import { useEffect, useRef, useState } from 'react'
import { getItems, type Interpreted, type SearchResponse } from '../api'
import { useI18n } from '../i18n'
import { remember } from '../lib/items'
import { CHIPS, addDays } from '../lib/refine'

export type Refined = { res: SearchResponse | null; filters: Record<string, string>; error: boolean; loading: boolean }

/**
 * "Narrow it down" chips and the "Lost on" date picker. Free: it only calls GET /api/items with the
 * understood filters, never /api/search. Reports the narrowed result (or null when nothing is picked).
 */
export default function Refine({
  interpreted,
  onChange,
}: {
  interpreted: Interpreted
  onChange: (r: Refined | null) => void
}) {
  const { t } = useI18n()
  const [words, setWords] = useState<string[]>([])
  const [lostOn, setLostOn] = useState('')
  const gen = useRef(0) // a response from an older tap is dropped
  const { category } = interpreted
  const chips = (category && CHIPS[category]) || []

  const toggle = (word: string) => setWords((w) => (w.includes(word) ? w.filter((x) => x !== word) : [...w, word]))

  useEffect(() => {
    const mine = ++gen.current
    if (!words.length && !lostOn) return onChange(null)
    const filters: Record<string, string> = {
      ...(category ? { category } : {}),
      ...(interpreted.brand ? { brand: interpreted.brand } : {}),
      ...(interpreted.date_from ? { date_from: interpreted.date_from } : {}),
      ...(interpreted.date_to ? { date_to: interpreted.date_to } : {}),
      ...(lostOn ? { date_from: lostOn, date_to: addDays(lostOn, 14) } : {}),
    }
    const q = [...interpreted.keywords, ...words].join(' ')
    if (q) filters.q = q
    onChange({ res: null, filters, error: false, loading: true })
    getItems({ ...filters, limit: 20 }).then(
      (res) => {
        remember(res.items)
        if (mine === gen.current) onChange({ res, filters, error: false, loading: false })
      },
      () => mine === gen.current && onChange({ res: null, filters, error: true, loading: false }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, lostOn])

  // Leaving the page (or a new search) must not leave a stale narrowed list behind.
  useEffect(() => () => void gen.current++, [])

  if (!category) return null
  const labels = t.refine.chips as Record<string, string>

  return (
    <section aria-label={t.refine.title} className="flex flex-col gap-3 border-2 border-ink p-4">
      <span className="font-mono text-xs font-semibold tracking-[0.06em] uppercase">{t.refine.title}</span>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {chips.map((chip) => {
            const on = words.includes(chip.word)
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(chip.word)}
                className={`min-h-11 cursor-pointer border-2 border-ink px-3.5 py-2 text-sm font-bold ${on ? 'bg-ink text-card' : 'bg-white text-ink hover:bg-card'}`}
              >
                {labels[chip.id] ?? chip.id}
              </button>
            )
          })}
        </div>
      )}
      <label className="flex flex-wrap items-center gap-2.5 text-sm font-bold">
        {t.refine.lostOn}
        <input
          type="date"
          value={lostOn}
          onChange={(e) => setLostOn(e.target.value)}
          className="min-h-11 border-2 border-ink bg-white px-3 font-mono text-sm"
        />
        {lostOn && (
          <button
            type="button"
            onClick={() => setLostOn('')}
            className="min-h-11 cursor-pointer border-2 border-ink bg-white px-3 text-sm font-bold hover:bg-card"
          >
            {t.refine.clear}
          </button>
        )}
      </label>
      {lostOn && <p className="m-0 font-mono text-xs">{t.refine.dateHint}</p>}
    </section>
  )
}
