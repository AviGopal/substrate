#!/usr/bin/env bash
# substrate-status-keyless-spoke-fails-fast.check.sh: `substrate-status --wait usable` (scripts/substrate/substrate-status.sh)
# stops early on a failure no amount of waiting repairs, and "no provider key for the LLM probe" is one of them. probe_llm
# sets TERMINAL for it only when the node is not a spoke and names no peer (PEER_DISCOVERY_ENDPOINTS): a spoke's arms are its
# hub's, so a keyless spoke is never terminal. When its hub advertises no llm arm either, no arm can ever answer, and the
# wait re-probes until its bound: the installer's `--wait usable` ran for about 16 minutes before giving up.
#
#   substrate-status-keyless-spoke-fails-fast.check.sh [path/to/substrate-status.sh]
#
# Not a *.test.sh: it was committed red (check first), before the fix, and a red glue test blocks the commit. Once green, a
# glue test can run it so the cases stay under the pre-commit glue gate.
#
# What is asserted is the status script's own stop, not the installer's exit 20: substrate-install.sh maps ANY non-zero
# `--wait` to 20, and the status script exits 1 (`fail`) both on a terminal stop and on a timeout, so neither exit code
# tells the two apart. The stop is the stderr line `[status] stopped waiting for usable: ... (<reason>)` and the time it
# took. The must-fail asserts that line, a reason naming both "no provider key" and "no federated arm" (so the fix words
# the spoke's reason to say both; the non-spoke reason it has today names only the first), and a stop within 60 s of a
# 90 s --timeout, so a red run ends in bounded time.
#
# Must-fail: a keyless spoke (HUB_DISCOVERY_URL set, no provider key, no peer) whose hub answers llm_completion the way
# discovery does when no producer is registered (404 {"error":"Not found"}) and advertises no llm arm in its registry
# stops as terminal, exit 1, within 60 s, with that reason.
# Controls: in that run live, seeded and served pass and usable is `fail`, not `unknown` (only a fail can stop a wait, so
# a red is the missing terminal and nothing else); a keyless spoke whose hub DOES answer llm_completion passes usable,
# exit 0, through discovery (the federated arm is a spoke's arm and must stay one); a keyless non-spoke with no peer
# already stops as terminal within 60 s naming no provider key (the harness can see a terminal stop at all).
#
# The whole script runs, unmodified, under env -i, so a fix anywhere in it is what is judged. Nothing here reaches a
# container or a port of the fleet:
#   - its env file (SUBSTRATE_ENV_FILE) is a throwaway file; envval falls back to the process env, which env -i empties,
#     so no provider key the caller holds can reach it;
#   - discovery, the hub's discovery and identity are one stub on an ephemeral loopback port: /resolve answers
#     llm_completion, vesselCapability, vesselRegistry, goalDispatchAsync and goalWalkState, plus /health,
#     /registry/shapes and /v1/keys/validate, with or without an llm arm (a mode file it reads per request);
#   - curl is shimmed first on PATH and refuses every URL but the stub's, so the probe's fallback local-arm ports and
#     the local goal-host read as not listening (a keyless node's arms skip at start);
#   - systemctl is shimmed (system running, every unit inactive, the seeder masked, no jobs), substrate-ready prints an
#     empty matrix, the inventory has no vessels and the launch manifest publishes no ports, so live/seeded/served pass
#     on no fleet at all and the LLM half of usable is what is measured;
#   - every launch input (SUBSTRATE_PORT_PREFIX and the nine per-port aliases) is given a placeholder, so launchval never
#     falls through to PID 1's environment;
#   - --quick keeps the per-vessel revision scan and the image-freshness check (which writes a cache under /workspace)
#     from running; the install dir is under the temp root.
# What the script still reads unconditionally is read-only and absent or non-secret: /run/systemd/system (a directory
# test, without which live is `unknown`: checked below as a harness precondition), /run/.containerenv, /.dockerenv,
# /etc/substrate/image-revision and /workspace/.pull-sync/channel.json.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${1:-$HERE/../../scripts/substrate/substrate-status.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/status-keyless-spoke.XXXXXX")"
STUB_PID=""
trap '[ -n "$STUB_PID" ] && kill "$STUB_PID" 2>/dev/null; rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
REAL_CURL="$(command -v curl)"; PY="$(command -v python3)"
[ -n "$REAL_CURL" ] && [ -n "$PY" ] && command -v jq >/dev/null 2>&1 || { echo "needs curl, jq and python3"; exit 2; }
mkdir -p "$T/bin" "$T/home" "$T/tmp" "$T/install"

