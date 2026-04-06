## 1. Repo Scaffold & Tooling

- [ ] 1.1 Initialise `package.json` with `type: "module"`, name `@gitgloss/kernel`, and scripts: `search`, `test`, `build`
- [ ] 1.2 Add `tsconfig.json` with `strict: true`, `moduleResolution: bundler`, output to `dist/`, path aliases for `#core`, `#adapters`, `#cli`
- [ ] 1.3 Install runtime dependencies: `zod`, `gray-matter`, `fuse.js`, `commander`
- [ ] 1.4 Install dev dependencies: `typescript`, `vitest`, `tsx`, `@types/node`
- [ ] 1.5 Create directory skeleton: `src/core/domain/`, `src/core/ports/`, `src/core/engine/`, `src/adapters/filesystem/`, `src/adapters/null/`, `src/cli/`, `content/catalog/`

## 2. Domain Schema

- [ ] 2.1 Create `src/core/domain/schema.ts`: define `Author` Zod object (`name`, `email`)
- [ ] 2.2 Add `CatalogItem` Zod schema to `schema.ts` with all 12 fields as specified; export inferred TypeScript type `CatalogItem`
- [ ] 2.3 Add `Query` Zod schema to `schema.ts` (all fields optional: `search`, `tags`, `status`, `featured`, `sort`, `sortDir`); export type
- [ ] 2.4 Add `QueryResult` type to `schema.ts` (`items: CatalogItem[]`, `total: number`); export type

## 3. Port Interfaces

- [ ] 3.1 Create `src/core/ports/ContentStorePort.ts`: export interface with `readItem`, `findBySlug`, `listItems` signatures (read-only; no `writeItem`)
- [ ] 3.2 Create `src/core/ports/EditorPort.ts`: export `EditorPort` interface with `writeItem(item: CatalogItem): Promise<void>`, `updateItem(id: string, patch: Partial<CatalogItem>): Promise<void>`
- [ ] 3.3 Create `src/core/ports/CatalogQueryPort.ts`: export `CatalogQueryPort` interface with `search(query: Query): Promise<QueryResult>`
- [ ] 3.4 Create `src/core/ports/index.ts` barrel export for all three ports

## 4. Core Engine (Pure Functions)

- [ ] 4.1 Create `src/core/engine/search.ts`: implement `search(items, query)` using Fuse.js; empty query returns all items; secondary sort by `createdAt` DESC for equal scores
- [ ] 4.2 Create `src/core/engine/filter.ts`: implement `filter(items, query)` applying `status`, `tags` (AND), and `featured` predicates in combination
- [ ] 4.3 Create `src/core/engine/sort.ts`: implement `sort(items, sortKey?, dir?)` — default `createdAt` DESC; must not mutate input array
- [ ] 4.4 Create `src/core/engine/index.ts` barrel export for `search`, `filter`, `sort`
- [ ] 4.5 Create `src/core/CatalogService.ts`: implement `CatalogQueryPort`; constructor accepts `ContentStorePort`; `search(query)` calls `listItems(query)` on the store and wraps the result in `QueryResult`

## 5. Filesystem Adapter

- [ ] 5.1 Create `src/adapters/filesystem/FilesystemContentStoreAdapter.ts`: implement `ContentStorePort`; constructor accepts `contentDir: string`
- [ ] 5.2 Implement lazy directory scan: glob all `*.md` files in `contentDir` on first `listItems`/`readItem` call; cache in memory
- [ ] 5.3 Parse each file with `gray-matter`; validate frontmatter with `CatalogItem.safeParse()`; log warnings to stderr for invalid files and skip them
- [ ] 5.4 Implement `readItem(id)`: look up by UUID from in-memory map; return `null` if not found
- [ ] 5.5 Implement `findBySlug(slug)`: look up by `slug` field; return `null` if not found
- [ ] 5.6 Implement `listItems(query?)`: load all items, apply `filter()`, `search()`, `sort()` from core engine if query provided

## 6. Null Adapters

- [ ] 6.1 Create `src/adapters/null/NullEditorAdapter.ts`: implement `EditorPort`; all methods resolve silently
- [ ] 6.2 Create `src/adapters/null/index.ts` barrel export for `NullEditorAdapter`

## 7. CLI Presenter

- [ ] 7.1 Create `src/cli/index.ts`: set up `commander` program with name `gitgloss` and `search` subcommand
- [ ] 7.2 Add `search` command options: `[query]` positional, `--tags <tags>`, `--status <status>`, `--sort <field>`, `--content <path>`
- [ ] 7.3 Resolve content directory in priority order: `--content` flag → `GITGLOSS_CONTENT_DIR` env → `./content/catalog`
- [ ] 7.4 Instantiate `FilesystemContentStoreAdapter` and `CatalogService`; call `service.search(query)` through `CatalogQueryPort`; `console.log` each result (title, slug, status, tags)
- [ ] 7.5 Print "No results found." when result array is empty; exit with code 0
- [ ] 7.6 Catch errors: missing directory → print to stderr, `process.exit(1)`
- [ ] 7.7 Add `"search": "tsx src/cli/index.ts"` npm script to `package.json`

## 8. Fixture Content

- [ ] 8.1 Create 10+ sample `.md` files in `content/catalog/` with valid frontmatter covering: all three `status` values, `featured: true` and `featured: false`, multi-author entries (2+ authors), items with multiple tags, item with `image` field set, item with `image` omitted
- [ ] 8.2 Verify all fixture files pass `CatalogItem` Zod validation by running `npm run search -- ""`

## 9. Tests

- [ ] 9.1 Create `src/core/engine/__tests__/search.test.ts`: test empty query passthrough, title match, fuzzy typo match, tag match
- [ ] 9.2 Create `src/core/engine/__tests__/filter.test.ts`: test status filter, multi-tag AND intersection, featured filter, empty query returns all, no-match returns empty array
- [ ] 9.3 Create `src/core/engine/__tests__/sort.test.ts`: test default createdAt DESC, title ASC alphabetical order, immutability (input array not mutated)
- [ ] 9.4 Create `src/core/domain/__tests__/schema.test.ts`: test all CatalogItem validation scenarios from spec (valid full item, missing required field, description > 160 chars, invalid status, featured default, invalid UUID, valid/invalid Author email)
- [ ] 9.5 Create `src/adapters/filesystem/__tests__/FilesystemContentStoreAdapter.test.ts`: use a temp directory of fixture files; test `listItems` count, `readItem` by UUID, `findBySlug`, invalid file skipped, `writeItem` throws
- [ ] 9.6 Create `src/adapters/null/__tests__/NullAdapters.test.ts`: test all `NullEditorAdapter` methods resolve without error
- [ ] 9.7 Run full test suite (`npm test`) — all tests must pass with no TypeScript errors
