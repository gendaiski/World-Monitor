// Upstream-operations workflows probe, deploy to or publish from koala73's
// production infrastructure. In this fork they have no secrets or targets, so
// each entry job is gated on the upstream repository and skips here instead of
// failing on every schedule and push.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const UPSTREAM_ONLY = [
  'analytics-collector-monitor', 'build-desktop', 'china-decision-parity-live', 'convex-deploy',
  'crawlable-pulse-refresh', 'deploy-railway-reconcile-control', 'deploy-worker', 'desktop-release-train',
  'docker-publish', 'github-stars-refresh', 'indexnow-submit', 'live-api-cache-auth', 'live-video-source-audit',
  'mcp-live-smoke', 'mcp-preset-liveness', 'openrouter-free-models-live', 'perf-style-layout-budget',
  'postmerge-deploy-monitor', 'publish-cli', 'publish-go', 'publish-mcp-registry', 'publish-python',
  'publish-ruby', 'pulse-freshness-monitor', 'railway-deploy-drift', 'railway-registry-sync',
  'resilience-snapshot-refresh', 'seed-freshness-monitor', 'sentry-resolve-pin-audit', 'seo-gsc-weekly',
  'test-linux-app', 'tps-open-data-live', 'umami-storage-monitor',
];
const GUARD = "github.repository == 'koala73/worldmonitor'";

describe('fork guard on upstream-operations workflows', () => {
  for (const name of UPSTREAM_ONLY) {
    it(`${name}.yml entry jobs run only in the upstream repository`, () => {
      const workflow = YAML.parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));
      const entryJobs = Object.entries(workflow.jobs).filter(([, job]) => job.needs === undefined);
      assert.ok(entryJobs.length > 0);
      for (const [jobName, job] of entryJobs) {
        assert.ok(String(job.if ?? '').includes(GUARD), `${name}.yml job "${jobName}" must be gated on ${GUARD}`);
      }
    });
  }
});
