import type { Interpreted } from '../api'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/items'

/** Chips for what the search understood, plus attributes the register cannot match. */
export default function Understood({ interpreted }: { interpreted: Interpreted | null }) {
  const { t } = useI18n()
  const chip = 'bg-ink px-3.5 py-2 text-sm font-bold text-card'

  if (!interpreted) {
    return (
      <p className="m-0 font-mono text-xs font-semibold tracking-[0.06em] uppercase">{t.search.keywordFallback}</p>
    )
  }
  const { category, brand, date_from, date_to, ignored } = interpreted
  const dates = date_from || date_to ? `${formatDate(date_from) || '…'} – ${formatDate(date_to) || '…'}` : null

  return (
    <section aria-label={t.search.understood} className="flex flex-wrap items-center gap-2.5">
      <span className="font-mono text-xs font-semibold tracking-[0.06em] uppercase">{t.search.understood}</span>
      {category && <span className={chip}>{t.categories[category] ?? category}</span>}
      {brand && <span className={chip}>{brand}</span>}
      {dates && <span className={`${chip} font-mono`}>{dates}</span>}
      {ignored.map((k) => (
        <span key={k} className="border-2 border-dashed border-ink px-3 py-1.5 text-sm">
          <b>{t.ignored[k as keyof typeof t.ignored] ?? k}</b> {t.search.notRecorded}
        </span>
      ))}
    </section>
  )
}
