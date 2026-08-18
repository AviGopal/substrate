#!/usr/bin/env bun
// seed-identity.ts — mint the first org + API key on a fresh substrate.
// Safe to re-run: exits silently if the substrate org already exists.
//
// Usage: bun run /vessels/seed-identity.ts
//   Requires METABOB_API_KEY, JWT_SECRET env vars (set via EnvironmentFile).

import { writeFileSync, readFileSync, existsSync } from "node:fs";

const IDENTITY_URL = process.env.IDENTITY_VESSEL_URL ?? "http://127.0.0.1:8101";
// Fallback authed route for key validation when identity exposes no /v1/keys/validate.
const DISCOVERY_URL = process.env.DISCOVERY_VESSEL_ENDPOINT ?? "http://127.0.0.1:8100";
const SEED_KEY = process.env.METABOB_API_KEY ?? "";
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const SECRETS_FILE = "/workspace/.substrate-secrets";

if (!SEED_KEY || !JWT_SECRET) {
  console.error("[seed-identity] METABOB_API_KEY and JWT_SECRET must be set");
  process.exit(1);
}

// Replace an existing `KEY=...` line or append it if absent. Used for keys that
// are not present in the base env template (e.g. the admin key).
function upsertEnvVar(path: string, key: string, value: string): void {
  let content = "";
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return; // file absent (e.g. .substrate-secrets not yet created) — skip
  }
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  const updated = re.test(content)
    ? content.replace(re, line)
    : content.replace(/\n?$/, `\n${line}\n`);
  writeFileSync(path, updated, { mode: 0o600 });
}

async function waitForIdentity(maxMs = 30_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${IDENTITY_URL}/health`);
      if (r.ok) return;
    } catch {}
    await Bun.sleep(1_000);
  }
  throw new Error(`identity-vessel not ready after ${maxMs}ms`);
}

async function issueKey(
  token: string,
  user_id: string,
  org_id: string,
  name: string,
  scopes: string[] = ["read", "write"],
): Promise<string> {
  const issueRes = await fetch(`${IDENTITY_URL}/v1/keys/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id, org_id, scopes, name }),
  });

  if (!issueRes.ok) {
    const body = await issueRes.text();
    throw new Error(`key issue failed for '${name}' ${issueRes.status}: ${body}`);
  }

  const body = await issueRes.json() as { key?: string; data?: { key: string } };
  const key = body.key ?? body.data?.key;
  if (!key) throw new Error(`key issue for '${name}': unexpected response shape: ${JSON.stringify(body)}`);
  return key;
}

/** The key the fleet is actually carrying, read from the file vessels are started with. */
function currentFleetKey(): string | null {
  try {
    const m = readFileSync("/etc/substrate/env", "utf-8").match(/^METABOB_API_KEY=(.*)$/m);
    const v = m?.[1]?.trim().replace(/^"|"$/g, "");
    return v && v.length > 0 ? v : null;
  } catch { return null; }
}

/**
 * Does identity ACCEPT this key right now?
 *
 * This is the check whose absence caused the outage: the caller compared the key to its
 * previous value and concluded "unchanged — no restarts needed", which was true while the key
 * was being rejected by every vessel. Comparing a value to its own history cannot detect a
 * signing secret rotating underneath it. Ask the authority instead.
 *
 * A transport failure returns FALSE — i.e. "assume it does not work". The opposite default
 * would let an unreachable identity-vessel look like a passing check, which is how an
 * instrument that cannot fail gets trusted.
 */
