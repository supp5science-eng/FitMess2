# Handoff: F020 — Foods schema + RLS

## Status
COMPLETE

## Assertions covered
AS-032: PASS — `foods` stores name_sr, brand, per-100g macros (kcal/protein/carbs/fat_100g), common_units (jsonb), source, verified, and an optional unique barcode. Verified both statically (`foods-logs-schema.test.ts`) and live (`foods-logs-rls.integration.test.ts`, `test_AS_032_a_food_record_round_trips_...` — real insert + re-read against the live Supabase project confirms every field round-trips).
AS-057: PASS — inserting a second `foods` row with an already-used barcode is rejected. Live-verified: `test_AS_057_inserting_a_second_food_with_an_already_used_barcode_is_rejected` gets a real Postgres `23505` (unique_violation) from the live project, and a companion test confirms two rows with `barcode = null` are both allowed (nulls don't collide, per SQL UNIQUE semantics).

## Files changed
supabase/migrations/0004_foods_logs.sql
src/lib/types/db.ts
src/lib/export/user-data.ts
src/lib/export/__tests__/user-data.test.ts
src/lib/supabase/__tests__/foods-logs-schema.test.ts
src/lib/supabase/__tests__/foods-logs-rls.integration.test.ts

## Commands run
`npm run typecheck` (0)
`npm run lint` (0)
`npm run test` (0) — 406 passed, 12 skipped (pre-existing degrade-gracefully diagnostic branches for other features whose live preconditions aren't met in this session; none of the 12 are F020's)
`npm run build` (0)
Management API `POST /v1/projects/{ref}/database/query` applying `0004_foods_logs.sql` (status 201, empty result — success)
Management API `POST /v1/projects/{ref}/database/query` running verification SELECTs against `information_schema.tables/columns`, `pg_class.relrowsecurity`, `pg_policies`, `pg_constraint`, `pg_extension` (all 201, all matched the migration exactly — see Decisions made)

## Decisions made
- **Migration applied live via the Supabase Management API** (`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, `SUPABASE_ACCESS_TOKEN` bearer), per `mcp-registry.md`'s documented workaround (`mcp__supabase__*` tools are not bound inside worker subagents). Verified afterward with follow-up SELECTs against the same endpoint:
  - `information_schema.tables`: `foods`, `logs` both present in `public`.
  - `information_schema.columns`: every AS-032 column present on `foods` with the right nullability/defaults (`kcal_100g`/`protein_100g`/`carbs_100g`/`fat_100g` numeric not-null default 0; `common_units` jsonb not-null default `'[]'`; `source` not-null default `'user'`; `verified` boolean not-null default false; `barcode`/`brand`/`submitted_by`/`label_photo_path` all nullable).
  - `pg_class.relrowsecurity`: true for both `foods` and `logs`.
  - `pg_policies`: `foods` has exactly 2 policies (`foods_select_all_authenticated` SELECT, `foods_insert_authenticated` INSERT) and **no** UPDATE/DELETE policy (admin-only, confirmed absent); `logs` has exactly 4 own-row policies (select/insert/update/delete).
  - `pg_constraint`: `foods_barcode_key` is a genuine `UNIQUE (barcode)` constraint; FKs are `foods.submitted_by → auth.users(id) ON DELETE SET NULL`, `logs.food_id → foods(id) ON DELETE SET NULL`, `logs.user_id → auth.users(id) ON DELETE CASCADE` — exactly as specified.
  - `pg_extension`: `pg_trgm` and `unaccent` both present.
- **Macro columns (`kcal_100g` etc.) made `not null default 0`** rather than nullable, per the clarified "Validation: NOT NULL / CHECK / FK constraints... enforce integrity" answer — every food record always has a well-defined (possibly zero, for not-yet-enriched entries) macro value rather than `null` propagating into downstream budget math. `check (>= 0)` on each.
- **`foods` insert policy scopes `submitted_by` to the caller** (`with check (submitted_by is null or submitted_by = auth.uid())`) rather than a blanket `with check (true)` — allows the clarified "crowd-sourcing" insert-by-authenticated behaviour while still preventing one user from forging another's id as submitter. Not explicitly required by the spec text but directly serves the same "no cross-user forgery" posture as every other own-row policy in this schema.
- **No UPDATE/DELETE policy at all on `foods`** (rather than a restrictive `using (false)` policy) — matches the clarified "admin-only (via createAdminClient, no permissive policy)" instruction literally; the admin client bypasses RLS entirely via the service-role key, so no policy is needed or wanted here.
- **Narrowed `USER_OWNED_TABLES`'s `table` field type** in `src/lib/export/user-data.ts` from `keyof Database["public"]["Tables"]` to a new `TableWithUserId` mapped/conditional type (only tables whose Row includes `user_id`). Necessary fix, in scope of the explicit "wire logs into the export" task: adding `foods` to `Database` (which has no `user_id` column) widened the union TS computes `keyof` over inside the loop's `.eq(config.userColumn, ...)` call to the INTERSECTION of all four tables' keys, which no longer included `"user_id"` — this broke `npm run typecheck` until narrowed. No behavioural change, compile-time only.
- **`foods` is deliberately NOT added to `USER_OWNED_TABLES`** — it is shared catalog data, not personal data (see clarified spec + task instructions). Documented inline in `user-data.ts` and covered by a dedicated unit test (`test_F020_foods_shared_catalog_table_is_never_part_of_the_per_user_export`) that would fail loudly (via the mock's `from()` throwing on an unrecognized table) if a future change ever wired it in by mistake.
- **Did not modify `src/lib/account/delete-account.ts`.** Its `cleanupResidualRows` "defense in depth" pattern only re-checks `profiles`/`targets` (tables that existed when F019 was built); `logs`'s `ON DELETE CASCADE` and `foods.submitted_by`'s `ON DELETE SET NULL` are both proven live by this feature's own integration test (`test_deleting_the_user_cascades_their_logs_but_anonymizes_not_deletes_their_submitted_foods`) without needing any code change — `deleteAccount`'s single `admin.auth.admin.deleteUser` call is what triggers both FK behaviours transactionally, exactly as F019 intended. Extending `cleanupResidualRows` to also defensively re-check `logs`/`foods` would be a reasonable follow-up but is out of this feature's `Touches` scope (schema + db.ts + the explicitly named export wiring only).
- **Migration numbered `0004`** (not the draft scope's `0002`) — `0002`/`0003` are already taken by F011 (`0002_profiles_on_signup.sql`) and F017 (`0003_eating_rules.sql`), which landed after the draft scope was written; `0004` is the correct next sequential number in the repo as found.

## Out-of-scope work needed
- F021 (seed foods) / F022 (Open Food Facts import) / F023 (search, needs the pg_trgm/unaccent extensions this migration enabled) / F024 (common-unit portion UI) / F025+ (log entry UI/API) all build on this schema but are separate features, not touched here.
- `src/lib/account/delete-account.ts`'s `cleanupResidualRows` could optionally be extended to also defensively re-check `logs` (and confirm `foods.submitted_by` anonymization) post-delete, mirroring its existing `profiles`/`targets` checks — not done here since the FK-level guarantee is already live-verified and `Touches` didn't call for touching that file; a future worker touching account deletion again could fold this in.
- No admin UI/API yet exists for the "admin-only update/delete" on `foods` (F033-area scope) — this feature only establishes the RLS posture that makes that safe to build later.

## Blockers
(none — Status is COMPLETE)

## Autonomous decisions
AUTONOMOUS_DECISION: Made `foods`' four per-100g macro columns `not null default 0` (with `check (>= 0)`) rather than nullable, since the clarified spec didn't specify nullability for them and "NOT NULL / CHECK ... enforce integrity" was the clarified validation answer — a food record with `null` macros would be a landmine for downstream budget math (M4), so defaulting to `0` (editable/enrichable later, e.g. by F022's OFF import or admin review) was chosen as the safer default.
AUTONOMOUS_DECISION: Added a `with check (submitted_by is null or submitted_by = auth.uid())` constraint to the `foods` INSERT policy instead of a blanket `with check (true)`. The clarified spec only says "INSERT allowed by authenticated (crowd-sourcing)" without specifying whether submitted_by must match the caller; scoping it to the caller (or null) prevents one user from forging another's id as submitter while still satisfying "any authenticated user can insert."

## Notes for the next worker
- Migration applied and verified live in this session (project ref taken from `.env`'s `SUPABASE_PROJECT_REF`) — `public.foods` and `public.logs` are reachable now, so any future worker's `describe.skipIf(!hasCredentials || !schemaReady)` live tests touching these tables should run their real assertions rather than hit the diagnostic-skip branch (assuming credentials are still resolvable in their session).
- `src/lib/supabase/__tests__/foods-logs-rls.integration.test.ts` follows the exact same "preflight + `describe.skipIf`" degrade-gracefully pattern as F010's `profiles-rls.integration.test.ts` and F019's `route.integration.test.ts` — read that file's header comment if you need the rationale again.
- `FoodCommonUnit`, `FoodSource`, `LogMethod`, `Food`/`FoodInsert`/`FoodUpdate`, `Log`/`LogInsert`/`LogUpdate` are all now exported from `src/lib/types/db.ts` for F021+ to import directly.
- Reminder for whoever builds F023 (search): `pg_trgm`/`unaccent` are enabled (schema `extensions`) but no trigram index exists yet on `foods.name_sr` — that's F023's job, not this one's.
- MCP note: per `mcp-registry.md`, `mcp__supabase__*` tools are NOT bound inside worker subagents (confirmed again this session — no such tools were available). All live DB work went through the Management API SQL endpoint with `fetch`, exactly as the registry instructs.
