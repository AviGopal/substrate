#!/usr/bin/env bash
# Re-emitting the client config MERGES ON THE HOST (scripts/substrate/connect-merge.sh, the one
# implementation README § Installation, ui-only-up and substrate-install run): the container is asked
# only for the values it owns (`substrate-connect --values`); nothing of the operator's config is
# piped in. The README instruction is run VERBATIM with only `docker exec substrate-live
# substrate-connect` swapped for the script (so --merge-script and --values are both exercised);
# substrate-status and systemctl are stubbed; no container.
#
#   keep       extra top-level keys (providers, defaults, a nested object with a unicode string and a
#              20-digit integer) and extra keys under metabob/substrate are kept value for value, the
#              integer's literal intact (host jq keeps literals); gapStoreEndpoint UPDATED, endpoint
#              and apiKey set; the file ends mode 600 and no temp file is left
#   create     no file (and no directory): created with the three keys
#   unchanged  a fleet without development-vessel, file already up to date: byte-identical (and an
#              existing gapStoreEndpoint is not removed)
#   refuse     an existing file that is not one JSON object, or whose metabob is not an object; a
#              values command that fails or prints something else: non-zero exit, file byte-identical,
#              no temp file left
#   lossy jq   a jq that rewrites integers beyond 2^53 (a stand-in for jq < 1.7) runs the merge: a file
#              with one is REFUSED, byte-identical; a file without one still merges
#   secrecy    the API key appears in no output of the instruction, only in the target file; the
#              container is never given stdin (--merge is refused, pointing at the host-side path)
#
# usage: validation/scripts/substrate-connect-merge.test.sh
# Needs bash, jq.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/connect-merge.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

mkdir -p "$T/s" "$T/stub" "$T/home"
cp "$ROOT/scripts/substrate/substrate-connect.sh" "$ROOT/scripts/substrate/connect-merge.sh" "$T/s/"
printf '#!/usr/bin/env bash\necho %s\nexit 0\n' "'{\"port_prefix\":\"18\",\"launched_by_manifest\":true}'" > "$T/s/status-stub"
printf '#!/usr/bin/env bash\n[ "$1" = is-active ] || exit 0\ncase "$2" in activity-api.service) echo active ;; development-vessel.service) cat %q 2>/dev/null || echo inactive ;; *) echo inactive ;; esac\n' "$T/devvessel" > "$T/stub/systemctl"
chmod +x "$T/s/status-stub" "$T/stub/systemctl"
KEY=fixture-not-a-real-key-0001; EP=http://127.0.0.1:18080; GS=http://127.0.0.1:18090
printf 'METABOB_API_KEY=%s\n' "$KEY" > "$T/env"
E=(env HOME="$T/home" PATH="$T/stub:$PATH" SUBSTRATE_STATUS_BIN="$T/s/status-stub" SUBSTRATE_ENV_FILE="$T/env")

# The documented instruction, verbatim from README.md, with only the container call swapped.
DOC="$(grep -F 'substrate-connect --merge-script | bash -s --' "$ROOT/README.md")"
[ "$(printf '%s\n' "$DOC" | grep -c .)" = 1 ] || { echo "FAIL - README.md no longer documents exactly one host-side merge instruction"; exit 1; }
DOC="${DOC//docker exec substrate-live substrate-connect/bash $T/s/substrate-connect.sh}"
emit() { # run the documented instruction -> RC; stdout+stderr in $T/out.txt
  ( cd "$T" && "${E[@]}" bash -c "$DOC" ) > "$T/out.txt" 2>&1; RC=$?
}
merge() { # [env...] -- connect-merge.sh directly with a values command -> RC
  ( cd "$T" && "${E[@]}" "$@" ) > "$T/out.txt" 2>&1; RC=$?
}
F="$T/home/.metabob/config.json"
owned='del(.metabob.endpoint, .metabob.apiKey, .substrate.gapStoreEndpoint)'
no_temp() { [ -z "$(find "$(dirname "$F")" "$T/home/.substrate" -maxdepth 1 -name '.connect-*' 2>/dev/null)" ]; }   # temp files sit next to the REAL file, now under ~/.substrate

