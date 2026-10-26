// seed-identity-fleet-key-scopes.test.ts: the fleet key (substrate-default) carries db:admin and templates:admin,
// activity-api's handler gates on db_admin / fts-rebuild and template retire/promote, whose callers send that key.
//
// Two paths. A seed that MINTS the fleet key asks identity for FLEET_KEY_SCOPES (first boot, and the warm re-issue of
// a rejected key). An already-seeded node keeps its [read, write] fleet key, so ensureFleetKeyAdminScopes adds the
// missing scopes to that SAME key, by key_id, through identity's apiKey_write impulse. The spawn harness cannot reach
// that second path (the warm path with a healthy key reads the live rendered env, which the guard refuses to run
// against), so the exported step is driven directly against a fake identity, as its sibling's export allows.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "../../scripts/substrate/seed-identity.ts");
const live = ["/etc/substrate/env", "/etc/substrate/private", "/workspace/.substrate-private", "/workspace/.substrate-secrets"]
  .filter((p) => existsSync(p));
const guard = () => { if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`); };

const FLEET_KEY = `mb-fleetfixture-${"f".repeat(32)}`;
const ADMIN_KEY = `mb-adminfixture-${"a".repeat(32)}`;

interface Fake {
  keys: Map<string, { key_id: string; scopes: string[] }>;
  grants: Array<{ auth: string; body: string }>;
  issued: Map<string, string[]>;
  /** 'serve' applies apiKey_write; 'narrow' refuses these scopes like an identity whose allowlist predates them; 'absent' predates apiKey_write. */
  door: "serve" | "narrow" | "absent";
  signup: 200 | 409;
}

function fake(fleetScopes: string[], door: Fake["door"] = "serve", signup: Fake["signup"] = 409): Fake {
  const keys = new Map<string, { key_id: string; scopes: string[] }>();
  keys.set(FLEET_KEY, { key_id: "kid-fleet", scopes: [...fleetScopes] });
  keys.set(ADMIN_KEY, { key_id: "kid-admin", scopes: ["read", "write", "admin"] });
  return { keys, grants: [], issued: new Map(), door, signup };
}

function serve(f: Fake) {
  let n = 0;
  return Bun.serve({
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
      if (u.pathname === "/health") return json({ ok: true });
      if (u.pathname === "/v1/auth/signup") {
        return f.signup === 409 ? json({ error: "exists" }, 409) : json({ token: "jwt-fixture", user_id: "users:fx", org_id: "organizations:fx" });
      }
      if (u.pathname === "/v1/auth/login") return json({ token: "jwt-fixture", user_id: "users:fx", org_id: "organizations:fx" });
      if (u.pathname === "/v1/keys/issue") {
        const b = (await req.json()) as { name?: string; scopes?: string[] };
        n++;
        const key = `mb-fixturekey${n}-${"x".repeat(32)}`;
        const scopes = Array.isArray(b.scopes) ? b.scopes : ["read", "write"];
        f.issued.set(String(b.name), scopes);
        f.keys.set(key, { key_id: `kid-${n}`, scopes: [...scopes] });
        return json({ success: true, data: { key, key_id: `kid-${n}` } });
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
        if (f.door === "narrow") return json({ success: false, error: { code: "SCOPE_NOT_GRANTABLE", message: "not grantable" } }, 403);
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
}

// ---- the exported step, driven directly ----
// IDENTITY_URL is read when the module loads, so the fake identity is up and named first, and the module is
// imported once, after it. Each test swaps the fake's state rather than the server.
let current: Fake = fake(["read", "write"]);
const proxy = {} as Fake;
let server: ReturnType<typeof Bun.serve>;
let mod: typeof import("../../scripts/substrate/seed-identity.ts");
const savedUrl = process.env.IDENTITY_VESSEL_URL;
const savedAdmin = process.env.SUBSTRATE_ADMIN_KEY;

beforeAll(async () => {
  for (const k of ["keys", "grants", "issued", "door", "signup"] as const) {
    Object.defineProperty(proxy, k, { get: () => current[k] });
  }
  server = serve(proxy);
  process.env.IDENTITY_VESSEL_URL = `http://127.0.0.1:${server.port}`;
  mod = await import("../../scripts/substrate/seed-identity.ts");
});
afterAll(() => {
  server.stop(true);
  if (savedUrl === undefined) delete process.env.IDENTITY_VESSEL_URL; else process.env.IDENTITY_VESSEL_URL = savedUrl;
  if (savedAdmin === undefined) delete process.env.SUBSTRATE_ADMIN_KEY; else process.env.SUBSTRATE_ADMIN_KEY = savedAdmin;
});

