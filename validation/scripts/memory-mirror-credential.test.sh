#!/usr/bin/env bash
# The operator memory mirror sends the operator key, and a refused write is NAMED, not swallowed.
#
# WHY. development-vessel authenticates memoryNote_write against identity-vessel and answers a write
# with no Authorization header 401. The PostToolUse hook (.claude/hooks/substrate-memory-mirror.sh)
# runs scripts/substrate/mirror-memory-note.ts after every memory-file edit and fails open. Before
# this, a refusal reached only the mirror log, so operator memory could stop reaching the substrate
# (CLAUDE.md law 10) with nothing visible where the session runs. This drives the real hook and the
# real mirror against a stub vessel; no substrate and no real key are involved.
#
#   (a) no key  no ~/.metabob/config.json in a temp HOME: the stub sees no Authorization header and
#               answers 401 with a reason; the mirror log names "HTTP 401" and the reason; the hook
#               writes one stderr line naming 401; the hook still exits 0
#   (b) key     (control) a fixture config.json with .metabob.apiKey: the request carries
#               "Authorization: ApiKey <fixture>", the stub accepts, the log shows the upsert, the
#               hook's stderr is empty and it exits 0
#   (c) flat    (control) a flat .apiKey in the config is read the same way session-start reads it
#
# usage: validation/scripts/memory-mirror-credential.test.sh
# Needs bash, jq, sed and bun (skips loudly without bun).
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$SRC/.claude/hooks/substrate-memory-mirror.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/memory-mirror-credential.XXXXXX")"
STUB_PID=""
trap '[ -n "$STUB_PID" ] && kill "$STUB_PID" 2>/dev/null; rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

BUN="${GLUE_TESTS_BUN:-$(command -v bun 2>/dev/null || true)}"
if [ -z "$BUN" ] || [ ! -x "$BUN" ]; then echo "SKIP - bun not found: the mirror under test is a bun script"; exit 0; fi
# The hook calls `bun` by name.
export PATH="$(dirname "$BUN"):$PATH"
# The mirror prefers METABOB_API_KEY over the config file: an ambient key would make (a) a false pass.
unset METABOB_API_KEY
FIXTURE_KEY="fixture-operator-key-not-a-secret"

# ── stub development-vessel: records the Authorization header of each resolve, 401 without the fixture key
cat > "$T/stub.ts" <<'EOF'
import { appendFileSync, writeFileSync } from "node:fs";
const [seen, portFile, key] = process.argv.slice(2);
const server = Bun.serve({
  port: 0,
  hostname: "localhost",
  async fetch(req) {
    const auth = req.headers.get("authorization") ?? "";
    const body = await req.json().catch(() => ({}));
    appendFileSync(seen, `${auth || "<none>"}\t${body?.impulse?.type ?? "?"}\n`);
    if (auth !== `ApiKey ${key}`) {
      const why = auth ? "credential rejected" : "unauthenticated memoryNote_write: no Authorization header";
      return Response.json({ success: false, error: why }, { status: 401 });
    }
    return Response.json({ success: true, body: { action: "upserted" } });
  },
});
writeFileSync(portFile, String(server.port));
EOF
"$BUN" "$T/stub.ts" "$T/seen" "$T/port" "$FIXTURE_KEY" >"$T/stub.log" 2>&1 &
STUB_PID=$!
for _ in $(seq 1 50); do [ -s "$T/port" ] && break; sleep 0.1; done
[ -s "$T/port" ] || { echo "FAIL - stub vessel did not start: $(cat "$T/stub.log")"; exit 1; }
EP="http://localhost:$(cat "$T/port")"

# ── one hook run in a fresh HOME. $1 = config.json content ("" = no file)
run_hook() {
  H="$T/home.$RANDOM"; mkdir -p "$H"
  if [ -n "$1" ]; then mkdir -p "$H/.metabob"; printf '%s\n' "$1" > "$H/.metabob/config.json"; fi
  slug="$(printf '%s' "$SRC" | sed 's#/#-#g')"
  mem="$H/.claude/projects/$slug/memory"; mkdir -p "$mem"
  printf -- '---\nname: fixture note\ntype: reference\n---\nA fixture memory body.\n' > "$mem/reference-fixture.md"
  : > "$T/seen"
  printf '{"tool_input":{"file_path":"%s"}}' "$mem/reference-fixture.md" \
    | HOME="$H" CLAUDE_PROJECT_DIR="$SRC" DEV_VESSEL_ENDPOINT="$EP" bash "$HOOK" 2>"$T/err"
  RC=$?
  LOGF="$H/.claude/substrate-memory-mirror.log"
  [ -f "$LOGF" ] || : > "$LOGF"
}

# (a) no key
run_hook ""
[ "$RC" -eq 0 ] && ok "(a) no key: the hook still exits 0 (fail open)" || bad "(a) no key: hook exited $RC"
[ "$(cut -f1 "$T/seen")" = "<none>" ] && ok "(a) no key: the write carried no Authorization header" || bad "(a) no key: stub saw '$(cut -f1 "$T/seen" | sed 's/ApiKey .*/ApiKey <redacted>/')'"
grep -q 'HTTP 401' "$LOGF" && grep -q 'no Authorization header' "$LOGF" \
  && ok "(a) no key: the log names HTTP 401 and the vessel's reason" \
  || bad "(a) no key: the log does not name the refusal: $(tr '\n' '|' < "$LOGF" | cut -c1-300)"
[ "$(wc -l < "$T/err")" -eq 1 ] && grep -q '401' "$T/err" \
  && ok "(a) no key: one stderr line names the 401" \
  || bad "(a) no key: the hook's stderr does not name the refusal in one line: '$(tr '\n' '|' < "$T/err" | cut -c1-300)'"

# (b) the fixture key, nested
run_hook "{\"metabob\":{\"apiKey\":\"$FIXTURE_KEY\"}}"
[ "$RC" -eq 0 ] && ok "(b) key: the hook exits 0" || bad "(b) key: hook exited $RC"
[ "$(cut -f1 "$T/seen")" = "ApiKey $FIXTURE_KEY" ] && [ "$(cut -f2 "$T/seen")" = "memoryNote_write" ] \
  && ok "(b) key: memoryNote_write carried Authorization: ApiKey <fixture>" \
  || bad "(b) key: stub saw '$(tr '\n' '|' < "$T/seen")'"
grep -q 'upserted' "$LOGF" && ok "(b) key: the stub accepted and the log shows the upsert" || bad "(b) key: no upsert in the log: $(tr '\n' '|' < "$LOGF" | cut -c1-300)"
[ ! -s "$T/err" ] && ok "(b) key: an accepted write is silent on stderr" || bad "(b) key: stderr on an accepted write: '$(tr '\n' '|' < "$T/err")'"

# (c) the fixture key, flat
run_hook "{\"apiKey\":\"$FIXTURE_KEY\"}"
[ "$(cut -f1 "$T/seen")" = "ApiKey $FIXTURE_KEY" ] && grep -q 'upserted' "$LOGF" \
  && ok "(c) flat .apiKey: read and accepted" || bad "(c) flat .apiKey: stub saw '$(tr '\n' '|' < "$T/seen")'"

if [ "$FAILS" -eq 0 ]; then echo "PASS"; exit 0; fi
echo "FAILED ($FAILS)"; exit 1
