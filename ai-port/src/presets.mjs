// Catalog of supported AI providers.
//
// kind:
//   openai     — speaks OpenAI /chat/completions (most providers do)
//   anthropic  — Anthropic Messages API (translated)
//   cli        — a locally installed, officially supported CLI that is logged
//                in with the user's own subscription (Claude, ChatGPT, Gemini)
//
// Default models are a starting point only; every provider can override
// `model`, and the dashboard can list the provider's live model catalog.

export const PRESETS = {
  // ── Frontier labs ────────────────────────────────────────────────────────
  anthropic: {
    label: 'Anthropic (Claude API key)',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    envKey: 'ANTHROPIC_API_KEY',
    model: 'claude-opus-5-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    label: 'OpenAI (API key)',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-5-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    label: 'Google Gemini (API key)',
    kind: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    envKey: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    model: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  xai: {
    label: 'xAI Grok (API key)',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    envKey: 'XAI_API_KEY',
    model: 'grok-3-mini',
    keyUrl: 'https://console.x.ai',
  },
  mistral: {
    label: 'Mistral (API key)',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    envKey: 'MISTRAL_API_KEY',
    model: 'mistral-small-latest',
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  deepseek: {
    label: 'DeepSeek (API key)',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    envKey: 'DEEPSEEK_API_KEY',
    model: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  cohere: {
    label: 'Cohere (API key)',
    kind: 'openai',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    envKey: ['COHERE_API_KEY', 'CO_API_KEY'],
    model: 'command-a-03-2025',
    keyUrl: 'https://dashboard.cohere.com/api-keys',
  },
  moonshot: {
    label: 'Moonshot Kimi (API key)',
    kind: 'openai',
    baseUrl: 'https://api.moonshot.ai/v1',
    envKey: 'MOONSHOT_API_KEY',
    model: 'kimi-k2-0905-preview',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
  },
  qwen: {
    label: 'Alibaba Qwen / DashScope (API key)',
    kind: 'openai',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    envKey: 'DASHSCOPE_API_KEY',
    model: 'qwen-plus',
    keyUrl: 'https://modelstudio.console.alibabacloud.com/',
  },
  perplexity: {
    label: 'Perplexity (API key)',
    kind: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    envKey: ['PERPLEXITY_API_KEY', 'PPLX_API_KEY'],
    model: 'sonar',
    keyUrl: 'https://www.perplexity.ai/settings/api',
  },

  // ── Fast inference / aggregators ─────────────────────────────────────────
  openrouter: {
    label: 'OpenRouter (one key, hundreds of models)',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    model: 'google/gemini-2.5-flash',
    keyUrl: 'https://openrouter.ai/keys',
    headers: { 'HTTP-Referer': 'https://worldmonitor.app', 'X-Title': 'World Monitor' },
    passthrough: ['provider', 'reasoning', 'transforms', 'models', 'route'],
  },
  groq: {
    label: 'Groq (API key, free tier)',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
  },
  cerebras: {
    label: 'Cerebras (API key, free tier)',
    kind: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1',
    envKey: 'CEREBRAS_API_KEY',
    model: 'llama-3.3-70b',
    keyUrl: 'https://cloud.cerebras.ai',
  },
  together: {
    label: 'Together AI (API key)',
    kind: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    envKey: 'TOGETHER_API_KEY',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    keyUrl: 'https://api.together.ai/settings/api-keys',
  },
  fireworks: {
    label: 'Fireworks AI (API key)',
    kind: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    envKey: 'FIREWORKS_API_KEY',
    model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    keyUrl: 'https://fireworks.ai/account/api-keys',
  },
  huggingface: {
    label: 'Hugging Face Inference Providers (token)',
    kind: 'openai',
    baseUrl: 'https://router.huggingface.co/v1',
    envKey: ['HF_TOKEN', 'HUGGINGFACE_API_KEY'],
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    keyUrl: 'https://huggingface.co/settings/tokens',
  },
  nvidia: {
    label: 'NVIDIA NIM (API key)',
    kind: 'openai',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    envKey: 'NVIDIA_API_KEY',
    model: 'meta/llama-3.3-70b-instruct',
    keyUrl: 'https://build.nvidia.com',
  },
  'github-models': {
    label: 'GitHub Models (GitHub token / Copilot plan)',
    kind: 'openai',
    baseUrl: 'https://models.github.ai/inference',
    envKey: ['GITHUB_MODELS_TOKEN'],
    model: 'openai/gpt-4.1-mini',
    keyUrl: 'https://github.com/settings/personal-access-tokens',
  },

  // ── Cloud tenancy ────────────────────────────────────────────────────────
  azure: {
    label: 'Azure OpenAI / AI Foundry (endpoint + key)',
    kind: 'openai',
    // Set baseUrl to https://<resource>.openai.azure.com/openai/v1 and
    // model to your deployment name.
    baseUrl: '',
    envKey: 'AZURE_OPENAI_API_KEY',
    envBaseUrl: 'AZURE_OPENAI_BASE_URL',
    envModel: 'AZURE_OPENAI_DEPLOYMENT',
    model: '',
    authHeader: 'api-key',
    keyUrl: 'https://portal.azure.com',
  },

  // ── Local / self-hosted (no key) ─────────────────────────────────────────
  ollama: {
    label: 'Ollama (local, free)',
    kind: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    envBaseUrl: 'OLLAMA_BASE_URL',
    model: 'llama3.1:8b',
    keyOptional: true,
    passthrough: ['think', 'keep_alive', 'options'],
    keyUrl: 'https://ollama.com/download',
  },
  lmstudio: {
    label: 'LM Studio (local, free)',
    kind: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    envBaseUrl: 'LMSTUDIO_BASE_URL',
    model: '',
    keyOptional: true,
    keyUrl: 'https://lmstudio.ai',
  },
  custom: {
    label: 'Any OpenAI-compatible endpoint (vLLM, llama.cpp, LiteLLM, LocalAI, …)',
    kind: 'openai',
    baseUrl: '',
    envKey: 'CUSTOM_LLM_API_KEY',
    envBaseUrl: 'CUSTOM_LLM_BASE_URL',
    envModel: 'CUSTOM_LLM_MODEL',
    model: '',
    keyOptional: true,
  },

  // ── Subscriptions via their official CLIs (run on your own machine) ──────
  'claude-subscription': {
    label: 'Claude Pro/Max subscription (via Claude Code CLI)',
    kind: 'cli',
    cli: 'claude',
    command: 'claude',
    envEnable: 'AI_PORT_ENABLE_CLAUDE_CLI',
    model: '',
    keyOptional: true,
    keyUrl: 'https://docs.claude.com/en/docs/claude-code/setup',
  },
  'chatgpt-subscription': {
    label: 'ChatGPT Plus/Pro subscription (via Codex CLI)',
    kind: 'cli',
    cli: 'codex',
    command: 'codex',
    envEnable: 'AI_PORT_ENABLE_CODEX_CLI',
    model: '',
    keyOptional: true,
    keyUrl: 'https://github.com/openai/codex',
  },
  'gemini-subscription': {
    label: 'Google account / Gemini subscription (via Gemini CLI)',
    kind: 'cli',
    cli: 'gemini',
    command: 'gemini',
    envEnable: 'AI_PORT_ENABLE_GEMINI_CLI',
    model: '',
    keyOptional: true,
    keyUrl: 'https://github.com/google-gemini/gemini-cli',
  },
};

/** Order used when providers are discovered from environment variables. */
export const ENV_DISCOVERY_ORDER = [
  'anthropic', 'openai', 'gemini', 'xai', 'mistral', 'deepseek', 'cohere',
  'moonshot', 'qwen', 'perplexity', 'groq', 'cerebras', 'together', 'fireworks',
  'huggingface', 'nvidia', 'github-models', 'azure', 'openrouter', 'custom',
  'ollama', 'lmstudio', 'claude-subscription', 'chatgpt-subscription',
  'gemini-subscription',
];
