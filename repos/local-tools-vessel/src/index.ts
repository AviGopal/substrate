/**
 * local-tools-vessel — deterministic shell/file/git resolver vessel.
 *
 * Spec: openspec/changes/2026-05-23-substrate-explicit-vessels Phase 1, task 1.1.
 * Port: 8230  |  Discovery: http://127.0.0.1:8100
 * Shapes: shellResult, fileContent, fileWriteResult, fileEditResult,
 *         gitStatus, gitDiff, gitCommitResult
 */

import { ActivityExecutor, ExecutionRuntime, VesselDaemon } from "@avigopal/ias-executor-ts";
import type { ResolverHandler } from "@avigopal/ias-executor-ts";

const PORT = Number(process.env.PORT ?? 8230);
const VESSEL_ID = "local-tools-vessel";
const DISCOVERY = process.env.DISCOVERY_ENDPOINT ?? "http://127.0.0.1:8100";
const API_KEY = process.env.METABOB_API_KEY ?? "";
const DEFAULT_CWD = process.env.WORKSPACE_ROOT ?? "/workspace";

// ── helpers ──────────────────────────────────────────────────────────────────

function str(o: unknown, ...keys: string[]): string | undefined {
  let v: unknown = o;
  for (const k of keys) { v = (typeof v === "object" && v !== null) ? (v as Record<string,unknown>)[k] : undefined; }
  return typeof v === "string" ? v : undefined;
}

async function sh(cmd: string, cwd = DEFAULT_CWD) {
  const p = Bun.spawn(["bash", "-c", cmd], { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exit_code] = await Promise.all([
    new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited,
  ]);
  return { stdout, stderr, exit_code };
}

// ── resolvers ─────────────────────────────────────────────────────────────────

const shell: ResolverHandler = async (ctx) => {
  const command = str(ctx.body, "impulse", "pointer", "command") ?? str(ctx.body, "command");
  if (!command) return { error: "command is required" };
  return sh(command, str(ctx.body, "cwd")).then(r => ({ shape: "shellResult", ...r }))
    .catch(e => ({ error: (e as Error).message }));
};

const fsRead: ResolverHandler = async (ctx) => {
  const path = str(ctx.body, "impulse", "pointer", "path") ?? str(ctx.body, "path");
  if (!path) return { error: "path is required" };
  return Bun.file(path).text().then(content => ({ shape: "fileContent", path, content }))
    .catch(e => ({ error: (e as Error).message }));
};

const fsWrite: ResolverHandler = async (ctx) => {
  const path = str(ctx.body, "path"), content = str(ctx.body, "content");
  if (!path || content === undefined) return { error: "path and content are required" };
  return Bun.write(path, content).then(() => ({ shape: "fileWriteResult", path, ok: true }))
    .catch(e => ({ error: (e as Error).message }));
};

const fsEdit: ResolverHandler = async (ctx) => {
  const path = str(ctx.body, "path"), old_string = str(ctx.body, "old_string"), new_string = str(ctx.body, "new_string");
  if (!path || old_string === undefined || new_string === undefined)
    return { error: "path, old_string, and new_string are required" };
  try {
    const text = await Bun.file(path).text();
    if (!text.includes(old_string)) return { error: "old_string not found in file", path };
    await Bun.write(path, text.replace(old_string, new_string));
    return { shape: "fileEditResult", path, ok: true };
  } catch (e) { return { error: (e as Error).message }; }
};

const gitStatus: ResolverHandler = async (ctx) =>
  sh("git status --porcelain", str(ctx.body, "cwd")).then(r => ({ shape: "gitStatus", ...r }))
    .catch(e => ({ error: (e as Error).message }));

const gitDiff: ResolverHandler = async (ctx) => {
  const staged = (ctx.body as Record<string,unknown>)?.staged === true;
  return sh(staged ? "git diff --staged" : "git diff", str(ctx.body, "cwd"))
    .then(r => ({ shape: "gitDiff", ...r })).catch(e => ({ error: (e as Error).message }));
};

const gitCommit: ResolverHandler = async (ctx) => {
  const message = str(ctx.body, "message");
  if (!message) return { error: "message is required" };
  return sh(`git commit -m ${JSON.stringify(message)}`, str(ctx.body, "cwd"))
    .then(r => ({ shape: "gitCommitResult", ...r })).catch(e => ({ error: (e as Error).message }));
};

// ── daemon ────────────────────────────────────────────────────────────────────

const resolvers = new Map<string, ResolverHandler>([
  ["shell", shell], ["bash", shell],
  ["fs_read", fsRead], ["fs_write", fsWrite], ["fs_edit", fsEdit],
  ["git_status", gitStatus], ["git_diff", gitDiff], ["git_commit", gitCommit],
]);

const runtime = new ExecutionRuntime({
  attachedVessels: [{ id: VESSEL_ID, kind: "local-tools" as never, resolverIds: Array.from(resolvers.keys()) }],
});

await new VesselDaemon({
  port: PORT,
  vesselId: VESSEL_ID,
  vesselName: "Local Tools Vessel",
  shapes: ["shellResult", "fileContent", "fileWriteResult", "fileEditResult", "gitStatus", "gitDiff", "gitCommitResult"],
  executor: new ActivityExecutor(runtime),
  resolvers,
  discoveryEndpoint: DISCOVERY,
  apiKey: API_KEY || undefined,
  version: "0.1.0",
  enforceCompositionChain: false,
  systemVessel: true,
}).start();

console.log(`[local-tools-vessel] listening on http://127.0.0.1:${PORT}`);
