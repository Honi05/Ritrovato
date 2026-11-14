import { useI18n } from '../i18n'

const en = {
  title: 'Back-office',
  logout: 'Log out',
  nav: { today: 'Today', new: 'Log item', items: 'Inventory', bookings: 'Bookings' },
  login: { kicker: 'Lost-property office · staff only', title: 'Operator login', back: '← Back to the public site', username: 'Username', password: 'Password', submit: 'Log in', wrong: 'Wrong username or password.', limited: 'Too many attempts. Wait 10 minutes.' },
  today: { title: 'Today', none: 'No bookings today.', available: 'Available items', week: 'Bookings this week', list: 'Pickups today', log: '+ Log found item' },
  status: { available: 'Available', reserved: 'Reserved', returned: 'Returned', discarded: 'Discarded' } as Record<string, string>,
  bstatus: { booked: 'Booked', collected: 'Collected', no_show: 'No-show', cancelled: 'Cancelled' } as Record<string, string>,
  act: { collected: 'Collected', no_show: 'No-show', cancel: 'Cancel', confirm: 'Confirm', back: 'Back' },
  form: {
    photo: 'Photo', takePhoto: 'Take or choose a photo', replacePhoto: 'Replace photo', reading: 'Reading the photo…',
    aiFailed: 'Could not read the photo. Fill in the fields.', suggested: 'suggested',
    category: 'Category', brand: 'Brand', colour: 'Colour', none: '—', descr: 'Description', place: 'Where found', date: 'Date found',
    save: 'Save', saving: 'Saving…', saved: (id: string) => `Logged as ${id}`, error: 'Save failed. Check the fields and try again.',
  },
  inventory: { title: 'Inventory', all: 'All', search: 'Search', empty: 'No items.', edit: 'Edit', markReturned: 'Mark returned', discard: 'Discard', close: 'Close', more: 'Show more', count: (n: number) => `${n} item${n === 1 ? '' : 's'}` },
  bookings: { title: 'Bookings', date: 'Date', empty: 'No bookings on this day.', free: 'free', prev: 'Previous day', next: 'Next day', today: 'Today', count: (n: number) => `${n} booking${n === 1 ? '' : 's'}` },
  session: 'Your session expired. Log in again.',
}
export type OpStrings = typeof en

const it: OpStrings = {
  title: 'Back-office',
  logout: 'Esci',
  nav: { today: 'Oggi', new: 'Registra oggetto', items: 'Inventario', bookings: 'Prenotazioni' },
  login: { kicker: 'Ufficio oggetti smarriti · solo personale', title: 'Accesso operatore', back: '← Torna al sito pubblico', username: 'Utente', password: 'Password', submit: 'Entra', wrong: 'Utente o password errati.', limited: 'Troppi tentativi. Attendi 10 minuti.' },
  today: { title: 'Oggi', none: 'Nessuna prenotazione oggi.', available: 'Oggetti disponibili', week: 'Prenotazioni della settimana', list: 'Ritiri di oggi', log: '+ Registra oggetto trovato' },
  status: { available: 'Disponibile', reserved: 'Prenotato', returned: 'Restituito', discarded: 'Eliminato' },
  bstatus: { booked: 'Prenotato', collected: 'Ritirato', no_show: 'Non presentato', cancelled: 'Annullato' },
  act: { collected: 'Ritirato', no_show: 'Non presentato', cancel: 'Annulla', confirm: 'Conferma', back: 'Indietro' },
  form: {
    photo: 'Foto', takePhoto: 'Scatta o scegli una foto', replacePhoto: 'Sostituisci foto', reading: 'Lettura della foto…',
    aiFailed: 'Impossibile leggere la foto. Compila i campi.', suggested: 'suggerito',
    category: 'Categoria', brand: 'Marca', colour: 'Colore', none: '—', descr: 'Descrizione', place: 'Dove è stato trovato', date: 'Data del ritrovamento',
    save: 'Salva', saving: 'Salvataggio…', saved: (id: string) => `Registrato come ${id}`, error: 'Salvataggio non riuscito. Controlla i campi e riprova.',
  },
  inventory: { title: 'Inventario', all: 'Tutti', search: 'Cerca', empty: 'Nessun oggetto.', edit: 'Modifica', markReturned: 'Segna restituito', discard: 'Elimina', close: 'Chiudi', more: 'Mostra altri', count: (n: number) => `${n} oggett${n === 1 ? 'o' : 'i'}` },
  bookings: { title: 'Prenotazioni', date: 'Data', empty: 'Nessuna prenotazione in questo giorno.', free: 'libero', prev: 'Giorno precedente', next: 'Giorno successivo', today: 'Oggi', count: (n: number) => `${n} prenotazion${n === 1 ? 'e' : 'i'}` },
  session: 'Sessione scaduta. Accedi di nuovo.',
}

export function useOpT(): OpStrings {
  const { lang } = useI18n()
  return lang === 'it' ? it : en
}
