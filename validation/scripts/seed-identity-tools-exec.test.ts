// seed-identity-tools-exec.test.ts: no key the seeder mints carries tools-exec, and it mints no key for a vessel the
// fleet no longer runs.
//
// The daemon admits its state-changing tool shapes (shell, fs_write, fs_edit, git_commit, code_*) only from node-self,
// admin or tools-exec. The fleet key is the node's own key (node-self at the daemon), so it needs no tools-exec, and no
// per-vessel key, the admin key included, is minted with it. A key minted for a vessel with no unit is a live credential
// nothing uses.
//
// A fixture RUN of the real script against a fake identity (IDENTITY_VESSEL_URL) that records the scopes of every
// /v1/keys/issue request by key name, on both seeding paths (first boot: signup 200; warm with a rejected fleet key:
// signup 409 + login + re-issue). Like seed-identity-key-logging.test.ts, the run refuses where live substrate files
// exist, so it cannot write them.
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

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

describe("the seeder's keys carry no tools-exec", () => {
  test("the host carries no live substrate files the run could write", () => {
    expect(live).toEqual([]);
  });

  test("MUST-FAIL: a fresh seed mints only the fleet's keys: none for goal-host-vessel or its corpus runner", async () => {
    if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`);
    const { byName, exit } = await issuedScopes(200);
    expect(exit).toBe(0);
    expect([...byName.keys()].sort()).toEqual(["concept-db", "local-tools-vessel", "substrate-admin", "substrate-default"]);
  });

  test("MUST-FAIL: on a fresh seed no key carries tools-exec (fleet, admin, per-vessel keys)", async () => {
    if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`);
    const { byName } = await issuedScopes(200);
    // Non-vacuity: every key the first boot mints was observed.
    for (const name of ["substrate-default", "substrate-admin", "local-tools-vessel", "concept-db"]) expect(byName.has(name)).toBe(true);
    for (const s of byName.values()) expect(s).not.toContain("tools-exec");
    expect(byName.get("substrate-default")).toEqual(["read", "write", "db:admin", "templates:admin"]);
  });

  test("CONTROL: the warm-boot fleet re-issue does not carry tools-exec", async () => {
    if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`);
    const { byName, exit } = await issuedScopes(409);
    expect(exit).toBe(0);
    expect(byName.get("substrate-default")).toEqual(["read", "write", "db:admin", "templates:admin"]);
    for (const s of byName.values()) expect(s).not.toContain("tools-exec");
  });
});
