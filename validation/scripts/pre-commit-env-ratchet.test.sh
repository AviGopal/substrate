#!/usr/bin/env bash
# pre-commit-env-ratchet.test.sh: the pre-commit block "env ratchet" must refuse a staged ADDED Environment= line under
# scripts/substrate/units/ (unit files and *.d/*.conf drop-ins) that sets a name scripts/git-hooks/env-ratchet/bootstrap-allowlist.txt
# does not carry, refuse a new drop-in setting a behaviour switch (the runtime-only satisfier drop-in, had it been committed),
# refuse growing the shrink-only grandfathered-behaviour.txt, and let bootstrap additions with a reason and removals through.
# The block is extracted from the real hook (between its own markers) and run under the hook's own `set -euo pipefail` in
# scratch repos carrying the real lists, so the hook's other checks (placement, gitleaks, glue tests) do not decide the result.
# A last pair of cases runs the WHOLE real hook in a scratch repo: placement still refuses an unrecognised top-level dir
# (ALLOWED_TOPLEVEL_DIRS unchanged) and the ratchet refuses before any later block runs. Never touches the real index.
# A hook can be skipped (--no-verify, an uninstalled clone): env-ratchet-committed-tree.test.sh judges the committed tree.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"; HOOK="$ROOT/scripts/git-hooks/pre-commit"
LISTS="$ROOT/scripts/git-hooks/env-ratchet"; UNITS="$ROOT/scripts/substrate/units"
T="$(mktemp -d "${TMPDIR:-/tmp}/pcer.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{ echo 'set -euo pipefail'
  awk '/^# ─── env ratchet: behaviour switches in units can only shrink ───/{on=1} /^# ─── end env ratchet ───/{on=0} on' "$HOOK"; } > "$T/block.sh"
/usr/bin/grep -q '^er_main || exit 1' "$T/block.sh" || { echo "FAIL - could not extract the env ratchet block from the hook"; exit 1; }
[ -f "$LISTS/bootstrap-allowlist.txt" ] && [ -f "$LISTS/grandfathered-behaviour.txt" ] || { echo "FAIL - the env-ratchet lists are missing under $LISTS"; exit 1; }
G() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=dev "$@"; }
U=scripts/substrate/units; L=scripts/git-hooks/env-ratchet
run() { (cd "$1" && RED= NC= DIM= YELLOW= bash "$T/block.sh") >"$T/out" 2>&1 </dev/null; }
refused() { # <repo> <label> <must-name>
  if run "$1"; then bad "$2: NOT refused"; elif /usr/bin/grep -qF -- "$3" "$T/out"; then ok "$2"; else bad "$2: refused without naming '$3': $(head -4 "$T/out" | tr '\n' ' ')"; fi; }
allowed() { if run "$1"; then ok "$2"; else bad "$2: refused: $(head -4 "$T/out" | tr '\n' ' ')"; fi; }
reset_to_base() { G -C "$1" reset -q --hard base; G -C "$1" clean -qfd; }

# Fixture: a unit with bootstrap + one grandfathered behaviour line, a drop-in dir, and the REAL lists.
R="$T/r"; G init -q "$R"; mkdir -p "$R/$U/goal-host-vessel.service.d" "$R/$L"
cp "$LISTS/bootstrap-allowlist.txt" "$LISTS/grandfathered-behaviour.txt" "$R/$L/"
printf '[Service]\nEnvironmentFile=/etc/substrate/env\nEnvironment=PORT=8210\nEnvironment=HOST=127.0.0.1\nEnvironment=GOAL_HOST_WS_SUBSCRIBER=off\nExecStart=/bin/true\n' > "$R/$U/goal-host-vessel.service"
printf '[Service]\nEnvironment=GOAL_HOST_DRAIN_MS=240000\n' > "$R/$U/goal-host-vessel.service.d/drain-timeout.conf"
G -C "$R" add -A; G -C "$R" commit -qm base; G -C "$R" tag base

allowed "$R" "nothing staged: the block is a no-op"

sed -i 's/^ExecStart=.*/Environment=GOAL_HOST_FAST_MODE=1\n&/' "$R/$U/goal-host-vessel.service"; G -C "$R" add -A
refused "$R" "refuses a new behaviour Environment= line in a unit" "GOAL_HOST_FAST_MODE"; reset_to_base "$R"

