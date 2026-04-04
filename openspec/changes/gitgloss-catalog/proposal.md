## Why

GitGloss needs a production-grade catalog system that stores all content in Git while delivering a fast, interactive user experience — without requiring a proprietary infrastructure lock-in. The system must bridge the 90-second Git build delay so newly submitted items appear instantly, while keeping costs at or near $0 using free-tier cloud resources.

## What Changes

- Introduce a Git-backed content system using Astro content collections, where every catalog item is a Markdown file with validated frontmatter
- Introduce a Shadow Cache (SQL dual-write) that makes new items visible immediately, bypassing the static build delay via a TTL-based cleanup job
- Build a client-side search and filter layer using Fuse.js against a generated `search.json`, with full URL state persistence for shareable views
- Create an Admin Portal with a WYSIWYG editor, browser-side image pipeline (Canvas API → WebP), and GitHub API write-back
- Add a Social Layer for likes (rate-limited, fire-and-forget) and comments (verified users only, flat, admin can hard-delete)
- Introduce a three-tier auth system (Guest → Verified → Admin) using a hexagonal `AuthPort` with an Azure SWA adapter
- Build a Moderation Dashboard surfacing pending comments and admin alerts for Git-write failures
- Provide a `docker-compose.yml` for vendor-independent local deployment with Postgres

## Capabilities

### New Capabilities

- `catalog-content`: Git-backed Astro content collections with Zod-validated frontmatter; includes item lifecycle (create, edit, soft-delete via `archived` flag)
- `shadow-cache`: Dual-write API path that writes to Git and SQL simultaneously, with TTL-based Azure Function cleanup and exponential-backoff retry on Git failures
- `search-and-filter`: Client-side fuzzy search (Fuse.js on `search.json`) and faceted filter (author, tags, date) with URL query param state persistence
- `admin-portal`: WYSIWYG Markdown editor, browser-side image resizing/WebP conversion pipeline, and GitHub API commit integration for content management
- `social-interactions`: Per-item like counter (rate-limited, IP + FingerprintJS) and flat comment system (verified users only, admin hard-delete)
- `user-auth`: Hexagonal AuthPort with Azure SWA adapter; three-tier roles (guest/verified/admin); admin bootstrap via `ADMIN_EMAILS` env var; roles stored in SQL
- `moderation-dashboard`: Admin UI surfacing unapproved alerts, Git-write failure notifications (`admin_alerts` table), and comment management

### Modified Capabilities

## Impact

- **New dependencies:** Astro, Fuse.js, Zod, Prisma ORM, FingerprintJS, Milkdown or Editor.js
- **Infrastructure:** Azure Static Web Apps (frontend), Azure Functions (API), Postgres (Neon free tier or Cosmos DB for Postgres)
- **Data layer:** New SQL tables: `users`, `interactions`, `comments`, `shadow_cache`, `admin_alerts`
- **API surface:** REST endpoints for item creation/edit/delete, likes, comments, auth callbacks, and ShadowCache reconciliation
- **Security:** PAT and DB connection strings stored in Azure App Settings only; CORS restricted to primary domain
