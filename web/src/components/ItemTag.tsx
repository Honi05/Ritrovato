import type { Item } from '../api'
import { useI18n } from '../i18n'
import { formatDate, rememberOpened, segments } from '../lib/items'
import { href } from '../lib/router'

/** One register entry as a luggage tag; the whole tag links to the entry card. */
export default function ItemTag({ item, highlight = false }: { item: Item; highlight?: boolean }) {
  const { t } = useI18n()
  const [head, ...more] = segments(item.descr)
  const rest = more.filter((s) => s !== item.brand)

  return (
    <a
      href={href(`item/${encodeURIComponent(item.id)}`)}
      onClick={() => rememberOpened(item)}
      className={`tag-shape relative flex flex-wrap items-center gap-x-5 gap-y-2 border-2 border-ink py-4 pr-5 pl-14 text-ink no-underline transition-transform hover:-translate-y-0.5 hover:text-ink ${highlight ? 'bg-manila' : 'bg-card hover:bg-white'}`}
    >
      <span className="tag-hole" aria-hidden="true" />
      <span className="min-w-24 font-mono text-[30px] leading-none font-semibold">{item.reperto ?? '—'}</span>
      <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <strong className="text-[17px] leading-snug">
          {head}
          {item.brand && !head?.includes(item.brand) ? ` · ${item.brand}` : ''}
        </strong>
        <span className="text-sm text-muted">
          {t.categories[item.category] ?? item.category}
          {rest.length > 0 && ` · ${rest.join(' · ')}`}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1 font-mono text-sm">
        <span>{formatDate(item.date)}</span>
        {item.source && <span className="text-xs">{t.item.page(item.source.page)}</span>}
        <span className="font-mono text-[11px] uppercase text-muted">{t.office.registryBadge}</span>
      </span>
    </a>
  )
}
