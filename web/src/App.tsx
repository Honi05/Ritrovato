import { useEffect, useState } from 'react'
import { getMeta, type Meta } from './api'

// Skeleton screen: proves web → /api → SQLite works end to end. Block 03 replaces it.
export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMeta().then(setMeta, (e) => setError(String(e)))
  }, [])

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-3xl font-bold">Oggetti smarriti — Roma</h1>
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {meta && (
        <p className="mt-4 text-neutral-600">
          {meta.total} items in the catalogue, latest from {meta.last_item_date}.
        </p>
      )}
    </main>
  )
}
