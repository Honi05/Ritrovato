# Agentic Hack Rome — idee di progetto

**Tema:** risolvere i problemi di Roma con gli agenti AI.
**Formato:** 13–14 novembre, Urbe Hub (Testaccio), consegna sabato alle 14:00. Demo di 3 minuti dal vivo, senza slide.
**Sponsor:** Exa (ricerca per agenti), ElevenLabs (voce), team1 / Avalanche (blockchain).

---

## 1. «Ti chiamo io» — l'agente che telefona al posto tuo ⭐
**Problema:** prenotare una visita tramite il CUP della Regione Lazio significa settimane di attesa e ore al telefono. Anziani e stranieri rinunciano.
**Soluzione:** l'utente dice a voce, in qualsiasi lingua, «mi serve un'ecografia, ecco la ricetta». L'agente trova con Exa dove e come prenotare (ASL, strutture in convenzione), chiama da solo con un agente vocale ElevenLabs in italiano e restituisce il risultato: data, indirizzo, cosa portare.
**Demo:** sul palco squilla il telefono e l'agente prenota a voce con lo «sportello».
**Premi:** principale, ElevenLabs, Exa.

## 2. «Permesso Pilot» — guida alla burocrazia per stranieri
**Problema:** codice fiscale, residenza, permesso di soggiorno, tessera sanitaria — procedure confuse e solo in italiano.
**Soluzione:** agente vocale nella lingua dell'utente; Exa recupera le regole aggiornate dai siti ufficiali. Risultato: checklist personale, moduli compilati, bozze di PEC.
**Rischio:** simile al vincitore della scorsa edizione (Permesso Digitale).
**Premi:** principale, ElevenLabs, Exa.

## 3. «Segnala Roma» — segnalazioni che arrivano a destinazione
**Problema:** buche, rifiuti, lampioni rotti — non si sa a chi segnalarli e le segnalazioni si perdono.
**Soluzione:** foto o messaggio vocale → l'agente riconosce il problema e l'ufficio competente (Municipio, AMA, Roma Capitale), scrive la segnalazione formale e ne segue la risposta. Ogni segnalazione viene registrata su Avalanche: immutabile e pubblica.
**Premi:** principale, Avalanche, Exa.

## 4. «Sciopero?» — l'agente per i giorni di sciopero
**Problema:** gli scioperi ATAC/Trenitalia bloccano gli spostamenti.
**Soluzione:** l'agente avvisa in anticipo quali tuoi percorsi saltano e propone alternative con i dati GTFS aperti di Roma Mobilità.
**Premi:** Exa.

## 5. «Ricorso» — contestare una multa ZTL
**Problema:** multe ZTL e di sosta, alcune contestabili, ma nessuno sa come.
**Soluzione:** carichi la multa → l'agente verifica i motivi (termini di notifica, segnaletica, giurisprudenza via Exa) e prepara il ricorso.
**Premi:** Exa.

## 6. «Affitto Sicuro» — verifica degli annunci d'affitto
**Problema:** studenti e stranieri vengono truffati in massa: case inesistenti, caparra prima della visita, contratti irregolari.
**Soluzione:** incolli il link dell'annuncio → l'agente cerca con Exa le stesse foto e testi in altri annunci, confronta il prezzo con la media della zona e analizza il contratto (cedolare secca, registrazione, deposito ≤ 3 mensilità). Risultato: semaforo e domande da fare al proprietario.
**Demo:** «🔴 queste foto compaiono già in 4 annunci a Milano».
**Premi:** principale, Exa.

## 7. «Voce di Quartiere» — cosa ha deciso davvero il Comune
**Problema:** le decisioni dei Municipi e di Roma Capitale finiscono in PDF che nessuno legge.
**Soluzione:** inserisci la tua via → l'agente trova le decisioni recenti sul tuo quartiere e ti manda un podcast vocale di 60 secondi (ElevenLabs) nella tua lingua.
**Demo:** inserisci l'indirizzo dell'Hub e in sala parte la puntata su Testaccio.
**Premi:** principale, ElevenLabs, Exa.

## 8. «Cicerone Vero» — la guida che ti porta lontano dalla folla
**Problema:** overtourism — folla a Trevi e al Colosseo, quartieri vicini vuoti.
**Soluzione:** guida vocale: «sono al Pantheon, ho 2 ore» → percorso lontano dalla folla con racconto in cuffia e solo locali autentici. Distribuisce i turisti nella città.
**Premi:** ElevenLabs, Exa.

