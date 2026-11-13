// "Narrow it down" chips (docs/plans/blocks/07b-refine-chips.md). `word` is what the register
// writes in its Italian descriptions; it is sent as part of `q` and stays Italian in every UI language.
export type Chip = { id: string; word: string }

const c = (id: string, word: string): Chip => ({ id, word })

const CARD_HOLDERS: Chip[] = [
  c('intesa', 'INTESA'),
  c('unicredit', 'UNICREDIT'),
  c('poste', 'POST'),
  c('bnl', 'BNL'),
  c('revolut', 'REVOLUT'),
  c('foreignCard', 'ESTER'),
  c('idCard', 'IDENTITA'),
  c('licence', 'PATENTE'),
]

export const CHIPS: Record<string, Chip[]> = {
  wallet: CARD_HOLDERS,
  payment_card: CARD_HOLDERS,
  id_document: [
    c('idCard', 'IDENTITA'),
    c('licence', 'PATENTE'),
    c('passport', 'PASSAPORTO'),
    c('permit', 'SOGGIORNO'),
    c('health', 'SANITARIA'),
    c('foreign', 'ESTER'),
  ],
  phone: [c('withSim', 'CON SIM'), c('noSim', 'SENZA SIM'), c('foreignSim', 'SIM ESTERA')],
  bag: [
    c('backpack', 'ZAINO'),
    c('shoulder', 'BORSELLO'),
    c('suitcase', 'TROLLEY'),
    c('pouch', 'POCHETTE'),
    c('hadWallet', 'PORTAFOGLI'),
    c('hadKeys', 'CHIAVI'),
  ],
  glasses: [c('prescription', 'DA VISTA'), c('sunglasses', 'DA SOLE')],
  electronics: [c('earphones', 'AURICOLARE'), c('tablet', 'IPAD'), c('laptop', 'PORTATILE'), c('ereader', 'LETTORE LIBRI')],
}

/** ISO date plus `days`, computed in UTC so the local time zone cannot shift it. */
export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
