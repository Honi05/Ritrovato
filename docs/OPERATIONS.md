# Эксплуатация

> По образцу babkisoStasom. Порт и поддомен выбрать до хакатона, свободны ли — проверить на сервере.

## Где живёт

- Сервер: `rilya-server` (Debian, Рим), каталог `/srv/hackaton/`: код в `app/` (rsync), секреты
  в `.env` с правами 0600.
- `docker compose`, сервис слушает только `127.0.0.1:<порт>`.
- Публикация: существующий Cloudflare Tunnel (`cloudflared.service`) → `https://<поддомен>.quietunit.com`. Правило в
  `/etc/cloudflared/config.yml` добавляет владелец или агент с его разрешения
  (перед правкой — бэкап конфига).

## Деплой

```bash
scripts/deploy.sh          # rsync → docker compose up -d --build → проверка /api/health
```

Делает только `qa-deploy`, только из `main`. После деплоя он прогоняет сценарий
демо на проде.

## Секреты (`.env`, не в Git)

`ANTHROPIC_API_KEY` (или другой LLM), `EXA_API_KEY`, `ELEVENLABS_API_KEY`,
`ELEVENLABS_AGENT_ID`, `PUBLIC_URL`, `DEMO_MODE`. Шаблон без значений — `.env.example`.

## До хакатона (чек-лист владельца)

- [ ] Поддомен и правило туннеля заведены, «hello world» открывается по HTTPS.
- [ ] Ключи Exa и ElevenLabs получены, лежат в `.env` на сервере.
- [ ] SSH до сервера работает с ноутбука. Запасной интернет — раздача с телефона.
- [ ] `scripts/deploy.sh` проверен.

## Если на сцене что-то упало

1. Обновить страницу.
2. `ssh <сервер> 'cd /srv/hackaton/app && docker compose logs --tail 50'`.
3. Нет времени чинить — показывать резервное видео.
