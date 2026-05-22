/**
 * Vendored BASELINE_KINDS fixture per scry-spec v1.2 FR8.
 *
 * Copied from scry-spec (see pinned-version.ts). NOT read dynamically —
 * this is the calibration target. When scry-spec ships a new baseline-
 * kind set, bump pinned-version.ts AND update this fixture in the same
 * PR. Drift between this fixture and the parser's src/consts.ts
 * BASELINE_KINDS export fails the conformance suite loudly.
 *
 * Remediation on failure: align src/consts.ts to spec, bump the pin,
 * or open a CR against scry-spec.
 */
export const VENDORED_BASELINE_KINDS = [
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
  // Outcomes (v1.2)
  'goal',
] as const;
