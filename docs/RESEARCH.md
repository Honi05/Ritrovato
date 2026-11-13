# Research

Written by `researcher`. Each section is a ready recipe for a builder: what, how,
code example, limits, source.

## Exa

- What: search for agents; returns page text.
- SDK: <python / js, version>
- Recipe:
```
<minimal working example>
```
- Limits and pricing: <...>
- Source: <docs link>

## ElevenLabs

- Conversational AI (voice agent): <how to create it, how to embed it on the web>
- Outbound calls to Italian numbers: <does it work? via what? source>
- TTS for short replies: <...>

## Avalanche (only if the product uses it)

<...>

## Rome data

| Source | What it has | Format | Link | Usable? |
|---|---|---|---|---|

## Claude: structured output and image input (answered)

Verified against the official docs (not run live: no `ANTHROPIC_API_KEY` in `.env`).
Both `claude-haiku-5-5` and `claude-sonnet-5-5` are listed as supporting structured
outputs and vision. No beta header needed.
Sources: <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>,
<https://platform.claude.com/docs/en/build-with-claude/vision>

Install: `pip install anthropic pydantic`.

### Text -> `Interpreted` (`server/app/interpret.py`)

`client.messages.parse(..., output_format=<PydanticModel>)` sends the schema as
`output_config.format` and returns `response.parsed_output` (a validated model).

```python
import anthropic
from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel

CATEGORIES = Literal["phone", "wallet", "..."]  # the 15 ids from docs/DATA.md

class Interpreted(BaseModel):
    category: Optional[CATEGORIES] = None
    brand: Optional[str] = None           # UPPERCASE as in registry, e.g. "SAMSUNG"
    keywords: list[str] = []              # Italian, as the registry words them
    date_from: Optional[str] = None       # ISO yyyy-mm-dd
    date_to: Optional[str] = None
    ignored: list[str] = []               # e.g. ["colour"]

client = anthropic.Anthropic()            # reads ANTHROPIC_API_KEY; use AsyncAnthropic in async routes

SYSTEM = (f"Today is {date.today()}. Map the user's lost-item description (any language) to "
          "filters over Rome's found-items registry (Italian text). Never invent items. "
          "Put attributes the registry does not record (colour, place) into `ignored`.")

def interpret(query: str) -> Interpreted:
    r = client.messages.parse(
        model="claude-haiku-5-5", max_tokens=400, system=SYSTEM,
        messages=[{"role": "user", "content": query}],
        output_format=Interpreted, timeout=15,
    )
    return r.parsed_output   # validated; on anthropic.APIError / None -> keyword fallback
```

Limits and gotchas (from the docs):
- Supported JSON schema: object/array/string/integer/number/boolean/null, `enum`, `anyOf`,
  internal `$ref`, `default`. Not supported (400): recursive schemas, `minimum`/`maximum`,
  `minLength`/`maxLength`, `additionalProperties` other than false. `parse()` strips these
  from the sent schema and re-validates client-side, so plain Pydantic is fine.
- Use a nested model, not `dict`, for nested data (a `dict` is sent as an empty object).
- First request with a new schema has extra latency (grammar compile, cached 24 h).
  Warm it at server start with one dummy call. Do not change the schema between calls.
- Wrap in try/except: any `anthropic.APIError` or `parsed_output is None` -> keyword fallback.
- Raw-schema alternative: `client.messages.create(..., output_config={"format": {"type":
  "json_schema", "schema": {...}}})`, then `json.loads` the first text block.
- Pricing: not looked up (pricing page not fetched); a 100-token query is negligible.

### Photo -> description (`server/app/photo.py`)

Base64 image block + text block in one user message; sonnet for vision.

```python
import base64, anthropic
client = anthropic.Anthropic()

def describe(img: bytes, media_type: str, lang: str) -> str:   # media_type from UploadFile.content_type
    r = client.messages.create(
        model="claude-sonnet-5-5", max_tokens=300, timeout=20,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type,
                                         "data": base64.standard_b64encode(img).decode()}},
            {"type": "text", "text": f"In {lang}, describe the lost object in one or two sentences: "
                                     "type, brand, colour, material, distinctive marks. Only what is visible."},
        ]}],
    )
    return r.content[0].text    # then feed into interpret() like typed text
```

Limits (vision page):
- Formats: `image/jpeg`, `image/png`, `image/gif`, `image/webp` (matches the contract's
  jpeg/png/webp). Put the image block before the text block.
- Per image: 10 MB **base64-encoded** on the Claude API; max 8000x8000 px; request cap 128 MB.
  Risk: base64 inflates by 4/3, so the contract's "8 MB" upload can become ~10.7 MB and be
  rejected. Fix: cap the upload at 7 MB in `main.py` or downscale with Pillow first.
- Resolution: models 4.7+ use up to 2576 px long edge; larger images are downscaled
  automatically. Cost is ceil(w/28) x ceil(h/28) visual tokens, so downscaling phone photos to
  ~1280 px long edge saves tokens and latency without losing what this task needs.

## Pickup rules for the entry card (answered, Q5)

Fetched 2026-11-13 from official Roma Capitale pages (HTTP 200, text below is verbatim Italian).

Cite these two URLs on the entry card:
- Service page ("Ritirare un oggetto smarrito"):
  <https://www.comune.roma.it/web/it/scheda-servizi.page?contentId=INF39645>
- Office page ("Reparto Oggetti Rinvenuti"):
  <https://www.comune.roma.it/web/it/dettaglio.page?contentId=UFF103808>

