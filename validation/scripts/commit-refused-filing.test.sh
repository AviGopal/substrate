#!/usr/bin/env bash
# A refused super-repo commit is filed with its REAL cause, and a filing that is itself refused
# leaves a durable report substrate-status shows.
#
# WHY. setup-git-push installs a pre-commit wrapper (the substrate-placement-gate heredoc) that runs
# the committed scripts/git-hooks/pre-commit and files any refusal as a substrateGap. Its summary
# said "refused by the placement gate … wrote outside the tracked layout or changed human-surface UI
# source" for EVERY refusal. Since the glue tests block on a 401 from the gap store (an environment
# fault: a stale node key), that summary sent the reader to a layout problem that does not exist. And
# the filing is sent with the same key: when the local development-vessel refuses it too, the only
# trace was a WARN on the committing route's stderr.
#
#   (a) a hook that prints the 401 environment banner and exits non-zero is filed as ONE gap whose
#       summary names the credential fault (credential refused (401) — key stale?) and not placement,
#       under an id distinct from a placement refusal's
#   (b) control: a placement refusal is still filed with a placement summary
#   (c) a filing the endpoint refuses (401) is spooled under SUBSTRATE_INSTALL_DIR/pending-reports,
#       the pending-report spool substrate-status --report already drains, and substrate-status's
#       pending_reports (extracted from the script, as other glue tests extract pull-sync's
#       functions) lists it by id; a filing that is accepted leaves no spool entry
#
# The wrapper runs verbatim (extracted from setup-git-push.sh). The development-vessel is a local
# python3 listener on 127.0.0.1 that records each body and answers the status in a file.
# usage: validation/scripts/commit-refused-filing.test.sh       Needs bash, git, jq, curl, python3.
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
SGP="$SRC/scripts/substrate/setup-git-push.sh"
STATUS="$SRC/scripts/substrate/substrate-status.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/commit-refused.XXXXXX")"; SP=""
trap '[ -n "$SP" ] && kill "$SP" 2>/dev/null; rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
finish() { if [ "$FAILS" -eq 0 ]; then echo "PASS"; exit 0; fi; echo "FAILED ($FAILS)"; exit 1; }
for c in git jq curl python3; do command -v "$c" >/dev/null 2>&1 || { bad "$c on PATH"; finish; }; done

# ── the wrapper, verbatim ───────────────────────────────────────────────────────
sed -n "/^    cat > \"\$_ph\" <<'HOOK'\$/,/^HOOK\$/p" "$SGP" | sed '1d;$d' > "$T/wrapper"
grep -q 'substrate-placement-gate' "$T/wrapper" || { bad "the placement-gate wrapper is found in setup-git-push.sh"; finish; }
chmod +x "$T/wrapper"

# ── the stub development-vessel ─────────────────────────────────────────────────
cat > "$T/stub.py" <<'EOF'
import http.server, sys
log, status_file = sys.argv[1], sys.argv[2]
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n) if n else b''
        with open(log, 'ab') as f: f.write(body.replace(b'\n', b' ') + b'\n')
        st = int(open(status_file).read().strip() or '200')
        out = b'{"shape":"substrateGap","body":{"action":"created"}}' if st == 200 else b'{"error":"unauthorized"}'
        self.send_response(st); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(out))); self.end_headers(); self.wfile.write(out)
    def log_message(self, *a): pass
s = http.server.HTTPServer(('127.0.0.1', 0), H)
open(log + '.port', 'w').write(str(s.server_port))
s.serve_forever()
EOF
: > "$T/req.log"; echo 200 > "$T/status"
python3 "$T/stub.py" "$T/req.log" "$T/status" > "$T/stub.out" 2>&1 & SP=$!
for _ in $(seq 100); do [ -s "$T/req.log.port" ] && break; sleep 0.1; done
[ -s "$T/req.log.port" ] || { bad "the stub development-vessel starts"; sed 's/^/  stub: /' "$T/stub.out"; finish; }
EP="http://127.0.0.1:$(cat "$T/req.log.port")"

# ── a repo whose committed pre-commit refuses with a given banner ───────────────
ESC=$'\033'
refusing_repo() { # name banner-line findings-line -> $T/<name>, with the refusing hook committed
  local r="$T/$1"
  mkdir -p "$r/scripts/git-hooks"
  git -C "$r" init -q -b dev
  { echo '#!/usr/bin/env bash'
    printf 'printf %%s\\\\n %q\n' "$2"
    printf 'printf %%s\\\\n %q\n' "$3"
    echo 'exit 1'
  } > "$r/scripts/git-hooks/pre-commit"
  git -C "$r" add -A; git -C "$r" -c core.hooksPath=/dev/null -c user.name=t -c user.email=t@t commit -q -m base
  cp "$T/wrapper" "$r/.git/hooks/pre-commit"
  echo x > "$r/new.txt"; git -C "$r" add new.txt
}
commit_in() { # name -> RC; stderr in $T/<name>.err
  ( cd "$T/$1" && env -i PATH="$PATH" HOME="$T" METABOB_API_KEY=placeholder-not-a-key DEV_VESSEL_ENDPOINT="$EP" \
      SUBSTRATE_INSTALL_DIR="$T/install-$1" git -c user.name=t -c user.email=t@t commit -q -m try ) > /dev/null 2>"$T/$1.err"; RC=$?
}
summary_of() { sed -n "${1}p" "$T/req.log" | jq -r '.impulse.pointer.gap.summary' 2>/dev/null; }
id_of() { sed -n "${1}p" "$T/req.log" | jq -r '.impulse.pointer.gap.id' 2>/dev/null; }

