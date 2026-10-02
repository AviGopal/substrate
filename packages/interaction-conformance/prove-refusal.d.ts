#!/usr/bin/env bun
/**
 * prove-refusal.ts — THE GATE MUST BE PROVEN TO REFUSE.
 *
 * A gate whose refusal has never been observed cannot be trusted when it passes.
 * So for every rule this suite asserts BOTH directions:
 *
 *   violating fixture → exit 1 AND the EXACT set of rule ids in the output
 *                       matches what the fixture is for.
 *   clean fixture     → exit 0.
 *
 * The exact-set assertion is the load-bearing part. Asserting only `exit 1`
 * would let a fixture that trips a DIFFERENT rule count as proof of this one —
 * a green suite proving nothing, which is the same defect as a gate with no call
 * sites. Asserting only that the id is present would let a clean-fixture
 * regression hide behind an unrelated extra finding.
 *
 * Each case is assembled into a scratch root under the system temp directory:
 *
 *   <tmp>/src/<fixture>.tsx
 *   <tmp>/dist/bundle.js        ← stub (allowlisted content) unless the case
 *                                 supplies its own build output
 *
 * The stub exists because P12 hard-errors on a missing dist/. Without it every
 * non-P12 case would exit 1 for the wrong reason.
 *
 * Run: bun run prove-refusal
 */
export {};
//# sourceMappingURL=prove-refusal.d.ts.map