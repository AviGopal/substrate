#!/usr/bin/env bash
# gate-public-read-only.test.sh: the reader-facing view of the accepted gate, and who may write it.
#
# development-vessel's self-fact judge must not trust the super-repo clone (its HEAD is an unjudged candidate)
# and cannot read /workspace/.gate. pull-sync therefore publishes /workspace/.gate-public/{self-facts.json,
# source.json} on every tick (publish_gate_public), and keeps the tick-script run dir on the accepted gate
# (reseed_run_dir_on_promote). Both directories are trust roots, so they are read-only for every unit except
# their writers. Checks:
#   A. units/service.d/06 and 07 make both directories read-only for every .service;
#   B. the writer overrides on disk equal service.d/WRITERS, which equals the reviewed set below;
#   C. no other unit file resets ReadOnlyPaths=;
#   D. entrypoint.sh creates both directories before systemd starts (a '-' path absent at unit start is skipped);
#   E. the gate-state marker list is one definition: gate-state-markers.json equals the lists spelled by
#      substrate-pull-sync.service, substrate-active-scripts-seed.service and publish_gate_public;
#   F. publish_gate_public, run in a sandbox: gated+accepted / gated without an accepted copy / ungated (the
#      clone's COMMITTED HEAD, not its working tree) / unchanged state is not rewritten / a promote rewrites;
#   G. reseed_run_dir_on_promote, run in a sandbox: reseeds on an accepted-sha change, not otherwise;
#   H. every profile that keeps development-vessel keeps the pull-sync timer, and every profile that keeps a unit
#      running from ${SUBSTRATE_RUN_DIR} keeps the seed or the pull-sync timer (apply-inventory dry runs).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
U="$ROOT/scripts/substrate/units"; PS="$ROOT/scripts/substrate/substrate-pull-sync.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/gate-public.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# A.
grep -qx 'ReadOnlyPaths=-/workspace/.gate-public' "$U/service.d/06-gate-public-read-only.conf" 2>/dev/null \
  && ok "A: service.d/06 makes /workspace/.gate-public read-only for every unit" || bad "A: service.d/06 missing or wrong"
grep -qx 'ReadOnlyPaths=-/workspace/active-scripts' "$U/service.d/07-run-dir-read-only.conf" 2>/dev/null \
  && ok "A: service.d/07 makes the run dir read-only for every unit" || bad "A: service.d/07 missing or wrong"

# B. The writer set: on disk == WRITERS == reviewed. Editing REVIEWED is the deliberate act of adding a writer.
REVIEWED='06-gate-public-read-only.conf substrate-pull-sync.service
07-run-dir-read-only.conf substrate-active-scripts-seed.service
07-run-dir-read-only.conf substrate-pull-sync.service'
disk="$(for f in "$U"/*.service.d/0[67]-*.conf; do [ -e "$f" ] || continue; d="${f%/*}"; echo "${f##*/} $(basename "$d" .d)"; done | sort)"
listed="$(grep -vE '^#|^$' "$U/service.d/WRITERS" 2>/dev/null | awk '{print $1, $2}' | sort)"
[ "$disk" = "$(sort <<<"$REVIEWED")" ] && ok "B: writer overrides on disk are exactly the reviewed set" \
  || { printf '  on disk:\n%s\n' "$disk" | sed 's/^/  /'; bad "B: writer overrides differ from the reviewed set"; }