printf '[Service]\nEnvironment=SATISFIER_PROVEN_BAD_ARMED=1\n' > "$R/$U/goal-host-vessel.service.d/50-satisfier-suppression.conf"; G -C "$R" add -A
refused "$R" "refuses a new drop-in setting SATISFIER_PROVEN_BAD_ARMED=1" "SATISFIER_PROVEN_BAD_ARMED"
/usr/bin/grep -qF "(new drop-in)" "$T/out" && ok "names the refused file as a new drop-in" || bad "the new drop-in was not named as such"; reset_to_base "$R"

mkdir -p "$R/$U/ingest-docs.timer.d"; printf '[Timer]\nEnvironment=INGEST_EVERY=5\n' > "$R/$U/ingest-docs.timer.d/x.conf"; G -C "$R" add -A
refused "$R" "refuses a non-bootstrap name in a non-service drop-in (*.timer.d)" "INGEST_EVERY"; reset_to_base "$R"

sed -i 's/^ExecStart=.*/Environment=RELAY_URL=http:\/\/127.0.0.1:8500\n&/' "$R/$U/goal-host-vessel.service"; G -C "$R" add -A
refused "$R" "refuses a new bootstrap-looking name the allowlist does not carry" "RELAY_URL"
echo "RELAY_URL                  address of the federation relay" >> "$R/$L/bootstrap-allowlist.txt"; G -C "$R" add -A
allowed "$R" "allows a new bootstrap name once the allowlist carries it with a reason"
sed -i 's/^RELAY_URL .*/RELAY_URL/' "$R/$L/bootstrap-allowlist.txt"; G -C "$R" add -A
refused "$R" "refuses an allowlist entry without a reason" "RELAY_URL has no reason"; reset_to_base "$R"

sed -i '/^Environment=GOAL_HOST_WS_SUBSCRIBER=/d' "$R/$U/goal-host-vessel.service"; G -C "$R" rm -q "$U/goal-host-vessel.service.d/drain-timeout.conf"; G -C "$R" add -A
allowed "$R" "allows removing grandfathered behaviour lines (and a whole drop-in)"
sed -i '/^GOAL_HOST_WS_SUBSCRIBER /d' "$R/$L/grandfathered-behaviour.txt"; G -C "$R" add -A
allowed "$R" "allows removing a name from the grandfathered list (it shrinks)"; reset_to_base "$R"

echo "SATISFIER_PROVEN_BAD_ARMED   switch" >> "$R/$L/grandfathered-behaviour.txt"; G -C "$R" add -A
refused "$R" "refuses adding a name to the grandfathered behaviour list" "adds SATISFIER_PROVEN_BAD_ARMED"; reset_to_base "$R"

echo "WORKSPACE_ROOT   reclassified" >> "$R/$L/grandfathered-behaviour.txt"; G -C "$R" add -A
refused "$R" "refuses a bootstrap name added to the grandfathered list while it stays in the allowlist" "adds WORKSPACE_ROOT"
sed -i '/^WORKSPACE_ROOT /d' "$R/$L/bootstrap-allowlist.txt"; G -C "$R" add -A
allowed "$R" "allows MOVING a bootstrap name to the grandfathered list (a tightening)"; reset_to_base "$R"

sed -i 's/^Environment=GOAL_HOST_WS_SUBSCRIBER=off/Environment=GOAL_HOST_WS_SUBSCRIBER=on/' "$R/$U/goal-host-vessel.service"; G -C "$R" add -A
refused "$R" "refuses changing the value of a grandfathered behaviour line (a change belongs in a shape)" "GOAL_HOST_WS_SUBSCRIBER"; reset_to_base "$R"

echo "GOAL_HOST_WS_SUBSCRIBER    it is really an id" >> "$R/$L/bootstrap-allowlist.txt"; G -C "$R" add -A
refused "$R" "refuses reclassifying a grandfathered behaviour name as bootstrap" "cannot be reclassified"; reset_to_base "$R"

sed -i 's/^ExecStart=.*/Environment="PORT=8211" SNEAKY_SWITCH=1\n&/' "$R/$U/goal-host-vessel.service"; G -C "$R" add -A
refused "$R" "refuses a non-bootstrap name hidden in a multi-assignment line" "SNEAKY_SWITCH"; reset_to_base "$R"

