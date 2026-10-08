#!/usr/bin/env bash
# acceptance-credential-fence.test.sh: the upgrade and network acceptance runners inherit the operator's shell,
# and the installer carries the fleet key (both names), the push token and every provider-section name from its
# environment into a throwaway fleet's .env. Each runner must unset all of them before it installs anything.
# The runner's own prologue, through the fence, is executed with every one of those names exported, in a sandbox
# that mirrors the repo layout (so the fence reads a real manifest), and must leave none of them set. A missing
# manifest refuses the run. The fence precedes the runner's first install.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/acc-fence.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
PROVIDERS="$(awk '/# ── Provider keys/{f=1;next} f&&/# ──/{exit} f' "$ROOT/docker-compose.yml" | grep -v '^[[:space:]]*#' | grep -oE '\$\{[A-Z][A-Z0-9_]*' | cut -c3- | sort -u | tr '\n' ' ')"
NAMES="METABOB_API_KEY SUBSTRATE_API_KEY SUBSTRATE_GIT_PAT $PROVIDERS"
[ "$(wc -w <<<"$PROVIDERS")" -ge 5 ] && ok "control: the manifest's provider section names $(wc -w <<<"$PROVIDERS") inputs" || bad "control: no provider names read"
for r in run-upgrade-acceptance.sh run-network-acceptance.sh; do
  f="$ROOT/scripts/substrate/acceptance/$r"
  end=$(grep -nF "| grep -v '^[[:space:]]*#' | grep -oE" "$f" | head -1 | cut -d: -f1)
  [ -n "$end" ] || { bad "$r: no fence found"; continue; }
  mkdir -p "$T/$r/scripts/substrate/acceptance"; cp "$ROOT/docker-compose.yml" "$T/$r/"
  sed -n "1,${end}p" "$f" > "$T/$r/scripts/substrate/acceptance/$r"
  printf '\nfor n in %s; do [ -n "${!n+x}" ] && echo "LEFT $n"; done; exit 0\n' "$NAMES" >> "$T/$r/scripts/substrate/acceptance/$r"
  left="$(env $(for n in $NAMES; do printf '%s=operator-real-value ' "$n"; done) bash "$T/$r/scripts/substrate/acceptance/$r" 2>&1)"
  [ -z "$left" ] && ok "$r: with every carried credential exported, the fence leaves none set" || bad "$r: $(tr '\n' ' ' <<<"$left")"
  rm "$T/$r/docker-compose.yml"; bash "$T/$r/scripts/substrate/acceptance/$r" >/dev/null 2>&1; rc=$?
  [ "$rc" = 64 ] && ok "$r: no manifest to read the provider names from refuses the run (64)" || bad "$r: missing manifest rc=$rc"
  first=$(grep -nE 'install-previous\.sh|run_case hub' "$f" | head -1 | cut -d: -f1)
  [ -n "$first" ] && [ "$end" -lt "$first" ] && ok "$r: the fence (line $end) precedes the first install (line $first)" || bad "$r: fence $end, first install ${first:-none}"
done
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
