/**
 * Baseline kinds per scry-spec v1.0 FR8
 */
export const BASELINE_KINDS = [
  // Documentation/Knowledge
  'design',
  'pattern',
  'spec',
  'lesson',
  'internal',
  // Work Management
  'task',
  'milestone',
  // Analysis/Outputs
  'report',
  'audit',
  'research',
  // Implementation
  'code',
] as const;

export type BaselineKind = (typeof BASELINE_KINDS)[number];

/**
 * Baseline status values per scry-spec v1.0 FR9
 */
export const BASELINE_STATUSES = ['draft', 'active', 'deprecated'] as const;

export type BaselineStatus = (typeof BASELINE_STATUSES)[number];

/**
 * Validation regex for the full artifact id: {kind}.{name}~{hash}
 * FR7: ^[a-z]+\.[a-z0-9-]+~[a-f0-9]{8}$
 */
export const ID_REGEX = /^[a-z]+\.[a-z0-9-]+~[a-f0-9]{8}$/;

/**
 * Validation regex for anchor-id: {name}~{hash} (no dot before tilde)
 */
export const ANCHOR_ID_REGEX = /^[a-z0-9-]+~[a-f0-9]{8}$/;

/**
 * Loose anchor pattern: [A-Z]+[0-9]+ (e.g., FR1, UT3, DR2)
 */
export const LOOSE_ANCHOR_REGEX = /^[A-Z]+[0-9]+$/;

/**
 * Opening sentinel patterns for declarative markers
 */
export const DECLARATIVE_MARKER_TYPES = ['entry', 'anchor'] as const;
export type DeclarativeMarkerType = (typeof DECLARATIVE_MARKER_TYPES)[number];

/**
 * Binding marker types
 */
export const BINDING_MARKER_TYPES = ['bind'] as const;
export type BindingMarkerType = (typeof BINDING_MARKER_TYPES)[number];

/**
 * Comment prefix patterns for body extraction (FR11.2)
 * Order matters: longer/more specific first
 */
export const COMMENT_PREFIXES = [
  /^<!--\s?/,        // Markdown open (strip leading only, not trailing)
  /^\s*\/\/\s?/,    // TypeScript/JS/Rust/C/Java
  /^\s*#\s?/,       // Python/Shell/Ruby/YAML
  /^\s*--\s?/,      // SQL/Haskell
  /^\s*;;\s?/,      // Lisp/Clojure
  /^\s*;\s?/,       // Lisp alternative
] as const;
