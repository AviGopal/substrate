/**
 * Spins each agent's container with a workspace bind-mount, captures
 * stdout/stderr to log files, enforces a wall-clock timeout.
 *
 * The two agents share the same `runAgent` shape; their differences live in
 * how `buildArgs` constructs the docker invocation. Keeping them in one file
 * makes parity-by-construction easy to audit.
 */

import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface AgentRunOptions {
  agent: "claude-code" | "minibob";
  image: string;
  workspaceHostPath: string;     // already-copied workspace.before; container will mutate this in place
  prompt: string;
  model: string;
  outDir: string;                // <run-dir>/<agent>/
  timeoutSeconds: number;
  anthropicApiKey: string;
  metabobConfigHostPath?: string; // ~/.metabob/config.json — mounted RO into minibob
}

export interface AgentRunResult {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdoutPath: string;
  stderrPath: string;
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  await mkdir(opts.outDir, { recursive: true });
  const stdoutPath = `${opts.outDir}/stdout.log`;
  const stderrPath = `${opts.outDir}/stderr.log`;
  const stdoutStream = createWriteStream(stdoutPath);
  const stderrStream = createWriteStream(stderrPath);

  const args = buildDockerArgs(opts);
  const start = Date.now();

  return await new Promise<AgentRunResult>((resolve) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      // SIGTERM → docker stop signal handling; container will exit with 143.
      child.kill("SIGTERM");
      // Hard kill if it lingers.
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, opts.timeoutSeconds * 1000);

    child.stdout.pipe(stdoutStream);
    child.stderr.pipe(stderrStream);

    child.on("exit", (code) => {
      clearTimeout(killTimer);
      stdoutStream.end();
      stderrStream.end();
      resolve({
        exitCode: code,
        timedOut,
        durationMs: Date.now() - start,
        stdoutPath,
        stderrPath,
      });
    });
  });
}

function buildDockerArgs(opts: AgentRunOptions): string[] {
  // Workspace is the only host filesystem the container can write to.
  const baseMounts = [
    "-v", `${opts.workspaceHostPath}:/workspace`,
    "-e", "ANTHROPIC_API_KEY",
  ];

  if (opts.agent === "claude-code") {
    // The image already declares WORKDIR=/workspace and a non-root `node`
    // user; both are required for `--dangerously-skip-permissions` to be
    // accepted. Don't override either.
    return [
      "run", "--rm",
      ...baseMounts,
      opts.image,
      "claude",
      "-p", opts.prompt,
      "--model", opts.model,
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
    ];
  }

  // minibob: image WORKDIR is /app where index.ts lives. Don't override it;
  // pass the workspace path to minibob via --workdir.
  const minibobArgs = ["run", "--rm", ...baseMounts];
  if (opts.metabobConfigHostPath && existsSync(opts.metabobConfigHostPath)) {
    minibobArgs.push("-v", `${opts.metabobConfigHostPath}:/root/.metabob/config.json:ro`);
  }
  // Pass model through MINIBOB_MODEL so the same flag controls both agents.
  minibobArgs.push("-e", `MINIBOB_MODEL=${opts.model}`);

  return [
    ...minibobArgs,
    opts.image,
    "bun", "run", "index.ts",
    "--single", opts.prompt,
    "--workdir", "/workspace",
  ];
}

void dirname; // silence unused if linter complains in some configs
