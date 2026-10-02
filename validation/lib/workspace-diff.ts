/**
 * Workspace diffing.
 *
 * Two surfaces:
 *   - tree diff: which files exist in `before` vs `after` (created / deleted /
 *     modified / unchanged).
 *   - content diff: unified diff per modified file.
 *
 * We deliberately use plain shell `diff` for unified output rather than a JS
 * library — it's portable, well-understood, and produces standard patch
 * format. We only fall back to "binary differs" for non-text files.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { relative, join } from "node:path";

export interface FileEntry {
  path: string;       // path relative to workspace root
  size: number;
  sha256: string;
}

export interface TreeDiff {
  created: string[];
  deleted: string[];
  modified: string[];
  unchanged: string[];
}

const IGNORE_DIRS = new Set([".git", "node_modules", ".venv", "__pycache__", "dist", "build"]);

export async function snapshotTree(root: string): Promise<Map<string, FileEntry>> {
  const entries = new Map<string, FileEntry>();
  await walk(root, root, entries);
  return entries;
}

async function walk(root: string, dir: string, out: Map<string, FileEntry>): Promise<void> {
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of dirents) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      await walk(root, full, out);
    } else if (e.isFile()) {
      const rel = relative(root, full);
      try {
        const buf = await readFile(full);
        const st = await stat(full);
        const sha = await sha256(buf);
        out.set(rel, { path: rel, size: st.size, sha256: sha });
      } catch {
        // skip unreadable files
      }
    }
  }
}

async function sha256(buf: Buffer): Promise<string> {
  // Bun has the standard `crypto.subtle`; use it for portability.
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function compareTrees(
  before: Map<string, FileEntry>,
  after: Map<string, FileEntry>,
): TreeDiff {
  const created: string[] = [];
  const deleted: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const [path, a] of after) {
    const b = before.get(path);
    if (!b) created.push(path);
    else if (b.sha256 !== a.sha256) modified.push(path);
    else unchanged.push(path);
  }
  for (const path of before.keys()) {
    if (!after.has(path)) deleted.push(path);
  }
  return {
    created: created.sort(),
    deleted: deleted.sort(),
    modified: modified.sort(),
    unchanged: unchanged.sort(),
  };
}

/** Produce a unified diff between two file paths (or empty if files are binary). */
export function unifiedDiff(beforePath: string, afterPath: string, label: string): string {
  const r = spawnSync("diff", ["-u", "-N", `--label=a/${label}`, `--label=b/${label}`, beforePath, afterPath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  // diff exits 0 on identical, 1 on different, 2 on error. 1 is our happy path.
  if (r.status === 2) return `(diff failed: ${r.stderr.trim()})`;
  return r.stdout;
}
