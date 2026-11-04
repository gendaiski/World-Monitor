// The one Vercel Function behind every /api/* route on the Hobby-plan deploy.
//
// The Docker image runs every API handler in a single Node process (the
// sidecar, src-tauri/sidecar/local-api-server.mjs) behind nginx. This function
// plays nginx's part: it starts that same sidecar once per instance on a
// loopback port and proxies each request to it with the headers
// docker/nginx.conf sets in its `location /api/` block. build.mjs copies the
// sidecar, the compiled handlers (docker/build-handlers.mjs) and their runtime
// dependencies into this function's directory.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Same layout as the Docker image's /app: local-api-server.mjs, api/, data/
// and shared/ sit next to this file.
const WM = dirname(fileURLToPath(import.meta.url));

process.env.LOCAL_API_MODE = 'docker';
process.env.LOCAL_API_CLOUD_FALLBACK = 'false';
process.env.LOCAL_API_RESOURCE_DIR = WM;
process.env.LOCAL_API_TOKEN ||= randomBytes(32).toString('base64url');
// Vercel's Upstash integration names its variables KV_REST_API_*; the app
// reads UPSTASH_REDIS_REST_*.
process.env.UPSTASH_REDIS_REST_URL ||= process.env.KV_REST_API_URL || '';
process.env.UPSTASH_REDIS_REST_TOKEN ||= process.env.KV_REST_API_TOKEN || '';

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection']);
const RSS_SANDBOX_CSP = "sandbox; default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

// wm-session tokens are signed with WM_SESSION_SECRET, and every instance must
// use the same one. When the project does not set it, create it once in the
// deployment's own Redis (SET NX) so it exists only there, then read it back.
async function ensureSessionSecret() {
  if (process.env.WM_SESSION_SECRET) return;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const key = 'wm:vercel-hobby:session-secret';
  const call = async (command) => {
    const response = await fetch(url.replace(/\/+$/, ''), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'worldmonitor-vercel-hobby/1.0' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Redis answered HTTP ${response.status}`);
    return (await response.json()).result;
  };
  await call(['SET', key, randomBytes(32).toString('hex'), 'NX']);
  const secret = await call(['GET', key]);
  if (typeof secret === 'string' && secret.length >= 32) process.env.WM_SESSION_SECRET = secret;
}

let sidecarPort = null;
function startSidecar() {
  sidecarPort ??= (async () => {
    await ensureSessionSecret();
    const { createLocalApiServer } = await import(pathToFileURL(join(WM, 'local-api-server.mjs')).href);
    const app = await createLocalApiServer({
      mode: 'docker',
      port: 0,
      apiDir: join(WM, 'api'),
      resourceDir: WM,
      dataDir: '/tmp',
      cloudFallback: false,
    });
    const { port } = await app.start();
    return port;
  })().catch((error) => {
    sidecarPort = null;
    throw error;
  });
  return sidecarPort;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  // Routes in .vercel/output/config.json pass the original /api path here.
  const pathname = url.searchParams.get('__wm_path') || url.pathname;
  url.searchParams.delete('__wm_path');
  const search = url.searchParams.toString();

  // nginx: native management is never exposed through the public ingress.
  if (pathname.startsWith('/api/local-')) {
    res.writeHead(403, { 'origin-agent-cluster': '?1' });
    res.end();
    return;
  }

  let port;
  try {
    port = await startSidecar();
  } catch (error) {
    console.error('[wm-api] sidecar failed to start', error);
    sendJson(res, 503, { error: 'API unavailable' });
    return;
  }

  const headers = { ...req.headers };
  for (const name of HOP_BY_HOP) delete headers[name];
  headers.host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  headers['x-real-ip'] = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || '';
  headers['x-forwarded-proto'] = 'https';
  // Same as nginx: API-key checks treat proxied browser requests as local, and
  // the internal transport token stays out of the caller's Authorization.
  headers.origin = 'http://localhost';
  headers['x-worldmonitor-local-token'] = process.env.LOCAL_API_TOKEN;

  await new Promise((resolve) => {
    const upstream = http.request({
      host: '127.0.0.1',
      port,
      method: req.method,
      path: pathname + (search ? `?${search}` : ''),
      headers,
    }, (upstreamRes) => {
      const outHeaders = { ...upstreamRes.headers, 'origin-agent-cluster': '?1' };
      for (const name of HOP_BY_HOP) delete outHeaders[name];
      if (pathname === '/api/rss-proxy') {
        outHeaders['x-content-type-options'] = 'nosniff';
        outHeaders['content-security-policy'] = RSS_SANDBOX_CSP;
      }
      res.writeHead(upstreamRes.statusCode || 502, outHeaders);
      upstreamRes.pipe(res);
      upstreamRes.on('end', resolve);
      upstreamRes.on('error', resolve);
    });
    upstream.setTimeout(120_000, () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', (error) => {
      console.error('[wm-api] proxy error', pathname, error.message);
      if (!res.headersSent) sendJson(res, 502, { error: 'API request failed' });
      else res.end();
      resolve();
    });
    req.pipe(upstream);
  });
}
