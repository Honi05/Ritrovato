"""Text -> Interpreted filters via an ElevenLabs agent, then DeepSeek, then mapped keyword filters."""
import json
import logging
import os
import re
import time
from datetime import datetime
from functools import lru_cache

import httpx
from websockets.sync.client import connect

from . import db, office

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEFAULT_MODEL = "deepseek-chat"
TIMEOUT = 6.0  # DeepSeek
INTERPRET_AGENT_ID = "agent_9601m7b9whwse8g8nfzkdks3y4j5"
AGENT_TIMEOUT = 5.0  # worst case 3 s signed URL + 5 s agent + 6 s DeepSeek = 14 s
SIGNED_URL_TIMEOUT = 3.0

_IGNORED_KEYS = {"colour", "place", "photo", "other_unrecorded"}

_WORD_RE = re.compile(r"[A-Za-zÀ-ÿ]{3,}")

_STOPWORDS = {
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they", "them",
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for", "with",
    "this", "that", "these", "those", "is", "are", "was", "were", "be", "been",
    "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "del", "della",
    "dei", "degli", "delle", "e", "ed", "a", "ad", "da", "con", "su", "per", "tra",
    "fra", "che", "chi", "cui", "non", "si", "mi", "ti", "ci", "vi", "ne", "io",
    "tu", "lui", "lei", "noi", "voi", "loro", "el", "ella", "los", "las", "unos",
    "unas", "de", "del", "en", "por", "para", "con", "sin", "se", "su", "yo",
    "usted", "nosotros", "le", "les", "des", "du", "une", "un", "et", "au", "aux",
    "pour", "avec", "sans", "sur", "je", "tu", "nous", "vous", "ils", "der", "die",
    "das", "ein", "eine", "einer", "einem", "einen", "und", "oder", "im", "von",
    "zu", "auf", "mit", "ich", "du", "sie", "wir", "ihr",
    "lost", "found", "smarrito", "smarrita", "ritrovato", "ritrovata", "object",
    "oggetto", "item", "looking", "cercando", "cerchi", "need", "hello", "help",
    "sul", "sulla", "nel", "nella", "al", "allo", "alla",
}

_MONTHS = {
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
    "agosto", "settembre", "ottobre", "novembre", "dicembre",
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre",
    "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
    "septembre", "octobre", "novembre", "décembre",
    "januar", "februar", "märz", "april", "mai", "juni", "juli", "august",
    "september", "oktober", "november", "dezember",
}

_COLOURS = {
    "black", "white", "red", "blue", "green", "yellow", "orange", "pink",
    "grey", "gray", "brown", "purple", "gold", "silver",
    "nero", "nera", "bianco", "bianca", "rosso", "rossa", "blu", "verde",
    "giallo", "arancione", "rosa", "grigio", "grigia", "marrone", "viola",
    "oro", "argento",
    "negro", "blanco", "rojo", "azul", "verde", "amarillo", "naranja", "rosa",
    "gris", "marrón", "morado", "dorado", "plateado",
    "noir", "noire", "blanc", "blanche", "rouge", "bleu", "vert", "jaune",
    "orange", "rose", "gris", "grises", "marron", "violet", "or", "argent",
    "schwarz", "weiß", "rot", "blau", "grün", "gelb", "orange", "rosa",
    "grau", "braun", "lila", "gold", "silber",
    "colour", "color", "colore",
}

_PLACE_WORDS = {
    "place", "luogo", "posto", "lugar", "lieu", "ort", "piazza", "via", "street",
    "strada", "road", "metro", "bus", "station", "stazione", "airport", "aeroporto",
    "park", "parco", "school", "scuola", "university", "universita", "università",
}

_PHOTO_WORDS = {
    "photo", "foto", "picture", "image", "selfie", "screenshot", "immagine", "bild",
}

