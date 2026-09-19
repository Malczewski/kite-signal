# spot-data

The curated kitesurf spot knowledge base, as source-controlled JSON — one file per spot in
`spots/`, reviewed like any other code change via PR. `seed.ts` upserts everything here into
the `Spots` DynamoDB table.

This is deliberately not an admin UI (see "Deferred items" in `docs/architecture-plan.md`):
adding/editing a spot is a JSON edit + PR, not a form submission.

## Schema

Each `spots/<spot-id>.json` file is a `SpotRecord` (see
`packages/db/src/types.ts` / `packages/domain/src/types.ts`):

```jsonc
{
  "spotId": "nin-croatia",       // unique, kebab-case, matches the filename
  "name": "Nin",
  "country": "HR",                // ISO 3166-1 alpha-2
  "lat": 44.2397,
  "lon": 15.1808,
  "active": true,
  "timezone": "Europe/Zagreb",    // IANA name; used to render forecast times in local time

  // Optional curated links shown alongside notifications (Windy, Windguru, Windfinder, webcams,
  // etc.) - populate with whatever's useful for the spot, omit the field if there's none yet.
  "externalLinks": [
    { "label": "Windy", "url": "https://www.windy.com/44.2397/15.1808?wind" }
  ],

  // Wind direction ranges in degrees (0-360). May wrap across 0/360, e.g. [300, 30].
  "idealWindDirRange": [200, 250],
  "usableWindDirRange": [180, 270],
  "dangerousWindDirRanges": [[0, 90]],   // list of ranges; offshore/hazardous directions

  "minWindKts": 12,
  "idealWindKts": [18, 24],
  "maxWindKts": 35,
  "gustToleranceKts": 6,           // max acceptable gust-over-sustained delta

  "seasonalityMonths": [5, 6, 7, 8, 9],  // optional; omit if the spot works year-round
  "skillLevel": "intermediate"      // "beginner" | "intermediate" | "advanced"
}
```

**Getting the wind-direction/hazard numbers right matters far more than getting them in
quickly** — `dangerousWindDirRanges` in particular directly drives whether the system will
ever recommend a genuinely unsafe session. Only add a spot once you (or a source you trust,
e.g. KiteSpotFinder / local kiter knowledge) are confident about these numbers; a placeholder
guess is worse than not having the spot at all.

## Seeding

Requires AWS credentials configured locally (see `docs/manual-setup.md`) and the `Spots`
table already deployed:

```sh
export SPOTS_TABLE_NAME=$(terraform -chdir=../infra/envs/prod output -raw spots_table_name)
npm run seed --workspace=@kite-signal/spot-data
```

Re-running is safe — `seed.ts` does a full upsert (`PutItem`) per spot file, so editing a JSON
file and re-seeding just updates that spot's record.
