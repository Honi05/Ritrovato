export const CATEGORIES = [
  'wallet', 'id_document', 'payment_card', 'bag', 'phone', 'other', 'keys', 'document_other',
  'electronics', 'clothing', 'glasses', 'sim', 'watch_jewelry', 'money', 'vehicle',
] as const

export const COLOURS = [
  'black', 'white', 'grey', 'silver', 'gold', 'red', 'orange', 'yellow', 'green', 'blue',
  'purple', 'pink', 'brown', 'beige', 'multicolour',
] as const
export type Colour = (typeof COLOURS)[number]

export const SWATCH: Record<Colour, string> = {
  black: '#111111', white: '#ffffff', grey: '#8a8a8a', silver: '#c8c8cc', gold: '#d4a017', red: '#c62828',
  orange: '#ef6c00', yellow: '#f9d71c', green: '#2e7d32', blue: '#1e5bb8', purple: '#6a1b9a', pink: '#e88aa8',
  brown: '#6d4c41', beige: '#d8c3a5',
  multicolour: 'conic-gradient(#c62828, #f9d71c, #2e7d32, #1e5bb8, #6a1b9a, #c62828)',
}
