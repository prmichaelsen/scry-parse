/**
 * scry-parse — TypeScript parser for scry-spec v1.0
 *
 * Public API surface:
 *   - parseMarkers(content, file?, language?) → ParseResult
 *   - validateMarker(marker) → ValidationResult
 *   - mintId(kind, name, content?) → string
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

// Types from markers
export type {
  EntryMarker,
  AnchorMarker,
  BindingMarker,
  ParseResult,
  Diagnostic,
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
} from './consts.js';

export type {
  BaselineKind,
  BaselineStatus,
} from './consts.js';
