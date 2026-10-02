"use strict";
/**
 * Spins each agent's container with a workspace bind-mount, captures
 * stdout/stderr to log files, enforces a wall-clock timeout.
 *
 * The two agents share the same `runAgent` shape; their differences live in
 * how `buildArgs` constructs the docker invocation. Keeping them in one file
 * makes parity-by-construction easy to audit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
async function runAgent(opts) {
    await (0, promises_1.mkdir)(opts.outDir, { recursive: true });
    const stdoutPath = `${opts.outDir}/stdout.log`;
    const stderrPath = `${opts.outDir}/stderr.log`;
    const stdoutStream = (0, node_fs_1.createWriteStream)(stdoutPath);
    const stderrStream = (0, node_fs_1.createWriteStream)(stderrPath);
    // Phase 13.1.2: mount a host-writable transcript dir into minibob; copy
    // /tmp/minibob-transcript/transcript.jsonl out to <outDir>/transcript.jsonl
    // after the run completes.
    let transcriptHostDir;
    if (opts.agent === "minibob") {
        transcriptHostDir = (0, node_path_1.join)(opts.outDir, ".transcript-mount");
        await (0, promises_1.mkdir)(transcriptHostDir, { recursive: true });
    }
    const args = buildDockerArgs(opts, transcriptHostDir);
    const start = Date.now();
    return await new Promise((resolve) => {
        const child = (0, node_child_process_1.spawn)("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
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
        child.on("exit", async (code) => {
            clearTimeout(killTimer);
            stdoutStream.end();
            stderrStream.end();
            // Copy minibob's transcript.jsonl out of the bind mount to the run dir.
            if (opts.agent === "minibob" && transcriptHostDir) {
                const src = (0, node_path_1.join)(transcriptHostDir, "transcript.jsonl");
                const dst = (0, node_path_1.join)(opts.outDir, "transcript.jsonl");
                try {
                    if ((0, node_fs_1.existsSync)(src)) {
                        await (0, promises_1.copyFile)(src, dst);
                    }
                }
                catch (err) {
                    process.stderr.write(`warning: failed to copy minibob transcript: ${err instanceof Error ? err.message : String(err)}\n`);
                }
            }
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
function buildDockerArgs(opts, transcriptHostDir) {
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
    // minibob: image WORKDIR is /app where index.ts lives. Don't override it.
    // Pass the workspace path via MINIBOB_WORKDIR env var — index.ts does not
    // parse a --workdir CLI flag; only the env var is honoured by config.ts.
    const minibobArgs = ["run", "--rm", "-e", "MINIBOB_WORKDIR=/workspace", ...baseMounts];
    // Mount the transcript host dir so MINIBOB_TRANSCRIPT_FILE writes survive
    // the container's lifetime.
    if (transcriptHostDir) {
        minibobArgs.push("-v", `${transcriptHostDir}:/tmp/minibob-transcript`);
        minibobArgs.push("-e", "MINIBOB_TRANSCRIPT_FILE=/tmp/minibob-transcript/transcript.jsonl");
    }
    if (opts.noBackend) {
        // Phase 13.1.4 — standalone parity mode. Disable discovery registration
        // and remove the activity-api credential entirely so minibob can't POST
        // traces. Mounting an empty config dir blocks user-config inheritance.
        minibobArgs.push("-e", "DISCOVERY_ENABLED=false");
        minibobArgs.push("-e", "MINIBOB_DISCOVERY_ENABLED=false");
        minibobArgs.push("-e", "METABOB_API_KEY=");
        minibobArgs.push("-e", "MINIBOB_OFFLINE_MODE=true");
        minibobArgs.push("-e", "MINIBOB_SKIP_STARTUP=true");
    }
    else if (opts.withBackend) {
        // Phase 14 — full backend mode. Mount host config (API key + endpoint)
        // and explicitly enable discovery so vessel resolvers are used.
        if (opts.metabobConfigHostPath && (0, node_fs_1.existsSync)(opts.metabobConfigHostPath)) {
            minibobArgs.push("-v", `${opts.metabobConfigHostPath}:/root/.metabob/config.json:ro`);
        }
        minibobArgs.push("-e", "DISCOVERY_ENABLED=true");
        minibobArgs.push("-e", "DISCOVERY_VESSEL_ENDPOINT=https://discovery.metabob.com");
        // Skip startup waking activities: the DiscoveredTools 10s timeout during
        // startup:health-check cascades to 504s that push minibob into offline mode,
        // blocking subsequent vessel discovery calls during goal execution.
        minibobArgs.push("-e", "MINIBOB_SKIP_STARTUP=true");
    }
    else if (opts.metabobConfigHostPath && (0, node_fs_1.existsSync)(opts.metabobConfigHostPath)) {
        minibobArgs.push("-v", `${opts.metabobConfigHostPath}:/root/.metabob/config.json:ro`);
    }
    // Pass model through MINIBOB_MODEL so the same flag controls both agents.
    minibobArgs.push("-e", `MINIBOB_MODEL=${opts.model}`);
    const minibobCmd = opts.minibobTemplate
        ? ["--template", opts.minibobTemplate, "--var", `goal=${opts.prompt}`]
        : ["--single", opts.prompt];
    return [
        ...minibobArgs,
        opts.image,
        "bun", "run", "index.ts",
        ...minibobCmd,
    ];
}
void node_path_1.dirname; // silence unused if linter complains in some configs
//# sourceMappingURL=docker-runner.js.map