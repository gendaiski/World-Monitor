# World Monitor Situation Map

A standalone, deployable web page of World Monitor's situation map:

- **Curated layers** from World Monitor's own datasets: conflict zones, intel hotspots, military bases, chokepoints, sanctions, undersea cables, pipelines, nuclear sites, AI data centers, economic centers and spaceports.
- **Live feeds**, fetched by the visitor's browser every five minutes:
  - USGS earthquakes, magnitude 4.5 and above, last 7 days
  - NASA EONET natural events
  - CoinGecko crypto prices
- **AI analyst** (`/api/brief`) writes a short brief for any curated map item. Answers are cached at the edge for a day per item, so repeat visits do not spend AI credits.

News, aviation, maritime and full market feeds need the complete World Monitor stack (`./scripts/install-worldmonitor.sh`).

## Deploy on Vercel

Import the repository and set **Root Directory** to `apps/situation-map`. No build step is needed.

To turn on the AI analyst, add one of these sets of environment variables, then redeploy:

| Variables | Connects |
|---|---|
| `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`) | Claude |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Any OpenAI-compatible endpoint: World Monitor's AI Port, OpenRouter, Groq, Gemini, OpenAI |

Without them, the analyst panel explains how to connect an AI.

## Update the curated data

```bash
npx tsx --tsconfig tsconfig.json scripts/build-situation-map-data.mts
```

## Test

```bash
cd apps/situation-map && npm ci && npm test
```
