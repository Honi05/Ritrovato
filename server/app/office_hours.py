"""Pickup slots (spec §1 "Slots"): 15 minutes, Europe/Rome, tomorrow .. today+14."""
import json
import os
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

ROME = ZoneInfo("Europe/Rome")
SLOT = timedelta(minutes=15)
WINDOW_DAYS = 14
# weekday (0 = Monday) -> list of [open, close]
DEFAULT_HOURS = {
    "0": [["08:30", "13:00"]],
    "1": [["08:30", "13:00"], ["14:30", "16:30"]],
    "2": [["08:30", "13:00"]],
    "3": [["08:30", "13:00"], ["14:30", "16:30"]],
    "4": [["08:30", "13:00"]],
}
FMT = "%Y-%m-%dT%H:%M"


def hours() -> dict[int, list[tuple[time, time]]]:
    raw = json.loads(os.environ.get("OFFICE_HOURS_JSON") or "null") or DEFAULT_HOURS
    return {int(k): [(time.fromisoformat(a), time.fromisoformat(b)) for a, b in v] for k, v in raw.items()}


def today() -> date:
    return datetime.now(ROME).date()


def window() -> tuple[date, date]:
    t = today()
    return t + timedelta(days=1), t + timedelta(days=WINDOW_DAYS)


def slots_for(d: date) -> list[str]:
    out = []
    for start, end in hours().get(d.weekday(), []):
        t = datetime.combine(d, start)
        while t + SLOT <= datetime.combine(d, end):
            out.append(t.strftime(FMT))
            t += SLOT
    return out


def is_bookable(slot: str) -> bool:
    try:
        d = datetime.strptime(slot, FMT).date()
    except (TypeError, ValueError):
        return False
    first, last = window()
    return first <= d <= last and slot in slots_for(d)
