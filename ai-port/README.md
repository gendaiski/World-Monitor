# AI Port — connect any AI to World Monitor

The AI Port is a small gateway that sits between World Monitor and your AI. World Monitor
sends every AI request (news summaries, headline classification, country briefs, the chat
analyst, regional narratives, forecasts) to the port. The port forwards it to whichever AI
you connected:

- **An API key from any provider:** Anthropic Claude, OpenAI, Google Gemini, xAI Grok,
  Mistral, DeepSeek, Cohere, Moonshot Kimi, Alibaba Qwen, Perplexity, Groq, Cerebras,
  Together, Fireworks, Hugging Face, NVIDIA NIM, GitHub Models, Azure OpenAI, or OpenRouter.
- **A local model:** Ollama, LM Studio, vLLM, llama.cpp, LocalAI, LiteLLM, or any other
  OpenAI-compatible server.
- **A subscription you already pay for:** Claude Pro/Max, ChatGPT Plus/Pro, or a Google
  account with Gemini. The port uses each vendor's official command-line tool, which you
  sign in to yourself.

You can connect several at once. Requests go to the first provider in your list. If it
fails (an outage, a rate limit, or a bad key), the port tries the next one.

```
World Monitor ──► AI Port (:8787) ──► Anthropic / OpenAI / Gemini / Groq / … (API key)
 (dashboard,       one endpoint,  ├──► Ollama / LM Studio / vLLM (local)
  relay, seeders)   auto-fallback └──► claude / codex / gemini CLI (subscription)
```

## Quick start

`./scripts/install-worldmonitor.sh` generates `AI_PORT_TOKEN` and `AI_PORT_ADMIN_TOKEN` and
starts the port with the rest of the stack. To connect your AI, use either of these methods.

**Option A: the dashboard.** Open <http://localhost:8787>. Unlock it with
`AI_PORT_ADMIN_TOKEN` from `.env`. Then choose a provider, paste your key, and click **Test**.

**Option B: environment variables.** Add any of these to `.env` and run `docker compose up -d`:

| Provider | Variable(s) |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` (optional `AI_PORT_ANTHROPIC_EFFORT=low\|medium\|high`) |
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| xAI | `XAI_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Cohere | `COHERE_API_KEY` |
| Moonshot | `MOONSHOT_API_KEY` |
| Qwen | `DASHSCOPE_API_KEY` |
| Perplexity | `PERPLEXITY_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| Together | `TOGETHER_API_KEY` |
| Fireworks | `FIREWORKS_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| NVIDIA | `NVIDIA_API_KEY` |
| GitHub Models | `GITHUB_MODELS_TOKEN` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_BASE_URL` (`https://<resource>.openai.azure.com/openai/v1`), `AZURE_OPENAI_DEPLOYMENT` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Ollama on the host | `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1` |
| LM Studio on the host | `LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1` |
| Any OpenAI-compatible server | `CUSTOM_LLM_BASE_URL`, `CUSTOM_LLM_API_KEY`, `CUSTOM_LLM_MODEL` |

Providers set in environment variables are tried in the order of this table. Providers
added in the dashboard come before them. You can change the order with the arrows in the
dashboard or with routes (see below).

## Using a subscription (Claude, ChatGPT, Gemini)

Subscriptions don't come with API keys. Instead, the port runs the vendor's official CLI in
one-shot mode, and that CLI is signed in to your account. The port never reads, copies, or
stores your login. The CLI keeps it.

**In Docker:**

```bash
./scripts/install-worldmonitor.sh --with-subscription-clis   # or set AI_PORT_INSTALL_CLIS=true in .env
docker compose exec -it ai-port claude        # Claude Pro/Max: sign in once, then /exit
docker compose exec -it ai-port codex login   # ChatGPT Plus/Pro
docker compose exec -it ai-port gemini        # Google account
```

Then enable the bridge you want. You can do this in `.env`
(`AI_PORT_ENABLE_CLAUDE_CLI=true`, `AI_PORT_ENABLE_CODEX_CLI=true`, or
`AI_PORT_ENABLE_GEMINI_CLI=true`) and run `docker compose up -d`. Or add the provider in the
dashboard. Logins are kept in the `ai-port-home` volume.

**On your own machine (no Docker):** install the CLI and sign in. Then run the port natively
with `cd ai-port && npm ci && AI_PORT_TOKEN=… AI_PORT_ENABLE_CLAUDE_CLI=true npm start`.
Finally, point World Monitor at it with `WM_AI_PORT_URL=http://host.docker.internal:8787`.

> **Note:** Your plan's usage limits and terms still apply. World Monitor makes many small
> AI calls around the clock (classification runs every few minutes), which can use up a
> subscription's message allowance quickly. CLI calls are also slower (a few seconds each to
> start). The usual setup is a cheap or free API (Groq, Cerebras, Gemini) or a local model
> first, with the subscription as a fallback. Or use the subscription only for the `smart`
> route described below. Check your provider's terms for automated use.