refusing_repo env401 "${ESC}[0;31m━━━ glue tests: environment fault — credential refused (401) — key stale? no test failed ━━━${ESC}[0m" \
  "UNKNOWN    1.0s  fx-red.test.sh  (exit 1; tracking unknown: credential refused (401) — key stale?)"
refusing_repo placement "${ESC}[0;31m━━━ super-repo placement check failed ━━━${ESC}[0m" "  ✗ stray/ is not an allowed top-level directory"

# (a) the 401 banner
: > "$T/req.log"; echo 200 > "$T/status"; commit_in env401
[ "$RC" != 0 ] && ok "(a) the refusing hook still refuses the commit (exit $RC)" || bad "(a) the commit went through"
n="$(grep -c . "$T/req.log")"
[ "$n" = 1 ] && ok "(a) exactly one gap body is filed" || bad "(a) $n gap bodies filed"
S="$(summary_of 1)"; ID_ENV="$(id_of 1)"
printf '%s' "$S" | head -n1 | grep -qF 'credential refused (401) — key stale?' && ok "(a) the summary's lead line names the credential fault" \
  || bad "(a) the summary does not name the credential fault: $(printf '%s' "$S" | head -c 200)"
C="$(sed -n 1p "$T/req.log" | jq -r '.impulse.pointer.gap.classification_metadata.cause // empty' 2>/dev/null)"
[ "$C" = environment_credential_refused ] && printf '%s' "$S" | head -n1 | grep -qF 'METABOB_API_KEY' \
  && ok "(a) the gap is classified environment_credential_refused and names the remedy (refresh METABOB_API_KEY)" \
  || bad "(a) cause '$C' / no remedy in the lead line: the reader cannot tell an environment fault from a code refusal"
printf '%s' "$S" | head -n1 | grep -qi 'placement' && bad "(a) the summary's lead line still blames the placement gate: $(printf '%s' "$S" | head -n1 | head -c 200)" \
  || ok "(a) the summary's lead line does not blame placement"

# (b) control: placement
: > "$T/req.log"; commit_in placement
S="$(summary_of 1)"; ID_PL="$(id_of 1)"
printf '%s' "$S" | head -n1 | grep -qi 'placement' && ok "(b) control: a placement refusal is filed with a placement summary" \
  || bad "(b) control: placement summary missing: $(printf '%s' "$S" | head -c 200)"
[ -n "$ID_ENV" ] && [ -n "$ID_PL" ] && [ "$ID_ENV" != "$ID_PL" ] && ok "(b) the two causes file under distinct ids ($ID_ENV vs $ID_PL)" \
  || bad "(b) ids not distinct: '$ID_ENV' vs '$ID_PL'"
[ -z "$(ls -A "$T/install-placement/pending-reports" 2>/dev/null)" ] && ok "(b) an accepted filing leaves no spooled report" \
  || bad "(b) an accepted filing was spooled anyway"

# (c) the filing itself refused
: > "$T/req.log"; echo 401 > "$T/status"; rm -rf "$T/install-env401"; commit_in env401
SPOOL="$T/install-env401/pending-reports"
f="$(ls "$SPOOL"/*.json 2>/dev/null | head -1)"
[ -n "$f" ] && ok "(c) a refused filing is spooled under SUBSTRATE_INSTALL_DIR/pending-reports" || bad "(c) no spooled report after a refused filing (stderr: $(tr '\n' ' ' < "$T/env401.err" | tail -c 200))"
[ -n "$f" ] && [ "$(jq -r '.type' "$f" 2>/dev/null)" = substrateGap_write ] && [ "$(jq -r '.gap.id' "$f" 2>/dev/null)" = "$ID_ENV" ] \
  && ok "(c) the spooled report is the gap pointer substrate-status --report re-posts" || bad "(c) the spooled report is not the gap pointer (got: $(head -c 200 "${f:-/dev/null}"))"
grep -E '^\[placement-gate\].*(401|credential refused)' "$T/env401.err" | grep -q 'pending-reports' \
  && ok "(c) the wrapper's own line names the refused filing (401) and where it was spooled" \
  || bad "(c) no [placement-gate] line naming the 401 and the spool: $(grep '^\[placement-gate\]' "$T/env401.err" | head -c 200)"
sed -n '/^pending_reports() {/,/^}/p' "$STATUS" > "$T/pending.sh"
if [ -s "$T/pending.sh" ]; then
  out="$( . "$T/pending.sh"; SUBSTRATE_INSTALL_DIR="$T/install-env401" pending_reports )"
  printf '%s' "$out" | grep -qF "$ID_ENV" && ok "(c) substrate-status's pending_reports lists the spooled gap by id" \
    || bad "(c) pending_reports does not list $ID_ENV: $(printf '%s' "$out" | head -c 200)"
  out="$( . "$T/pending.sh"; SUBSTRATE_INSTALL_DIR="$T/install-none" pending_reports )"
  [ -z "$out" ] && ok "(c) control: no spool, pending_reports prints nothing" || bad "(c) control: pending_reports printed '$out' with no spool"
else
  bad "(c) substrate-status defines pending_reports()"
fi
finish
