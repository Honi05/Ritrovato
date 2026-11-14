import { useEffect, useState } from 'react'
import { getMeta, type Meta } from './api'
import Header from './components/Header'
import Pickup from './components/Pickup'
import { I18nProvider, useI18n } from './i18n'
import { formatDate } from './lib/items'
import { useRoute } from './lib/router'
import OperatorApp from './operator/OperatorApp'
import Catalogue from './pages/Catalogue'
import Home from './pages/Home'
import ItemPage from './pages/ItemPage'
import ManageBooking from './pages/ManageBooking'
import OfficeItemPage from './pages/OfficeItemPage'
import Search from './pages/Search'

export default function App() {
  return (
    <I18nProvider>
      <Root />
    </I18nProvider>
  )
}

function Root() {
  const route = useRoute()
  if (route.name === 'operator') return <OperatorApp page={route.page} params={route.params} />
  return <Shell />
}

function Shell() {
  const route = useRoute()
  const { t, lang } = useI18n()
  const [meta, setMeta] = useState<Meta | null>(null)
  useEffect(() => {
    getMeta().then(setMeta, () => setMeta(null))
  }, [])
  const fresh = meta?.last_checked_at
    ? t.footer.updated(new Date(meta.last_checked_at).toLocaleDateString(lang), meta.new_items_last_check.toLocaleString(lang))
    : meta
      ? t.footer.asOf(formatDate(meta.last_item_date), meta.total.toLocaleString(lang))
      : null

  return (
    <div className="mx-auto box-border max-w-[1200px] px-4 pb-16 sm:px-8">
      <Header route={route} />
      <main>
        {route.name === 'home' && <Home />}
        {route.name === 'search' && <Search params={route.params} />}
        {route.name === 'catalogue' && <Catalogue params={route.params} />}
        {route.name === 'item' && (route.id.startsWith('office-') ? <OfficeItemPage id={route.id} /> : <ItemPage id={route.id} />)}
        {route.name === 'booking' && <ManageBooking token={route.token} />}
        {route.name === 'collect' && (
          <div className="flex max-w-3xl flex-col gap-6 pt-10">
            <h1 className="font-wide m-0 text-[clamp(36px,6vw,56px)] leading-none font-black">{t.pickup.title}</h1>
            <Pickup />
          </div>
        )}
      </main>
      <footer className="mt-16 flex flex-wrap justify-between gap-4 border-t-2 border-ink pt-5 text-sm text-muted">
        {fresh && <span data-testid="freshness" className="basis-full font-mono text-[13px] font-semibold text-ink">{fresh}</span>}
        <span>{t.footer.source}</span>
        <span className="font-mono text-[13px]">{t.footer.honesty}</span>
      </footer>
    </div>
  )
}
