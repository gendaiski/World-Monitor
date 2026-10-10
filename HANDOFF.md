# Handoff record: gendaiski/World-Monitor

A full record for the next agent (Codex or anyone else) to continue this work without the earlier conversation.

- **State:** as of 2026-10-10. `main` was at `6922f88` before this revision.
- **Read order:** this file, then [AGENTS.md](AGENTS.md). AGENTS.md holds the repository's working rules and applies to every agent.

Contents:

0. Start here: prompt for Codex
1. URL index
2. What exists today
3. Commit log
4. Full stack, installer and AI Port
5. Situation map
6. CI on the fork
7. Task backlog with acceptance criteria
8. Verification record
9. Problems hit and how they were solved
10. Secrets and configuration inventory (names only)
11. Syncing upstream
12. Ground rules

---

## 0. Start here: prompt for Codex

Paste this as the first message of a Codex task on `gendaiski/World-Monitor`:

```text
You are continuing work on github.com/gendaiski/World-Monitor (a fork of koala73/worldmonitor).
1. Read HANDOFF.md and AGENTS.md in the repo root before changing anything.
2. Use Node 24 (.nvmrc). Run: npm run --silent agent:preflight -- --mode repair
3. Work through HANDOFF.md section 7 (task backlog) in order, skipping tasks marked OWNER.
   Each task lists its acceptance criteria and the checks to run.
4. Never commit secrets. Report env var names only, never values.
5. For UI changes, capture desktop and mobile screenshots. Store them in
   apps/situation-map/screenshots/ or attach them to the PR.
6. Open a pull request against main for each task, unless the owner says to push to main directly.
   Keep CI green: npm run typecheck, npm run lint:boundaries, the relevant npm run test:* suite,
   and the package tests (cd ai-port && npm test; cd apps/situation-map && npm test).
7. When done, update HANDOFF.md sections 2, 7 and 8 so the next agent inherits an accurate record.
```

## 1. URL index

### Repository

| What | URL |
|---|---|
| Repository | https://github.com/gendaiski/World-Monitor |
| Clone (HTTPS) | https://github.com/gendaiski/World-Monitor.git |
| Default branch `main` | https://github.com/gendaiski/World-Monitor/tree/main |
| Commit history | https://github.com/gendaiski/World-Monitor/commits/main |
| This file on GitHub | https://github.com/gendaiski/World-Monitor/blob/main/HANDOFF.md |
| Repository rules for agents | https://github.com/gendaiski/World-Monitor/blob/main/AGENTS.md |
| Contribution workflow | https://github.com/gendaiski/World-Monitor/blob/main/CONTRIBUTING.md |
| Architecture | https://github.com/gendaiski/World-Monitor/blob/main/ARCHITECTURE.md |
| Self-hosting guide | https://github.com/gendaiski/World-Monitor/blob/main/SELF_HOSTING.md |
| Env template | https://github.com/gendaiski/World-Monitor/blob/main/.env.example |
| Compose file | https://github.com/gendaiski/World-Monitor/blob/main/docker-compose.yml |
| Pull requests | https://github.com/gendaiski/World-Monitor/pulls |
| Issues | https://github.com/gendaiski/World-Monitor/issues |
| Repository settings: Actions | https://github.com/gendaiski/World-Monitor/settings/actions |
| Repository settings: secrets | https://github.com/gendaiski/World-Monitor/settings/secrets/actions |

### Fork additions (source)

| What | URL |
|---|---|
| AI Port folder | https://github.com/gendaiski/World-Monitor/tree/main/ai-port |
| AI Port docs | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/README.md |
| AI Port provider presets | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/src/presets.mjs |
| AI Port server (routes, auth) | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/src/server.mjs |
| AI Port router (routes, fallback) | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/src/router.mjs |
| AI Port config store | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/src/config.mjs |
| AI Port Anthropic adapter | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/src/providers/anthropic.mjs |
| AI Port OpenAI-compatible adapter | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/src/providers/openai-compatible.mjs |
| AI Port subscription CLI bridge | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/src/providers/cli-bridge.mjs |
| AI Port dashboard page | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/public/index.html |
| AI Port tests | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/test/ai-port.test.mjs |
| AI Port Dockerfile | https://github.com/gendaiski/World-Monitor/blob/main/ai-port/Dockerfile |
| Situation map folder | https://github.com/gendaiski/World-Monitor/tree/main/apps/situation-map |
| Situation map page | https://github.com/gendaiski/World-Monitor/blob/main/apps/situation-map/index.html |
| Situation map AI brief API | https://github.com/gendaiski/World-Monitor/blob/main/apps/situation-map/api/brief.js |
| Situation map Vercel config | https://github.com/gendaiski/World-Monitor/blob/main/apps/situation-map/vercel.json |
| Situation map docs | https://github.com/gendaiski/World-Monitor/blob/main/apps/situation-map/README.md |
| Situation map screenshots | https://github.com/gendaiski/World-Monitor/tree/main/apps/situation-map/screenshots |
| Situation map data builder | https://github.com/gendaiski/World-Monitor/blob/main/scripts/build-situation-map-data.mts |
| One-command installer | https://github.com/gendaiski/World-Monitor/blob/main/scripts/install-worldmonitor.sh |
| Seeder AI Port chain entry | https://github.com/gendaiski/World-Monitor/blob/main/scripts/lib/ai-port-provider.mjs |
| Seeder runner | https://github.com/gendaiski/World-Monitor/blob/main/scripts/run-seeders.sh |
| Live video source list (upstream config) | https://github.com/gendaiski/World-Monitor/blob/main/src/config/live-video-sources.ts |
| Dashboard styles (visual reference) | https://github.com/gendaiski/World-Monitor/blob/main/src/styles/main.css |
| Flat map renderer (visual reference) | https://github.com/gendaiski/World-Monitor/blob/main/src/components/Map.ts |
| Fork guard test | https://github.com/gendaiski/World-Monitor/blob/main/tests/fork-upstream-workflow-guard.test.mjs |
| AI Port seeder chain test | https://github.com/gendaiski/World-Monitor/blob/main/tests/ai-port-seeder-chain.test.mjs |

