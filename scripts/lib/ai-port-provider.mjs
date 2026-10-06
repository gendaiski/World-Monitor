// Provider-chain entry for the self-hosted AI Port (ai-port/), the
// OpenAI-compatible gateway that fronts whatever AI the operator connected:
// an API key from any provider, a local model, or a subscription CLI.
//
// Seeders whose chains are otherwise OpenRouter-only append this entry last,
// so existing OpenRouter behavior is unchanged and an install without an
// OpenRouter key still gets these features through the port. It activates
// only when AI_PORT_TOKEN is set. Values are read at call time because
// seeders load .env after their imports are evaluated.

const DEFAULT_AI_PORT_URL = 'http://localhost:8787';

export function aiPortChatUrl(env = process.env) {
  const base = (env.AI_PORT_URL || DEFAULT_AI_PORT_URL).trim().replace(/\/+$/, '');
  return `${base}/v1/chat/completions`;
}

/**
 * @param {{ userAgent: string, timeout: number, maxRetries?: number }} opts
 */
export function aiPortChainEntry({ userAgent, timeout, maxRetries }) {
  return {
    name: 'ai-port',
    envKey: 'AI_PORT_TOKEN',
    get apiUrl() { return aiPortChatUrl(); },
    get model() { return (process.env.AI_PORT_MODEL || 'auto').trim(); },
    timeout,
    headers: (token) => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    }),
    ...(maxRetries === undefined ? {} : { maxRetries }),
  };
}
