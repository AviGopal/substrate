#!/usr/bin/env bun
/**
 * closure-audit.ts — IAL §27.3.j.7 closure-audit script.
 *
 * Tests each substrate closure property by probing the live substrate,
 * optionally simulating the absence of a specific external tool.
 *
 * Usage:
 *   bun run validation/scripts/closure-audit.ts
 *   bun run validation/scripts/closure-audit.ts --without=operator-memory
 *   bun run validation/scripts/closure-audit.ts --without=operator-memory --without=slash-skills
 *
 * --without options:
 *   operator-memory       test if substrate memory works without ~/.claude/.../memory/ files
 *   slash-skills          test if skill-equivalent ops work via substrate resolvers alone
 *   subagents             test if complex tasks can execute without Claude Code subagents
 *   github-actions        test if CI/merge gating works via substrate alone
 *   operator-shell        test if substrate can self-heal without operator shell access
 *   operator-spec-authoring  test if substrate can author specs without operator
 *   push-away             test if substrate refuses incompetent interventions with cited evidence (IAL §27.S.6)
 *
 * Writes: validation/state/closure-status.json
 * Exit codes: 0 = all tested properties closed, 1 = one or more gaps remain
 */
export {};
//# sourceMappingURL=closure-audit.d.ts.map