#!/usr/bin/env bun
/**
 * thompson-compare.ts — snapshot Thompson α/β posteriors for activity templates.
 *
 * Usage:
 *   bun run validation/scripts/thompson-compare.ts [--query <text>] [--limit <n>] [--label <text>]
 *
 * Reads METABOB_ENDPOINT and METABOB_API_KEY from environment (or ~/.metabob/config.json).
 * Queries /v2/activities/recommend with the given task description and prints a table
 * showing the top-N templates, their α/β posteriors, mean selection probability, and
 * execution counts. Run before and after each learning campaign step to track convergence.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

interface SelectionMetadata {
  method?: string;
  score_source?: string;
  alpha?: number;
  beta?: number;
  sample?: number;
  score?: number;
  exploration_slot?: boolean;
}

interface Recommendation {
  template_id?: string;
  template_name?: string;
  category?: string;
  tags?: string[];
  input_shapes?: string[];
  output_shapes?: string[];
  selection_metadata?: SelectionMetadata;
}

interface RecommendResponse {
  recommendations?: Recommendation[];
}

async function loadConfig(): Promise<{ endpoint: string; apiKey: string }> {
  const envEndpoint = process.env.METABOB_ENDPOINT;
  const envKey = process.env.METABOB_API_KEY;

  const configPath = join(homedir(), ".metabob", "config.json");
  if (existsSync(configPath)) {
    const raw = JSON.parse(await readFile(configPath, "utf8")) as {
      metabob?: { endpoint?: string; apiKey?: string };
    };
    const endpoint = envEndpoint ?? raw.metabob?.endpoint ?? "https://activity.metabob.com";
    const apiKey = envKey ?? raw.metabob?.apiKey ?? "";
    if (apiKey) return { endpoint, apiKey };
  }
  if (envEndpoint && envKey) return { endpoint: envEndpoint, apiKey: envKey };
  throw new Error("METABOB_API_KEY not set. Set via env var or ~/.metabob/config.json");
}

function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

function betaStdDev(alpha: number, beta: number): number {
  const denom = (alpha + beta) ** 2 * (alpha + beta + 1);
  return Math.sqrt((alpha * beta) / denom);
}

function bar(value: number, width = 20): string {
  const filled = Math.round(value * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

async function main() {
  const { values } = parseArgs({
    options: {
      query: { type: "string", short: "q", default: "fix bug in TypeScript utility function" },
      limit: { type: "string", short: "n", default: "10" },
      label: { type: "string", default: "" },
    },
    allowPositionals: false,
  });

  const { endpoint, apiKey } = await loadConfig();
  const limit = parseInt(values.limit ?? "10", 10);
  const label = values.label ?? "";
  const query = values.query ?? "fix bug in TypeScript utility function";

  const url = `${endpoint}/v2/activities/recommend`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ task_description: query, limit }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`POST /v2/activities/recommend: ${resp.status} ${resp.statusText}\n${body}`);
  }

  const data = (await resp.json()) as RecommendResponse;
  const templates = data.recommendations ?? [];

  const timestamp = new Date().toISOString();
  console.log(`\n${"=".repeat(88)}`);
  console.log(`Thompson posterior snapshot${label ? ` — ${label}` : ""}`);
  console.log(`Query: "${query}"`);
  console.log(`Time:  ${timestamp}`);
  console.log(`${"=".repeat(88)}\n`);

  if (templates.length === 0) {
    console.log("No templates returned.");
    return;
  }

  const COL_NAME = 40;
  const header = [
    "template".padEnd(COL_NAME),
    "α".padStart(7),
    "β".padStart(7),
    "μ".padStart(7),
    "σ".padStart(7),
    "score".padStart(8),
    "  selection bar",
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length + 24));

  for (const t of templates) {
    const sm = t.selection_metadata ?? {};
    const alpha = sm.alpha ?? 1;
    const beta = sm.beta ?? 1;
    const mean = betaMean(alpha, beta);
    const sd = betaStdDev(alpha, beta);
    const score = sm.score ?? sm.sample ?? mean;

    const rawName = t.template_name ?? t.template_id ?? "(unknown)";
    const name = rawName.slice(0, COL_NAME - 1).padEnd(COL_NAME);
    const explore = sm.exploration_slot ? " [E]" : "    ";
    const row = [
      name,
      alpha.toFixed(2).padStart(7),
      beta.toFixed(2).padStart(7),
      mean.toFixed(3).padStart(7),
      sd.toFixed(3).padStart(7),
      score.toFixed(4).padStart(8),
      `  ${bar(Math.min(score, 1))}  ${(mean * 100).toFixed(1)}%${explore}`,
    ].join("  ");
    console.log(row);
  }

  console.log();

  // Top template summary
  const top = templates[0];
  if (top) {
    const sm = top.selection_metadata ?? {};
    const alpha = sm.alpha ?? 1;
    const beta = sm.beta ?? 1;
    console.log(`Top: "${top.template_name ?? top.template_id}"`);
    console.log(`     α=${alpha.toFixed(2)}  β=${beta.toFixed(2)}  μ=${betaMean(alpha, beta).toFixed(4)}  score=${(sm.score ?? sm.sample ?? 0).toFixed(4)}`);
    console.log(`     source=${sm.score_source ?? "?"}  method=${sm.method ?? "?"}`);
  }
  console.log();
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
