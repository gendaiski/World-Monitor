# Handoff: gendaiski/World-Monitor

Status as of 2026-10-10, `main` at the commit that adds this file. Read this before you change anything, then read [AGENTS.md](AGENTS.md). AGENTS.md holds the repository's working rules and applies to every agent, Codex included.

## 1. Links

| What | Link | Notes |
|---|---|---|
| This repository | https://github.com/gendaiski/World-Monitor | Fork of upstream, default branch `main` |
| GitHub Actions | https://github.com/gendaiski/World-Monitor/actions | Green on `f31d572`; see section 6 |
| Upstream project | https://github.com/koala73/worldmonitor | Imported at upstream `662d2ea` (our commit `a9d823a`) |
| Upstream live site (style reference) | https://www.worldmonitor.app | Not reachable from the build sandbox; the style was taken from this repo's own frontend code |
| Situation map on Vercel (production) | https://world-monitor-situation-map.vercel.app | Behind Vercel login (Deployment Protection is on). Still serves the previous design; see section 5 |
| Vercel aliases | https://world-monitor-situation-map-gendaiski.vercel.app, https://world-monitor-situation-map-git-main-gendaiski.vercel.app | Same deployment |
| Vercel project dashboard | https://vercel.com/gendaiski/world-monitor-situation-map | Project `prj_XRHSZN5ZtlcPksd7gSwhAftvvwAd`, team `team_6EOWs9KFetQQNpHUN2XlEuXK` (slug `gendaiski`) |
| Last Vercel deployment (inspector) | https://vercel.com/gendaiski/world-monitor-situation-map/4sFi1U4nXcxzEoFQLzT7TNLofnPQ | Built from `e65d924` |
| Claude artifact: situation map | https://claude.ai/artifact/DtZZCdoM9GFuUhvxkpkfeD | The new design. Private to the owner. Opens in Claude only. AI analyst runs on the viewer's Claude; live feeds and video link out |
| Claude artifact: deployment check | https://claude.ai/artifact/3biDcmvusag55JxmkErT2S | Earlier status page. Private |
| Claude Code session that built this | https://claude.ai/code/session_01SoMw2ttZy81fjGtF7Yv2MW | Full history of the work |
| Local dashboard (after install) | http://localhost:3000 | `WM_PORT` changes it |
| Local AI Port dashboard | http://localhost:8787 | Unlock with `AI_PORT_ADMIN_TOKEN` from `.env` |
| Local Redis REST | http://127.0.0.1:8079 | Internal; used by seeders |

Screenshots of the current situation map design are in [apps/situation-map/screenshots/](apps/situation-map/screenshots/).

## 2. What was built

### Commits on `main`

| Commit | What it did |
|---|---|
| `a9d823a` | Imported koala73/worldmonitor at `662d2ea` |
| `35c2c35` | Added the **AI Port** and the **one-command installer** (section 3) |
| `e65d924` | Added the deployable **situation map** in `apps/situation-map` (section 4) |
| `3b28bad` | Stopped CI failure emails on the fork: guarded upstream-only jobs, ported upstream CI fixes |
| `63cedcc` | Fixed the remaining fork-only failures in the unit shards |
| `f31d572` | Reverted test-run artifacts that `63cedcc` committed by mistake |
| `3159050` | Restyled the situation map to match worldmonitor.app (section 4) |

### Files this fork adds or changes compared with upstream

- `ai-port/`: the AI gateway. Includes `src/`, `public/index.html` (dashboard), `test/`, `Dockerfile` and `README.md`.
- `apps/situation-map/`: the standalone situation map for Vercel.
- `scripts/install-worldmonitor.sh`: the one-command install.
- `scripts/lib/ai-port-provider.mjs`: the AI Port entry in the seeder LLM chains. It is wired into `scripts/regional-snapshot/narrative.mjs` and `scripts/weekly-brief.mjs`.
- `scripts/run-seeders.sh`: exports the AI Port settings when `AI_PORT_TOKEN` is set.
- `docker-compose.yml`: adds the `ai-port` service and points the dashboard and relay LLM settings at it.
- `.env.example`: adds an AI Port block. `SELF_HOSTING.md`, `README.md` and `ARCHITECTURE.md` (CI table) document it.
- `.github/workflows/ai-port.yml` and `situation-map.yml` are new. `security-audit.yml` audits both new packages. 33 upstream operations workflows are guarded so forks skip them (section 6).
- `.github/dependabot.yml` was removed, so the fork gets no Dependabot PRs.
- Tests:
  - New: `tests/ai-port-seeder-chain.test.mjs` and `tests/fork-upstream-workflow-guard.test.mjs`.
  - Adjusted: `tests/railway-deploy-drift-workflow.test.mjs`, `tests/ci-workflow-coverage.test.mts` and `tests/dry-run-resilience-education-flip.test.mts`.

## 3. Full stack: install and AI Port

### Install (needs a Docker host; Node 24 per `.nvmrc` for host-side scripts)

