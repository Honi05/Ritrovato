import { ArrowLeft, Lock } from '../components/Icons'
import Pickup from '../components/Pickup'
import { useI18n } from '../i18n'
import { formatDate, lookup, segments } from '../lib/items'
import { href } from '../lib/router'

export default function ItemPage({ id }: { id: string }) {
  const { t } = useI18n()
  const item = lookup(id)
  const back = (
    <button
      type="button"
      onClick={() => (history.length > 1 ? history.back() : (location.hash = href('catalogue')))}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start border-0 bg-transparent p-0 text-[15px] font-bold text-ink hover:text-signal-ink"
    >
      <ArrowLeft size={18} />
      {t.item.back}
    </button>
  )

  if (!item) {
    return (
      <div className="flex flex-col gap-4 pt-8">
        {back}
        <h1 className="font-wide m-0 text-3xl font-black">{t.item.notFound}</h1>
      </div>
    )
  }

  const ref = `${item.reperto}/${item.year}`
  const dt = 'font-mono text-[11px] font-semibold tracking-[0.08em] uppercase'

  return (
    <div className="flex flex-col gap-4 pt-7">
      {back}
      <div className="flex flex-wrap items-start gap-12">
        <section aria-label={t.item.original} className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
          <div className="relative flex flex-col gap-4 border-2 border-ink bg-manila py-9 pr-9 pl-[92px] shadow-[10px_10px_0_#111] [clip-path:polygon(48px_0,100%_0,100%_100%,48px_100%,0_calc(100%-40px),0_40px)]">
            <span aria-hidden="true" className="absolute top-1/2 left-[30px] -mt-[13px] size-[26px] rounded-full border-2 border-ink bg-paper" />
            <div className="font-mono text-xs font-semibold tracking-[0.1em] uppercase">
              {t.item.number} · {item.year}
            </div>
            <h1 className="m-0 font-mono text-[clamp(56px,10vw,88px)] leading-[0.9] font-semibold">{item.reperto}</h1>
            <div className="h-0.5 bg-ink" />
            <p lang="it" className="m-0 text-[22px] leading-tight font-extrabold break-words">
              {segments(item.descr).join(' · ')}
            </p>
            <dl className="m-0 flex flex-wrap gap-x-6 gap-y-3 font-mono">
              <div>
                <dt className={dt}>{t.item.received}</dt>
                <dd className="m-0 mt-1">{formatDate(item.date)}</dd>
              </div>
              <div>
                <dt className={dt}>{t.item.type}</dt>
                <dd className="m-0 mt-1">{t.categories[item.category] ?? item.category}</dd>
              </div>
              <div>
                <dt className={dt}>{t.item.source}</dt>
                <dd className="m-0 mt-1">
                  <a href={item.source.url} target="_blank" rel="noreferrer">
                    {t.item.page(item.source.page)}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
          <p className="m-0 flex items-start gap-3 border-2 border-dashed border-ink p-4 text-sm leading-normal">
            <Lock size={20} className="mt-px flex-none" />
            {t.item.numbersHidden}
          </p>
        </section>

        <section aria-labelledby="collect" className="flex min-w-0 flex-[999_1_460px] flex-col gap-6">
          <h2 id="collect" className="font-wide m-0 text-[40px] leading-none font-black">
            {t.pickup.title}
          </h2>
          <Pickup reference={ref} />
        </section>
      </div>
    </div>
  )
}
