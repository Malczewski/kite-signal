import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDynamoDocumentClient, SpotRepository } from '@kite-signal/db';
import type { SpotRecord } from '@kite-signal/db';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const spotsDir = path.join(dirname, 'spots');

function loadSpots(): SpotRecord[] {
  return readdirSync(spotsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(path.join(spotsDir, file), 'utf-8')) as SpotRecord);
}

async function main() {
  const tableName = process.env.SPOTS_TABLE_NAME;
  if (!tableName) {
    throw new Error(
      'SPOTS_TABLE_NAME env var is required (see `terraform output spots_table_name` in infra/envs/prod)',
    );
  }

  const repo = new SpotRepository(createDynamoDocumentClient(), tableName);
  const spots = loadSpots();

  if (spots.length === 0) {
    console.log(`No spot JSON files found in ${spotsDir} — nothing to seed. See spot-data/README.md.`);
    return;
  }

  for (const spot of spots) {
    console.log(`Seeding ${spot.spotId} (${spot.name})...`);
    await repo.put(spot);
  }
  console.log(`Seeded ${spots.length} spot(s) into ${tableName}.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
