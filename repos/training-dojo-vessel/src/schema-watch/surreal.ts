/**
 * schema-watch: SurrealDB access — direct, over SSH, not through activity-api.
 *
 * `test.srqlnb` (super-repo root) documents why this is the only route in:
 * SurrealDB binds `127.0.0.1:8000` INSIDE the `substrate-live` container and
 * is never published on a host port (confirmed empirically — `docker port
 * substrate-live` lists 18080/18100/18101/18210 only). A human reaches it by
 * hand-rolling an SSH tunnel + socat relay for an editor extension; a
 * long-running service has no business holding a tunnel open just to run a
 * query every few minutes. Running the query INSIDE the container over one
 * SSH connection is simpler and doesn't leave a forwarded port sitting open.
 *
 * This is root SSH to the host that runs the hub, executing root-authenticated
 * SurrealQL. That is real privilege, not a shape resolve — see the posture
 * note in `index.ts` alongside where this module is wired in: this vessel's
 * `/api/schema/*` routes are read-only surfaces over it, and the SSH key /
 * host are server-side configuration a browser never sees, the same posture
 * `routes/proxy.ts` already documents for injecting the hub API key.
 */

import { spawn } from "node:child_process";

const SSH_HOST = process.env["SCHEMA_WATCH_SSH_HOST"] ?? "syzygy.host";
const SSH_USER = process.env["SCHEMA_WATCH_SSH_USER"] ?? "root";
const SURREAL_NS = process.env["SCHEMA_WATCH_SURREAL_NS"] ?? "activity-system";
const SURREAL_DB = process.env["SCHEMA_WATCH_SURREAL_DB"] ?? "learning_loop";
const CONTAINER = process.env["SCHEMA_WATCH_CONTAINER"] ?? "substrate-live";

/** A table/view name as INFO FOR DB spells it. Defense in depth before it is
 * ever interpolated into a SurrealQL statement, even though the only source
 * for these names is SurrealDB's own INFO FOR DB output, not caller input. */
const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export function isSafeIdent(name: string): boolean {
  return SAFE_IDENT.test(name);
}

export interface SurrealStatementResult {
  result?: unknown;
  status: "OK" | "ERR";
  time?: string;
}

/**
 * Run one SSH connection, one `docker exec ... curl .../sql` call, carrying
 * every statement in `sql` (semicolon-separated) as a single batched request
 * — SurrealDB executes them server-side in order and returns one result per
 * statement, in order. Deliberate: a full scan is ~99 tables x 2 statements
 * (INFO FOR TABLE + a row count) = ~198 statements, and issuing that as 198
 * separate SSH round trips would be dominated by handshake latency, not the
 * database itself.
 *
 * The whole remote script — SQL included, base64-embedded — travels over
 * SSH's own stdin to a remote `bash -s`, exactly the pattern
 * `test.srqlnb`'s human workflow uses manually. Two things that look like
 * simpler alternatives were tried and both broke:
 *   - Passing the base64 payload as a SEPARATE ssh argv element (`bash -c
 *     script _ payload`): OpenSSH does not preserve argv boundaries across
 *     the wire, it joins every argument after `user@host` with spaces and
 *     hands the remote shell ONE re-parsed string, so five distinct local
 *     argv elements silently flatten into a broken command remotely.
 *   - Piping the decoded SQL through `docker exec -i ... --data-binary @-`:
 *     hung indefinitely in practice (measured — not a theoretical concern),
 *     whatever the exact cause, so it is a dead end regardless of diagnosis.
 * Writing the decoded SQL to a file on the host, `docker cp`-ing it into the
 * container, and having curl read it with `--data-binary @file` sidesteps
 * both: one self-contained script, one stdin channel, no inter-process pipe
 * to hang on. Base64's alphabet (`A-Za-z0-9+/=`) has no shell metacharacters,
 * so embedding it in single quotes inside that one script is safe.
 */
export async function runSurrealQL(
  sql: string,
  opts: { ns?: string; db?: string } = {},
): Promise<SurrealStatementResult[]> {
  const ns = opts.ns ?? SURREAL_NS;
  const db = opts.db ?? SURREAL_DB;
  const sqlB64 = Buffer.from(sql, "utf8").toString("base64");
  const tag = Math.random().toString(36).slice(2, 10);
  const hostFile = `/tmp/schema-watch-${tag}.sql`;
  const remoteScript = [
    `set -e`,
    `echo '${sqlB64}' | base64 -d > ${hostFile}`,
    `docker cp ${hostFile} ${CONTAINER}:${hostFile}`,
    `PASS=$(docker exec ${CONTAINER} grep '^SURREAL_PASS=' /workspace/.substrate-secrets | cut -d= -f2-)`,
    `docker exec ${CONTAINER} curl -s -u "root:$PASS" -H "surreal-ns: ${ns}" -H "surreal-db: ${db}" -H "Accept: application/json" http://127.0.0.1:8000/sql --data-binary @${hostFile}`,
    `docker exec ${CONTAINER} rm -f ${hostFile}`,
    `rm -f ${hostFile}`,
  ].join("\n");

  return new Promise((resolve, reject) => {
    const proc = spawn(
      "ssh",
      [
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=8",
        // Pin-on-first-contact rather than requiring a pre-seeded
        // known_hosts: BatchMode disables the interactive prompt entirely, so
        // the default `StrictHostKeyChecking=ask` would just fail closed on
        // whichever container boots first against a fresh /root/.ssh. The
        // host is a fixed, operator-controlled box (`syzygy.host`), not one a
        // caller supplies — TOFU is the same trust model an operator typing
        // "yes" once would have given it by hand.
        "-o", "StrictHostKeyChecking=accept-new",
        `${SSH_USER}@${SSH_HOST}`,
        "bash", "-s",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    // Measured directly against this hub: a COLD full scan (no previous
    // snapshot, so every one of its 99 tables gets a real row count, not a
    // carried-forward one) took ~51s for the query alone, before SSH
    // connection setup and the docker-cp round trip. 60s left that with
    // almost no margin — one boot-scan attempt timed out at exactly the cap
    // while the very next periodic tick, same query, landed in time; that is
    // a coin flip, not a working feature. Steady-state ticks (row counts
    // carried forward once a table is known large — see scan.ts) finish in a
    // couple of seconds and will never come close to this ceiling regardless
    // of how generous it is.
    const SSH_TIMEOUT_MS = 180_000;
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`schema-watch: SSH query timed out after ${SSH_TIMEOUT_MS / 1000}s`));
    }, SSH_TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`schema-watch: ssh exited ${code}: ${stderr.slice(0, 800)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as SurrealStatementResult[];
        resolve(parsed);
      } catch (err) {
        reject(
          new Error(
            `schema-watch: could not parse SurrealDB response as JSON: ${(err as Error).message}. stdout(0..500)=${stdout.slice(0, 500)}`,
          ),
        );
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.stdin.write(remoteScript);
    proc.stdin.end();
  });
}
