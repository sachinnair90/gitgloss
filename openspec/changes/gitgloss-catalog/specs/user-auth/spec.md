## ADDED Requirements

### Requirement: AuthPort defines the internal user boundary
The core domain SHALL define an `AuthPort` interface that returns an `AppUser` (with `id`, `role`, `displayName`, `email`) given a request object. All business logic SHALL depend only on `AppUser`, never on provider-specific identity objects.

#### Scenario: Auth adapter returns AppUser from provider token
- **WHEN** a request contains a valid Azure SWA `x-ms-client-principal` header
- **THEN** the `AzureSWAAuthAdapter` SHALL return a populated `AppUser` with the correct `id`, `role`, `displayName`, and `email`

#### Scenario: Missing auth token returns null
- **WHEN** a request contains no valid auth token
- **THEN** `AuthPort.getCurrentUser()` SHALL return `null`

### Requirement: Three user tiers: guest, verified, admin
The system SHALL recognise three tiers. Guests are unauthenticated. Verified users have authenticated via the provider and have `role = 'verified'` in the `users` table. Admins have `role = 'admin'`.

#### Scenario: New authenticated user defaults to verified
- **WHEN** a user logs in for the first time and their email is NOT in `ADMIN_EMAILS`
- **THEN** a `users` record SHALL be created with `role = 'verified'`

#### Scenario: Guest cannot access protected actions
- **WHEN** an unauthenticated request reaches a protected endpoint
- **THEN** the system SHALL return 401 Unauthorized

### Requirement: Admin bootstrap via ADMIN_EMAILS environment variable
On first login, if the authenticated user's email matches any entry in the `ADMIN_EMAILS` environment variable (comma-separated), the system SHALL upsert the user record with `role = 'admin'`.

#### Scenario: Matching email on first login grants admin
- **WHEN** a user whose email is listed in `ADMIN_EMAILS` logs in for the first time
- **THEN** their `users` record SHALL be created with `role = 'admin'`

#### Scenario: Non-matching email on first login grants verified
- **WHEN** a user whose email is NOT in `ADMIN_EMAILS` logs in for the first time
- **THEN** their `users` record SHALL be created with `role = 'verified'`

### Requirement: Users table stores roles and identity
The `users` table SHALL have columns: `id` (UUID PK), `provider` (string), `provider_id` (string), `display_name` (string), `email` (string), `role` (enum: `admin|verified`), `created_at` (timestamp). The combination of (`provider`, `provider_id`) SHALL be unique.

#### Scenario: Duplicate login is idempotent
- **WHEN** an existing user logs in again
- **THEN** the system SHALL not create a duplicate record; instead it SHALL return the existing `AppUser`

### Requirement: Auth adapter is swappable with no core logic changes
The `AuthPort` implementation SHALL be injected via dependency injection. Replacing the Azure SWA adapter with another provider SHALL require no changes to core business logic or API route handlers.

#### Scenario: Adapter swap does not change AppUser shape
- **WHEN** the auth adapter is replaced
- **THEN** all core domain functions that consume `AppUser` SHALL continue to work without modification
