import type { Item } from '../api'
import { useI18n } from '../i18n'
import OfficeCard from './OfficeCard'

export default function OfficeStrip({ items }: { items: Item[] | undefined }) {
  const { t } = useI18n()
  if (!items?.length) return null
  return (
    <section aria-labelledby="office-strip" data-testid="office-strip" className="flex flex-col gap-3 border-2 border-ink bg-manila p-4">
      <div>
        <h2 id="office-strip" className="font-wide m-0 text-2xl font-black">{t.office.stripTitle}</h2>
        <p className="m-0 text-sm">{t.office.stripLead}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {items.map((it) => (
          <OfficeCard key={it.id} item={it} />
        ))}
      </div>
    </section>
  )
}
