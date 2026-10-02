"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotTree = snapshotTree;
exports.compareTrees = compareTrees;
exports.unifiedDiff = unifiedDiff;
const promises_1 = require("node:fs/promises");
const node_child_process_1 = require("node:child_process");
const node_path_1 = require("node:path");
const IGNORE_DIRS = new Set([".git", "node_modules", ".venv", "__pycache__", "dist", "build"]);
async function snapshotTree(root) {
    const entries = new Map();
    await walk(root, root, entries);
    return entries;
}
async function walk(root, dir, out) {
    let dirents;
    try {
        dirents = await (0, promises_1.readdir)(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const e of dirents) {
        const full = (0, node_path_1.join)(dir, e.name);
        if (e.isDirectory()) {
            if (IGNORE_DIRS.has(e.name))
                continue;
            await walk(root, full, out);
        }
        else if (e.isFile()) {
            const rel = (0, node_path_1.relative)(root, full);
            try {
                const buf = await (0, promises_1.readFile)(full);
                const st = await (0, promises_1.stat)(full);
                const sha = await sha256(buf);
                out.set(rel, { path: rel, size: st.size, sha256: sha });
            }
            catch {
                // skip unreadable files
            }
        }
    }
}
async function sha256(buf) {
    // Bun has the standard `crypto.subtle`; use it for portability.
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
function compareTrees(before, after) {
    const created = [];
    const deleted = [];
    const modified = [];
    const unchanged = [];
    for (const [path, a] of after) {
        const b = before.get(path);
        if (!b)
            created.push(path);
        else if (b.sha256 !== a.sha256)
            modified.push(path);
        else
            unchanged.push(path);
    }
    for (const path of before.keys()) {
        if (!after.has(path))
            deleted.push(path);
    }
    return {
        created: created.sort(),
        deleted: deleted.sort(),
        modified: modified.sort(),
        unchanged: unchanged.sort(),
    };
}
/** Produce a unified diff between two file paths (or empty if files are binary). */
function unifiedDiff(beforePath, afterPath, label) {
    const r = (0, node_child_process_1.spawnSync)("diff", ["-u", "-N", `--label=a/${label}`, `--label=b/${label}`, beforePath, afterPath], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    });
    // diff exits 0 on identical, 1 on different, 2 on error. 1 is our happy path.
    if (r.status === 2)
        return `(diff failed: ${r.stderr.trim()})`;
    return r.stdout;
}
//# sourceMappingURL=workspace-diff.js.map