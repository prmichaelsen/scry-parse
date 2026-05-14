import { ID_REGEX, ANCHOR_ID_REGEX, BASELINE_KINDS, BASELINE_STATUSES } from './consts.js';
import type { EntryMarker, AnchorMarker, BindingMarker } from './markers.js';

export type Marker = EntryMarker | AnchorMarker | BindingMarker;

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

function isEntryMarker(m: Marker): m is EntryMarker {
  return 'id' in m && 'kind' in m && 'summary' in m && 'status' in m;
}

function isAnchorMarker(m: Marker): m is AnchorMarker {
  return 'name' in m && 'description' in m && !('id' in m);
}

function isBindingMarker(m: Marker): m is BindingMarker {
  return 'localId' in m && 'ref' in m;
}

/**
 * Validate a parsed marker per scry-spec v1.0.
 *
 * Entry validation: FR4, FR7, FR8, FR9
 * Anchor validation: FR5
 * Binding validation: FR2, FR6
 */
export function validateMarker(marker: Marker): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (isEntryMarker(marker)) {
    validateEntry(marker, errors, warnings);
  } else if (isAnchorMarker(marker)) {
    validateAnchor(marker, errors, warnings);
  } else if (isBindingMarker(marker)) {
    validateBinding(marker, errors, warnings);
  } else {
    errors.push({ field: 'marker', message: 'Unknown marker type' });
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Entry validation (FR4, FR7, FR8, FR9)
// ---------------------------------------------------------------------------

function validateEntry(
  m: EntryMarker,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  // FR7: id format
  if (!m.id) {
    errors.push({ field: 'id', message: 'id is required and must be non-empty' });
  } else if (!ID_REGEX.test(m.id)) {
    errors.push({
      field: 'id',
      message: `id "${m.id}" does not match required format {kind}.{name}~{hash} (^[a-z]+\\.[a-z0-9-]+~[a-f0-9]{8}$)`,
    });
  }

  // FR8: kind — must be non-empty; warn on unknown
  if (!m.kind) {
    errors.push({ field: 'kind', message: 'kind is required and must be non-empty' });
  } else if (!(BASELINE_KINDS as readonly string[]).includes(m.kind)) {
    warnings.push({
      field: 'kind',
      message: `kind "${m.kind}" is not in the baseline kinds list — preserved as-authored per FR8`,
    });
  }

  // FR4: summary required non-empty
  if (!m.summary || m.summary.trim() === '') {
    errors.push({ field: 'summary', message: 'summary is required and must be non-empty' });
  }

  // FR9: status required non-empty
  if (!m.status || m.status.trim() === '') {
    errors.push({ field: 'status', message: 'status is required and must be non-empty' });
  } else if (!(BASELINE_STATUSES as readonly string[]).includes(m.status)) {
    warnings.push({
      field: 'status',
      message: `status "${m.status}" is not a baseline status — preserved as-authored per FR9`,
    });
  }

  // FR4: required-empty-allowed fields
  // weight, tags, rationale, applies, seededQuestions — already nullable/empty-allowed,
  // but we warn if the kind is 'design' and rationale is empty (spec diagnostic guidance)
  if (m.kind === 'design' && (!m.rationale || m.rationale.trim() === '')) {
    warnings.push({
      field: 'rationale',
      message: 'rationale is empty for a design marker — consider adding rationale for discoverability',
    });
  }

  // weight bounds
  if (m.weight !== null && (m.weight < 0 || m.weight > 1)) {
    errors.push({ field: 'weight', message: `weight ${m.weight} is out of range [0.0, 1.0]` });
  }
}

// ---------------------------------------------------------------------------
// Anchor validation (FR5)
// ---------------------------------------------------------------------------

function validateAnchor(
  m: AnchorMarker,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  // name must match anchor-id format
  if (!m.name) {
    errors.push({ field: 'name', message: 'anchor name (from sentinel) is required' });
  } else if (!ANCHOR_ID_REGEX.test(m.name)) {
    errors.push({
      field: 'name',
      message: `anchor name "${m.name}" does not match {name}~{hash} format`,
    });
  }

  // description required non-empty (FR5)
  if (!m.description || m.description.trim() === '') {
    errors.push({ field: 'description', message: 'description is required and must be non-empty' });
  }

  // seededQuestions: required-empty-allowed, no error needed
  void warnings; // satisfy unused param (warnings intentionally not used for anchors currently)
}

// ---------------------------------------------------------------------------
// Binding validation (FR2, FR6)
// ---------------------------------------------------------------------------

function validateBinding(
  m: BindingMarker,
  errors: ValidationError[],
  _warnings: ValidationWarning[],
): void {
  if (!m.localId) {
    errors.push({ field: 'localId', message: 'localId is required' });
  } else if (!/^[a-z0-9-]+~[a-f0-9]{8}$/.test(m.localId)) {
    errors.push({
      field: 'localId',
      message: `localId "${m.localId}" does not match {name}~{hash} format`,
    });
  }

  if (!m.ref) {
    errors.push({ field: 'ref', message: 'ref is required' });
  } else {
    // FR6: loose or strict
    if (m.mode === 'loose') {
      // loose: must match {id}[#{loose-anchor}[,...]]
      const hashIdx = m.ref.indexOf('#');
      const base = hashIdx >= 0 ? m.ref.slice(0, hashIdx) : m.ref;
      if (!ID_REGEX.test(base)) {
        errors.push({
          field: 'ref',
          message: `loose ref base "${base}" does not match {id} format`,
        });
      }
    } else {
      // strict: must match anchor-id
      if (!ANCHOR_ID_REGEX.test(m.ref)) {
        errors.push({
          field: 'ref',
          message: `strict ref "${m.ref}" does not match {name}~{hash} anchor-id format`,
        });
      }
    }
  }
}
