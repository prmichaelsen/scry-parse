# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — Conformance bump to scry-spec v1.1.2

Two bundled doc-only conformance bumps since the last release (v1.1.0).
Both are non-normative spec patches that introduce zero parser change;
the v1.1.0 release at HEAD remains fully conformant.

- **scry-spec v1.1.2** (2026-05-21) added a non-normative "Recommended
  Operating Discipline" section defining five named disciplines for
  scry-consumer tools and agents:
  - D1 — orient by scry before reading files
  - D2 — search for a prior lesson before fixing an unexpected failure
  - D3 — mark every created artifact
  - D4 — author marker fields for the queries that will hit them
  - D5 — use bindings to connect implementations to what they fulfill

  Includes a Canonical Minimal Form intended for verbatim inclusion in
  consumer tool surfaces (MCP `instructions`, CLI help, SDK
  system-prompt fragments). Pure parser libraries have no behavior to
  update; the discipline is content for downstream consumers
  (scry-mcp, scry-vscode, scry-cli, etc.). No FR added or modified.

- **scry-spec v1.1.1** (2026-05-19) is a framing-only patch:
  - Overview rewritten to present discovery/recall (via `@scry.entry`)
    and traceability (via `@scry.bind`) as co-equal purposes.
  - FR14 "Recommended Idiom" sharpened — renamed to "Promote Structural
    Edges to Formal Bindings"; defines a *structural edge* as a
    relationship a future reader will plausibly traverse backward or by
    typed predicate (`depends_on` / `implements` / `supersedes`).

- **No parser change.** The v1.1.0 release at HEAD is fully v1.1.1 +
  v1.1.2 conformant; FR14's normative guarantees are unchanged, no FR
  was added, retired, or modified, and v1.1.2's additions are content
  for consumer-tool surfaces rather than parser behavior. README
  declares v1.1.2 conformance; no republish is necessary.

## [1.1.0] — 2026-05-19

### Conformance

- **scry-spec v1.1.0** — declares conformance against the new spec head.
- **FR4.B (Extras Field — Structured Metadata)** — new optional `extras`
  field on `@scry.entry` markers. Recognized as a known field (no longer
  passed through the FR11.5 unknown-field bucket). Structurally preserved
  as a `Record<string, string | number | boolean | null>` so downstream
  consumers can index it.

### Added

- `EntryMarker.extras: ExtrasMap | null` — `null` when the marker did
  not declare `extras`; a `Record<string, ExtrasValue>` otherwise.
- New exported types `ExtrasValue` and `ExtrasMap` for downstream
  TypeScript consumers.
- Diagnostics (informational warnings, per FR4.B SHOULD-level):
  - `extras` present but empty (`{}`)
  - `extras` declared with `null` value
  - non-mapping top-level shape (scalar, list) — coerced to empty map
  - non-scalar values (nested map, list) — preserved structurally
  - serialized payload above the 4 KB cap — preserved (MUST NOT truncate)

### Backward compatibility

Additive change. Markers without `extras` continue to parse with
`extras: null`. The previously-existing `entry.extra` unknown-field
bucket retains the same shape and is unaffected for all other unknown
fields; only the `extras` key itself was promoted out of it.

### Tests

- 8 new tests covering: field absence, flat-scalar happy path
  (string/number/boolean/null), empty-map diagnostic, nested-map
  diagnostic, list-value diagnostic, 4 KB size-cap diagnostic,
  scalar-at-top-level diagnostic, and promotion out of the unknown
  bucket. Total: 74/74 passing.

## [1.0.9] — 2026-05-15

### Conformance

- scry-spec v1.0.4 — FR11.6 clarification: single-line `@scry.bind` comment field MUST have
  host-language comment closing delimiters stripped (` -->` in HTML comments, ` */` in C-style
  block comments). Implementation was already correct via `extractSentinelContent`; no behavior
  change.

### Tests

- Tests 23–24 added per spec v1.0.4: explicit assertions that ` -->` and ` */` do not appear
  in the `comment` field for HTML-comment-hosted and C-style-block-comment-hosted single-line
  bindings.

## [1.0.8] — 2026-05-15

### Changed

- Updated spec conformance claim to scry-spec v1.0.3 in README.
- FR11.7 note in README now explicitly states the normative v1.0.2 "Behavior on match" clause:
  inert-region markers produce zero records AND zero diagnostics.
- FR11.4 note in README now covers `depends_on` (added in v1.0.7) alongside `implements`/`supersedes`.

### Tests

- Added `expect(result.diagnostics).toHaveLength(0)` assertions to 4 inert-context tests
  (backtick fence, tilde fence, inline code span, JS/TS template literal), verifying the
  normative FR11.7 v1.0.2 "MUST NOT emit diagnostics" clause. Behavior unchanged; tests
  now make conformance explicit.

## [1.0.7] — 2026-05-15

### Fixed

- `depends_on` scalar form is now a hard parse error (FR11.4 consistency fix).
  Previously a scalar `depends_on` value was silently coerced to `[]`, losing the
  declared dependency without any diagnostic. Now consistent with `implements` and
  `supersedes`: scalar form produces a `level: 'error'` diagnostic and the entry
  is not indexed.

### Added

- 1 new test: `test-depends-on-scalar-form-rejected`.

## [1.0.6] — 2026-05-15

### Changed

- `EntryMarker.implements` type changed from `string | null` to `string[]` (FR11.4).
- `EntryMarker.supersedes` type changed from `string | null` to `string[]` (FR11.4).
- Scalar form for `implements` and `supersedes` is now a hard parse error (FR11.4):
  produces a `level: 'error'` diagnostic and the entry is not indexed.
  Array form (including single-element `[id]`) is the only accepted form.
- `depends_on` behavior unchanged in this release (scalar silently ignored; fixed in v1.0.7).

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
