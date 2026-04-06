# Comparison: PRD v0.1 ("Universal Showcase Engine") vs. OpenSpec `gitgloss-catalog`

> **Purpose:** Side-by-side analysis of the original spec (`openspec/changes/gitgloss-catalog/`) and the revised PRD (`docs/gitgloss-prd-v-0.1.md`), highlighting what changed, what was dropped, and what's new.

---

## TL;DR

| Dimension | OpenSpec (`gitgloss-catalog`) | PRD v0.1 ("Chassis-First") |
|---|---|---|
| **Philosophy** | Build a specific product | Build a configurable engine |
| **Scope** | 7 fully-specced capabilities, full social layer | Core kernel + swappable adapters; social is optional |
| **Auth** | Three-tier (guest / verified / admin) via Azure SWA | Not a core concern; no auth port defined |
| **Admin / Moderation** | WYSIWYG editor, moderation dashboard | Not present |
| **Infrastructure** | Azure-first (SWA + Functions + Cosmos DB) | Cloud-agnostic; Azure listed as one option |
| **Versioning** | Single deployment target | Explicit Version A / B / C configuration matrix |
| **CLI** | Not mentioned | New: CLI Presenter adapter |
| **Data schema** | Includes `author_id`, `updatedAt`, DB FKs in shadow_cache | Simpler; no FK references in the schema |
| **Roadmap** | Flat task list (80 tasks across 9 areas) | 4-phase incremental build |
| **Portability** | Stated goal but Azure-specific adapters dominate | First-class success metric with explicit "exit strategy" |

---

## 1. Core Architecture

Both documents share the same hexagonal (Ports & Adapters) architecture. The framing differs significantly.

| Aspect | OpenSpec | PRD v0.1 |
|---|---|---|
| **Name** | Hexagonal Architecture | "Chassis-First" / Hexagonal Architecture |
| **Ports defined** | 4 (Auth, ContentStore, Database, SearchIndex) — all with full TypeScript interfaces | 4 (Data Provider, Social Engagement, Editor, Presenter) — named but not yet typed |
| **Adapters specified** | Azure SWA Auth, GitHub Content, Prisma/Postgres DB, Astro Search | Multiple per port (e.g. Git / Filesystem / Mock for data; SQL / Giscus / Null for social) |
| **"Null" adapters** | `InMemoryDatabaseAdapter` exists for testing only | Null adapters are first-class production options (e.g. "Null Social" = pure showcase) |
| **Local dev** | `docker-compose.yml` with Postgres + Node.js | Docker one-command startup cited as success metric |

**Verdict:** The PRD makes the "null/no-op adapter as a valid production choice" explicit — a meaningful conceptual shift from "feature we'll build" to "mode you deploy in."

---

## 2. Capabilities — What's In, What's Out

### Kept (both documents)

| Capability | Notes |
|---|---|
| **catalog-content** | Git-backed Markdown files, Zod validation, item lifecycle |
| **shadow-cache** | Dual-write (SQL + Git), TTL cleanup, frontend merge logic |
| **search-and-filter** | Client-side fuzzy search on generated JSON |
| **Astro presenter** | Primary web UI |

### Dropped from PRD v0.1

| Capability | OpenSpec Status | PRD v0.1 Status | Impact |
|---|---|---|---|
| **user-auth** | Full hexagonal `AuthPort`; three-tier roles (guest/verified/admin); Azure SWA adapter | Not present | No login, no role enforcement, no user management |
| **admin-portal** | WYSIWYG editor (Milkdown/Editor.js), browser image pipeline (Canvas → WebP), item create/edit forms | Not present | Content must be managed externally or via Git directly |
| **moderation-dashboard** | Admin alerts panel, failed-item retry, comment moderation | Not present | No operational oversight UI |
| **social-interactions** | Likes (rate-limited, FingerprintJS), flat comments (verified users only, admin hard-delete) | Optional via Social Engagement Port adapter | Social features become a plug-in, not a core deliverable |

### New in PRD v0.1

| Addition | Description |
|---|---|
| **CLI Presenter (Adapter B)** | Terminal-based search tool; makes the core usable without any web UI |
| **Version A: Local Vault** | Local FS + Null Social — private internal asset tracking with no cloud dependency |
| **Version B: Pure Curator** | Git API + Null Social — "Awesome list" style, zero social overhead |
| **Version C: Resource Hub** | Git API + SQL Social — full community catalog (closest to the OpenSpec vision) |
| **Giscus adapter** | Zero-database social via GitHub Discussions — not in the original spec |

---

## 3. Data Schema

### OpenSpec schema (design.md, Decision 10)

```yaml
id: UUID
title: string
description: string (≤160)
tags: string[]
image: "/images/<uuid>.webp"
author:
  name: string
  email: string
date: date
updatedAt: datetime
featured: boolean
archived: boolean
```

SQL layer adds: `author_id` (UUID FK → users), `git_sync_status`, `created_at`, `ttl`.

### PRD v0.1 schema (Section 7)

```typescript
const CatalogItem = z.object({
  slug: z.string(),      // changed from `id` (UUID) to `slug`
  title: z.string().min(1),
  description: z.string().max(160),
  tags: z.array(z.string()),
  image: z.string().optional(),
  date: z.string(),      // ISO format
  status: z.enum(['published', 'draft', 'archived']),  // replaces `archived: boolean`
  featured: z.boolean().default(false)
});
```

**Key diffs:**