# ── create ─────────────────────────────────────────────────────────────────────
echo active > "$T/devvessel"
emit
jq -e --arg g "$GS" --arg e "$EP" --arg k "$KEY" '. == {metabob:{endpoint:$e,apiKey:$k},substrate:{gapStoreEndpoint:$g}}' "$F" >/dev/null 2>&1 \
  && ok "create: no file and no directory -> created with the three keys" || { bad "create: rc $RC, $(cat "$F" 2>&1)"; sed 's/^/    /' "$T/out.txt"; }
[ "$(stat -L -c %a "$F" 2>/dev/null)" = 600 ] && ok "create: the file is mode 600" || bad "create: mode $(stat -L -c %a "$F" 2>/dev/null)"

# ── keep ───────────────────────────────────────────────────────────────────────
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
emit
[ "$RC" = 0 ] && ok "keep: the instruction exits 0" || { bad "keep: exit $RC"; sed 's/^/    /' "$T/out.txt"; }
[ "$(jq -c "$owned" "$T/before.json")" = "$(jq -c "$owned" "$F" 2>/dev/null)" ] && ok "keep: every key not owned by the fleet is kept, value for value" || bad "keep: other keys changed: $(jq -c "$owned" "$F" 2>&1)"
if [ "$(echo 100000000000000000001 | jq . 2>/dev/null)" = 100000000000000000001 ]; then
  grep -q '12345678901234567890' "$F" && ok "keep: the 20-digit integer keeps its literal (host $(jq --version))" || bad "keep: the big integer was rewritten"
else
  ok "keep: (host $(jq --version) is lossy: the literal check is the lossy-jq leg's)"
fi
jq -e --arg g "$GS" --arg e "$EP" --arg k "$KEY" '.substrate.gapStoreEndpoint == $g and .metabob.endpoint == $e and .metabob.apiKey == $k' "$F" >/dev/null \
  && ok "keep: gapStoreEndpoint updated, endpoint and apiKey set" || bad "keep: owned keys wrong"
[ "$(stat -L -c %a "$F")" = 600 ] && no_temp && ok "keep: mode 600, no temp file left" || bad "keep: mode $(stat -L -c %a "$F") or temp left"

# ── secrecy ────────────────────────────────────────────────────────────────────
grep -qF "$KEY" "$T/out.txt" && bad "secrecy: the API key was printed by the instruction" || ok "secrecy: the API key appears in no output, only in the target file"
grep -qF "provider-secret-placeholder" "$T/out.txt" && bad "secrecy: a provider key was printed" || ok "secrecy: no provider key printed"
"${E[@]}" bash "$T/s/substrate-connect.sh" --merge < "$F" > "$T/m.out" 2> "$T/m.err"; MRC=$?
[ "$MRC" = 64 ] && [ ! -s "$T/m.out" ] && grep -q 'connect-merge\|--merge-script' "$T/m.err" \
  && ok "secrecy: substrate-connect --merge is refused (exit 64), pointing at the host-side merge" || bad "secrecy: --merge rc $MRC"
V="$("${E[@]}" bash "$T/s/substrate-connect.sh" --values 2>/dev/null)"
printf '%s' "$V" | jq -e --arg g "$GS" --arg e "$EP" --arg k "$KEY" '. == {endpoint:$e,apiKey:$k,gapStoreEndpoint:$g}' >/dev/null 2>&1 \
  && ok "secrecy: --values prints only the three owned values" || bad "secrecy: --values printed something else"
cmp -s <("${E[@]}" bash "$T/s/substrate-connect.sh" --merge-script 2>/dev/null) "$ROOT/scripts/substrate/connect-merge.sh" \
  && ok "one implementation: --merge-script prints scripts/substrate/connect-merge.sh itself" || bad "--merge-script is not connect-merge.sh"

