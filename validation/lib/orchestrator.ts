#!/usr/bin/env bun
/**
 * Top-level orchestrator for the head-to-head agent benchmark.
 *
 *   bun run validation/lib/orchestrator.ts \
 *     --prompt validation/prompts/01-fix-failing-test.md \
 *     --workspace pristine-typescript-project \
 *     [--model claude-sonnet-4-6] \
 *     [--timeout 600] \
 *     [--only claude-code|minibob]    # skip the other agent (useful for debug)
 *
 * Behaviour:
 *   1. Resolve the prompt file and workspace seed.
 *   2. Make a fresh run dir under runs/<timestamp>-<prompt-name>/.
 *   3. For each agent: copy seed → workspace.before → workspace.after, run
 *      the agent with workspace.after bind-mounted, capture stdout/stderr,
 *      extract transcript.
 *   4. Diff workspace.before vs workspace.after for each agent, then
 *      cross-diff the two `.after` snapshots.
 *   5. Render report.md.
 *
 * No verdict scoring — that's the human's job.
 */

import { parseArgs } from "node:util";
import { mkdir, cp, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename, dirname, join, extname } from "node:path";
import { homedir } from "node:os";
import { runAgent, type AgentRunResult } from "./docker-runner";
import {
  snapshotTree,
  compareTrees,
  unifiedDiff,
  type TreeDiff,
  type FileEntry,
} from "./workspace-diff";
import {
  extractClaudeCodeTranscript,
  extractMinibobTranscript,
  type TranscriptSummary,
} from "./transcript-capture";

const HELP = `\
agent-benchmark — head-to-head harness for Claude Code vs minibob

Usage:
  bun run validation/lib/orchestrator.ts --prompt <file> --workspace <name> [options]

Required:
  --prompt <path>        Path to a prompt .md file (e.g. validation/prompts/01-fix-failing-test.md)
  --workspace <name>     Name of a workspace seed dir under validation/workspaces/

Options:
  --model <id>           Model id passed to both agents (default: claude-sonnet-4-6)
  --timeout <seconds>    Per-agent wall-clock timeout (default: per-agent in containers.json)
  --only <agent>         Run only one agent: "claude-code" or "minibob"
  --no-backend           Run minibob in standalone mode: disables discovery registration and
                         activity-api trace POSTs (DISCOVERY_ENABLED=false, METABOB_API_KEY unset,
                         MINIBOB_OFFLINE_MODE=true). This is the Phase 13 standalone-parity target.
  --skip-build           Don't (re)build the local Claude Code image even if missing
  --help, -h             Show this help

Outputs:
  validation/runs/<timestamp>-<prompt-stem>/
    prompt.md
    claude-code/{workspace.before,workspace.after,transcript.jsonl,stdout.log,stderr.log}
    minibob/{workspace.before,workspace.after,transcript.jsonl,stdout.log,stderr.log}
    report.md
`;

interface Containers {
  minibob: { image: string; default_timeout_seconds?: number };
  claudeCode: {
    image: string;
    buildContext: string;
    dockerfile: string;
    default_timeout_seconds?: number;
  };
  defaults: { model: string; timeoutSeconds: number };
}

