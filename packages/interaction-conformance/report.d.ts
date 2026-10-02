/**
 * report.ts — grouped stderr output.
 *
 * Deliberately identical in shape to `shape-dispatch-check`: a group header per
 * rule with a count and the rule statement, then per finding
 *
 *     [kind] name
 *       at file:line
 *       → hint
 *
 * and a trailing note naming the exemption escape hatch. A second checker with
 * different ergonomics gets adopted by nobody.
 */
import { type RawFinding } from './rules.ts';
export declare function report(findings: RawFinding[], root: string): void;
export declare function printRuleTable(): void;
//# sourceMappingURL=report.d.ts.map