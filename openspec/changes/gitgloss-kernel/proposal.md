## Why

The gitgloss engine needs a verified, testable core before any UI or cloud infrastructure is built. Phase 1 lays the "chassis" — pure domain logic, port interfaces, a filesystem adapter, and a one-shot CLI harness — so every subsequent phase builds on a foundation that has already been proven correct in isolation.

## What Changes

- New TypeScript monorepo scaffold with `src/core/`, `src/adapters/`, `src/cli/` layout
- New Zod-validated domain schema (`CatalogItem`, `Author`, `Query`, `QueryResult`)
- New port interface definitions for three Phase 1 ports: `CatalogQueryPort` (primary/driving), `ContentStorePort` (secondary/read-only), `EditorPort` (secondary/write). `RankingPort` and `SocialWritePort` are deferred to Version C.
- New `CatalogService` — application service implementing `CatalogQueryPort`; the single orchestration point between the CLI/web adapter and the core engine
- New pure-function core engine: `search()`, `filter()`, `sort()`
- New `FilesystemContentStoreAdapter` — reads `<slug>.md` files, parses YAML frontmatter, validates with Zod, uses UUID (never filename) for identity. `ContentStorePort` is read-only; all writes belong to `EditorPort`.
- New `NullEditorAdapter` — typed no-op satisfying `EditorPort`; enables read-only deployments. No `NullSocialAdapter` required in Phase 1 — social reads are a presentation-layer concern and `SocialWritePort` is deferred to Version C.
- New `gitgloss search` CLI primary adapter — one-shot command that calls the core through `CatalogQueryPort` and prints results to stdout
- New sample fixture `.md` catalog files (10+) covering all statuses and multi-author entries
- New unit tests: core pure functions, Zod schema validation, adapter contract tests

## Capabilities

### New Capabilities

- `catalog-schema`: Zod-validated domain model — `CatalogItem` (id, slug, title, description, authors, tags, image, createdAt, updatedAt, status, featured), `Author` sub-type, `Query` and `QueryResult` types
- `port-interfaces`: TypeScript interfaces for three Phase 1 ports — `CatalogQueryPort` (primary/driving: the entry point CLI and Astro call), `ContentStorePort` (secondary/read-only: catalog data access), `EditorPort` (secondary/write: all catalog writes) — residing in `src/core/ports/`. `RankingPort` and `SocialWritePort` are deferred to Version C.
- `core-search-engine`: Pure functions with no I/O side effects — `search()` (Fuse.js fuzzy on title/description/tags), `filter()` (by status/tags/featured), `sort()` (by createdAt/updatedAt/title)
- `filesystem-adapter`: `FilesystemContentStoreAdapter` implementing `ContentStorePort` (read-only) — scans a directory for `<slug>.md` files, parses gray-matter frontmatter, validates with the Zod schema, exposes `readItem(id)`, `findBySlug(slug)`, `listItems(query?)`
- `null-adapters`: `NullEditorAdapter` — compile-time-safe no-op for `EditorPort`; enables the site to run read-only with zero write infrastructure
- `cli-search`: `gitgloss search <query> [--tags tag1,tag2] [--status published] [--sort date]` — one-shot Node.js CLI primary adapter that calls the core through `CatalogQueryPort` and prints results to stdout; not packaged externally; used as a dev harness only in this phase

### Modified Capabilities

<!-- None — this is the initial implementation; no existing specs exist -->

## Impact

- **New runtime dependencies:** `zod`, `gray-matter`, `fuse.js`, `commander` (or similar CLI argument parser)
- **New dev dependencies:** `typescript`, `vitest`, `tsx` (or `ts-node`)
- **New files:** `src/core/domain/schema.ts`, `src/core/ports/*.ts`, `src/core/engine/*.ts`, `src/core/CatalogService.ts`, `src/adapters/filesystem/FilesystemContentStoreAdapter.ts`, `src/adapters/null/NullEditorAdapter.ts`, `src/cli/index.ts`
- **New content:** `content/catalog/*.md` (10+ sample fixture files)
- **No existing code affected** — this is a greenfield phase