_CATEGORY_WORD_MAP = {
    # phones
    "phone": "phone",
    "cellphone": "phone",
    "mobile": "phone",
    "smartphone": "phone",
    "iphone": "phone",
    "telefono": "phone",
    "cellulare": "phone",
    "teléfono": "phone",
    "telefono": "phone",
    "movil": "phone",
    "móvil": "phone",
    "celular": "phone",
    "téléphone": "phone",
    "telephone": "phone",
    "portable": "phone",
    "handy": "phone",
    "telefon": "phone",
    "mobiltelefon": "phone",
    # wallets
    "wallet": "wallet",
    "portafoglio": "wallet",
    "portafogli": "wallet",
    "borsellino": "wallet",
    "cartera": "wallet",
    "monedero": "wallet",
    "portefeuille": "wallet",
    "geldbörse": "wallet",
    "geldborse": "wallet",
    "portemonnaie": "wallet",
    # keys
    "keys": "keys",
    "key": "keys",
    "chiavi": "keys",
    "chiave": "keys",
    "llaves": "keys",
    "llave": "keys",
    "clés": "keys",
    "cles": "keys",
    "clé": "keys",
    "cle": "keys",
    "schlüssel": "keys",
    "schluessel": "keys",
    # bags
    "bag": "bag",
    "backpack": "bag",
    "rucksack": "bag",
    "borsa": "bag",
    "zaino": "bag",
    "mochila": "bag",
    "sac": "bag",
    "bolso": "bag",
    "tasche": "bag",
    # id documents
    "id": "id_document",
    "identity": "id_document",
    "dni": "id_document",
    "ausweis": "id_document",
    "identità": "id_document",
    "identita": "id_document",
    # payment cards
    "card": "payment_card",
    "credit": "payment_card",
    "debit": "payment_card",
    "bancomat": "payment_card",
    "tarjeta": "payment_card",
    "kreditkarte": "payment_card",
    "bankkarte": "payment_card",
    # other documents
    "document": "document_other",
    "documento": "document_other",
    "documenti": "document_other",
    "documentos": "document_other",
    "documents": "document_other",
    "unterlagen": "document_other",
    # sim
    "sim": "sim",
    "scheda": "sim",
    # money
    "money": "money",
    "cash": "money",
    "contanti": "money",
    "soldi": "money",
    "denaro": "money",
    "dinero": "money",
    "efectivo": "money",
    "argent": "money",
    "bargeld": "money",
    # glasses
    "glasses": "glasses",
    "sunglasses": "glasses",
    "occhiali": "glasses",
    "gafas": "glasses",
    "lunettes": "glasses",
    "brille": "glasses",
    # watch / jewelry
    "watch": "watch_jewelry",
    "jewelry": "watch_jewelry",
    "jewellery": "watch_jewelry",
    "ring": "watch_jewelry",
    "necklace": "watch_jewelry",
    "orologio": "watch_jewelry",
    "gioielli": "watch_jewelry",
    "reloj": "watch_jewelry",
    "montre": "watch_jewelry",
    "uhr": "watch_jewelry",
    "schmuck": "watch_jewelry",
    # electronics
    "electronics": "electronics",
    "laptop": "electronics",
    "computer": "electronics",
    "tablet": "electronics",
    "ipad": "electronics",
    "headphones": "electronics",
    "charger": "electronics",
    "powerbank": "electronics",
    "elettronica": "electronics",
    "electrónica": "electronics",
    "electronica": "electronics",
    "électronique": "electronics",
    "electronique": "electronics",
    "elektronik": "electronics",
    # clothing
    "clothing": "clothing",
    "clothes": "clothing",
    "jacket": "clothing",
    "shirt": "clothing",
    "vestiti": "clothing",
    "abbigliamento": "clothing",
    "ropa": "clothing",
    "vêtements": "clothing",
    "vetements": "clothing",
    "kleidung": "clothing",
    # vehicles
    "vehicle": "vehicle",
    "car": "vehicle",
    "bike": "vehicle",
    "bicycle": "vehicle",
    "scooter": "vehicle",
    "veicolo": "vehicle",
    "vehículo": "vehicle",
    "vehiculo": "vehicle",
    "véhicule": "vehicle",
    "vehicule": "vehicle",
    "fahrzeug": "vehicle",
    # other
    "other": "other",
    "altro": "other",
    "otros": "other",
    "autre": "other",
}