```bash
git clone https://github.com/gendaiski/World-Monitor.git
cd World-Monitor
./scripts/install-worldmonitor.sh                 # build, start, seed
./scripts/install-worldmonitor.sh --no-seed       # start without the first seed
./scripts/install-worldmonitor.sh --with-subscription-clis   # adds Claude Code, Codex, Gemini CLIs to the AI Port image
```

The installer writes these secrets to `.env` and never overwrites existing values:

- `RELAY_SHARED_SECRET`
- `REDIS_PASSWORD`
- `REDIS_TOKEN`
- `WM_SESSION_SECRET`
- `WORLDMONITOR_RELAY_KEY`
- `WORLDMONITOR_VALID_KEYS`
- `AI_PORT_TOKEN`
- `AI_PORT_ADMIN_TOKEN`

Compose services:

- `worldmonitor` on port 3000
- `ai-port` on 127.0.0.1:8787
- `ais-relay`
- `redis`
- `redis-rest` on 127.0.0.1:8079

Full guide: [SELF_HOSTING.md](SELF_HOSTING.md), sections "Quick Start" and "Connect any AI (AI Port)".

### AI Port ("connect any AI")

It is an OpenAI-compatible gateway (`/v1/chat/completions`, `/v1/models`, plus Ollama-style `/api/tags`). It sits between World Monitor and any AI the user has. Docs: [ai-port/README.md](ai-port/README.md).

- **API keys:** about 25 provider presets in `ai-port/src/presets.mjs`:
  - Anthropic, OpenAI, Gemini, xAI, Mistral, DeepSeek, Cohere, Moonshot, Qwen and Perplexity.
  - OpenRouter, Groq, Cerebras, Together, Fireworks, Hugging Face, NVIDIA, GitHub Models and Azure.
  - Ollama, LM Studio, or any custom OpenAI-compatible URL.
  - Set the key in `.env` (names in the AI Port block of `.env.example`) or paste it in the dashboard at http://localhost:8787.
- **Subscriptions:** the `claude-subscription`, `chatgpt-subscription` and `gemini-subscription` presets drive the official CLIs (`claude -p`, `codex exec`, `gemini -p`).
  - Build them in with `--with-subscription-clis`, then sign in with `docker compose exec -it ai-port claude`, `codex login` or `gemini`.
- **Routing:** the model name `auto`/`default` uses `AI_PORT_DEFAULT_ROUTE`, `fast` uses `AI_PORT_FAST_ROUTE`, and `provider:model` picks one directly. It falls back to the next provider on failure; `AI_PORT_STRICT_MODEL=true` turns that off.
- **Anthropic handling** (`ai-port/src/providers/anthropic.mjs`):
  - effort is set explicitly (`AI_PORT_ANTHROPIC_EFFORT`, default `low`);
  - streaming upstream calls;
  - no `temperature` on current models;
  - server-side refusal fallback where supported;
  - forced `tool_choice` is mapped to `auto`.
- **Auth:** `/v1/*` needs `AI_PORT_TOKEN`. The dashboard needs `AI_PORT_ADMIN_TOKEN`. Config is saved to `ai-port/data/ai-port.json` with file mode 0600; that file is gitignored.
- **How World Monitor reaches it:**
  - Compose sets `OLLAMA_API_URL=http://ai-port:8787`, `OLLAMA_API_KEY=$AI_PORT_TOKEN`, `OLLAMA_MODEL=auto` and `LLM_API_URL=…/v1/chat/completions` for `worldmonitor` and `ais-relay`.
  - Host seeders use `AI_PORT_URL` (default `http://localhost:8787`), `AI_PORT_MODEL` and `AI_PORT_TOKEN`.
- **Tests:** `cd ai-port && npm ci && npm test` (16 tests, mock upstreams).

## 4. Situation map (`apps/situation-map`)

A self-contained page plus one Vercel function. It is styled after the real World Monitor dashboard:

- dark by default, light when the device asks for it;
- a header with a WORLD pill, LIVE status and region menu;
- a "Global Situation" map: cropped equirectangular projection, 20px grid, time-range filter, green layer toggles with ⓘ help, legend, click popups;
- Live News and Live Webcams beside the map;
- a panel grid and footer below.

The visual reference is `src/styles/main.css`, `src/components/Map.ts` and `src/config/panels.ts`. worldmonitor.app itself could not be reached from the build sandbox.

| File | Purpose |
|---|---|
| `index.html` | The whole page: CSS tokens, layout, d3 map, panels, live feeds, AI client |
| `api/brief.js` | `GET /api/brief?kind=&id=`. Writes an AI brief for a curated item; CDN-cached per item for a day |
| `data/layers.json` | Curated layers. Regenerate from the repo root: `npx tsx --tsconfig tsconfig.json scripts/build-situation-map-data.mts` |
| `data/countries-50m.json` | World borders (world-atlas 2.0.2) |
| `vercel.json` | No framework, `npm ci`, function settings, security headers |
| `test/brief.test.mjs` | 8 tests: `cd apps/situation-map && npm ci && npm test` |
| `screenshots/` | Current design: desktop dark and light, popup, phone (excluded from Vercel uploads) |

