/**
 * substrate-narrator.ts
 *
 * Operator-side monitoring tooling for the substrate-narration validation
 * methodology (`docs/SUBSTRATE_NARRATION_PROTOCOL.md`).
 *
 * Captures the substrate's externally-observable knowledge surface so an
 * operator agent (or operator-Claude) can attempt to describe what the
 * substrate is doing using ONLY substrate-accessible knowledge. Gaps —
 * moments where explanation requires operator-side knowledge — are logged
 * downstream in `validation/gaps/`.
 *
 * What this script does:
 *   1. Subscribes to the activity-api WebSocket (`/ws`) and appends every
 *      `task.started | task.completed | task.failed | tool.call |
 *      impulse.resolved` event to a daily JSONL log.
 *   2. Every N minutes (default 5) snapshots the substrate's knowledge
 *      surface: template inventory (activity-api), vessel registry
 *      (discovery-vessel), concept inventory (concept-db).
 *   3. Pulls a recent-trace window alongside each snapshot.
 *   4. Reads its connection config from `~/.metabob/config.json` per the
 *      project's single-source-of-truth convention.
 *
 * Patterned after concept-db's ExecutionObserver
 * (`repos/concept-db/src/services/execution-observer.ts`):
 *   - WebSocket auth via `{type: "authenticate", token}` first frame.
 *   - Catchup via `{type: "catchup", lastSeenSequence}` on reconnect.
 *   - Exponential backoff 1s → 30s. Handlers never throw out.
 *
 * Operator-driven, NOT a substrate-resident vessel. A future substrate-
 * resident version is on the §27.S.5 roadmap (substrate-state-snapshot
 * publication); for now this is operator-side tooling.
 *
 * Usage:
 *   bun run validation/scripts/substrate-narrator.ts
 *   bun run validation/scripts/substrate-narrator.ts --snapshot-interval-ms=300000
 *
 * SIGINT/SIGTERM gracefully closes the WebSocket and exits.
 */
export {};
//# sourceMappingURL=substrate-narrator.d.ts.map