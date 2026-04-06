# Master Specification: The Universal Showcase Engine

## 1. Product Vision

To provide a production-grade, infinitely portable catalog system that uses Git as a primary database. This is a "Chassis-First" build: a robust core for searching and filtering that can have social features or administrative UIs "plugged in" as needed.

## 2. The Atomic Core (The Kernel)

The "Heart" of the software is a pure, logic-only engine. It does not know about the web, Azure, or Markdown. It is a Queryable Collection.

- **Input:** An array of Objects and a Query object (filters, search string, sort key).
- **Logic:** Pure functions for fuzzy matching (Discovery), multi-criteria sorting, and category intersection.
- **Output:** A transformed subset of data.

## 3. Hexagonal Architecture (Ports & Adapters)

The application is "Infrastructure-Blind." The hexagon has two sides:

- **Primary (Driving) side** — external actors (CLI, web UI, tests) call into the core through primary ports.
- **Secondary (Driven) side** — the core calls out to infrastructure through secondary ports.

Dependency arrows always point inward: adapters depend on ports, ports depend on the core. The core imports nothing from adapters.

### 3.1 CatalogQueryPort (Primary / Driving)

The single entry point into the core. All primary adapters depend on this interface — never on engine functions directly.

- **Adapter A (CLI):** One-shot terminal command. Dev harness for Phase 1; not packaged or distributed.
- **Adapter B (Astro/Next.js):** Build-time and runtime web catalog. Phase 2+.
- **Adapter C (Test Suite):** Vitest integration tests drive the core through this port.

### 3.2 ContentStorePort (Secondary / Read)

Read-only catalog data access. The core calls this to retrieve items. Write operations are handled exclusively by `EditorPort`.

- **Adapter A (Filesystem):** Reads `<slug>.md` files from disk. Version A.
- **Adapter B (GitHub API):** Fetches files from a GitHub repository via REST API. Version B/C.
- **Adapter C (Mock):** Hardcoded array for unit testing.

### 3.3 EditorPort (Secondary / Write)

All catalog write operations. The core calls this when content must be created or updated. Owns `writeItem` exclusively — `ContentStorePort` is read-only.

- **Adapter A (Git-Direct):** Commits directly to the main branch via API.
- **Adapter B (Git-PR):** Opens a Pull Request for manual curation.
- **Adapter C (Null):** No-op. The site is read-only; content is managed externally.

### 3.4 RankingPort (Secondary / Scoring — Version C+)

Scores a set of items against a query using engagement signals. The core calls this to apply social or metric-based ranking. Returns items with a `_score` attached. Adding a new ranking signal (downloads, views) requires only a new adapter — not a core change.

- **Adapter A (Null):** Returns items unscored. Default for Versions A and B.
- **Adapter B (Social):** Scores by likes and comment activity. Version C.
- **Adapter C (Composite):** Combines multiple signals (social + downloads + views) with configurable weights. Future.

### 3.5 SocialWritePort (Secondary / Commands — Version C+)

Accepts social write commands (likes, comments) that carry domain-level business rules: rate limiting, auth requirements, item existence checks.

- **Adapter A (Null):** Silently no-ops. Versions A and B.
- **Adapter B (SQL):** Persists to Azure Cosmos DB for PostgreSQL. Version C.
- **Adapter C (Giscus):** Delegates to GitHub Discussions. Zero-database social.

> **Social reads** (displaying like counts, comments on a page) are handled by the web presentation adapter independently and are not routed through the core.

## 4. Configuration Matrix (The 4 Chassis)

By toggling adapters, you can deploy the same code in four distinct flavors:

| Configuration | Name              | ContentStore  | Editor   | Ranking        | SocialWrite | Use Case                                  |
| ------------- | ----------------- | ------------- | -------- | -------------- | ----------- | ----------------------------------------- |
| Version A     | The Local Vault   | Filesystem    | Null     | Null           | Null        | Private internal asset tracking.          |
| Version B     | The Pure Curator  | GitHub API    | Null     | Null           | Null        | High-quality, vetted "Awesome" lists.     |
| Version C     | The Resource Hub  | GitHub API    | Git-PR   | Social         | SQL         | Public community-driven catalogs.         |

## 5. Technical Implementation (Azure $0 Strategy)

To maintain a permanent $0.00/month footprint while remaining agnostic:

