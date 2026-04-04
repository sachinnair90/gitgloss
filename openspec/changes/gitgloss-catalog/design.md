## Context

GitGloss is a content catalog where the canonical data store is a Git repository of Markdown files. The system must serve a rich, interactive frontend while absorbing the ~90-second delay between form submission and static site rebuild. There is no existing codebase — this is a greenfield build targeting Azure Static Web Apps + Azure Functions + PostgreSQL (Neon free tier or Cosmos DB for Postgres).

The architecture follows Hexagonal (Ports and Adapters): a framework-agnostic core containing business logic, surrounded by adapters for Git, SQL, authentication, and the web layer. This enables the "exit strategy" — the app can move to any cloud or a $5 VPS with zero core logic changes.

## Goals / Non-Goals

**Goals:**
- Define the system architecture, data model, and key technical decisions for all seven capabilities
- Provide an explicit dual-write + Shadow Cache design to close the publish latency gap
- Establish the hexagonal auth boundary so auth providers are swappable
- Define failure-handling strategies (Git write failures, duplicate suppression)
- Ensure the design supports a `docker-compose.yml`-based local environment identical to production

**Non-Goals:**
- Line-by-line implementation details (covered in tasks.md)
- Git LFS or external CDN for images (deferred to post-v1; accepted bloat for now)
- Multi-language / i18n

## Decisions

### Decision 1: Astro as the Frontend Framework

**Choice:** Astro with content collections (`.md` files + Zod schema validation)  
**Rationale:** Astro's content collections provide first-class Markdown-as-data with build-time type safety. Its island architecture keeps the catalog statically rendered (fast, SEO-friendly) while hydrating only interactive components (search, like button, comment form). Next.js was considered but adds unnecessary SSR complexity for a predominantly static catalog.  
**Alternative considered:** Next.js with ISR — rejected because it couples content delivery to a running Node.js process, undermining the $0 hosting goal.

---

### Decision 2: Shadow Cache via Dual-Write + TTL Cleanup

**Choice:** On item submission, the API performs two writes atomically-as-possible: (1) SQL insert (`git_sync_status: 'pending'`), then (2) Git commit via GitHub API with exponential backoff (max 3 retries). A timer-triggered Azure Function sweeps stale records by TTL.

**Data flow:**
```
User submits form
  → API: INSERT shadow_cache (git_sync_status='pending', ttl=now+10min)
  → API: Commit .md to GitHub [retry up to 3×]
    → success → UPDATE shadow_cache (git_sync_status='synced')
    → failure → git_sync_status='failed' + INSERT admin_alerts
  → GitHub Action triggers static rebuild (~90s)
  → TTL cleanup job runs every 5 min
    → DELETE WHERE git_sync_status='synced' AND created_at < now - ttl
    → SKIP WHERE git_sync_status != 'synced'
```

**Frontend merge:** On page load, fetch static catalog JSON + SQL shadow cache records. Deduplicate by `uuid` (SQL wins for in-flight items, static wins once built). Items in the merged view are sorted by `created_at` descending.

**Rationale:** TTL cleanup is decoupled and simple. Webhook-based reconciliation (Option A from brainstorm) adds operational complexity. Client-side polling (Option B) adds per-request DB load.

---

### Decision 3: Full Hexagonal Architecture — All Infrastructure Behind Ports

**Choice:** The entire application follows Ports and Adapters. Every infrastructure concern — not just auth — is accessed by the core exclusively through a port interface. The core has zero direct imports of cloud SDKs, ORM clients, or HTTP libraries.

**Core ports defined in `src/core/ports/`:**

