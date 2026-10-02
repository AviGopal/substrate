#!/usr/bin/env bun
/**
 * Interaction conformance check.
 *
 * Validates a surface against the canonical interaction contract
 * (openspec/changes/human-surface-stack/design.md §3.2).
 *
 * Usage:
 *   bun packages/interaction-conformance/check.ts <surface-root>
 *   bun packages/interaction-conformance/check.ts            # uses cwd
 *   bun packages/interaction-conformance/check.ts --list
 *   bun packages/interaction-conformance/check.ts --emit-concepts
 *
 * Exit 0: no violations.
 * Exit 1: violations found, or the surface could not be checked.
 *
 * Exemption:
 *   // @interaction:exempt P4 — <reason of at least 12 non-whitespace chars>
 *   <the flagged line>
 *
 * A bare exemption, or one naming an unknown rule id, is itself a violation (P0).
 *
 * P12 scans BUILD OUTPUT. If `<root>/dist` is absent this exits 1 with an error.
 * A silent skip there would be a green gate that never looked — pass
 * `--no-dist` only when you have consciously decided to check source rules alone.
 */
export {};
//# sourceMappingURL=check.d.ts.map