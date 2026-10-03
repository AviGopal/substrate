// seed-identity never prints key material: every key it issues is named in its output by
// a fingerprint, never by value.
//
// The seeder runs as a unit, so its stdout/stderr is the journal. It used to print the
// fleet key verbatim on every genuine first boot ("issued API key (substrate-default):
// <key>") and again on the env-write failure path ("manually set METABOB_API_KEY=<key>").
//
// Two layers:
//   1. the message builders, in-process: the value is absent, the fingerprint present;
//   2. a fixture RUN of the real script against a fake identity (IDENTITY_VESSEL_URL),
//      on both seeding paths (first boot: signup 200; warm: signup 409 + login), with
//      stdout+stderr captured. Every distinct fake key the fixture issued must be absent
//      from the output, and each one's fingerprint must be present (so an output that
//      merely printed nothing cannot pass).
//
// The script writes /etc/substrate/env, /etc/substrate/private/* and the persisted store
// by absolute path. Run where none of those exist, every write is a no-op (its reads fail
// first); where they exist this test refuses to run the script rather than touch a live
// substrate's secrets.
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "../../scripts/substrate/seed-identity.ts");

// Imported, the module only defines (import.meta.main guards main()).
const { keyFingerprint, describeIssuedKey } = await import(SCRIPT);

const FAKE = (n: string) => `mb-fixturekey${n}-${"s3cr3t".repeat(6)}${n}`;

describe("message builders", () => {
  test("describeIssuedKey names the key by fingerprint, never value", () => {
    const k = FAKE("unit");
    const line = describeIssuedKey("substrate-default", { key: k, keyId: "kid-unit" });
    expect(line).not.toContain(k);
    expect(line).toContain(keyFingerprint(k));
    expect(line).toContain("key_id=kid-unit");
  });
  test("the fingerprint is short, stable and not a substring of the key", () => {
    const k = FAKE("fp");
    expect(keyFingerprint(k)).toBe(keyFingerprint(k));
    expect(keyFingerprint(k)).toMatch(/^sha256:[0-9a-f]{12}$/);
    expect(k).not.toContain(keyFingerprint(k).slice("sha256:".length));
  });
});

const live = ["/etc/substrate/env", "/etc/substrate/private", "/workspace/.substrate-private", "/workspace/.substrate-secrets"]
  .filter((p) => existsSync(p));

async function runSeeder(signupStatus: 200 | 409): Promise<{ out: string; issued: string[]; exit: number }> {
  const issued: string[] = [];
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
        const k = FAKE(String(++n));
        issued.push(k);
        return json({ success: true, data: { key: k, key_id: `kid-${n}` } });
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
      stdout: "pipe",
      stderr: "pipe",
    });
    const [o, e] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    const exit = await p.exited;
    return { out: o + e, issued, exit };
  } finally {
    server.stop(true);
  }
}

describe("fixture run of the seeder", () => {
  test("the host carries no live substrate files the run could write", () => {
    expect(live).toEqual([]);
  });

  for (const status of [200, 409] as const) {
    test(`signup ${status}: no issued key value in the output; every fingerprint present`, async () => {
      if (live.length > 0) throw new Error(`refusing to run the seeder here: ${live.join(", ")} exist`);
      const { out, issued, exit } = await runSeeder(status);
      expect(exit).toBe(0);
      // Non-vacuity: the run really issued keys (first boot: default, admin, 3 per-vessel).
      expect(issued.length).toBeGreaterThanOrEqual(status === 200 ? 5 : 1);
      for (const k of issued) {
        expect(out.includes(k)).toBe(false);
        expect(out).toContain(keyFingerprint(k));
      }
      expect(out).not.toContain("bootstrap-seed-credential-fixture");
      expect(out).not.toContain("jwt-secret-fixture");
    });
  }
});
