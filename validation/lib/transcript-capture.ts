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

import { readFile, writeFile, appendFile } from "node:fs/promises";

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

export async function extractClaudeCodeTranscript(
  stdoutPath: string,
  transcriptPath: string,
): Promise<TranscriptSummary> {
  const raw = await readFile(stdoutPath, "utf8").catch(() => "");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  let llmCalls = 0;
  let toolCalls = 0;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let costUsd: number | null = null;
  let finalMsg: string | null = null;
  const warnings: string[] = [];
  const jsonlLines: string[] = [];

  for (const line of lines) {
    let evt: any;
    try { evt = JSON.parse(line); } catch { continue; }
    jsonlLines.push(line);

    if (evt.type === "assistant") {
      llmCalls++;
      const blocks = evt.message?.content ?? [];
      for (const b of blocks) {
        if (b?.type === "tool_use") toolCalls++;
        if (b?.type === "text" && typeof b.text === "string") finalMsg = b.text;
      }
    } else if (evt.type === "result") {
      // The final result event carries usage totals.
      inputTokens = evt.usage?.input_tokens ?? null;
      outputTokens = evt.usage?.output_tokens ?? null;
      costUsd = evt.total_cost_usd ?? evt.cost_usd ?? null;
    }
  }

  if (jsonlLines.length === 0) {
    warnings.push("No JSONL events extracted — Claude Code may not have emitted stream-json. Inspect stdout.log directly.");
  }

  await writeFile(transcriptPath, jsonlLines.join("\n") + (jsonlLines.length ? "\n" : ""));

  return {
    agent: "claude-code",
    llmCallCount: llmCalls,
    toolCallCount: toolCalls,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    totalCostUsd: costUsd,
    finalAssistantMessage: finalMsg,
    warnings,
  };
}

export async function extractMinibobTranscript(
  stdoutPath: string,
  transcriptPath: string,
): Promise<TranscriptSummary> {
  // TODO: minibob's --single mode currently does not stream LLM transcript to
  // stdout in a structured form. Two completion paths to wire up later:
  //  (a) Have minibob print the activity-api executionId on completion, then
  //      curl /v2/activities/execution-traces/<id> here.
  //  (b) Mount /tmp/minibob-trace and have minibob write JSONL into it.
  // Until then, stub the summary from raw stdout heuristics.

  const raw = await readFile(stdoutPath, "utf8").catch(() => "");
  const warnings: string[] = [
    "minibob transcript extraction is stubbed — reading heuristics from stdout. " +
    "TODO: surface structured trace from activity-api or a mounted trace file.",
  ];

  // Heuristic: count occurrences of `[LLM]` or `tool_call` markers in stdout.
  // These match the current minibob log format; brittle by design — replace
  // with structured extraction.
  const llmCalls = (raw.match(/\b(LLMResolver|callLLM|provider:anthropic)\b/g) ?? []).length;
  const toolCalls = (raw.match(/\btool[_-]?call\b/gi) ?? []).length;

  await writeFile(transcriptPath, "");
  await appendFile(transcriptPath, JSON.stringify({
    note: "stub — see warnings",
    stdoutPath,
  }) + "\n");

  return {
    agent: "minibob",
    llmCallCount: llmCalls,
    toolCallCount: toolCalls,
    totalInputTokens: null,
    totalOutputTokens: null,
    totalCostUsd: null,
    finalAssistantMessage: null,
    warnings,
  };
}
