/**
 * output-normalizers.ts — G6.3.1
 *
 * Per-shape output normalizers for the differential-solve / witness-pairing
 * harness (G6.2).  A normalizer converts a raw impulse body (unknown at
 * runtime) into a canonical, deterministic form so that two runs producing
 * semantically equivalent output are treated as "agreed".
 *
 * Four built-in shapes:
 *   fileEdit         — trim per-line whitespace + normalise line endings
 *   validation_result — extract structural verdict fields, drop timestamps
 *   gitDiff          — parse into sorted file-patch records
 *   directoryTree    — sort path list, normalise separators
 *
 * All other shapes fall back to canonical JSON (deep-sorted keys).
 *
 * Public API:
 *   normalizeOutput(shape, body) → unknown   (normalised canonical form)
 *   outputsAgree(shape, a, b) → bool
 *   diffOutputs(shape, a, b) → null | Record<string,unknown>
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deep-sort object keys so JSON.stringify is deterministic. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

// ---------------------------------------------------------------------------
// Shape: fileEdit
// Canonical form: trimmed lines joined with \n, leading/trailing blank lines stripped.
// ---------------------------------------------------------------------------

function normalizeFileEdit(body: unknown): unknown {
  let content: string;
  if (typeof body === "string") {
    content = body;
  } else if (body !== null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    content = typeof obj["content"] === "string" ? obj["content"] : canonical(obj);
    const path = typeof obj["path"] === "string" ? obj["path"] : null;
    const normalized = normalizeTextContent(content);
    return path ? { path, content: normalized } : { content: normalized };
  } else {
    return body;
  }
  return normalizeTextContent(content);
}

function normalizeTextContent(text: string): string {
  return text
    .replace(/\r\n/g, "\n")   // CRLF → LF
    .replace(/\r/g, "\n")     // CR → LF
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // collapse 3+ blank lines to 2
    .trim();
}

// ---------------------------------------------------------------------------
// Shape: validation_result
// Canonical form: only structural verdict fields (passed, failedChecks,
// passedChecks, totalChecks, rule, validator_id).  Timestamps and messages dropped.
// ---------------------------------------------------------------------------

function normalizeValidationResult(body: unknown): unknown {
  if (body === null || typeof body !== "object") return body;
  const obj = body as Record<string, unknown>;
  return {
    passed: Boolean(obj["passed"]),
    totalChecks: typeof obj["totalChecks"] === "number" ? obj["totalChecks"] : undefined,
    passedChecks: typeof obj["passedChecks"] === "number" ? obj["passedChecks"] : undefined,
    failedChecks: typeof obj["failedChecks"] === "number" ? obj["failedChecks"] : undefined,
    rule: typeof obj["rule"] === "string" ? obj["rule"] : undefined,
    validator_id: typeof obj["validator_id"] === "string" ? obj["validator_id"] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Shape: gitDiff
// Canonical form: sorted list of file-patch records.
// Input can be a unified diff string or structured object.
// ---------------------------------------------------------------------------

interface FilePatch {
  path: string;
  additions: number;
  deletions: number;
  hunks: string[];
}

function parseUnifiedDiff(diff: string): FilePatch[] {
  const patches: FilePatch[] = [];
  let current: FilePatch | null = null;
  let currentHunk = "";

  for (const line of diff.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    if (line.startsWith("diff --git ") || line.startsWith("--- ") && !line.startsWith("--- /dev")) {
      if (current) {
        if (currentHunk) current.hunks.push(currentHunk.trim());
        patches.push(current);
      }
      // Try to extract the path from diff --git a/... b/...
      const match = line.match(/diff --git a\/(.+) b\/.+/);
      current = {
        path: match ? match[1].trim() : line.replace(/^diff --git /, "").trim(),
        additions: 0,
        deletions: 0,
        hunks: [],
      };
      currentHunk = "";
    } else if (line.startsWith("+++ ") && current) {
      // Capture b/ path if not yet set from diff --git
      const match = line.match(/^\+\+\+ b\/(.+)/);
      if (match && current.path === "") current.path = match[1].trim();
    } else if (line.startsWith("@@") && current) {
      if (currentHunk) current.hunks.push(currentHunk.trim());
      currentHunk = line;
    } else if (current) {
      if (line.startsWith("+") && !line.startsWith("+++")) current.additions++;
      if (line.startsWith("-") && !line.startsWith("---")) current.deletions++;
      if (currentHunk !== undefined) currentHunk += "\n" + line;
    }
  }
  if (current) {
    if (currentHunk) current.hunks.push(currentHunk.trim());
    patches.push(current);
  }
  return patches.sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeGitDiff(body: unknown): unknown {
  if (typeof body === "string") {
    return parseUnifiedDiff(body);
  }
  if (body !== null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    // Already structured?
    if (Array.isArray(obj["patches"])) {
      const patches = (obj["patches"] as FilePatch[])
        .map((p) => ({
          path: String(p.path ?? ""),
          additions: Number(p.additions ?? 0),
          deletions: Number(p.deletions ?? 0),
          hunks: (p.hunks ?? []).map(String).sort(),
        }))
        .sort((a, b) => a.path.localeCompare(b.path));
      return patches;
    }
    if (typeof obj["diff"] === "string") return parseUnifiedDiff(obj["diff"]);
    if (typeof obj["content"] === "string") return parseUnifiedDiff(obj["content"]);
  }
  return body;
}

// ---------------------------------------------------------------------------
// Shape: directoryTree
// Canonical form: sorted array of relative paths, forward-slash separators.
// ---------------------------------------------------------------------------

function normalizeDirectoryTree(body: unknown): unknown {
  let paths: string[] = [];

  if (typeof body === "string") {
    // Lines like "  src/index.ts" or "├── src/index.ts"
    paths = body
      .split("\n")
      .map((line) =>
        line
          .replace(/[│├└─\s]/g, " ")  // strip tree-drawing chars
          .replace(/\\/g, "/")
          .trim()
      )
      .filter((p) => p.length > 0 && !p.startsWith("."));
  } else if (Array.isArray(body)) {
    paths = body.map((p) => String(p).replace(/\\/g, "/").trim());
  } else if (body !== null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const raw = obj["paths"] ?? obj["entries"] ?? obj["tree"] ?? body;
    return normalizeDirectoryTree(raw);
  } else {
    return body;
  }
  return paths
    .filter((p) => p.length > 0)
    .map((p) => p.replace(/\\/g, "/"))
    .sort();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const normalizers: Record<string, (body: unknown) => unknown> = {
  fileEdit: normalizeFileEdit,
  validation_result: normalizeValidationResult,
  gitDiff: normalizeGitDiff,
  directoryTree: normalizeDirectoryTree,
};

export function normalizeOutput(shape: string, body: unknown): unknown {
  const fn = normalizers[shape];
  if (fn) return fn(body);
  // Fallback: canonical JSON (deep-sorted keys)
  return sortKeys(body);
}

export function outputsAgree(shape: string, a: unknown, b: unknown): boolean {
  return canonical(normalizeOutput(shape, a)) === canonical(normalizeOutput(shape, b));
}

export function diffOutputs(
  shape: string,
  a: unknown,
  b: unknown
): Record<string, unknown> | null {
  const na = normalizeOutput(shape, a);
  const nb = normalizeOutput(shape, b);
  if (canonical(na) === canonical(nb)) return null;
  return { before: na, after: nb };
}
