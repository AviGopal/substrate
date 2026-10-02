/**
 * cite-check.ts — verify code citations in investigation markdown files
 *
 * Usage:
 *   bun run validation/scripts/cite-check.ts [investigation-file-or-glob]
 *   bun run validation/scripts/cite-check.ts validation/investigations/*.md
 *
 * Extracts path:line and path:line-line citations, checks:
 *   1. File exists at the cited path
 *   2. Line range is within file bounds
 *   3. If a code snippet is quoted nearby, it textually overlaps the actual line(s)
 *
 * Exit 0 = all cites verified. Exit 1 = one or more fails.
 *
 * Background (inv-072): 10 retractions across 50 iterations, all traceable
 * to citations filed WITHOUT inline grep evidence. This script catches the
 * syntactic class (~30%): line-rot, missing files, wrong line numbers.
 * The semantic class (layer-confusion) still requires subagent verification.
 */
export {};
//# sourceMappingURL=cite-check.d.ts.map