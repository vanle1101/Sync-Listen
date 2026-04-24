# Sync-Listen (Music Together)

TypeScript monorepo cho ung dung nghe nhac cung nhau theo thoi gian thuc.

## 1. Tong quan

- Frontend: React + Vite (`artifacts/music-together`)
- Backend: Express 5 + WebSocket (`artifacts/api-server`)
- Database: PostgreSQL + Drizzle (`lib/db`)
- API contracts/codegen: OpenAPI + Orval (`lib/api-spec`, `lib/api-zod`, `lib/api-client-react`)

## 2. Yeu cau

- Node.js 24
- pnpm (khuyen nghi >= 9)
- PostgreSQL (can `DATABASE_URL`)

## 3. Cau truc chinh

```text
artifacts/
  api-server/         # REST + WS (/api, /ws)
  music-together/     # frontend app
lib/
  db/                 # schema + drizzle config
  api-spec/           # openapi.yaml + codegen script
  api-zod/            # generated validators/types tu OpenAPI
  api-client-react/   # generated React Query client tu OpenAPI
```

## 4. Cai dat

```bash
pnpm install --frozen-lockfile
```

## 5. Bien moi truong

### Backend (`artifacts/api-server`)

- `PORT` (bat buoc)
- `DATABASE_URL` (bat buoc)
- `NODE_ENV` (tuy chon, thuong dung `development`/`production`)
- `LOG_LEVEL` (tuy chon, mac dinh `info`)
- `CLERK_SECRET_KEY` (tuy chon, can khi dung Clerk proxy o production)

### Frontend (`artifacts/music-together`)

- `PORT` (bat buoc)
- `BASE_PATH` (bat buoc, thuong la `/`)
- `VITE_CLERK_PUBLISHABLE_KEY` (bat buoc)
- `VITE_CLERK_PROXY_URL` (tuy chon)
- `VITE_API_BASE_URL` (tuy chon, vi du `https://api.example.com`)
- `VITE_WS_URL` (tuy chon, vi du `wss://api.example.com/ws`)

Frontend da co file: `artifacts/music-together/.env` (chua `VITE_CLERK_PUBLISHABLE_KEY`).

## 6. Chay lai nhanh

### Replit/Linux shell (khuyen nghi)

1. Day schema DB:

```bash
pnpm --filter @workspace/db run push
```

2. Chay backend:

```bash
PORT=8080 DATABASE_URL='postgres://...' NODE_ENV=development pnpm --filter @workspace/api-server run dev
```

3. Chay frontend:

```bash
PORT=22338 BASE_PATH=/ pnpm --filter @workspace/music-together run dev
```

4. Health check backend:

```bash
curl http://localhost:8080/api/healthz
```

### Windows PowerShell

Script `dev` cua `api-server` dang dung `export` (kieu Unix shell), vi vay tren PowerShell chay nhu sau:

```powershell
# Backend
$env:PORT="8080"
$env:DATABASE_URL="postgres://..."
$env:NODE_ENV="development"
pnpm --filter @workspace/api-server run build
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

```powershell
# Frontend
$env:PORT="22338"
$env:BASE_PATH="/"
pnpm --filter @workspace/music-together run dev
```

## 7. Lenh hay dung

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

## 8. Luu y quan trong

- Mac dinh app goi REST qua `/api/...` va WebSocket qua `/ws` tren cung origin.
- Neu deploy tach frontend/backend, dat `VITE_API_BASE_URL` va/hoac `VITE_WS_URL`.
- Neu khong dat 2 bien tren, ban can reverse-proxy de frontend va backend cung origin (it nhat route duoc `/api` va `/ws` ve backend).
