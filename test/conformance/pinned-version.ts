/**
 * Pinned scry-spec version the vendored fixtures in this directory
 * were calibrated against.
 *
 * Bump this constant in the same PR that updates the vendored
 * BASELINE_KINDS / PREDICATES fixtures. The conformance suite
 * asserts this value equals the parser's `SCRY_SPEC_VERSION`
 * export (src/consts.ts); a mismatch means the pin advanced
 * without the parser advancing (or vice versa) and is treated
 * as a drift failure.
 */
export const PINNED_SCRY_SPEC_VERSION = 'v1.2.0';
