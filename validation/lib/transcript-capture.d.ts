/**
 * Best-effort extraction of LLM-call transcripts from each agent's stdout.
 *
 * Claude Code (`claude -p ... --output-format stream-json --verbose`) emits
 * one JSON object per line on stdout. Each line has a `type` field:
 *   - "system"      — init / config events
 *   - "assistant"   — model output (message content + tool_use blocks)
 *   - "user"        — tool_result blocks
 *   - "result"      — final summary with usage / cost
 * We pass through every line verbatim into transcript.jsonl, then summarise.
 *
 * minibob does not currently emit a single canonical JSONL transcript on
 * stdout in --single mode (it broadcasts WS events that activity-api stores
 * remotely, and writes human-readable lines to stdout). For now we leave a
 * TODO: pull the trace from activity-api by execution id once minibob prints
 * it on completion. Until then, transcript.jsonl stays empty for minibob and
 * stdout.log is the source of truth.
 */
export interface TranscriptSummary {
    agent: "claude-code" | "minibob";
    llmCallCount: number;
    toolCallCount: number;
    totalInputTokens: number | null;
    totalOutputTokens: number | null;
    totalCostUsd: number | null;
    finalAssistantMessage: string | null;
    warnings: string[];
}
export declare function extractClaudeCodeTranscript(stdoutPath: string, transcriptPath: string): Promise<TranscriptSummary>;
export declare function extractMinibobTranscript(stdoutPath: string, transcriptPath: string): Promise<TranscriptSummary>;
//# sourceMappingURL=transcript-capture.d.ts.map