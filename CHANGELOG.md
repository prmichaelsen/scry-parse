# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] — 2026-05-15

### Changed

- `EntryMarker.implements` type changed from `string | null` to `string[]` (FR11.4).
- `EntryMarker.supersedes` type changed from `string | null` to `string[]` (FR11.4).
- Scalar form for `implements` and `supersedes` is now a hard parse error (FR11.4):
  produces a `level: 'error'` diagnostic and the entry is not indexed.
  Array form (including single-element `[id]`) is the only accepted form.
- `depends_on` behavior unchanged (already array form; silently ignores scalar).

### Added

- 5 new tests: `test-implements-array-form-ok`, `test-singleton-array-form`,
  `test-implements-scalar-form-rejected`, `test-supersedes-scalar-form-rejected`,
  `test-depends-on-array-form-ok`.

### Migration

Markers using scalar form for `implements` or `supersedes` must convert to array form:

```yaml
# Before (now a parse error)
implements: spec.auth~abcd1234

# After
implements: [spec.auth~abcd1234]
```

## [1.0.5] — 2026-05-15

### Fixed

- Phantom markers no longer appear from inside fenced code blocks (`` ``` `` and `~~~`)
  in all file types. Code blocks containing example `@scry.*` syntax are excluded.
- Phantom markers no longer appear from inside TypeScript/JavaScript template literals
  (multi-line backtick strings). Template literal content is tracked across lines.

### Added

- 6 new tests for code-construct exclusion.

## [1.0.4] — 2026-05-15

### Added

- `checkCycles(entries): string[][]` — FR12 cycle detection for `depends_on` graphs.
  DFS with 3-color marking; returns all cycles as ID arrays. External references
  (IDs not in input set) are ignored per spec.
- 10 new tests for cycle detection: no deps, linear chain, self-cycle, simple cycle,
  transitive cycle, disconnected components, external refs ignored, multiple cycles,
  diamond (no cycle), and empty input.

### Changed

- Exported `checkCycles` from package entry point.

## [1.0.1] — 2026-05-14

### Fixed

- Block-comment styles (JSDoc `/** */`, C `/* */`, OCaml `(* *)`, Haskell `{- -}`, PowerShell `<# #>`)
  now parse correctly. Previously only line-comment styles (`#`, `//`, `--`, `;;`, `;`, `<!-- -->`)
  were supported, violating the spec's FR1 universality claim.
- Comment-prefix detection now uses inference from the first YAML-key body line (`inferPrefix`)
  rather than a hardcoded style switch. New comment styles work without parser changes.
- Sentinel detection (`@scry.entry`, `@scry.entry.end`, `@scry.bind`, etc.) now recognizes
  sentinels regardless of surrounding block-comment syntax (e.g. `*` continuation, `/*`, `*/`).

### Added

- 7 new tests for block-comment styles: JSDoc, C-style, OCaml, Haskell, PowerShell, JSDoc binding,
  and a regression test confirming existing line-comment styles are unaffected.

## [1.0.0] — 2026-05-14

### Changed

- Package published under `@prmichaelsen/scry-parse` (scoped namespace, pre-first-publish rename)

### Added

- `parseMarkers(content, file?, language?): ParseResult` — parse `@scry.entry`, `@scry.anchor`, `@scry.bind` markers from any source file
- `validateMarker(marker: Marker): ValidationResult` — validate parsed markers per spec rules (FR4–FR9)
- `mintId(kind, name, content?): string` — generate spec-compliant IDs (deterministic SHA256 or random)
- `BASELINE_KINDS` and `BASELINE_STATUSES` constants
- Full TypeScript type definitions: `EntryMarker`, `AnchorMarker`, `BindingMarker`, `ParseResult`, `ValidationResult`, etc.
- Comment style auto-detection: `//`, `#`, `--`, `;;`, `;`, `<!-- -->`
- Positional exclusion (FR3): bindings inside declarative marker spans excluded
- Block-form binding support (FR2) with deterministic forward-scan disambiguation
- Comma-separated loose anchor expansion (FR6)
- Strict vs loose reference mode detection
- 33-test suite covering all spec Tests 1–19 plus additional edge cases

### Spec conformance

Implements [scry-spec v1.0](https://github.com/prmichaelsen/scry-spec) — FR1 through FR14.