```typescript
// Auth: who is the caller?
interface AuthPort {
  getCurrentUser(request: Request): Promise<AppUser | null>;
  requireRole(role: UserRole): Middleware;
}

// Content store: reading/writing Markdown files (Git today, filesystem tomorrow)
interface ContentStorePort {
  readItem(uuid: string): Promise<CatalogItem | null>;
  writeItem(item: CatalogItem): Promise<void>;        // create or overwrite .md
  listItems(filter?: ItemFilter): Promise<CatalogItem[]>;
}

// Database: social layer and shadow cache (Postgres today, any SQL tomorrow)
interface DatabasePort {
  // users
  upsertUser(user: AppUser): Promise<void>;
  findUserById(id: string): Promise<AppUser | null>;
  // likes
  incrementLike(itemSlug: string): Promise<number>;
  getLikeCount(itemSlug: string): Promise<number>;
  // comments
  insertComment(comment: NewComment): Promise<Comment>;
  deleteComment(id: string): Promise<void>;
  listComments(itemSlug: string): Promise<Comment[]>;
  // shadow cache
  insertShadowCacheEntry(entry: ShadowCacheEntry): Promise<void>;
  updateShadowCacheStatus(uuid: string, status: GitSyncStatus): Promise<void>;
  getShadowCacheEntries(filter?: ShadowCacheFilter): Promise<ShadowCacheEntry[]>;
  deleteShadowCacheEntry(uuid: string): Promise<void>;
  // admin alerts
  insertAdminAlert(alert: NewAdminAlert): Promise<void>;
  resolveAdminAlert(id: string): Promise<void>;
  listAdminAlerts(resolved?: boolean): Promise<AdminAlert[]>;
}

// Search index: build-time generation and runtime lookup
interface SearchIndexPort {
  buildIndex(items: CatalogItem[]): Promise<void>;    // run at build time
  getIndex(): Promise<SearchIndexEntry[]>;             // served as search.json
}
```

**Adapters (live in `src/adapters/`):**
- `GitHubContentStoreAdapter` — commits `.md` files via GitHub API
- `PrismaPostgresDatabaseAdapter` — all SQL via Prisma
- `AzureSWAAuthAdapter` — parses `x-ms-client-principal` header
- `AstroSearchIndexAdapter` — generates `public/search.json` at build time

**Local / test adapters:**
- `FilesystemContentStoreAdapter` — reads/writes local `.md` files (for Docker local dev and tests)
- `InMemoryDatabaseAdapter` — for unit testing core logic with no DB

**Rationale:** Auth is only one of several infrastructure concerns. Expressing all of them as ports means the business logic (create item, enforce authorship, merge shadow cache) can be unit-tested in isolation, and any single adapter can be swapped without touching the core. This is the foundation of the portability guarantee.

---

### Decision 4: PostgreSQL via Prisma ORM

**Choice:** Prisma as the ORM targeting standard PostgreSQL (Neon free tier for production; local Docker Postgres for development).  
**Rationale:** Prisma's schema-first approach with type-safe queries prevents SQL injection and reduces runtime errors. Standard PostgreSQL means no proprietary APIs — the connection string is the only thing that changes when moving cloud providers.  
**Alternative considered:** Drizzle ORM — lighter, but Prisma's migration tooling (`prisma migrate`) is more mature for a team greenfield project.

---

### Decision 5: Client-Side Search with Fuse.js

**Choice:** At build time, Astro generates a `public/search.json` that indexes `title`, `description`, `tags`, `author`, and `date` for every non-archived item. Fuse.js performs fuzzy matching in the browser against `title` and `description` only; `tags`, `author`, `date` are filter facets applied after fuzzy results.

**URL state:** All active filters and the search query are serialized to URL query params (e.g., `?q=vintage&tags=film&sort=popular`). This uses the History API — no full page reload.

---

### Decision 6: Browser-Side Image Pipeline

**Choice:** Before upload, the browser uses the Canvas API to resize images to max 1200px wide and encode as WebP. The resulting Base64 string is sent to the API, which commits it directly to `/public/images/<uuid>.webp` in the Git repo.

**Accepted trade-off:** Committing binary blobs to Git bloats repo size permanently. This is intentional for v1 to preserve the "everything in Git" portability constraint. A hard cap of 200KB per image post-compression is enforced client-side.

---

### Decision 7: Like Rate Limiting Strategy

**Choice:** In-memory rate limiting (10 likes/minute/IP) on the Azure Function instance. FingerprintJS provides a client-side visitor ID sent with each like request as an additional signal.

**Accepted trade-off:** In-memory limits reset on cold starts and don't coordinate across multiple function instances. This is acceptable for v1 — the social layer is supplementary, and sophisticated abuse mitigation (Redis-backed rate limiting) is post-v1.

---

### Decision 8: Edit and Soft-Delete via Same Dual-Write Path

**Choice:** Item edits and soft-deletes (setting `archived: true`) follow the same dual-write path as creation. The API updates the `shadow_cache` record with the new payload and `git_sync_status: 'pending'`, then attempts to commit the updated `.md` file to Git.

