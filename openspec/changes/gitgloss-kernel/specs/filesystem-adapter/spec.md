## ADDED Requirements

### Requirement: FilesystemContentStoreAdapter reads .md files from a directory
The system SHALL provide a `FilesystemContentStoreAdapter` class implementing `ContentStorePort`. It SHALL accept a `contentDir` path at construction time and scan all `*.md` files in that directory on first access (lazy loading). It SHALL parse YAML frontmatter using `gray-matter` and validate each file's frontmatter against the `CatalogItem` Zod schema.

#### Scenario: Adapter loads all .md files in the directory
- **WHEN** a directory contains 3 valid `.md` files
- **THEN** `listItems()` returns exactly 3 items

#### Scenario: Files with invalid frontmatter are skipped and logged
- **WHEN** a directory contains one valid `.md` file and one with a missing required field
- **THEN** `listItems()` returns only 1 item and a warning is logged to stderr

### Requirement: Identity is always derived from the UUID in frontmatter, never from the filename
The adapter SHALL read the `id` field from frontmatter as the item's identity. The filename (slug) SHALL be treated as a display/routing hint only. The adapter MUST NOT use the filename as an identifier at any point.

#### Scenario: readItem(id) returns the item regardless of filename
- **WHEN** a file named `my-tool.md` has `id: "550e8400-..."` in frontmatter
- **THEN** `readItem("550e8400-...")` returns the item

#### Scenario: Renaming the file does not change the item's identity
- **WHEN** `my-tool.md` is renamed to `renamed-tool.md` (UUID unchanged in frontmatter)
- **THEN** `readItem("550e8400-...")` still returns the same item with the new slug

### Requirement: findBySlug performs a slug-based lookup
The adapter SHALL provide `findBySlug(slug: string): Promise<CatalogItem | null>` that returns the item whose `slug` field matches the given string (exact match, case-sensitive).

#### Scenario: findBySlug returns the correct item
- **WHEN** `findBySlug("my-cool-tool")` is called and one item has `slug: "my-cool-tool"`
- **THEN** that item is returned

#### Scenario: findBySlug returns null for an unknown slug
- **WHEN** `findBySlug("does-not-exist")` is called
- **THEN** `null` is returned

### Requirement: listItems applies the Query via the core engine
When called with a `Query` argument, `listItems(query)` SHALL delegate filtering and sorting to the core engine functions (`filter()`, `search()`, `sort()`). It MUST NOT re-implement any filtering logic itself.

#### Scenario: listItems with status filter returns only matching items
- **WHEN** `listItems({ status: "published" })` is called
- **THEN** only items with `status === "published"` are returned
