import type { Item } from '../api'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/items'
import { SWATCH, type Colour } from '../lib/colours'
import { href } from '../lib/router'

/** One office-logged item in results: photo first, then what and where. */
export default function OfficeCard({ item }: { item: Item }) {
  const { t } = useI18n()
  const reserved = item.status === 'reserved'
  return (
    <a
      href={href(`item/${encodeURIComponent(item.id)}`)}
      data-testid="office-card"
      className="flex min-w-0 flex-col border-2 border-ink bg-card text-ink no-underline transition-transform hover:-translate-y-0.5 hover:text-ink"
    >
      <div className="relative aspect-[4/3] border-b-2 border-ink bg-manila">
        {item.photo_url && <img src={item.photo_url} alt="" loading="lazy" className="size-full object-cover" />}
        <span className="absolute top-2 left-2 bg-ink px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-card uppercase">
          {reserved ? t.office.reserved : t.office.badge}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <strong className="text-[16px] leading-snug">{item.descr}</strong>
        <span className="flex items-center gap-2 text-sm text-muted">
          {item.colour && (
            <span aria-hidden="true" className="inline-block size-3.5 rounded-full border border-ink" style={{ background: SWATCH[item.colour as Colour] }} />
          )}
          {t.categories[item.category] ?? item.category}
          {item.brand && ` · ${item.brand}`}
        </span>
        <span className="font-mono text-[13px]">
          {item.found_place} · {formatDate(item.date)}
        </span>
      </div>
    </a>
  )
}