_BRAND_ALIASES = {
    "IPHONE": "APPLE",
    "IPAD": "APPLE",
    "MACBOOK": "APPLE",
    "GALAXY": "SAMSUNG",
    "PIXEL": "GOOGLE",
}


def _category_ids() -> list[str]:
    try:
        return [c["id"] for c in db.meta()["categories"]]
    except Exception:
        return []


def _prompt(categories: list[str]) -> str:
    cats = ", ".join(categories) if categories else "none"
    return (
        f"Today is {datetime.today().strftime('%Y-%m-%d')}. "
        "Return a single JSON object only, no markdown. "
        "Map the user's lost-item description, in any language, to filters over "
        "Rome's found-items registry (Italian descriptions). "
        f"Available categories: {cats}. "
        'Use the JSON keys "category" (one of the listed category ids or null), '
        '"brand" (official registry brand name in UPPERCASE, e.g. "SAMSUNG", or null), '
        '"keywords" (0-3 ITALIAN words as the registry writes them, most specific first; '
        "translate from the user language; never copy foreign words, articles or "
        "prepositions; no colours, places, personal data; never the item itself when the "
        "category already says it: no PORTAFOGLI for wallet, no TELEFONO for phone, no CHIAVI "
        "for keys). Registry vocabulary: banks INTESA, UNICREDIT, POSTEPAY, BNL, REVOLUT, "
        "FINECO, AMERICAN EXPRESS; card kinds BANCOMAT, CARTA DI CREDITO; foreign = ESTER; "
        "documents IDENTITA (identity card), PATENTE (driving licence), PASSAPORTO, "
        "SOGGIORNO (residence permit), SANITARIA (health card); phone CON SIM, SENZA SIM; "
        "bags ZAINO (backpack), BORSELLO, TROLLEY (suitcase), POCHETTE; glasses DA VISTA, "
        "DA SOLE; electronics AURICOLARE (earphones), IPAD, PORTATILE (laptop); wallet "
        "PORTAFOGLI (never PORTAFOGLIO), keys CHIAVI, phone TELEFONO; contents of "
        'a bag or wallet are keywords too (wallet with Intesa card and licence -> '
        '["INTESA", "PATENTE"]). "date_from" and "date_to" (ISO yyyy-mm-dd or null; '
        'a month such as "October" -> that month in the current year; a single day the '
        "user LOST it -> date_from = that day, date_to = 14 days later, because items are "
        "logged when found), and "
        '"ignored": the registry does not record colour, place found, or looks; list '
        'ONLY the ones the user actually mentioned, as keys "colour", "place", "photo", '
        '"other_unrecorded" (e.g. "black phone at Termini" -> ["colour", "place"]; '
        '"Samsung phone" -> []). Never include user words in "ignored". '
        f'Also "colour": the item colour as one of {", ".join(office.COLOURS)}, or null; and '
        '"place": where it was lost, as the user wrote it (e.g. "Termini", "bus 64"), or null. '
        "Colour and place stay listed in ignored as well."
    )


