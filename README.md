# scry-parse

TypeScript parser for [scry-spec v1.0](https://github.com/prmichaelsen/scry-spec) markers.

Parse, validate, and mint `@scry.entry`, `@scry.anchor`, and `@scry.bind` markers from any source file.

## Install

```bash
npm install @prmichaelsen/scry-parse
```

## Usage

```typescript
import { parseMarkers, validateMarker, mintId } from '@prmichaelsen/scry-parse';

// Parse markers from file content
const result = parseMarkers(content, 'src/auth.ts');

console.log(result.entries);   // EntryMarker[]
console.log(result.anchors);   // AnchorMarker[]
console.log(result.bindings);  // BindingMarker[]
console.log(result.diagnostics); // Diagnostic[]

// Validate a parsed marker
const vr = validateMarker(result.entries[0]);
if (!vr.ok) {
  console.error(vr.errors);
}

// Mint a new ID
const id = mintId('design', 'auth-flow', 'optional-content-for-deterministic-hash');
// => "design.auth-flow~a1b2c3d4"
```

## API

### `parseMarkers(content, file?, language?): ParseResult`

Parse all scry markers from `content`. Comment style is auto-detected from the sentinel line.

**Supported comment styles** (auto-detected from sentinel line):

Line comments: `//` (TypeScript/JS/C/Java/Rust), `#` (Python/Shell/Ruby/YAML), `--` (SQL/Haskell), `;;` / `;` (Lisp/Clojure), `<!-- -->` (Markdown/HTML).

Block comments: `/** */` / `/* */` (JSDoc/C-style), `(* *)` (OCaml/Pascal), `{- -}` (Haskell), `<# #>` (PowerShell).

Returns:
```typescript
interface ParseResult {
  entries: EntryMarker[];
  anchors: AnchorMarker[];
  bindings: BindingMarker[];
  diagnostics: Diagnostic[];
}
```

### `validateMarker(marker: Marker): ValidationResult`

Validate a parsed marker against spec rules (FR4, FR5, FR6, FR7, FR8, FR9).

- Unknown `kind` values produce a **warning** (not an error) — preserved as-authored per FR8
- Unknown `status` values produce a **warning** — preserved as-authored per FR9

### `mintId(kind, name, content?): string`

Generate a spec-compliant marker ID: `{kind}.{name}~{hash}`.

- With `content`: deterministic SHA256 hash (stable across calls)
- Without `content`: random 8-char hex

## Types

```typescript
interface EntryMarker {
  id: string;
  kind: string;
  summary: string;
  status: string;
  weight: number | null;
  tags: string[];
  rationale: string;
  applies: string;
  seededQuestions: string[];
  dependsOn: string[];
  implements: string[];      // FR11.4: array form only; scalar is a parse error
  supersedes: string[];      // FR11.4: array form only; scalar is a parse error
  extra: Record<string, unknown>; // FR10: unknown fields preserved
  file: string;
  span: [number, number]; // [startLine, endLine], 0-indexed
}

interface AnchorMarker {
  name: string;        // anchor-id: {name}~{hash}
  description: string;
  seededQuestions: string[];
  file: string;
  span: [number, number];
}

interface BindingMarker {
  localId: string;
  ref: string;
  mode: 'loose' | 'strict';
  comment: string | null;
  file: string;
  offset: number;      // line offset, 0-indexed
  span: [number, number] | null; // null for single-line, [start, end] for block
}
```

## Constants

```typescript
import { BASELINE_KINDS, BASELINE_STATUSES } from '@prmichaelsen/scry-parse';

BASELINE_KINDS   // ['design', 'pattern', 'spec', 'lesson', 'internal', 'task', 'milestone', 'report', 'audit', 'research', 'code']
BASELINE_STATUSES // ['draft', 'active', 'deprecated']
```

## Spec conformance

Implements [scry-spec v1.0](https://github.com/prmichaelsen/scry-spec) (FR1–FR14):

- ✅ FR1: Declarative marker sentinel syntax (5 line-comment + 5 block-comment styles)
- ✅ FR2: Binding marker format (single-line + block form, mutual exclusion)
- ✅ FR3: Positional exclusion (bindings inside declarative spans excluded)
- ✅ FR4: Entry marker body (required fields, required-empty-allowed, optional)
- ✅ FR5: Anchor marker body
- ✅ FR6: Binding references (loose and strict modes, comma expansion, artifact-level)
- ✅ FR7: ID format validation
- ✅ FR8: Kind enumeration (unknown kinds preserved as-authored)
- ✅ FR9: Status (unknown values preserved as-authored)
- ✅ FR10: Extension philosophy (unknown fields preserved)
- ✅ FR11: Parsing rules (deterministic forward scan, body extraction, YAML parsing)
  - ✅ FR11.4: Relationship fields (`implements`, `supersedes`) enforce array form; scalar is a parse error
  - ✅ FR11.7: Inert context detection — markers inside fenced code blocks, inline code, and JS/TS template literals are not extracted
- ✅ FR12: Relationship semantics (depends_on extracted)
- ✅ FR13: Binding semantics (any-to-any allowed)
- ✅ FR14: Soft references (not parsed — spec-correct)

## License

MIT
