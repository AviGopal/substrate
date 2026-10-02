#!/usr/bin/env bun
interface Rule {
    /** Table whose field carries the evidence. */
    table: string;
    /** The field read as an elapsed-time / accumulation input. */
    field: string;
    /** Function that must be applied before writing the field. */
    consumer: string;
    /**
     * Files known to contain aliasing writers when the rule was added. A
     * violation in a file NOT listed here fails the check.
     *
     * Baselining by FILE rather than by COUNT is deliberate. A count baseline is
     * brittle: running this against two checkouts of the same repo minutes apart
     * gave 8 and 9 because the line numbers and statement layout differed. A
     * file set is stable under refactoring within a file, and still catches the
     * thing worth catching — aliasing appearing somewhere new.
     */
    baselineFiles: string[];
}
export interface Violation {
    file: string;
    line: number;
}
export declare function scan(root: string, rule: Rule): Violation[];
export {};
//# sourceMappingURL=check.d.ts.map