async function main() {
  const { values } = parseArgs({
    options: {
      prompt: { type: "string" },
      workspace: { type: "string" },
      model: { type: "string" },
      timeout: { type: "string" },
      only: { type: "string" },
      "no-backend": { type: "boolean", default: false },
      "skip-build": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help || (!values.prompt && !values.workspace)) {
    process.stdout.write(HELP);
    process.exit(values.help ? 0 : 1);
  }
  if (!values.prompt || !values.workspace) {
    process.stderr.write("error: --prompt and --workspace are required\n\n" + HELP);
    process.exit(1);
  }

  const validationRoot = resolve(import.meta.dir, "..");
  const containers = JSON.parse(
    await readFile(join(validationRoot, "containers.json"), "utf8"),
  ) as Containers;

  const model = values.model ?? containers.defaults.model;
  const cliTimeout = values.timeout != null ? Number(values.timeout) : undefined;
  const only = values.only as "claude-code" | "minibob" | undefined;
  const noBackend = values["no-backend"] === true;

  // Per-agent timeout: CLI flag overrides; else use containers.json per-agent
  // default; else fall back to global default.
  const timeoutFor = (agent: "claude-code" | "minibob") => {
    if (cliTimeout != null) return cliTimeout;
    const perAgent = agent === "claude-code"
      ? containers.claudeCode.default_timeout_seconds
      : containers.minibob.default_timeout_seconds;
    return perAgent ?? containers.defaults.timeoutSeconds;
  };

  const promptPath = resolve(values.prompt);
  if (!existsSync(promptPath)) throw new Error(`prompt not found: ${promptPath}`);
  const promptText = await readFile(promptPath, "utf8");

  const workspaceSeed = join(validationRoot, "workspaces", values.workspace);
  if (!existsSync(workspaceSeed)) throw new Error(`workspace not found: ${workspaceSeed}`);

  // Pre-flight: API key.
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    process.stderr.write("error: ANTHROPIC_API_KEY not set in environment\n");
    process.exit(1);
  }

  // Pre-flight: Claude Code image.
  if (!only || only === "claude-code") {
    if (!values["skip-build"] && !(await dockerImageExists(containers.claudeCode.image))) {
      process.stderr.write(`Building ${containers.claudeCode.image}...\n`);
      const r = Bun.spawnSync(
        ["docker", "build",
          "-f", join(validationRoot, containers.claudeCode.dockerfile),
          "-t", containers.claudeCode.image,
          validationRoot,
        ],
        { stdout: "inherit", stderr: "inherit" },
      );
      if (r.exitCode !== 0) throw new Error("docker build failed for Claude Code image");
    }
  }

  // Pre-flight: minibob image.
  if (!only || only === "minibob") {
    if (!(await dockerImageExists(containers.minibob.image))) {
      process.stderr.write(`Pulling ${containers.minibob.image}...\n`);
      const r = Bun.spawnSync(["docker", "pull", containers.minibob.image], {
        stdout: "inherit", stderr: "inherit",
      });
      if (r.exitCode !== 0) {
        process.stderr.write(`warning: pull failed for ${containers.minibob.image}; proceeding if a local copy exists\n`);
      }
    }
  }

  // Run dir.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const promptStem = basename(promptPath, extname(promptPath));
  const runDir = join(validationRoot, "runs", `${stamp}-${promptStem}`);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "prompt.md"), promptText);

  // Idempotent seed git-init. The seed `.git` dirs aren't tracked in the
  // super-repo (nested repos are awkward to commit cleanly), so a fresh clone
  // would have seed dirs without `.git`. Initialise on demand so minibob's
  // memory agent doesn't flood stderr with "fatal: not a git repository".
  // Skipped if the seed already has a `.git`.
  const seedGitDir = join(workspaceSeed, ".git");
  try {
    await Bun.file(join(seedGitDir, "HEAD")).text();
  } catch {
    process.stderr.write(`Initialising git in seed: ${workspaceSeed}\n`);
    await Bun.spawn(["git", "init"], { cwd: workspaceSeed }).exited;
    await Bun.spawn(["git", "add", "."], { cwd: workspaceSeed }).exited;
    await Bun.spawn(
      ["git", "-c", "user.email=seed@validation", "-c", "user.name=seed", "commit", "-m", "seed"],
      { cwd: workspaceSeed },
    ).exited;
  }

  const metabobConfigHostPath = join(homedir(), ".metabob", "config.json");

  const results: Record<string, AgentBundle> = {};

  for (const agent of (["claude-code", "minibob"] as const)) {
    if (only && agent !== only) continue;
    const agentDir = join(runDir, agent);
    const before = join(agentDir, "workspace.before");
    const after = join(agentDir, "workspace.after");
    await mkdir(agentDir, { recursive: true });
    // Copy seed twice — preserves the `before` snapshot even though the agent
    // only mutates `after`.
    await cp(workspaceSeed, before, { recursive: true });
    await cp(workspaceSeed, after, { recursive: true });

    process.stderr.write(`\n=== Running ${agent} ===\n`);
    const image = agent === "claude-code"
      ? containers.claudeCode.image
      : containers.minibob.image;

    const agentTimeout = timeoutFor(agent);
    const run = await runAgent({
      agent,
      image,
      workspaceHostPath: after,
      prompt: promptText,
      model,
      outDir: agentDir,
      timeoutSeconds: agentTimeout,
      anthropicApiKey,
      metabobConfigHostPath,
      noBackend: agent === "minibob" ? noBackend : false,
    });
    process.stderr.write(
      `${agent}: exit=${run.exitCode} timedOut=${run.timedOut} duration=${run.durationMs}ms (timeout=${agentTimeout}s)\n`,
    );

    const transcriptPath = join(agentDir, "transcript.jsonl");
    const summary = agent === "claude-code"
      ? await extractClaudeCodeTranscript(run.stdoutPath, transcriptPath)
      : await extractMinibobTranscript(run.stdoutPath, transcriptPath);

    const beforeTree = await snapshotTree(before);
    const afterTree = await snapshotTree(after);
    const treeDiff = compareTrees(beforeTree, afterTree);

    results[agent] = {
      run, summary, treeDiff, beforeTree, afterTree,
      beforeDir: before, afterDir: after,
    };
  }

  // Render report.
  const reportPath = join(runDir, "report.md");
  await writeFile(reportPath, renderReport({
    promptPath, promptText, model, runDir,
    containers, results,
    timeoutSeconds: {
      "claude-code": timeoutFor("claude-code"),
      "minibob": timeoutFor("minibob"),
    },
    noBackend,
  }));
  process.stderr.write(`\nreport: ${reportPath}\n`);
}