- **Hosting:** Azure Static Web Apps (Free Tier). *(All versions)*
- **Compute:** Azure Functions (Standard Node.js). *(Version C only — not required for Versions A or B)*
- **Database:** Azure Cosmos DB for PostgreSQL (Free Tier). *(Version C only — not required for Versions A or B)*
- **Portability Rule:** Use standard SQL and standard Node.js libraries (like Prisma ORM). Avoid proprietary Azure SDKs inside the Core.

## 6. The "Shadow Cache" Logic

> **Scope: Version C (Resource Hub) only.** The shadow cache is only relevant when the SQL Social adapter is active and a write path exists (community submissions). It is not part of Versions A or B and will be fully specified when Version C is built.

The mechanism (for reference): the frontend merges a static `catalog.json` (from Git) with a `fresh_items` set (from SQL) to surface community submissions before the Git build completes (~60–90s). Deduplication key: `id` (UUID). Full failure handling (retry, admin alerts) is deferred to Version C specification.

## 7. Data Schema (Zod Validation)

All items must conform to this schema to ensure the "Core" doesn't break:

```typescript
const Author = z.object({
  name: z.string(),
  email: z.string().email(),
});

const CatalogItem = z.object({
  id: z.string().uuid(),        // Stable identity anchor — social data links here (Version C)
  slug: z.string(),             // Human-readable URL path segment — matches the filename
  title: z.string().min(1),
  description: z.string().max(160),
  authors: z.array(Author),     // In-file provenance; no DB foreign keys in .md files
  tags: z.array(z.string()),
  image: z.string().optional(), // Repo-relative path e.g. /images/<uuid>.webp
  createdAt: z.string(),        // ISO 8601 — when the item was first added
  updatedAt: z.string(),        // ISO 8601 — when the item was last modified
  status: z.enum(['published', 'draft', 'archived']),
  featured: z.boolean().default(false),
});
```

### 7.1 File Naming Convention

Content files are named after their **slug** (`<slug>.md`), not their UUID. This keeps the Git repository human-readable at a glance. The UUID lives in frontmatter and serves as the stable identity anchor.

```
content/catalog/
  my-cool-tool.md              ← slug = filename = URL path segment
  vue-query-devtools.md
  astro-content-collections.md
```

A sample file:

```yaml
---
id: "550e8400-e29b-41d4-a716-446655440000"
slug: "my-cool-tool"
title: "My Cool Tool"
description: "A short description under 160 characters."
authors:
  - name: "Jane Smith"
    email: "jane@example.com"
tags: ["typescript", "cli"]
image: "/images/550e8400.webp"
createdAt: "2026-04-06T00:00:00Z"
updatedAt: "2026-04-06T00:00:00Z"
status: "published"
featured: false
---

Body content here...
```

If a slug is renamed, it is a `git mv` operation. The UUID in frontmatter is untouched, so any future social data (likes, comments in Version C) remains correctly linked.

### 7.2 ContentStore Port Interface

The `ContentStorePort` is the primary data access abstraction. All adapters (Filesystem, GitHub API) implement this interface. The core never reads files directly.

```typescript
// Primary port — what CLI, Astro, and tests call
interface CatalogQueryPort {
  search(query: Query): Promise<QueryResult>;
}

// Secondary port — read-only catalog data access
interface ContentStorePort {
  readItem(id: string): Promise<CatalogItem | null>;       // lookup by UUID
  findBySlug(slug: string): Promise<CatalogItem | null>;   // lookup for URL routing
  listItems(query?: Query): Promise<CatalogItem[]>;        // filtered/sorted listing
}
```

## 8. Operational Roadmap

### Phase 1 — "The Kernel" (Version A harness)

**Goal:** `gitgloss search "query"` returns correct sorted results from local `.md` files. No browser, no cloud.