**Authorization:** The `shadow_cache` table stores `author_id` (UUID FK → users) for authorization during the write phase. Markdown frontmatter stores only `author` as an object with `name` and `email` (both plain strings from the user's profile at write time) — no DB foreign keys in the `.md` files (see Decision 10). Once an item is promoted to the static site and its shadow_cache record is cleaned up, only admins can edit or delete it. A separate lightweight `item_ownership` table (`item_uuid`, `user_id`) can be added post-v1 to restore author self-service after TTL cleanup.

**Frontend behavior:** Archived items are hidden immediately from the merged view; the static build excludes them after the next deploy.

---

### Decision 9: Dual-Write Failure Handling

**Sequence:**
1. SQL insert first (`git_sync_status: 'pending'`)
2. Git write with exponential backoff (100ms → 200ms → 400ms, max 3 attempts)
3. On success: `git_sync_status = 'synced'`
4. On all failures: `git_sync_status = 'failed'` + `INSERT INTO admin_alerts`
5. TTL cleanup skips `git_sync_status != 'synced'` records — no silent data loss

**Rationale:** SQL-first ensures the item is visible immediately. If Git fails, the item stays in the shadow cache and the admin is alerted. The admin can manually retry or delete the orphaned record from the dashboard.

---

### Decision 10: Markdown Files Are Self-Contained and DB-Agnostic

**Choice:** Markdown frontmatter SHALL NOT contain any foreign keys or identifiers that reference database records. Specifically:
- `author` is stored as a plain display-name string (e.g., `"Jane Smith"`), not a UUID FK
- `image` is a relative path or URL (e.g., `/images/<uuid>.webp`), not a DB record reference
- No `user_id`, `author_id`, or other FK columns appear in frontmatter

The DB (`shadow_cache.author_id`, `comments.user_id`) holds relational data. The `.md` files hold content data. The two are intentionally decoupled — the entire catalog can be cloned from Git and rendered without a database connection.

**Schema:**
```yaml
---
id: "550e8400-e29b-41d4-a716-446655440000"   # UUID, stable identity
title: "My Item"
description: "Short description ≤160 chars"
tags: ["tag1", "tag2"]
image: "/images/550e8400.webp"               # path only, no DB ref
author:
  name: "Jane Smith"                          # display name, no DB FK
  email: "jane@example.com"                  # email, no DB FK
date: 2026-04-04
updatedAt: 2026-04-04T09:00:00Z
featured: false
archived: false
---
```

**Rationale:** A catalog that requires a live DB connection to render is not truly portable. By keeping `.md` files free of DB FKs, a developer can `git clone` the repo, run `astro build`, and have a fully working static site with zero DB setup. The DB is purely additive (social features, write acceleration).

---

### Decision 11: ShadCN + Tailwind for UI Components and Styling

**Choice:** All UI components use ShadCN (Radix UI primitives with Tailwind-based styling). Tailwind CSS is the sole styling mechanism — no custom CSS files or CSS-in-JS.

**Rationale:** ShadCN provides accessible, unstyled-by-default components (buttons, dialogs, forms, dropdowns) that integrate directly into the codebase as copied source files (not a black-box npm dependency). Tailwind keeps styles co-located with markup and produces minimal CSS bundles. Together they cover the component and styling needs of the catalog, submission form, admin management, and moderation dashboard without a separate design system.

**Alternative considered:** Plain CSS modules — rejected because they require maintaining a separate style layer and don't provide accessible interactive primitives out of the box.

## Risks / Trade-offs

- **Git repo bloat** → Images committed as binary blobs. Mitigation: enforce 200KB/image cap client-side; revisit Git LFS or Cloudflare R2 when approaching GitHub's 1GB soft limit.
- **In-memory rate limiting** → Like limits reset on function cold starts / multi-instance scale-out. Mitigation: acceptable for v1; post-v1 upgrade to Redis-backed counter.
- **No distributed transaction for dual-write** → Git and SQL can diverge. Mitigation: `admin_alerts` table surfaces failures; TTL cleanup skips unsynced records; admin dashboard allows manual resolution.
- **FingerprintJS accuracy** → Browser fingerprints can be spoofed. Mitigation: IP rate limiting is the primary guard; FingerprintJS is supplementary signal only.
- **Azure SWA Easy Auth lock-in risk** → Mitigated by the hexagonal `AuthPort` and all other ports — swapping any adapter requires no core logic changes.
- **Cosmos DB for Postgres cost** → The $0 cost target is a capability proof. Initial Azure deployment may incur cost; Neon free tier is the recommended production option for $0 operation.
