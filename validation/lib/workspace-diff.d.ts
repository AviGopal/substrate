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
export interface FileEntry {
    path: string;
    size: number;
    sha256: string;
}
export interface TreeDiff {
    created: string[];
    deleted: string[];
    modified: string[];
    unchanged: string[];
}
export declare function snapshotTree(root: string): Promise<Map<string, FileEntry>>;
export declare function compareTrees(before: Map<string, FileEntry>, after: Map<string, FileEntry>): TreeDiff;
/** Produce a unified diff between two file paths (or empty if files are binary). */
export declare function unifiedDiff(beforePath: string, afterPath: string, label: string): string;
//# sourceMappingURL=workspace-diff.d.ts.map