# ── the stub: discovery, hub discovery and identity on one ephemeral port ────
cat > "$T/stub.py" <<'PY'
import json, os, sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
ROOT = sys.argv[1]
def mode():
    try: return open(os.path.join(ROOT, "mode")).read().strip()
    except OSError: return "noarm"
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def note(self, what):
        with open(os.path.join(ROOT, "requests.log"), "a") as f: f.write(f"{mode()} {self.command} {self.path} {what}\n")
    def send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def base(self): return "http://%s:%d" % self.server.server_address[:2]
    def vessels(self):
        v = [{"vesselId": "goal-host-stub", "vesselName": "goal-host", "shapes": ["goalDispatchAsync", "goalWalkState"],
              "endpoint": self.base(), "status": "healthy"}]
        if mode() == "arm":
            v.append({"vesselId": "llm-stub", "vesselName": "llm-resolver", "shapes": ["llm_completion"],
                      "endpoint": self.base(), "status": "healthy"})
        return v
    def do_GET(self):
        p = self.path.split("?")[0]; self.note("-")
        if p == "/health": return self.send(200, {"status": "ok", "vessel": "discovery", "registeredVessels": len(self.vessels())})
        if p == "/registry/shapes": return self.send(200, {"shapes": sorted({s for v in self.vessels() for s in v["shapes"]})})
        if p == "/registry/shape-descriptions": return self.send(200, {"shape_descriptions": {}})
        return self.send(404, {"error": "Not found"})
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try: body = json.loads(self.rfile.read(n) or b"{}")
        except ValueError: body = {}
        p = self.path.split("?")[0]
        if p == "/v1/keys/validate":
            self.note("validate"); return self.send(200, {"data": {"valid": True, "key_id": "check", "org_id": "check"}})
        if p != "/resolve": self.note("-"); return self.send(404, {"error": "Not found"})
        ptr = body.get("pointer") or (body.get("impulse") or {}).get("pointer") or {}
        t = ptr.get("type", ""); self.note(t); arm = mode() == "arm"
        if t == "llm_completion":
            if arm: return self.send(200, {"resolved": True, "content": "ok"})
            return self.send(404, {"error": "Not found", "shape": t})   # discovery's answer when no producer is registered
        if t == "vesselCapability":
            vs = [v for v in self.vessels() if ptr.get("shape") in v["shapes"]]
            return self.send(200, {"content": {"shape": ptr.get("shape"), "vessels": vs, "found": bool(vs)}, "metadata": {"shape": t}})
        if t == "vesselRegistry": return self.send(200, {"content": {"vessels": self.vessels()}, "metadata": {"shape": t}})
        if t == "goalDispatchAsync": return self.send(200, {"dispatchId": "status-check-dispatch"})
        if t == "goalWalkState":
            return self.send(200, {"body": {"dispatchId": ptr.get("dispatchId"), "status": "completed", "reached": True,
                                            "goalReachReason": "stub registry oracle", "executionId": "status-check-exec"}})
        return self.send(404, {"error": "Not found", "shape": t})
