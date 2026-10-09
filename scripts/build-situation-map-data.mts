// Regenerates apps/situation-map/data/layers.json from World Monitor's curated
// map datasets so the standalone situation map stays in step with the app.
// Run: npx tsx --tsconfig tsconfig.json scripts/build-situation-map-data.mts
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFLICT_ZONES, INTEL_HOTSPOTS, STRATEGIC_WATERWAYS } from '../shared/geo-data';
import { PIPELINES } from '../shared/pipelines-data';
import { AI_DATA_CENTERS } from '../src/config/ai-datacenters';
import { ECONOMIC_CENTERS, NUCLEAR_FACILITIES, SANCTIONED_COUNTRIES, SPACEPORTS, UNDERSEA_CABLES } from '../src/config/geo-map';
import { MILITARY_BASES } from '../src/config/military-bases';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'apps', 'situation-map', 'data', 'layers.json');
const layers = {
  CONFLICT_ZONES, INTEL_HOTSPOTS, STRATEGIC_WATERWAYS, UNDERSEA_CABLES, NUCLEAR_FACILITIES,
  ECONOMIC_CENTERS, SPACEPORTS, SANCTIONED_COUNTRIES, MILITARY_BASES, PIPELINES, AI_DATA_CENTERS,
};
writeFileSync(out, `${JSON.stringify(layers)}\n`);
console.log(`wrote ${out}`);