async function dockerImageExists(ref: string): Promise<boolean> {
  const r = Bun.spawnSync(["docker", "image", "inspect", ref], {
    stdout: "ignore", stderr: "ignore",
  });
  return r.exitCode === 0;
}

interface AgentBundle {
  run: AgentRunResult;
  summary: TranscriptSummary;
  treeDiff: TreeDiff;
  beforeTree: Map<string, FileEntry>;
  afterTree: Map<string, FileEntry>;
  beforeDir: string;
  afterDir: string;
}

interface ReportInput {
  promptPath: string;
  promptText: string;
  model: string;
  runDir: string;
  containers: Containers;
  results: Record<string, AgentBundle>;
  timeoutSeconds: Record<"claude-code" | "minibob", number>;
  noBackend: boolean;
}

function renderReport(r: ReportInput): string {
  const cc = r.results["claude-code"];
  const mb = r.results["minibob"];
  const lines: string[] = [];

  lines.push(`# Agent benchmark report`);
  lines.push("");
  lines.push(`- **Prompt:** \`${r.promptPath}\``);
  lines.push(`- **Model:** \`${r.model}\``);
  lines.push(`- **Timeout (claude-code):** ${r.timeoutSeconds["claude-code"]}s`);
  lines.push(`- **Timeout (minibob):** ${r.timeoutSeconds["minibob"]}s`);
  lines.push(`- **Backend mode (minibob):** ${r.noBackend ? "standalone (--no-backend)" : "default (discovery + activity-api)"}`);
  lines.push(`- **Run directory:** \`${r.runDir}\``);
  lines.push(`- **Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`### Image refs`);
  lines.push(`- claude-code: \`${r.containers.claudeCode.image}\``);
  lines.push(`- minibob: \`${r.containers.minibob.image}\``);
  lines.push("");

  lines.push(`### Prompt`);
  lines.push("");
  lines.push("```");
  lines.push(r.promptText.trim());
  lines.push("```");
  lines.push("");

  lines.push(`### Run summary`);
  lines.push("");
  lines.push(`| agent | exit | timed out | duration (ms) | LLM calls | tool calls | tokens (in/out) | cost USD |`);
  lines.push(`|---|---|---|---|---|---|---|---|`);
  for (const a of ["claude-code", "minibob"] as const) {
    const b = r.results[a];
    if (!b) { lines.push(`| ${a} | _skipped_ | | | | | | |`); continue; }
    const tk = (b.summary.totalInputTokens ?? "?") + " / " + (b.summary.totalOutputTokens ?? "?");
    const cost = b.summary.totalCostUsd != null ? b.summary.totalCostUsd.toFixed(4) : "?";
    lines.push(`| ${a} | ${b.run.exitCode} | ${b.run.timedOut} | ${b.run.durationMs} | ${b.summary.llmCallCount} | ${b.summary.toolCallCount} | ${tk} | ${cost} |`);
  }
  lines.push("");

  // ── Section 1: file-tree side-by-side
  lines.push(`## 1. File tree changes (side-by-side)`);
  lines.push("");
  if (!cc || !mb) {
    lines.push(`_Skipped — both agents must run to produce the side-by-side table._`);
    lines.push("");
  } else {
    const allPaths = new Set<string>();
    for (const p of [...cc.treeDiff.created, ...cc.treeDiff.modified, ...cc.treeDiff.deleted]) allPaths.add(p);
    for (const p of [...mb.treeDiff.created, ...mb.treeDiff.modified, ...mb.treeDiff.deleted]) allPaths.add(p);
    const sorted = [...allPaths].sort();
    if (sorted.length === 0) {
      lines.push(`_Neither agent modified the workspace._`);
    } else {
      lines.push(`| path | claude-code | minibob | same? |`);
      lines.push(`|---|---|---|---|`);
      for (const p of sorted) {
        const ccState = stateFor(p, cc.treeDiff);
        const mbState = stateFor(p, mb.treeDiff);
        const ccHash = cc.afterTree.get(p)?.sha256 ?? null;
        const mbHash = mb.afterTree.get(p)?.sha256 ?? null;
        const same = ccHash != null && mbHash != null && ccHash === mbHash ? "yes"
          : ccHash == null && mbHash == null ? "yes (both absent)"
          : "no";
        lines.push(`| \`${p}\` | ${ccState} | ${mbState} | ${same} |`);
      }
    }
  }
  lines.push("");

  // ── Section 2: per-file unified diffs (only files that differ between agents)
  lines.push(`## 2. Per-file unified diffs (where the two agents disagree)`);
  lines.push("");
  if (!cc || !mb) {
    lines.push(`_Skipped — needs both agents._`);
  } else {
    const candidates = new Set<string>();
    for (const p of new Set([...cc.afterTree.keys(), ...mb.afterTree.keys()])) {
      const ccHash = cc.afterTree.get(p)?.sha256 ?? null;
      const mbHash = mb.afterTree.get(p)?.sha256 ?? null;
      if (ccHash !== mbHash) candidates.add(p);
    }
    if (candidates.size === 0) {
      lines.push(`_The two agents produced byte-identical workspaces. No diffs._`);
    } else {
      for (const p of [...candidates].sort()) {
        lines.push(`### \`${p}\``);
        lines.push("");
        const ccPath = join(cc.afterDir, p);
        const mbPath = join(mb.afterDir, p);
        // diff -N treats absence as empty file, so created/deleted is fine.
        const d = unifiedDiff(ccPath, mbPath, p);
        lines.push("```diff");
        lines.push(d.trim() || "(no diff produced)");
        lines.push("```");
        lines.push("");
      }
    }
  }
  lines.push("");

  // ── Section 3: transcripts
  lines.push(`## 3. Transcript summary`);
  lines.push("");
  for (const a of ["claude-code", "minibob"] as const) {
    const b = r.results[a];
    lines.push(`### ${a}`);
    if (!b) { lines.push(`_skipped_`); lines.push(""); continue; }
    lines.push(`- LLM calls: ${b.summary.llmCallCount}`);
    lines.push(`- tool calls: ${b.summary.toolCallCount}`);
    lines.push(`- input tokens: ${b.summary.totalInputTokens ?? "unknown"}`);
    lines.push(`- output tokens: ${b.summary.totalOutputTokens ?? "unknown"}`);
    lines.push(`- cost (USD): ${b.summary.totalCostUsd ?? "unknown"}`);
    if (b.summary.finalAssistantMessage) {
      lines.push(`- final assistant message (truncated):`);
      lines.push("");
      lines.push("> " + b.summary.finalAssistantMessage.slice(0, 800).replace(/\n/g, "\n> "));
    }
    if (b.summary.warnings.length) {
      lines.push(`- warnings:`);
      for (const w of b.summary.warnings) lines.push(`  - ${w}`);
    }
    lines.push("");
  }

  // ── Section 4: failure / timeout notes
  lines.push(`## 4. Failure & timeout notes`);
  lines.push("");
  for (const a of ["claude-code", "minibob"] as const) {
    const b = r.results[a];
    if (!b) continue;
    const flags: string[] = [];
    if (b.run.timedOut) flags.push("**timed out**");
    if (b.run.exitCode !== 0 && b.run.exitCode !== null) flags.push(`exit code \`${b.run.exitCode}\``);
    lines.push(`- **${a}**: ${flags.length ? flags.join(", ") : "ok"}. stderr at \`${b.run.stderrPath}\``);
  }
  lines.push("");

  // ── Section 5: verdict scaffolding
  lines.push(`## 5. Verdict (human-filled)`);
  lines.push("");
  lines.push(`<!--`);
  lines.push(`Fill in after reading the diffs and transcripts. Suggested rubric:`);
  lines.push(`  - Did each agent satisfy the prompt?`);
  lines.push(`  - Which workspace state would you ship?`);
  lines.push(`  - Notable differences in approach (tool choice, # of LLM calls, retries)?`);
  lines.push(`  - Cost-quality trade-off?`);
  lines.push(`-->`);
  lines.push("");
  lines.push(`### Quality verdict`);
  lines.push(``);
  lines.push(`- claude-code: TODO`);
  lines.push(`- minibob:     TODO`);
  lines.push(``);
  lines.push(`### Notes`);
  lines.push(``);
  lines.push(`TODO`);
  lines.push("");

  return lines.join("\n");
}

function stateFor(path: string, d: TreeDiff): string {
  if (d.created.includes(path)) return "created";
  if (d.deleted.includes(path)) return "deleted";
  if (d.modified.includes(path)) return "modified";
  return "—";
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});

void stat; void dirname; // keep imports honest if linter complains
