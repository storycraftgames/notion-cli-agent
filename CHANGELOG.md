# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Notion API version upgraded from `2022-06-28` to `2025-09-03`** — all database operations now route through `/v1/data_sources/` endpoints natively. No user-facing changes; the CLI abstracts the API version entirely.
- Database resolver simplified by 72 lines (-23%) — removed legacy try-first fallback and version override hack.
- Search filter `--type database` now maps to the API's `data_source` object type transparently.

## [0.8.2] - 2026-03-21

### Fixed

- `--version` flag now returns the actual package version instead of hardcoded `0.4.2` (#23)

## [0.8.1] - 2026-03-21

### Security

- Pinned `flatted` >= 3.4.2 via `pnpm.overrides` to fix 2 high-severity advisories (unbounded recursion DoS + prototype pollution via `parse()`, via eslint > flat-cache)

### Changed

- Updated `vitest` 2.1.9 -> 4.1.0
- Updated `@types/node` 22.19.8 -> 22.19.15
- `pnpm audit`: 0 vulnerabilities

## [0.8.0] - 2026-03-21

### Added

- **Multi-data-source database support** — Databases with multiple data sources (merged databases) now work transparently. The new `database-resolver.ts` auto-detects multi-DS databases and routes requests to `/v1/data_sources/` instead of failing with a 400 error.
- **`--data-source-id` global option** — Bypass auto-detection by specifying the data source ID explicitly on any command.
- **`queryAllPages()` helper** — Paginated fetch with filter/sort/limit/onProgress, replacing 5 duplicate pagination loops across commands.
- **`withErrorHandler()` utility** — Eliminates 37 identical try/catch blocks across 19 command files.

### Changed

- All 37 hardcoded `databases/${id}` call-sites migrated to resolver helpers (`getDatabaseSchema()`, `queryDatabase()`, `updateDatabase()`). Future API version migration only requires changes to `database-resolver.ts`.
- `inspect workspace` now shows `[multi-source]` tag and data source IDs for multi-DS databases, with graceful handling when properties are unavailable.
- Inline `PaginatedResponse` type casts replaced with canonical `PaginatedResponse<T>` from `types/notion.ts`.
- `export database` now uses `queryAllPages()` instead of its own cursor loop.

### Fixed

- `db query` now preserves multiple repeated filter groups passed via `--filter-prop` / `--filter-type` / `--filter-value` / `--filter-prop-type` instead of silently keeping only the last one. Multiple groups are sent as Notion compound filters (`{ and: [...] }`), and mismatched flag counts now fail with a clear error.
- `--filter-prop-type` count is now validated against `--filter-prop` count to prevent silent positional shift.
- Notion onboarding skill description YAML frontmatter fixed.

## [0.7.0] - 2026-03-10

## [0.6.0] - 2026-03-07

### Added

- **`pages read`** — Export any Notion page as Markdown to stdout or a file. Supports `--json` for raw block output, `--no-title` to omit the heading, and `-o <path>` to write to a file directly. Handles recursive child blocks.
- **`pages write`** — Write Markdown content into a Notion page from a file or stdin. Default behaviour is append; `--replace` removes all existing blocks first (DESTRUCTIVE — warns before executing). Chunks at 100 blocks respecting the Notion API limit.
- **`pages edit`** — Surgical block-level editing: delete, insert, or replace blocks at a specific index (`--at`) or after a block ID (`--after`). Supports `--delete <count>`, `--file`, and `--markdown`. Includes `--dry-run` to preview the edit plan.

### Changed

- **Shared utilities** — Extracted duplicated code from 15 command files into three new shared modules:
  - `src/types/notion.ts` — Centralised Notion API types (`Block`, `Page`, `Database`, `RichText`, etc.)
  - `src/utils/markdown.ts` — Bidirectional Markdown ↔ Notion block conversion with full inline formatting support (bold, italic, code, strikethrough, links)
  - `src/utils/notion-helpers.ts` — Shared helpers (`fetchAllBlocks`, `blocksToMarkdownAsync`, `getPageTitle`, `getDbTitle`, `getPropertyValue`)
- **Inline formatting in block commands** — `blocks create` and similar commands now produce proper Notion rich_text annotations when input contains Markdown formatting (e.g. `**bold** text`).
- **Backup Markdown output** — `backup` now renders rich_text annotations (bold, italic, code, links) instead of plain text.
- **`page write --replace` safety** — Warns with block count before deleting, surfaces partial-deletion errors with block IDs, and reports write progress on failure.
- **`page edit` atomicity warning** — Deletion loop now warns that the operation is not atomic; partial failure will leave the page in an intermediate state.

### Fixed

- Committed `dist/` artefacts removed from the repository (were incorrectly tracked despite `.gitignore`).
- `backup.ts` no longer crashes when `created_time` or `last_edited_time` is missing from a page response.

### Security

- Pinned transitive devDependency versions via `pnpm.overrides` to resolve 5 Dependabot alerts:
  - `minimatch` ≥ 3.1.4 — ReDoS via nested extglobs and repeated wildcards (3 CVEs, via eslint)
  - `rollup` ≥ 4.59.0 — Arbitrary file write via path traversal (via vitest/vite)
  - `ajv` ≥ 6.14.0 — ReDoS when using `$data` option (via eslint)
  - All affected packages are devDependencies with no runtime exposure.

---

## [0.5.0] - 2026-02-17

### Added

- **Rate limiting and retry** — API client enforces 3 req/s and auto-retries on 429/5xx with exponential backoff. Respects `Retry-After`. Configurable via `maxRetries` and `requestsPerSecond`.
- **Parallel batch operations** — `batch` now runs in parallel (default concurrency 3). New flags: `--concurrency <n>`, `--sequential`. Per-operation timing in `--llm` output.
- **Duplicate detection** — `validate lint` detects duplicate page titles in databases.
- **Health recommendations** — `validate health` outputs actionable recommendations.

### Changed

- **Weighted validation scoring** — `validate check` uses weighted health scoring: fill rate 30%, errors 30%, warnings 20%, timeliness 20%.

### Fixed

- `find` date pattern matching — specific patterns (`modified today`, `created today`) now matched before generic fallbacks; fixes operator precedence in Spanish patterns.

---

## [0.4.3] - 2026-02-17

Initial public release.