Facts:
- Office and address (office page, "Sedi e orari"): "Circonvallazione Ostiense 191, CAP 00154 Roma".
- Opening hours (same): "Apertura al pubblico: lun, mart, merc, ven 8:30/13:00 - giov orario
  continuato 8:30/17:00; dal 25 giugno al 10 settembre di ogni anno lun - ven 8:30/13:00".
- Contacts (same): "Tel: 066769 3220 - 3268 - 3214", oggettismarriti@comune.roma.it,
  PEC protocollo.polizialocale.com@pec.comune.roma.it.
- Documents (service page, "Come accedere al servizio"): "un documento d'identità valido"; "eventuale
  denuncia di furto o smarrimento contenente la descrizione dettagliata dell'oggetto (non
  necessaria per oggetti senza valore o privi di interesse commerciale)"; "tutti gli elementi e gli
  eventuali documenti utili per l'individuazione esatta del bene e per l'effettiva proprietà dello stesso".
- Someone else collects (same section): "documento d'identità valido; originale della delega; copia
  del documento del delegante; eventuale copia della denuncia di smarrimento e/o furto".
  Delega form: <https://www.comune.roma.it/web-resources/cms/documents/Modulo_3_oggetti_rinvenuti_delega_ritiro.pdf>
- Fees (service page, "Tempi e costi", per Deliberazione della Giunta Capitolina n. 421 del
  15 dicembre 2023): "diritti di custodia: EUR 4,60; diritti di istruttoria e ricerca: EUR 5,80;
  deposito (se l'oggetto viene ritirato oltre 30 giorni dall'acquisizione): EUR 17,40".
  So EUR 10,40 within 30 days, EUR 27,80 after.
- Payment: "tramite reversale generata dall'applicativo Servizio Riscossione Reversali SIREWEB in
  uso al Reparto" (i.e. generated by the office, not an online payment).
- Home delivery: "Gli oggetti possono essere recapitati a domicilio su richiesta degli aventi
  diritto, previo pagamento dei diritti dovuti ... Le spese di spedizione sono a carico
  dell'interessato." Courier delega form: <https://www.comune.roma.it/web-resources/cms/documents/NEWModulo_2_oggetti_rinvenuti_corriere.pdf>
- Foreign citizens: lists go to embassies/consulates, which are exempt from custody fees; "I documenti
  d'identità o di riconoscimento sono restituiti senza alcun costo."
- Not found on either page: whether an appointment is required, a "how long items are kept"
  period, and a public-transport/metro description. Do not state these on the card.
- Caveat: the opening-hours text says nothing about holidays; show it as "as published by Roma
  Capitale" with the link. The service page also says the lists stay published for one calendar year.
- Side finding for the Open question on `INF39645`: the page exposes the PDFs as plain links
  (`/web-resources/cms/documents/Rinvenimenti_01012026_11112026.pdf`) and was fetchable with a
  plain `curl -sL` (200, ~100 KB HTML), no browser needed.

## ElevenLabs Scribe (answered, 2026-11-13, from elevenlabs.io docs)

- `POST https://api.elevenlabs.io/v1/speech-to-text`, header `xi-api-key`,
  `multipart/form-data`: `file`, `model_id` (`scribe_v2` in examples; try `scribe_v3`,
  fall back to v2 on 4xx).
- Omit `language_code` → auto-detected; response has `text`, `language_code`,
  `language_probability`.
- Accepts `audio/webm`, `audio/opus`, `audio/mp4`, `audio/aac` — Chrome and Safari
  recordings go as-is. Min 100 ms; size limit irrelevant for 10 s clips. Latency: unknown,
  measure in block 04.

## Source page INF39645 (answered, 2026-11-13)

- `https://www.comune.roma.it/web/it/informazione-di-servizio.page?contentId=INF39645`
  fetches with plain `curl` (browser User-Agent), no JS needed.
- Current-year link: `href="https://www.comune.roma.it/web-resources/cms/documents/Rinvenimenti_01012026_<DDMMYYYY>.pdf"`
  — the end date changes with each update (11112026 on 13 Nov; our seed is 04112026).
  Block 06: regex `Rinvenimenti_0101(\d{4})_(\d{8})\.pdf`, compare with the stored name.

## Photo -> description via ElevenLabs Agent (answered, probe 2026-11-13)

Agent `agent_1001m7b5fdv5ese97f0hxxjgd9x5`: LLM `gemini-3.5-flash-lite` (image input),
`text_only: true`, `file_input.enabled: true`, prompt = one Italian sentence naming the
object (+ brand if readable), or `NESSUN OGGETTO`.

1. `GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=<id>&include_conversation_id=true`,
   header `xi-api-key` -> `signed_url` (contains `conversation_id`).
2. Open WebSocket to `signed_url`, send `{"type": "conversation_initiation_client_data"}`.
3. `POST https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/files`,
   multipart field `file` -> `{"file_id": ...}` (no auth header needed).
4. Send `{"type": "multimodal_message", "text": {"type": "user_message", "text": "Descrivi l'oggetto nella foto.", "source_medium": "image"}, "files": [{"type": "file_input", "file_id": "<id>"}]}`.
5. Reply: event `agent_response` -> `agent_response_event.agent_response`. Answer `ping`
   with `{"type": "pong", "event_id": ping_event.event_id}`.

Measured: 2.6-3.1 s end to end (model 0.9 s). Keyring photo -> "Portachiavi Wikimedia"
-> `interpret.search` -> category `keys`, 958 items. Probe script:
`scripts/el_photo_probe.py` (base for block 05). Billed per uploaded file.

## Open questions

None.
