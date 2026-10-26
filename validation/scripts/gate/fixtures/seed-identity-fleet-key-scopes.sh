#!/usr/bin/env bash
# kind: known-valid
# The candidate seed-identity.ts gives the fleet key db:admin and templates:admin, on the key the fleet carries. Run by
# shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. activity-api gates db_admin, fts-rebuild and template retire/promote on those two scopes, and their callers
# send the fleet key. A node seeded before FLEET_KEY_SCOPES carried them keeps a [read, write] fleet key, so every
# boot ensureFleetKeyAdminScopes adds the missing scopes to that SAME key, by key_id, through identity's apiKey_write
# impulse. identity-seeder runs the seeder from the baked /vessels copy, so this fixture is what lets it converge in
# place: a seeder change is judged by what the step asks identity for, not by whether it parses.
#
# HOW. The exported step is driven alone, as validation/scripts/seed-identity-fleet-key-scopes.test.ts drives it
# (that test also runs the minting paths, which refuse wherever live substrate files exist, so they are not run
# here). The candidate's seed-identity.ts is imported (it only defines when imported) after a fixture-owned fake
# identity is up on a random loopback port; identity and discovery are both pointed away from any live vessel
# first, and every key is a fixture value. Legs:
#   - FLEET_KEY_SCOPES is exactly read, write, db:admin, templates:admin (never admin, never tools-exec);
#   - a [read, write] fleet key: exactly one apiKey_write, as the admin key, by key_id, adding both scopes;
#   - a key holding db:admin: only templates:admin is asked for, and a second run makes no call;
#   - an identity whose allowlist refuses the scopes, and an empty admin key: a logged skip, nothing granted;
#   - a re-minted fleet key (a rotation): the grant follows the key the step is handed, by its own key_id;
#   - no key value reaches the log.
#
# NEEDS a bun that the shadow sandbox's nobody can execute. Without one this fails as "cannot judge", by design: a
# skip would read as a pass.
#
# SAFETY. Loopback only. The step reads and writes no file; the fake identity is the only thing it can reach.
set -uo pipefail
: "${CANDIDATE_DIR:?run by shadow-eval.sh}"
SI="$CANDIDATE_DIR/scripts/substrate/seed-identity.ts"
BUN="$(command -v bun || echo /usr/local/bin/bun)"
[ -f "$SI" ] || { echo "FAIL - the candidate has no scripts/substrate/seed-identity.ts"; exit 1; }
[ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] \
  || { echo "FAIL - cannot judge: no bun at $BUN (a skip would read as a pass)"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/fx-seed-identity.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
cp "$SI" "$W/seed-identity.ts"
cat > "$W/drive.ts" <<'TS'
// drive.ts: prints one "FAIL - <leg>" line per broken leg and "VERDICT pass|fail".
const FLEET = `mb-fleetfixture-${"f".repeat(32)}`, ADMIN = `mb-adminfixture-${"a".repeat(32)}`;
type Row = { key_id: string; scopes: string[] };
let keys = new Map<string, Row>(), grants: Array<{ auth: string; body: string }> = [], door: "serve" | "narrow" = "serve";
const reset = (fleetScopes: string[], d: typeof door = "serve") => {
  keys = new Map([[FLEET, { key_id: "kid-fleet", scopes: [...fleetScopes] }], [ADMIN, { key_id: "kid-admin", scopes: ["read", "write", "admin"] }]]);
  grants = []; door = d;
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
  const u = new URL(req.url);
  if (u.pathname === "/v1/keys/validate") {
    const k = keys.get(((await req.json()) as any).api_key);
    return json({ success: true, data: k ? { valid: true, key_id: k.key_id, scopes: k.scopes, org_id: "organizations:fx", user_id: "users:fx" } : { valid: false } });
  }
  if (u.pathname === "/v1/auth/resolve") {
    const raw = await req.text(), auth = req.headers.get("authorization") ?? "";
    grants.push({ auth, body: raw });
    if (door === "narrow") return json({ success: false, error: { code: "SCOPE_NOT_GRANTABLE" } }, 403);
    const p = JSON.parse(raw)?.impulse?.pointer ?? {};
    if (!keys.get(auth.replace(/^ApiKey /, ""))?.scopes.includes("admin")) return json({ success: false, error: { code: "FORBIDDEN" } }, 403);
    const row = [...keys.values()].find((k) => k.key_id === p.key_id);
    if (p.type !== "apiKey_write" || !row || !Array.isArray(p.add_scopes)) return json({ success: false, error: { code: "NOT_FOUND" } }, 404);
    const added = (p.add_scopes as string[]).filter((s) => !row.scopes.includes(s));
    row.scopes.push(...added);
    return json({ success: true, data: { key_id: p.key_id, scopes: row.scopes, added, changed: added.length > 0 } });
  }
  return json({ error: "not found" }, 404);
} });
process.env.IDENTITY_VESSEL_URL = `http://127.0.0.1:${server.port}`;
process.env.DISCOVERY_VESSEL_ENDPOINT = "http://discovery.invalid";
let failed = 0;
const leg = (name: string, ok: boolean) => { if (!ok) { failed++; console.log(`FAIL - ${name}`); } };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
try {
  const mod: any = await import("./seed-identity.ts");
  const run = async (fleetKey = FLEET, admin = ADMIN) => {
    process.env.SUBSTRATE_ADMIN_KEY = admin;
    const lines: string[] = [], [log, warn] = [console.log, console.warn];
    console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
    console.warn = (...a: unknown[]) => { lines.push(a.join(" ")); };
    try { await mod.ensureFleetKeyAdminScopes(fleetKey); } finally { console.log = log; console.warn = warn; }
    return lines.join("\n");
  };
  leg("FLEET_KEY_SCOPES is read, write, db:admin, templates:admin", same(mod.FLEET_KEY_SCOPES, ["read", "write", "db:admin", "templates:admin"]));
  if (typeof mod.ensureFleetKeyAdminScopes !== "function") throw new Error("the candidate exports no ensureFleetKeyAdminScopes");
  const logs: string[] = [];
  reset(["read", "write"]); logs.push(await run());
  leg("a [read, write] fleet key gets exactly one apiKey_write, as the admin, by key_id, adding both scopes",
    grants.length === 1 && grants[0].auth === `ApiKey ${ADMIN}`
    && same(JSON.parse(grants[0].body), { impulse: { pointer: { type: "apiKey_write", key_id: "kid-fleet", add_scopes: ["db:admin", "templates:admin"] } } })
    && same(keys.get(FLEET), { key_id: "kid-fleet", scopes: ["read", "write", "db:admin", "templates:admin"] }));
  reset(["read", "write", "db:admin"]); logs.push(await run());
  const once = grants.length === 1 && same(JSON.parse(grants[0]?.body ?? "{}")?.impulse?.pointer?.add_scopes, ["templates:admin"]);
  logs.push(await run());
  leg("only the missing scope is asked for, and a second run makes no call", once && grants.length === 1);
  reset(["read", "write"], "narrow"); logs.push(await run());
  leg("an identity that refuses the scopes: one call, nothing granted, nothing thrown", grants.length === 1 && same(keys.get(FLEET)!.scopes, ["read", "write"]));
  reset(["read", "write"]); logs.push(await run(FLEET, ""));
  leg("no admin key this boot: no call", grants.length === 0);
  reset(["read", "write"]);
  const r2 = `mb-fleetfixture-r2-${"2".repeat(32)}`;
  keys.set(r2, { key_id: "kid-fleet-r2", scopes: ["read", "write"] });
  logs.push(await run(r2));
  leg("a re-minted fleet key gains both scopes by its own key_id",
    grants.length === 1 && JSON.parse(grants[0].body)?.impulse?.pointer?.key_id === "kid-fleet-r2"
    && same(keys.get(r2)!.scopes, ["read", "write", "db:admin", "templates:admin"]) && same(keys.get(FLEET)!.scopes, ["read", "write"]));
  const all = logs.join("\n");
  leg("no key value reaches the log", all.length > 0 && ![FLEET, ADMIN, r2].some((k) => all.includes(k)));
} catch (e) {
  failed++; console.log(`FAIL - the step could not be driven: ${(e as Error).message}`);
}
server.stop(true);
console.log(`VERDICT ${failed === 0 ? "pass" : "fail"}`);
process.exit(failed === 0 ? 0 : 1);
TS
cd "$W" || { echo "FAIL - cd"; exit 1; }
timeout 120 "$BUN" "$W/drive.ts" > "$W/out" 2>&1; rc=$?
grep '^FAIL - ' "$W/out"
if [ "$rc" = 0 ] && grep -qx 'VERDICT pass' "$W/out"; then
  echo "ok - the fleet key gains db:admin and templates:admin, by key_id, on the key the step is handed"; exit 0
fi
grep -q '^FAIL - ' "$W/out" || { echo "FAIL - the driver exited $rc with no verdict:"; tail -n 5 "$W/out" | sed 's/^/  /'; }
exit 1
