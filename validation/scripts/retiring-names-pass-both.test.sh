#!/usr/bin/env bash
# retiring-names-pass-both.test.sh: openspec retire-metabob-names 1.3. Every place that PASSES the fleet key or the
# client config path passes the new name beside the retiring one:
#   compose     the container receives SUBSTRATE_API_KEY and SUBSTRATE_ENDPOINT next to the METABOB_ names, so an
#               operator who sets the new name in .env is not silently dropped before gen-env reads it
#   installer   SUBSTRATE_API_KEY is a carried install input, and the generator's own guard (every carried input
#               is read by the manifest) passes on the real compose file; --key sets BOTH names, so a
#               SUBSTRATE_API_KEY already in the environment cannot override the key given on the command line
#   acceptance  every runner that sandboxes the client config with METABOB_CONFIG_PATH also sets
#               SUBSTRATE_CONFIG_PATH to the same path, so an operator shell's SUBSTRATE_CONFIG_PATH (which the
#               installer prefers) cannot point an acceptance install at the operator's real config
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
S="$ROOT/scripts/substrate"
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

for n in SUBSTRATE_API_KEY SUBSTRATE_ENDPOINT; do
  grep -qE "^[[:space:]]+$n: \\\$\{$n:-\}$" "$ROOT/docker-compose.yml" && ok "compose passes $n into the container" || bad "compose does not pass $n"
done

out="$(SUBSTRATE_MANIFEST="$ROOT/docker-compose.yml" bash "$S/substrate-install.sh" --help 2>&1)"; rc=$?
[ "$rc" = 0 ] && ! grep -q "is not read by the manifest" <<<"$out" && ok "installer: every carried input (SUBSTRATE_API_KEY included) is read by the manifest" || bad "installer guard: rc=$rc $(head -2 <<<"$out")"
grep -qE '^CARRY_NAMES="[^"]*\bSUBSTRATE_API_KEY\b' "$S/substrate-install.sh" && ok "installer carries SUBSTRATE_API_KEY" || bad "SUBSTRATE_API_KEY not carried"

line="$(grep -F '[ -n "$set_key" ] &&' "$S/substrate-install.sh")"
[ "$(grep -c . <<<"$line")" = 1 ] || bad "could not find the single --key assignment line"
got="$(env -i bash -c 'SUBSTRATE_API_KEY=ambient-other; set_key=from-flag; '"$line"'; printf "%s|%s" "${METABOB_API_KEY:-}" "${SUBSTRATE_API_KEY:-}"')"
[ "$got" = "from-flag|from-flag" ] && ok "--key sets both names, overriding an ambient SUBSTRATE_API_KEY" || bad "--key leaves: $got"

for f in "$S/acceptance/run-upgrade-acceptance.sh" "$S/acceptance/run-network-acceptance.sh"; do
  m=$(grep -oE 'METABOB_CONFIG_PATH="[^"]+"' "$f" | wc -l)
  p=$(grep -oE 'SUBSTRATE_CONFIG_PATH="([^"]+)" METABOB_CONFIG_PATH="\1"' "$f" | wc -l)
  [ "$m" -gt 0 ] && [ "$m" = "$p" ] && ok "$(basename "$f"): all $m config-path sandboxes set both names to the same path" || bad "$(basename "$f"): $p of $m paired"
done
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