## 9. «Nonno Digitale» — una linea telefonica per gli anziani
**Problema:** gli anziani non riescono a usare SPID, IO, INPS e sono il bersaglio preferito delle truffe telefoniche.
**Soluzione:** un normale numero di telefono, nessuna app. Parli come con un nipote: «mi è arrivata una lettera dell'INPS, che cos'è?» — l'agente spiega e indica il passo successivo. Se qualcuno chiede codici o soldi, avvisa che è una truffa.
**Demo:** chiamata al numero dal telefono, sul palco.
**Premi:** principale, ElevenLabs.

## 10. «Bando Hunter» — i soldi che non stai prendendo
**Problema:** bandi e agevolazioni di Comune, Lazio e UE restano inutilizzati perché introvabili.
**Soluzione:** intervista vocale di 5 minuti → l'agente trova con Exa i bandi adatti, verifica i requisiti e mostra le scadenze.
**Demo:** «studente, 24 anni, in affitto al Pigneto» → «hai accesso a 3 bandi per €4.200, la prima scadenza tra 12 giorni».
**Premi:** principale, Exa.

---

## Dati riutilizzabili: «Quartieri di Roma 2026» di Urbe Hub

[github.com/urbe-hub/quartieri-roma-2026](https://github.com/urbe-hub/quartieri-roma-2026) (online: [romaquartieri.it](https://romaquartieri.it/)) è il progetto open degli stessi organizzatori: la mappa della nuova geografia amministrativa di Roma (delibera 150/2026). Codice MIT; dati aperti (GeoRoma, OSM ODbL, MIM e Ministero della Salute IODL 2.0, AGENAS, Regione Lazio, GHS-POP CC BY), con attribuzione; il logo Urbe Hub non è riutilizzabile.

**Cosa c'è in `data/`:**
- 457 poligoni di aree (quartieri, rioni, zone) + 15 municipi, GeoJSON.
- ~18 categorie di servizi come punti: farmacie, nidi, scuole, Case della Comunità, pronto soccorso, biblioteche, mercati, sport, parchi, centri anziani, consultori, musei.
- Dettagli delle scuole: posti, chiusure per lavori, link a Scuola in Chiaro.
- Stradario (14.908 vie) diviso per municipio.
- Zone scoperte dai 15 minuti su esagoni di 250 m, con popolazione.

**Come usarli:** come strumenti dell'agente, non facendo un fork dell'interfaccia (un template unico di 6.700 righe). Punto nel poligono → «in quale quartiere/municipio è questo indirizzo»; servizio più vicino per categoria con la fonte; nome della via → coordinate. Per la parte visiva, link diretti al loro sito (`#15=lat,lon` apre i 15 minuti a piedi, anche `#via=`), con un video di riserva.

**Per idea:**
- **N. 3 Segnala Roma** — molto adatto: indirizzo → municipio giusto secondo i nuovi confini → l'ufficio a cui segnalare.
- **N. 7 Voce di Quartiere** — molto adatto: via → quartiere/municipio, la chiave per filtrare le decisioni; più «quali servizi ci sono / mancano» per la puntata.
- **N. 9 Nonno Digitale** — adatto: «dov'è la farmacia / Casa della Comunità / centro anziani più vicino?» con risposta a voce, indirizzo e fonte.
- **N. 1 Ti chiamo io** — di supporto: scegliere la Casa della Comunità o la struttura più vicina prima della chiamata.
- **N. 2 Permesso Pilot** — di supporto: quale ufficio del municipio gestisce la tua residenza.
- **N. 8 Cicerone Vero** — debole: musei, parchi, mercati per quartiere, per percorsi fuori dal centro.
- **N. 4, 5, 6, 10** — utilità scarsa o nulla.

Argomento per il pitch: costruire sui dati aperti degli stessi organizzatori.

---

## Preferite
- **N. 1 e N. 9** — la demo migliore: una telefonata vera sul palco.
- **N. 10** — una cifra concreta in euro sullo schermo, risultato chiaro.

## Da verificare prima dell'hackathon
- Se le chiamate in uscita di ElevenLabs funzionano verso numeri italiani.
- Cosa è davvero disponibile negli open data di Roma Mobilità (N. 4).
- Come vengono pubblicate le delibere di Roma Capitale (N. 7) e se esiste un registro dei bandi (N. 10).
- Il progetto deve essere una web app con link funzionante, non un'app iOS.
- Se è consentito riutilizzare codice/dati open preesistenti (es. quartieri-roma-2026).