# ── unchanged: no development-vessel, file already up to date ──────────────────
echo inactive > "$T/devvessel"
printf '{"metabob": {"apiKey": "%s", "endpoint": "%s"},\n "substrate": {"gapStoreEndpoint": "http://kept.invalid"}, "defaults": {"model": "m-1"}}\n' "$KEY" "$EP" > "$F"
cp "$F" "$T/before.json"
emit
[ "$RC" = 0 ] && cmp -s "$F" "$T/before.json" && no_temp && ok "unchanged: byte-identical (an existing gapStoreEndpoint is not removed)" || { bad "unchanged: rc $RC, file changed"; diff "$T/before.json" "$F" | sed 's/^/    /'; }

# ── refuse: a failed merge never touches the file ──────────────────────────────
echo active > "$T/devvessel"
for bad_cfg in '{not json' '{"metabob": "a string"}' '[1, 2]' '{"a":1} {"b":2}'; do
  printf '%s\n' "$bad_cfg" > "$F"; cp "$F" "$T/before.json"
  emit
  [ "$RC" != 0 ] && cmp -s "$F" "$T/before.json" && no_temp && grep -q 'refusing' "$T/out.txt" \
    && ok "refuse ($bad_cfg): non-zero exit, file byte-identical, no temp left" || bad "refuse ($bad_cfg): rc $RC"
done
printf '{"defaults":{"model":"m-1"}}\n' > "$F"; cp "$F" "$T/before.json"
merge bash "$T/s/connect-merge.sh" "$F" false
[ "$RC" != 0 ] && cmp -s "$F" "$T/before.json" && no_temp && ok "refuse: a failing values command leaves the file byte-identical" || bad "refuse: failing values cmd rc $RC"
merge bash "$T/s/connect-merge.sh" "$F" echo '{"endpoint":"x"}'
[ "$RC" != 0 ] && cmp -s "$F" "$T/before.json" && no_temp && ok "refuse: values without an apiKey are refused" || bad "refuse: bad values rc $RC"
merge bash "$T/s/connect-merge.sh" "$F" printf 'apiKey=%s' "$KEY"
[ "$RC" != 0 ] && cmp -s "$F" "$T/before.json" && ! grep -qF "$KEY" "$T/out.txt" && ok "refuse: values that are not JSON are refused without quoting them" || bad "refuse: non-JSON values rc $RC or quoted"

# ── lossy jq: a stand-in for jq < 1.7 (rewrites the probe literal) runs the merge ──
REALJQ="$(command -v jq)"
printf '#!/usr/bin/env bash\nif [ "$#" = 1 ] && [ "$1" = . ]; then in="$(cat)"; [ "$in" = 100000000000000000001 ] && { echo 100000000000000000000; exit 0; }; printf %%s "$in" | exec %q .; fi\nexec %q "$@"\n' "$REALJQ" "$REALJQ" > "$T/lossy-jq"
chmod +x "$T/lossy-jq"
printf '{"nested":{"big":12345678901234567890},"defaults":{"model":"m-1"}}\n' > "$F"; cp "$F" "$T/before.json"
merge CONNECT_MERGE_JQ="$T/lossy-jq" bash "$T/s/connect-merge.sh" "$F" bash "$T/s/substrate-connect.sh" --values
[ "$RC" != 0 ] && cmp -s "$F" "$T/before.json" && no_temp && grep -q 'beyond 2^53' "$T/out.txt" \
  && ok "lossy jq: a config with a 20-digit integer is refused, byte-identical" || { bad "lossy jq: rc $RC"; sed 's/^/    /' "$T/out.txt"; }
printf '{"nested":{"small":12345},"defaults":{"model":"m-1"}}\n' > "$F"
merge CONNECT_MERGE_JQ="$T/lossy-jq" bash "$T/s/connect-merge.sh" "$F" bash "$T/s/substrate-connect.sh" --values
[ "$RC" = 0 ] && jq -e '.nested.small == 12345 and .defaults.model == "m-1" and (.metabob.apiKey | length) > 0' "$F" >/dev/null \
  && ok "lossy jq: a config without one still merges" || bad "lossy jq: small-number merge rc $RC"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
