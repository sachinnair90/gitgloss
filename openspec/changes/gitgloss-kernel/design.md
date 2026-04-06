## Context

gitgloss is a "Chassis-First" showcase catalog engine. Phase 1 (The Kernel) establishes the architectural skeleton that all future phases extend. There is no existing codebase — this is a greenfield build. The PRD mandates a hexagonal architecture with four ports; this phase wires the three null/minimal adapters needed to make the CLI work without any cloud infrastructure.

## Goals / Non-Goals

**Goals:**
- Establish the `src/core/` domain layer (schema, port interfaces, pure engine functions) with zero I/O side effects
- Deliver a working `FilesystemContentStoreAdapter` that reads `<slug>.md` files, validates them with Zod, and never derives identity from filenames
- Deliver typed no-ops (`NullSocialAdapter`, `NullEditorAdapter`) so the system can run without external dependencies
- Deliver a one-shot CLI harness (`gitgloss search`) that proves the core works end-to-end
- Achieve 100% unit test coverage of the core pure functions and adapter contract surface

**Non-Goals:**
- No web UI (Astro, ShadCN — deferred to Phase 2)
- No cloud deployment (Azure SWA — deferred to Phase 2)
- No GitHub API adapter (deferred to Phase 3)
- No social features, auth, or write path (deferred to Phase 4 / Version C)
- The CLI is a dev harness only — not packaged, not published to npm

## Decisions

### D1: Hexagonal architecture from day 1

**Decision:** Define three Phase 1 port interfaces in `src/core/ports/` before writing any adapter: `CatalogQueryPort` (primary/driving), `ContentStorePort` (secondary/read), `EditorPort` (secondary/write).

**Rationale:** Forces a clean dependency direction — core never imports adapters. The two-sided hexagon is explicit: the driving side (`CatalogQueryPort`) is what CLI and Astro call; the driven side (`ContentStorePort`, `EditorPort`) is what the core calls. Any future adapter just satisfies the same TypeScript interface. `RankingPort` and `SocialWritePort` are defined when Version C is built — adding ports only when there is a concrete adapter to implement them avoids speculative abstraction. Alternatives considered: starting with a concrete `fs` implementation and extracting the interface later. Rejected because retrofitting interfaces onto concrete code consistently results in leaky abstractions.

### D2: UUID as stable identity anchor; slug as filename

**Decision:** Files are named `<slug>.md`. UUID lives in frontmatter. `FilesystemContentStoreAdapter` always reads UUID from frontmatter — never derives identity from the filename.

**Rationale:** Keeps Git history human-readable while allowing slug renames without orphaning future social data (Version C shadow cache deduplication key is `id`, not `slug`). Alternatives considered: UUID as filename (unreadable Git history), slug as primary key (rename breaks social linkage). Both rejected.

### D3: Fuse.js for fuzzy search in the core engine

**Decision:** Use Fuse.js for fuzzy matching in the `search()` pure function.

**Rationale:** Fuse.js is zero-dependency on the client side (relevant for Phase 2 browser search island), runs in Node.js for Phase 1 CLI, and has a deterministic, testable API. Alternatives: hand-rolled trigram search (more code, no gain), MiniSearch (similar, less usage). Fuse.js chosen for consistency between CLI (Phase 1) and browser island (Phase 2).

### D4: gray-matter for frontmatter parsing

**Decision:** Use `gray-matter` to parse YAML frontmatter from `.md` files.

**Rationale:** De-facto standard, well-tested, supports YAML and TOML out of the box. No build step required. Alternatives: `js-yaml` (manual splitting of frontmatter block), `vfile` (heavier, remark-ecosystem). `gray-matter` is the simplest fit.

### D5: vitest for testing

**Decision:** Use `vitest` as the test runner.

**Rationale:** Native TypeScript support without `ts-jest` configuration overhead. Fast watch mode. Compatible with Astro's test setup in Phase 2. Alternatives: Jest (requires `ts-jest` transform config). Vitest chosen for zero-config TypeScript.

### D6: commander for CLI argument parsing