sed -i 's/^ExecStart=.*/EnvironmentFile=-\/etc\/substrate\/retention-hold.env\n&/' "$R/$U/goal-host-vessel.service"; G -C "$R" add -A
refused "$R" "refuses a new EnvironmentFile= path the allowlist does not carry" "retention-hold.env"; reset_to_base "$R"
mkdir -p "$R/$U/x.service.d"; printf '[Service]\nEnvironmentFile=-/etc/substrate/env\nEnvironment=PORT=1\n' > "$R/$U/x.service.d/10.conf"; G -C "$R" add -A
allowed "$R" "allows a new drop-in that loads /etc/substrate/env and sets a bootstrap name"; reset_to_base "$R"

G -C "$R" rm -q "$L/bootstrap-allowlist.txt"; sed -i 's/^ExecStart=.*/Environment=PORT=1\n&/' "$R/$U/goal-host-vessel.service"; G -C "$R" add -A
refused "$R" "fails closed: no allowlist in the index while a unit line needs judging" "fail closed"; reset_to_base "$R"

# Seeding: HEAD has units but no lists (the commit that introduces the ratchet).
S="$T/s"; G init -q "$S"; mkdir -p "$S/$U" "$S/$L"
printf '[Service]\nEnvironment=PORT=1\nEnvironment=BOREDOM_MAX_CONCURRENT=3\n' > "$S/$U/a.service"; G -C "$S" add -A; G -C "$S" commit -qm base; G -C "$S" tag base
allowed "$S" "no lists anywhere and nothing to judge: no-op (scratch repos of other tests)"
cp "$LISTS/bootstrap-allowlist.txt" "$S/$L/"; printf 'BOREDOM_MAX_CONCURRENT  cap\n' > "$S/$L/grandfathered-behaviour.txt"; G -C "$S" add -A
allowed "$S" "seeding: allows a grandfathered list naming only what a unit at HEAD sets"
echo "NOT_AT_HEAD  switch" >> "$S/$L/grandfathered-behaviour.txt"; G -C "$S" add -A
refused "$S" "seeding: refuses a grandfathered name no unit at HEAD sets" "adds NOT_AT_HEAD"

# The committed-tree invariants (every unit name classified, grandfathered within a frozen copy, reasons present)
# are judged by validation/scripts/env-ratchet-committed-tree.test.sh, which also catches a --no-verify commit.

# The WHOLE real hook in a scratch repo: placement unchanged, and the ratchet refuses before any later block.
H="$T/h"; G init -q "$H"; mkdir -p "$H/scripts/git-hooks" "$H/$U" "$H/$L"
cp "$HOOK" "$H/scripts/git-hooks/pre-commit"; cp "$ROOT/.gitignore" "$H/.gitignore"; cp "$LISTS"/*.txt "$H/$L/"
printf '[Service]\nEnvironment=PORT=1\n' > "$H/$U/a.service"; G -C "$H" add -A; G -C "$H" commit -qm base --no-verify; G -C "$H" tag base
hook() { (cd "$H" && bash scripts/git-hooks/pre-commit) >"$T/out" 2>&1 </dev/null; }
mkdir -p "$H/junkdir"; echo x > "$H/junkdir/x.txt"; G -C "$H" add -A
if hook; then bad "whole hook: an unrecognised top-level dir was NOT refused"; else /usr/bin/grep -qF "unrecognised top-level directory" "$T/out" && ok "whole hook: placement still refuses an unrecognised top-level dir" || bad "whole hook: refused, but not by placement: $(head -3 "$T/out" | tr '\n' ' ')"; fi
reset_to_base "$H"
mkdir -p "$H/$U/a.service.d"; printf '[Service]\nEnvironment=SATISFIER_PROVEN_BAD_ARMED=1\n' > "$H/$U/a.service.d/50.conf"; G -C "$H" add -A
if hook; then bad "whole hook: the satisfier drop-in was NOT refused"; else /usr/bin/grep -qF "env ratchet" "$T/out" && ! /usr/bin/grep -qF "glue tests" "$T/out" && ok "whole hook: the ratchet refuses the satisfier drop-in before the glue tests run" || bad "whole hook: refused, but not by the ratchet first: $(head -3 "$T/out" | tr '\n' ' ')"; fi

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