async function run(admin = ADMIN_KEY): Promise<string> {
  return runWith(FLEET_KEY, admin);
}
async function runWith(fleetKey: string, admin = ADMIN_KEY): Promise<string> {
  process.env.SUBSTRATE_ADMIN_KEY = admin;
  const lines: string[] = [];
  const [log, warn] = [console.log, console.warn];
  console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
  console.warn = (...a: unknown[]) => { lines.push(a.join(" ")); };
  try { await mod.ensureFleetKeyAdminScopes(fleetKey); } finally { console.log = log; console.warn = warn; }
  return lines.join("\n");
}

describe("the fleet key carries db:admin and templates:admin", () => {
  test("MUST-FAIL: FLEET_KEY_SCOPES is read, write, db:admin, templates:admin and never admin or tools-exec", () => {
    expect(mod.FLEET_KEY_SCOPES).toEqual(["read", "write", "db:admin", "templates:admin"]);
    expect(mod.FLEET_KEY_SCOPES).not.toContain("admin");
    expect(mod.FLEET_KEY_SCOPES).not.toContain("tools-exec");
  });

  test("MUST-FAIL: an already-seeded [read, write] fleet key gets exactly one apiKey_write, as the admin, by key_id, same key", async () => {
    current = fake(["read", "write"]);
    const out = await run();
    expect(current.grants).toHaveLength(1);
    expect(current.grants[0].auth).toBe(`ApiKey ${ADMIN_KEY}`);
    expect(JSON.parse(current.grants[0].body)).toEqual({
      impulse: { pointer: { type: "apiKey_write", key_id: "kid-fleet", add_scopes: ["db:admin", "templates:admin"] } },
    });
    expect(current.keys.get(FLEET_KEY)).toEqual({ key_id: "kid-fleet", scopes: ["read", "write", "db:admin", "templates:admin"] });
    expect(out).toContain("granted db:admin, templates:admin to key_id=kid-fleet");
  });

  test("only the missing scope is asked for, and a second run makes no call", async () => {
    current = fake(["read", "write", "db:admin"]);
    await run();
    expect(current.grants).toHaveLength(1);
    expect(JSON.parse(current.grants[0].body).impulse.pointer.add_scopes).toEqual(["templates:admin"]);
    const out = await run();
    expect(current.grants).toHaveLength(1);
    expect(out).toContain("key_id=kid-fleet already carries db:admin, templates:admin");
  });

  test("an identity whose allowlist predates these scopes: one logged skip by name, nothing thrown", async () => {
    current = fake(["read", "write"], "narrow");
    const out = await run();
    expect(current.grants).toHaveLength(1);
    expect(out).toContain("refused for key_id=kid-fleet: 403 SCOPE_NOT_GRANTABLE, identity's allowlist does not admit that scope (retried next boot)");
    expect(current.keys.get(FLEET_KEY)!.scopes).toEqual(["read", "write"]);
  });

  test("an identity that predates apiKey_write: one logged skip, nothing thrown", async () => {
    current = fake(["read", "write"], "absent");
    const out = await run();
    expect(out).toContain("identity does not serve apiKey_write yet (400 RESOLVE_FAILED");
  });

  test("no admin key this boot: a logged skip, no call", async () => {
    current = fake(["read", "write"]);
    const out = await run("");
    expect(current.grants).toHaveLength(0);
    expect(out).toContain("SUBSTRATE_ADMIN_KEY empty this boot");
  });

  // A rotation gives the fleet key a new NAME (substrate-default-r2, -r3, ...) and, when it is a re-mint, a new value
  // and key_id with the default [read, write]. The step never uses the name: it is handed the value the fleet is
  // carrying (main() passes currentFleetKey(), the rendered env's METABOB_API_KEY) and grants by the key_id identity
  // answers for THAT value. A re-mint under the new name is driven here, twice; a rename in place keeps the value and key_id, so it is the
  // already-covered unrotated case.
  test("MUST-FAIL: after a rotation to substrate-default-r2, and again to -r3, the CURRENT fleet key gains both scopes", async () => {
    current = fake(["read", "write"]);
    const oldRow = current.keys.get(FLEET_KEY)!;
    await run();
    expect(oldRow.scopes).toEqual(["read", "write", "db:admin", "templates:admin"]);

    // Rotation 1 (re-mint): a NEW key named substrate-default-r2, [read, write]; the env now carries its value.
    const r2 = `mb-fleetfixture-r2-${"2".repeat(32)}`;
    current.keys.set(r2, { key_id: "kid-fleet-r2", scopes: ["read", "write"] });
    await runWith(r2);
    expect(current.keys.get(r2)).toEqual({ key_id: "kid-fleet-r2", scopes: ["read", "write", "db:admin", "templates:admin"] });
    const g2 = JSON.parse(current.grants.at(-1)!.body).impulse.pointer;
    expect(g2).toEqual({ type: "apiKey_write", key_id: "kid-fleet-r2", add_scopes: ["db:admin", "templates:admin"] });
    expect(JSON.stringify(g2)).not.toContain("substrate-default");

    // Rotation 2 (re-mint again): substrate-default-r3.
    const r3 = `mb-fleetfixture-r3-${"3".repeat(32)}`;
    current.keys.set(r3, { key_id: "kid-fleet-r3", scopes: ["read", "write"] });
    await runWith(r3);
    expect(current.keys.get(r3)!.scopes).toEqual(["read", "write", "db:admin", "templates:admin"]);
    expect(JSON.parse(current.grants.at(-1)!.body).impulse.pointer.key_id).toBe("kid-fleet-r3");
    expect(current.grants).toHaveLength(3);
  });

  test("no key value reaches the log", async () => {
    for (const door of ["serve", "narrow", "absent"] as const) {
      current = fake(["read", "write"], door);
      const out = await run();
      expect(out.length).toBeGreaterThan(0);
      for (const k of [FLEET_KEY, ADMIN_KEY]) expect(out).not.toContain(k);
    }
  });
});