Data sources:

- **Curated:** conflict zones, intel hotspots, sanctions, military bases, nuclear sites, undersea cables, pipelines, AI data centers, economic centers, chokepoints and spaceports.
- **Live, fetched by the browser every 5 minutes:**
  - USGS M4.5+ earthquakes over 7 days
  - NASA EONET open events
  - CoinGecko BTC/ETH/SOL
- **Live video:** YouTube ids copied from `src/config/live-video-sources.ts` into the `NEWS` and `CAMS` lists in `index.html`. When a stream dies, replace its id there.

**AI analyst on Vercel:** it is off until the owner adds env vars in Vercel → Project → Settings → Environment Variables, then redeploys. Use either set:

- `ANTHROPIC_API_KEY`, optionally with `ANTHROPIC_MODEL`.
- `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`, for any OpenAI-compatible AI. This works with a publicly reachable AI Port.

**Local preview:** serve `apps/situation-map/` with any static server. `/api/brief` needs a Vercel-style handler, so use `vercel dev` or a small Node wrapper that sets `req.query` and `res.status().json()`.

## 5. Open items: do these first

1. **Redeploy Vercel with the new design.** The restyle (`3159050`) is on GitHub, but the Vercel connector used by Claude lost access to the `gendaiski` team (HTTP 403), so production still serves `e65d924`. Fix it either way:
   - **Dashboard:** open the project → Deployments → the latest → Redeploy. Make sure it builds the latest `main`. Or use Create Deployment from `main`.
   - **CLI:** `vercel link` → choose `world-monitor-situation-map`. Then run `vercel deploy --prod` from `apps/situation-map/`.
2. **Turn on auto-deploys.** The project is not Git-linked, so pushes do not deploy. Go to Project → Settings → Git → Connect `gendaiski/World-Monitor`, with Root Directory `apps/situation-map`.
3. **Make the site public, if wanted.** Deployment Protection (Vercel Authentication) is on, so visitors must log in to Vercel. Change it in Project → Settings → Deployment Protection.
4. **Connect an AI to the Vercel site.** Add the env vars from section 4, then redeploy.
5. **Run the full stack on a real Docker host** with `./scripts/install-worldmonitor.sh`. The build sandbox had no access to the Alpine mirror, so the production Docker image was not built end to end there. Only a sandbox-only Ubuntu variant was verified. Confirm these on a real host:
   - http://localhost:3000 loads and fills with data;
   - http://localhost:8787 tests a provider successfully.
6. **Optional:** sync the latest upstream changes (section 7).

## 6. CI on the fork

- Upstream runs many operations workflows: monitors, deploys, publishing, releases and scheduled refreshes. These need upstream secrets and infrastructure.
  - In this fork, their root jobs carry `if: github.repository == 'koala73/worldmonitor'`, so they skip here instead of failing and emailing.
  - `tests/fork-upstream-workflow-guard.test.mjs` keeps that true.
  - Manual-only Railway workflows were left unguarded.
- Fork-specific workflows:
  - `ai-port.yml` runs AI Port tests.
  - `situation-map.yml` runs the brief API tests.
  - Both run on PRs and on pushes touching their folders.
- Test commands and CI job owners are in the table in [AGENTS.md](AGENTS.md):
  - `npm run test:data` → `unit-shards`
  - `npm run test:dom`
  - `npm run test:convex`
  - `npm run test:sidecar`
  - Also run `npm run typecheck`, `npm run typecheck:api` and `npm run lint:boundaries`.
- Some local-only test failures depend on network or built output. They were confirmed to fail identically on the untouched import (`a9d823a`), so they are not regressions.
- If you add or change URLs in tracked files, run `node scripts/source-attribution.mjs --write`. Commit the regenerated `shared/source-attribution-manifest.json` and `docs/source-attribution.mdx`.

## 7. Syncing upstream

```bash
git remote add upstream https://github.com/koala73/worldmonitor.git
git fetch upstream main
git merge upstream/main     # resolve conflicts; keep the fork guards and AI Port wiring
```

Expect conflicts in the following places:

- `docker-compose.yml`, `.env.example`, `SELF_HOSTING.md` and `README.md`.
- The guarded workflow files: keep `github.repository == 'koala73/worldmonitor'` on any new upstream ops job.
- The seeder chains in `scripts/regional-snapshot/narrative.mjs` and `scripts/weekly-brief.mjs`.

After merging, run the fork guard test and the AI Port tests.

## 8. Ground rules (from AGENTS.md and this project)

- Use Node 24 (`.nvmrc`). Run `npm run --silent agent:preflight -- --mode repair` before making changes.
- Never commit secrets. `.env` and `ai-port/data/` are gitignored. Report env-var names only, never values.
- UI changes need screenshots, both desktop and mobile when layout changes.
- Edit `proto/` and regenerate. Never hand-edit `src/generated/`.
- The owner's flow so far has been direct pushes to `main`. Ask before opening PRs, merging or deploying.

---
*Prepared by Claude Code for the next agent.*
