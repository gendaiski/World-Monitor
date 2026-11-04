# World Monitor on a Vercel Hobby plan

The repository root deploys to Vercel exactly like worldmonitor.app, with one Vercel Function per file in `api/`. That is 175 functions, and the Hobby plan allows 12 per deployment, so a Hobby deploy of the root is refused (`exceeded_serverless_functions_per_deployment`).

This folder deploys the same app with **one** function. `build.mjs` writes Vercel's Build Output API (`.vercel/output`) directly:

| Output | What it is |
|---|---|
| `static/` | The root `dist/` from `npm run build:fork`: the original dashboard, variants, blog, `/pro`, embed and plugin |
| `functions/api/wm.func` | One Node function. It starts the Docker image's API sidecar (`src-tauri/sidecar/local-api-server.mjs`, with the handlers compiled by `docker/build-handlers.mjs`) and proxies every `/api/*` request to it with the headers `docker/nginx.conf` sets |
| `config.json` | The root `vercel.json` redirects, rewrites and headers, translated by `@vercel/routing-utils`, plus `/api/*` → `wm.func` |

The API therefore behaves like the self-hosted Docker image (`LOCAL_API_MODE=docker`, no cloud fallback). `middleware.ts` is not deployed: it only handles worldmonitor.app hosts, docs proxies and crawler redirects.

## Vercel project settings

- **Root Directory:** `deploy/vercel-hobby`, with "Include files outside the root directory" on (the default).
- **Framework Preset:** Other.
- **Node.js:** 24.x.
- **Build and install commands:** taken from `vercel.json` in this folder.

## Data

Without Redis, the functions that fetch public sources directly return live data, and Redis-seeded panels show "unavailable". For full data, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on the project, then run the seeders against that database (see `SELF_HOSTING.md`).

## Build locally

```bash
cd deploy/vercel-hobby
npm ci && npm --prefix ../.. ci
npm run build          # writes .vercel/output
```
