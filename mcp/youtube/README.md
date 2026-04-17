# YouTube MCP Server

Streamable HTTP MCP server for YouTube — search videos, explore channels, browse playlists, and fetch video details.

Author: [overment](https://x.com/_overment)

> [!WARNING]
> You connect this server to your MCP client at your own responsibility. Language models can make mistakes, misinterpret instructions, or perform unintended actions. Review tool outputs before acting on them. The HTTP layer is designed for convenience during development, not production-grade security.

## Notice

This repo works in two ways:
- As a **Node/Hono server** for local workflows
- As a **Cloudflare Worker** for remote interactions

## How It Works

```
MCP Client ──► YouTube MCP Server ──► YouTube Data API v3 ──► structured results
```

All five tools are read-only queries against the YouTube Data API v3. They return both human-readable text summaries and structured JSON output (`structuredContent`), so LLMs and downstream agents can consume the data directly.

## Features

- ✅ **Search Videos** — Find videos across YouTube by keyword, with sort and date filters
- ✅ **Find Channels** — Look up channels by name, get channel IDs for further exploration
- ✅ **Scan Channels** — Fetch the latest videos from any channel
- ✅ **Browse Playlists** — List playlists from a channel or videos from a specific playlist
- ✅ **Video Details** — Get full metadata: duration, views, likes, comments, tags, description
- ✅ **Structured Output** — Every tool returns both text and `structuredContent` (MCP outputSchema)
- ✅ **Flexible Auth** — API key via client header or server config
- ✅ **Dual Runtime** — Node.js/Bun or Cloudflare Workers

---

## Installation

Prerequisites: [Bun](https://bun.sh/) and a [YouTube Data API v3 key](https://console.cloud.google.com/apis/credentials) (enable "YouTube Data API v3" in your GCP project).

### Ways to Run (Pick One)

1. **Local (API key)** — Fastest start
2. **Cloudflare Worker (wrangler dev)** — Local Worker testing
3. **Cloudflare Worker (deploy)** — Remote production

---

### 1. Local (API Key) — Quick Start

```bash
git clone <repo>
cd youtube-mcp
bun install
```

Create `.env`:

```env
PORT=3000
AUTH_STRATEGY=none
```

```bash
bun dev
# MCP: http://127.0.0.1:3000/mcp
```

The YouTube API key can be provided in two ways:

**Option A — Client header (recommended for multi-user):**
Each MCP client request includes the key via `X-YouTube-Api-Key` header.

**Option B — Server-side fallback:**
Set `API_KEY` in `.env` so the server uses it when no client header is present:

```env
AUTH_STRATEGY=api_key
API_KEY=AIzaSy...your_youtube_key
```

Connect to your MCP client:

**Claude Desktop / Cursor:**

```json
{
  "mcpServers": {
    "youtube": {
      "command": "bunx",
      "args": [
        "mcp-remote",
        "http://localhost:3000/mcp",
        "--header",
        "X-YouTube-Api-Key: ${YOUTUBE_API_KEY}"
      ]
    }
  }
}
```

Or without the header (if `API_KEY` is set server-side):

```json
{
  "mcpServers": {
    "youtube": {
      "command": "bunx",
      "args": ["mcp-remote", "http://localhost:3000/mcp", "--transport", "http-only"],
      "env": { "NO_PROXY": "127.0.0.1,localhost" }
    }
  }
}
```

---

### 2. Cloudflare Worker (Local Dev)

```bash
bun x wrangler dev --local | cat
```

Set the API key as a secret:

```bash
bun x wrangler secret put API_KEY
```

Endpoint: `http://127.0.0.1:8787/mcp`

---

### 3. Cloudflare Worker (Deploy)

1. Create KV namespace:

```bash
bun x wrangler kv:namespace create TOKENS
```

2. Update `wrangler.toml` with the KV namespace ID

3. Set secrets:

```bash
bun x wrangler secret put API_KEY
```

4. Deploy:

```bash
bun x wrangler deploy
```

Endpoint: `https://<worker-name>.<account>.workers.dev/mcp`

---

## API Key Resolution

Each tool resolves the YouTube API key in this order:

1. **Client header** `X-YouTube-Api-Key` — forwarded from the MCP client request
2. **Server config** `providerToken` — falls back to `API_KEY` or `BEARER_TOKEN` from env

This lets you run a single server instance for multiple users (each sends their own key) or set a shared key server-side.

---

## Tools

### `find_channel`

Search for YouTube channels by name. Returns channel IDs that can be used with `scan_channel`.

```ts
// Input
{
  query: string;        // Channel name or search query
  maxResults?: number;  // 1–10, default 5
}

// Output (structuredContent)
{
  query: string;
  count: number;
  channels: Array<{
    channelId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    customUrl?: string;
  }>;
}
```

### `scan_channel`

Get the latest videos from a YouTube channel.

```ts
// Input
{
  channelId: string;    // YouTube channel ID (e.g., UC...)
  maxResults?: number;  // 1–50, default 10
}

// Output (structuredContent)
{
  channelId: string;
  videoCount: number;
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnailUrl: string;
  }>;
}
```

### `search_videos`

Search for videos across all of YouTube.

```ts
// Input
{
  query: string;            // Search query
  maxResults?: number;      // 1–50, default 10
  order?: string;           // "relevance" | "date" | "viewCount" | "rating" (default: "relevance")
  publishedAfter?: string;  // ISO 8601 date filter (e.g., "2024-01-01T00:00:00Z")
}

// Output (structuredContent)
{
  query: string;
  count: number;
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnailUrl: string;
  }>;
}
```

### `get_playlist`

Dual-mode tool: list playlists from a channel **or** list videos in a playlist.

```ts
// Input (provide one of channelId or playlistId)
{
  channelId?: string;   // List playlists from this channel
  playlistId?: string;  // List videos in this playlist
  maxResults?: number;  // 1–50, default 20
}

// Output when channelId is provided (structuredContent)
{
  type: "playlists";
  channelId: string;
  count: number;
  playlists: Array<{
    playlistId: string;
    title: string;
    description: string;
    itemCount: number;
    thumbnailUrl: string;
  }>;
}

// Output when playlistId is provided (structuredContent)
{
  type: "videos";
  playlistId: string;
  count: number;
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    channelTitle: string;
    position: number;
    thumbnailUrl: string;
  }>;
}
```

### `video_details`

Get detailed information about a single video including statistics, duration, and metadata.

```ts
// Input
{
  videoId: string;  // YouTube video ID
}

// Output (structuredContent)
{
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;       // ISO 8601 duration (e.g., "PT12M34S")
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  thumbnailUrl: string;
}
```

---

## Examples

### 1. Discover a channel and list its latest videos

```json
{ "name": "find_channel", "arguments": { "query": "Fireship" } }
```

**Response:**
```
Found 5 channels for "Fireship":

1. Fireship (@Fireship)
   ID: UCsBjURrPoezykLs9EqgamOA
   ...
```

Then use the channel ID:

```json
{ "name": "scan_channel", "arguments": { "channelId": "UCsBjURrPoezykLs9EqgamOA", "maxResults": 5 } }
```

### 2. Search for recent videos on a topic

```json
{
  "name": "search_videos",
  "arguments": {
    "query": "rust programming",
    "order": "date",
    "maxResults": 10,
    "publishedAfter": "2025-01-01T00:00:00Z"
  }
}
```

### 3. Browse a channel's playlists, then list videos

```json
{ "name": "get_playlist", "arguments": { "channelId": "UCsBjURrPoezykLs9EqgamOA" } }
```

Then drill into a specific playlist:

```json
{ "name": "get_playlist", "arguments": { "playlistId": "PL0vfts4VzfNjnBhBlI4W3on..." } }
```

### 4. Get full details for a video

```json
{ "name": "video_details", "arguments": { "videoId": "dQw4w9WgXcQ" } }
```

**Response:**
```
Title: Rick Astley - Never Gonna Give You Up
Channel: Rick Astley
Published: 2009-10-25T06:57:33Z
Duration: PT3M33S
Views: 1,600,000,000
Likes: 16,000,000
Comments: 2,800,000
Tags: rick astley, never gonna give you up, ...
```

---

## HTTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | POST | MCP JSON-RPC 2.0 |
| `/mcp` | GET | SSE stream (Node.js only) |
| `/health` | GET | Health check |

---

## Development

```bash
bun dev           # Start with hot reload
bun run typecheck # TypeScript check
bun run lint      # Lint code (Biome)
bun run build     # Production build
bun start         # Run production
```

---

## Architecture

```
src/
├── index.ts                       # Node.js/Bun entry (Hono server)
├── worker.ts                      # Cloudflare Workers entry
├── config/
│   ├── env.ts                     # Re-exports shared config
│   └── metadata.ts                # Server & tool descriptions
├── core/
│   ├── capabilities.ts            # MCP capabilities (logging, tools)
│   ├── context.ts                 # Request context registry
│   └── mcp.ts                     # McpServer builder + tool registration
├── http/
│   ├── app.ts                     # Hono app (CORS, auth, routes)
│   ├── auth-app.ts                # OAuth Authorization Server (PORT+1)
│   ├── middlewares/               # Auth header forwarding (incl. X-YouTube-Api-Key), CORS
│   └── routes/                    # /health, /mcp (Streamable HTTP)
├── shared/
│   ├── tools/
│   │   ├── find-channel.ts        # find_channel tool
│   │   ├── scan-channel.ts        # scan_channel tool
│   │   ├── search-videos.ts       # search_videos tool
│   │   ├── get-playlist.ts        # get_playlist tool
│   │   ├── video-details.ts       # video_details tool
│   │   ├── registry.ts            # Tool registry (single source of truth)
│   │   └── types.ts               # ToolContext, defineTool, ToolResult
│   ├── services/
│   │   └── http-client.ts         # Rate-limited fetch wrapper
│   ├── config/
│   │   └── env.ts                 # Unified env parsing (both runtimes)
│   ├── storage/                   # Token/session stores (file, KV, memory, SQLite)
│   ├── oauth/                     # OAuth 2.1 PKCE flow + discovery
│   ├── mcp/                       # JSON-RPC dispatcher (Workers)
│   ├── auth/                      # Auth strategy types
│   ├── crypto/                    # AES-GCM encryption for token storage
│   └── http/                      # CORS + JSON response helpers
├── adapters/
│   ├── http-hono/                 # Hono security middleware, OAuth/discovery routes
│   └── http-workers/              # Workers router, env shim, KV init
└── utils/                         # Logger, cancellation, pagination, etc.
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "YouTube API key required" | Pass the key via `X-YouTube-Api-Key` header or set `API_KEY` in `.env` / `wrangler secret put API_KEY` |
| "YouTube API error: 403" | The API key may be invalid, or the YouTube Data API v3 isn't enabled in your GCP project |
| "YouTube API error: 429" | Quota exceeded. YouTube allows 10,000 units/day by default. Wait or request a quota increase. |
| "Video not found" | The video ID is wrong, or the video is private/deleted |
| "Either channelId or playlistId must be provided" | `get_playlist` requires one of the two — pass at least one |
| Workers deploy fails | Ensure KV namespace ID is set in `wrangler.toml` |

---

## License

MIT
