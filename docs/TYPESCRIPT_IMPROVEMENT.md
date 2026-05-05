# TypeScript strict mode progress

## Goal

Drive **`tsconfig.strict.json`** (extra checks: `noUnusedLocals`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, etc.) down to **zero** errors for safer refactors and fewer production surprises.

## Current status

| Mode | Command | Status |
|------|-----------|--------|
| **Standard** | `npm run typecheck` | **0 errors** (required for merge) |
| **Strict** | `npm run typecheck:strict` | **~629 errors** (see `npm run typecheck:count`) — informational in CI until green |

## Progress tracking

| Date | Strict errors (approx.) | Notes |
|------|---------------------------|--------|
| 2026-05-05 | 699 | Baseline (full strict project check) |
| 2026-05-05 | ~629 | After `lib/infloww-api.ts` TS4111 / bracket + related strict fixes in that file |

Update this table when you chip away at **`typecheck:strict`**.

## Top offenders (next targets)

Work down the list from `npm run typecheck:strict` output (counts move as files are fixed):

1. `lib/infloww-api.ts` — **TS4111 cleared** for this file; keep file clean under strict as you touch it.
2. `services/weekly-availability-requests.ts` — many TS4111 (index signatures on Airtable-shaped records).
3. `lib/weekly-program-conflicts.ts` — same pattern.
4. `services/weekly-program.ts` / `services/weekly-program-va.ts` — index access + unused params (TS6133).
5. `services/shifts.ts`, `components/notification-center-content.tsx`, etc.

## Error types (typical mix)

| Code | Meaning | Mitigation |
|------|---------|------------|
| **TS4111** | Dot access on index signature | Use `obj['key']` or narrow types |
| **TS18048** / **TS2532** | Possibly `undefined` | Guards, `?.`, or asserted bounds after validation |
| **TS6133** | Unused locals/parameters | Remove or `_prefix` |
| **TS2375** / **TS2379** | `exactOptionalPropertyTypes` | Omit optional keys instead of assigning `undefined` |
| **TS2322** | Assignability | Fix types at the boundary |

## CI

- **GitHub Actions:** `.github/workflows/typecheck.yml` runs **`npm run typecheck`** on every push/PR to `main`; strict run is **non-blocking** with log artifact.
- **Pre-commit (optional):** Husky runs **`npm run typecheck`** before commit.

## Commands

```bash
npm run typecheck          # must pass
npm run typecheck:strict   # strict overlay; fix over time
npm run typecheck:count    # print count of "error TS" lines from strict run
```