// ---- the minting paths, as a RUN of the real script ----
async function boot(f: Fake): Promise<number> {
  const s = serve(f);
  try {
    const p = Bun.spawn([process.execPath, SCRIPT], {
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "/tmp",
        IDENTITY_VESSEL_URL: `http://127.0.0.1:${s.port}`,
        METABOB_API_KEY: "bootstrap-seed-credential-fixture",
        JWT_SECRET: "jwt-secret-fixture",
        SUBSTRATE_ADMIN_KEY: ADMIN_KEY,
      },
      stdout: "ignore",
      stderr: "ignore",
    });
    return await p.exited;
  } finally {
    s.stop(true);
  }
}

describe("a seed that mints the fleet key asks for FLEET_KEY_SCOPES", () => {
  test("the host carries no live substrate files the run could write", () => {
    expect(live).toEqual([]);
  });

  for (const signup of [200, 409] as const) {
    test(`MUST-FAIL: signup ${signup} mints substrate-default with db:admin and templates:admin, and the step then makes no call`, async () => {
      guard();
      const f = fake(["read", "write"], "serve", signup);
      expect(await boot(f)).toBe(0);
      expect(f.issued.get("substrate-default")).toEqual(["read", "write", "db:admin", "templates:admin"]);
      // Only the fleet key gains them: no other minted key carries either scope.
      for (const [name, scopes] of f.issued) {
        if (name === "substrate-default") continue;
        expect(scopes).not.toContain("db:admin");
        expect(scopes).not.toContain("templates:admin");
      }
      const fleetGrants = f.grants.filter((g) => g.body.includes("db:admin") || g.body.includes("templates:admin"));
      expect(fleetGrants).toHaveLength(0);
    });
  }
});
