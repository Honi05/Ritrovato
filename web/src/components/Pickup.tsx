import { useI18n } from '../i18n'

// Facts and links from docs/RESEARCH.md → "Pickup rules for the entry card".
const SERVICE_URL = 'https://www.comune.roma.it/web/it/scheda-servizi.page?contentId=INF39645'
const OFFICE_URL = 'https://www.comune.roma.it/web/it/dettaglio.page?contentId=UFF103808'
const DELEGA_URL = 'https://www.comune.roma.it/web-resources/cms/documents/Modulo_3_oggetti_rinvenuti_delega_ritiro.pdf'

/** How to collect an item. `reference` ("6544/2026") personalises step 1 on an entry card. */
export default function Pickup({ reference }: { reference?: string }) {
  const { t } = useI18n()
  const p = t.pickup
  const step = 'flex gap-4 px-5 py-5'
  const num = 'font-mono text-[22px] font-semibold'

  return (
    <div className="flex flex-col gap-6">
      <ol className="m-0 flex list-none flex-col border-2 border-ink bg-card p-0">
        <li className={`${step} border-b-2 border-ink`}>
          <span className={num}>1</span>
          <div className="flex flex-col gap-1.5">
            <strong className="text-lg">{p.write}</strong>
            {reference && <span className="text-[15px] leading-normal text-muted">{p.writeBody(reference)}</span>}
            <a href="mailto:oggettismarriti@comune.roma.it" className="font-mono text-[15px] font-semibold break-all">
              oggettismarriti@comune.roma.it
            </a>
          </div>
        </li>
        <li className={`${step} border-b-2 border-ink`}>
          <span className={num}>2</span>
          <div className="flex flex-col gap-1.5">
            <strong className="text-lg">{p.proof}</strong>
            <span className="text-[15px] leading-normal text-muted">{p.proofBody}</span>
          </div>
        </li>
        <li className={step}>
          <span className={num}>3</span>
          <div className="flex flex-col gap-1.5">
            <strong className="text-lg">{p.go}</strong>
            <span className="text-[15px] leading-normal text-muted">{p.address}</span>
            <span className="font-mono text-[13px] leading-normal">{p.hours}</span>
            <span className="font-mono text-[13px]">{p.phone}</span>
          </div>
        </li>
      </ol>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-0.5 border-2 border-ink bg-ink">
        <Fee amount="€4,60" label={p.custody} />
        <Fee amount="€5,80" label={p.search} />
        <Fee amount="+€17,40" label={p.deposit} />
        <Fee amount="€0" label={p.idFree} accent />
      </div>
      <p className="m-0 text-[13px] text-muted">
        {p.feesNote}{' '}
        <a href={SERVICE_URL} target="_blank" rel="noreferrer">
          {p.official}
        </a>
        {' · '}
        <a href={OFFICE_URL} target="_blank" rel="noreferrer">
          Reparto Oggetti Rinvenuti
        </a>
      </p>

      <details className="border-2 border-ink bg-card">
        <summary className="cursor-pointer px-5 py-4 text-base font-extrabold">{p.delegate}</summary>
        <div className="flex flex-col gap-2 px-5 pb-5">
          <p className="m-0 text-[15px] leading-normal text-muted">{p.delegateBody}</p>
          <a href={DELEGA_URL} target="_blank" rel="noreferrer" className="font-semibold">
            {p.delegateForm}
          </a>
        </div>
      </details>
    </div>
  )
}

function Fee({ amount, label, accent }: { amount: string; label: string; accent?: boolean }) {
  return (
    <div className={`p-4 ${accent ? 'bg-signal' : 'bg-card'}`}>
      <div className="font-mono text-[26px] font-semibold">{amount}</div>
      <div className="mt-1 text-[13px]">{label}</div>
    </div>
  )
}
