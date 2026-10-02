/**
 * Spins each agent's container with a workspace bind-mount, captures
 * stdout/stderr to log files, enforces a wall-clock timeout.
 *
 * The two agents share the same `runAgent` shape; their differences live in
 * how `buildArgs` constructs the docker invocation. Keeping them in one file
 * makes parity-by-construction easy to audit.
 */
export interface AgentRunOptions {
    agent: "claude-code" | "minibob";
    image: string;
    workspaceHostPath: string;
    prompt: string;
    model: string;
    outDir: string;
    timeoutSeconds: number;
    anthropicApiKey: string;
    metabobConfigHostPath?: string;
    /**
     * Phase 13.1.4: when true, run minibob in standalone mode — no discovery
     * registration, no activity-api trace POSTs. No-op for claude-code.
     */
    noBackend?: boolean;
    /**
     * Phase 14: when true, explicitly enable discovery registration so
     * vessel resolvers get used. Mounts host config as usual but also
     * sets DISCOVERY_ENABLED=true and the public discovery endpoint.
     * No-op for claude-code. Mutually exclusive with noBackend.
     */
    withBackend?: boolean;
    /**
     * When set, run minibob with `--template <id>` instead of `--single`,
     * passing the prompt text as `--var goal=<prompt>`. Bypasses Thompson
     * sampling for prompts that require a specific execution path (e.g.
     * "improvise" to force the free-form LLM executor). No-op for claude-code.
     */
    minibobTemplate?: string;
}
export interface AgentRunResult {
    exitCode: number | null;
    timedOut: boolean;
    durationMs: number;
    stdoutPath: string;
    stderrPath: string;
}
export declare function runAgent(opts: AgentRunOptions): Promise<AgentRunResult>;
//# sourceMappingURL=docker-runner.d.ts.map