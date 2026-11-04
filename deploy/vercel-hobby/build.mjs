// Builds the original World Monitor app for a Vercel Hobby-plan project.
//
// Hobby allows 12 Serverless Functions per deployment; the app has one per
// file in api/ (175). This build writes Vercel's Build Output API directly
// (.vercel/output), so the deployment contains:
//   - static/: the same dist/ that `npm run build:fork` produces at the root;
//   - functions/api/wm.func: ONE function that serves every /api/* route
//     through the Docker image's sidecar (see function/index.mjs);
//   - config.json: the root vercel.json redirects, rewrites and headers,
//     translated by Vercel's own @vercel/routing-utils, then /api/* to wm.func.
// Set the Vercel project's Root Directory to deploy/vercel-hobby.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTransformedRoutes } from '@vercel/routing-utils';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const out = join(here, '.vercel', 'output');
const func = join(out, 'functions', 'api', 'wm.func');

const run = (command) => {
  console.log(`\n[vercel-hobby] ${command}`);
  execSync(command, { cwd: root, stdio: 'inherit', env: process.env });
};

// 1. Frontend, exactly as the root project builds it.
run('npm run build:fork');

// 2. API handlers compiled to .js beside their sources, as the Docker image
//    does (Dockerfile: generate-inventory-facts, then docker/build-handlers).
run('node scripts/generate-inventory-facts.mjs');
run('node docker/build-handlers.mjs');

// 3. Build Output API.
rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'dist'), join(out, 'static'), { recursive: true });

mkdirSync(func, { recursive: true });
cpSync(join(here, 'function', 'index.mjs'), join(func, 'index.mjs'));
cpSync(join(root, 'src-tauri', 'sidecar', 'local-api-server.mjs'), join(func, 'local-api-server.mjs'));
cpSync(join(root, 'src-tauri', 'sidecar', 'package.json'), join(func, 'package.json'));
mkdirSync(join(func, 'shared'), { recursive: true });
cpSync(join(root, 'shared', 'llm-health-providers.js'), join(func, 'shared', 'llm-health-providers.js'));
cpSync(join(root, 'data'), join(func, 'data'), { recursive: true });
cpSync(join(root, 'api'), join(func, 'api'), {
  recursive: true,
  // The sidecar loads the compiled .js handlers; sources and tests stay out.
  filter: (src) => !/\.(ts|mts|cts)$/.test(src) && !/\.test\.[cm]?js$/.test(src),
});
cpSync(join(here, 'node_modules'), join(func, 'node_modules'), {
  recursive: true,
  filter: (src) => !/node_modules[\\/](\.bin|@vercel)(?:[\\/]|$)/.test(src),
});
writeFileSync(join(func, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs24.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  maxDuration: 60,
}, null, 2));

const rootConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const { routes, error } = getTransformedRoutes({
  redirects: rootConfig.redirects,
  rewrites: rootConfig.rewrites,
  headers: rootConfig.headers,
});
if (error) throw new Error(`vercel.json routing could not be translated: ${error.message}`);
routes.push({ src: '^/api(?:/(.*))?$', dest: '/api/wm?__wm_path=/api/$1' });
writeFileSync(join(out, 'config.json'), JSON.stringify({ version: 3, routes }, null, 2));

console.log(`\n[vercel-hobby] wrote ${out}: ${routes.length} routes, 1 function`);
