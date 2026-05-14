var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/markers.ts
import yaml from "js-yaml";
function detectCommentStyle(sentinelLine) {
  const trimmed = sentinelLine.trimStart();
  if (trimmed.startsWith("<!--")) return "markdown";
  if (trimmed.startsWith("//")) return "ts";
  if (trimmed.startsWith("#")) return "python";
  if (trimmed.startsWith("--")) return "sql";
  if (trimmed.startsWith(";;")) return "lisp2";
  if (trimmed.startsWith(";")) return "lisp1";
  return "none";
}
function stripCommentPrefix(line, style) {
  switch (style) {
    case "markdown":
      return line.replace(/-->\s*$/, "").replace(/<!--\s*/, "");
    case "ts":
      return line.replace(/^\s*\/\/\s?/, "");
    case "python":
      return line.replace(/^\s*#\s?/, "");
    case "sql":
      return line.replace(/^\s*--\s?/, "");
    case "lisp2":
      return line.replace(/^\s*;;\s?/, "");
    case "lisp1":
      return line.replace(/^\s*;\s?/, "");
    default:
      return line;
  }
}
function matchDeclarativeOpen(line) {
  const bare = line.replace(/^\s*(\/\/|#|--|;;|;)\s?/, "").replace(/<!--\s?/, "").replace(/\s*-->$/, "").trim();
  const entryMatch = /^@scry\.entry\s*$/.exec(bare);
  if (entryMatch) return { type: "entry" };
  const anchorMatch = /^@scry\.anchor\s+([a-z0-9-]+~[a-f0-9]{8})\s*$/.exec(bare);
  if (anchorMatch) return { type: "anchor", anchorId: anchorMatch[1] };
  return null;
}
function matchDeclarativeClose(line, type) {
  const bare = line.replace(/^\s*(\/\/|#|--|;;|;)\s?/, "").replace(/<!--\s?/, "").replace(/\s*-->$/, "").trim();
  return bare === `@scry.${type}.end`;
}
function matchBindOpen(line) {
  const bare = line.replace(/^\s*(\/\/|#|--|;;|;)\s?/, "").replace(/<!--\s?/, "").replace(/\s*-->$/, "").trim();
  const m = /^@scry\.bind\s+(\S+)\s+(\S+)(?:\s+(.+))?$/.exec(bare);
  if (!m) return null;
  return {
    localId: m[1],
    ref: m[2],
    trailing: m[3]?.trim() ?? null
  };
}
function matchBindClose(line) {
  const bare = line.replace(/^\s*(\/\/|#|--|;;|;)\s?/, "").replace(/<!--\s?/, "").replace(/\s*-->$/, "").trim();
  return bare === "@scry.bind.end";
}
function refMode(ref) {
  const tildeIdx = ref.indexOf("~");
  if (tildeIdx < 0) return "strict";
  const dotIdx = ref.indexOf(".");
  return dotIdx >= 0 && dotIdx < tildeIdx ? "loose" : "strict";
}
function expandRef(ref, mode) {
  if (mode === "strict") return [ref];
  const hashIdx = ref.indexOf("#");
  if (hashIdx < 0) return [ref];
  const base = ref.slice(0, hashIdx);
  const anchors = ref.slice(hashIdx + 1).split(",").map((a) => a.trim());
  return anchors.map((a) => `${base}#${a}`);
}
function insideDeclarativeSpan(lineIdx, spans) {
  return spans.some((s) => lineIdx > s.start && lineIdx < s.end);
}
function extractBody(lines, startIdx, endIdx, style) {
  const bodyLines = [];
  for (let i = startIdx + 1; i < endIdx; i++) {
    bodyLines.push(stripCommentPrefix(lines[i], style));
  }
  return bodyLines.join("\n");
}
function coerceStringField(val) {
  if (val == null) return "";
  return String(val).trim();
}
function coerceArrayField(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map(String);
  return [];
}
function coerceNullableString(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}
function parseMarkers(content, file = "<unknown>", _language) {
  const lines = content.split("\n");
  const entries = [];
  const anchors = [];
  const bindings = [];
  const diagnostics = [];
  const declarativeSpans = [];
  let i = 0;
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
      } else {
        j++;
      }
    }
  }
  while (i < lines.length) {
    const line = lines[i];
    const declOpen = matchDeclarativeOpen(line);
    if (declOpen) {
      const startI = i;
      const style = detectCommentStyle(line);
      i++;
      const bodyLines = [];
      while (i < lines.length) {
        if (matchDeclarativeClose(lines[i], declOpen.type)) {
          const endI = i;
          const bodyYaml = extractBody(lines, startI, endI, style);
          if (declOpen.type === "entry") {
            const entry = parseEntryBody(bodyYaml, file, [startI, endI], diagnostics);
            if (entry) entries.push(entry);
          } else if (declOpen.type === "anchor") {
            const anchor = parseAnchorBody(bodyYaml, declOpen.anchorId, file, [startI, endI], diagnostics);
            if (anchor) anchors.push(anchor);
          }
          i = endI + 1;
          break;
        }
        bodyLines.push(i);
        i++;
        if (i >= lines.length) {
          diagnostics.push({
            level: "warning",
            message: `Unterminated @scry.${declOpen.type} marker starting at line ${startI + 1}`,
            line: startI
          });
        }
      }
      continue;
    }
    const bindOpen = matchBindOpen(line);
    if (bindOpen) {
      if (insideDeclarativeSpan(i, declarativeSpans)) {
        i++;
        continue;
      }
      const openIdx = i;
      const style = detectCommentStyle(line);
      i++;
      const blockBodyLines = [];
      let resolved = false;
      while (i < lines.length) {
        const scanLine = lines[i];
        if (matchBindClose(scanLine)) {
          if (bindOpen.trailing !== null) {
            diagnostics.push({
              level: "error",
              message: `Binding at line ${openIdx + 1} has both inline comment and block body (mutual exclusion violation, FR2)`,
              line: openIdx
            });
          }
          const comment = blockBodyLines.map((l) => stripCommentPrefix(l, style)).join("\n").trim();
          const bindSpan = [openIdx, i];
          recordBinding(
            bindOpen.localId,
            bindOpen.ref,
            comment || null,
            file,
            openIdx,
            bindSpan,
            bindings,
            diagnostics
          );
          i++;
          resolved = true;
          break;
        }
        const nextBindOpen = matchBindOpen(scanLine);
        if (nextBindOpen) {
          const comment = bindOpen.trailing;
          recordBinding(
            bindOpen.localId,
            bindOpen.ref,
            comment,
            file,
            openIdx,
            null,
            bindings,
            diagnostics
          );
          resolved = true;
          break;
        }
        blockBodyLines.push(scanLine);
        i++;
      }
      if (!resolved) {
        recordBinding(
          bindOpen.localId,
          bindOpen.ref,
          bindOpen.trailing,
          file,
          openIdx,
          null,
          bindings,
          diagnostics
        );
      }
      continue;
    }
    if (matchBindClose(line) && !insideDeclarativeSpan(i, declarativeSpans)) {
      diagnostics.push({
        level: "warning",
        message: `Orphaned @scry.bind.end at line ${i + 1}`,
        line: i
      });
    }
    i++;
  }
  return { entries, anchors, bindings, diagnostics };
}
function parseEntryBody(bodyYaml, file, span, diagnostics) {
  let raw;
  try {
    const parsed = yaml.load(bodyYaml);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      diagnostics.push({ level: "error", message: `Entry YAML body is not an object (${file}:${span[0] + 1})` });
      return null;
    }
    raw = parsed;
  } catch (e) {
    diagnostics.push({
      level: "error",
      message: `YAML parse error in entry at ${file}:${span[0] + 1}: ${e.message}`,
      line: span[0]
    });
    return null;
  }
  const id = coerceStringField(raw["id"]);
  const kind = coerceStringField(raw["kind"]);
  const summary = coerceStringField(raw["summary"]);
  const status = coerceStringField(raw["status"]);
  if (!id || !kind || !summary || !status) {
    diagnostics.push({
      level: "error",
      message: `Entry missing required fields (id, kind, summary, status) at ${file}:${span[0] + 1}`,
      line: span[0]
    });
    return null;
  }
  let weight = null;
  if ("weight" in raw && raw["weight"] != null) {
    const w = Number(raw["weight"]);
    weight = isNaN(w) ? null : w;
  }
  return {
    id,
    kind,
    // FR8: preserved as-authored
    summary,
    status,
    // FR9: preserved as-authored
    weight,
    tags: coerceArrayField(raw["tags"]),
    rationale: coerceStringField(raw["rationale"]),
    applies: coerceStringField(raw["applies"]),
    seededQuestions: coerceArrayField(raw["seeded_questions"]),
    dependsOn: coerceArrayField(raw["depends_on"]),
    implements: coerceNullableString(raw["implements"]),
    supersedes: coerceNullableString(raw["supersedes"]),
    file,
    span
  };
}
function parseAnchorBody(bodyYaml, anchorId, file, span, diagnostics) {
  let raw;
  try {
    const parsed = yaml.load(bodyYaml);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      diagnostics.push({ level: "error", message: `Anchor YAML body is not an object (${file}:${span[0] + 1})` });
      return null;
    }
    raw = parsed;
  } catch (e) {
    diagnostics.push({
      level: "error",
      message: `YAML parse error in anchor at ${file}:${span[0] + 1}: ${e.message}`,
      line: span[0]
    });
    return null;
  }
  const description = coerceStringField(raw["description"]);
  if (!description) {
    diagnostics.push({
      level: "error",
      message: `Anchor missing required field 'description' at ${file}:${span[0] + 1}`,
      line: span[0]
    });
    return null;
  }
  return {
    name: anchorId,
    description,
    seededQuestions: coerceArrayField(raw["seeded_questions"]),
    file,
    span
  };
}
function recordBinding(localId, ref, comment, file, offset, span, bindings, _diagnostics) {
  const mode = refMode(ref);
  const expandedRefs = expandRef(ref, mode);
  for (const r of expandedRefs) {
    bindings.push({
      localId,
      ref: r,
      mode,
      comment: comment && comment.trim() !== "" ? comment.trim() : null,
      file,
      offset,
      span
    });
  }
}

// src/consts.ts
var BASELINE_KINDS = [
  // Documentation/Knowledge
  "design",
  "pattern",
  "spec",
  "lesson",
  "internal",
  // Work Management
  "task",
  "milestone",
  // Analysis/Outputs
  "report",
  "audit",
  "research",
  // Implementation
  "code"
];
var BASELINE_STATUSES = ["draft", "active", "deprecated"];
var ID_REGEX = /^[a-z]+\.[a-z0-9-]+~[a-f0-9]{8}$/;
var ANCHOR_ID_REGEX = /^[a-z0-9-]+~[a-f0-9]{8}$/;

// src/validate.ts
function isEntryMarker(m) {
  return "id" in m && "kind" in m && "summary" in m && "status" in m;
}
function isAnchorMarker(m) {
  return "name" in m && "description" in m && !("id" in m);
}
function isBindingMarker(m) {
  return "localId" in m && "ref" in m;
}
function validateMarker(marker) {
  const errors = [];
  const warnings = [];
  if (isEntryMarker(marker)) {
    validateEntry(marker, errors, warnings);
  } else if (isAnchorMarker(marker)) {
    validateAnchor(marker, errors, warnings);
  } else if (isBindingMarker(marker)) {
    validateBinding(marker, errors, warnings);
  } else {
    errors.push({ field: "marker", message: "Unknown marker type" });
  }
  return { ok: errors.length === 0, errors, warnings };
}
function validateEntry(m, errors, warnings) {
  if (!m.id) {
    errors.push({ field: "id", message: "id is required and must be non-empty" });
  } else if (!ID_REGEX.test(m.id)) {
    errors.push({
      field: "id",
      message: `id "${m.id}" does not match required format {kind}.{name}~{hash} (^[a-z]+\\.[a-z0-9-]+~[a-f0-9]{8}$)`
    });
  }
  if (!m.kind) {
    errors.push({ field: "kind", message: "kind is required and must be non-empty" });
  } else if (!BASELINE_KINDS.includes(m.kind)) {
    warnings.push({
      field: "kind",
      message: `kind "${m.kind}" is not in the baseline kinds list \u2014 preserved as-authored per FR8`
    });
  }
  if (!m.summary || m.summary.trim() === "") {
    errors.push({ field: "summary", message: "summary is required and must be non-empty" });
  }
  if (!m.status || m.status.trim() === "") {
    errors.push({ field: "status", message: "status is required and must be non-empty" });
  } else if (!BASELINE_STATUSES.includes(m.status)) {
    warnings.push({
      field: "status",
      message: `status "${m.status}" is not a baseline status \u2014 preserved as-authored per FR9`
    });
  }
  if (m.kind === "design" && (!m.rationale || m.rationale.trim() === "")) {
    warnings.push({
      field: "rationale",
      message: "rationale is empty for a design marker \u2014 consider adding rationale for discoverability"
    });
  }
  if (m.weight !== null && (m.weight < 0 || m.weight > 1)) {
    errors.push({ field: "weight", message: `weight ${m.weight} is out of range [0.0, 1.0]` });
  }
}
function validateAnchor(m, errors, warnings) {
  if (!m.name) {
    errors.push({ field: "name", message: "anchor name (from sentinel) is required" });
  } else if (!ANCHOR_ID_REGEX.test(m.name)) {
    errors.push({
      field: "name",
      message: `anchor name "${m.name}" does not match {name}~{hash} format`
    });
  }
  if (!m.description || m.description.trim() === "") {
    errors.push({ field: "description", message: "description is required and must be non-empty" });
  }
  void warnings;
}
function validateBinding(m, errors, _warnings) {
  if (!m.localId) {
    errors.push({ field: "localId", message: "localId is required" });
  } else if (!/^[a-z0-9-]+~[a-f0-9]{8}$/.test(m.localId)) {
    errors.push({
      field: "localId",
      message: `localId "${m.localId}" does not match {name}~{hash} format`
    });
  }
  if (!m.ref) {
    errors.push({ field: "ref", message: "ref is required" });
  } else {
    if (m.mode === "loose") {
      const hashIdx = m.ref.indexOf("#");
      const base = hashIdx >= 0 ? m.ref.slice(0, hashIdx) : m.ref;
      if (!ID_REGEX.test(base)) {
        errors.push({
          field: "ref",
          message: `loose ref base "${base}" does not match {id} format`
        });
      }
    } else {
      if (!ANCHOR_ID_REGEX.test(m.ref)) {
        errors.push({
          field: "ref",
          message: `strict ref "${m.ref}" does not match {name}~{hash} anchor-id format`
        });
      }
    }
  }
}

// src/mint.ts
import { createHash } from "crypto";
function mintId(kind, name, content) {
  const safeKind = kind.toLowerCase().replace(/[^a-z]/g, "");
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  let hash;
  if (content !== void 0) {
    hash = createHash("sha256").update(content).digest("hex").slice(0, 8);
  } else {
    const { randomBytes } = __require("crypto");
    hash = randomBytes(4).toString("hex");
  }
  return `${safeKind}.${safeName}~${hash}`;
}
export {
  BASELINE_KINDS,
  BASELINE_STATUSES,
  mintId,
  parseMarkers,
  validateMarker
};