s = ThreadingHTTPServer(("127.0.0.1", 0), H)
open(os.path.join(ROOT, "port.tmp"), "w").write(str(s.server_address[1])); os.rename(os.path.join(ROOT, "port.tmp"), os.path.join(ROOT, "port"))
s.serve_forever()
PY
echo noarm > "$T/mode"
"$PY" "$T/stub.py" "$T" >/dev/null 2>&1 & STUB_PID=$!
for _ in $(seq 1 50); do [ -s "$T/port" ] && break; sleep 0.1; done
STUB="http://127.0.0.1:$(cat "$T/port" 2>/dev/null)"
if [ "$("$REAL_CURL" -s -o /dev/null -w '%{http_code}' --max-time 3 "$STUB/health" 2>/dev/null)" = 200 ]; then
  ok "harness: the stub answers on an ephemeral loopback port"
else
  bad "harness: the stub answers on an ephemeral loopback port"; echo "---"; echo "$FAILS failing"; exit 1
fi
[ -d /run/systemd/system ] && ok "harness: /run/systemd/system exists (live is evaluable)" \
  || bad "harness: /run/systemd/system exists (without it live is unknown and gates usable)"

# ── shims ────────────────────────────────────────────────────────────────────
cat > "$T/bin/curl" <<EOF
#!/usr/bin/env bash
# Only the stub is reachable; anything else reads as nothing listening.
for a in "\$@"; do
  case "\$a" in
    "$STUB"|"$STUB"/*) ;;
    http://*|https://*) printf '%s\n' "\$a" >> "$T/refused.log"; exit 7 ;;
  esac
done
exec "$REAL_CURL" "\$@"
EOF
cat > "$T/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  is-system-running) echo running ;;
  is-active) echo inactive; exit 3 ;;
  is-enabled) echo masked; exit 1 ;;
  *) ;;   # show -p X --value, list-jobs: nothing
esac
EOF
printf '%s\n' '#!/usr/bin/env bash' 'echo '"'"'{"vessels":[]}'"'" > "$T/bin/substrate-ready"
chmod +x "$T/bin/curl" "$T/bin/systemctl" "$T/bin/substrate-ready"
echo '{"vessels":[]}' > "$T/inventory.json"
printf 'services:\n  substrate:\n    image: placeholder\n' > "$T/manifest.yml"

# run_case NAME MODE [ENV-LINE...]: --wait usable --timeout 90 under env -i; sets RC, SECS, OUT, ERR.
run_case() {
  local name="$1" t0; echo "$2" > "$T/mode"; shift 2
  { echo "METABOB_API_KEY=status-check-placeholder"; echo "IDENTITY_VESSEL_URL=$STUB"; echo "DISCOVERY_ENDPOINT=$STUB"
    printf '%s\n' "$@"; } > "$T/$name.env"
  OUT="$T/$name.out"; ERR="$T/$name.err"; t0="$(date +%s)"
  env -i PATH="$T/bin:/usr/bin:/bin" HOME="$T/home" TMPDIR="$T/tmp" LANG=C \
    SUBSTRATE_ENV_FILE="$T/$name.env" VESSELS_INVENTORY="$T/inventory.json" SUBSTRATE_READY_BIN="$T/bin/substrate-ready" \
    SUBSTRATE_MANIFEST="$T/manifest.yml" SUBSTRATE_INSTALL_DIR="$T/install" SUBSTRATE_PORT_PREFIX=0 \
    ACTIVITY_API_PORT=0 DEV_VESSEL_PORT=0 DISCOVERY_PORT=0 IDENTITY_PORT=0 GOAL_HOST_PORT=0 CONCEPT_DB_PORT=0 \
    STATEFUL_UI_PORT=0 HUMAN_SURFACE_PORT=0 RELAY_PORT=0 \
    timeout 150 bash "$SCRIPT" --wait usable --timeout 90 --quick --json > "$OUT" 2> "$ERR"
  RC=$?; SECS=$(( $(date +%s) - t0 ))
}
lvl() { jq -r --arg l "$1" '.levels[]? | select(.level == $l) | .value' "$OUT" 2>/dev/null | head -1; }
evid() { jq -r --arg l "$1" '.levels[]? | select(.level == $l) | .evidence' "$OUT" 2>/dev/null | head -1; }
stopline() { grep -m1 '^\[status\] stopped waiting for usable' "$ERR" || true; }

# ── must-fail: keyless spoke, hub advertises no llm arm ─────────────────────
run_case spoke-noarm noarm "HUB_DISCOVERY_URL=$STUB" PROFILE_EFFECTIVE=spoke
S="$(stopline)"
[ -n "$S" ] && ok "keyless spoke, no arm: the wait stops as terminal" \
  || bad "keyless spoke, no arm: the wait stops as terminal (no stop line; ran ${SECS}s to the --timeout)"
[ "$SECS" -lt 60 ] && ok "keyless spoke, no arm: it stops within 60 s (${SECS}s)" || bad "keyless spoke, no arm: it stops within 60 s (took ${SECS}s)"
case "$S" in *"no provider key"*"no federated arm"*|*"no federated arm"*"no provider key"*)
  ok "keyless spoke, no arm: the reason names no provider key and no federated arm";;
  *) bad "keyless spoke, no arm: the reason names no provider key and no federated arm (got: ${S:-no stop line})";; esac
[ "$RC" = 1 ] && ok "keyless spoke, no arm: exit 1 (fail; the installer maps it to 20)" || bad "keyless spoke, no arm: exit 1 (got $RC)"
# ── controls ─────────────────────────────────────────────────────────────────
for l in live seeded served; do
  [ "$(lvl $l)" = pass ] && ok "keyless spoke, no arm: $l passes in the harness" || bad "keyless spoke, no arm: $l passes in the harness (got '$(lvl $l)': $(evid $l))"
done
[ "$(lvl usable)" = fail ] && ok "keyless spoke, no arm: usable is fail, not unknown" \
  || bad "keyless spoke, no arm: usable is fail, not unknown (got '$(lvl usable)': $(evid usable))"
echo "#   spoke-noarm: stub saw: $(awk '{print $3, $4}' "$T/requests.log" 2>/dev/null | sort | uniq -c | awk '{printf "%s %s(%s); ", $2, $3, $1}')"
: > "$T/requests.log"

run_case spoke-arm arm "HUB_DISCOVERY_URL=$STUB" PROFILE_EFFECTIVE=spoke
[ "$RC" = 0 ] && [ "$(lvl usable)" = pass ] && ok "keyless spoke, hub answers llm_completion: usable passes, exit 0 (${SECS}s)" \
  || bad "keyless spoke, hub answers llm_completion: usable passes, exit 0 (exit $RC, usable '$(lvl usable)': $(evid usable); $(stopline))"
case "$(evid usable)" in *"answered through discovery"*) ok "keyless spoke, hub answers llm_completion: the arm is the federated one";;
  *) bad "keyless spoke, hub answers llm_completion: the arm is the federated one (got: $(evid usable))";; esac
: > "$T/requests.log"

run_case standalone-noarm noarm PROFILE_EFFECTIVE=standalone
S="$(stopline)"
case "$S" in *"no provider key"*) ok "keyless non-spoke, no peer: stops as terminal naming no provider key";;
  *) bad "keyless non-spoke, no peer: stops as terminal naming no provider key (got: ${S:-no stop line})";; esac
[ "$SECS" -lt 60 ] && [ "$RC" = 1 ] && ok "keyless non-spoke, no peer: exit 1 within 60 s (${SECS}s)" \
  || bad "keyless non-spoke, no peer: exit 1 within 60 s (exit $RC after ${SECS}s)"

[ -s "$T/refused.log" ] && echo "#   refused (not the stub): $(sort -u "$T/refused.log" | tr '\n' ' ')"
echo "---"; [ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failing"; exit 1; }
