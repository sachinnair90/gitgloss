## ADDED Requirements

### Requirement: CatalogQueryPort defines the primary (driving) entry point
The system SHALL define a `CatalogQueryPort` TypeScript interface in `src/core/ports/` with one method: `search(query: Query): Promise<QueryResult>`. All primary adapters (CLI, Astro, test suite) MUST depend on this interface — never on engine functions or `ContentStorePort` directly. The `CatalogService` class SHALL implement this interface.

#### Scenario: search with a Query returns a QueryResult
- **WHEN** `search(query)` is called on a `CatalogQueryPort` implementation
- **THEN** it resolves to a `QueryResult` containing `items` and `total`

#### Scenario: search with an empty Query returns all items
- **WHEN** `search({})` is called
- **THEN** `QueryResult.items` contains all available catalog items

### Requirement: ContentStorePort defines the read-only data access contract
The system SHALL define a `ContentStorePort` TypeScript interface in `src/core/ports/` with three methods: `readItem(id: string): Promise<CatalogItem | null>`, `findBySlug(slug: string): Promise<CatalogItem | null>`, and `listItems(query?: Query): Promise<CatalogItem[]>`. The interface MUST NOT include a `writeItem` method — all writes are handled by `EditorPort`. The core engine MUST depend only on this interface — never on a concrete adapter.

#### Scenario: readItem by UUID returns null for unknown id
- **WHEN** `readItem` is called with a UUID that does not match any stored item
- **THEN** the method resolves to `null`

#### Scenario: findBySlug returns null for unknown slug
- **WHEN** `findBySlug` is called with a slug that does not match any stored item
- **THEN** the method resolves to `null`

#### Scenario: listItems with no query returns all items
- **WHEN** `listItems` is called with no arguments
- **THEN** all available items are returned

### Requirement: EditorPort defines the write/content-management contract
The system SHALL define an `EditorPort` TypeScript interface in `src/core/ports/` with methods: `writeItem(item: CatalogItem): Promise<void>` and `updateItem(id: string, patch: Partial<CatalogItem>): Promise<void>`. EditorPort is the sole owner of all catalog write operations.

#### Scenario: writeItem accepts a valid CatalogItem
- **WHEN** `writeItem` is called with a complete valid `CatalogItem`
- **THEN** it resolves without error
