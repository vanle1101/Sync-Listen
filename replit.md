# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **WebSockets**: ws library for real-time sync

## Artifacts

### Music Together (`/`)
A collaborative music listening web app — create or join rooms to listen to YouTube music in sync with friends.

**Features:**
- Create/join rooms via shared link
- Real-time playback sync (host controls, guests follow)
- YouTube video search and embedded player (IFrame API)
- Shared playlist — anyone can add/remove tracks
- Real-time chat inside the room
- Live listener list

**Frontend:** React + Vite at `artifacts/music-together/`
**Backend:** Express 5 API + WebSocket server at `artifacts/api-server/`
- REST: `/api/rooms` (create/get rooms), `/api/youtube/search` (YouTube search)
- WebSocket: `/ws` (real-time room state: chat, playback, playlist sync)

**Room state** is stored in-memory (fast real-time); room metadata persisted in PostgreSQL.

**YouTube API:** Set `YOUTUBE_API_KEY` env var for real search results. Falls back to mock results if unset.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- After running codegen, fix `lib/api-zod/src/index.ts` to only export `./generated/api` (not both api and types — they conflict)
- WebSocket path `/ws` must be listed in `artifacts/api-server/.replit-artifact/artifact.toml` paths array

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
