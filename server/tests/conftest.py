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


@pytest.fixture(autouse=True)
def office_tmp(tmp_path, monkeypatch):
    # Office data never touches the repo: temp DB and photo dir per test.
    from app import office_db, photos, ratelimit
    monkeypatch.setattr(office_db, "PATH", tmp_path / "office.sqlite")
    monkeypatch.setattr(photos, "DIR", tmp_path / "photos")
    for limiter in ratelimit.ALL:
        limiter.clear()
    yield
