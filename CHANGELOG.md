# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-14

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