[ "$listed" = "$(sort <<<"$REVIEWED")" ] && ok "B: service.d/WRITERS lists exactly the reviewed writers" || bad "B: service.d/WRITERS differs from the reviewed set"
for f in "$U"/*.service.d/0[67]-*.conf; do [ -e "$f" ] || continue
  grep -q '^ReadOnlyPaths' "$f" && bad "B: writer override ${f#$U/} sets ReadOnlyPaths"; done

# C.
resets="$(grep -rlx 'ReadOnlyPaths=' "$U" 2>/dev/null)"
[ -z "$resets" ] && ok "C: no unit resets ReadOnlyPaths=" || bad "C: ReadOnlyPaths= reset in: $(echo $resets)"

# D.
EP="$ROOT/scripts/substrate/entrypoint.sh"
mk="$(grep -n 'mkdir -p -m 0755 /workspace/.gate-public /workspace/active-scripts' "$EP" | head -1 | cut -d: -f1)"
ex="$(grep -nE '^exec .*(systemd|/sbin/init)' "$EP" | head -1 | cut -d: -f1)"
[ -n "$mk" ] && [ -n "$ex" ] && [ "$mk" -lt "$ex" ] && ok "D: entrypoint creates both directories before exec'ing systemd (line $mk < $ex)" \
  || bad "D: entrypoint does not create both directories before systemd (mkdir line '${mk:-none}', exec line '${ex:-none}')"

# E.
want="$(jq -r '.markers|join(" ")' "$ROOT/scripts/substrate/gate/gate-state-markers.json" 2>/dev/null)"
[ -n "$want" ] || bad "E: gate-state-markers.json unreadable"
for src in "$U/substrate-pull-sync.service" "$U/substrate-active-scripts-seed.service" "$PS"; do
  got="$(grep -oE 'for f in (accepted\.sha[a-z. ]*bootstrapped)' "$src" | head -1 | sed 's/^for f in //')"
  [ "$got" = "$want" ] && ok "E: ${src#$ROOT/} spells the marker list of gate-state-markers.json" || bad "E: ${src#$ROOT/} spells '$got', the data says '$want'"
done

# F. publish_gate_public in a sandbox.
{ sed -n '/^publish_gate_public() {/,/^}/p' "$PS"; } > "$T/pgp.sh"
grep -q 'self_facts_sha256' "$T/pgp.sh" || { bad "F: could not extract publish_gate_public"; }
log() { :; }
. "$T/pgp.sh"
G="$T/gate"; P="$T/pub"; export PULLSYNC_GATE_DIR="$G"; GATE_PUBLIC_DIR="$P"
SUPER_DIR="$T/super"; git init -q "$SUPER_DIR"; mkdir -p "$SUPER_DIR/scripts/substrate"
echo '{"rows":["clone-committed"]}' > "$SUPER_DIR/scripts/substrate/self-facts.json"
git -C "$SUPER_DIR" -c user.name=t -c user.email=t@t add -A >/dev/null; git -C "$SUPER_DIR" -c user.name=t -c user.email=t@t commit -qm c
echo '{"rows":["clone-WORKTREE-edit"]}' > "$SUPER_DIR/scripts/substrate/self-facts.json"   # uncommitted: must not publish
src() { jq -r '[.gated, .source, (.accepted_sha // "null")] | map(tostring) | join(" ")' "$P/source.json" 2>/dev/null; }
shaok() { [ "$(jq -r .self_facts_sha256 "$P/source.json")" = "$(sha256sum < "$P/self-facts.json" | cut -d' ' -f1)" ]; }
# ungated
rm -rf "$G" "$P"; mkdir -p "$G"; publish_gate_public
[ "$(src)" = "false clone null" ] && grep -q clone-committed "$P/self-facts.json" && shaok \
  && ok "F: ungated publishes the clone's COMMITTED self-facts (not its working tree), sha256 matching" || bad "F: ungated: got '$(src)', facts $(cat "$P/self-facts.json" 2>/dev/null)"
# gated with an accepted copy
A=0123456789abcdef0123456789abcdef01234567
mkdir -p "$G/accepted/scripts/substrate"; echo "$A" > "$G/accepted.sha"; echo '{"rows":["accepted-v1"]}' > "$G/accepted/scripts/substrate/self-facts.json"
publish_gate_public
[ "$(src)" = "true accepted $A" ] && grep -q accepted-v1 "$P/self-facts.json" && shaok \
  && ok "F: gated publishes the accepted self-facts with accepted_sha and a matching sha256" || bad "F: gated+accepted: got '$(src)'"
# unchanged -> not rewritten
w1="$(jq -r .written_at "$P/source.json")"; sleep 1; publish_gate_public
[ "$(jq -r .written_at "$P/source.json")" = "$w1" ] && ok "F: an unchanged state is not rewritten" || bad "F: unchanged state was rewritten"
# promote -> rewritten
B=fedcba9876543210fedcba9876543210fedcba98; echo "$B" > "$G/accepted.sha"; echo '{"rows":["accepted-v2"]}' > "$G/accepted/scripts/substrate/self-facts.json"
publish_gate_public
[ "$(src)" = "true accepted $B" ] && grep -q accepted-v2 "$P/self-facts.json" && shaok && ok "F: a promote republishes within the tick" || bad "F: promote not republished: '$(src)'"
# gated without a usable accepted copy (accepted.sha lost, ledger present) -> none, no rows
rm -f "$G/accepted.sha"; : > "$G/ledger.jsonl"; publish_gate_public
[ "$(src)" = "true none null" ] && [ ! -e "$P/self-facts.json" ] && [ "$(jq -r .self_facts_sha256 "$P/source.json")" = null ] \
  && ok "F: gated without accepted.sha publishes source=none and NO rows (a reader fails closed)" || bad "F: gated without accepted: got '$(src)'"

# G. reseed_run_dir_on_promote in a sandbox.
{ sed -n '/^reseed_run_dir_on_promote() {/,/^}/p' "$PS"; } > "$T/rr.sh"; . "$T/rr.sh"
RUN_DIR="$T/rd"; export PULLSYNC_ACCEPTED_DIR="$G/accepted"
mkdir -p "$G/accepted/scripts/substrate/units"; echo a > "$G/accepted/scripts/substrate/x.ts"; echo s > "$G/accepted/scripts/substrate/memory-budget-check.sh"; echo u > "$G/accepted/scripts/substrate/units/u.service"
echo "$A" > "$G/accepted.sha"; reseed_run_dir_on_promote
[ "$(cat "$RUN_DIR/.accepted.sha" 2>/dev/null)" = "$A" ] && [ -f "$RUN_DIR/x.ts" ] && [ -f "$RUN_DIR/memory-budget-check.sh" ] && [ -f "$RUN_DIR/units/u.service" ] \
  && ok "G: a run dir behind the accepted gate is reseeded (.ts, the .sh, units/) and stamped" || bad "G: first reseed incomplete"
echo b > "$G/accepted/scripts/substrate/x.ts"; reseed_run_dir_on_promote
[ "$(cat "$RUN_DIR/x.ts")" = a ] && ok "G: same accepted sha -> nothing copied" || bad "G: copied without an accepted-sha change"
echo "$B" > "$G/accepted.sha"; reseed_run_dir_on_promote
[ "$(cat "$RUN_DIR/x.ts")" = b ] && [ "$(cat "$RUN_DIR/.accepted.sha")" = "$B" ] && ok "G: a promote (new accepted sha) reseeds within the tick" || bad "G: promote did not reseed"

# H. Profiles.
INV="$ROOT/scripts/substrate/vessels.inventory.json"
rundir_units="$(grep -lE 'ExecStart=.*\$\{?SUBSTRATE_RUN_DIR\}?/' "$U"/*.service "$U"/*.service.d/*.conf 2>/dev/null \
  | sed -E 's#/[^/]+\.conf$##; s#\.d$##; s#.*/##' | sort -u)"   # a drop-in counts for the unit whose .d/ holds it
for p in $(jq -r '(.profiles|keys[]),(.composed_profiles|keys[])' "$INV"); do
  out="$(DRY_RUN=1 PROFILE="$p" VESSELS_INVENTORY="$INV" bash "$ROOT/scripts/substrate/apply-inventory.sh" 2>&1)"
  kept() { ! grep -q "would disable: $1\$" <<<"$out"; }
  if kept development-vessel.service && ! kept substrate-pull-sync.timer; then bad "H: profile $p keeps development-vessel without the pull-sync timer (no .gate-public marker: the self-fact reader fails closed)"; fi
  for ru in $rundir_units; do
    if kept "$ru" && ! kept substrate-active-scripts-seed.service && ! kept substrate-pull-sync.timer; then bad "H: profile $p keeps $ru (runs from the run dir) with neither the seed nor pull-sync"; fi
  done
done
[ "$FAILS" = 0 ] && ok "H: every profile keeping development-vessel keeps pull-sync, and every run-dir unit has a filler"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