| # | Task |
|---|------|
| 1.1 | TypeScript repo scaffold: `src/core/`, `src/adapters/`, `src/cli/` with tsconfig and vitest |
| 1.2 | Define 3 port interfaces for Phase 1: `CatalogQueryPort` (primary), `ContentStorePort` (secondary/read), `EditorPort` (secondary/write) in `src/core/ports/`. `RankingPort` and `SocialWritePort` are deferred to Version C. |
| 1.3 | Zod schema: `CatalogItem`, `Author`, `Query`, `QueryResult` in `src/core/domain/` |
| 1.4 | Core engine (pure functions): `search()` fuzzy on title/description/tags, `filter()` by status/tags/featured, `sort()` by createdAt/updatedAt/title |
| 1.5 | `FilesystemContentStoreAdapter`: scans `<slug>.md` files from a directory, parses frontmatter, validates with Zod, never uses filename for identity |
| 1.6 | `NullEditorAdapter`: typed no-op satisfying `EditorPort` |
| 1.7 | CLI Presenter: `gitgloss search <query> [--tags tag1,tag2] [--status published] [--sort date]` — one-shot command, prints results to stdout |
| 1.8 | Sample fixture `.md` files (10+) covering all status values and multi-author entries |
| 1.9 | Unit tests: core engine pure functions, Zod schema validation, adapter contract tests |

---

### Phase 2 — "The Window" (Version A complete)

**Goal:** Static site deployed to Azure SWA. Fuzzy search works in-browser. Data sourced from local `.md` files.

| # | Task |
|---|------|
| 2.1 | Init Astro (TypeScript, content collections) wired to core via `FilesystemContentStoreAdapter` |
| 2.2 | Add ShadCN + Tailwind; establish base layout, typography, and colour tokens |
| 2.3 | Build-time `search.json` generation: Astro build hook outputs all `published` items (id, slug, title, description, tags, authors, createdAt) |
| 2.4 | Catalog listing page: card grid, Fuse.js search island, tag filter panel |
| 2.5 | URL state persistence: search + filter state serialised to query params via History API, no full reload |
| 2.6 | Item detail page: routed by `slug`, UUID available in data, renders `authors` array |
| 2.7 | `staticwebapp.config.json` + Azure SWA deployment GitHub Actions workflow |
| 2.8 | `docker-compose.yml`: Node.js + local filesystem mount, one-command startup (`docker compose up`) |
| 2.9 | Lighthouse audit: Performance ≥95, SEO=100, Accessibility=100 |

---

### Phase 3 — "The Cloud Sync" (Version B)

**Goal:** Set `GITGLOSS_DATA_ADAPTER=github`; site now reads from a GitHub repo. Zero changes to core logic — this is the portability proof.

| # | Task |
|---|------|
| 3.1 | `GitHubReaderAdapter`: fetches `<slug>.md` files from a GitHub repo via REST API, satisfies `ContentStorePort` |
| 3.2 | Adapter wiring config: `GITGLOSS_DATA_ADAPTER=fs\|github` env var drives which adapter is injected at startup |
| 3.3 | GitHub PAT stored as Azure App Setting; adapter handles 403/404/rate-limit responses gracefully |
| 3.4 | GitHub Actions workflow: triggers Azure SWA rebuild on push to `content/catalog/` |
| 3.5 | Portability smoke test: full test suite runs with `GitHubReaderAdapter` injected — zero core test changes permitted |
| 3.6 | Document Version A and Version B deployment configs in README |

---

### Phase 4 — "The Community" (Version C — optional / deferred)

> **Spec:** Fully detailed in OpenSpec change `gitgloss-catalog`. Phase 4 extends the engine with auth, dual-write, and social. It is not required for Versions A or B to be production-ready.

Capabilities picked up from the existing spec:

- **AuthPort** + Azure SWA adapter (three-tier roles: guest / verified / admin)
- **Shadow Cache** dual-write: SQL-first + GitHub API commit with exponential backoff, TTL cleanup
- **SocialWritePort (SQL adapter)**: likes (rate-limited), flat comments (verified users only, admin hard-delete)
- **RankingPort (Social adapter)**: scores items by likes and comment activity for social-influenced sort
- **Admin Portal**: WYSIWYG editor, browser-side image pipeline (Canvas → WebP), Git write-back via `EditorPort`
- **Moderation Dashboard**: failed Git writes, comment moderation, admin alerts

The deduplication key in the shadow cache upgrades from `slug` to `id` (UUID) so that slug renames never orphan social data.

## 9. Success Metrics

- **Zero Lock-in:** The ability to run the entire app locally via Docker with one command.
- **Zero Cost:** $0.00 bill at the end of every month.
- **Instant UI:** Search results appearing in <100ms.
- **Portability Proof:** The Phase 3 adapter swap (FS → GitHub API) requires zero changes to core logic or tests.