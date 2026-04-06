## ADDED Requirements

### Requirement: search() performs fuzzy text matching on title, description, and tags
The system SHALL provide a `search(items: CatalogItem[], query: string): CatalogItem[]` pure function using Fuse.js. The function SHALL match against `title`, `description`, and `tags` fields. An empty or whitespace-only query string SHALL return all items unchanged (no filtering). Results SHALL be ordered by Fuse.js relevance score descending; items with equal scores SHALL be secondarily sorted by `createdAt` descending.

#### Scenario: Empty query returns all items
- **WHEN** `search(items, "")` is called
- **THEN** all items are returned in their original order

#### Scenario: Query matching only title returns correct items
- **WHEN** `search(items, "typescript")` is called and two items have "typescript" in their title
- **THEN** both items are returned and items without "typescript" in title/description/tags are not returned

#### Scenario: Fuzzy match catches near-misses
- **WHEN** `search(items, "typescirpt")` is called (typo)
- **THEN** items with "typescript" in their title are still returned

#### Scenario: Query matching a tag returns items with that tag
- **WHEN** `search(items, "react")` is called and an item has `tags: ["react"]`
- **THEN** that item is included in the results

### Requirement: filter() applies strict predicate filters to a list of items
The system SHALL provide a `filter(items: CatalogItem[], query: Query): CatalogItem[]` pure function. It SHALL apply filters in AND combination: `status` (exact match), `tags` (all specified tags must be present in the item — AND intersection), `featured` (exact boolean match). Fields absent from the query SHALL NOT filter on that dimension.

#### Scenario: Filter by status=published returns only published items
- **WHEN** `filter(items, { status: "published" })` is called
- **THEN** only items with `status === "published"` are returned

#### Scenario: Filter by multiple tags applies AND intersection
- **WHEN** `filter(items, { tags: ["react", "typescript"] })` is called
- **THEN** only items that have BOTH "react" AND "typescript" in their tags are returned

#### Scenario: Filter by featured=true returns only featured items
- **WHEN** `filter(items, { featured: true })` is called
- **THEN** only items with `featured === true` are returned

#### Scenario: Empty query object returns all items
- **WHEN** `filter(items, {})` is called
- **THEN** all items are returned unchanged

#### Scenario: Filter with no matches returns empty array
- **WHEN** `filter(items, { status: "archived" })` is called and no items are archived
- **THEN** an empty array is returned

### Requirement: sort() orders items by a specified field and direction
The system SHALL provide a `sort(items: CatalogItem[], sortKey?: string, dir?: "asc" | "desc"): CatalogItem[]` pure function. Supported sort keys: `createdAt`, `updatedAt`, `title`. Default sort SHALL be `createdAt` descending. Sorting MUST NOT mutate the input array.

#### Scenario: Default sort orders by createdAt descending
- **WHEN** `sort(items)` is called with no arguments
- **THEN** items are returned ordered by `createdAt` from newest to oldest

#### Scenario: Sort by title ascending applies alphabetical order
- **WHEN** `sort(items, "title", "asc")` is called
- **THEN** items are ordered alphabetically by title A→Z

#### Scenario: Sort does not mutate the input array
- **WHEN** `sort(items, "title", "desc")` is called
- **THEN** the original `items` array reference is unchanged
