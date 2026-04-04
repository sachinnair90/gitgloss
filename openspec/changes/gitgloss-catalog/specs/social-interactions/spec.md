## ADDED Requirements

### Requirement: Only authenticated (verified or admin) users can like or comment
Guest users SHALL be able to view likes and comments but SHALL NOT be able to submit a like or post a comment. Any unauthenticated request to the like or comment endpoints SHALL be rejected with 401.

#### Scenario: Guest like attempt is rejected
- **WHEN** an unauthenticated user sends a POST to the like endpoint
- **THEN** the API SHALL return 401 Unauthorized

#### Scenario: Guest comment attempt is rejected
- **WHEN** an unauthenticated user submits the comment form
- **THEN** the API SHALL return 401 Unauthorized

### Requirement: Like is fire-and-forget and increments a counter
A POST to the like endpoint SHALL increment `interactions.count` for the given `item_slug` by 1. There is no unlike operation. The updated count SHALL be reflected in the UI within 200ms.

#### Scenario: Verified user likes an item
- **WHEN** a verified user clicks the like button on an item
- **THEN** `interactions.count` for that `item_slug` SHALL increase by 1 and the new count SHALL be displayed in the UI

#### Scenario: Like is idempotent within the rate limit window
- **WHEN** a user sends multiple like requests within the rate limit window
- **THEN** only the first SHALL be counted; subsequent requests within the window SHALL be rejected with 429

### Requirement: Like endpoint enforces rate limiting
The like endpoint SHALL allow a maximum of 10 like requests per minute per IP address. Requests exceeding this limit SHALL receive a 429 Too Many Requests response. Rate limit state is stored in-memory on the function instance.

#### Scenario: Rate limit reached
- **WHEN** an IP address has sent 10 like requests within the current minute
- **THEN** the 11th request SHALL receive a 429 response

### Requirement: Comments are flat and go live immediately for verified users
Verified users' comments SHALL be stored in the `comments` table and be immediately visible to all users. There is no moderation queue for verified users. Comments are flat (no threading).

#### Scenario: Verified user comment is immediately visible
- **WHEN** a verified user submits a comment on an item
- **THEN** the comment SHALL appear in the item's comment section without any admin action

#### Scenario: Comment body cannot be empty
- **WHEN** a user submits a comment with an empty body
- **THEN** the API SHALL return 400 Bad Request and no record SHALL be inserted

### Requirement: Admins can hard-delete any comment
Admin users SHALL be able to permanently delete any comment from the moderation dashboard. Deleted comments SHALL be immediately removed from all views.

#### Scenario: Admin deletes abusive comment
- **WHEN** an admin clicks delete on a comment in the moderation dashboard
- **THEN** the comment record SHALL be permanently deleted from the database and SHALL no longer appear on the item page

### Requirement: Comments table schema includes user_id
The `comments` table SHALL have columns: `id` (UUID PK), `item_slug` (FK), `user_id` (UUID FK → users), `body` (text, NOT NULL), `created_at` (timestamp). The `author` display name SHALL be derived from `users.display_name` at query time.

#### Scenario: Comment references valid user
- **WHEN** a comment is inserted
- **THEN** `user_id` SHALL reference an existing record in the `users` table
