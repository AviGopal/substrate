#!/usr/bin/env bash
# pull-sync-scrubbed-env-isolates-services.test.sh: scrubbed_env (scripts/substrate/substrate-pull-sync.sh) runs
# every candidate suite, the protected-alone runs, the failing-test generator and run_suite_at under env -i.
# env -i drops every service address too, and vessel code then falls back to its compiled-in local default
# (`process.env.X || "http://127.0.0.1:8xxx"`, SurrealDB on its default local address): the LIVE fleet on the node.
# The scrubbed environment must point every such address somewhere a connect is refused.
#
#   pull-sync-scrubbed-env-isolates-services.test.sh [path/to/substrate-pull-sync.sh]
#
# The fixture "suite" resolves each target the way vessel code does (`${VAR:-default}`) and attempts a TCP
# connect. Its defaults all name a throwaway listener THIS test starts on a free loopback port, baked into the
# fixture file (nothing reaches it through env -i), so a variable scrubbed_env leaves unset connects.
#
# Must-fail: under scrubbed_env every target is REFUSED, the fixture reports every target (a fixture that died
#   under env -i reports none and must not read as isolation), and the database credentials are SET to the
#   non-secret placeholder (never absent, never the caller's value).
# Positive control: the same fixture run outside scrubbed_env connects to the listener for every target.
# Sanity: 127.0.0.1:9 refuses outside scrubbed_env too, so a stray listener there cannot fake isolation.
# Never connects to anything but the listener it starts and the discard port.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/ps-scrub-svc.XXXXXX")"; LPID=""
trap '[ -n "$LPID" ] && kill "$LPID" 2>/dev/null; rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# Every address vessel src reads with a local default (the URL each resolves to when unset).
HTTP_VARS=(
  ACTIVITY_API_ENDPOINT ACTIVITY_API_URL METABOB_ENDPOINT TUNING_PARAM_ENDPOINT TEST_API_URL SUBSTRATE_API_URL
  DISCOVERY_VESSEL_ENDPOINT DISCOVERY_ENDPOINT PRODUCER_DISCOVERY_ENDPOINT PEER_DISCOVERY_ENDPOINT
  IDENTITY_VESSEL_URL
  DEV_VESSEL_ENDPOINT DEVELOPMENT_VESSEL_ENDPOINT DEV_VESSEL_IMPULSES_URL
  DEV_VESSEL_SELF_ENDPOINT SELF_ENDPOINT SELF_RESOLVE_ENDPOINT GAP_STORE_ENDPOINT FEATURE_COMPOSE_ENDPOINT
  GOAL_HOST_VESSEL_ENDPOINT GOAL_HOST_ENDPOINT
  CONCEPT_DB_ENDPOINT CONCEPT_DB_URL CONCEPT_DB_CLUSTER_ENDPOINT CONCEPT_DB_EMBED_ENDPOINT
  LLM_RESOLVER_VESSEL_ENDPOINT LLM_TOOL_DISPATCH_ENDPOINT LLM_VESSEL_ENDPOINT LLM_ROUTER_API_ENDPOINT
  RELEVANCE_SINK_ENDPOINT EVENT_BUS_ENDPOINT
  LIGHT_DISPATCH_ENDPOINT LIGHT_DISPATCH_VESSEL_ENDPOINT LIGHT_DISPATCH_URL
  STATEFUL_UI_VESSEL_ENDPOINT HUMAN_SURFACE_ENDPOINT TRANSPORT_VESSEL_ENDPOINT FED_TRANSPORT_EGRESS
  OBSIDIAN_ENDPOINT OBSIDIAN_LEARN_ENDPOINT OBSIDIAN_PLUGIN_ENDPOINT OBSIDIAN_PROBE_ENDPOINT
)
CRED_VARS=(SURREALDB_USERNAME SURREALDB_USER SURREAL_USER SURREALDB_PASSWORD SURREALDB_PASS SURREAL_PASS)
NS_VARS=(SURREALDB_NAMESPACE SURREALDB_NS SURREALDB_DATABASE SURREALDB_DB)

sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT" > "$T/fn.sh"
if [ -s "$T/fn.sh" ] && bash -n "$T/fn.sh" 2>/dev/null; then ok "scrubbed_env extracts and parses"; else bad "scrubbed_env extracts and parses"; fi
# shellcheck source=/dev/null
. "$T/fn.sh"

# ── the throwaway listener: loopback, free port, accept-and-close ────────────
L="$T/listen.py"
cat > "$L" <<'PY'
import socket, sys
s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", 0)); s.listen(64)
open(sys.argv[1], "w").write(str(s.getsockname()[1]))
while True:
    c, _ = s.accept(); c.close()
