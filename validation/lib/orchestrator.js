#!/usr/bin/env bun
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const node_util_1 = require("node:util");
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const docker_runner_1 = require("./docker-runner");
const workspace_diff_1 = require("./workspace-diff");
const transcript_capture_1 = require("./transcript-capture");
const backend_probe_1 = require("./backend-probe");
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
  --with-backend         Run minibob with full backend connectivity: DISCOVERY_ENABLED=true,
                         discovery.metabob.com registered, host ~/.metabob/config.json mounted.
                         After the run, queries activity-api to verify resolver usage, lifecycle
                         hook firings, and impulse-relevance updates (report section 6).
  --minibob-template <id>  Run minibob with --template <id> instead of --single, passing the
                         prompt text as --var goal=<prompt>. Bypasses Thompson sampling for
                         prompts that require a specific execution path (e.g. "improvise").
  --skip-build           Don't (re)build the local Claude Code image even if missing
  --help, -h             Show this help

Outputs:
  validation/runs/<timestamp>-<prompt-stem>/
    prompt.md
    claude-code/{workspace.before,workspace.after,transcript.jsonl,stdout.log,stderr.log}
    minibob/{workspace.before,workspace.after,transcript.jsonl,stdout.log,stderr.log}
    report.md
`;
async function main() {
    const { values } = (0, node_util_1.parseArgs)({
        options: {
            prompt: { type: "string" },
            workspace: { type: "string" },
            model: { type: "string" },
            timeout: { type: "string" },
            only: { type: "string" },
            "no-backend": { type: "boolean", default: false },
            "with-backend": { type: "boolean", default: false },
            "minibob-template": { type: "string" },
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
    const validationRoot = (0, node_path_1.resolve)(import.meta.dir, "..");
    const containers = JSON.parse(await (0, promises_1.readFile)((0, node_path_1.join)(validationRoot, "containers.json"), "utf8"));
    const model = values.model ?? containers.defaults.model;
    const cliTimeout = values.timeout != null ? Number(values.timeout) : undefined;
    const only = values.only;
    const noBackend = values["no-backend"] === true;
    const withBackend = values["with-backend"] === true;
    const minibobTemplate = values["minibob-template"];
    if (noBackend && withBackend) {
        process.stderr.write("error: --no-backend and --with-backend are mutually exclusive\n");
        process.exit(1);
    }
    // Per-agent timeout: CLI flag overrides; else use containers.json per-agent
    // default; else fall back to global default.
    const timeoutFor = (agent) => {
        if (cliTimeout != null)
            return cliTimeout;
        const perAgent = agent === "claude-code"
            ? containers.claudeCode.default_timeout_seconds
            : containers.minibob.default_timeout_seconds;
        return perAgent ?? containers.defaults.timeoutSeconds;
    };
    const promptPath = (0, node_path_1.resolve)(values.prompt);
    if (!(0, node_fs_1.existsSync)(promptPath))
        throw new Error(`prompt not found: ${promptPath}`);
    const promptText = await (0, promises_1.readFile)(promptPath, "utf8");
    const workspaceSeed = (0, node_path_1.join)(validationRoot, "workspaces", values.workspace);
    if (!(0, node_fs_1.existsSync)(workspaceSeed))
        throw new Error(`workspace not found: ${workspaceSeed}`);
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
            const r = Bun.spawnSync(["docker", "build",
                "-f", (0, node_path_1.join)(validationRoot, containers.claudeCode.dockerfile),
                "-t", containers.claudeCode.image,
                validationRoot,], { stdout: "inherit", stderr: "inherit" });
            if (r.exitCode !== 0)
                throw new Error("docker build failed for Claude Code image");
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
    const promptStem = (0, node_path_1.basename)(promptPath, (0, node_path_1.extname)(promptPath));
    const runDir = (0, node_path_1.join)(validationRoot, "runs", `${stamp}-${promptStem}`);
    await (0, promises_1.mkdir)(runDir, { recursive: true });
    await (0, promises_1.writeFile)((0, node_path_1.join)(runDir, "prompt.md"), promptText);
    // Idempotent seed git-init. The seed `.git` dirs aren't tracked in the
    // super-repo (nested repos are awkward to commit cleanly), so a fresh clone
    // would have seed dirs without `.git`. Initialise on demand so minibob's
    // memory agent doesn't flood stderr with "fatal: not a git repository".
    // Skipped if the seed already has a `.git`.
    const seedGitDir = (0, node_path_1.join)(workspaceSeed, ".git");
    try {
        await Bun.file((0, node_path_1.join)(seedGitDir, "HEAD")).text();
    }
    catch {
        process.stderr.write(`Initialising git in seed: ${workspaceSeed}\n`);
        await Bun.spawn(["git", "init"], { cwd: workspaceSeed }).exited;
        await Bun.spawn(["git", "add", "."], { cwd: workspaceSeed }).exited;
        await Bun.spawn(["git", "-c", "user.email=seed@validation", "-c", "user.name=seed", "commit", "-m", "seed"], { cwd: workspaceSeed }).exited;
    }
    const metabobConfigHostPath = (0, node_path_1.join)((0, node_os_1.homedir)(), ".metabob", "config.json");
    // --with-backend: read API key + endpoint from host config for post-run probing
    let metabobApiKey = process.env.METABOB_API_KEY ?? "";
    let metabobEndpoint = "https://activity.metabob.com";
    if (withBackend && (0, node_fs_1.existsSync)(metabobConfigHostPath)) {
        try {
            const cfg = JSON.parse(await (0, promises_1.readFile)(metabobConfigHostPath, "utf8"));
            metabobApiKey = cfg.metabob?.apiKey ?? metabobApiKey;
            metabobEndpoint = cfg.metabob?.endpoint ?? metabobEndpoint;
        }
        catch {
            // ignore parse errors; fall back to env
        }
    }
    const results = {};
    for (const agent of ["claude-code", "minibob"]) {
        if (only && agent !== only)
            continue;
        const agentDir = (0, node_path_1.join)(runDir, agent);
        const before = (0, node_path_1.join)(agentDir, "workspace.before");
        const after = (0, node_path_1.join)(agentDir, "workspace.after");
        await (0, promises_1.mkdir)(agentDir, { recursive: true });
        // Copy seed twice — preserves the `before` snapshot even though the agent
        // only mutates `after`.
        await (0, promises_1.cp)(workspaceSeed, before, { recursive: true });
        await (0, promises_1.cp)(workspaceSeed, after, { recursive: true });
        process.stderr.write(`\n=== Running ${agent} ===\n`);
        const image = agent === "claude-code"
            ? containers.claudeCode.image
            : containers.minibob.image;
        const agentTimeout = timeoutFor(agent);
        const runStartTime = new Date();
        // Phase 14: take relevance snapshot BEFORE the run so delta is meaningful.
        let preRunRelevance;
        if (agent === "minibob" && withBackend && metabobApiKey) {
            try {
                preRunRelevance = await (0, backend_probe_1.snapshotRelevanceBefore)(metabobEndpoint, metabobApiKey);
                process.stderr.write(`pre-run relevance snapshot: ${preRunRelevance.total} records\n`);
            }
            catch {
                // non-fatal
            }
        }
        const run = await (0, docker_runner_1.runAgent)({
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
            withBackend: agent === "minibob" ? withBackend : false,
            minibobTemplate: agent === "minibob" ? minibobTemplate : undefined,
        });
        process.stderr.write(`${agent}: exit=${run.exitCode} timedOut=${run.timedOut} duration=${run.durationMs}ms (timeout=${agentTimeout}s)\n`);
        const transcriptPath = (0, node_path_1.join)(agentDir, "transcript.jsonl");
        const summary = agent === "claude-code"
            ? await (0, transcript_capture_1.extractClaudeCodeTranscript)(run.stdoutPath, transcriptPath)
            : await (0, transcript_capture_1.extractMinibobTranscript)(run.stdoutPath, transcriptPath);
        const beforeTree = await (0, workspace_diff_1.snapshotTree)(before);
        const afterTree = await (0, workspace_diff_1.snapshotTree)(after);
        const treeDiff = (0, workspace_diff_1.compareTrees)(beforeTree, afterTree);
        // Phase 14: backend probe after minibob run
        let backendProbe;
        if (agent === "minibob" && withBackend && metabobApiKey) {
            process.stderr.write(`Probing activity-api for backend observations...\n`);
            backendProbe = await (0, backend_probe_1.runBackendProbe)({
                stdoutLogPath: run.stdoutPath,
                metabobEndpoint,
                metabobApiKey,
                runStartTime,
                relevanceBefore: preRunRelevance,
            });
            process.stderr.write(`  executions found: ${backendProbe.executionIdsFound.length}, lifecycle hooks: ${backendProbe.lifecycleActivities.length}, new relevance records: ${backendProbe.relevanceAfter.total}\n`);
        }
        results[agent] = {
            run, summary, treeDiff, beforeTree, afterTree,
            beforeDir: before, afterDir: after, backendProbe,
        };
    }
    // Render report.
    const reportPath = (0, node_path_1.join)(runDir, "report.md");
    await (0, promises_1.writeFile)(reportPath, renderReport({
        promptPath, promptText, model, runDir,
        containers, results,
        timeoutSeconds: {
            "claude-code": timeoutFor("claude-code"),
            "minibob": timeoutFor("minibob"),
        },
        noBackend,
        withBackend,
    }));
    process.stderr.write(`\nreport: ${reportPath}\n`);
}
async function dockerImageExists(ref) {
    const r = Bun.spawnSync(["docker", "image", "inspect", ref], {
        stdout: "ignore", stderr: "ignore",
    });
    return r.exitCode === 0;
}
function renderReport(r) {
    const cc = r.results["claude-code"];
    const mb = r.results["minibob"];
    const lines = [];
    lines.push(`# Agent benchmark report`);
    lines.push("");
    lines.push(`- **Prompt:** \`${r.promptPath}\``);
    lines.push(`- **Model:** \`${r.model}\``);
    lines.push(`- **Timeout (claude-code):** ${r.timeoutSeconds["claude-code"]}s`);
    lines.push(`- **Timeout (minibob):** ${r.timeoutSeconds["minibob"]}s`);
    lines.push(`- **Backend mode (minibob):** ${r.noBackend ? "standalone (--no-backend)" : r.withBackend ? "full backend (--with-backend)" : "default (discovery + activity-api)"}`);
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
    for (const a of ["claude-code", "minibob"]) {
        const b = r.results[a];
        if (!b) {
            lines.push(`| ${a} | _skipped_ | | | | | | |`);
            continue;
        }
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
    }
    else {
        const allPaths = new Set();
        for (const p of [...cc.treeDiff.created, ...cc.treeDiff.modified, ...cc.treeDiff.deleted])
            allPaths.add(p);
        for (const p of [...mb.treeDiff.created, ...mb.treeDiff.modified, ...mb.treeDiff.deleted])
            allPaths.add(p);
        const sorted = [...allPaths].sort();
        if (sorted.length === 0) {
            lines.push(`_Neither agent modified the workspace._`);
        }
        else {
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
    }
    else {
        const candidates = new Set();
        for (const p of new Set([...cc.afterTree.keys(), ...mb.afterTree.keys()])) {
            const ccHash = cc.afterTree.get(p)?.sha256 ?? null;
            const mbHash = mb.afterTree.get(p)?.sha256 ?? null;
            if (ccHash !== mbHash)
                candidates.add(p);
        }
        if (candidates.size === 0) {
            lines.push(`_The two agents produced byte-identical workspaces. No diffs._`);
        }
        else {
            for (const p of [...candidates].sort()) {
                lines.push(`### \`${p}\``);
                lines.push("");
                const ccPath = (0, node_path_1.join)(cc.afterDir, p);
                const mbPath = (0, node_path_1.join)(mb.afterDir, p);
                // diff -N treats absence as empty file, so created/deleted is fine.
                const d = (0, workspace_diff_1.unifiedDiff)(ccPath, mbPath, p);
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
    for (const a of ["claude-code", "minibob"]) {
        const b = r.results[a];
        lines.push(`### ${a}`);
        if (!b) {
            lines.push(`_skipped_`);
            lines.push("");
            continue;
        }
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
            for (const w of b.summary.warnings)
                lines.push(`  - ${w}`);
        }
        lines.push("");
    }
    // ── Section 4: failure / timeout notes
    lines.push(`## 4. Failure & timeout notes`);
    lines.push("");
    for (const a of ["claude-code", "minibob"]) {
        const b = r.results[a];
        if (!b)
            continue;
        const flags = [];
        if (b.run.timedOut)
            flags.push("**timed out**");
        if (b.run.exitCode !== 0 && b.run.exitCode !== null)
            flags.push(`exit code \`${b.run.exitCode}\``);
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
    // ── Section 6: backend observations (--with-backend only)
    if (r.withBackend && mb?.backendProbe) {
        lines.push((0, backend_probe_1.renderBackendSection)(mb.backendProbe));
    }
    return lines.join("\n");
}
function stateFor(path, d) {
    if (d.created.includes(path))
        return "created";
    if (d.deleted.includes(path))
        return "deleted";
    if (d.modified.includes(path))
        return "modified";
    return "—";
}
main().catch((err) => {
    process.stderr.write(`fatal: ${err?.stack ?? err}\n`);
    process.exit(1);
});
void promises_1.stat;
void node_path_1.dirname; // keep imports honest if linter complains
//# sourceMappingURL=orchestrator.js.map