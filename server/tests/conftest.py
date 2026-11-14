import pytest


@pytest.fixture(autouse=True)
def no_real_interpret_agent(monkeypatch):
    # Tests never reach the paid ElevenLabs interpret agent; ones that need it patch it.
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)


@pytest.fixture(autouse=True)
def fresh_caches():
    # interpretation cache and quotas are module globals; keep tests independent
    from app import interpret, main
    interpret._cached.cache_clear()
    main._hits.clear()
    main._text_hits.clear()
    yield
