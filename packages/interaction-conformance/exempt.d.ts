/**
 * exempt.ts — the `@interaction:exempt` annotation channel.
 *
 * Syntax (line-level):
 *   // @interaction:exempt P4 — this list is fixed at build time and never reorders
 *   <the line the rule flags>
 *
 * Syntax (file-level, within the first 5 lines):
 *   // @interaction:exempt-file P11 — this file IS the token package emitter
 *
 * Separators `—`, `--`, and `-` are all accepted.
 *
 * Two things make this channel honest rather than a hole:
 *   1. A BARE exemption (no reason, or a reason under 12 non-whitespace chars)
 *      is itself a violation, reported as P0/`bare_exemption`.
 *   2. An exemption naming an unknown rule id is reported as P0/`unknown_rule`,
 *      so a typo fails loudly instead of silently exempting nothing.
 *
 * An INVALID exemption never suppresses. That is the point: if it suppressed,
 * the cheapest way past the gate would be to misspell a rule id.
 */
import type { RawFinding } from './rules.ts';
import type { ScannedFile } from './scan.ts';
export declare const MIN_REASON_CHARS = 12;
export interface ParsedAnnotation {
    ruleId: string | null;
    reason: string;
    line: number;
    scope: 'line' | 'file';
}
export interface ExemptionIndex {
    /** `${file}:${line}` → set of rule ids validly exempted for that line. */
    lineExempt: Map<string, Set<string>>;
    /** file path → set of rule ids validly exempted for the whole file. */
    fileExempt: Map<string, Set<string>>;
    /** P0 findings raised by malformed annotations. */
    findings: RawFinding[];
}
/**
 * Walk backwards from a flagged line to the nearest preceding non-blank line,
 * matching `shape-dispatch-check`'s `@shape-dispatch:private` walk exactly.
 * Returns the 1-based line number of the annotation, or null.
 */
export declare function precedingAnnotationLine(rawLines: string[], flaggedLine: number): number | null;
export declare function buildExemptionIndex(files: ScannedFile[], knownRuleIds: Set<string>): ExemptionIndex;
export declare function isExempt(index: ExemptionIndex, finding: RawFinding, rawLinesByFile: Map<string, string[]>): boolean;
//# sourceMappingURL=exempt.d.ts.map