## Routes and model selection

Clients choose what to use through the `model` field:

| `model` value | Behavior |
|---|---|
| `auto` / `default` / anything unrecognized | the **default** route |
| `anthropic` | that provider with its configured model, then the default route |
| `anthropic:claude-sonnet-5-5` or `openrouter/meta-llama/llama-4` | that provider and model, then the default route |
| `fast`, `smart`, … | a named route |

You can define routes in the dashboard or in environment variables:

```bash
AI_PORT_DEFAULT_ROUTE=groq,gemini,anthropic:claude-opus-5-5,ollama
AI_PORT_FAST_ROUTE=cerebras,groq
```

To turn off fallback for an explicitly named provider, set `AI_PORT_STRICT_MODEL=true`.

## How World Monitor uses it

`docker-compose.yml` wires the port in for you:

| World Monitor setting | Value |
|---|---|
| `OLLAMA_API_URL` | `http://ai-port:8787` (first provider in every LLM chain) |
| `OLLAMA_API_KEY` | `AI_PORT_TOKEN` |
| `OLLAMA_MODEL` / `LLM_MODEL` | `auto` (override with `AI_PORT_MODEL`) |
| `LLM_API_URL` | `http://ai-port:8787/v1/chat/completions` (forecasts) |

Host-side seeders (`scripts/run-seeders.sh`) pick up `AI_PORT_TOKEN` from `.env` and connect
to `http://localhost:8787`. The regional narrative and weekly-brief seeders use the port
after OpenRouter. If you have no OpenRouter key, they use the port alone.

**Desktop app:** in **Settings → Ollama Server URL**, enter `http://localhost:8787`. In
**Ollama Model**, enter `auto`. Run the port locally with `AI_PORT_INSECURE_NO_AUTH=true`.
It listens only on 127.0.0.1, so nothing else can reach it.

**Still direct (not through the port):**

- The AI widget builder calls Anthropic tool use directly, so it needs `ANTHROPIC_API_KEY`.
- Company-monitoring classification and the email digest are OpenRouter-only features of the
  hosted product.

## The API

The port speaks the OpenAI chat-completions protocol, so any OpenAI SDK or tool can use it:

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer $AI_PORT_TOKEN" -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'
```

| Endpoint | Purpose |
|---|---|
| `POST /v1/chat/completions` | chat completions. Supports `stream`, `tools`, `response_format`, and images. |
| `GET /v1/models` | routes plus `provider:model` entries |
| `GET /health` | liveness check (no auth) |
| `GET /` | the dashboard |
| `/admin/api/*` | dashboard API (admin token) |

The responses carry `X-AI-Port-Provider` and `X-AI-Port-Model` headers, so you can see which
provider answered.

For Anthropic, the port translates requests to the Messages API with the official SDK:

- System prompts move to the top-level `system` field.
- Tool calls and images are translated.
- Settings that current Claude models reject (sampling parameters, forced tool choice,
  assistant prefill) are adapted.
- The port streams from Anthropic and reserves room for thinking tokens.
- `output_config.effort` defaults to `low`, because World Monitor's calls are short and have
  20–60 s client deadlines. Raise it with `AI_PORT_ANTHROPIC_EFFORT`.
- On the first-party API, the server-side refusal fallback (`fallbacks: "default"`) is on for
  models that support it. To turn it off for a provider, set `"options": {"fallbacks": false}`
  in that provider's entry in `data/ai-port.json`.

## Security

- `/v1/*` requires `AI_PORT_TOKEN`. The dashboard requires `AI_PORT_ADMIN_TOKEN`, or
  `AI_PORT_TOKEN` if no admin token is set. Without a token, the port refuses chat requests.
  The exception is `AI_PORT_INSECURE_NO_AUTH=true`, which is meant only for a port bound to
  localhost.
- Docker publishes the port on `127.0.0.1` only.
- Keys added in the dashboard are stored in `/app/data/ai-port.json` with mode 0600, in the
  `ai-port-data` volume. The dashboard never receives a stored key back, only a masked preview.
- The port strips request fields a provider does not support before forwarding.

## Development

```bash
cd ai-port
npm ci
npm test            # mock-upstream tests: routing, fallback, Anthropic translation, CLI bridge
AI_PORT_TOKEN=dev AI_PORT_ADMIN_TOKEN=dev GROQ_API_KEY=… npm start
```

| Variable | Default |
|---|---|
| `AI_PORT_HOST` / `AI_PORT_PORT` | `127.0.0.1` / `8787` (Docker: `0.0.0.0`) |
| `AI_PORT_CONFIG` | `./data/ai-port.json` |
| `AI_PORT_TIMEOUT_MS` | `180000` |
