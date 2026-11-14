import { useState } from 'react'
import { opCreateItem } from '../api'
import ItemForm, { emptyForm } from './ItemForm'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

export default function Intake() {
  const t = useOpT()
  const guard = useGuard()
  const [round, setRound] = useState(0) // remounts an empty form after each save
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-wide m-0 text-4xl font-black">{t.nav.new}</h1>
      {toast && <p role="status" data-testid="toast" className="m-0 self-start bg-ink px-4 py-2 font-bold text-card">{toast}</p>}
      {error && <p role="alert" className="m-0 border-l-[6px] border-signal bg-card px-3 py-2">{t.form.error}</p>}
      <ItemForm key={round} initial={emptyForm()} photoUrl={null} busy={busy} submitLabel={t.form.save}
        onSubmit={async (v) => {
          setBusy(true)
          setError(false)
          try {
            const it = await opCreateItem({ ...v, brand: v.brand?.trim() || null })
            setToast(t.form.saved(it.id))
            setRound((n) => n + 1)
            window.scrollTo({ top: 0 })
          } catch (e) {
            guard(e)
            setError(true)
          } finally {
            setBusy(false)
          }
        }} />
    </div>
  )
}
