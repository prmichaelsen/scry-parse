interface EntryMarker {
    /** Full artifact id: {kind}.{name}~{hash} */
    id: string;
    /** Artifact kind (FR8 — preserved as-authored, never coerced) */
    kind: string;
    /** One-sentence description */
    summary: string;
    /** Lifecycle status (FR9 — preserved as-authored) */
    status: string;
    /** Priority 0.0–1.0; null declared as empty → default 0.5 */
    weight: number | null;
    /** Categorization tags */
    tags: string[];
    /** Why this artifact exists */
    rationale: string;
    /** When/where to use this */
    applies: string;
    /** Common questions answered by this artifact */
    seededQuestions: string[];
    /** IDs of artifacts this depends on */
    dependsOn: string[];
    /** ID of spec/design this implements */
    implements: string | null;
    /** ID of artifact this replaces */
    supersedes: string | null;
    /** Source file path */
    file: string;
    /** [startLine, endLine] 0-indexed inclusive */
    span: [number, number];
}
interface AnchorMarker {
    /** Anchor identifier: {name}~{hash} */
    name: string;
    /** What this anchor represents */
    description: string;
    /** Common questions about this anchor */
    seededQuestions: string[];
    /** Source file path */
    file: string;
    /** [startLine, endLine] 0-indexed inclusive */
    span: [number, number];
}
interface BindingMarker {
    /** File-scoped identifier */
    localId: string;
    /** Target reference (artifact-ref or anchor-id) */
    ref: string;
    /** Reference mode */
    mode: 'loose' | 'strict';
    /** Optional commentary */
    comment: string | null;
    /** Source file path */
    file: string;
    /** Line offset (0-indexed) */
    offset: number;
    /** [startLine, endLine] for block form; null for single-line */
    span: [number, number] | null;
}
interface ParseResult {
    entries: EntryMarker[];
    anchors: AnchorMarker[];
    bindings: BindingMarker[];
    diagnostics: Diagnostic[];
}
interface Diagnostic {
    level: 'info' | 'warning' | 'error';
    message: string;
    line?: number;
}
type Language = 'markdown' | 'typescript' | 'python' | 'sql' | 'lisp' | 'auto';
/**
 * Parse all scry markers from file content.
 *
 * @param content - Raw file content
 * @param file - File path for provenance
 * @param _language - Hint (currently unused; style auto-detected per sentinel line)
 */
declare function parseMarkers(content: string, file?: string, _language?: Language): ParseResult;

type Marker = EntryMarker | AnchorMarker | BindingMarker;
interface ValidationError {
    field: string;
    message: string;
}
interface ValidationWarning {
    field: string;
    message: string;
}
interface ValidationResult {
    ok: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
/**
 * Validate a parsed marker per scry-spec v1.0.
 *
 * Entry validation: FR4, FR7, FR8, FR9
 * Anchor validation: FR5
 * Binding validation: FR2, FR6
 */
declare function validateMarker(marker: Marker): ValidationResult;

/**
 * Generate a scry marker ID in {kind}.{name}~{hash} format.
 *
 * Per FR7:
 * - kind must be lowercase [a-z]+
 * - name is kebab-cased (lowercase, hyphens)
 * - hash: 8-char hex (SHA256 of content truncated, or random when content omitted)
 *
 * @param kind - Artifact kind (e.g., 'design', 'spec')
 * @param name - Kebab-case artifact name (e.g., 'auth-flow')
 * @param content - Optional content for deterministic SHA256 hash
 * @returns Full id string: {kind}.{name}~{hash}
 */
declare function mintId(kind: string, name: string, content?: string): string;

/**
 * Baseline kinds per scry-spec v1.0 FR8
 */
declare const BASELINE_KINDS: readonly ["design", "pattern", "spec", "lesson", "internal", "task", "milestone", "report", "audit", "research", "code"];
type BaselineKind = (typeof BASELINE_KINDS)[number];
/**
 * Baseline status values per scry-spec v1.0 FR9
 */
declare const BASELINE_STATUSES: readonly ["draft", "active", "deprecated"];
type BaselineStatus = (typeof BASELINE_STATUSES)[number];

export { type AnchorMarker, BASELINE_KINDS, BASELINE_STATUSES, type BaselineKind, type BaselineStatus, type BindingMarker, type Diagnostic, type EntryMarker, type Marker, type ParseResult, type ValidationError, type ValidationResult, type ValidationWarning, mintId, parseMarkers, validateMarker };
