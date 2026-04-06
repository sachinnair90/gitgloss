## ADDED Requirements

### Requirement: NullEditorAdapter satisfies EditorPort with no-op implementations
The system SHALL provide a `NullEditorAdapter` class implementing `EditorPort`. All methods SHALL resolve immediately with no side effects. The adapter SHALL not throw under any circumstance.

#### Scenario: writeItem resolves without error
- **WHEN** `writeItem(validCatalogItem)` is called on `NullEditorAdapter`
- **THEN** it resolves without throwing

#### Scenario: updateItem resolves without error
- **WHEN** `updateItem(id, patch)` is called on `NullEditorAdapter`
- **THEN** it resolves without throwing

### Requirement: NullEditorAdapter is named to indicate it is a production-valid option
`NullEditorAdapter` SHALL be located in `src/adapters/null/` and named `NullEditorAdapter` (not `MockEditorAdapter`, `StubEditorAdapter`, etc.). It is a first-class production adapter for Version A and Version B deployments where no write functionality is required.

#### Scenario: NullEditorAdapter is importable from the adapters path
- **WHEN** `import { NullEditorAdapter } from '../adapters/null/NullEditorAdapter'` is used
- **THEN** the import resolves without error and the class satisfies the `EditorPort` interface at compile time
