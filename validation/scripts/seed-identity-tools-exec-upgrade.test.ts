// seed-identity-tools-exec-upgrade.test.ts: on a warm boot the seeder grants tools-exec to goal-host's EXISTING key,
// once, by key_id, through identity's apiKey_write impulse; the fleet key never gains it.
//
// A node seeded before GOAL_HOST_KEY_SCOPES carried tools-exec keeps a [read, write] goal-host key, and the daemon's
// tool gate refuses the walk's tool hops from it. The fresh-mint
// side is seed-identity-tools-exec.test.ts; this is the upgrade. Same harness: a RUN of the real script against a
// fake identity (IDENTITY_VESSEL_URL) that keeps key rows by value, answers /v1/keys/validate from them, and applies
// apiKey_write impulses on /v1/auth/resolve, recording every one. The warm path is signup 409 (no live env here, so
// the fleet key is re-issued, then the ensure* steps run). Like its siblings, the run refuses where live substrate
// files exist, so it cannot write them.
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "../../scripts/substrate/seed-identity.ts");
const live = ["/etc/substrate/env", "/etc/substrate/private", "/workspace/.substrate-private", "/workspace/.substrate-secrets"]
  .filter((p) => existsSync(p));

const GOAL_HOST_KEY = `mb-goalhostfixture-${"g".repeat(32)}`;
const ADMIN_KEY = `mb-adminfixture-${"a".repeat(32)}`;

interface Grant { auth: string; body: string }
interface FakeIdentity {
  keys: Map<string, { key_id: string; scopes: string[] }>;
  grants: Grant[];
  fleetKeys: string[];
  /** 'serve' applies apiKey_write; 'absent' answers like an identity that predates it; 'norow' like one without the key's row. */
  door: "serve" | "absent" | "norow";
  /** When set, the re-issued fleet key gets this key_id (the shared-key case). */
  fleetKeyId?: string;
}

function fake(goalHost: { key_id: string; scopes: string[] }, door: FakeIdentity["door"] = "serve"): FakeIdentity {
  const keys = new Map<string, { key_id: string; scopes: string[] }>();
  keys.set(GOAL_HOST_KEY, { ...goalHost, scopes: [...goalHost.scopes] });
  keys.set(ADMIN_KEY, { key_id: "kid-admin", scopes: ["read", "write", "admin"] });
  return { keys, grants: [], fleetKeys: [], door };
}

async function boot(f: FakeIdentity, env: Record<string, string> = {}): Promise<{ exit: number; out: string }> {
  let n = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
      if (u.pathname === "/health") return json({ ok: true });
      if (u.pathname === "/v1/auth/signup") return json({ error: "exists" }, 409);
      if (u.pathname === "/v1/auth/login") return json({ token: "jwt-fixture", user_id: "users:fx", org_id: "organizations:fx" });
      if (u.pathname === "/v1/keys/issue") {
        const b = (await req.json()) as { name?: string; scopes?: string[] };
        n++;
        const key = `mb-fixturekey${n}-${"x".repeat(32)}`;
        const key_id = b.name === "substrate-default" && f.fleetKeyId ? f.fleetKeyId : `kid-${n}`;
        if (b.name === "substrate-default") f.fleetKeys.push(key);
        f.keys.set(key, { key_id, scopes: Array.isArray(b.scopes) ? b.scopes : ["read", "write"] });
        return json({ success: true, data: { key, key_id } });
      }
      if (u.pathname === "/v1/keys/validate") {
        const { api_key } = (await req.json()) as { api_key: string };
        const k = f.keys.get(api_key);
        return json({ success: true, data: k ? { valid: true, key_id: k.key_id, scopes: k.scopes, org_id: "organizations:fx", user_id: "users:fx" } : { valid: false } });
      }
      if (u.pathname === "/v1/auth/resolve") {
        const raw = await req.text();
        f.grants.push({ auth: req.headers.get("authorization") ?? "", body: raw });
        if (f.door === "absent") return json({ success: false, error: { code: "RESOLVE_FAILED", message: "invalid impulse" } }, 400);
        if (f.door === "norow") return json({ success: false, error: { code: "NOT_FOUND", message: "Key not found" } }, 404);
        const p = JSON.parse(raw)?.impulse?.pointer ?? {};
        const auth = (req.headers.get("authorization") ?? "").replace(/^ApiKey /, "");
        if (!f.keys.get(auth)?.scopes.includes("admin")) return json({ success: false, error: { code: "FORBIDDEN" } }, 403);
        const row = [...f.keys.values()].find((k) => k.key_id === p.key_id);
        if (p.type !== "apiKey_write" || !row) return json({ success: false, error: { code: "NOT_FOUND" } }, 404);
        const added = (p.add_scopes as string[]).filter((s) => !row.scopes.includes(s));
        row.scopes.push(...added);
        return json({ success: true, data: { key_id: p.key_id, scopes: row.scopes, added, changed: added.length > 0 } });
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
        GOAL_HOST_VESSEL_API_KEY: GOAL_HOST_KEY,
        SUBSTRATE_ADMIN_KEY: ADMIN_KEY,
        ...env,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    return { exit: await p.exited, out: out + err };
  } finally {
    server.stop(true);
  }
}

