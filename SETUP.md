# Alfred — Setup i Roadmap

## Uruchomienie lokalne

```bash
npm run setup       # wizard: .env, klucze API, konto, baza danych
npm run kernel:up   # opcjonalnie: Docker + Chromium browser sandbox
npm run dev         # client → :5173, server → :3000
```

Workspace z notatkami: `apps/server/var/workspaces/{tenant_id}/{account_id}/`
Otwierasz w **Obsidian** jako vault.

Cyfrowy ogród: `http://127.0.0.1:5173/wonderlands`

---

## Deployment — VPS (mikr.us 3.5: 4 GB RAM, 40 GB, 197 zł/rok)

### Ważne — ustaw WORKSPACE_ROOT przed pierwszym setupem

W `apps/server/.env` (lub przez wizard) ustaw ścieżkę workspace **zanim** uruchomisz `npm run setup`:

```
WORKSPACE_ROOT=/home/ubuntu/alfred/apps/server/var/workspaces
```

Ten folder będzie synchronizowany przez Syncthing z Obsidianem. Zmiana ścieżki po fakcie wymaga rekonfiguracji Syncthing — lepiej ustalić ją raz.

### PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

### Nginx

```nginx
server {
    server_name alfred.example.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
    }
}
```

```bash
certbot --nginx -d alfred.example.com
```

W `.env`:
```
AUTH_MODE=api_key
CORS_ALLOW_ORIGINS=https://alfred.example.com
```

### Koszty miesięczne

| Składnik | Koszt |
|----------|-------|
| mikr.us 3.5 (4 GB RAM) | ~16 PLN (~197 zł/rok) |
| AI API (OpenRouter/Gemini Flash) | ~$1–5 USD |
| n8n (self-hosted, ten sam VPS) | 0 |
| Strona wizytówka (Cloudflare Pages) | 0 |
| MCP servers (własne klucze API) | 0 |
| SQLite (plik lokalny) | 0 |

**Kernel (Docker + Chromium):** mieści się na 3.5 — uruchamiaj `npm run kernel:up` gdy potrzebujesz web automation.

---

## MCP Servers

Konfiguracja: `apps/server/.mcp-servers.json` (setup wizard tworzy z `.mcp-servers.example.json`)

| Serwer | Repo | Zastosowanie |
|--------|------|--------------|
| Linear | github.com/iceener/linear-streamable-mcp-server | Zadania, projekty |
| Google Calendar | github.com/iceener/google-calendar-streamable-mcp-server | Kalendarz, dostępność |
| Gmail | github.com/iceener/gmail-streamable-mcp-server | Wybrane etykiety, szkice |
| Maps | github.com/iceener/maps-streamable-mcp-server | Trasy, miejsca |
| Firecrawl | github.com/iceener/firecrawl-streamable-mcp-server | Web scraping (można lokalnie) |
| YouTube | github.com/iceener/youtube-streamable-mcp-server | Research z wideo |
| Replicate | github.com/iceener/replicate-streamable-mcp-server | Generowanie obrazów |
| ElevenLabs | github.com/iceener/elevenlabs-streamable-mcp-server | TTS (briefing audio), STT |
| Resend | github.com/iceener/resend-streamable-mcp-server | Emaile, newslettery |
| Spotify | github.com/iceener/spotify-streamable-mcp-server | Playlisty, muzyka głosowo |
| Video | github.com/iceener/video-stdio-mcp | Analiza wideo (Gemini) |
| Tesla | github.com/iceener/tesla-streamable-mcp-server | Opcjonalne |

Szablon własnego serwera: github.com/iceener/streamable-mcp-server-template

---

## Synchronizacja notatek — Obsidian + Syncthing

```
Alfred VPS (var/workspaces/) ←── Syncthing ──► Laptop ──► Telefon Android
```

```bash
# Na VPS:
curl -s https://install.syncthing.net/syncthing.sh | bash
systemctl --user enable syncthing
systemctl --user start syncthing
# GUI na :8384 — dostępne tylko lokalnie (nie wystawiaj publicznie przez Nginx)
# Dodaj folder: ~/alfred/apps/server/var/workspaces/
# Dodaj urządzenie: wklej Device ID z laptopa

# Na laptopie:
# Zainstaluj Syncthing, połącz przez Device ID z VPS
# Zsynchronizowany folder otwórz w Obsidian jako vault

# Na Androidzie:
# Syncthing-Fork (F-Droid lub Play Store)
# Zsynchronizowany folder → otwórz w Obsidian Mobile jako vault
```

Syncthing GUI dostępne przez tunel SSH gdy potrzebujesz konfigurować:
```bash
ssh -L 8384:localhost:8384 ubuntu@VPS_IP
# Potem otwórz http://localhost:8384 na laptopie
```

---

## Tworzenie agentów

Manifest = YAML frontmatter + markdown system prompt (UI → Settings → Agents):

