## ADDED Requirements

### Requirement: CLI calls the core through CatalogQueryPort
The CLI SHALL NOT call engine functions (`search`, `filter`, `sort`) or `ContentStorePort` directly. It SHALL instantiate a `CatalogService` (implementing `CatalogQueryPort`) and call `service.search(query)` to retrieve results. This enforces the primary adapter contract and keeps the CLI decoupled from core internals.

#### Scenario: CLI retrieves results through CatalogQueryPort
- **WHEN** `gitgloss search "typescript"` is executed
- **THEN** the CLI resolves results via `CatalogQueryPort.search()`, not by calling engine functions directly

### Requirement: gitgloss search command accepts a query string and optional flags
The system SHALL provide a `gitgloss search <query>` one-shot CLI command. It SHALL accept the following optional flags: `--tags <tag1,tag2>` (comma-separated, AND intersection), `--status <published|draft|archived>`, `--sort <createdAt|updatedAt|title>`. The command SHALL print results to stdout and exit with code `0` on success.

#### Scenario: Search with a query string returns matching results
- **WHEN** `gitgloss search "typescript"` is executed against a directory containing items
- **THEN** items matching "typescript" are printed to stdout and the process exits with code 0

#### Scenario: Search with --status flag filters by status
- **WHEN** `gitgloss search "" --status published` is executed
- **THEN** only items with `status: "published"` appear in the output

#### Scenario: Search with --tags flag applies AND filter
- **WHEN** `gitgloss search "" --tags react,typescript` is executed
- **THEN** only items containing both "react" and "typescript" tags are printed

#### Scenario: No results prints an empty state message
- **WHEN** `gitgloss search "xyznonexistent"` returns zero items
- **THEN** a human-readable "No results found" message is printed and the process exits with code 0

### Requirement: CLI reads content from a configurable directory
The CLI SHALL determine the content directory from (in priority order): `--content <path>` flag, `GITGLOSS_CONTENT_DIR` environment variable, default `./content/catalog`. It SHALL pass this path to `FilesystemContentStoreAdapter`.

#### Scenario: --content flag overrides the default directory
- **WHEN** `gitgloss search "" --content ./fixtures` is executed
- **THEN** the CLI reads from `./fixtures` instead of `./content/catalog`

#### Scenario: GITGLOSS_CONTENT_DIR env var is used when no flag is provided
- **WHEN** `GITGLOSS_CONTENT_DIR=./my-content gitgloss search ""` is executed
- **THEN** the CLI reads from `./my-content`

### Requirement: CLI exits with code 1 on unrecoverable errors
If the content directory does not exist, or if a fatal error occurs, the CLI SHALL print an error message to stderr and exit with code `1`.

#### Scenario: Missing content directory causes exit code 1
- **WHEN** `gitgloss search "" --content ./nonexistent` is executed
- **THEN** an error message is printed to stderr and the process exits with code 1

### Requirement: CLI is a dev harness and is not packaged or published externally
The CLI SHALL be invokable via an npm script (e.g., `npm run search -- "query"`) or `npx tsx src/cli/index.ts`. It SHALL NOT be published to npm or distributed as a standalone binary in Phase 1.

#### Scenario: CLI is invokable via npm script
- **WHEN** `npm run search -- "typescript"` is executed
- **THEN** the command runs and returns results as expected
