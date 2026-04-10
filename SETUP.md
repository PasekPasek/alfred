# Plan: Uruchomienie i deployment Wonderlands

## Context

Wonderlands to produkcyjna platforma agentowa z S05E05 (Nowa Rzeczywistość / Vibe Coding). Użytkownik chce ją uruchomić lokalnie i/lub zdeployować jako osobistego asystenta AI do nauki, ćwiczeń z AI_devs4 i zarządzania projektami pobocznymi.

Kod źródłowy: `tasks/s05e05/wonderlands-1775780610/`  
Stack: Hono backend + Svelte frontend + SQLite + Drizzle ORM + MCP servers + Docker (opcjonalnie dla Kernel sandbox)

---

---

## Co to jest Wonderlands

Produkcyjna platforma agentowa z interfejsem czatu, cyfrowym ogrodem, sandbox'iem do wykonywania kodu i systemem MCP. Stworzona przez autora AI_devs4 w kilkanaście dni z pomocą AI (Vibe Coding). Klucz: **agent ma dostęp do "cyfrowego ogrodu"** — bazy wiedzy w plikach markdown, publikowanej jako strona WWW.

Możliwości dla użytkownika:
- Chat z wieloma agentami (delegacja do specjalistów)
- Zarządzanie wiedzą (notatki markdown + Obsidian + strona WWW)
- Wykonywanie kodu w sandbox (Node.js) z zatwierdzaniem
- Integracja zewnętrznych narzędzi przez MCP (Linear, Gmail, Google Calendar, Firecrawl, YouTube, Replicate, ElevenLabs itd.)
- Background tasks — sesje przez API, bez UI
- Trwała pamięć agenta (observations, reflections, agent_profile scope)

---

## Krok 1 — Nowe repo (boilerplate)

Projekt wydzielamy jako oddzielne repo pod `/home/ppasek/projects/alfred`.

```bash
# Skopiuj projekt z ai_devs4 do docelowej lokalizacji
cp -r ~/projects/ai_devs4/tasks/s05e05/wonderlands-1775780610 ~/projects/alfred
cd ~/projects/alfred

# Usuń artefakty z archiwum ZIP i zainicjuj nowe repo
rm -rf .git __MACOSX
git init
git add .
git commit -m "feat: initial alfred setup (based on wonderlands)"

# Podłącz do nowego repo na GitHub (utwórz wcześniej na github.com)
gh repo create alfred --private --source=. --push
```

**Wymagania do uruchomienia:** Node.js 18+, npm, co najmniej jeden klucz API  
**Docker:** opcjonalny (tylko dla Kernel browser sandbox)

```bash
# Interaktywny wizard konfiguracji
npm run setup
# Generuje: apps/server/.env, .mcp-servers.json, MCP_SECRET_ENCRYPTION_KEY, konto lokalne

# (Opcjonalnie) Kernel browser sandbox
npm run kernel:up

# Dev serwery
npm run dev
# client → http://127.0.0.1:5173
# server → http://127.0.0.1:3000
```

Workspace z notatkami: `apps/server/var/workspaces/{tenant_id}/{account_id}/` — otwierasz w **Obsidian**.

---

## Krok 2 — Konfiguracja MCP serverów

Plik: `apps/server/.mcp-servers.json` (tworzony przez setup lub ręcznie z `.mcp-servers.example.json`)

Dostępne serwery (wszystkie od autora AI_devs4, open source):
| Serwer | Repo | Do czego |
|--------|------|----------|
| Linear | github.com/iceener/linear-streamable-mcp-server | Zarządzanie zadaniami |
| Google Calendar | github.com/iceener/google-calendar-streamable-mcp-server | Planowanie |
| Gmail | github.com/iceener/gmail-streamable-mcp-server | Emaile |
| Firecrawl | github.com/iceener/firecrawl-streamable-mcp-server | Web scraping |
| YouTube | github.com/iceener/youtube-streamable-mcp-server | Research z wideo |
| Replicate | github.com/iceener/replicate-streamable-mcp-server | Generowanie obrazów |
| ElevenLabs | github.com/iceener/elevenlabs-streamable-mcp-server | Audio TTS/STT |
| Resend | github.com/iceener/resend-streamable-mcp-server | Wysyłanie emaili/newsletterów |
| Spotify | github.com/iceener/spotify-streamable-mcp-server | Playlisty |

Każdy server to osobne `npx` lub lokalne `node` w `.mcp-servers.json`.

---

## Krok 2b — Obsidian + VPS: synchronizacja

Obsidian działa na lokalnych plikach. Po deployu na VPS `var/workspaces/` jest na serwerze — potrzeba sync.

**Rekomendowane: Syncthing (self-hosted, darmowe)**
```bash
# Na VPS:
curl -s https://install.syncthing.net/syncthing.sh | bash
syncthing --home=/home/user/.syncthing &
# Dodaj folder: /home/user/wonderlands/apps/server/var/workspaces/

# Na lokalnym komputerze:
# Zainstaluj Syncthing, podłącz do VPS przez Device ID
# Zsynchronizowany folder otwierasz w Obsidian jako vault
```

**Alternatywa: obsidian-git plugin**
```bash
# Na VPS: cron co 5 min
*/5 * * * * cd ~/wonderlands && git add apps/server/var/workspaces && git commit -m "sync" && git push
# Na kompie: obsidian-git plugin, pull co 5 min
```

