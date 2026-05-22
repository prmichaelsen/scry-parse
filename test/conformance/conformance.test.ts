/**
 * B2 conformance binding tests for the TS parser.
 *
 * Spec: spec.scry-conformance-tests~6ced3644.
 *
 * Failure-mode contract: any drift between the parser's source-of-
 * truth exports (src/consts.ts) and the vendored fixtures in this
 * directory fails loudly. The canonical remediation path is a
 * spec-pin bump PR — bump pinned-version.ts and re-vendor the
 * relevant fixture from scry-spec in the same change. CRs against
 * scry-spec are the upstream remediation path when the parser is
 * ahead of the spec.
 */
import { describe, it, expect } from 'vitest';
import { BASELINE_KINDS, PREDICATES, SCRY_SPEC_VERSION } from '../../src/consts.js';
import { VENDORED_BASELINE_KINDS } from './baseline-kinds.js';
import { VENDORED_PREDICATES } from './predicates.js';
import { PINNED_SCRY_SPEC_VERSION } from './pinned-version.js';

const REMEDIATION =
  'Remediation: align src/consts.ts to scry-spec, bump test/conformance/pinned-version.ts, ' +
  'or open a CR against scry-spec. See spec.scry-conformance-tests~6ced3644.';

describe('B2 conformance — TS parser ↔ scry-spec', () => {
  it('baseline kinds match spec', () => {
    // Order-independent set equality. The parser stores the kinds in
    // categorized order; the vendored fixture mirrors that order, but
    // the conformance contract is set membership, not ordering.
    const got = new Set<string>(BASELINE_KINDS);
    const want = new Set<string>(VENDORED_BASELINE_KINDS);
    expect(
      got,
      `BASELINE_KINDS drift detected (parser vs vendored fixture). ${REMEDIATION}`
    ).toEqual(want);
  });

  it('predicates match spec', () => {
    const got = new Set<string>(PREDICATES);
    const want = new Set<string>(VENDORED_PREDICATES);
    expect(
      got,
      `PREDICATES drift detected (parser vs vendored fixture). ${REMEDIATION}`
    ).toEqual(want);
  });

  it('pinned version matches installed', () => {
    // "Installed" for the TS parser means the version the parser
    // declares it implements via src/consts.ts SCRY_SPEC_VERSION.
    // Vendored fixtures must be calibrated against the same version.
    expect(
      SCRY_SPEC_VERSION,
      `Spec-version pin drift: vendored fixtures pinned at ${PINNED_SCRY_SPEC_VERSION} ` +
        `but parser implements ${SCRY_SPEC_VERSION}. ${REMEDIATION}`
    ).toBe(PINNED_SCRY_SPEC_VERSION);
  });
});
