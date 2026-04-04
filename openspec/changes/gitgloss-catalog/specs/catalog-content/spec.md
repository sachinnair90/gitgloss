## ADDED Requirements

### Requirement: Item frontmatter is validated with Zod and contains no database foreign keys
Every catalog item Markdown file SHALL have frontmatter that conforms to the base `ItemSchema` Zod schema. The schema SHALL NOT include any database foreign keys or record IDs. The `author` field is an object containing `name` (display name string) and `email` (string). Required base fields: `id` (UUID), `title` (min 3 chars), `description` (max 160 chars), `tags` (string array), `image` (string, relative path or URL), `date`, `featured` (boolean, default false), `updatedAt` (timestamp), `author` (`{ name: string, email: string }`), `archived` (boolean, default false).

#### Scenario: Valid frontmatter passes schema validation
- **WHEN** a Markdown file is processed at build time with all required fields present and valid
- **THEN** the system SHALL generate the item's catalog page without errors

#### Scenario: Missing required field fails validation
- **WHEN** a Markdown file is missing the `id` or `title` field
- **THEN** the Astro build SHALL throw a validation error and halt

#### Scenario: `archived` item is excluded from build
- **WHEN** a Markdown file has `archived: true` in frontmatter
- **THEN** the item SHALL NOT appear in the built catalog or `search.json`

### Requirement: Content is stored as Markdown files in Git
The system SHALL store each catalog item as a `.md` file under a designated content directory in the Git repository. The file path SHALL be derived from the item's `id` (UUID).

#### Scenario: Item file path is deterministic
- **WHEN** a new item is created with a given UUID
- **THEN** the file SHALL be written to `content/catalog/<uuid>.md`

### Requirement: Build generates a static catalog
At build time the system SHALL compile all non-archived catalog items into a paginated HTML catalog and a `public/search.json` index file.

#### Scenario: search.json is generated at build
- **WHEN** the Astro build completes successfully
- **THEN** `public/search.json` SHALL contain an array of objects with `id`, `title`, `description`, `tags`, `author`, and `date` for every non-archived item

#### Scenario: Archived items absent from search.json
- **WHEN** an item has `archived: true`
- **THEN** it SHALL NOT appear in `public/search.json`

### Requirement: Item lifecycle supports create, edit, and soft-delete
The system SHALL support three item operations: create (new `.md` file), edit (updated `.md` file), and soft-delete (`archived: true` in frontmatter). Hard delete is not supported in v1. Any `verified` or `admin` user may create items. Edit and soft-delete during the shadow cache phase are permitted to the item's author (matched by `shadow_cache.author_id` in DB) or any admin. Once promoted to the static site (shadow cache cleaned up), edit and delete require admin role.

#### Scenario: Verified user creates an item
- **WHEN** a verified user submits the content submission form
- **THEN** a new `.md` file SHALL be committed to Git and a `shadow_cache` record SHALL be created with `author_id` set to the submitting user's `id`; the frontmatter `author` field SHALL contain `{ name: users.display_name, email: users.email }`

#### Scenario: Edit updates frontmatter and body
- **WHEN** an author (via shadow_cache check) or admin edits an item and saves
- **THEN** the `.md` file SHALL be committed with updated frontmatter (`updatedAt` refreshed) and the updated body content

#### Scenario: Non-author verified user cannot edit
- **WHEN** a verified user attempts to edit an item they did not author
- **THEN** the API SHALL return 403 Forbidden

#### Scenario: Soft-delete sets archived flag
- **WHEN** the item's author (shadow_cache phase) or an admin deletes an item
- **THEN** the `.md` file SHALL be committed with `archived: true` and the item SHALL be hidden from the merged frontend view immediately

### Requirement: Base frontmatter schema is extensible per deployment
The system SHALL support a deployment-specific schema extension that adds extra fields beyond the base `ItemSchema`. Extensions are defined as additional Zod field definitions in a configuration file (`content.config.ts` or equivalent). Extended fields SHALL be validated at build time and SHALL be rendered as form inputs in the item creation and edit forms.

#### Scenario: Deployment adds a custom field
- **WHEN** a deployment defines an extra field (e.g., `location: z.string().optional()`) in the schema extension config
- **THEN** that field SHALL be validated in all `.md` files at build time and SHALL appear as an input in the creation and edit forms

#### Scenario: Item missing optional extended field passes validation
- **WHEN** an extended field is marked optional and a `.md` file does not include it
- **THEN** the Astro build SHALL succeed without errors

#### Scenario: Item missing required extended field fails validation
- **WHEN** an extended field is marked required and a `.md` file does not include it
- **THEN** the Astro build SHALL throw a validation error