### Commits

| Commit | URL |
|---|---|
| `a9d823a` upstream import | https://github.com/gendaiski/World-Monitor/commit/a9d823afc22169d2f779fedb4f971d91c77a3dc2 |
| `35c2c35` AI Port + installer | https://github.com/gendaiski/World-Monitor/commit/35c2c35b0534ab948b322807cb985e67ee4574eb |
| `e65d924` situation map | https://github.com/gendaiski/World-Monitor/commit/e65d9246546f4bd51043428e6d2e3784bbd9aaa0 |
| `3b28bad` fork CI guards | https://github.com/gendaiski/World-Monitor/commit/3b28bad6719f274dabdfd75073b86cccb0257af8 |
| `63cedcc` unit shard fixes | https://github.com/gendaiski/World-Monitor/commit/63cedccb990a30715f607d2e8d23cddc7281b028 |
| `f31d572` revert stray artifacts | https://github.com/gendaiski/World-Monitor/commit/f31d5722df04e179e02fbd71eeabb3620df244fb |
| `3159050` worldmonitor.app restyle | https://github.com/gendaiski/World-Monitor/commit/31590505dbdbda1026291d9b3038ba343b95f8d3 |
| `6922f88` first handoff | https://github.com/gendaiski/World-Monitor/commit/6922f883902e9dce4e5cd139fcc20c12d36876c1 |

### CI (GitHub Actions)

| Workflow | URL |
|---|---|
| All runs | https://github.com/gendaiski/World-Monitor/actions |
| Test (unit shards, DOM, Convex, sidecar) | https://github.com/gendaiski/World-Monitor/actions/workflows/test.yml |
| Typecheck | https://github.com/gendaiski/World-Monitor/actions/workflows/typecheck.yml |
| Lint Code | https://github.com/gendaiski/World-Monitor/actions/workflows/lint-code.yml |
| Security Audit | https://github.com/gendaiski/World-Monitor/actions/workflows/security-audit.yml |
| E2E Visual | https://github.com/gendaiski/World-Monitor/actions/workflows/e2e-visual.yml |
| Proto Generation Check | https://github.com/gendaiski/World-Monitor/actions/workflows/proto-check.yml |
| AI Port (fork) | https://github.com/gendaiski/World-Monitor/actions/workflows/ai-port.yml |
| Situation Map (fork) | https://github.com/gendaiski/World-Monitor/actions/workflows/situation-map.yml |

### Upstream

| What | URL |
|---|---|
| Upstream repository | https://github.com/koala73/worldmonitor |
| Upstream commit this fork was imported from (`662d2ea`) | https://github.com/koala73/worldmonitor/commit/662d2ea |
| Upstream commits | https://github.com/koala73/worldmonitor/commits/main |
| Upstream live site (visual reference) | https://www.worldmonitor.app |

### Vercel (situation map hosting)

- **Team:** `gendaiski`, id `team_6EOWs9KFetQQNpHUN2XlEuXK`.
- **Project:** `world-monitor-situation-map`, id `prj_XRHSZN5ZtlcPksd7gSwhAftvvwAd`.

| What | URL |
|---|---|
| Production site | https://world-monitor-situation-map.vercel.app |
| Alias | https://world-monitor-situation-map-gendaiski.vercel.app |
| Alias (git main) | https://world-monitor-situation-map-git-main-gendaiski.vercel.app |
| Project dashboard | https://vercel.com/gendaiski/world-monitor-situation-map |
| Deployments list | https://vercel.com/gendaiski/world-monitor-situation-map/deployments |
| Last deployment (built from `e65d924`) | https://vercel.com/gendaiski/world-monitor-situation-map/4sFi1U4nXcxzEoFQLzT7TNLofnPQ |
| Settings: Git (connect the repo for auto-deploys) | https://vercel.com/gendaiski/world-monitor-situation-map/settings/git |
| Settings: Environment Variables (AI keys) | https://vercel.com/gendaiski/world-monitor-situation-map/settings/environment-variables |
| Settings: Deployment Protection (public or login-only) | https://vercel.com/gendaiski/world-monitor-situation-map/settings/deployment-protection |
| Settings: General (root directory, Node version) | https://vercel.com/gendaiski/world-monitor-situation-map/settings |
| Runtime logs | https://vercel.com/gendaiski/world-monitor-situation-map/logs |
| Vercel CLI docs | https://vercel.com/docs/cli |
| Vercel Git integration docs | https://vercel.com/docs/deployments/git |
| Vercel env var docs | https://vercel.com/docs/environment-variables |
| Vercel deployment protection docs | https://vercel.com/docs/deployment-protection |

