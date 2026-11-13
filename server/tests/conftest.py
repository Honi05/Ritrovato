import pytest


@pytest.fixture(autouse=True)
def no_real_interpret_agent(monkeypatch):
    # Tests never reach the paid ElevenLabs interpret agent; ones that need it patch it.
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
