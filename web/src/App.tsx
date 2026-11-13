import Header from './components/Header'
import Pickup from './components/Pickup'
import { I18nProvider, useI18n } from './i18n'
import { useRoute } from './lib/router'
import Catalogue from './pages/Catalogue'
import Home from './pages/Home'
import ItemPage from './pages/ItemPage'
import Search from './pages/Search'

export default function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  )
}

function Shell() {
  const route = useRoute()
  const { t } = useI18n()

  return (
    <div className="mx-auto box-border max-w-[1200px] px-4 pb-16 sm:px-8">
      <Header route={route} />
      <main>
        {route.name === 'home' && <Home />}
        {route.name === 'search' && <Search query={route.params.get('q') ?? ''} />}
        {route.name === 'catalogue' && <Catalogue params={route.params} />}
        {route.name === 'item' && <ItemPage id={route.id} />}
        {route.name === 'collect' && (
          <div className="flex max-w-3xl flex-col gap-6 pt-10">
            <h1 className="font-wide m-0 text-[clamp(36px,6vw,56px)] leading-none font-black">{t.pickup.title}</h1>
            <Pickup />
          </div>
        )}
      </main>
      <footer className="mt-16 flex flex-wrap justify-between gap-4 border-t-2 border-ink pt-5 text-sm text-muted">
        <span>{t.footer.source}</span>
        <span className="font-mono text-[13px]">{t.footer.honesty}</span>
      </footer>
    </div>
  )
}
