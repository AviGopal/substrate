// seed-identity-tools-exec.test.ts: goal-host's per-vessel key is minted with tools-exec, and no other key is.
//
// The daemon admits its state-changing tool shapes (shell, fs_write, fs_edit, git_commit, code_*) only from node-self,
// admin or tools-exec. The walk is the ReAct floor that calls them with goal-host's key, so
// that key carries tools-exec; it still never carries admin. The fleet key is the node's own key (node-self at the
// daemon), so it does not; neither does any other per-vessel key, the admin key or the corpus runner's.
//
// Two layers: the exported scope constant, and a fixture RUN of the real script against a fake identity
// (IDENTITY_VESSEL_URL) that records the scopes of every /v1/keys/issue request by key name, on both seeding paths
// (first boot: signup 200; warm with a rejected fleet key: signup 409 + login + re-issue). Like
// seed-identity-key-logging.test.ts, the run refuses where live substrate files exist, so it cannot write them.
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GOAL_HOST_KEY_SCOPES } from "../../scripts/substrate/seed-identity.ts";

const SCRIPT = join(import.meta.dir, "../../scripts/substrate/seed-identity.ts");
const live = ["/etc/substrate/env", "/etc/substrate/private", "/workspace/.substrate-private", "/workspace/.substrate-secrets"]
  .filter((p) => existsSync(p));

async function issuedScopes(signupStatus: 200 | 409): Promise<{ byName: Map<string, string[]>; exit: number }> {
  const byName = new Map<string, string[]>();
  let n = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
      if (u.pathname === "/health") return json({ ok: true });
      if (u.pathname === "/v1/auth/signup") {
        return signupStatus === 409 ? json({ error: "exists" }, 409) : json({ token: "jwt-fixture", user_id: "users:fx", org_id: "organizations:fx" });
      }
      if (u.pathname === "/v1/auth/login") return json({ token: "jwt-fixture", user_id: "users:fx", org_id: "organizations:fx" });
      if (u.pathname === "/v1/keys/issue") {
        const b = (await req.json()) as { name?: string; scopes?: string[] };
        // issueKey always sends its scopes; record what identity would store for this name.
        byName.set(String(b.name), Array.isArray(b.scopes) ? b.scopes : ["<absent>"]);
        n++;
        return json({ success: true, data: { key: `mb-fixturekey${n}-${"x".repeat(32)}`, key_id: `kid-${n}` } });
      }
      return json({ error: "not found" }, 404);
    },
  });
  try {
    const p = Bun.spawn([process.execPath, SCRIPT], {
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "/tmp",
        IDENTITY_VESSEL_URL: `http://127.0.0.1:${server.port}`,
        METABOB_API_KEY: "bootstrap-seed-credential-fixture",
        JWT_SECRET: "jwt-secret-fixture",
      },
      stdout: "ignore",
      stderr: "ignore",
    });
    return { byName, exit: await p.exited };
  } finally {
    server.stop(true);
  }
}

describe("goal-host's key carries tools-exec", () => {
  test("MUST-FAIL: GOAL_HOST_KEY_SCOPES is read, write, tools-exec and never admin", () => {
    expect(GOAL_HOST_KEY_SCOPES).toEqual(["read", "write", "tools-exec"]);
    expect(GOAL_HOST_KEY_SCOPES).not.toContain("admin");
  });

  test("the host carries no live substrate files the run could write", () => {
    expect(live).toEqual([]);
  });

  test("MUST-FAIL: a fresh seed mints goal-host-vessel with read, write, tools-exec and no admin", async () => {
    if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`);
    const { byName, exit } = await issuedScopes(200);
    expect(exit).toBe(0);
    expect(byName.get("goal-host-vessel")).toEqual(["read", "write", "tools-exec"]);
  });

  test("CONTROL: on a fresh seed no other key carries tools-exec (fleet, admin, corpus runner, other per-vessel keys)", async () => {
    if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`);
    const { byName } = await issuedScopes(200);
    // Non-vacuity: every key the first boot mints was observed.
    for (const name of ["substrate-default", "substrate-admin", "local-tools-vessel", "goal-host-corpus-runner", "concept-db"]) {
      expect(byName.has(name)).toBe(true);
      expect(byName.get(name)).not.toContain("tools-exec");
    }
    const others = [...byName.keys()].filter((k) => k !== "goal-host-vessel");
    for (const k of others) expect(byName.get(k)).not.toContain("tools-exec");
    expect(byName.get("substrate-default")).toEqual(["read", "write"]);
  });

  test("CONTROL: the warm-boot fleet re-issue does not carry tools-exec", async () => {
    if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`);
    const { byName, exit } = await issuedScopes(409);
    expect(exit).toBe(0);
    expect(byName.get("substrate-default")).toEqual(["read", "write"]);
    for (const s of byName.values()) expect(s).not.toContain("tools-exec");
  });
});
