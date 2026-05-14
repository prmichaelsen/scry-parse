import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntryMarker {
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
  /** Unknown YAML fields preserved as-is per spec (parsers must not drop them) */
  extra: Record<string, unknown>;
  /** Source file path */
  file: string;
  /** [startLine, endLine] 0-indexed inclusive */
  span: [number, number];
}

export interface AnchorMarker {
  /** Anchor identifier: {name}~{hash} */
  name: string;
  /** What this anchor represents */
  description: string;
  /** Common questions about this anchor */
  seededQuestions: string[];
  /** Unknown YAML fields preserved as-is per spec (parsers must not drop them) */
  extra: Record<string, unknown>;
  /** Source file path */
  file: string;
  /** [startLine, endLine] 0-indexed inclusive */
  span: [number, number];
}

export interface BindingMarker {
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

export interface ParseResult {
  entries: EntryMarker[];
  anchors: AnchorMarker[];
  bindings: BindingMarker[];
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  level: 'info' | 'warning' | 'error';
  message: string;
  line?: number;
}

// ---------------------------------------------------------------------------
// Comment-prefix inference (supports all line and block comment styles)
// ---------------------------------------------------------------------------

type Language = 'markdown' | 'typescript' | 'python' | 'sql' | 'lisp' | 'auto';

/**
 * Infer the comment prefix from body lines using the YAML-key-start trick.
 *
 * Algorithm (ported from scry Python implementation):
 *   1. Scan body lines for the first one whose non-key portion is purely
 *      whitespace + comment characters.
 *   2. That portion is the inferred prefix.
 *   3. Strip the prefix uniformly from all body lines.
 *
 * This handles all comment styles without enumeration:
 *   - Line-comment:  `# `, `// `, `-- `, `;;`, `;`
 *   - Block-comment: ` * ` (JSDoc), ` ` (plain indent)
 */
const _KEY_RE = /^(.*?)([A-Za-z_][A-Za-z0-9_-]*\s*:)/;
const _PREFIX_VALID = /^[\s#/*\->]*$/;

function inferPrefix(lines: string[]): string {
  for (const line of lines) {
    const m = _KEY_RE.exec(line);
    if (!m) continue;
    const candidate = m[1];
    if (_PREFIX_VALID.test(candidate)) return candidate;
  }
  return '';
}

/**
 * Strip the inferred comment prefix from each line in a body string.
 *
 * @param body - Joined body lines
 * @param fallbackPrefix - Used when no YAML-key line is found (e.g. freeform
 *   prose in binding bodies). Typically the prefix extracted from the sentinel
 *   line: everything before `@scry.`.
 */
function stripBodyPrefixes(body: string, fallbackPrefix = ''): string {
  const lines = body.split('\n');
  const prefix = inferPrefix(lines) || fallbackPrefix;
  if (!prefix) return body;
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      out.push(line.slice(prefix.length));
    } else if (line.trim() === '') {
      out.push('');
    } else {
      // Try rstripped prefix (handles continuation lines with trimmed trailing space)
      const rstripped = prefix.trimEnd();
      if (rstripped && line.startsWith(rstripped)) {
        out.push(line.slice(rstripped.length).replace(/^ /, ''));
      } else {
        out.push(line);
      }
    }
  }
  return out.join('\n');
}

/** Extract the comment prefix from a sentinel line (everything before '@scry.'). */
function prefixFromSentinel(sentinelLine: string): string {
  const idx = sentinelLine.indexOf('@scry.');
  return idx >= 0 ? sentinelLine.slice(0, idx) : '';
}

// ---------------------------------------------------------------------------
// Sentinel matchers
// ---------------------------------------------------------------------------

/**
 * Strip any comment wrappers from a line to extract the core sentinel token.
 *
 * Handles all line-comment styles (// # -- ;; ;) and block-comment styles
 * (/* /** * {- (* <# and their closing counterparts).
 */