```yaml
---
description: "AI_devs4 Coach"
category: primary
visibility: account_private
model: default
---

Jesteś moim asystentem do nauki AI engineering.
Pamiętasz mój postęp w kursie AI_devs4 (agent_profile scope).
Gdy pytam o temat — najpierw sprawdź notatki w /knowledge/, potem sieć.
Zapisuj kluczowe wnioski do /knowledge/.
```

**Rekomendowane agenty:**

| Agent | Scope | Narzędzia | Do czego |
|-------|-------|-----------|----------|
| AI_devs4 Coach | agent_profile | garden + web_search | Nauka, active recall, debugowanie zadań |
| Daily Briefing | session_shared | Calendar + ElevenLabs | Plan dnia → audio |
| Research | session_shared | Firecrawl + YouTube | Zbieranie wiedzy z sieci |
| Builder PM | session_shared | Linear + Calendar + delegate | Projekty, zadania |
| Training | agent_profile | garden + Telegram | Śledzenie treningu |

---

## Roadmap

### 1. n8n — scheduler i event bus

Alfred nie ma wbudowanego crona — n8n wypełnia tę lukę jako **system nerwowy**. Dodajesz go na tym samym VPS po wdrożeniu Alfreda — zero planowania z góry.

**Instalacja na VPS (Docker Compose):**
```bash
mkdir ~/n8n && cd ~/n8n
cat > docker-compose.yml << 'EOF'
services:
  n8n:
    image: n8nio/n8n
    restart: unless-stopped
    ports:
      - "127.0.0.1:5678:5678"
    volumes:
      - ~/.n8n:/home/node/.n8n
    environment:
      - N8N_HOST=n8n.twojadomena.pl
      - WEBHOOK_URL=https://n8n.twojadomena.pl/
EOF
docker compose up -d
```

Nginx vhost dla n8n — osobna subdomena (`n8n.twojadomena.pl`), osobny `certbot`. Zero konfliktu z Alfredem.

**Szacowane RAM po dodaniu wszystkiego:**

| Serwis | RAM |
|--------|-----|
| Alfred (server + client) | ~300 MB |
| n8n (Docker) | ~400 MB |
| Syncthing | ~50 MB |
| Nginx + OS | ~150 MB |
| **Razem** | **~900 MB / 4 GB** |

**Punkt integracji z Alfredem:**

**Punkt integracji:**
```bash
POST /v1/sessions/bootstrap
Authorization: Bearer $API_TOKEN
X-Tenant-Id: $TENANT_ID
{ "initialMessage": "...", "target": { "kind": "agent", "agentId": "agt_..." } }
```

**Przypadki użycia:**

*Daily Briefing (cron 05:00):*
```
Schedule trigger (05:00)
  ├── HTTP → Alfred Calendar Agent: "Zbierz kalendarz → /daily/calendar.md"
  ├── HTTP → Alfred Mail Agent: "Zbierz ważne maile → /daily/mail.md"
  └── HTTP → Alfred Newsfeed Agent: "Przegląd AI newsów → /daily/news.md"

Wait node (05:45)
  └── HTTP → Alfred Briefing Agent: "Przeczytaj /daily/*.md → audio ElevenLabs → Telegram"
```

*Reakcja na zdarzenia:*
- Gmail trigger (nowy mail z etykietą) → Alfred analizuje, zapisuje do ogrodu
- Linear webhook (nowe zadanie) → Alfred dodaje kontekst
- RSS (HackerNews AI, co godzinę) → Alfred filtruje, zapisuje do `/knowledge/`

*Alfred → n8n:*
Agent w sandboxie może `fetch` webhook n8n gdy skończy zadanie (np. gotowe audio → Telegram).

*Monitoring i retry:*
n8n ma historię wykonań, retry, powiadomienia o błędach — Alfred nie ma nic z tego natywnie.

---

### 2. Telegram Bot

Bridge: Telegram Bot API → Alfred API. Piszesz do bota, agent odpowiada.

```
Ty → Telegram → webhook → POST /v1/sessions → Alfred → Telegram
```

- Bot przez @BotFather → `TELEGRAM_BOT_TOKEN`
- ~100 linii Node.js: webhook + wywołanie API + odpowiedź
- Obsługuje załączniki audio (ElevenLabs output)
- Powiadomienia push z background tasks

---

### 3. Strona wizytówka

Oddzielnie od Alfreda — **Cloudflare Pages** (darmowe, zero konfiguracji serwera):
- Static HTML/CSS lub Astro
- Własna domena → CNAME na Cloudflare Pages

---

### 4. Cron system (wbudowany)

Aktualnie: zewnętrzny cron + curl lub n8n.
Docelowo: wbudowany scheduler w Alfredzie (feature gap wymieniony w lekcji).

```bash
# Tymczasowo — systemowy cron jako alternatywa dla n8n:
0 5 * * * curl -s -X POST http://127.0.0.1:3000/v1/sessions/bootstrap \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"initialMessage":"daily briefing","target":{"kind":"agent","agentId":"agt_..."}}'
```

---

### 5. Aplikacja mobilna

Natywna app lub skrót do `https://alfred.example.com` na telefonie.
Połączenie z siecią domową (Wi-Fi disconnect) jako trigger daily briefing.
