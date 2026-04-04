## 1. Project Scaffolding & Infrastructure

- [ ] 1.1 Initialise Astro project with TypeScript, content collections, and island architecture configuration
- [ ] 1.2 Add dependencies: Zod, Prisma, Fuse.js, FingerprintJS, Milkdown (or Editor.js)
- [ ] 1.3 Configure Astro content collection schema using `ItemSchema` Zod definition (id, title, description, tags, image, date, featured, updatedAt, author_id, archived)
- [ ] 1.4 Set up Prisma schema with tables: `users`, `interactions`, `comments`, `shadow_cache`, `admin_alerts`
- [ ] 1.5 Run `prisma migrate dev` to create initial migration and verify against Neon free-tier Postgres
- [ ] 1.6 Create `docker-compose.yml` with Postgres service and Node.js app; verify local environment matches production schema
- [ ] 1.7 Configure Azure Static Web Apps deployment with `staticwebapp.config.json` (routes, auth, API proxying)
- [ ] 1.8 Store PAT and DB connection string as Azure App Settings environment variables; document `ADMIN_EMAILS` variable

## 2. Hexagonal Auth

- [ ] 2.1 Define `AuthPort` interface and `AppUser` type in the core domain (`src/core/ports/auth.ts`)
- [ ] 2.2 Implement `AzureSWAAuthAdapter` that parses the `x-ms-client-principal` header and maps to `AppUser`
- [ ] 2.3 Implement user upsert logic: on first login, check `ADMIN_EMAILS` env var and set `role` accordingly; on subsequent logins return existing user
- [ ] 2.4 Add `requireRole(role)` middleware that returns 401 for unauthenticated requests and 403 for insufficient role
- [ ] 2.5 Wire `AuthPort` into the Azure Functions API layer via dependency injection

## 3. Catalog Content & Item Lifecycle

- [ ] 3.1 Create the Astro content collection directory (`content/catalog/`) and add a sample `.md` file to validate the schema
- [ ] 3.2 Build the Astro build-time script that generates `public/search.json` (fields: id, title, description, tags, author, date) excluding archived items
- [ ] 3.3 Implement the `POST /api/items` endpoint: require `verified` or `admin` role (401/403 otherwise), validate input with Zod, set `author_id` from the authenticated user, perform dual-write (SQL first, then Git), return the created item's UUID
- [ ] 3.4 Implement the `PUT /api/items/:uuid` endpoint: validate caller is item's author or admin (403 otherwise), dual-write updated content, refresh `updatedAt`
- [ ] 3.5 Implement the `DELETE /api/items/:uuid` endpoint: validate caller is item's author or admin (403 otherwise), dual-write `archived: true` to both shadow_cache and Git

## 4. Shadow Cache & Dual-Write

- [ ] 4.1 Implement the GitHub API commit helper with exponential backoff (100ms → 200ms → 400ms, max 3 retries)
- [ ] 4.2 On Git write success: update `shadow_cache.git_sync_status = 'synced'`
- [ ] 4.3 On Git write failure (all retries exhausted): set `git_sync_status = 'failed'` and `INSERT INTO admin_alerts`
- [ ] 4.4 Create the `GET /api/shadow-cache` endpoint that returns all non-archived shadow_cache records for frontend merge
- [ ] 4.5 Implement the timer-triggered Azure Function (every 5 minutes) that deletes `shadow_cache` records where `git_sync_status = 'synced'` AND `created_at < NOW() - ttl`; skips `failed` and `pending` records

## 5. Search & Filter

- [ ] 5.1 Integrate Fuse.js in the frontend with options targeting `title` and `description` fields from `search.json`
- [ ] 5.2 Build the filter panel component supporting multi-select tags, author filter, and date range
- [ ] 5.3 Implement URL state persistence: serialise active search query, tags, author, date, and sort to query params on every change using the History API
- [ ] 5.4 Implement URL state hydration: parse query params on page load and restore active filters and search state
- [ ] 5.5 Implement sort: `date` (newest first, default) and `popular` (by `interactions.count` descending)
- [ ] 5.6 Implement the frontend catalog merge logic: fetch `search.json` + shadow_cache endpoint, deduplicate by UUID (static wins for conflicts), hide archived items

