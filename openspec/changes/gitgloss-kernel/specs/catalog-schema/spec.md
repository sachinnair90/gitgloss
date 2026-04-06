## ADDED Requirements

### Requirement: Author sub-type is an object with name and email
The system SHALL define an `Author` type as a Zod object with a required `name` string and a required `email` validated as RFC 5321 email format.

#### Scenario: Valid author parses successfully
- **WHEN** an author object `{ name: "Jane Smith", email: "jane@example.com" }` is parsed
- **THEN** Zod returns success with no errors

#### Scenario: Invalid email is rejected
- **WHEN** an author object `{ name: "Jane", email: "not-an-email" }` is parsed
- **THEN** Zod returns a validation error referencing the `email` field

### Requirement: CatalogItem schema contains all required fields
The system SHALL define a `CatalogItem` Zod schema with the following fields: `id` (UUID string), `slug` (non-empty string), `title` (string, minimum 1 character), `description` (string, maximum 160 characters), `authors` (array of `Author`), `tags` (array of strings), `image` (optional string), `createdAt` (ISO 8601 string), `updatedAt` (ISO 8601 string), `status` (enum: `published` | `draft` | `archived`), `featured` (boolean, defaults to `false`).

#### Scenario: Fully populated item parses successfully
- **WHEN** a complete object matching all field types is parsed against `CatalogItem`
- **THEN** Zod returns success and the output matches the input

#### Scenario: Missing required field is rejected
- **WHEN** an object is parsed with `title` omitted
- **THEN** Zod returns a validation error referencing the `title` field

#### Scenario: Description exceeding 160 characters is rejected
- **WHEN** an object is parsed with `description` containing 161 characters
- **THEN** Zod returns a validation error referencing the `description` field

#### Scenario: Invalid status value is rejected
- **WHEN** an object is parsed with `status: "pending"` (not in the enum)
- **THEN** Zod returns a validation error referencing the `status` field

#### Scenario: featured defaults to false when omitted
- **WHEN** an object is parsed without the `featured` field
- **THEN** Zod returns success and `featured` is `false` in the output

#### Scenario: id must be a valid UUID
- **WHEN** an object is parsed with `id: "not-a-uuid"`
- **THEN** Zod returns a validation error referencing the `id` field

### Requirement: Query type defines filter, search, and sort parameters
The system SHALL define a `Query` type with optional fields: `search` (string for fuzzy text search), `tags` (array of strings for AND intersection filter), `status` (enum matching `CatalogItem.status`), `featured` (boolean), `sort` (enum: `createdAt` | `updatedAt` | `title`), `sortDir` (enum: `asc` | `desc`).

#### Scenario: Empty query is valid
- **WHEN** an empty object `{}` is used as a `Query`
- **THEN** it is valid and results in no filters applied

#### Scenario: Partial query with only status is valid
- **WHEN** `{ status: "published" }` is used as a `Query`
- **THEN** it is valid

### Requirement: QueryResult type wraps the items array with metadata
The system SHALL define a `QueryResult` type containing `items` (array of `CatalogItem`) and `total` (number equal to the count of items returned after filtering).

#### Scenario: QueryResult reflects item count
- **WHEN** a `QueryResult` is constructed with 5 items
- **THEN** `total` equals 5
