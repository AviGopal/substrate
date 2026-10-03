#!/usr/bin/env bash
# gate-relay-fixture-cannot-judge.test.sh: the relay large-frame fixture never passes a run it could not judge.
#
# federation-relay-large-frames.sh reports "cannot judge" when it lacks a bun the sandbox can run or the
# baked relay dependencies, when its 200-byte control fails, or when the sender produced no noise frame of
# 1200 bytes or more. shadow-eval.sh counts any nonzero exit as a FAIL, and a FAIL refuses promotion, so
# each of these must exit nonzero and never print an "ok" line: a silent skip reads as a pass. A stub bun
# plays each outcome: it answers the probes, prints a relay announce line, and prints the scripted verdict.
# A positive control (the stub reporting pass) must exit 0, or the stub proves nothing.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/lib/gate-test-lib.sh"
FX="$HERE/gate/fixtures/federation-relay-large-frames.sh"
[ -f "$FX" ] || { bad "fixture present"; done_tests; }
mkdir -p "$T/cand/scripts/substrate/federation-relay" "$T/nm/libp2p" "$T/bin"
echo '// stub' > "$T/cand/scripts/substrate/federation-relay/relay.ts"
cat > "$T/bin/bun" <<'STUB'
#!/usr/bin/env bash
case "${1:-}" in
  -e) case "$2" in *process.versions.bun*) echo 9.9.9 ;; *Bun.listen*) echo 40123 ;; esac; exit 0 ;;
  relay.ts) echo "[relay] /ip4/127.0.0.1/tcp/40123/p2p/12D3KooWstub"; sleep 30; exit 0 ;;
  blob.ts) printf '%b\n' "$STUB_OUT"; exit 0 ;;
esac
exit 1
STUB
chmod +x "$T/bin/bun"
fx() { # stub-output -> rc, output in $T/out.txt
  STUB_OUT="$1" CANDIDATE_DIR="$T/cand" FED_NODE_MODULES="$T/nm" FED_BUN="$T/bin/bun" TMPDIR="$T" \
    timeout 60 bash "$FX" > "$T/out.txt" 2>&1; }
judged() { # label stub-output
  fx "$2"; local rc=$?
  if [ "$rc" -ne 0 ] && ! grep -q '^ok' "$T/out.txt" && grep -q '^FAIL' "$T/out.txt"; then ok "$1: exits $rc with FAIL, no ok line"
  else show; bad "$1: exits nonzero with FAIL and no ok line (rc=$rc)"; fi; }
judged "no large frame sent" 'CONTROL {"ok":2}\nRESULTS {"ok":2} large_frames_sent=0\nVERDICT cannot-judge (no noise frame of 1200 bytes or more was sent)'
judged "control failed" 'CONTROL {"error x":2}\nVERDICT cannot-judge (the 200-byte control failed)'
judged "no verdict printed" 'CONTROL {"ok":2}'
judged "relay drops large frames" 'CONTROL {"ok":2}\nRESULTS {"error x":2} large_frames_sent=14\nVERDICT fail'
CANDIDATE_DIR="$T/cand" FED_NODE_MODULES="$T/nm" FED_BUN="$T/nonexistent-bun" TMPDIR="$T" timeout 30 bash "$FX" > "$T/out.txt" 2>&1; rc=$?
if [ "$rc" -ne 0 ] && grep -q '^FAIL - cannot judge' "$T/out.txt" && ! grep -q '^ok' "$T/out.txt"; then ok "no runnable bun: cannot judge, exits $rc"
else show; bad "no runnable bun: cannot judge, exits nonzero"; fi
fx 'CONTROL {"ok":2}\nRESULTS {"ok":2} large_frames_sent=256 direct_connections=false stray_errors=0\nVERDICT pass'; rc=$?
if [ "$rc" -eq 0 ] && grep -q '^ok' "$T/out.txt"; then ok "positive control: a stubbed pass exits 0"
else show; bad "positive control: a stubbed pass exits 0 (rc=$rc)"; fi
done_tests
