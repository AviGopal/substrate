#!/usr/bin/env bash
# Re-emitting the client config MERGES into the existing file, never overwrites it
# (scripts/substrate/substrate-connect.sh --merge, and the instruction README § Installation
# documents, which this test runs VERBATIM with only `docker exec -i substrate-live substrate-connect`
# swapped for the script). substrate-status and systemctl are stubbed; no container.
#
#   keep      an existing config with extra top-level keys (providers, defaults, a nested object
#             with a unicode string and a 20-digit integer) and extra keys under metabob/substrate:
#             every key but the three this command owns is kept, value-for-value (compact form
#             identical); substrate.gapStoreEndpoint is UPDATED, metabob.endpoint/apiKey set. The
#             integer keeps its literal on a jq that preserves literals (1.7+); a lossy jq (1.6,
#             the image's) REFUSES the file, byte-identical, instead of rewriting it
#   create    no file: the file is created with the three keys
#   no dev    a fleet without development-vessel: an up-to-date file is left BYTE-identical
#             (an existing gapStoreEndpoint is not removed), and stderr says why no gap store
#   refuse    an existing file that is not JSON, or whose metabob is not an object: the merge
#             exits non-zero, the file is byte-identical, and no .new is left behind
#   fresh     without --merge, stdout is the fresh config alone (the installer's first write)
#
# usage: validation/scripts/substrate-connect-merge.test.sh
# Needs bash, jq.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/connect-merge.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

mkdir -p "$T/s" "$T/stub" "$T/home/.metabob"
cp "$ROOT/scripts/substrate/substrate-connect.sh" "$T/s/substrate-connect.sh"
printf '#!/usr/bin/env bash\necho %s\nexit 0\n' "'{\"port_prefix\":\"18\",\"launched_by_manifest\":true}'" > "$T/s/status-stub"
printf '#!/usr/bin/env bash\n[ "$1" = is-active ] || exit 0\ncase "$2" in activity-api.service) echo active ;; development-vessel.service) cat %q 2>/dev/null || echo inactive ;; *) echo inactive ;; esac\n' "$T/devvessel" > "$T/stub/systemctl"
chmod +x "$T/s/status-stub" "$T/stub/systemctl"
printf 'METABOB_API_KEY=test-key-0001\n' > "$T/env"
KEY=test-key-0001; EP=http://127.0.0.1:18080; GS=http://127.0.0.1:18090

# The documented instruction, verbatim from README.md, with only the container call swapped.
DOC="$(grep -E '^f=~/\.metabob/config\.json' "$ROOT/README.md"; grep -F 'substrate-connect --merge' "$ROOT/README.md" | grep -E '^\{ cat')"
[ "$(printf '%s\n' "$DOC" | grep -c .)" = 2 ] || { echo "FAIL - README.md no longer documents the merge instruction (f=... and { cat ... --merge ...)"; exit 1; }
DOC="${DOC//docker exec -i substrate-live substrate-connect/bash $T/s/substrate-connect.sh}"
emit() { # run the documented instruction -> RC; stderr in $T/err.txt
  ( cd "$T" && env HOME="$T/home" PATH="$T/stub:$PATH" SUBSTRATE_STATUS_BIN="$T/s/status-stub" SUBSTRATE_ENV_FILE="$T/env" \
      bash -c "$DOC" ) 2> "$T/err.txt"; RC=$?
}
F="$T/home/.metabob/config.json"
owned='del(.metabob.endpoint, .metabob.apiKey, .substrate.gapStoreEndpoint)'

# ── keep ───────────────────────────────────────────────────────────────────────
echo active > "$T/devvessel"
cat > "$F" <<'EOF'
{
  "providers": { "anthropic": { "apiKey": "provider-secret-placeholder" } },
  "defaults": { "provider": "anthropic", "model": "m-1" },
  "nested": { "x": { "y": [1, { "z": "ü→✓" }], "big": 12345678901234567890 } },
  "metabob": { "endpoint": "http://old.invalid", "apiKey": "old-key", "extra": "keep-me" },
  "substrate": { "gapStoreEndpoint": "http://old-gap.invalid", "other": "keep-too" }
}
EOF
cp "$F" "$T/before.json"
# The big integer: a jq that keeps number literals (1.7+) merges and keeps it; an older, lossy jq
# must REFUSE the file (left byte-identical) rather than rewrite it. Probed with the jq connect uses.
if [ "$(echo 100000000000000000001 | jq . 2>/dev/null)" = 100000000000000000001 ]; then
  emit
  grep -q '12345678901234567890' "$F" && ok "keep: a 20-digit integer keeps its literal ($(jq --version))" || bad "keep: the big integer was rewritten"
