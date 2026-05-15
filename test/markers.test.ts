import { describe, it, expect } from 'vitest';
import type { EntryMarker } from '../src/markers.js';
import { checkCycles } from '../src/cycles.js';
import { parseMarkers } from '../src/markers.js';
import { validateMarker } from '../src/validate.js';
import { mintId } from '../src/mint.js';
import { BASELINE_KINDS, BASELINE_STATUSES, ID_REGEX } from '../src/consts.js';

// ---------------------------------------------------------------------------
// Test 1: Valid entry marker (markdown)
// ---------------------------------------------------------------------------
describe('Test 1: Valid entry marker', () => {
  it('parses a well-formed entry in markdown', () => {
    const content = `<!-- @scry.entry
id: design.test~12345678
kind: design
summary: Test design
status: active
rationale: testing
applies: tests
seeded_questions: []
tags: []
weight: 0.5
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('design.test~12345678');
    expect(result.entries[0].kind).toBe('design');
    expect(result.entries[0].summary).toBe('Test design');
    expect(result.entries[0].status).toBe('active');
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Valid anchor marker
// ---------------------------------------------------------------------------
describe('Test 2: Valid anchor marker', () => {
  it('parses an anchor marker with correct name', () => {
    const content = `<!-- @scry.anchor test-anchor~abcd1234
description: Test anchor for unit tests
seeded_questions:
@scry.anchor.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.anchors).toHaveLength(1);
    expect(result.anchors[0].name).toBe('test-anchor~abcd1234');
    expect(result.anchors[0].description).toBe('Test anchor for unit tests');
  });
});

// ---------------------------------------------------------------------------
// Test 3: Line markers with references
// ---------------------------------------------------------------------------
describe('Test 3: Line markers with references', () => {
  it('extracts two bind markers with correct refs (Python style)', () => {
    const content = `# @scry.bind validate-jwt~a1b2c3d4 spec.auth~abcd1234#FR3
# @scry.bind jwt-expiry~b2c3d4e5 spec.auth~abcd1234#UT1`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(2);
    expect(result.bindings[0].localId).toBe('validate-jwt~a1b2c3d4');
    expect(result.bindings[0].ref).toBe('spec.auth~abcd1234#FR3');
    expect(result.bindings[0].mode).toBe('loose');
    expect(result.bindings[1].localId).toBe('jwt-expiry~b2c3d4e5');
    expect(result.bindings[1].ref).toBe('spec.auth~abcd1234#UT1');
    expect(result.bindings[1].mode).toBe('loose');
  });
});

// ---------------------------------------------------------------------------
// Test 4: Multiple entries in one file
// ---------------------------------------------------------------------------
describe('Test 4: Multiple entries in one file', () => {
  it('extracts two entry markers from Python source', () => {
    const content = `# @scry.entry
# id: code.func1~aaaa1111
# kind: code
# summary: Function 1
# status: active
# rationale:
# applies:
# seeded_questions:
# tags:
# weight:
# @scry.entry.end
def func1(): pass

# @scry.entry
# id: code.func2~bbbb2222
# kind: code
# summary: Function 2
# status: active
# rationale:
# applies:
# seeded_questions:
# tags:
# weight:
# @scry.entry.end
def func2(): pass`;
    const result = parseMarkers(content, 'test.py');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].id).toBe('code.func1~aaaa1111');
    expect(result.entries[1].id).toBe('code.func2~bbbb2222');
  });
});

