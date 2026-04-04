## ADDED Requirements

### Requirement: New items are written to SQL before Git
On item submission the API SHALL insert a record into `shadow_cache` with `git_sync_status: 'pending'` before attempting the Git commit, so the item is immediately queryable.

#### Scenario: SQL insert precedes Git write
- **WHEN** a user submits a new item via the Admin Portal
- **THEN** the `shadow_cache` record SHALL exist in the database before the GitHub API commit is attempted

### Requirement: Git write uses exponential backoff with max 3 retries
The API SHALL attempt the GitHub API commit up to 3 times using exponential backoff (100ms, 200ms, 400ms delays). On success it SHALL update `git_sync_status` to `'synced'`. On exhausting all retries it SHALL set `git_sync_status` to `'failed'` and insert an entry into `admin_alerts`.

#### Scenario: Successful Git write on first attempt
- **WHEN** the GitHub API commit succeeds on the first attempt
- **THEN** `shadow_cache.git_sync_status` SHALL be updated to `'synced'`

#### Scenario: Retry succeeds on second attempt
- **WHEN** the first GitHub API commit attempt fails and the second succeeds
- **THEN** `shadow_cache.git_sync_status` SHALL be updated to `'synced'` after the second attempt

#### Scenario: All retries exhausted
- **WHEN** all 3 GitHub API commit attempts fail
- **THEN** `shadow_cache.git_sync_status` SHALL be set to `'failed'` AND an `admin_alerts` record SHALL be inserted

### Requirement: TTL cleanup job removes synced records
A timer-triggered function SHALL run every 5 minutes and DELETE `shadow_cache` records where `git_sync_status = 'synced'` AND `created_at < NOW() - ttl`.

#### Scenario: Synced record past TTL is deleted
- **WHEN** a `shadow_cache` record has `git_sync_status = 'synced'` and its TTL has elapsed
- **THEN** the cleanup job SHALL delete the record

#### Scenario: Failed record is not deleted
- **WHEN** a `shadow_cache` record has `git_sync_status = 'failed'`
- **THEN** the cleanup job SHALL NOT delete it

#### Scenario: Pending record is not deleted
- **WHEN** a `shadow_cache` record has `git_sync_status = 'pending'`
- **THEN** the cleanup job SHALL NOT delete it

### Requirement: Frontend merges static catalog with shadow cache
On each page load the frontend SHALL fetch the static `search.json` and query the shadow cache endpoint, merge the two lists deduplicating by `uuid`, and render the combined result.

#### Scenario: In-flight item appears before build completes
- **WHEN** an item exists in `shadow_cache` with `git_sync_status = 'pending'` or `'synced'` and has not yet appeared in the static catalog
- **THEN** the item SHALL be visible in the frontend catalog immediately

#### Scenario: Deduplication prevents double-entry
- **WHEN** an item exists in both the static catalog and `shadow_cache`
- **THEN** only one entry SHALL be shown; the static version SHALL take precedence

#### Scenario: Archived item hidden immediately
- **WHEN** a `shadow_cache` record has `archived: true`
- **THEN** the frontend SHALL NOT display the item regardless of its presence in the static catalog

### Requirement: shadow_cache table schema
The `shadow_cache` table SHALL have columns: `uuid` (PK), `slug`, `payload` (JSONB), `git_sync_status` (enum: `pending|synced|failed`), `author_id` (FK → users), `created_at`, `updated_at`, `ttl` (interval, default 10 minutes).

#### Scenario: Record created with required fields
- **WHEN** a new shadow_cache record is inserted
- **THEN** all NOT NULL columns (`uuid`, `slug`, `payload`, `git_sync_status`, `author_id`, `created_at`) SHALL be populated