---

## Krok 3 — Tworzenie osobistych agentów

Agenty tworzy się z UI (http://127.0.0.1:5173) jako manifest w YAML frontmatter + markdown:

```markdown
---
description: "Agent do nauki i research"
category: primary
visibility: account_private
---

Jesteś moim asystentem do nauki AI/ML.
Masz dostęp do notatek w moim cyfrowym ogrodzie.
Gdy pytam o temat — najpierw sprawdź notatki, potem sieć.
Zapisuj kluczowe wnioski do ogrodu.
```

**Proponowane agenty dla potrzeb użytkownika:**

1. **AI_devs4 Coach** (`agent_profile` scope — pamięta Twoje postępy między sesjami)
   - Czyta notatki z lekcji z cyfrowego ogrodu
   - Pamięta które zadania skończyłeś, co sprawiało trudność
   - Wyjaśnia patterny, pomaga debugować, sugeruje co ćwiczyć dalej

2. **Research Agent** — Firecrawl + YouTube + web_search
   - Zbiera wiedzę z sieci, zapisuje wnioski do ogrodu
   - Obserwacje trafiają do `session_shared` — dostępne dla innych agentów w tej samej sesji

3. **Builder PM** — Linear + Google Calendar + delegate do Research
   - Zarządza projektami pobocznymi (issues, deadline, notatki projektowe w ogrodzie)
   - Deleguje research do Research Agenta

4. **Daily Briefing** — Calendar + ElevenLabs
   - Zbiera plan dnia + niezakończone zadania
   - Generuje audio (spacer, commute)

**Memory scopes w praktyce:**
- `agent_profile` → agent pamięta Cię między sesjami ("Paweł uczy się AI engineering, aktualnie S05E05")
- `session_shared` → Research agent i PM agent w jednej sesji dzielą kontekst
- `thread_shared` → rozmowa o konkretnym projekcie ma spójny kontekst
- Ogród → permanentna baza wiedzy dostępna dla wszystkich agentów

---

## Krok 4 — Deployment (opcjonalny, dla dostępu 24/7)

Wonderlands ma wbudowany `ecosystem.config.cjs` (PM2) i GitHub Actions workflow.

### Opcja A: VPS / własny serwer (rekomendowane)

```bash
# Na serwerze:
git clone git@github.com:<user>/wonderlands.git
cd wonderlands
npm install
npm run setup   # lub ręczna konfiguracja .env

# PM2 (process manager, restart przy awarii)
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup

# Nginx reverse proxy (client + server na jednym domenie)
# /         → 127.0.0.1:5173 (Svelte dev) lub dist/ po build
# /api/*    → 127.0.0.1:3000
# /v1/*     → 127.0.0.1:3000
```

**Ważne dla produkcji:**
- `AUTH_MODE=api_key` lub `auth_session` — sprawdź `.env`
- `CORS_ALLOW_ORIGINS` — dodaj swoją domenę
- HTTPS przez Let's Encrypt (certbot)
- Kernel browser sandbox wymaga Dockera na serwerze

**Koszty miesięczne (szacunek dla użytku osobistego):**

| Składnik | Koszt |
|----------|-------|
| VPS mikr.us (1GB RAM, bez Docker) | ~12-15 PLN |
| AI API (OpenRouter / Gemini Flash) | ~$1-5 USD |
| Domena (opcjonalnie) | ~5 PLN (lub 0 jeśli IP) |
| Langfuse tracing | free tier |
| MCP servers (Linear, Gmail, etc.) | 0 (własne klucze API) |
| Zewnętrzna baza danych | **0 — SQLite, plik lokalny** |

**Kernel browser sandbox (Docker/Chromium):** potrzebuje 2GB+ RAM → droższy tier. Pomiń na start — dodaj gdy faktycznie będziesz potrzebował web automation. Alternatywa: `kernel.sh` cloud API (mają free tier).

### Opcja B: GitHub Actions (CI/CD)

Projekt ma wbudowany workflow. Krok z lekcji S05E01 — konfiguracja jak opisana w tamtej lekcji.

### Opcja C: Tylko lokalnie (najprostsze)

Dla celów osobistych lokalne uruchomienie w zupełności wystarcza. Wystarczy `npm run dev` i interfejs na `localhost:5173`.

---

## Weryfikacja działania

1. `npm run dev` → otwórz `http://127.0.0.1:5173`
2. Zaloguj się danymi z `.credentials.json` (lub z outputu `npm run setup`)
3. Sprawdź cyfrowy ogród pod `/wonderlands`
4. Utwórz agenta, wyślij wiadomość — powinno być streaming response
5. Sprawdź czy MCP server działa: agent powinien mieć dostęp do skonfigurowanych narzędzi
6. Otwórz `apps/server/var/workspaces/...` w Obsidian — powinny być widoczne notatki

---

## Pliki kluczowe

| Plik | Rola |
|------|------|
| `apps/server/.env` | Wszystkie klucze API i konfiguracja serwera |
| `apps/server/.mcp-servers.json` | Konfiguracja MCP serverów |
| `apps/server/var/05_04_api.sqlite` | Baza danych (agenty, sesje, pamięć) |
| `apps/server/var/workspaces/` | Cyfrowy ogród (notatki markdown) |
| `ecosystem.config.cjs` | PM2 config do deploymentu |
| `setup/index.mjs` | Interaktywny wizard instalacji |
