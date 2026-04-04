## ADDED Requirements

### Requirement: Moderation dashboard is accessible only to admin users
The moderation dashboard route SHALL be restricted to users with `role = 'admin'`. All other users SHALL receive a 403 Forbidden response.

#### Scenario: Admin accesses dashboard
- **WHEN** an admin navigates to the moderation dashboard
- **THEN** the dashboard SHALL load and display current alerts and moderation items

#### Scenario: Verified user denied dashboard access
- **WHEN** a verified user navigates to the moderation dashboard URL
- **THEN** they SHALL receive a 403 Forbidden response

### Requirement: Dashboard surfaces admin alerts for Git write failures
The dashboard SHALL query the `admin_alerts` table and display all unresolved alerts. Each alert SHALL show: `type`, `item_slug`, `message`, and `created_at`. Admins SHALL be able to mark alerts as resolved.

#### Scenario: Git failure alert is shown on dashboard
- **WHEN** a Git write fails and an `admin_alerts` record is created
- **THEN** the alert SHALL appear in the dashboard's alert list

#### Scenario: Admin resolves an alert
- **WHEN** an admin clicks "Resolve" on an alert
- **THEN** the `admin_alerts.resolved_at` field SHALL be set to the current timestamp and the alert SHALL no longer appear in the unresolved list

### Requirement: Dashboard allows admin to hard-delete comments
The dashboard SHALL list all comments across all items with the ability to hard-delete any comment. Deletion SHALL be permanent and immediately reflected on item pages.

#### Scenario: Comment deleted from dashboard
- **WHEN** an admin clicks delete on a comment in the dashboard
- **THEN** the comment record SHALL be permanently removed from the database

### Requirement: Dashboard shows shadow_cache items with failed git_sync_status
The dashboard SHALL display all `shadow_cache` records with `git_sync_status = 'failed'` so admins can identify items that were not committed to Git. Admins SHALL be able to retry the Git commit or delete the orphaned record from the dashboard.

#### Scenario: Failed shadow_cache record shown in dashboard
- **WHEN** a `shadow_cache` record has `git_sync_status = 'failed'`
- **THEN** it SHALL appear in the dashboard's failed items list

#### Scenario: Admin retries Git commit from dashboard
- **WHEN** an admin clicks "Retry" on a failed shadow_cache item
- **THEN** the system SHALL re-attempt the GitHub API commit with exponential backoff

#### Scenario: Admin deletes orphaned shadow_cache record
- **WHEN** an admin clicks "Delete" on a failed shadow_cache item
- **THEN** the record SHALL be permanently deleted from `shadow_cache`

### Requirement: admin_alerts table schema
The `admin_alerts` table SHALL have columns: `id` (UUID PK), `type` (string), `item_slug` (string), `message` (text), `created_at` (timestamp), `resolved_at` (timestamp, nullable).

#### Scenario: Alert created with required fields
- **WHEN** a new admin alert is inserted
- **THEN** all NOT NULL fields (`id`, `type`, `item_slug`, `message`, `created_at`) SHALL be populated and `resolved_at` SHALL be NULL
