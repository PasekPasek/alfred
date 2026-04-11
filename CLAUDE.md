# Alfred — Kontekst dla Claude Code

## Stack

Hono backend + Svelte 5 frontend + SQLite (better-sqlite3) + Drizzle ORM.
Uruchomienie: `npm run setup` → `npm run dev`. Szczegóły operacyjne w `SETUP.md`.

## Struktura katalogów

```
apps/
├── server/src/
│   ├── app/            # Config, middleware, routes, SSE event emitters
│   ├── application/    # Use cases
│   │   ├── agents/     # Agent runner, context builder, tool executor
│   │   ├── garden/     # Markdown → HTML build pipeline
│   │   ├── memory/     # Observations, reflections, profile
│   │   ├── runtime/    # Event bus, session lifecycle
│   │   └── sandbox/    # Node.js / lo code execution
│   ├── domain/         # DDD entities + repository interfaces
│   │   ├── agents/     # Agent manifest, run, delegation
│   │   ├── ai/         # Model registry, provider abstraction
│   │   ├── memory/     # Memory kinds + scopes
│   │   ├── mcp/        # MCP server config + client
│   │   ├── sandbox/    # Vault access modes
│   │   └── sessions/   # WorkSession, SessionThread
│   ├── adapters/       # MCP clients, AI providers (OpenAI, Gemini, OpenRouter)
│   └── db/             # SQLite + Drizzle schema + migrations
├── server/var/         # Runtime data — NIE commituj (w .gitignore)
│   ├── *.sqlite        # Baza danych
│   └── workspaces/     # Cyfrowy ogród {tenant_id}/{account_id}/
└── client/src/
    ├── routes/         # Chat UI, garden viewer, settings
    └── lib/            # Komponenty, SSE event handling
packages/contracts/     # Wspólne typy klient/serwer (event schemas, API types)
```

## Kluczowe koncepty

### Agent manifest
Plik z YAML frontmatter + markdown (system prompt). Tworzony przez UI lub bezpośrednio w bazie.

```yaml
---
description: "Opis agenta"
category: primary        # primary | specialist | derived
visibility: account_private  # account_private | tenant_shared | system
model: default           # alias modelu AI
---
Treść system promptu...
```

### Memory scopes
- `run_local` — tylko bieżący run
- `thread_shared` — cały wątek rozmowy
- `session_shared` — wszyscy agenci w sesji dzielą kontekst
- `agent_profile` — **trwała pamięć między sesjami** (persists)

### Memory kinds
- `observation` — konkretny fakt zebrany podczas sesji
- `reflection` — synteza wielu obserwacji

### Cyfrowy ogród (`application/garden/`)
Pliki markdown w `var/workspaces/` → build pipeline → HTML. Agent bezpośrednio czyta/zapisuje pliki przez narzędzia fs — zero git commitów. Widoczność stron: `public` | `private` (hasło) | `protected`.

### Delegacja
Tryb `async_join` — parent czeka na zakończenie child run, wynik wraca jako tool result.

### Code Mode
Gdy sandbox aktywny, agent pisze i wykonuje kod zamiast wywoływać tool definitions — definicje narzędzi nie wczytują się do kontekstu.

### Sandbox vault modes
`none` | `read_only` | `read_write` — kontroluje dostęp sandboxa do ogrodu.

### Background session (API)
```bash
POST /v1/sessions/bootstrap
Authorization: Bearer $API_TOKEN
X-Tenant-Id: $TENANT_ID

{ "initialMessage": "...", "target": { "kind": "agent", "agentId": "agt_..." } }
```

## Aliasy modeli AI

| Alias | Opis |
|-------|------|
| `default` | Domyślny z .env |
| `openrouter_default` | Domyślny OpenRouter |
| `google_default` | Domyślny Gemini |
| `openai_default` | Domyślny OpenAI |
| `gemini-3.1-pro` | Complex reasoning |
| `gemini-3.1-flash-lite` | Szybki, tani |

## Pliki kluczowe

| Plik | Rola |
|------|------|
| `apps/server/.env` | Klucze API, konfiguracja serwera |
| `apps/server/.mcp-servers.json` | Konfiguracja MCP serverów |
| `apps/server/.env.example` | Szablon — edytuj tylko gdy dodajesz zmienną |
| `ecosystem.config.cjs` | PM2 config do deploymentu |
| `setup/index.mjs` | Interaktywny wizard instalacji |

## Czego nie dotykać

- `apps/server/var/` — baza danych i notatki (w .gitignore, runtime data)
- `.env`, `.credentials.json` — klucze i hasła (w .gitignore)
