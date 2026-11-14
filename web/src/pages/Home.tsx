import { useEffect, useState } from 'react'
import { getItems, getMeta, type Item, type Meta } from '../api'
import SearchBar from '../components/SearchBar'
import { useI18n } from '../i18n'
import { formatDate, segments } from '../lib/items'
import { href } from '../lib/router'

export default function Home() {
  const { t, lang } = useI18n()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [newest, setNewest] = useState<Item | null>(null)

  useEffect(() => {
    getMeta().then(setMeta, () => setMeta(null))
    getItems({ limit: 1 }).then((r) => setNewest(r.items[0] ?? null), () => setNewest(null))
  }, [])

  const fmt = (n: number) => n.toLocaleString(lang)
  const checked = meta?.last_checked_at
    ? new Date(meta.last_checked_at).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' })
    : t.home.statNotYet

  return (
    <>
      <section className="flex flex-wrap items-center gap-12 pt-16 pb-12">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <p className="m-0 font-mono text-[13px] font-semibold tracking-[0.08em] uppercase">{t.home.kicker}</p>
          <h1 className="font-wide m-0 text-[clamp(44px,7vw,92px)] leading-[0.92] font-black tracking-[-0.02em]">
            {t.home.title}
          </h1>
          <p className="m-0 max-w-[560px] text-[19px] leading-normal text-muted">{t.home.lead}</p>
          <SearchBar big />
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            <span className="font-mono text-xs font-semibold text-muted uppercase">{t.home.try}</span>
            {t.home.examples.map((ex) => (
              <a
                key={ex}
                href={href('search', { q: ex })}
                className="rounded-full border-[1.5px] border-ink bg-card px-3.5 py-2 no-underline"
              >
                {ex}
              </a>
            ))}
          </div>
        </div>

        {newest && (
          <div aria-hidden="true" className="flex flex-[1_1_320px] justify-center py-6">
            <div className="relative w-[300px] max-w-full -rotate-[5deg]">
              <div className="tag-shape relative flex flex-col gap-3.5 border-2 border-ink bg-manila py-7 pr-7 pl-16 shadow-[10px_10px_0_rgba(17,17,17,0.18)]">
                <span className="absolute top-1/2 left-[22px] -mt-2.5 size-5 rounded-full border-2 border-ink bg-paper" />
                <span className="font-mono text-xs font-semibold tracking-[0.1em]">{t.item.number}</span>
                <span className="font-mono text-[54px] leading-none font-semibold">{newest.reperto}</span>
                <span className="h-0.5 bg-ink" />
                <span className="text-xl leading-tight font-extrabold">{segments(newest.descr)[0]}</span>
                <span className="flex justify-between font-mono text-[13px]">
                  <span>{formatDate(newest.date)}</span>
                  {newest.source && <span>{t.item.page(newest.source.page)}</span>}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {meta && (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-0.5 border-2 border-ink bg-ink">
          <Stat value={fmt(meta.total)} label={t.home.statEntries} />
          <Stat value={formatDate(meta.last_item_date)} label={t.home.statNewest} />
          <Stat value={checked} label={t.home.statChecked} accent />
        </section>
      )}

      {meta && (
        <section className="flex flex-col gap-5 pt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-wide m-0 text-[32px] font-black">{t.home.browse}</h2>
            <a href={href('catalogue')} className="text-[15px] font-bold">
              {t.home.openCatalogue} →
            </a>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
            {meta.categories.map((c, i) => (
              <a
                key={c.id}
                href={href('catalogue', { category: c.id })}
                className={`flex min-h-[92px] flex-col items-start justify-between gap-2.5 border-2 border-ink px-[18px] py-4 font-bold no-underline ${i < 1 || c.id === 'phone' ? 'bg-manila' : 'bg-card hover:bg-white'}`}
              >
                {t.categories[c.id] ?? c.id}
                <span className="font-mono text-[22px] font-semibold">{fmt(c.count)}</span>
              </a>
            ))}
          </div>
          <a href={href('catalogue', { source: 'office' })} className="self-start text-[15px] font-bold">
            {t.office.recent} →
          </a>
        </section>
      )}

      <section className="mt-14 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
        {t.home.steps.map(([title, body], i) => (
          <div key={title} className="flex flex-col gap-2.5 border-t-[3px] border-ink pt-4">
            <span className="font-mono text-[13px] font-semibold">0{i + 1}</span>
            <h3 className="m-0 text-[21px] font-extrabold">{title}</h3>
            <p className="m-0 leading-normal text-muted">{body}</p>
          </div>
        ))}
      </section>
    </>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`px-[22px] py-5 ${accent ? 'bg-signal' : 'bg-card'}`}>
      <div className="font-mono text-[clamp(24px,3vw,34px)] font-semibold">{value}</div>
      <div className={`mt-1 text-sm ${accent ? 'text-ink' : 'text-muted'}`}>{label}</div>
    </div>
  )
}
