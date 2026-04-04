# GitGloss – Architecture Brainstorm & Design Decisions

> Decisions captured from design review session on the PRD (`gitgloss-prd.md`).

---

## 1. Infrastructure Cost & Vendor Strategy

**Discussion:** The PRD states a $0.00/month infrastructure cost goal, while Phase 2 calls for Cosmos DB for Postgres.

**Decision:** The $0 cost is a **capability proof**, not a hard launch requirement. The system should be *capable* of running at $0 (e.g., using Neon's free Postgres tier), but the initial deployment on Azure may incur some cost.

**Rationale:** Using standard PostgreSQL (not a proprietary API) is the portability mechanism. If Azure becomes too expensive or unavailable, the app can move to any Postgres host — including a $5 Linux VPS with Docker — with zero code changes.

---

## 2. Image Storage Strategy

**Discussion:** The image pipeline commits Base64-encoded WebP files directly to the Git repo. Over time (e.g., 500 items × ~200KB), this bloats repo size permanently.

**Decision:** **Intentional design.** The "everything in Git" constraint is deliberate — the catalog must be fully self-contained and portable without a separate blob store dependency.

**Action Item:** Document a max image count/size cap in the repo README. Accept the bloat for v1. Revisit Git LFS or external CDN (e.g., Cloudflare R2) when approaching GitHub's 1GB soft limit.

---

## 3. Shadow Cache Reconciliation Mechanism

**Discussion:** The PRD was vague on what triggers ShadowCache cleanup after a GitHub Action build completes. Options considered:
- A) GitHub Action calls a webhook back to the API
- B) Client-side polling/timestamp comparison on every page load
- C) TTL-based cron cleanup job

**Decision:** **Option C — TTL + cleanup job.** Each ShadowCache record gets a TTL (e.g., 10 minutes). A timer-triggered Azure Function sweeps and deletes stale records periodically.

**Rationale:** Simple, decoupled, no webhook complexity. If a build fails, the item remains visible from SQL until TTL expires — acceptable degraded behavior.

---

## 4. Client-Side Merge & Deduplication

**Discussion:** After a build completes, the same item exists in both the static catalog and the ShadowCache table until TTL cleanup runs, causing potential duplicates in the merged frontend view.

**Decision:**
- **Deduplication key:** `UUID` (not `slug`)
- **Conflict resolution:** Static site version always wins for new items
- **Edit conflicts:** `updatedAt` timestamp determines which version is shown (most recent wins)

---

## 5. Schema Updates Required

**Discussion:** The current `ShadowCache` table (`slug` + `payload`) and `ItemSchema` (`date` field) are insufficient to support dedup and edit flows.

**Decisions:**
- `ShadowCache` table needs: `uuid` + `created_at` / `updated_at` + `ttl` + `git_sync_status: enum('pending','synced','failed')` + `author_id (FK → users)`
- `ItemSchema` (Zod + frontmatter) needs: `updatedAt`, `author_id`, `archived: boolean`
- The edit and soft-delete flows use the **same dual-write → ShadowCache path** as item creation
- TTL cleanup only removes records where `git_sync_status = 'synced'`

---

## 6. Auth & Roles

**Discussion:** Two auth scenarios exist in the PRD: verified commenters and admins.

**Decisions:**
- **User tiers:** Guest (view-only, no auth) → Verified (like + comment) → Admin (everything + moderate + manage content)
- **Auth architecture:** Hexagonal — an `AuthPort` defines the internal `AppUser`. Adapters (e.g., `AzureSWAAuthAdapter`) map external provider identity to `AppUser`. Today: Azure SWA; swappable with no business logic changes.
- **Roles & sessions stored in SQL**, not in the provider config.
- **Admin bootstrap:** `ADMIN_EMAILS` environment variable. On first login, any user whose email matches is promoted to `admin` role automatically.
- **Users table:**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Internal app ID |
| `provider` | String | e.g. `azure_swa`, `github` |
| `provider_id` | String | External identity ID |
| `display_name` | String | For comment attribution |
| `email` | String | For admin bootstrap check |
| `role` | Enum | `admin` \| `verified` |
| `created_at` | Timestamp | |

---

## 7. Social Layer — Comments

**Decisions:**
- **Guests cannot comment or like.** Only verified (logged-in) users can interact.
- **Comments are flat** (no threading) for v1.
- **`is_approved` is dropped** — all comments from verified users go live immediately.
- **Admins can hard-delete** abusive comments from the moderation dashboard.
- **`Comments` table** adds `user_id: UUID (FK → users)`. The `author` string is derived from the user's `display_name`.

---

## 8. Social Layer — Likes

**Decisions:**
- **Like only, no unlike.** Fire-and-forget; `Interactions` table stores a count per `item_slug`.
- **Rate limiting:** 10 likes / hour / IP, enforced in-memory on the Azure Function. Accepted tradeoff: limits reset on cold starts or across multiple instances.
- **FingerprintJS** used for client-side identity; IP rate limiting as server-side guard.

---

## 9. Item Lifecycle — Edit & Delete

**Decisions:**
- **Who can edit/delete:** Author (matched by `author_id`) + Admins.
- **Soft delete:** Items are archived via `archived: true` in frontmatter + a ShadowCache record with the archived status. The frontend merge logic hides archived items immediately; the static build excludes them after the next deploy.
- `author_id` must be stored in both the markdown frontmatter and the `ShadowCache` record.

---

## 10. Dual-Write Failure Handling

**Discussion:** Git write and SQL insert are two separate operations with no distributed transaction.

**Decision:**
1. SQL insert happens first (`git_sync_status: 'pending'`).
2. Git write is attempted with **exponential backoff, max 3 retries**, inline during the API request.
3. On success → `git_sync_status = 'synced'`.
4. On all 3 failures → `git_sync_status = 'failed'` + an entry is added to the **Admin Alert Queue**.
5. TTL cleanup **skips** records where `git_sync_status != 'synced'`, preventing silent data loss.

**Admin Alert Queue:** A SQL table (`admin_alerts`) with `id`, `type`, `item_slug`, `message`, `created_at`, `resolved_at`. Surfaced in the moderation dashboard.

---

## 11. Search & Filter

**Decisions:**
- **Fuzzy search** (Fuse.js on `search.json`): indexes `title` and `description` only.
- **Filter facets** (client-side): `author`, `tags`, `date` — included in `search.json` but not fuzzy-searched.
- URL state persistence for all active filters (per PRD §3.1).
