# Operations

> Pick the port and subdomain before the hackathon and check on the server that they are free.

## Where it lives

- Server: `rilya-server` (Debian, Rome), directory `/srv/hackaton/`: code in `app/`
  (rsync), secrets in `.env` with mode 0600.
- `docker compose`; the service listens only on `127.0.0.1:<port>`.
- Published via the existing Cloudflare Tunnel (`cloudflared.service`) →
  `https://<subdomain>.quietunit.com`. The rule in `/etc/cloudflared/config.yml` is added
  by the owner, or by an agent with the owner's permission (back up the config first).

## Deploy

```bash
scripts/deploy.sh          # rsync → docker compose up -d --build → check /api/health
```

Only `qa-deploy` deploys, only from `main`. After deploying it runs the demo script
in production. Config: copy `.env.deploy.example` to `.env.deploy`.

## Secrets (`.env`, not in Git)

`ANTHROPIC_API_KEY` (or another LLM), `EXA_API_KEY`, `ELEVENLABS_API_KEY`,
`ELEVENLABS_AGENT_ID`, `PUBLIC_URL`, `DEMO_MODE`. Template without values: `.env.example`.

## Before the hackathon (owner checklist)

- [ ] Subdomain and tunnel rule set up; "hello world" opens over HTTPS.
- [ ] Exa and ElevenLabs keys obtained and placed in `.env` on the server.
- [ ] SSH to the server works from the laptop. Backup internet: phone hotspot.
- [ ] `scripts/deploy.sh` tested.

## If something breaks on stage

1. Reload the page.
2. `ssh rilya-server 'cd /srv/hackaton/app && docker compose logs --tail 50'`.
3. No time to fix — play the backup video.