async function keyAuthenticates(key: string): Promise<boolean> {
  try {
    const r = await fetch(`${IDENTITY_URL}/v1/keys/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key }),
      signal: AbortSignal.timeout(8_000),
    });
    if (r.status === 404) {
      // No validate endpoint on this build — fall back to exercising a real authed route.
      const probe = await fetch(`${DISCOVERY_URL}/registry/vessels`, {
        headers: { Authorization: `ApiKey ${key}` },
        signal: AbortSignal.timeout(8_000),
      });
      return probe.ok;
    }
    return r.ok;
  } catch { return false; }
}

/** Persist an issued key to both files vessels read, so a restart picks it up. */
function writeFleetKey(key: string): void {
  for (const f of ["/etc/substrate/env", SECRETS_FILE]) {
    try {
      if (!existsSync(f)) continue;
      const c = readFileSync(f, "utf-8");
      writeFileSync(
        f,
        /^METABOB_API_KEY=/m.test(c) ? c.replace(/^METABOB_API_KEY=.*/m, `METABOB_API_KEY=${key}`) : `${c}\nMETABOB_API_KEY=${key}\n`,
        { mode: 0o600 },
      );
    } catch (e) {
      console.warn(`[seed-identity] could not update ${f}: ${(e as Error).message}`);
    }
  }
}

async function main() {
  await waitForIdentity();

  // Attempt signup — creates org + user + returns JWT
  const signupRes = await fetch(`${IDENTITY_URL}/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "substrate@substrate.local",
      password: SEED_KEY,
      org_name: "substrate",
    }),
  });

  // A 409 MEANS THE ORG SURVIVED, NOT THAT THE KEYS DID — and this used to `return`.
  //
  // Measured 2026-08-18. `make recreate` keeps the named volumes, so identity's org row
  // persists and signup answers 409 on every boot after the first. The old code returned
  // there, having issued NO key. Whatever value gen-env had just written into
  // /etc/substrate/env was therefore never minted through identity, and every vessel came up
  // holding a credential nothing would accept:
  //
  //     [DiscoveryRegistrationLoop] heartbeat HTTP 401 (failure #1)
  //     GET /registry/vessels -> 401     registry: 0 vessels, 0 shapes
  //
  // The whole fleet ran healthy, bound, and unable to register — for the same reason on
  // every vessel at once.
  //
  // ★ THE RECOVERY PATH ONLY RAN IN THE STATE THAT DID NOT NEED IT. Keys were minted only
  //   on genuine first boot (signup 200); the moment an org existed, the seeder stopped
  //   being able to repair anything. And because API_KEY_SECRET_PREVIOUS is empty, a rotated
  //   signing secret leaves no grace window — old keys do not merely age out, they are
  //   invalid immediately, and nothing was left that could mint new ones.
  //
  // ★ "UNCHANGED" IS NOT "VALID". The caller logs `key unchanged — no restarts needed`,
  //   which is true and useless: the key had not changed and had also never worked. A check
  //   that compares a value to its previous self cannot see a secret rotating underneath it.
  //
  // So on 409: log in with the same seed credential, verify the key the fleet is actually
  // carrying, and re-issue only if it does not authenticate. Re-issuing unconditionally
  // would rotate a working key on every boot and invalidate every consumer that cached it.
  if (signupRes.status === 409) {
    console.log("[seed-identity] substrate org already exists — verifying the fleet's key still authenticates");
    const existing = currentFleetKey();
    if (existing && await keyAuthenticates(existing)) {
      console.log("[seed-identity] existing key authenticates — nothing to re-issue");
      return;
    }
    console.log(
      existing
        ? "[seed-identity] existing key is REJECTED by identity — re-issuing (secret rotated or key never minted)"
        : "[seed-identity] no key found in env — issuing",
    );
    const loginRes = await fetch(`${IDENTITY_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "substrate@substrate.local", password: SEED_KEY }),
    });
    if (!loginRes.ok) {
      throw new Error(`login failed ${loginRes.status}: ${await loginRes.text()} — org exists but the seed credential no longer opens it; the keyspace needs manual recovery`);
    }
    const { token, user_id, org_id } = await loginRes.json() as { token: string; user_id: string; org_id: string };
    const reissued = await issueKey(token, user_id, org_id, "substrate-default");
    writeFleetKey(reissued);
    console.log("[seed-identity] re-issued substrate-default and wrote it to env + secrets — key consumers must restart");
    return;
  }

  if (!signupRes.ok) {
    const body = await signupRes.text();
    throw new Error(`signup failed ${signupRes.status}: ${body}`);
  }

  const { token, user_id, org_id } = await signupRes.json() as {
    token: string;
    user_id: string;
    org_id: string;
  };

  console.log(`[seed-identity] org created: ${org_id}, user: ${user_id}`);

  // Issue the shared substrate default key
  const defaultKey = await issueKey(token, user_id, org_id, "substrate-default");
  console.log(`[seed-identity] issued API key (substrate-default): ${defaultKey}`);

  // Write the issued key back to .substrate-secrets and /etc/substrate/env
  // so configure-local.sh and subsequent vessel restarts use the proper HMAC key.
  try {
    const envContent = readFileSync("/etc/substrate/env", "utf-8");
    const updatedEnv = envContent.replace(
      /^METABOB_API_KEY=.*/m,
      `METABOB_API_KEY=${defaultKey}`,
    );
    writeFileSync("/etc/substrate/env", updatedEnv, { mode: 0o600 });

    if (existsSync(SECRETS_FILE)) {
      const secretsContent = readFileSync(SECRETS_FILE, "utf-8");
      const updatedSecrets = secretsContent.replace(
        /^METABOB_API_KEY=.*/m,
        `METABOB_API_KEY=${defaultKey}`,
      );
      writeFileSync(SECRETS_FILE, updatedSecrets, { mode: 0o600 });
    }
    console.log("[seed-identity] updated METABOB_API_KEY in /etc/substrate/env and .substrate-secrets");
  } catch (e) {
    console.warn(`[seed-identity] could not update env file: ${(e as Error).message}`);
    console.warn(`[seed-identity] manually set METABOB_API_KEY=${defaultKey}`);
  }

  // Issue the substrate self-admin key — the mint credential for managing this
  // keyspace (issue/revoke/list, create orgs). Unlike the read/write keys above,
  // it carries the 'admin' scope so it satisfies the admin-only key endpoints
  // directly. Persist it under SUBSTRATE_ADMIN_KEY so operators (and the keyctl
  // CLI) can retrieve it as the keyspace's bootstrap credential.
  const adminKey = await issueKey(token, user_id, org_id, "substrate-admin", ["read", "write", "admin"]);
  upsertEnvVar("/etc/substrate/env", "SUBSTRATE_ADMIN_KEY", adminKey);
  upsertEnvVar(SECRETS_FILE, "SUBSTRATE_ADMIN_KEY", adminKey);
  console.log(`[seed-identity] issued self-admin key (substrate-admin): ${adminKey}`);
  console.log("[seed-identity] set SUBSTRATE_ADMIN_KEY in /etc/substrate/env and .substrate-secrets");

  // Issue a dedicated key for local-tools-vessel (per D4 — per-vessel trace attribution)
  const localToolsKey = await issueKey(token, user_id, org_id, "local-tools-vessel");
  console.log(`[seed-identity] issued API key (local-tools-vessel): ${localToolsKey}`);
  console.log("[seed-identity] set LOCAL_TOOLS_VESSEL_API_KEY in /etc/substrate/env or vessel env file");

  // Issue a dedicated key for goal-host-vessel (per D4 — per-vessel trace attribution)
  const goalHostKey = await issueKey(token, user_id, org_id, "goal-host-vessel");
  console.log(`[seed-identity] issued API key (goal-host-vessel): ${goalHostKey}`);
  console.log("[seed-identity] set GOAL_HOST_VESSEL_API_KEY in /etc/substrate/env or vessel env file");

  // Issue a dedicated key for concept-db (semantic layer)
  const conceptDbKey = await issueKey(token, user_id, org_id, "concept-db");
  console.log(`[seed-identity] issued API key (concept-db): ${conceptDbKey}`);
  console.log("[seed-identity] set CONCEPT_DB_API_KEY in /etc/substrate/env or concept-db.env");
}

main().catch(e => {
  console.error("[seed-identity]", e);
  process.exit(1);
});
