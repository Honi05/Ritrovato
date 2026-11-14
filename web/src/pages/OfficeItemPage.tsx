import { useEffect, useState } from 'react'
import { getItem, type Item } from '../api'
import BookingPanel from '../components/BookingPanel'
import { ArrowLeft } from '../components/Icons'
import Pickup from '../components/Pickup'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/items'
import { href } from '../lib/router'

export default function OfficeItemPage({ id }: { id: string }) {
  const { t } = useI18n()
  const [item, setItem] = useState<Item | null | 'missing'>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    getItem(id).then(setItem, () => setItem('missing'))
  }, [id])

  const back = (
    <button type="button" onClick={() => (history.length > 1 ? history.back() : (location.hash = href('catalogue')))}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start border-0 bg-transparent p-0 text-[15px] font-bold text-ink hover:text-signal-ink">
      <ArrowLeft size={18} />
      {t.item.back}
    </button>
  )
  if (item === null) return <div className="pt-8">{back}</div>
  if (item === 'missing') {
    return (
      <div className="flex flex-col gap-4 pt-8">
        {back}
        <h1 className="font-wide m-0 text-3xl font-black">{t.office.notFound}</h1>
      </div>
    )
  }
  const dt = 'font-mono text-[11px] font-semibold tracking-[0.08em] uppercase'
  return (
    <div className="flex flex-col gap-4 pt-7">
      {back}
      <div className="flex flex-wrap items-start gap-12">
        <section className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          {item.photo_url && <img src={item.photo_url} alt={item.descr} className="w-full border-2 border-ink shadow-[10px_10px_0_#111]" />}
          <span className="self-start bg-ink px-2 py-1 font-mono text-xs font-semibold text-card uppercase">{t.office.badge}</span>
          <h1 className="font-wide m-0 text-[32px] leading-tight font-black">{item.descr}</h1>
          <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 font-mono">
            <div><dt className={dt}>{t.item.type}</dt><dd className="m-0 mt-1">{t.categories[item.category] ?? item.category}{item.brand && ` · ${item.brand}`}</dd></div>
            {item.colour && <div><dt className={dt}>{t.office.colour}</dt><dd className="m-0 mt-1">{t.colours[item.colour] ?? item.colour}</dd></div>}
            <div><dt className={dt}>{t.office.foundPlace}</dt><dd className="m-0 mt-1">{item.found_place}</dd></div>
            <div><dt className={dt}>{t.office.date}</dt><dd className="m-0 mt-1">{formatDate(item.date)}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="collect" className="flex min-w-0 flex-[999_1_460px] flex-col gap-6">
          <h2 id="collect" className="font-wide m-0 text-[40px] leading-none font-black">{t.pickup.title}</h2>
          {item.status === 'reserved' && !open ? (
            <p className="m-0 border-2 border-dashed border-ink p-4 font-semibold">{t.office.reserved}</p>
          ) : open ? (
            <BookingPanel item={item} onBooked={() => undefined} />
          ) : (
            <button type="button" data-testid="book-cta" onClick={() => setOpen(true)} className="min-h-12 self-start border-2 border-ink bg-signal px-6 text-lg font-bold">
              {t.booking.cta}
            </button>
          )}
          <Pickup />
        </section>
      </div>
    </div>
  )
}