### Claude (where this work was done)

These are private to the owner's Claude account. Codex cannot open them. They are listed for the owner and as a record.

| What | URL |
|---|---|
| Situation map artifact (new design, AI via the viewer's Claude) | https://claude.ai/artifact/DtZZCdoM9GFuUhvxkpkfeD |
| Deployment check artifact (earlier status page) | https://claude.ai/artifact/3biDcmvusag55JxmkErT2S |
| Claude Code session with the full history | https://claude.ai/code/session_01SoMw2ttZy81fjGtF7Yv2MW |

### Local services (after `./scripts/install-worldmonitor.sh`)

| What | URL |
|---|---|
| World Monitor dashboard | http://localhost:3000 |
| AI Port dashboard (unlock with `AI_PORT_ADMIN_TOKEN`) | http://localhost:8787 |
| AI Port health | http://localhost:8787/health |
| AI Port models (OpenAI format) | http://localhost:8787/v1/models |
| AI Port chat (OpenAI format) | http://localhost:8787/v1/chat/completions |
| AI Port models (Ollama format) | http://localhost:8787/api/tags |
| AI Port admin API | http://localhost:8787/admin/api/state (GET), `/admin/api/config` (PUT), `/admin/api/test` and `/admin/api/models` (POST) |
| Redis REST (internal, seeders) | http://127.0.0.1:8079 |
| Ollama on the host (if used) | http://localhost:11434/v1 |
| LM Studio on the host (if used) | http://localhost:1234/v1 |
| From containers to the host | http://host.docker.internal:8787 |

### AI provider key pages (from `ai-port/src/presets.mjs`)

| Provider | Env var | Get a key |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys |
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| Google Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | https://aistudio.google.com/apikey |
| xAI Grok | `XAI_API_KEY` | https://console.x.ai |
| Mistral | `MISTRAL_API_KEY` | https://console.mistral.ai/api-keys |
| DeepSeek | `DEEPSEEK_API_KEY` | https://platform.deepseek.com/api_keys |
| Cohere | `COHERE_API_KEY` or `CO_API_KEY` | https://dashboard.cohere.com/api-keys |
| Moonshot Kimi | `MOONSHOT_API_KEY` | https://platform.moonshot.ai/console/api-keys |
| Alibaba Qwen / DashScope | `DASHSCOPE_API_KEY` | https://modelstudio.console.alibabacloud.com/ |
| Perplexity | `PERPLEXITY_API_KEY` or `PPLX_API_KEY` | https://www.perplexity.ai/settings/api |
| OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| Groq | `GROQ_API_KEY` | https://console.groq.com/keys |
| Cerebras | `CEREBRAS_API_KEY` | https://cloud.cerebras.ai |
| Together AI | `TOGETHER_API_KEY` | https://api.together.ai/settings/api-keys |
| Fireworks AI | `FIREWORKS_API_KEY` | https://fireworks.ai/account/api-keys |
| Hugging Face | `HF_TOKEN` or `HUGGINGFACE_API_KEY` | https://huggingface.co/settings/tokens |
| NVIDIA NIM | `NVIDIA_API_KEY` | https://build.nvidia.com |
| GitHub Models | `GITHUB_MODELS_TOKEN` | https://github.com/settings/personal-access-tokens |
| Azure OpenAI | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_BASE_URL`, `AZURE_OPENAI_DEPLOYMENT` | https://portal.azure.com |
| Ollama (local) | `OLLAMA_BASE_URL` | https://ollama.com/download |
| LM Studio (local) | `LMSTUDIO_BASE_URL` | https://lmstudio.ai |
| Any OpenAI-compatible | `CUSTOM_LLM_BASE_URL`, `CUSTOM_LLM_API_KEY`, `CUSTOM_LLM_MODEL` | (your endpoint) |
| Claude Pro/Max subscription | sign in to the Claude Code CLI | https://docs.claude.com/en/docs/claude-code/setup |
| ChatGPT Plus/Pro subscription | sign in to the Codex CLI | https://github.com/openai/codex |
| Gemini subscription | sign in to the Gemini CLI | https://github.com/google-gemini/gemini-cli |

### External data and libraries used by the situation map

| What | URL |
|---|---|
| USGS earthquakes, M4.5+, past 7 days | https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson |
| NASA EONET open events, 30 days | https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30 |
| CoinGecko prices | https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true |
| d3 7.9.0 | https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js |
| topojson-client 3.1.0 | https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js |
| World borders source (world-atlas 2.0.2) | https://www.npmjs.com/package/world-atlas |
| YouTube embed host (privacy mode) | https://www.youtube-nocookie.com/embed/ |

### Live video streams in the situation map

The streams are the `NEWS` and `CAMS` lists in `apps/situation-map/index.html`, copied from `src/config/live-video-sources.ts`. If a stream ends, find the broadcaster's current live video and replace the 11-character id.

**Live News**

| Channel | URL |
|---|---|
| Sky News | https://www.youtube.com/watch?v=xDWQ3LkccY8 |
| Euronews | https://www.youtube.com/watch?v=pykpO5kQJ98 |
| DW News | https://www.youtube.com/watch?v=LuKwFajn37U |
| CNN | https://www.youtube.com/watch?v=GotlA1KKWoo |
| France 24 | https://www.youtube.com/watch?v=HvZt-nh9sGg |
| Al Arabiya | https://www.youtube.com/watch?v=n7eQejkXbnM |
| Bloomberg | https://www.youtube.com/watch?v=QB5BNdBFujE |
| Al Jazeera | https://www.youtube.com/watch?v=gCNeDWCI0vo |

**Live Webcams**

| Region | Cams |
|---|---|
| Mideast | [Jerusalem](https://www.youtube.com/watch?v=zp6LNSoq000), [Middle East](https://www.youtube.com/watch?v=AkqGOcpDvZU), [Mecca](https://www.youtube.com/watch?v=eC4LfEVxvKg), [Istanbul](https://www.youtube.com/watch?v=bbVe5h7X3uw) |
| Europe | [Kyiv](https://www.youtube.com/watch?v=e2gC37ILQmk), [London](https://www.youtube.com/watch?v=zMCea32gpmg), [Paris](https://www.youtube.com/watch?v=-xzg3wujOVM), [St Petersburg](https://www.youtube.com/watch?v=CjtIYbmVfck) |
| Americas | [Washington](https://www.youtube.com/watch?v=oDCAAfOSqvA), [New York](https://www.youtube.com/watch?v=JQ_jwk_7OVE), [Los Angeles](https://www.youtube.com/watch?v=EO_1LWqsCNE), [Miami](https://www.youtube.com/watch?v=WT69M210Z18) |
| Asia | [Taipei](https://www.youtube.com/watch?v=z_fY1pj1VBw), [Tokyo](https://www.youtube.com/watch?v=_k-5U7IeK8g), [Seoul](https://www.youtube.com/watch?v=vk5BHoDxXf0), [Shanghai](https://www.youtube.com/watch?v=Z-g8M1QGKbg) |
| Space | [ISS Earth](https://www.youtube.com/watch?v=M3HKLzjvKPc), [NASA Live](https://www.youtube.com/watch?v=awQzjn72bI0), [Starbase](https://www.youtube.com/watch?v=mhJRzQsLZGg), [Space Walk](https://www.youtube.com/watch?v=fO9e9jnhYK8) |

## 2. What exists today

| Piece | State | Where it runs |
|---|---|---|
| World Monitor (upstream app, imported whole) | In the repo, unchanged except fork wiring | Docker host via `./scripts/install-worldmonitor.sh` |
| AI Port (connect any AI by API key or subscription) | Done, 16 tests passing, CI workflow `ai-port.yml` | Docker service `ai-port` on 127.0.0.1:8787 |
| One-command installer | Done | Any Docker host |
| Situation map (standalone, worldmonitor.app style) | Done and pushed (`3159050`). **Vercel still serves the old design**: see task T1 | Vercel project `world-monitor-situation-map`; also the Claude artifact |
| Fork CI | Green; upstream-only operations jobs skip on the fork | GitHub Actions |
| Dependabot | Removed on the fork | — |

Architecture of the fork additions:

```text
browser ──► worldmonitor (nginx + API, :3000) ──► redis-rest ──► redis
                    │  OLLAMA_API_URL / LLM_API_URL
                    ▼
              ai-port (:8787) ──► any AI: API key providers, local Ollama / LM Studio,
                    ▲              or subscription CLIs (claude / codex / gemini)
ais-relay ──────────┘
host seeders (scripts/run-seeders.sh) ──► AI_PORT_URL (http://localhost:8787)

Vercel: apps/situation-map/index.html (static) + api/brief.js ──► ANTHROPIC_API_KEY
        or AI_BASE_URL (any OpenAI-compatible endpoint, e.g. a public AI Port)
```

## 3. Commit log

| Commit | Summary |
|---|---|
| `a9d823a` | Imported koala73/worldmonitor at `662d2ea`. |
| `35c2c35` | Added `ai-port/` (gateway, dashboard, tests, Dockerfile) and the `ai-port` compose service. Wired `worldmonitor` and `ais-relay` to it through `OLLAMA_API_URL`/`LLM_API_URL`. Added the AI Port entry to the seeder chains, `scripts/install-worldmonitor.sh`, docs and the `.env.example` block. Regenerated the source-attribution manifest. |
| `e65d924` | Added `apps/situation-map/` (page, `/api/brief`, data, Vercel config, tests) and `situation-map.yml`. |
| `3b28bad` | Guarded 33 upstream operations workflows with `if: github.repository == 'koala73/worldmonitor'`. Ported the upstream Redis apt retry in `test.yml` and the RUSTSEC-2024-0429 decision renewal. Listed the new workflows in ARCHITECTURE.md. Removed Dependabot. Added the fork guard test. |
| `63cedcc` | Added `scripts/lib/ai-port-provider.mjs` to the Railway watch patterns. Made the education-flip provenance test skip on forks. |
| `f31d572` | Reverted test-run artifacts that `63cedcc` committed by mistake. |
| `3159050` | Restyled the situation map to match worldmonitor.app. |
| `6922f88` | First handoff and screenshots. |

## 4. Full stack, installer and AI Port

### Install (Docker host; Node 24 for host-side scripts)

```bash
git clone https://github.com/gendaiski/World-Monitor.git
cd World-Monitor
./scripts/install-worldmonitor.sh                            # build, start, seed
./scripts/install-worldmonitor.sh --no-seed                  # start without the first seed
./scripts/install-worldmonitor.sh --with-subscription-clis   # adds Claude Code, Codex and Gemini CLIs to the AI Port image
docker compose ps                                            # service status
docker compose logs -f ai-port                               # AI Port logs
```

The installer generates these secrets into `.env` and never overwrites existing values:

- `RELAY_SHARED_SECRET`
- `REDIS_PASSWORD`
- `REDIS_TOKEN`
- `WM_SESSION_SECRET`
- `WORLDMONITOR_RELAY_KEY`
- `WORLDMONITOR_VALID_KEYS`
- `AI_PORT_TOKEN`
- `AI_PORT_ADMIN_TOKEN`

Compose services:

| Service | Port |
|---|---|
| `worldmonitor` | `${WM_PORT:-3000}` → 8080 |
| `ai-port` | 127.0.0.1:`${AI_PORT_PORT:-8787}` |
| `ais-relay` | — |
| `redis` | — |
| `redis-rest` | 127.0.0.1:8079 |

Volumes: `redis-data`, `ai-port-data`, `ai-port-home`.

### AI Port

It is an OpenAI-compatible gateway. Full docs: [ai-port/README.md](ai-port/README.md).

- **Providers:** about 25 presets (table in section 1). Keys come from `.env` or the dashboard.
- **Subscriptions:** `claude-subscription`, `chatgpt-subscription` and `gemini-subscription` run the official CLIs (`claude -p`, `codex exec`, `gemini -p`).
  - Build the image with `--with-subscription-clis` (or `AI_PORT_INSTALL_CLIS=true`).
  - Sign in with `docker compose exec -it ai-port claude`, `codex login` or `gemini`.
- **Routing:**
  - `auto`/`default` uses `AI_PORT_DEFAULT_ROUTE` (example: `groq,gemini,anthropic:claude-opus-5-5,ollama`).
  - `fast` uses `AI_PORT_FAST_ROUTE`.
  - `provider:model` picks one provider directly.
  - It falls back to the next provider on failure; `AI_PORT_STRICT_MODEL=true` disables that.
- **Anthropic adapter:**
  - effort is set explicitly (`AI_PORT_ANTHROPIC_EFFORT`, default `low`);
  - always streams upstream;
  - sends no `temperature` to current models;
  - server-side refusal fallback where the model supports it;
  - forced `tool_choice` is mapped to `auto`.
- **Auth:** `/v1/*` needs `Authorization: Bearer $AI_PORT_TOKEN`. The dashboard needs `AI_PORT_ADMIN_TOKEN`.
  - `AI_PORT_INSECURE_NO_AUTH=true` is only for a port bound to localhost (for example, the desktop app).
  - Config is saved to `ai-port/data/ai-port.json` with file mode 0600; it is gitignored.
- **Wiring into World Monitor:**
  - Compose sets `OLLAMA_API_URL=http://ai-port:8787`, `OLLAMA_API_KEY=$AI_PORT_TOKEN`, `OLLAMA_MODEL=auto` and `LLM_API_URL=http://ai-port:8787/v1/chat/completions`.
  - `WM_AI_PORT_URL` overrides the address, for example `http://host.docker.internal:8787` for a port running on the host.
  - Host seeders read `AI_PORT_URL`, `AI_PORT_MODEL` and `AI_PORT_TOKEN`.
- **Desktop app:** Settings → Ollama Server URL `http://localhost:8787`, Ollama Model `auto`.
- **Quick test:**

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer $AI_PORT_TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Say hello"}]}'
```

- **Development:** `cd ai-port && npm ci && npm test`. Run it locally with `AI_PORT_TOKEN=dev AI_PORT_ADMIN_TOKEN=dev GROQ_API_KEY=… npm start`.

## 5. Situation map (`apps/situation-map`)

A self-contained page plus one Vercel function. It is styled after the real World Monitor dashboard; the visual references are `src/styles/main.css`, `src/components/Map.ts` and `src/config/panels.ts`.

Layout:

- **Theme:** dark by default, light when the device asks for it, plus a theme button.
- **Header:** WORLD pill, MONITOR v2.10.0, LIVE status, region menu (Global, Americas, Europe, MENA, Asia, Africa, Oceania), Link, fullscreen, theme and GitHub buttons.
- **Map section ("Global Situation"):**
  - UTC clock;
  - equirectangular map cropped to 72°N–56°S with a 20px grid;
  - time range 1H/6H/24H/48H/7D/ALL, which filters the live layers;
  - zoom controls;
  - 12 layer toggles with ⓘ help;
  - legend;
  - hover tooltips and click popups with an "AI brief" button.
- **Right column:** Live News (channel tabs, click to play) and Live Webcams (regions, 2×2 grid, click to play).
- **Panel grid:** AI Insights, Strategic Risk Overview, Intel Hotspots, Active Conflicts, Seismic Activity, Natural Events, Chokepoints, Force Posture, Nuclear & AI Compute, Crypto and Data Sources.
- **Footer.**

| File | Purpose |
|---|---|
| `index.html` | The whole page: CSS tokens (dark and light), layout, d3 map, panels, live feeds, video, AI client |
| `api/brief.js` | `GET /api/brief?kind=&id=`. Looks the item up server-side (no free-form prompts) and calls Anthropic or any OpenAI-compatible endpoint. Answers are CDN-cached per item for a day (`s-maxage=86400`); failures are not cached |
| `data/layers.json` | Curated layers. Regenerate from the repo root with `npx tsx --tsconfig tsconfig.json scripts/build-situation-map-data.mts` |
| `data/countries-50m.json` | World borders |
| `vercel.json` | `framework: null`, `npm ci`, `api/brief.js` gets `maxDuration: 60` and includes `data/layers.json`, plus security headers |
| `test/brief.test.mjs` | 8 tests: `cd apps/situation-map && npm ci && npm test` |
| `screenshots/` | `desktop-dark.png`, `desktop-light.png`, `desktop-popup.png`, `phone-dark.png`. Excluded from Vercel uploads |

`/api/brief` kinds: `hotspot`, `conflict`, `waterway`, `base`, `nuclear`, `cable`, `pipeline`, `aidc`, `econ` and `spaceport`. Responses:

- 200 `{text, model, item}`
- 404 for an unknown item
- 503 `{error: "no_ai"}` when no AI is configured
- 502 when the provider fails
- 422 when the model declines

AI env vars on Vercel:

- `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`, default `claude-opus-5-5`); or
- `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`.

**Local preview:**

- Run `vercel dev` inside `apps/situation-map`.
- Or serve the folder statically and wrap `api/brief.js` in a small Node server that sets `req.query`, `res.status()` and `res.json()`.

**The Claude artifact version** is built from `index.html` with these changes:

- the data is inlined in place of `fetch('/data/...')`;
- `/api/brief` is replaced by `window.claude.use('sample')`;
- live feeds are turned off, and video opens YouTube instead of embedding, because the artifact sandbox blocks outside requests and frames.

## 6. CI on the fork

**Guarded workflows.** These 33 upstream workflows carry `if: github.repository == 'koala73/worldmonitor'` on their root jobs, so they skip on the fork:

`analytics-collector-monitor`, `build-desktop`, `china-decision-parity-live`, `convex-deploy`, `crawlable-pulse-refresh`, `deploy-railway-reconcile-control`, `deploy-worker`, `desktop-release-train`, `docker-publish`, `github-stars-refresh`, `indexnow-submit`, `live-api-cache-auth`, `live-video-source-audit`, `mcp-live-smoke`, `mcp-preset-liveness`, `openrouter-free-models-live`, `perf-style-layout-budget`, `postmerge-deploy-monitor`, `publish-cli`, `publish-go`, `publish-mcp-registry`, `publish-python`, `publish-ruby`, `pulse-freshness-monitor`, `railway-deploy-drift`, `railway-registry-sync`, `resilience-snapshot-refresh`, `seed-freshness-monitor`, `sentry-resolve-pin-audit`, `seo-gsc-weekly`, `test-linux-app`, `tps-open-data-live`, `umami-storage-monitor`.

- `tests/fork-upstream-workflow-guard.test.mjs` fails if a new upstream ops job lacks the guard.
- Manual-only Railway workflows are left unguarded.

**Fork workflows:**

- `ai-port.yml` runs `cd ai-port && npm ci && npm test`.
- `situation-map.yml` runs `cd apps/situation-map && npm ci && npm test`.
- `security-audit.yml` also audits both packages.

**Checks to run locally, from AGENTS.md:**

| Change | Command | CI job |
|---|---|---|
| `tests/*.test.mjs` / `.mts` | `npm run test:data` | `unit-shards` |
| `tests/dom/` | `npm run test:dom` | `dom-tests` |
| Convex and server tests | `npm run test:convex` | `convex-tests` |
| `api/` node suites, `src-tauri/` | `npm run test:sidecar` | `sidecar` |
| Browser code | `npm run typecheck`, `npm run lint:boundaries` | Typecheck / Lint |
| API code | `npm run typecheck:api` | Typecheck |
| Markdown | `npm run lint:md` (or `npx markdownlint-cli2 <file>`) | Lint |
| URLs added to tracked files | `node scripts/source-attribution.mjs --check`, then `--write` if stale and commit the manifest | unit-shards |

## 7. Task backlog with acceptance criteria

Tasks marked **OWNER** need the repository or Vercel owner; an agent cannot do them without credentials. Do the rest in order.

**T1 — OWNER: put the new design on Vercel.**

- Open https://vercel.com/gendaiski/world-monitor-situation-map/deployments and use Redeploy or Create Deployment from the latest `main`.
- Or, with the CLI: `cd apps/situation-map && vercel link` (choose `world-monitor-situation-map`), then `vercel deploy --prod`.
- *Done when:* https://world-monitor-situation-map.vercel.app shows the dark worldmonitor.app style, with the "GLOBAL SITUATION" header and "Live News" beside the map.

**T2 — OWNER: auto-deploy on push.**

- In https://vercel.com/gendaiski/world-monitor-situation-map/settings/git connect `gendaiski/World-Monitor`.
- Production branch `main`, Root Directory `apps/situation-map`.
- *Done when:* a push touching `apps/situation-map/` creates a production deployment by itself.

**T3 — OWNER: decide on public access.**

- https://vercel.com/gendaiski/world-monitor-situation-map/settings/deployment-protection
- *Done when:* the site opens in a private window without a Vercel login, if that is what the owner wants.

**T4 — OWNER: connect an AI to the Vercel site.**

- Add `ANTHROPIC_API_KEY`, or `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`, at https://vercel.com/gendaiski/world-monitor-situation-map/settings/environment-variables (Production), then redeploy.
- *Done when:* clicking a conflict zone, then "AI brief", returns a brief, and the panel badge shows `AI · <model>`.

**T5 — Verify the full stack on a real Docker host.**

- Run `./scripts/install-worldmonitor.sh` on a machine with Docker. The build sandbox could not reach the Alpine package mirror, so the production `Dockerfile` was never built end to end.
- *Done when:*
  - `docker compose ps` shows all services healthy;
  - http://localhost:3000 loads with data after seeding;
  - the AI Port dashboard at http://localhost:8787 tests one provider successfully;
  - an AI feature in the dashboard (for example, an AI brief or insights) answers through the port (check `docker compose logs ai-port`).
- Fix and record anything that fails here in section 9.

**T6 — Optional: refresh live video ids automatically.**

- The ids in `apps/situation-map/index.html` are a snapshot. Upstream resolves live ids with a cron (`seed-live-video-resolved`).
- Option A: generate `NEWS` and `CAMS` from `src/config/live-video-sources.ts` at build time.
- Option B: read the resolved ids from the full stack's API.
- *Done when:* ids come from one source of truth, with a test.

**T7 — Optional: live news headlines on the situation map.**

- Add a panel fed by the full stack's news API, or by a small Vercel function that reads a few RSS feeds with a `User-Agent` and caching.
- Follow AGENTS.md: shared cache helpers, every request-varying parameter in cache keys.
- *Done when:* the panel shows headlines with sources and timestamps, with tests for the function.

**T8 — Optional: sync upstream** (section 11).

- *Done when:* `main` contains the new upstream commits, and the fork guard test, AI Port tests and situation map tests pass, plus a green CI run.

## 8. Verification record

| Check | Result | When |
|---|---|---|
| `cd ai-port && npm test` | 16 passing (mock upstreams: routing, fallback, Anthropic translation, CLI bridge) | `35c2c35` |
| `cd apps/situation-map && npm test` | 8 passing | `3159050` |
| `node scripts/source-attribution.mjs --check` | Clean | `3159050`, `6922f88` |
| `npx markdownlint-cli2 HANDOFF.md apps/situation-map/README.md` | 0 errors | `6922f88` |
| GitHub Actions on `main` | Green: Test, Typecheck, Lint Code, Security Audit, E2E Visual, Proto Check, Situation Map | `f31d572`, `3159050` |
| Situation map in headless Chromium | Exercised at 1440×900 dark and light, 900×1100 light and 390×844 dark, with stand-in USGS, EONET and CoinGecko data and a stand-in AI. Results below | `3159050` |
| Claude artifact build | Loads with no page errors; AI analyst works through a mocked `window.claude`; video links point to YouTube | `3159050` |
| AI Port dashboard | Screenshot-tested with a provider "Test" against a mock upstream | `35c2c35` |
| World Monitor in Docker | Ran in the sandbox through a sandbox-only Ubuntu image variant (the Alpine mirror was blocked). Dashboard rendered | `35c2c35` |

Headless Chromium results for the situation map:

- no page errors and no horizontal overflow;
- the time filter, map popups, AI brief, layer help and toggles, video play, webcam play and theme toggle all worked.

**Not verified:**

- production Docker image build (Alpine mirror blocked);
- real AI providers end to end (mocks only);
- real USGS, EONET and CoinGecko responses from the deployed page (the sandbox blocks them);
- whether every YouTube id is live today;
- the Vercel deployment of `3159050` (blocked; see T1).

## 9. Problems hit and how they were solved

| Problem | Resolution |
|---|---|
| Upstream ops workflows (monitors, deploys, publishing) failed on the fork every run and on schedules, sending failure emails | Guarded root jobs with `github.repository == 'koala73/worldmonitor'`; added a guard test (`3b28bad`) |
| Unit shards failed on a stale runner apt index while installing Redis | Ported upstream's retry: `apt-get install … \|\| { apt-get update && apt-get install …; }` in `test.yml` |
| Rust advisory decision RUSTSEC-2024-0429 expired on 2026-10-08 | Ported upstream's renewal (now expires 2027-01-08) |
| Dependabot PRs always failed `proto-check` | Removed `.github/dependabot.yml` on the fork; closed PRs #1–#5 |
| Railway watch-path audit wanted the new seeder dependency listed | Added `scripts/lib/ai-port-provider.mjs` to the watch patterns in `scripts/railway-services.json` |
| Education-flip provenance test needs upstream PR refs that a fork cannot fetch | It now skips when `GITHUB_REPOSITORY` is set and is not `koala73/worldmonitor` |
| ARCHITECTURE.md CI table check failed for the new workflows | Added rows for `ai-port.yml` and `situation-map.yml` |
| Source-attribution manifest went stale after adding URLs | Ran `node scripts/source-attribution.mjs --write` and committed the manifest |
| A local test run regenerated `src/config/docs-page-dates.generated.ts` and created `scripts/fixtures/_bundle-fixture-hang.mjs`, which were committed by mistake | Reverted in `f31d572`. Lesson: stage explicit paths, not `git add -A`, while tests run |
| Vercel deploys need the full 40-character SHA when deploying from `gitSource` | Use the full SHA |
| The Vercel connector used by Claude lost access to the `gendaiski` team (HTTP 403) after `e65d924` was deployed | Open; owner action T1 |
| worldmonitor.app was unreachable from the sandbox (DNS blocked) | Took the style from the repo's own frontend code and an earlier screenshot of the running app |
| Map legend overlapped layer toggles on narrow maps; Middle East conflict labels overlapped | Container query moves the legend; labels are decluttered by intensity at each zoom |

## 10. Secrets and configuration inventory (names only)

| Where | Names |
|---|---|
| `.env` (generated by the installer) | `RELAY_SHARED_SECRET`, `REDIS_PASSWORD`, `REDIS_TOKEN`, `WM_SESSION_SECRET`, `WORLDMONITOR_RELAY_KEY`, `WORLDMONITOR_VALID_KEYS`, `AI_PORT_TOKEN`, `AI_PORT_ADMIN_TOKEN` |
| `.env` (AI Port tuning) | `AI_PORT_MODEL`, `AI_PORT_DEFAULT_ROUTE`, `AI_PORT_FAST_ROUTE`, `AI_PORT_ANTHROPIC_EFFORT`, `AI_PORT_STRICT_MODEL`, `AI_PORT_INSTALL_CLIS`, `AI_PORT_ENABLE_CLAUDE_CLI`, `AI_PORT_ENABLE_CODEX_CLI`, `AI_PORT_ENABLE_GEMINI_CLI`, `AI_PORT_PORT`, `AI_PORT_HOST`, `AI_PORT_CONFIG`, `AI_PORT_TIMEOUT_MS`, `AI_PORT_INSECURE_NO_AUTH`, `WM_AI_PORT_URL`, `WM_PORT` |
| `.env` (provider keys, any subset) | See the key table in section 1 |
| `.env` (other upstream keys) | See `.env.example` and SELF_HOSTING.md "API Keys" |
| Vercel project env | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, or `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (none set yet) |
| GitHub Actions secrets | None needed by the fork's own workflows |

`.env` and `ai-port/data/` are gitignored. Never commit values; report names only.

## 11. Syncing upstream

```bash
git remote add upstream https://github.com/koala73/worldmonitor.git
git fetch upstream main
git merge upstream/main     # a merge commit; do not rebase main
```

Expect conflicts in the following places:

- `docker-compose.yml`, `.env.example`, `SELF_HOSTING.md`, `README.md` and `ARCHITECTURE.md`.
- The guarded workflow files: keep the guard, and add it to any new upstream ops job.
- `scripts/regional-snapshot/narrative.mjs` and `scripts/weekly-brief.mjs`: keep `aiPortChainEntry` last in `DEFAULT_PROVIDERS`.
- `scripts/railway-services.json`.
- `shared/source-attribution-manifest.json`: regenerate it with `--write`; do not hand-merge.

After merging, run:

```bash
node --test tests/fork-upstream-workflow-guard.test.mjs tests/ai-port-seeder-chain.test.mjs
(cd ai-port && npm test) && (cd apps/situation-map && npm test)
node scripts/source-attribution.mjs --check
```

If upstream changed `src/config/live-video-sources.ts`, consider updating the `NEWS` and `CAMS` ids in the situation map.

## 12. Ground rules

- Use Node 24 (`.nvmrc`). Run `npm run --silent agent:preflight -- --mode repair` before making changes.
- Never commit secrets or print their values.
- UI changes need screenshots: desktop and mobile when the layout changes.
- Edit `proto/` and regenerate. Never hand-edit `src/generated/`.
- Legacy `api/*.js` stays self-contained. Edge code must not import `node:http`, `node:https` or `node:zlib`.
- Server fetches send a `User-Agent`.
- Merging, deploying and contacting anyone outside the repo need the owner's explicit OK.
- So far the owner has pushed directly to `main`. Prefer PRs unless told otherwise.
- Keep this file current. It is the record the next agent starts from.

---
*Prepared by Claude Code. Session: https://claude.ai/code/session_01SoMw2ttZy81fjGtF7Yv2MW*
