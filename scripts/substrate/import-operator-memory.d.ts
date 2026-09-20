/**
 * import-operator-memory.ts — one-time seed of operator-side memory files
 * into the substrate's memoryNote store.
 *
 * Reads ~/.claude/projects/<project-slug>/memory/*.md, where <project-slug> is
 * the absolute repo path with every "/" replaced by "-" (the Claude Code
 * convention). The slug is derived at runtime from CLAUDE_PROJECT_DIR (if set)
 * or `git rev-parse --show-toplevel`, so it works regardless of clone location.
 * The script parses the YAML frontmatter, and writes each note to the development-vessel
 * memoryNote_write resolver (or directly to the workspace file if the vessel
 * is not yet running).
 *
 * Idempotent: notes are upserted by id. Re-running after the substrate starts
 * is safe — existing notes are updated only if body changed.
 *
 * Run:
 *   bun /path/to/import-operator-memory.ts
 *   # or via make target after substrate is seeded:
 *   bun run scripts/substrate/import-operator-memory.ts
 *
 * The script writes directly to WORKSPACE/memory/notes.json if
 * DEV_VESSEL_ENDPOINT is not set (offline import path).
 * When DEV_VESSEL_ENDPOINT is set, it uses the memoryNote_write HTTP resolver.
 */
export {};
//# sourceMappingURL=import-operator-memory.d.ts.map