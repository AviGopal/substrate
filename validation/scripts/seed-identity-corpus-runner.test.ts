// seed-identity-corpus-runner.test.ts: on a genuine first boot seed-identity mints goal-host's corpus runner as a SEPARATE
// principal with ONLY verdict-corpus:write, writes it to its scoped files (secrets-manifest: goal-host-vessel) and the
// persisted store, never to the shared /etc/substrate/env; goal-host's main key keeps the default [read, write], because
// the walk's egress sends that key (key option (d), 2026-10-12).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CORPUS_RUNNER_KEY_NAME, CORPUS_RUNNER_KEY_SCOPES, GOAL_HOST_KEY_SCOPES } from "../../scripts/substrate/seed-identity.ts";

const src = readFileSync(join(import.meta.dir, "../../scripts/substrate/seed-identity.ts"), "utf-8");
describe("goal-host corpus runner key", () => {
  test("a separate principal whose ONLY scope is verdict-corpus:write", () => {
    expect(CORPUS_RUNNER_KEY_NAME).toBe("goal-host-corpus-runner");
    expect(CORPUS_RUNNER_KEY_SCOPES).toEqual(["verdict-corpus:write"]);
  });
  test("minted with those scopes", () => {
    expect(src).toMatch(/issueKey\(token, user_id, org_id, CORPUS_RUNNER_KEY_NAME, CORPUS_RUNNER_KEY_SCOPES\)/);
  });
  test("MUST-FAIL: goal-host's MAIN key is minted [read, write] and NEVER carries verdict-corpus:write", () => {
    expect(GOAL_HOST_KEY_SCOPES).toEqual(["read", "write"]);
    expect(GOAL_HOST_KEY_SCOPES).not.toContain("verdict-corpus:write");
    expect(src).toMatch(/issueKey\(token, user_id, org_id, "goal-host-vessel", GOAL_HOST_KEY_SCOPES\);/);
  });
  test("MUST-FAIL: goal-host's MAIN key NEVER carries admin", () => {
    expect(GOAL_HOST_KEY_SCOPES).not.toContain("admin");
  });
  test("the runner key carries ONLY verdict-corpus:write (never read/write/admin)", () => {
    for (const s of ["read", "write", "admin", "node"]) expect(CORPUS_RUNNER_KEY_SCOPES).not.toContain(s);
  });
  test("an existing substrate is provisioned too: ensureCorpusRunnerKey runs after ensureAdminKey on both org-exists paths", () => {
    expect(src).toMatch(/await ensureAdminKey\(existing\);\s*await ensureCorpusRunnerKey\(existing\);/);
    expect(src).toMatch(/await ensureAdminKey\(reissued\.key\);\s*await ensureCorpusRunnerKey\(reissued\.key\);/);
    expect(src).toMatch(/scopes: CORPUS_RUNNER_KEY_SCOPES, name: CORPUS_RUNNER_KEY_NAME/);
  });
  test("written to its scoped files and the store, never to the shared env", () => {
    expect(src).toMatch(/scopedFiles\("GOAL_HOST_CORPUS_RUNNER_API_KEY"\)/);
    expect(src).toMatch(/upsertEnvVar\(SECRETS_FILE, "GOAL_HOST_CORPUS_RUNNER_API_KEY"/);
    expect(src).not.toMatch(/upsertEnvVar\("\/etc\/substrate\/env", "GOAL_HOST_CORPUS_RUNNER_API_KEY"/);
  });
});
