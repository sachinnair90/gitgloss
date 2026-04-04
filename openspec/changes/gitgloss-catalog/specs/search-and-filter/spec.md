## ADDED Requirements

### Requirement: Fuzzy search uses Fuse.js against search.json
The frontend SHALL load `search.json` and use Fuse.js to perform fuzzy search against the `title` and `description` fields only. Search results SHALL update as the user types with no page reload.

#### Scenario: Partial title match returns result
- **WHEN** a user types a partial word matching an item's title
- **THEN** the matching items SHALL appear in the results list within 100ms

#### Scenario: No match returns empty state
- **WHEN** no item title or description fuzzy-matches the query
- **THEN** the system SHALL display an empty state message

### Requirement: Faceted filters apply to search results
The frontend SHALL support filtering by `tags`, `author`, and `date` as client-side facets. Facet filters are applied on top of (or independently of) the fuzzy search results.

#### Scenario: Tag filter narrows results
- **WHEN** a user selects one or more tags from the filter panel
- **THEN** only items containing ALL selected tags SHALL be displayed

#### Scenario: Date filter limits to range
- **WHEN** a user selects a date range
- **THEN** only items with `date` within that range SHALL be displayed

#### Scenario: Combined query and facet filter
- **WHEN** a user has an active search query and selects a tag filter
- **THEN** results SHALL match both the fuzzy query AND the tag filter

### Requirement: All active filters and search query are persisted in the URL
Every change to the search query, active tags, author, date range, or sort order SHALL be immediately reflected in the page URL as query parameters. No full page reload occurs.

#### Scenario: Filter state survives page share
- **WHEN** a user copies the URL with active filters and opens it in a new tab
- **THEN** the same filters and search query SHALL be active on load

#### Scenario: Clearing filters updates URL
- **WHEN** a user clears all active filters
- **THEN** the URL SHALL revert to the base path with no query parameters

### Requirement: Sort order is user-selectable
The frontend SHALL support sorting results by `date` (newest first, default) and `popular` (most likes).

#### Scenario: Default sort is newest first
- **WHEN** a user visits the catalog with no sort parameter
- **THEN** items SHALL be ordered by `date` descending

#### Scenario: Popular sort orders by like count
- **WHEN** `?sort=popular` is in the URL
- **THEN** items SHALL be ordered by `interactions.count` descending
