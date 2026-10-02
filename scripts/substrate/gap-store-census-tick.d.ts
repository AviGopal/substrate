/**
 * gap-store-census-tick.ts — a detector for the SILENT-STORE-COLLAPSE class.
 *
 * Measured 2026-09-09: the gap store served 4,113 gaps at 14:35 and 44 at 22:59,
 * across a development-vessel restart. Nothing reported it. It was recovered only
 * because an operator happened to look, and because ~50 orphaned atomic-write
 * temps (~300MB, themselves a disk leak) still held parseable snapshots. Law 7
 * measures progress as the gap triple — close rate, latency, durability — and for
 * several hours that triple was being computed over a store that had silently
 * lost 97% of its rows.
 *
 * WHY A COUNT AND NOT A WRITE GUARD. The write path is already correct atomic
 * practice: a per-writer unique tmp, an in-process read-modify-write lock, then
 * rename. What that cannot defend against is writing the WRONG CONTENT
 * atomically — a partial load followed by a save replaces a good file with a
 * small one, durably and without error. Refusing such a write is the real repair,
 * but a guard that can reject gap writes is the same shape as the inverted
 * boolean that once discarded every gap write, and the deadlock it creates is
 * unfixable from inside: you cannot file a gap about not being able to file gaps.
 * So this observes and reports; changing write semantics is an operator decision.
 *
 * IT ASKS THE STORE, NOT THE FILESYSTEM. WORKSPACE_ROOT differs between this
 * script's environment and the vessel process's, and there are at least four
 * stale gaps.json copies on the box — one with a fresh mtime over July records.
 * Reading "the" file is how a false two-day-persistence-failure nearly got
 * published. The count therefore comes from the resolver that serves gaps, which
 * is by definition the copy the substrate actually uses.
 *
 * THE BASELINE IS A HIGH-WATER MARK, NOT AN AVERAGE. Closing a gap does not
 * remove its row — closed gaps persist with status "closed" — so this series
 * should be monotonic apart from deliberate pruning. Any prior census is
 * therefore positive evidence that the store DID hold that many, and a drop below
 * it is not variance. Averaging would let a collapse lower the very bar it is
 * later judged against, the same contamination compose-drift-tick avoids by using
 * a median rather than pooled counts.
 *
 * META-GUARD (a detector must be proven to COMPLETE, not merely to exist): with
 * no usable census history it says so and abstains rather than reporting health,
 * and it records every reading so the first real collapse has something to be
 * measured against.
 *
 * Strictly read-only except its own census file and substrateGap emission.
 */
export {};
//# sourceMappingURL=gap-store-census-tick.d.ts.map