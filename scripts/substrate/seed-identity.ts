#!/usr/bin/env bun
// seed-identity.ts — mint the first org + API key on a fresh substrate.
// Safe to re-run: exits silently if the substrate org already exists.
//
// Usage: bun run /vessels/seed-identity.ts
//   Requires METABOB_API_KEY, JWT_SECRET env vars (set via EnvironmentFile).

const IDENTITY_URL = process.env.IDENTITY_VESSEL_URL ?? "http://127.0.0.1:8101";
const SEED_KEY = process.env.METABOB_API_KEY ?? "";
const JWT_SECRET = process.env.JWT_SECRET ?? "";

if (!SEED_KEY || !JWT_SECRET) {
  console.error("[seed-identity] METABOB_API_KEY and JWT_SECRET must be set");
  process.exit(1);
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
): Promise<string> {
  const issueRes = await fetch(`${IDENTITY_URL}/v1/keys/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id, org_id, scopes: ["read", "write"], name }),
  });

  if (!issueRes.ok) {
    const body = await issueRes.text();
    throw new Error(`key issue failed for '${name}' ${issueRes.status}: ${body}`);
  }

  const { key } = await issueRes.json() as { key: string };
  return key;
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

  if (signupRes.status === 409) {
    console.log("[seed-identity] substrate org already exists — skipping");
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
  console.log("[seed-identity] write this key to /etc/substrate/env as METABOB_API_KEY on first run");

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
