"""Small in-memory sliding-window limiters for the office endpoints."""
import threading
import time
from collections import defaultdict, deque

from fastapi import Request


class Limiter:
    def __init__(self, limit: int, window: float):
        self.limit, self.window = limit, window
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str) -> bool:
        """Record one attempt; False when the key is over the limit."""
        now = time.time()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True

    def clear(self):
        with self._lock:
            self._hits.clear()


def client_ip(request: Request) -> str:
    # Behind Cloudflare (see main._quota); falls back to the socket peer locally.
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")


LOGIN = Limiter(10, 600)
BOOKING = Limiter(5, 3600)
ALL = [LOGIN, BOOKING]