else
  emit
  [ "$RC" != 0 ] && cmp -s "$F" "$T/before.json" && grep -q 'beyond 2^53' "$T/err.txt" \
    && ok "keep: a lossy $(jq --version) refuses a file with a 20-digit integer, file byte-identical" || bad "keep: lossy jq rc $RC, file $(cmp -s "$F" "$T/before.json" && echo same || echo CHANGED)"
  jq '.nested.x.big = 12345' "$T/before.json" > "$F"; cp "$F" "$T/before.json"   # the rest of the leg without it
  emit
fi
[ "$RC" = 0 ] && ok "keep: the instruction exits 0" || { bad "keep: exit $RC"; sed 's/^/    /' "$T/err.txt"; }
[ "$(jq -c "$owned" "$T/before.json")" = "$(jq -c "$owned" "$F" 2>/dev/null)" ] && ok "keep: every key not owned by substrate-connect is kept, value for value" || bad "keep: other keys changed: $(jq -c "$owned" "$F" 2>&1)"
jq -e --arg g "$GS" --arg e "$EP" --arg k "$KEY" '.substrate.gapStoreEndpoint == $g and .metabob.endpoint == $e and .metabob.apiKey == $k' "$F" >/dev/null \
  && ok "keep: gapStoreEndpoint updated, endpoint and apiKey set" || bad "keep: owned keys wrong: $(jq -c '{metabob,substrate}' "$F")"
[ ! -e "$F.new" ] && ok "keep: no temp file left" || bad "keep: $F.new left behind"

# ── create ─────────────────────────────────────────────────────────────────────
rm -f "$F"
emit
jq -e --arg g "$GS" --arg e "$EP" --arg k "$KEY" '. == {metabob:{endpoint:$e,apiKey:$k},substrate:{gapStoreEndpoint:$g}}' "$F" >/dev/null 2>&1 \
  && ok "create: a missing file is created with the three keys" || bad "create: $(cat "$F" 2>&1)"

# ── no development-vessel: an up-to-date file is left byte-identical ───────────
echo inactive > "$T/devvessel"
printf '{"metabob": {"apiKey": "%s", "endpoint": "%s"},\n "substrate": {"gapStoreEndpoint": "http://kept.invalid"}, "defaults": {"model": "m-1"}}\n' "$KEY" "$EP" > "$F"
cp "$F" "$T/before.json"
emit
[ "$RC" = 0 ] && cmp -s "$F" "$T/before.json" && ok "no dev: the file is byte-identical (an existing gapStoreEndpoint is not removed)" || { bad "no dev: rc $RC, file changed"; diff "$T/before.json" "$F" | sed 's/^/    /'; }
grep -q 'runs no development-vessel' "$T/err.txt" && ok "no dev: stderr says why no gap store is named" || bad "no dev: no explanation on stderr"

# ── refuse: a failed merge never truncates the file ────────────────────────────
echo active > "$T/devvessel"
for bad_cfg in '{not json' '{"metabob": "a string"}' '[1, 2]' '{"a":1} {"b":2}'; do
  printf '%s\n' "$bad_cfg" > "$F"; cp "$F" "$T/before.json"
  emit
  [ "$RC" != 0 ] && cmp -s "$F" "$T/before.json" && [ ! -e "$F.new" ] \
    && ok "refuse ($bad_cfg): non-zero exit, file byte-identical, no temp left" || bad "refuse ($bad_cfg): rc $RC, changed or temp left: $(cat "$F")"
done
grep -q 'refusing to merge' "$T/err.txt" && ok "refuse: the refusal is said on stderr" || bad "refuse: no refusal message"

# ── fresh: without --merge, stdout is the config alone ─────────────────────────
OUT="$(env HOME="$T/home" PATH="$T/stub:$PATH" SUBSTRATE_STATUS_BIN="$T/s/status-stub" SUBSTRATE_ENV_FILE="$T/env" bash "$T/s/substrate-connect.sh" 2>/dev/null)"
printf '%s' "$OUT" | jq -e --arg g "$GS" --arg e "$EP" --arg k "$KEY" '. == {metabob:{endpoint:$e,apiKey:$k},substrate:{gapStoreEndpoint:$g}}' >/dev/null 2>&1 \
  && ok "fresh: without --merge stdout is the fresh config" || bad "fresh: $OUT"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