const guard = () => { if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`); };
const toolsExecLines = (out: string) => out.split("\n").filter((l) => l.includes("goal-host tools-exec"));

describe("warm boot: goal-host's existing key gains tools-exec, once, with no rotation", () => {
  test("the host carries no live substrate files the run could write", () => {
    expect(live).toEqual([]);
  });

  test("MUST-FAIL: a distinct goal-host key without tools-exec gets exactly one apiKey_write, as the admin, by key_id", async () => {
    guard();
    const f = fake({ key_id: "kid-gh", scopes: ["read", "write"] });
    const { exit, out } = await boot(f);
    expect(exit).toBe(0);
    expect(f.grants).toHaveLength(1);
    expect(f.grants[0].auth).toBe(`ApiKey ${ADMIN_KEY}`);
    expect(JSON.parse(f.grants[0].body)).toEqual({ impulse: { pointer: { type: "apiKey_write", key_id: "kid-gh", add_scopes: ["tools-exec"] } } });
    // The grant is the same key: its value still validates, now with the scope.
    expect(f.keys.get(GOAL_HOST_KEY)).toEqual({ key_id: "kid-gh", scopes: ["read", "write", "tools-exec"] });
    expect(toolsExecLines(out).join("\n")).toContain("granted to key_id=kid-gh");
  });

  test("a second boot makes no call", async () => {
    guard();
    const f = fake({ key_id: "kid-gh", scopes: ["read", "write"] });
    await boot(f);
    const { exit, out } = await boot(f);
    expect(exit).toBe(0);
    expect(f.grants).toHaveLength(1);
    expect(toolsExecLines(out).join("\n")).toContain("key_id=kid-gh already carries it");
  });

  test("goal-host's key being the fleet key (same key_id) makes no call: node-self covers it", async () => {
    guard();
    const f = fake({ key_id: "kid-shared", scopes: ["read", "write"] });
    f.fleetKeyId = "kid-shared";
    const { exit, out } = await boot(f);
    expect(exit).toBe(0);
    expect(f.grants).toHaveLength(0);
    expect(toolsExecLines(out).join("\n")).toContain("node-self covers it");
  });

  test("the fleet key is never sent to the write and never gains tools-exec", async () => {
    guard();
    const f = fake({ key_id: "kid-gh", scopes: ["read", "write"] });
    await boot(f);
    await boot(f);
    expect(f.fleetKeys.length).toBeGreaterThan(0);
    for (const fk of f.fleetKeys) {
      const row = f.keys.get(fk)!;
      expect(row.scopes).not.toContain("tools-exec");
      for (const g of f.grants) {
        expect(g.auth).not.toContain(fk);
        expect(g.body).not.toContain(fk);
        expect(g.body).not.toContain(`"${row.key_id}"`);
      }
    }
  });

  test("an identity that predates apiKey_write: one logged skip, the boot still exits 0", async () => {
    guard();
    const f = fake({ key_id: "kid-gh", scopes: ["read", "write"] }, "absent");
    const { exit, out } = await boot(f);
    expect(exit).toBe(0);
    expect(f.grants).toHaveLength(1);
    expect(toolsExecLines(out).join("\n")).toContain("identity does not serve apiKey_write yet (400 RESOLVE_FAILED");
  });

  test("identity's grant path refusing (NOT_FOUND) is logged by name, not read as an old identity; the boot exits 0", async () => {
    guard();
    const f = fake({ key_id: "kid-gh", scopes: ["read", "write"] }, "norow");
    const { exit, out } = await boot(f);
    expect(exit).toBe(0);
    expect(f.grants).toHaveLength(1);
    const l = toolsExecLines(out).join("\n");
    expect(l).toContain("refused for key_id=kid-gh: 404 NOT_FOUND, identity has no api_key row for that key_id");
    expect(l).not.toContain("does not serve apiKey_write");
  });

  test("no admin key this boot: a logged skip, no call", async () => {
    guard();
    const f = fake({ key_id: "kid-gh", scopes: ["read", "write"] });
    const { exit, out } = await boot(f, { SUBSTRATE_ADMIN_KEY: "", API_KEY_SECRET: "" });
    expect(exit).toBe(0);
    expect(f.grants).toHaveLength(0);
    expect(toolsExecLines(out).join("\n")).toContain("SUBSTRATE_ADMIN_KEY empty this boot");
  });

  test("no key value reaches the log on any of these paths", async () => {
    guard();
    for (const f of [fake({ key_id: "kid-gh", scopes: ["read", "write"] }), fake({ key_id: "kid-gh", scopes: ["read", "write"] }, "absent")]) {
      const { out } = await boot(f);
      expect(toolsExecLines(out).length).toBeGreaterThan(0);
      for (const k of [GOAL_HOST_KEY, ADMIN_KEY, ...f.fleetKeys, ...f.keys.keys()]) expect(out).not.toContain(k);
    }
  });
});
