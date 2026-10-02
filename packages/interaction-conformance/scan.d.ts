/**
 * scan.ts — file walk, comment stripping, and brace-depth region scanning.
 *
 * Every rule matcher operates on a `ScannedFile`, which carries BOTH:
 *   - `raw`  : the untouched source. Exemption annotations are parsed from this,
 *              because an annotation IS a comment — strip first and it vanishes.
 *   - `code` : the same source with every comment replaced by spaces, preserving
 *              byte offsets and line numbers. Rule matchers use this, so a hex
 *              literal inside a comment cannot trip P11.
 *
 * The region scanner is the same technique `shape-dispatch-check` uses to find
 * the end of a `shapes: [ ... ]` array — bracket depth counting — generalised to
 * `(`/`[`/`{` and made string-aware so brackets inside literals do not confuse it.
 */
export interface ScannedFile {
    /** Absolute path. */
    path: string;
    /** Path relative to the scan root. */
    rel: string;
    /** File extension including the dot, e.g. `.tsx`. */
    ext: string;
    /** Untouched source. */
    raw: string;
    /** Source with comments blanked out, offsets preserved. */
    code: string;
    /** `raw` split on newlines. Index 0 is line 1. */
    rawLines: string[];
}
/** Directories never descended into during an ordinary source scan. */
export declare const DEFAULT_EXCLUDED_DIRS: Set<string>;
export declare function walkFiles(root: string, exts: string[], opts?: {
    exclude?: Set<string>;
}): string[];
export declare function loadFiles(root: string, paths: string[]): ScannedFile[];
export type CommentMode = 'js' | 'css' | 'html';
export declare function commentModeFor(ext: string): CommentMode;
/**
 * Replace comment bodies with spaces, keeping every newline and every byte
 * offset intact so that `lineOf(code, idx)` agrees with the raw source.
 *
 * String and template literals are preserved verbatim — colour literals and URLs
 * live inside them, and blanking them would make P11/P12 vacuous.
 */
export declare function stripComments(src: string, mode?: CommentMode): string;
/**
 * Given the index of an opening bracket in comment-stripped code, return the
 * index of its match, or -1. String-aware: brackets inside literals are ignored.
 */
export declare function findMatching(code: string, openIdx: number): number;
export interface Region {
    /** Index where the triggering match began. */
    matchIndex: number;
    /** The full triggering match text. */
    matchText: string;
    /** Capture groups from the triggering regex. */
    groups: string[];
    /** Index of the opening bracket. */
    open: number;
    /** Index of the closing bracket. */
    close: number;
    /** Text between the brackets, exclusive. */
    body: string;
    /** 1-based line of `matchIndex`. */
    line: number;
}
/**
 * Find every region introduced by `re`, whose match MUST end on an opening
 * bracket (e.g. `/\.map\(/` or `/switch\s*\(/`).
 *
 * Regions are returned in source order and may nest; callers that care about
 * innermost-wins should compare `open`/`close` spans themselves.
 */
export declare function findRegions(code: string, re: RegExp): Region[];
/** 1-based line number of a character offset. */
export declare function lineOf(text: string, idx: number): number;
/**
 * Identifiers that are actual CODE inside a JSX expression: string literal
 * bodies are dropped, and only `${...}` interiors of template literals are kept.
 *
 * This is what lets P4 distinguish `key={`row-${idx}`}` (identifiers: {idx} →
 * index key) from `key={`${item.id}-${idx}`}` (identifiers: {item, id, idx} →
 * composite, not an index key).
 */
export declare function codeIdentifiers(expr: string): Set<string>;
/**
 * Extract top-level `{ ... }` expression containers from a JSX children blob.
 */
export declare function jsxExpressions(body: string): {
    text: string;
    index: number;
}[];
//# sourceMappingURL=scan.d.ts.map