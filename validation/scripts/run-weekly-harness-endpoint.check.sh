#!/usr/bin/env bash
# run-weekly-harness-endpoint — the weekly harness's sensitivity sweep reaches the endpoint it was given,
# and says so loudly when it cannot.
#
#   bash validation/scripts/run-weekly-harness-endpoint.check.sh [repo-root]
#
# WHY. run-weekly-harness.sh resolves METABOB_ENDPOINT (env, else ~/.metabob/config.json, else FATAL)
# and then built ENDPOINT as "\${METABOB_ENDPOINT}": an escaped dollar, so ENDPOINT was the literal text
# ${METABOB_ENDPOINT}. Every weekly run, the sweep curled an invalid URL, its `|| echo ""` turned the
# failure into "0 registered tests", and the harness exited 0. A sweep that never reaches anything and
# reports success is a gate with no call sites. The same escaped dollar was handed to the forge and
# stratified children as their endpoint.
#
# WHAT IT RUNS. The harness from the sensitivity-sweep section to its end (the sweep, the sidecar and the
# Phase 25 block, whose scripts are absent here so it takes its own skip branch, and the final exit),
# extracted by its section header and run in a scratch dir with a placeholder key against:
#   1. a loopback stub HTTP server answering the registry read with one test_id: the stub must receive
#      the registry read (POST /v2/impulses/resolve) and the per-test dispatch (POST
#      /v2/activities/recommend), and the step must exit 0;
#   2. a loopback port nothing listens on: the step must exit non-zero and name the endpoint it could
#      not reach.
# Plus a static check: no line of the harness carries the escaped "\${METABOB_ENDPOINT}" literal.
# Needs bash, curl and python3 (the stub); no container, no network beyond 127.0.0.1. Exit 0 = all pass.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
H="$ROOT/validation/scripts/run-weekly-harness.sh"
T="$(mktemp -d)"; SP=""
trap '[ -n "$SP" ] && kill "$SP" 2>/dev/null; rm -rf "$T"' EXIT
fails=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; fails=$((fails + 1)); }
finish() { echo; if [ "$fails" -eq 0 ]; then echo "PASS"; exit 0; fi; echo "$fails FAILED"; exit 1; }

echo "== run-weekly-harness endpoint ($ROOT)"
[ -f "$H" ] || { bad "harness present: ${H#"$ROOT"/}"; finish; }
command -v python3 >/dev/null 2>&1 || { bad "python3 on PATH (the stub server needs it)"; finish; }

n="$(grep -c '\\\${METABOB_ENDPOINT}' "$H")"
[ "$n" = 0 ] && ok "no line of the harness passes the escaped literal \\\${METABOB_ENDPOINT} as an endpoint" \
  || { grep -n '\\\${METABOB_ENDPOINT}' "$H" | sed 's/^/  literal at line /'; bad "the harness carries the escaped literal \\\${METABOB_ENDPOINT} on $n line(s)"; }

# The step under test: the harness from the sweep section to EOF, after a preamble standing in for what the
# harness has set by then. SCRIPT_DIR is an empty dir, so the Phase 25 block skips (its scripts are absent).
sed -n '/^# ── Sensitivity-probe sweep/,$p' "$H" > "$T/sweep.body"
[ -s "$T/sweep.body" ] || { bad "the sensitivity-sweep section is found by its header"; finish; }
mkdir -p "$T/scripts" "$T/results"
{
  echo 'set -euo pipefail'
  echo "apikey_cfg() { [ -n \"\${1:-}\" ] && printf 'header = \"Authorization: ApiKey %s\"\\n' \"\$1\"; return 0; }"
  echo "SCRIPT_DIR='$T/scripts'; VALIDATION_DIR='$T'; RESULTS_DIR='$T/results'"
  echo 'TODAY=2000-01-01; LABEL=check; METABOB_API_KEY=placeholder-not-a-key'
  echo 'export METABOB_ENDPOINT'
  cat "$T/sweep.body"
} > "$T/sweep.sh"

cat > "$T/stub.py" <<'EOF'
import http.server, sys
log = sys.argv[1]
class H(http.server.BaseHTTPRequestHandler):
    def _h(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n: self.rfile.read(n)
        with open(log, 'a') as f: f.write(self.command + ' ' + self.path + '\n')
        body = b'{"content":"{\\"entries\\":[{\\"test_id\\":\\"t1\\"}]}"}' if self.path == '/v2/impulses/resolve' else b'{}'
        self.send_response(200); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    do_POST = _h; do_GET = _h
    def log_message(self, *a): pass
s = http.server.HTTPServer(('127.0.0.1', 0), H)
open(log + '.port', 'w').write(str(s.server_port))
s.serve_forever()
EOF
: > "$T/req.log"
python3 "$T/stub.py" "$T/req.log" > "$T/stub.out" 2>&1 & SP=$!
for _ in $(seq 100); do [ -s "$T/req.log.port" ] && break; sleep 0.1; done
[ -s "$T/req.log.port" ] || { bad "the stub server starts (see stub output)"; sed 's/^/  stub: /' "$T/stub.out"; finish; }
PORT="$(cat "$T/req.log.port")"

# 1. Reachable: the stub hears the registry read and the dispatch, and the step exits 0.
rc=0; METABOB_ENDPOINT="http://127.0.0.1:$PORT" timeout 120 bash "$T/sweep.sh" > "$T/up.out" 2>&1 || rc=$?
grep -q '^POST /v2/impulses/resolve$' "$T/req.log" \
  && ok "the sweep's registry read reaches METABOB_ENDPOINT (stub received POST /v2/impulses/resolve)" \
  || bad "the sweep's registry read reaches METABOB_ENDPOINT (stub received: $(tr '\n' ' ' < "$T/req.log"))"
grep -q '^POST /v2/activities/recommend$' "$T/req.log" \
  && ok "the sweep dispatches each registered test to METABOB_ENDPOINT (stub received POST /v2/activities/recommend)" \
  || bad "the sweep dispatches each registered test to METABOB_ENDPOINT (stub received: $(tr '\n' ' ' < "$T/req.log"))"
[ "$rc" = 0 ] && ok "a reachable endpoint: the step exits 0" \
  || { tail -5 "$T/up.out" | sed 's/^/  step: /'; bad "a reachable endpoint: the step exits 0 (got $rc)"; }

# 2. Unreachable: a loopback port nothing listens on. The step must fail and say where it could not reach.
DEAD="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
rc=0; METABOB_ENDPOINT="http://127.0.0.1:$DEAD" timeout 120 bash "$T/sweep.sh" > "$T/down.out" 2>&1 || rc=$?
[ "$rc" != 0 ] && ok "an unreachable endpoint: the step exits non-zero ($rc)" \
  || bad "an unreachable endpoint: the step exits non-zero (got 0: the failure was swallowed)"
grep -q "127.0.0.1:$DEAD/v2/impulses/resolve" "$T/down.out" \
  && ok "an unreachable endpoint: the step logs a reason naming the URL it could not reach" \
  || { tail -5 "$T/down.out" | sed 's/^/  step: /'; bad "an unreachable endpoint: the step logs a reason naming 127.0.0.1:$DEAD/v2/impulses/resolve"; }

finish
