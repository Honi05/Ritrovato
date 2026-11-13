import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { LANGS, type Lang } from '../api'
import de from './de'
import en, { type Strings } from './en'
import es from './es'
import fr from './fr'
import it from './it'

const STRINGS: Record<Lang, Strings> = { it, en, es, fr, de }
const KEY = 'ritrovato.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang
  } catch {
    // storage blocked: fall through to the browser language
  }
  const nav = navigator.language.slice(0, 2)
  return (LANGS as readonly string[]).includes(nav) ? (nav as Lang) : 'it'
}

type Ctx = { lang: Lang; t: Strings; setLang: (l: Lang) => void }
const I18n = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(KEY, lang)
    } catch {
      // not persisted; the switch still works for this visit
    }
  }, [lang])

  return <I18n.Provider value={{ lang, t: STRINGS[lang], setLang }}>{children}</I18n.Provider>
}

export function useI18n() {
  const ctx = useContext(I18n)
  if (!ctx) throw new Error('useI18n outside I18nProvider')
  return ctx
}
