/**
 * Vendored predicate vocabulary fixture per scry-spec v1.1 FR12.
 *
 * Each relationship field on @scry.entry (`depends_on`, `implements`,
 * `supersedes`) materializes into a typed edge with the matching
 * predicate. Vendored, not read dynamically — drift between this
 * fixture and the parser's src/consts.ts PREDICATES export fails
 * the conformance suite loudly.
 *
 * Remediation on failure: align src/consts.ts to spec, bump
 * pinned-version.ts, or open a CR against scry-spec.
 */
export const VENDORED_PREDICATES = [
  'depends_on',
  'implements',
  'supersedes',
] as const;
