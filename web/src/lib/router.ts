import { useEffect, useState } from 'react'

// Hash routes, so the FastAPI static mount needs no SPA fallback:
//   #/                       home
//   #/search?q=…             free-text search (POST /api/search)
//   #/catalogue?category=…   filtered browse (GET /api/items)
//   #/item/<id>              entry card
//   #/collect                how to collect an item
export type Route =
  | { name: 'home' }
  | { name: 'search'; params: URLSearchParams }
  | { name: 'catalogue'; params: URLSearchParams }
  | { name: 'item'; id: string }
  | { name: 'collect' }

export function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(query)
  if (path === 'search') return { name: 'search', params }
  if (path === 'catalogue') return { name: 'catalogue', params }
  if (path === 'collect') return { name: 'collect' }
  if (path.startsWith('item/')) return { name: 'item', id: decodeURIComponent(path.slice(5)) }
  return { name: 'home' }
}

export function href(path: string, params?: Record<string, string | undefined>) {
  const qs = params
    ? new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString()
    : ''
  return `#/${path}${qs ? `?${qs}` : ''}`
}

export function navigate(to: string) {
  window.location.hash = to.replace(/^#/, '')
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