| Field | OpenSpec | PRD v0.1 | Note |
|---|---|---|---|
| `id` vs `slug` | UUID (`id`) | Human-readable slug (`slug`) | Slug is URL-friendly; UUID gives stable identity |
| `author` | Object with `name` + `email` | Not in schema | Removed — no auth = no authorship tracking |
| `updatedAt` | Present | Absent | May be needed for cache invalidation |
| `archived` flag | `boolean` | Replaced by `status` enum | `status` adds a `draft` state — more expressive |
| DB FKs | `author_id` in shadow_cache | No FKs mentioned | Simpler, but loses ownership tracking |

---

## 4. Shadow Cache

Both documents describe the same dual-write + TTL cleanup mechanism. The PRD's description is higher-level; the OpenSpec defines exact failure handling.

| Detail | OpenSpec | PRD v0.1 |
|---|---|---|
| **Data flow** | Fully specified: SQL-first → Git retry (3×) → synced/failed states → admin alert | Described conceptually: fetch static JSON + SQL `fresh_items`, merge by slug |
| **Deduplication key** | `uuid` | `slug` (aligns with new schema) |
| **Failure path** | `git_sync_status = 'failed'` + `INSERT INTO admin_alerts` | Not specified |
| **Cleanup trigger** | Timer-triggered Azure Function every 5 min | Not specified |
| **Admin visibility** | Moderation dashboard surfaces failures | No dashboard in PRD v0.1 |

The PRD simplifies the shadow cache description to the happy path; the failure handling from the OpenSpec would still be needed in implementation.

---

## 5. Infrastructure

| Concern | OpenSpec | PRD v0.1 |
|---|---|---|
| **Hosting** | Azure Static Web Apps (Free Tier) | Azure Static Web Apps (Free Tier) — same |
| **Compute** | Azure Functions | Azure Functions |
| **Database** | Neon free tier *or* Cosmos DB for Postgres | Azure Cosmos DB for PostgreSQL (Free Tier) |
| **ORM** | Prisma (explicitly chosen over Drizzle) | Prisma ORM mentioned in portability note |
| **Auth provider** | Azure SWA Easy Auth | None |
| **Image storage** | Git repo (`/public/images/<uuid>.webp`), 200KB cap | Not mentioned |
| **Portability rule** | "Use standard SQL; avoid proprietary Azure SDKs in Core" | Same principle, stated as a hard rule |
| **Lock-in risk** | Flagged as risk; mitigated by `AuthPort` | Mitigated by all 4 ports; explicit success metric |

---

## 6. Roadmap Approach

### OpenSpec — Flat task list

80 tasks across 9 work areas, all treated with equal priority. No explicit sequencing by business value.

### PRD v0.1 — Phased delivery

| Phase | Deliverable | Value gate |
|---|---|---|
| 1 | Atomic Core + Local FS adapter | Search/sort verified via CLI (zero UI needed) |
| 2 | Astro Presenter | Showcase works with local Markdown |
| 3 | GitHub Reader adapter | Data moves from disk to Git repo |
| 4 (optional) | SQL Social adapter | Votes and comments — only if needed |

**Verdict:** The PRD's phased approach de-risks the build by establishing a working, testable system at each phase rather than requiring all 7 capabilities before anything is usable.

---

## 7. Success Metrics

| Metric | OpenSpec | PRD v0.1 |
|---|---|---|
| **Cost** | $0/month goal (stated in design rationale) | `$0.00` as explicit pass/fail metric |
| **Portability** | "Exit strategy" — swap adapters without touching core | "Zero Lock-in" — run locally via Docker with one command |
| **Performance** | Lighthouse ≥95 Performance, SEO=100, Accessibility=100 | Search results `<100ms` |
| **E2E latency** | Item visible in frontend within 2 seconds of submit | Not explicitly re-stated (implicit via shadow cache) |

---

## 8. What the PRD Gains vs. What It Loses

### Gains

- **Generality:** The engine can power very different use cases (private vault, curated list, community hub) with the same codebase.
- **Simpler initial build:** Phases 1–3 deliver a working product without auth, social, or admin UI — lower risk and faster first value.
- **CLI usability:** The core is independently testable and usable without a browser.
- **Cleaner schema:** `status` enum is more expressive than a bare `archived` boolean.

### Loses

- **Auth & multi-user support:** Without an `AuthPort`, content submission requires Git access — not suitable for a public community catalog without re-adding auth.
- **Operational visibility:** No moderation dashboard means failed Git writes or abusive content have no oversight mechanism in v0.1.
- **Stable item identity:** Switching from UUID `id` to `slug` trades stable identity for URL-friendliness. If a slug changes, existing social data (likes/comments) would be orphaned.
- **Author attribution:** Dropping `author` from the schema loses provenance — workable for a solo/curated catalog, not for a community one.
- **Completeness of failure handling:** The shadow cache happy path is described; the failure path from the OpenSpec (alerts, retry, admin action) would need to be re-specified.

---

## 9. Synthesis: The PRD as a "Chassis", the OpenSpec as "Version C"

The most useful framing: the PRD v0.1 defines the **engine and its configuration space**. The OpenSpec `gitgloss-catalog` essentially describes **Version C (Resource Hub)** of that engine — fully wired up with auth, social, admin portal, and moderation.

```
PRD v0.1 defines:
  Version A  ←  Local Vault (new, no OpenSpec equivalent)
  Version B  ←  Pure Curator (new, no OpenSpec equivalent)
  Version C  ←  Resource Hub ≈ OpenSpec gitgloss-catalog (existing spec)
```

The dropped capabilities (auth, admin portal, moderation) aren't gone — they're deferred to Version C, which the OpenSpec already details. The PRD just makes it explicit that Versions A and B are valid, shippable products without them.