def _request_filter(text: str, lang: str) -> dict | None:
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        return None

    body = {
        "model": os.environ.get("LLM_MODEL", DEFAULT_MODEL),
        "messages": [
            {"role": "system", "content": _prompt(_category_ids())},
            {"role": "user", "content": f"{lang}: {text}"},
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 400,
        "temperature": 0,
    }

    try:
        response = httpx.post(
            DEEPSEEK_URL,
            headers={"Authorization": f"Bearer {key}"},
            json=body,
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _request_filter_agent(text: str, lang: str) -> dict | None:
    """Same prompt via the ElevenLabs text-only agent; None on any failure (DeepSeek is the fallback)."""
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        return None
    agent_id = os.environ.get("ELEVENLABS_INTERPRET_AGENT_ID", INTERPRET_AGENT_ID)
    try:
        signed = httpx.get(
            "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
            params={"agent_id": agent_id},
            headers={"xi-api-key": key},
            timeout=SIGNED_URL_TIMEOUT,
        )
        signed.raise_for_status()
        with connect(signed.json()["signed_url"], open_timeout=SIGNED_URL_TIMEOUT, max_size=None) as ws:
            ws.send(json.dumps({
                "type": "conversation_initiation_client_data",
                "conversation_config_override": {"agent": {"prompt": {"prompt": _prompt(_category_ids())}}},
            }))
            ws.send(json.dumps({"type": "user_message", "text": f"{lang}: {text}"}))
            deadline = time.monotonic() + AGENT_TIMEOUT
            while (left := deadline - time.monotonic()) > 0:
                message = json.loads(ws.recv(timeout=left))
                if message.get("type") == "ping":
                    ws.send(json.dumps({"type": "pong", "event_id": message["ping_event"]["event_id"]}))
                elif message.get("type") == "agent_response":
                    answer = message["agent_response_event"]["agent_response"].strip()
                    answer = answer.removeprefix("```json").removeprefix("```").removesuffix("```")
                    parsed = json.loads(answer)
                    return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None
    return None


def _iso_date(value) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return value
    except ValueError:
        return None


def _tokens(value) -> list[str]:
    if isinstance(value, str):
        return value.split()
    if isinstance(value, (list, tuple)):
        result: list[str] = []
        for item in value:
            s = str(item).strip()
            if s:
                result.extend(s.split())
        return result
    return []


def _normalize_ignored(value) -> list[str]:
    """Return only fixed registry-attribute keys; never leak user words."""
    keys: list[str] = []
    seen: set[str] = set()
    for token in _tokens(value):
        t = token.strip().lower()
        if not t:
            continue
        if t in _IGNORED_KEYS:
            key = t
        elif t in _COLOURS:
            key = "colour"
        elif t in _PLACE_WORDS:
            key = "place"
        elif t in _PHOTO_WORDS:
            key = "photo"
        else:
            key = "other_unrecorded"
        if key not in seen:
            seen.add(key)
            keys.append(key)
    return keys


def _brands_from_db() -> set[str]:
    try:
        with db.connect() as con:
            rows = con.execute(
                "SELECT DISTINCT brand FROM oggetti WHERE brand IS NOT NULL AND brand <> ''"
            ).fetchall()
        return {str(r[0]).upper() for r in rows}
    except Exception:
        return set()


def _detect_brand(text: str) -> str | None:
    brands = _brands_from_db()
    for token in _WORD_RE.findall(text or ""):
        upper = token.upper()
        if upper in _BRAND_ALIASES:
            return _BRAND_ALIASES[upper]
        if upper in brands:
            return upper
    return None


def interpret(text: str, lang: str) -> dict | None:
    """Return valid Interpreted filters, or None when the keyword fallback must be used."""
    parsed = _request_filter_agent(text, lang) or _request_filter(text, lang)
    if not parsed:
        return None

    valid_categories = set(_category_ids())
    category = parsed.get("category")
    if category not in valid_categories:
        category = None

    brand = parsed.get("brand")
    if isinstance(brand, str) and brand.strip():
        brand = " ".join(brand.upper().split())
    else:
        brand = None

    keywords = _tokens(parsed.get("keywords"))
    keywords = [k.upper() for k in keywords if not re.search(r"\d{4}", k)]

    date_from = _iso_date(parsed.get("date_from"))
    date_to = _iso_date(parsed.get("date_to"))
    if date_from and date_to and date_from > date_to:
        date_from, date_to = date_to, date_from
    today = datetime.today().strftime("%Y-%m-%d")
    if date_to and date_to > today and (not date_from or date_from <= today):
        date_to = today  # the +14 days rule must not reach into the future

    ignored = _normalize_ignored(parsed.get("ignored"))

    colour = parsed.get("colour")
    colour = colour.strip().lower() if isinstance(colour, str) else None
    if colour not in office.COLOURS:
        colour = None
    place = parsed.get("place")
    place = " ".join(place.split())[:80] or None if isinstance(place, str) else None

    return {
        "category": category,
        "brand": brand,
        "keywords": keywords,
        "date_from": date_from,
        "date_to": date_to,
        "ignored": ignored,
        "colour": colour,
        "place": place,
    }


def fallback_keywords(text: str) -> list[str]:
    """Extract raw keywords for the no-LLM fallback when no mapped category is found."""
    if not text:
        return []

    result: list[str] = []
    seen: set[str] = set()
    for token in _WORD_RE.findall(text):
        lower = token.lower()
        if lower in _STOPWORDS or lower in _MONTHS or lower in _COLOURS:
            continue
        upper = token.upper()
        if upper not in seen:
            seen.add(upper)
            result.append(upper)
    return result


def fallback_interpret(text: str, lang: str = "it") -> dict:
    """Map common it/en/es/fr/de words to registry categories and brands.

    This keeps the no-key fallback useful for common lost-item requests instead of
    matching arbitrary English tokens against Italian registry descriptions.
    """
    category = None
    for word in _WORD_RE.findall(text or ""):
        lower = word.lower()
        if lower in _CATEGORY_WORD_MAP and category is None:
            category = _CATEGORY_WORD_MAP[lower]

    brand = _detect_brand(text)

    if category or brand:
        return {
            "category": category,
            "brand": brand,
            "keywords": [],
            "date_from": None,
            "date_to": None,
            "ignored": [],
            "colour": None,
            "place": None,
        }

    return {
        "category": None,
        "brand": None,
        "keywords": fallback_keywords(text),
        "date_from": None,
        "date_to": None,
        "ignored": [],
        "colour": None,
        "place": None,
    }


def _db_search(f: dict) -> dict:
    return db.search(f.get("keywords") or [], f.get("category"), f.get("brand"),
                     f.get("date_from"), f.get("date_to"))


class _Miss(Exception):
    pass


@lru_cache(maxsize=512)
def _cached(text: str, lang: str) -> dict:
    filters = interpret(text, lang)
    if filters is None:
        raise _Miss  # failed calls are not cached, so the next request retries
    return filters


def _interpret_cached(text: str, lang: str) -> dict | None:
    try:
        return _cached(text.strip().lower(), lang)
    except _Miss:
        return None


def search(text: str, lang: str) -> dict:
    """Shared pipeline (D-007): text, voice transcript and photo description all end here."""
    filters = _interpret_cached(text, lang)
    shown = filters  # contract: interpreted is null on keyword fallback
    if filters is None:
        filters = fallback_interpret(text, lang)
    try:
        office_items = office.search(filters)
    except Exception:  # the office catalogue is optional; registry search must keep working
        logging.exception("office search failed")
        office_items = []
    result = _db_search(filters)
    relaxed = []  # contract: filters dropped because nothing matched
    while not result["total"] and len(filters.get("keywords") or []) > 1:
        # drop the least specific keyword first (the model lists most specific first)
        filters = {**filters, "keywords": filters["keywords"][:-1]}
        relaxed[:] = ["keywords"]
        result = _db_search(filters)
    for name, drop in (("keywords", ("keywords",)), ("brand", ("brand",)),
                       ("dates", ("date_from", "date_to"))):  # relax in this order
        if result["total"]:
            break
        if not any(filters.get(k) for k in drop):
            continue
        filters = {**filters, **{k: ([] if k == "keywords" else None) for k in drop}}
        if name not in relaxed:
            relaxed.append(name)
        result = _db_search(filters)
    return {**result, "interpreted": shown and {**shown, "relaxed": relaxed}, "office": office_items}
