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

import { readFile, writeFile } from "node:fs/promises";

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
  // Phase 13.1.2: minibob writes JSONL to MINIBOB_TRANSCRIPT_FILE inside the
  // container; docker-runner.ts copies the file out to <outDir>/transcript.jsonl
  // before this function runs. Each line is one of:
  //   {"ts": "...", "kind": "llm_request",  "data": { model, messages, tools, max_tokens }}
  //   {"ts": "...", "kind": "llm_response", "data": { content, stop_reason, usage }}
  //   {"ts": "...", "kind": "tool_call",    "data": { name, input }}
  //   {"ts": "...", "kind": "tool_result",  "data": { name, output, is_error }}

  const warnings: string[] = [];
  const raw = await readFile(transcriptPath, "utf8").catch(() => "");
  if (!raw.trim()) {
    warnings.push(
      "minibob transcript empty or missing — check that MINIBOB_TRANSCRIPT_FILE was honoured " +
      "and the bind mount survived (look in <outDir>/.transcript-mount/). Falling back to zero counts.",
    );
    return {
      agent: "minibob",
      llmCallCount: 0,
      toolCallCount: 0,
      totalInputTokens: null,
      totalOutputTokens: null,
      totalCostUsd: null,
      finalAssistantMessage: null,
      warnings,
    };
  }

  let llmCalls = 0;
  let toolCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let finalMsg: string | null = null;
  let sawTokens = false;

  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let evt: any;
    try { evt = JSON.parse(t); } catch { continue; }
    if (evt.kind === "llm_request") {
      llmCalls++;
    } else if (evt.kind === "llm_response") {
      const content = evt.data?.content;
      if (typeof content === "string") {
        finalMsg = content;
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text" && typeof block.text === "string") {
            finalMsg = block.text;
          }
        }
      }
      const usage = evt.data?.usage;
      if (usage) {
        sawTokens = true;
        inputTokens += usage.input_tokens ?? usage.inputTokens ?? 0;
        outputTokens += usage.output_tokens ?? usage.outputTokens ?? 0;
      }
    } else if (evt.kind === "tool_call") {
      toolCalls++;
    }
  }

  return {
    agent: "minibob",
    llmCallCount: llmCalls,
    toolCallCount: toolCalls,
    totalInputTokens: sawTokens ? inputTokens : null,
    totalOutputTokens: sawTokens ? outputTokens : null,
    totalCostUsd: null,
    finalAssistantMessage: finalMsg,
    warnings,
  };
}