PY
command -v python3 >/dev/null 2>&1 || { echo "FAIL - python3 is needed for the throwaway listener"; exit 1; }
python3 "$L" "$T/port" & LPID=$!
for _ in $(seq 1 50); do [ -s "$T/port" ] && break; read -r -t 0.1 < /dev/zero 2>/dev/null || true; done
PORT="$(cat "$T/port" 2>/dev/null)"
[ -n "$PORT" ] || { echo "FAIL - the throwaway listener did not start"; exit 1; }

# ── the fixture suite: VAR -> ${VAR:-default}, every default the listener ───
F="$T/suite.sh"
{
  echo '#!/usr/bin/env bash'
  echo "D=127.0.0.1:$PORT"
  echo 'probe() { # name url'
  echo '  local hp="${2#*://}"; hp="${hp%%/*}"; local h="${hp%:*}" p="${hp##*:}"'
  echo '  timeout 3 bash -c "exec 3<>/dev/tcp/$h/$p" 2>/dev/null; local rc=$?'
  echo '  case $rc in 0) echo "$1 connected $hp";; 124) echo "$1 timeout $hp";; *) echo "$1 refused $hp";; esac; }'
  echo 'probe SURREALDB_URL "${SURREALDB_URL:-http://$D/rpc}"'
  echo 'probe REDIS_URL "${REDIS_URL:-redis://$D}"'
  for v in "${HTTP_VARS[@]}"; do echo "probe $v \"\${$v:-http://\$D}\""; done
  for v in "${CRED_VARS[@]}" "${NS_VARS[@]}"; do echo "echo \"VAL $v=\${$v-<unset>}\""; done
} > "$F"; chmod +x "$F"
N=$(( ${#HTTP_VARS[@]} + 2 ))

# The caller holds LIVE-looking values (as the unit's env does); none may reach the suite.
export SURREALDB_PASSWORD=caller-live-secret SURREALDB_URL="http://127.0.0.1:$PORT" ACTIVITY_API_ENDPOINT="http://127.0.0.1:$PORT"
mkdir -p "$T/root"
scrubbed_env "$T/root" "$F" > "$T/scrubbed.out" 2>&1
unset SURREALDB_PASSWORD SURREALDB_URL ACTIVITY_API_ENDPOINT
# Positive control: the same fixture with no scrub at all.
env -i PATH="$PATH" HOME="${HOME:-/root}" "$F" > "$T/plain.out" 2>&1

# ── sanity ───────────────────────────────────────────────────────────────────
if timeout 3 bash -c 'exec 3<>/dev/tcp/127.0.0.1/9' 2>/dev/null; then bad "127.0.0.1:9 refuses outside scrubbed_env (something listens there)"
else ok "127.0.0.1:9 refuses outside scrubbed_env"; fi

# ── positive control ─────────────────────────────────────────────────────────
pc="$(grep -c " connected 127.0.0.1:$PORT$" "$T/plain.out")"
[ "$pc" = "$N" ] && ok "control: outside scrubbed_env the fixture connects to the throwaway listener for all $N targets" \
  || bad "control: outside scrubbed_env the fixture connects to the throwaway listener for all $N targets (got $pc)"

# ── must-fail ────────────────────────────────────────────────────────────────
rep="$(grep -cE '^[A-Z0-9_]+ (connected|refused|timeout) ' "$T/scrubbed.out")"
[ "$rep" = "$N" ] && ok "under scrubbed_env the fixture reports all $N targets" \
  || bad "under scrubbed_env the fixture reports all $N targets (got $rep; output: $(head -c 300 "$T/scrubbed.out" | tr '\n' '|'))"
for v in SURREALDB_URL REDIS_URL "${HTTP_VARS[@]}"; do
  line="$(grep -E "^$v " "$T/scrubbed.out" | head -1)"
  case "$line" in
    "$v refused "*) ok "$v is refused under scrubbed_env (${line##* })" ;;
    *) bad "$v is refused under scrubbed_env (got '${line:-<no report>}')" ;;
  esac
done
for v in "${CRED_VARS[@]}"; do
  val="$(sed -n "s/^VAL $v=//p" "$T/scrubbed.out" | head -1)"
  [ "$val" = pull-sync-test-placeholder ] && ok "$v is the non-secret placeholder" \
    || bad "$v is the non-secret placeholder (got '${val:-<no report>}')"
done
for v in "${NS_VARS[@]}"; do
  val="$(sed -n "s/^VAL $v=//p" "$T/scrubbed.out" | head -1)"
  [ "$val" = pull-sync-test ] && ok "$v is pull-sync-test" || bad "$v is pull-sync-test (got '${val:-<no report>}')"
done
grep -q 'caller-live-secret' "$T/scrubbed.out" && bad "the caller's database password does not reach the suite" \
  || ok "the caller's database password does not reach the suite"

echo "---"; [ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failing"; exit 1; }