**Decision:** Use `commander` to parse CLI arguments in `src/cli/index.ts`.

**Rationale:** Zero runtime dependencies beyond Node.js standard library. Widely used, stable API. Alternatives: `yargs` (heavier), `minimist` (manual help text). Commander is the simplest fit for a one-shot command with 3–4 flags.

### D7: Null adapters are first-class production options

**Decision:** `NullEditorAdapter` is not a test stub — it is a valid production adapter. It is named `Null*` (not `Mock*` or `Stub*`) to reflect this.

**Rationale:** A Version A deployment (private showcase) genuinely needs no write capability. Naming it `Mock` would imply it belongs only in tests, which is incorrect. No `NullSocialAdapter` is created in Phase 1: social read data (like counts, comments) is the web presentation adapter's responsibility and is never routed through the core; `SocialWritePort` (with its `NullSocialWriteAdapter`) is a Version C concern.

### D8: CatalogQueryPort is the primary (driving) port

**Decision:** Define `CatalogQueryPort` as the primary port with a single method `search(query: Query): Promise<QueryResult>`. All primary adapters (CLI, Astro, tests) depend on this interface — never on engine functions directly. The `CatalogService` class in `src/core/` implements it.

**Rationale:** Without an explicit primary port, the CLI would call engine pure functions directly, making the driving side asymmetric and harder to test in isolation. `CatalogQueryPort` gives the hexagon a formal contract on both sides. Alternatives considered: making the CLI call `listItems` on `ContentStorePort` directly. Rejected because it bypasses the application orchestration layer (search + filter + sort composition), leaks infrastructure knowledge into the CLI, and makes the architecture asymmetric.

### D9: SocialPort is not defined in Phase 1

**Decision:** No `SocialPort` is defined in Phase 1. Social engagement is split across two future ports — `RankingPort` (scoring items for sort, Version C+) and `SocialWritePort` (likes/comments write commands, Version C+) — and social read display is handled by the web presentation adapter independently.

**Rationale:** The original `SocialPort` conflated two distinct concerns: display augmentation (read counts for rendering) and domain commands (addLike, addComment with business rules). Display augmentation does not belong in the core — the Astro adapter fetches and merges it at the template level. Domain commands with business rules belong in `SocialWritePort`. Ranking signals belong in `RankingPort` so that new signals (downloads, views) require only a new adapter, not a core change. Defining either port now, before a concrete adapter exists, would be speculative abstraction.

## Risks / Trade-offs

- **[Risk] Zod schema version drift** — If the `.md` frontmatter drifts from the Zod schema, the filesystem adapter will silently drop items. Mitigation: `safeParse` with explicit logging of all validation failures; fixture tests cover every field.

- **[Risk] Fuse.js result ordering is non-deterministic for equal-score items** — Sort stability depends on input order. Mitigation: secondary sort (e.g., by `createdAt` DESC) applied after Fuse.js scoring in `sort()`.

- **[Risk] gray-matter parses YAML booleans as strings in some edge cases** — `featured: false` may parse as the string `"false"`. Mitigation: Zod coercion (`z.coerce.boolean()`) on the `featured` field; test with both `true` and `false` frontmatter values.

- **[Trade-off] CLI is not packaged** — The Phase 1 CLI is invoked via `npx tsx src/cli/index.ts` or an npm script, not installed globally. This is intentional (dev harness only), but means it cannot be used standalone until Phase 2+ packaging decisions are made.

## Migration Plan

Phase 1 is greenfield — no migration required. The only sequencing constraint is:
1. Define port interfaces and schema first (tasks 1.1–1.3)
2. Implement core engine against those contracts (task 1.4)
3. Implement filesystem adapter (task 1.5)
4. Implement null adapters (task 1.6)
5. Wire CLI (task 1.7)
6. Add fixtures and tests last (tasks 1.8–1.9)

Rollback: delete `src/` and `content/catalog/` — no persistent state is created.

## Open Questions

- None — all design decisions are locked in per the PRD exploration session. Phase 2 (Astro web UI) will introduce new questions around build tooling and SWA deployment.
