---
name: TypeScript strict mode fix
about: Track work to fix TypeScript strict mode errors in a file or area
---

**File(s):**

**Approx. error count (strict):**

**Primary error codes (e.g. TS4111, TS18048):**

## Checklist

- [ ] Fix TS4111 (bracket notation / narrow `Record<string, unknown>` usage)
- [ ] Fix TS18048 / TS2532 (undefined checks, `noUncheckedIndexedAccess`)
- [ ] Fix TS6133 (remove unused or prefix with `_`)
- [ ] Fix TS2375 / TS2379 (`exactOptionalPropertyTypes` — omit optional props instead of `undefined`)
- [ ] Run `npm run typecheck:strict` locally for touched paths
- [ ] Run `npm run typecheck` (standard) — must stay green
- [ ] Update `docs/TYPESCRIPT_IMPROVEMENT.md` progress table

## Notes

Paste a short excerpt of `npm run typecheck:strict` output for this area, or link a PR.