// ---------------------------------------------------------------------------
// Test 5: Line marker inside block span (FR3 positional exclusion)
// ---------------------------------------------------------------------------
describe('Test 5: Positional exclusion FR3', () => {
  it('excludes @scry.bind inside @scry.entry body', () => {
    const content = `<!-- @scry.entry
id: design.example~12345678
kind: design
summary: >
  # @scry.bind my-impl~abcd1234 spec.foo~12345678#FR1
  This should NOT be indexed
status: active
rationale:
applies:
seeded_questions:
tags:
weight:
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(1);
    expect(result.bindings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Unterminated block
// ---------------------------------------------------------------------------
describe('Test 6: Unterminated entry block', () => {
  it('does not index an unterminated entry marker', () => {
    const content = `<!-- @scry.entry
id: design.broken~12345678
kind: design
summary: Test
status: active`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(0);
    expect(result.diagnostics.some(d => d.level === 'warning' && d.message.includes('Unterminated'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Unknown kind preserved as-is (FR8)
// ---------------------------------------------------------------------------
describe('Test 7: Unknown kind preserved as-is', () => {
  it('preserves custom_kind without coercion', () => {
    const content = `<!-- @scry.entry
id: unknown.test~12345678
kind: custom_kind
summary: Test
status: active
rationale:
applies:
seeded_questions:
tags:
weight:
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].kind).toBe('custom_kind');
    // Validation should warn, not error
    const vr = validateMarker(result.entries[0]);
    expect(vr.errors.filter(e => e.field === 'kind')).toHaveLength(0);
    expect(vr.warnings.some(w => w.field === 'kind')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 8: Invalid YAML syntax
// ---------------------------------------------------------------------------
describe('Test 8: Invalid YAML', () => {
  it('emits error and no marker on bad YAML', () => {
    const content = `<!-- @scry.entry
id: design.broken~12345678
kind: design
summary: "unclosed quote
status: active
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(0);
    expect(result.diagnostics.some(d => d.level === 'error')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Cross-kind bindings
// ---------------------------------------------------------------------------
describe('Test 9: Cross-kind bindings', () => {
  it('extracts 3 bindings with different target kinds', () => {
    const content = `# @scry.bind react-counter~c3d4e5f6 pattern.headless-hook~abcd1234#PT2
# @scry.bind csrf-fix~f6a7b8c9 audit.security~89abcdef#AF7
# @scry.bind migration-019~e5f6a7b8 lesson.scry-drift~bbccddee#L1`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(3);
    expect(result.bindings[0].ref).toContain('pattern.headless-hook');
    expect(result.bindings[1].ref).toContain('audit.security');
    expect(result.bindings[2].ref).toContain('lesson.scry-drift');
  });
});

// ---------------------------------------------------------------------------
// Test 10: Artifact-level binding (no anchor)
// ---------------------------------------------------------------------------
describe('Test 10: Artifact-level binding', () => {
  it('parses binding with no anchor fragment', () => {
    const content = `# @scry.bind auth-service~a1b2c3d4 spec.auth~abcd1234`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].ref).toBe('spec.auth~abcd1234');
    expect(result.bindings[0].mode).toBe('loose');
    expect(result.bindings[0].comment).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 11: Multi-anchor binding (comma-separated expansion)
// ---------------------------------------------------------------------------
describe('Test 11: Multi-anchor comma expansion', () => {
  it('expands #FR1,FR2,FR3 into 3 binding records', () => {
    const content = `# @scry.bind validate-jwt~a1b2c3d4 spec.auth~abcd1234#FR1,FR2,FR3`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(3);
    expect(result.bindings[0].ref).toBe('spec.auth~abcd1234#FR1');
    expect(result.bindings[1].ref).toBe('spec.auth~abcd1234#FR2');
    expect(result.bindings[2].ref).toBe('spec.auth~abcd1234#FR3');
    expect(result.bindings.every(b => b.localId === 'validate-jwt~a1b2c3d4')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 12: Range syntax NOT supported
// ---------------------------------------------------------------------------
describe('Test 12: Range syntax not supported', () => {
  it('treats FR1..FR5 as a single anchor name, does not expand', () => {
    const content = `# @scry.bind validate-jwt~a1b2c3d4 spec.auth~abcd1234#FR1..FR5`;
    const result = parseMarkers(content, 'test.py');
    // Single binding, no expansion
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].ref).toBe('spec.auth~abcd1234#FR1..FR5');
  });
});

// ---------------------------------------------------------------------------
// Test 13: Binding with commentary
// ---------------------------------------------------------------------------
describe('Test 13: Binding with comment', () => {
  it('captures trailing comment text', () => {
    const content = `# @scry.bind validate-jwt~a1b2c3d4 spec.auth~abcd1234#FR3 partial impl, OAuth pending`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].localId).toBe('validate-jwt~a1b2c3d4');
    expect(result.bindings[0].ref).toBe('spec.auth~abcd1234#FR3');
    expect(result.bindings[0].comment).toBe('partial impl, OAuth pending');
  });
});

// ---------------------------------------------------------------------------
// Test 14: Strict anchor reference (no '.' in ref before '~')
// ---------------------------------------------------------------------------
describe('Test 14: Strict anchor reference', () => {
  it('parses strict mode when ref has no dot before tilde', () => {
    const content = `# @scry.bind impl-jwt~e5f6a7b8 token-validation~f1e2d3c4`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].ref).toBe('token-validation~f1e2d3c4');
    expect(result.bindings[0].mode).toBe('strict');
  });
});

// ---------------------------------------------------------------------------
// Test 15: Loose anchor resolution — markdown header (parseMarkers only extracts; resolution is out of scope for library)
// Test 16: Block form binding
// ---------------------------------------------------------------------------
describe('Test 16: Block form binding', () => {
  it('captures multi-line comment from block form', () => {
    const content = `# @scry.bind validate-jwt~a1b2c3d4 spec.auth~abcd1234#FR3
# Partial implementation. Currently handles:
#   - JWT signature validation
#   - Token expiry checks
# Pending: OAuth provider abstraction
# @scry.bind.end
def validate_jwt(): ...`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].localId).toBe('validate-jwt~a1b2c3d4');
    expect(result.bindings[0].ref).toBe('spec.auth~abcd1234#FR3');
    expect(result.bindings[0].comment).toContain('Partial implementation');
    expect(result.bindings[0].comment).toContain('JWT signature validation');
    expect(result.bindings[0].comment).toContain('OAuth provider abstraction');
    // span should be set for block form
    expect(result.bindings[0].span).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 17: Block form vs single-line equivalence
// ---------------------------------------------------------------------------
describe('Test 17: Block vs single-line equivalence', () => {
  it('produces same comment from block form and single-line form', () => {
    const singleLine = `# @scry.bind impl~aabbccdd spec.x~abcd1234#fr1 short comment`;
    const blockForm = `# @scry.bind impl~aabbccdd spec.x~abcd1234#fr1
# short comment
# @scry.bind.end`;

    const r1 = parseMarkers(singleLine, 'test.py');
    const r2 = parseMarkers(blockForm, 'test.py');

    expect(r1.bindings).toHaveLength(1);
    expect(r2.bindings).toHaveLength(1);
    expect(r1.bindings[0].comment?.trim()).toBe(r2.bindings[0].comment?.trim());
  });
});

// ---------------------------------------------------------------------------
// Test 18: Block form without .end → treated as single-line, no comment
// ---------------------------------------------------------------------------
describe('Test 18: Block form without .end', () => {
  it('treats opening-only bind as single-line with no comment', () => {
    const content = `# @scry.bind impl~aabbccdd spec.x~abcd1234#fr1
def func(): pass`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].comment).toBeNull();
    expect(result.bindings[0].span).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 19: Mixed inline + block (error)
// ---------------------------------------------------------------------------
describe('Test 19: Mixed inline + block (mutual exclusion error)', () => {
  it('emits error when binding has both inline comment and block body', () => {
    const content = `# @scry.bind impl~aabbccdd spec.x~abcd1234#fr1 inline comment
# more content here
# @scry.bind.end`;
    const result = parseMarkers(content, 'test.py');
    expect(result.diagnostics.some(d => d.level === 'error' && d.message.includes('mutual exclusion'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TypeScript-style markers (// comments)
// ---------------------------------------------------------------------------
describe('TypeScript comment style', () => {
  it('parses entry in TypeScript source file', () => {
    const content = `// @scry.entry
// id: code.my-func~cafebabe
// kind: code
// summary: My function implementation
// status: active
// rationale:
// applies:
// seeded_questions:
// tags:
// weight:
// @scry.entry.end
export function myFunc() {}`;
    const result = parseMarkers(content, 'src/myFunc.ts');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('code.my-func~cafebabe');
    expect(result.entries[0].kind).toBe('code');
  });

  it('parses bind in TypeScript source file', () => {
    const content = `// @scry.bind my-func~cafebabe spec.api~12345678#FR1
export function myFunc() {}`;
    const result = parseMarkers(content, 'src/myFunc.ts');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].localId).toBe('my-func~cafebabe');
  });
});

// ---------------------------------------------------------------------------
// mintId tests
// ---------------------------------------------------------------------------
describe('mintId', () => {
  it('produces valid ID format', () => {
    const id = mintId('design', 'auth-flow', 'some content');
    expect(ID_REGEX.test(id)).toBe(true);
    expect(id.startsWith('design.auth-flow~')).toBe(true);
  });

  it('is deterministic when content is provided', () => {
    const id1 = mintId('spec', 'my-spec', 'hello world');
    const id2 = mintId('spec', 'my-spec', 'hello world');
    expect(id1).toBe(id2);
  });

  it('produces different ids for different content', () => {
    const id1 = mintId('spec', 'my-spec', 'content A');
    const id2 = mintId('spec', 'my-spec', 'content B');
    expect(id1).not.toBe(id2);
  });

  it('sanitizes name to kebab case', () => {
    const id = mintId('design', 'My Auth Flow!!', 'x');
    expect(id).toMatch(/^design\.[a-z0-9-]+~[a-f0-9]{8}$/);
  });
});

// ---------------------------------------------------------------------------
// validateMarker tests
// ---------------------------------------------------------------------------
describe('validateMarker — entry', () => {
  it('returns ok:true for valid entry', () => {
    const entry = {
      id: 'design.test~12345678',
      kind: 'design',
      summary: 'Test summary',
      status: 'active',
      weight: 0.5,
      tags: [],
      rationale: '',
      applies: '',
      seededQuestions: [],
      dependsOn: [],
      implements: [],
      supersedes: [],
      file: 'test.md',
      span: [0, 5] as [number, number],
    };
    const vr = validateMarker(entry);
    expect(vr.ok).toBe(true);
    expect(vr.errors).toHaveLength(0);
  });

  it('returns error for invalid id format', () => {
    const entry = {
      id: 'not-valid-id',
      kind: 'design',
      summary: 'Test',
      status: 'active',
      weight: null,
      tags: [],
      rationale: '',
      applies: '',
      seededQuestions: [],
      dependsOn: [],
      implements: [],
      supersedes: [],
      file: 'test.md',
      span: [0, 5] as [number, number],
    };
    const vr = validateMarker(entry);
    expect(vr.ok).toBe(false);
    expect(vr.errors.some(e => e.field === 'id')).toBe(true);
  });

  it('returns error for empty summary', () => {
    const entry = {
      id: 'design.test~12345678',
      kind: 'design',
      summary: '',
      status: 'active',
      weight: null,
      tags: [],
      rationale: '',
      applies: '',
      seededQuestions: [],
      dependsOn: [],
      implements: [],
      supersedes: [],
      file: 'test.md',
      span: [0, 5] as [number, number],
    };
    const vr = validateMarker(entry);
    expect(vr.ok).toBe(false);
    expect(vr.errors.some(e => e.field === 'summary')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BASELINE_KINDS and BASELINE_STATUSES exported correctly
// ---------------------------------------------------------------------------
describe('Constants', () => {
  it('BASELINE_KINDS contains expected values', () => {
    expect(BASELINE_KINDS).toContain('design');
    expect(BASELINE_KINDS).toContain('spec');
    expect(BASELINE_KINDS).toContain('code');
    expect(BASELINE_KINDS).toHaveLength(11);
  });

  it('BASELINE_STATUSES contains expected values', () => {
    expect(BASELINE_STATUSES).toContain('draft');
    expect(BASELINE_STATUSES).toContain('active');
    expect(BASELINE_STATUSES).toContain('deprecated');
    expect(BASELINE_STATUSES).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// SQL-style (-- comments)
// ---------------------------------------------------------------------------
describe('SQL comment style', () => {
  it('parses entry in SQL file', () => {
    const content = `-- @scry.entry
-- id: design.sql-schema~deadbeef
-- kind: design
-- summary: SQL schema design
-- status: active
-- rationale:
-- applies:
-- seeded_questions:
-- tags:
-- weight:
-- @scry.entry.end`;
    const result = parseMarkers(content, 'schema.sql');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('design.sql-schema~deadbeef');
  });
});

// ---------------------------------------------------------------------------
// Orphaned .end
// ---------------------------------------------------------------------------
describe('Orphaned bind.end', () => {
  it('does not create a marker for orphaned .end', () => {
    const content = `# @scry.bind.end`;
    const result = parseMarkers(content, 'test.py');
    expect(result.bindings).toHaveLength(0);
    expect(result.diagnostics.some(d => d.message.includes('Orphaned'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Entry with optional fields omitted (truly optional: depends_on, implements, supersedes)
// ---------------------------------------------------------------------------
describe('Entry with optional fields omitted', () => {
  it('defaults optional fields correctly', () => {
    const content = `<!-- @scry.entry
id: design.minimal~aabbccdd
kind: design
summary: Minimal valid entry
status: draft
rationale:
applies:
seeded_questions:
tags:
weight:
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(1);
    const e = result.entries[0];
    expect(e.dependsOn).toEqual([]);
    expect(e.implements).toEqual([]);
    expect(e.supersedes).toEqual([]);
    expect(e.weight).toBeNull(); // null when not specified
  });
});

// ---------------------------------------------------------------------------
// Anchor with minimal fields
// ---------------------------------------------------------------------------
describe('Anchor with minimal fields', () => {
  it('parses anchor with only description and empty seeded_questions', () => {
    const content = `<!-- @scry.anchor auth-check~f1e2d3c4
description: JWT validation point for protected routes
seeded_questions:
@scry.anchor.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.anchors).toHaveLength(1);
    expect(result.anchors[0].seededQuestions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Block-comment support (v1.0.1 — FR1 universality)
// ---------------------------------------------------------------------------

describe('JSDoc block comment entry', () => {
  it('parses entry inside JSDoc /** */ comment', () => {
    const content = `/**
 * @scry.entry
 * id: design.foo~12345678
 * kind: design
 * summary: JSDoc test entry
 * status: active
 * rationale:
 * applies:
 * seeded_questions:
 * tags:
 * weight:
 * @scry.entry.end
 */`;
    const result = parseMarkers(content, 'src/foo.ts');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('design.foo~12345678');
    expect(result.entries[0].kind).toBe('design');
    expect(result.entries[0].summary).toBe('JSDoc test entry');
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

describe('C-style block comment entry', () => {
  it('parses entry inside /* */ comment', () => {
    const content = `/*
   @scry.entry
   id: design.bar~abcd1234
   kind: design
   summary: C-block test entry
   status: active
   rationale:
   applies:
   seeded_questions:
   tags:
   weight:
   @scry.entry.end
*/`;
    const result = parseMarkers(content, 'src/bar.c');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('design.bar~abcd1234');
    expect(result.entries[0].summary).toBe('C-block test entry');
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

describe('OCaml block comment entry', () => {
  it('parses entry inside (* *) comment', () => {
    const content = `(*
   @scry.entry
   id: design.ocaml~deadbeef
   kind: design
   summary: OCaml block test
   status: active
   rationale:
   applies:
   seeded_questions:
   tags:
   weight:
   @scry.entry.end
*)`;
    const result = parseMarkers(content, 'src/foo.ml');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('design.ocaml~deadbeef');
    expect(result.entries[0].summary).toBe('OCaml block test');
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

describe('Haskell block comment entry', () => {
  it('parses entry inside {- -} comment', () => {
    const content = `{-
   @scry.entry
   id: design.haskell~cafe1234
   kind: design
   summary: Haskell block test
   status: active
   rationale:
   applies:
   seeded_questions:
   tags:
   weight:
   @scry.entry.end
-}`;
    const result = parseMarkers(content, 'src/foo.hs');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('design.haskell~cafe1234');
    expect(result.entries[0].summary).toBe('Haskell block test');
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

describe('PowerShell block comment entry', () => {
  it('parses entry inside <# #> comment', () => {
    const content = `<#
   @scry.entry
   id: design.ps1~f00dbeef
   kind: design
   summary: PowerShell block test
   status: active
   rationale:
   applies:
   seeded_questions:
   tags:
   weight:
   @scry.entry.end
#>`;
    const result = parseMarkers(content, 'src/foo.ps1');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('design.ps1~f00dbeef');
    expect(result.entries[0].summary).toBe('PowerShell block test');
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

describe('JSDoc block binding', () => {
  it('parses @scry.bind inside JSDoc * continuation lines', () => {
    const content = `/**
 * @scry.bind my-func~cafebabe spec.api~12345678#FR1
 * JSDoc block binding comment.
 * @scry.bind.end
 */
export function myFunc() {}`;
    const result = parseMarkers(content, 'src/myFunc.ts');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].localId).toBe('my-func~cafebabe');
    expect(result.bindings[0].ref).toBe('spec.api~12345678#FR1');
    expect(result.bindings[0].comment).toBe('JSDoc block binding comment.');
  });
});

describe('Existing line-comment styles unaffected by block-comment changes', () => {
  it('still parses Python, TypeScript, SQL styles correctly', () => {
    const py = `# @scry.entry\n# id: code.py~aaaa0000\n# kind: code\n# summary: Python check\n# status: active\n# rationale:\n# applies:\n# seeded_questions:\n# tags:\n# weight:\n# @scry.entry.end`;
    const ts = `// @scry.entry\n// id: code.ts~bbbb1111\n// kind: code\n// summary: TS check\n// status: active\n// rationale:\n// applies:\n// seeded_questions:\n// tags:\n// weight:\n// @scry.entry.end`;
    const sql = `-- @scry.entry\n-- id: code.sql~cccc2222\n-- kind: code\n-- summary: SQL check\n-- status: active\n-- rationale:\n-- applies:\n-- seeded_questions:\n-- tags:\n-- weight:\n-- @scry.entry.end`;

    const rPy = parseMarkers(py, 'test.py');
    const rTs = parseMarkers(ts, 'test.ts');
    const rSql = parseMarkers(sql, 'test.sql');

    expect(rPy.entries[0].id).toBe('code.py~aaaa0000');
    expect(rTs.entries[0].id).toBe('code.ts~bbbb1111');
    expect(rSql.entries[0].id).toBe('code.sql~cccc2222');
  });
});

describe('Unknown YAML field preservation', () => {
  it('preserves unknown fields in entry extra map', () => {
    const content = `# @scry.entry
# id: design.test~aabbccdd
# kind: design
# summary: Test extra field preservation
# status: active
# rationale:
# applies:
# seeded_questions:
# tags:
# weight:
# my_custom_field: hello world
# another_custom: 42
# @scry.entry.end`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(1);
    const entry = result.entries[0];
    expect(entry.extra).toBeDefined();
    expect(entry.extra['my_custom_field']).toBe('hello world');
    expect(entry.extra['another_custom']).toBe(42);
    // known fields must not appear in extra
    expect(entry.extra['id']).toBeUndefined();
    expect(entry.extra['kind']).toBeUndefined();
    expect(entry.extra['summary']).toBeUndefined();
  });

  it('has empty extra map when no unknown fields present', () => {
    const content = `# @scry.entry
# id: design.test~aabbccdd
# kind: design
# summary: No extra fields
# status: active
# rationale:
# applies:
# seeded_questions:
# tags:
# weight:
# @scry.entry.end`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries[0].extra).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// checkCycles (FR12: relationship semantics)
// ---------------------------------------------------------------------------

/** Minimal EntryMarker stub for cycle tests (only id and dependsOn matter). */
function makeEntry(id: string, dependsOn: string[] = []): EntryMarker {
  return {
    id,
    kind: 'design',
    summary: '',
    status: 'active',
    weight: null,
    tags: [],
    rationale: '',
    applies: '',
    seededQuestions: [],
    dependsOn,
    implements: [],
    supersedes: [],
    extra: {},
    file: 'test.md',
    span: [0, 1],
  };
}

// ---------------------------------------------------------------------------
// Code-construct exclusion — phantom marker prevention
// ---------------------------------------------------------------------------

describe('markdown-code-fence-marker-ignored', () => {
  it('ignores markers inside a fenced code block (backtick fence)', () => {
    const content = [
      'Some prose here.',
      '',
      '```typescript',
      '<!-- @scry.entry',
      'id: design.example~12345678',
      'kind: design',
      'summary: Example marker in code block',
      'status: active',
      'rationale:',
      'applies:',
      'seeded_questions:',
      'tags:',
      'weight:',
      '@scry.entry.end -->',
      '```',
      '',
      'More prose.',
    ].join('\n');
    const result = parseMarkers(content, 'example.md');
    expect(result.entries).toHaveLength(0);
    expect(result.anchors).toHaveLength(0);
    expect(result.bindings).toHaveLength(0);
  });

  it('ignores markers inside a tilde-fenced code block', () => {
    const content = [
      '~~~python',
      '# @scry.entry',
      '# id: code.fn~aabbccdd',
      '# kind: code',
      '# summary: Phantom',
      '# status: active',
      '# @scry.entry.end',
      '~~~',
    ].join('\n');
    const result = parseMarkers(content, 'example.md');
    expect(result.entries).toHaveLength(0);
  });

  it('still parses markers outside the fenced block', () => {
    const content = [
      '```',
      '# @scry.entry',
      '# id: code.inside~aabbccdd',
      '# kind: code',
      '# summary: Inside',
      '# status: active',
      '# @scry.entry.end',
      '```',
      '<!-- @scry.entry',
      'id: design.outside~12345678',
      'kind: design',
      'summary: Outside the fence',
      'status: active',
      'rationale:',
      'applies:',
      'seeded_questions:',
      'tags:',
      'weight:',
      '@scry.entry.end -->',
    ].join('\n');
    const result = parseMarkers(content, 'example.md');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('design.outside~12345678');
  });
});

describe('markdown-inline-code-marker-ignored', () => {
  it('does not parse a marker that is inside an inline code span', () => {
    const content = [
      'Use `@scry.anchor foo~abcd1234` to reference a named anchor point.',
      'Also see `@scry.bind impl~12345678 spec.foo~abcdef01` for binding syntax.',
    ].join('\n');
    const result = parseMarkers(content, 'example.md');
    expect(result.anchors).toHaveLength(0);
    expect(result.bindings).toHaveLength(0);
    expect(result.entries).toHaveLength(0);
  });
});

describe('typescript-template-literal-marker-ignored', () => {
  it('ignores markers inside a multi-line template literal', () => {
    const content = [
      "import { parseMarkers } from '../src/markers.js';",
      '',
      'describe("test", () => {',
      '  it("parses entry", () => {',
      '    const content = `# @scry.entry',
      '# id: code.func1~aaaa1111',
      '# kind: code',
      '# summary: Function 1',
      '# status: active',
      '# rationale:',
      '# applies:',
      '# seeded_questions:',
      '# tags:',
      '# weight:',
      '# @scry.entry.end',
      'def func1(): pass`;',
      '    const result = parseMarkers(content, "test.py");',
      '    expect(result.entries).toHaveLength(1);',
      '  });',
      '});',
    ].join('\n');
    const result = parseMarkers(content, 'test.ts');
    expect(result.entries).toHaveLength(0);
    expect(result.anchors).toHaveLength(0);
    expect(result.bindings).toHaveLength(0);
  });

  it('still parses real markers outside template literals in .ts files', () => {
    const content = [
      '// @scry.entry',
      '// id: code.real~cafebabe',
      '// kind: code',
      '// summary: Real marker outside template literal',
      '// status: active',
      '// rationale:',
      '// applies:',
      '// seeded_questions:',
      '// tags:',
      '// weight:',
      '// @scry.entry.end',
      'const fixture = `# @scry.entry`,',
      'export function realFunc() {}',
    ].join('\n');
    const result = parseMarkers(content, 'src/real.ts');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('code.real~cafebabe');
  });
});

describe('checkCycles — FR12', () => {
  it('returns empty array when given no entries', () => {
    expect(checkCycles([])).toEqual([]);
  });

  it('returns empty array when no depends_on relationships', () => {
    const entries = [
      makeEntry('design.a~00000001'),
      makeEntry('design.b~00000002'),
      makeEntry('design.c~00000003'),
    ];
    expect(checkCycles(entries)).toEqual([]);
  });

  it('returns empty array for a valid linear chain A→B→C', () => {
    const entries = [
      makeEntry('design.a~00000001', ['design.b~00000002']),
      makeEntry('design.b~00000002', ['design.c~00000003']),
      makeEntry('design.c~00000003'),
    ];
    expect(checkCycles(entries)).toEqual([]);
  });

  it('detects a self-loop A→A', () => {
    const entries = [
      makeEntry('design.a~00000001', ['design.a~00000001']),
    ];
    const cycles = checkCycles(entries);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('design.a~00000001');
  });

  it('detects a simple two-node cycle A→B→A', () => {
    const entries = [
      makeEntry('design.a~00000001', ['design.b~00000002']),
      makeEntry('design.b~00000002', ['design.a~00000001']),
    ];
    const cycles = checkCycles(entries);
    expect(cycles).toHaveLength(1);
    // Cycle should contain both IDs
    expect(cycles[0]).toContain('design.a~00000001');
    expect(cycles[0]).toContain('design.b~00000002');
    // Last element repeats the start (cycle closed)
    const cycle = cycles[0];
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  });

  it('detects a three-node cycle A→B→C→A', () => {
    const entries = [
      makeEntry('design.a~00000001', ['design.b~00000002']),
      makeEntry('design.b~00000002', ['design.c~00000003']),
      makeEntry('design.c~00000003', ['design.a~00000001']),
    ];
    const cycles = checkCycles(entries);
    expect(cycles).toHaveLength(1);
    const cycle = cycles[0];
    expect(cycle).toContain('design.a~00000001');
    expect(cycle).toContain('design.b~00000002');
    expect(cycle).toContain('design.c~00000003');
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  });

  it('returns empty when depends_on references IDs outside the input set', () => {
    // External references are ignored (not in knownIds)
    const entries = [
      makeEntry('design.a~00000001', ['design.external~99999999']),
    ];
    expect(checkCycles(entries)).toEqual([]);
  });

  it('handles disconnected components: one cyclic, one acyclic', () => {
    const entries = [
      // Cyclic component
      makeEntry('design.x~00000001', ['design.y~00000002']),
      makeEntry('design.y~00000002', ['design.x~00000001']),
      // Acyclic component
      makeEntry('design.p~00000003', ['design.q~00000004']),
      makeEntry('design.q~00000004'),
    ];
    const cycles = checkCycles(entries);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('design.x~00000001');
    expect(cycles[0]).toContain('design.y~00000002');
  });
});

// ---------------------------------------------------------------------------
// FR11.4: Relationship fields must be array form
// ---------------------------------------------------------------------------

describe('test-implements-array-form-ok', () => {
  it('parses implements with two-element array form', () => {
    const content = `<!-- @scry.entry
id: design.test~12345678
kind: design
summary: Test implements array form
status: active
rationale:
applies:
seeded_questions:
tags:
weight:
implements: [spec.x~aabb1122, spec.y~ccdd3344]
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].implements).toEqual(['spec.x~aabb1122', 'spec.y~ccdd3344']);
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

describe('test-singleton-array-form', () => {
  it('parses implements with single-element array form', () => {
    const content = `<!-- @scry.entry
id: design.test~12345678
kind: design
summary: Test singleton array form
status: active
rationale:
applies:
seeded_questions:
tags:
weight:
implements: [spec.x~aabb1122]
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].implements).toEqual(['spec.x~aabb1122']);
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

describe('test-implements-scalar-form-rejected', () => {
  it('rejects implements with scalar (unquoted) value — FR11.4 parse error', () => {
    const content = `<!-- @scry.entry
id: design.test~12345678
kind: design
summary: Test scalar implements rejected
status: active
rationale:
applies:
seeded_questions:
tags:
weight:
implements: spec.x~aabb1122
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    // Entry must not be indexed
    expect(result.entries).toHaveLength(0);
    // Must produce an error diagnostic mentioning FR11.4
    const errors = result.diagnostics.filter(d => d.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/implements/);
    expect(errors[0].message).toMatch(/FR11\.4/);
  });
});

describe('test-supersedes-scalar-form-rejected', () => {
  it('rejects supersedes with scalar value — FR11.4 parse error', () => {
    const content = `<!-- @scry.entry
id: design.test~12345678
kind: design
summary: Test scalar supersedes rejected
status: active
rationale:
applies:
seeded_questions:
tags:
weight:
supersedes: design.old~99887766
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(0);
    const errors = result.diagnostics.filter(d => d.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/supersedes/);
    expect(errors[0].message).toMatch(/FR11\.4/);
  });
});

describe('test-depends-on-array-form-ok', () => {
  it('parses depends_on with array form — no regression', () => {
    const content = `<!-- @scry.entry
id: design.test~12345678
kind: design
summary: Test depends_on array form
status: active
rationale:
applies:
seeded_questions:
tags:
weight:
depends_on: [design.a~aabb1122, design.b~ccdd3344]
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].dependsOn).toEqual(['design.a~aabb1122', 'design.b~ccdd3344']);
    expect(result.diagnostics.filter(d => d.level === 'error')).toHaveLength(0);
  });
});

describe('test-depends-on-scalar-form-rejected', () => {
  it('rejects depends_on with scalar value — FR11.4 parse error', () => {
    const content = `<!-- @scry.entry
id: design.test~12345678
kind: design
summary: Test scalar depends_on rejected
status: active
rationale:
applies:
seeded_questions:
tags:
weight:
depends_on: design.a~aabb1122
@scry.entry.end -->`;
    const result = parseMarkers(content, 'test.md');
    // Entry must not be indexed (dependency would be silently dropped otherwise)
    expect(result.entries).toHaveLength(0);
    // Must produce an error diagnostic mentioning FR11.4
    const errors = result.diagnostics.filter(d => d.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/depends_on/);
    expect(errors[0].message).toMatch(/FR11\.4/);
  });
});
