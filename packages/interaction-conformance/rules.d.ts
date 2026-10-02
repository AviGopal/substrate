/**
 * rules.ts — THE RULE TABLE. Single source of truth.
 *
 * `check.ts` (the gate) and `emit-concepts.ts` (the drafter's lesson channel)
 * both generate from this table, so a rule cannot be enforced without also being
 * taught, or taught without being enforced — design.md §3.4.
 *
 * TIERS, and the honest reason for the split
 * ------------------------------------------
 * The vacuity test for any check is: *if I write the violating code the rule is
 * actually about, does the check still pass?* If yes, the check is decoration.
 *
 *   static-easy — the check decides the rule. Writing the violation trips it.
 *   static-hard — the check decides a PROVABLE HALF of the rule. The residue is
 *                 semantic or runtime and belongs to the probe. Each such rule
 *                 carries `notCovered`, which the README renders verbatim.
 *
 * No rule in this table is scored as more than it is.
 */
import { type ScannedFile } from './scan.ts';
export type Tier = 'static-easy' | 'static-hard';
export interface RawFinding {
    ruleId: string;
    /** Short machine-ish classification, printed as `[kind]`. */
    kind: string;
    /** The offending symbol/expression, printed after the kind. */
    name: string;
    file: string;
    line: number;
    /** Overrides `rule.hint` when the fix is finding-specific. */
    hint?: string;
}
export interface RuleContext {
    root: string;
    /** `.ts` / `.tsx` / `.css` under the surface root, excluding build output. */
    sources: ScannedFile[];
    /** `.js` / `.css` / `.html` under `<root>/dist`. */
    distFiles: ScannedFile[];
}
export interface Rule {
    id: string;
    slug: string;
    /** The contract sentence, as a refusable condition. */
    statement: string;
    tier: Tier;
    /** What the static check actually decides. */
    checks: string;
    /** For static-hard rules: the residue this check does NOT decide. */
    notCovered?: string;
    /** Default hint. Must name BOTH fix paths: the repair and the exemption. */
    hint: string;
    matcher: (ctx: RuleContext) => RawFinding[];
}
export declare const RULES: Rule[];
export declare const RULES_BY_ID: Map<string, Rule>;
/** `P0` is not a contract rule — it is the meta-rule that the exemption channel itself is honest. */
export declare const P0: {
    id: string;
    slug: string;
    statement: string;
    tier: Tier;
    checks: string;
    hint: string;
};
//# sourceMappingURL=rules.d.ts.map