// One badge style for item and booking statuses in the back-office.
const TONE: Record<string, string> = {
  available: 'bg-signal text-ink',
  booked: 'bg-signal text-ink',
  reserved: 'bg-manila text-ink',
  collected: 'bg-ink text-card',
  returned: 'bg-ink text-card',
  no_show: 'bg-paper text-muted',
  cancelled: 'bg-paper text-muted',
  discarded: 'bg-paper text-muted line-through',
}

export default function StatusBadge({ kind, label }: { kind: string; label: string }) {
  return (
    <span className={`self-center border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase ${TONE[kind] ?? 'bg-card'}`}>
      {label}
    </span>
  )
}
