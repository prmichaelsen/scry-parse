import { describe, it, expect } from 'vitest';
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
      implements: null,
      supersedes: null,
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
      implements: null,
      supersedes: null,
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
      implements: null,
      supersedes: null,
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
    expect(e.implements).toBeNull();
    expect(e.supersedes).toBeNull();
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