function extractSentinelContent(line: string): string {
  return line
    // Strip leading whitespace and any comment-opening chars
    .replace(/^\s*(?:<!--\s*|\/\*+\s*|\*+\s*|\/\/+\s*|#+\s*|--+\s*|;;+\s*|;\s*|\{-\s*|\(\*\s*|<#\s*)/, '')
    // Strip trailing comment-closing chars
    .replace(/\s*(?:-->\s*|\*\/\s*|-\}\s*|\*\)\s*|#>\s*)$/, '')
    .trim();
}

/**
 * Extract the leading comment prefix from a sentinel line (without the sentinel text).
 *
 * Used for binding block bodies, which contain free-text prose (not YAML),
 * so inferPrefix (YAML-key-based) cannot be used. Instead we extract the prefix
 * from the bind open line and strip it uniformly from body lines.
 */
function extractCommentPrefix(line: string): string {
  const m = /^\s*(?:<!--\s*|\/\*+\s*|\*+\s*|\/\/+\s*|#+\s*|--+\s*|;;+\s*|;\s*|\{-\s*|\(\*\s*|<#\s*)/.exec(line);
  return m ? m[0] : '';
}

/** Match opening declarative sentinel: @scry.{entry|anchor} [{anchor-id}] */
function matchDeclarativeOpen(line: string): { type: 'entry' | 'anchor'; anchorId?: string } | null {
  const bare = extractSentinelContent(line);
  const entryMatch = /^@scry\.entry\s*$/.exec(bare);
  if (entryMatch) return { type: 'entry' };
  const anchorMatch = /^@scry\.anchor\s+([a-z0-9-]+~[a-f0-9]{8})\s*$/.exec(bare);
  if (anchorMatch) return { type: 'anchor', anchorId: anchorMatch[1] };
  return null;
}

/** Match closing declarative sentinel: @scry.{type}.end */
function matchDeclarativeClose(line: string, type: 'entry' | 'anchor'): boolean {
  const bare = extractSentinelContent(line);
  return bare === `@scry.${type}.end`;
}

/** Match bind opening line: @scry.bind {local-id} {ref} [{comment}] */
function matchBindOpen(line: string): { localId: string; ref: string; trailing: string | null } | null {
  const bare = extractSentinelContent(line);
  const m = /^@scry\.bind\s+(\S+)\s+(\S+)(?:\s+(.+))?$/.exec(bare);
  if (!m) return null;
  return {
    localId: m[1],
    ref: m[2],
    trailing: m[3]?.trim() ?? null,
  };
}

/** Match bind close: @scry.bind.end */
function matchBindClose(line: string): boolean {
  const bare = extractSentinelContent(line);
  return bare === '@scry.bind.end';
}

// ---------------------------------------------------------------------------
// Reference parsing helpers
// ---------------------------------------------------------------------------

/**
 * Determine if a ref is loose (artifact-ref) or strict (anchor-id).
 * Loose: contains '.' before '~'
 * Strict: no '.' before '~'
 */
function refMode(ref: string): 'loose' | 'strict' {
  const tildeIdx = ref.indexOf('~');
  if (tildeIdx < 0) return 'strict'; // malformed, treat as strict
  const dotIdx = ref.indexOf('.');
  return dotIdx >= 0 && dotIdx < tildeIdx ? 'loose' : 'strict';
}

/**
 * Expand a ref with comma-separated loose anchors into multiple refs.
 * Only applies in loose mode with a # fragment.
 * Returns array of (ref, anchor|null) tuples.
 */
function expandRef(ref: string, mode: 'loose' | 'strict'): string[] {
  if (mode === 'strict') return [ref];
  const hashIdx = ref.indexOf('#');
  if (hashIdx < 0) return [ref]; // artifact-level, no expansion
  const base = ref.slice(0, hashIdx);
  const anchors = ref.slice(hashIdx + 1).split(',').map(a => a.trim());
  return anchors.map(a => `${base}#${a}`);
}

// ---------------------------------------------------------------------------
// Span tracking helpers
// ---------------------------------------------------------------------------

interface DeclarativeSpan {
  type: 'entry' | 'anchor';
  start: number;
  end: number;
}

/** Check if line is inside any declarative span */
function insideDeclarativeSpan(lineIdx: number, spans: DeclarativeSpan[]): boolean {
  return spans.some(s => lineIdx > s.start && lineIdx < s.end);
}

// ---------------------------------------------------------------------------
// Body extraction
// ---------------------------------------------------------------------------

/** Extract and clean YAML body between open/close lines using prefix inference */
function extractBody(lines: string[], startIdx: number, endIdx: number): string {
  const bodyLines: string[] = [];
  for (let i = startIdx + 1; i < endIdx; i++) {
    bodyLines.push(lines[i]);
  }
  return stripBodyPrefixes(bodyLines.join('\n'));
}

// ---------------------------------------------------------------------------
// YAML parsing helpers
// ---------------------------------------------------------------------------

function coerceStringField(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

function coerceArrayField(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map(String);
  return [];
}

function coerceNullableString(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse all scry markers from file content.
 *
 * @param content - Raw file content
 * @param file - File path for provenance
 * @param _language - Hint (currently unused; style auto-detected per sentinel line)
 */
export function parseMarkers(
  content: string,
  file = '<unknown>',
  _language?: Language,
): ParseResult {
  const lines = content.split('\n');
  const entries: EntryMarker[] = [];
  const anchors: AnchorMarker[] = [];
  const bindings: BindingMarker[] = [];
  const diagnostics: Diagnostic[] = [];

  // First pass: find all declarative spans so we can apply FR3
  const declarativeSpans: DeclarativeSpan[] = [];

  // We do two logical passes in one physical scan.
  // State machine:
  // - idle: scanning for any sentinel
  // - inDeclarative: inside @scry.entry or @scry.anchor
  // - inBind: disambiguation scan for a bind candidate

  let i = 0;

  // Pre-scan to find all declarative spans for FR3
  {
    let j = 0;
    while (j < lines.length) {
      const line = lines[j];
      const declOpen = matchDeclarativeOpen(line);
      if (declOpen) {
        const startJ = j;
        j++;
        while (j < lines.length) {
          if (matchDeclarativeClose(lines[j], declOpen.type)) {
            declarativeSpans.push({ type: declOpen.type, start: startJ, end: j });
            j++;
            break;
          }
          j++;
        }
        // If no close found, unterminated — skip (Test 6)
      } else {
        j++;
      }
    }
  }

  // Main parse pass
  while (i < lines.length) {
    const line = lines[i];

    // --- Declarative markers ---
    const declOpen = matchDeclarativeOpen(line);
    if (declOpen) {
      const startI = i;
      i++;
      const bodyLines: number[] = [];

      while (i < lines.length) {
        if (matchDeclarativeClose(lines[i], declOpen.type)) {
          // Found close
          const endI = i;
          const bodyYaml = extractBody(lines, startI, endI);

          if (declOpen.type === 'entry') {
            const entry = parseEntryBody(bodyYaml, file, [startI, endI], diagnostics);
            if (entry) entries.push(entry);
          } else if (declOpen.type === 'anchor') {
            const anchor = parseAnchorBody(bodyYaml, declOpen.anchorId!, file, [startI, endI], diagnostics);
            if (anchor) anchors.push(anchor);
          }

          i = endI + 1;
          break;
        }
        bodyLines.push(i);
        i++;

        if (i >= lines.length) {
          // Unterminated — Test 6: no marker indexed
          diagnostics.push({
            level: 'warning',
            message: `Unterminated @scry.${declOpen.type} marker starting at line ${startI + 1}`,
            line: startI,
          });
        }
      }
      continue;
    }

    // --- Binding markers ---
    const bindOpen = matchBindOpen(line);
    if (bindOpen) {
      // FR3: check positional exclusion
      if (insideDeclarativeSpan(i, declarativeSpans)) {
        i++;
        continue;
      }

      const openIdx = i;
      const bindPrefix = extractCommentPrefix(line);
      // Deterministic forward scan (FR2)
      i++;
      const blockBodyLines: string[] = [];
      let resolved = false;

      while (i < lines.length) {
        const scanLine = lines[i];

        if (matchBindClose(scanLine)) {
          // Block form
          if (bindOpen.trailing !== null) {
            diagnostics.push({
              level: 'error',
              message: `Binding at line ${openIdx + 1} has both inline comment and block body (mutual exclusion violation, FR2)`,
              line: openIdx,
            });
            // Still record with trailing as comment per lenient behavior
          }
          // Strip the open-sentinel's comment prefix from each body line.
          // Binding bodies are free-text prose (not YAML) so we cannot use
          // inferPrefix (which requires YAML keys). We use the prefix from
          // the open sentinel line and strip it uniformly.
          const comment = blockBodyLines
            .map(l => (bindPrefix && l.startsWith(bindPrefix)) ? l.slice(bindPrefix.length) : l)
            .join('\n')
            .trim();
          const bindSpan: [number, number] = [openIdx, i];
          recordBinding(
            bindOpen.localId,
            bindOpen.ref,
            comment || null,
            file,
            openIdx,
            bindSpan,
            bindings,
            diagnostics,
          );
          i++;
          resolved = true;
          break;
        }

        const nextBindOpen = matchBindOpen(scanLine);
        if (nextBindOpen) {
          // Previous was single-line
          const comment = bindOpen.trailing;
          recordBinding(
            bindOpen.localId,
            bindOpen.ref,
            comment,
            file,
            openIdx,
            null,
            bindings,
            diagnostics,
          );
          // Don't advance i — re-process this line as a new bind
          resolved = true;
          break;
        }

        blockBodyLines.push(scanLine);
        i++;
      }

      if (!resolved) {
        // EOF — single-line
        recordBinding(
          bindOpen.localId,
          bindOpen.ref,
          bindOpen.trailing,
          file,
          openIdx,
          null,
          bindings,
          diagnostics,
        );
      }
      continue;
    }

    // Check for orphaned bind.end
    if (matchBindClose(line) && !insideDeclarativeSpan(i, declarativeSpans)) {
      diagnostics.push({
        level: 'warning',
        message: `Orphaned @scry.bind.end at line ${i + 1}`,
        line: i,
      });
    }

    i++;
  }

  return { entries, anchors, bindings, diagnostics };
}

// ---------------------------------------------------------------------------
// Entry body parser
// ---------------------------------------------------------------------------

function parseEntryBody(
  bodyYaml: string,
  file: string,
  span: [number, number],
  diagnostics: Diagnostic[],
): EntryMarker | null {
  let raw: Record<string, unknown>;
  try {
    const parsed = yaml.load(bodyYaml);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      diagnostics.push({ level: 'error', message: `Entry YAML body is not an object (${file}:${span[0] + 1})` });
      return null;
    }
    raw = parsed as Record<string, unknown>;
  } catch (e: unknown) {
    diagnostics.push({
      level: 'error',
      message: `YAML parse error in entry at ${file}:${span[0] + 1}: ${(e as Error).message}`,
      line: span[0],
    });
    return null;
  }

  const id = coerceStringField(raw['id']);
  const kind = coerceStringField(raw['kind']);
  const summary = coerceStringField(raw['summary']);
  const status = coerceStringField(raw['status']);

  // Required-non-empty fields
  if (!id || !kind || !summary || !status) {
    diagnostics.push({
      level: 'error',
      message: `Entry missing required fields (id, kind, summary, status) at ${file}:${span[0] + 1}`,
      line: span[0],
    });
    return null;
  }

  // weight: null → default 0.5 per spec
  let weight: number | null = null;
  if ('weight' in raw && raw['weight'] != null) {
    const w = Number(raw['weight']);
    weight = isNaN(w) ? null : w;
  }

  // Collect unknown fields per spec: "Unknown YAML fields must not error; parsers must preserve them"
  const KNOWN_ENTRY_FIELDS = new Set([
    'id', 'kind', 'summary', 'status', 'weight', 'tags',
    'rationale', 'applies', 'seeded_questions', 'depends_on',
    'implements', 'supersedes',
  ]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!KNOWN_ENTRY_FIELDS.has(k)) extra[k] = v;
  }

  return {
    id,
    kind,           // FR8: preserved as-authored
    summary,
    status,         // FR9: preserved as-authored
    weight,
    tags: coerceArrayField(raw['tags']),
    rationale: coerceStringField(raw['rationale']),
    applies: coerceStringField(raw['applies']),
    seededQuestions: coerceArrayField(raw['seeded_questions']),
    dependsOn: coerceArrayField(raw['depends_on']),
    implements: coerceNullableString(raw['implements']),
    supersedes: coerceNullableString(raw['supersedes']),
    extra,
    file,
    span,
  };
}

// ---------------------------------------------------------------------------
// Anchor body parser
// ---------------------------------------------------------------------------

function parseAnchorBody(
  bodyYaml: string,
  anchorId: string,
  file: string,
  span: [number, number],
  diagnostics: Diagnostic[],
): AnchorMarker | null {
  let raw: Record<string, unknown>;
  try {
    const parsed = yaml.load(bodyYaml);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      diagnostics.push({ level: 'error', message: `Anchor YAML body is not an object (${file}:${span[0] + 1})` });
      return null;
    }
    raw = parsed as Record<string, unknown>;
  } catch (e: unknown) {
    diagnostics.push({
      level: 'error',
      message: `YAML parse error in anchor at ${file}:${span[0] + 1}: ${(e as Error).message}`,
      line: span[0],
    });
    return null;
  }

  const description = coerceStringField(raw['description']);
  if (!description) {
    diagnostics.push({
      level: 'error',
      message: `Anchor missing required field 'description' at ${file}:${span[0] + 1}`,
      line: span[0],
    });
    return null;
  }

  // Collect unknown fields per spec
  const KNOWN_ANCHOR_FIELDS = new Set(['description', 'seeded_questions']);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!KNOWN_ANCHOR_FIELDS.has(k)) extra[k] = v;
  }

  return {
    name: anchorId,
    description,
    seededQuestions: coerceArrayField(raw['seeded_questions']),
    extra,
    file,
    span,
  };
}

// ---------------------------------------------------------------------------
// Binding recorder (expands comma-separated loose anchors)
// ---------------------------------------------------------------------------

function recordBinding(
  localId: string,
  ref: string,
  comment: string | null,
  file: string,
  offset: number,
  span: [number, number] | null,
  bindings: BindingMarker[],
  _diagnostics: Diagnostic[],
): void {
  const mode = refMode(ref);
  const expandedRefs = expandRef(ref, mode);

  for (const r of expandedRefs) {
    bindings.push({
      localId,
      ref: r,
      mode,
      comment: comment && comment.trim() !== '' ? comment.trim() : null,
      file,
      offset,
      span,
    });
  }
}
