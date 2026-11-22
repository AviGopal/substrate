#!/usr/bin/env bash
# deploy-hub-selection-resolves.test.sh: the unit selection deploy-hub.sh writes into the .env it hands
# deploy.sh resolves against the inventory the image ships.
#
#   bash validation/scripts/deploy-hub-selection-resolves.test.sh [repo-root]
#
# WHY. apply-inventory refuses to boot when ENABLED_EXTRA_VESSELS (or any selection) names a unit the
# inventory does not carry. deploy-hub.sh writes that selection from its own defaults, so a default that
# names a vessel which has since left the image stops every hub deployed with it, and nothing on the
# operator's side says so until the container fails to come up.
#
# HOW. deploy-hub.sh is run unchanged from a scratch directory whose deploy.sh is a stub that keeps the
# generated .env. RELAY_MULTIADDR is set, so no host is contacted. The selection variables from that
# .env are then planned by apply-inventory (DRY_RUN=1) against scripts/substrate/vessels.inventory.json.
#   (a) no ENABLED_EXTRA_VESSELS from the caller: the plan has no FATAL and exits 0.
#   (b) the caller names a unit the inventory carries: it is planned on top of the hub role group.
#   (c) the caller names a unit the inventory lacks: the plan is refused, so (a) can fail.
# Exit 0 = all pass.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
AI="$ROOT/scripts/substrate/apply-inventory.sh"
INV="$ROOT/scripts/substrate/vessels.inventory.json"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
ok()  { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fails=$((fails + 1)); }

echo "== deploy-hub-selection-resolves ($ROOT)"

cp "$ROOT/scripts/substrate/deploy-hub.sh" "$T/deploy-hub.sh"
cat > "$T/deploy.sh" <<'EOF'
#!/usr/bin/env bash
# Stub: keep the .env deploy-hub generated (passed as --env-file <path>).
while [ $# -gt 0 ]; do
  if [ "$1" = "--env-file" ]; then cp "$2" "$CAPTURE"; shift; fi
  shift
done
EOF
chmod +x "$T/deploy-hub.sh" "$T/deploy.sh"

# hub_env <label> [VAR=value ...] -> the .env deploy-hub generated, at $T/<label>.env
hub_env() {
  local label="$1"; shift
  env -i HOME="$T" PATH="$PATH" CAPTURE="$T/$label.env" ANTHROPIC_API_KEY=test-placeholder \
    RELAY_MULTIADDR=/ip4/192.0.2.1/tcp/30333/p2p/test "$@" \
    bash "$T/deploy-hub.sh" user@example.invalid 192.0.2.1 > "$T/$label.hub.log" 2>&1
}
# plan <label> -> apply-inventory's dry-run log for that .env's selection at $T/<label>.log; rc in $T/<label>.rc
plan() {
  local label="$1" sel=() k v
  while IFS='=' read -r k v; do
    case "$k" in ENABLED_ROLES|ENABLED_VESSELS|ENABLED_EXTRA_VESSELS|DISABLED_VESSELS|PROFILE) sel+=("$k=$v") ;; esac
  done < "$T/$label.env"
  env -i HOME="$T" PATH="$PATH" VESSELS_INVENTORY="$INV" DRY_RUN=1 "${sel[@]}" bash "$AI" > "$T/$label.log" 2>&1
  echo $? > "$T/$label.rc"
}

# (a) the default selection
hub_env default
if [ ! -s "$T/default.env" ]; then
  bad "(a) deploy-hub generated no .env: $(tail -3 "$T/default.hub.log" | tr '\n' ';')"
else
  plan default
  if [ "$(cat "$T/default.rc")" = 0 ] && ! grep -q FATAL "$T/default.log"; then
    ok "(a) the default selection resolves against the inventory"
  else
    bad "(a) the default selection is refused: $(grep FATAL "$T/default.log" | tr '\n' ';')"
  fi
fi

# (b) a caller-named unit the inventory carries
REAL="$(jq -r '.vessels[] | select((.retired // false) | not) | select(.role == "compute") | .unit' "$INV" | grep -m1 '\.service$')"
hub_env named ENABLED_EXTRA_VESSELS="$REAL"
plan named
if [ "$(cat "$T/named.rc")" = 0 ] && grep -q "ENABLED_EXTRA_VESSELS (additive): .*$REAL" "$T/named.log"; then
  ok "(b) a named unit the inventory carries ($REAL) is planned on top of the hub role group"
else
  bad "(b) expected $REAL planned as additive; got: $(grep -E 'ENABLED_EXTRA|FATAL' "$T/named.log" | tr '\n' ';')"
fi

# (c) a caller-named unit the inventory lacks
hub_env unknown ENABLED_EXTRA_VESSELS=no-such-vessel.service
plan unknown
if [ "$(cat "$T/unknown.rc")" != 0 ] && grep -q 'FATAL: ENABLED_EXTRA_VESSELS names no unit in the inventory' "$T/unknown.log"; then
  ok "(c) a named unit the inventory lacks is refused"
else
  bad "(c) expected a refusal for no-such-vessel.service; rc $(cat "$T/unknown.rc")"
fi

echo "== $fails failure(s)"
[ "$fails" = 0 ]