## 6. Content Submission & Admin Management

- [ ] 6.1 Create the content submission route (`/submit`) accessible to `verified` and `admin` users; redirect guests to login
- [ ] 6.2 Integrate the WYSIWYG editor (Milkdown or Editor.js) and verify it serialises formatted content to clean Markdown
- [ ] 6.3 Implement the browser-side image pipeline: Canvas API resize to max 1200px width, encode as WebP, enforce ≤200KB output, reject non-image files with a validation error
- [ ] 6.4 Connect the image pipeline output (Base64 WebP) to the item creation API; have the API commit the image to `/public/images/<uuid>.webp` via the GitHub API; set `author_id` to the submitting user's `id`
- [ ] 6.5 Build the item creation form wiring together the WYSIWYG editor, image pipeline, tag input, and `POST /api/items`
- [ ] 6.6 Create the item edit route; restrict access to the item's author (`author_id` match) or admins (403 otherwise)
- [ ] 6.7 Build the item edit form pre-populated from existing item data, wired to `PUT /api/items/:uuid`; enforce author or admin check server-side
- [ ] 6.8 Build the item delete flow (soft-delete confirmation dialog) wired to `DELETE /api/items/:uuid`; enforce author or admin check server-side
- [ ] 6.9 Create admin-only management routes (`/admin/items`) protected by `requireRole('admin')` for cross-author editing and deletion

## 7. Social Interactions

- [ ] 7.1 Implement `POST /api/items/:slug/like` endpoint: verify user is authenticated, increment `interactions.count`, enforce in-memory IP rate limit (10/hour), return 429 on limit exceeded
- [ ] 7.2 Build the like button Astro island component: POST on click, optimistically update displayed count, reflect server response within 200ms
- [ ] 7.3 Implement `POST /api/items/:slug/comments` endpoint: verify user is authenticated (401 otherwise), validate non-empty body (400 otherwise), insert comment with `user_id` FK
- [ ] 7.4 Implement `DELETE /api/comments/:id` endpoint: verify caller is admin (403 otherwise), permanently delete the record
- [ ] 7.5 Build the comment section Astro island: display flat comment list (author = `users.display_name`), show comment form for authenticated users, hide form for guests

## 8. Moderation Dashboard

- [ ] 8.1 Create the moderation dashboard route (`/admin/moderation`) protected by `requireRole('admin')`
- [ ] 8.2 Build the admin alerts panel: query unresolved `admin_alerts` records, display type/slug/message/created_at, provide "Resolve" action that sets `resolved_at`
- [ ] 8.3 Build the failed items panel: query `shadow_cache` where `git_sync_status = 'failed'`, display item details, provide "Retry" and "Delete" actions
- [ ] 8.4 Implement the retry action: re-attempt GitHub API commit with exponential backoff; on success update `git_sync_status = 'synced'`; on failure leave as `'failed'`
- [ ] 8.5 Build the comment moderation panel: list all comments across all items with author, body, created_at, and a hard-delete action wired to `DELETE /api/comments/:id`

## 9. Performance & Non-Functional Requirements

- [ ] 9.1 Configure Astro Image (or equivalent) to serve responsive `srcset` sizes for catalog item images
- [ ] 9.2 Run Lighthouse audit and verify Performance ≥95, SEO = 100, Accessibility = 100; fix any regressions
- [ ] 9.3 Verify all API endpoints enforce CORS to the primary domain only
- [ ] 9.4 Add Zod validation to all API request bodies; ensure no unvalidated input reaches the database or Git write logic
- [ ] 9.5 Verify end-to-end: submit a new item via the Admin Portal, confirm it appears in the frontend within 2 seconds, confirm it appears in the static build after the GitHub Action completes
