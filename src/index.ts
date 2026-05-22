/**
 * scry-parse — TypeScript parser for scry-spec v1.0
 *
 * Public API surface:
 *   - parseMarkers(content, file?, language?) → ParseResult
 *   - validateMarker(marker) → ValidationResult
 *   - mintId(kind, name, content?) → string
 *   - checkCycles(entries) → string[][] (FR12: cycle detection)
 *
 * Types:
 *   - EntryMarker, AnchorMarker, BindingMarker
 *   - ParseResult, Diagnostic
 *   - ValidationResult, ValidationError, ValidationWarning
 *   - Marker
 *
 * Constants:
 *   - BASELINE_KINDS, BASELINE_STATUSES
 */

// Functions
export { parseMarkers } from './markers.js';
export { validateMarker } from './validate.js';
export { mintId } from './mint.js';
export { checkCycles } from './cycles.js';

// Types from markers
export type {
  EntryMarker,
  AnchorMarker,
  BindingMarker,
  ParseResult,
  Diagnostic,
  ExtrasValue,
  ExtrasMap,
} from './markers.js';

// Types from validate
export type {
  Marker,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './validate.js';

// Constants and type aliases
export {
  BASELINE_KINDS,
  BASELINE_STATUSES,
  PREDICATES,
  SCRY_SPEC_VERSION,
} from './consts.js';

export type {
  BaselineKind,
  BaselineStatus,
  Predicate,
} from './consts.js';
