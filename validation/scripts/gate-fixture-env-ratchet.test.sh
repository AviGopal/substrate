#!/usr/bin/env bash
# gate-fixture-env-ratchet.test.sh: the env ratchet's BLOCKING half, validation/scripts/gate/fixtures/env-ratchet-units.sh,
# judged the way the gate judges it. The pre-commit block and env-ratchet-committed-tree.test.sh are skippable; the gate
# is not: gate/candidate.sh runs the ACCEPTED fixture corpus through gate/shadow-eval.sh against `git archive <candidate>
# -- scripts/substrate`, and a refused candidate's units are never installed (gate_overlay keeps the accepted copies).
#
#   1. DRIFT. The fixture embeds the lists (shadow-eval exports scripts/substrate only). Every name and path in
#      scripts/git-hooks/env-ratchet/ must be in the embedded copy, else the gate refuses a tree the hook accepts: fail
#      here, at commit time. An embedded name the lists no longer carry is tolerated and noted: dropping it from the
#      fixture is an edit of an accepted fixture, a widening by candidate.sh, so a shrink of the lists must not force one.
#   2. The fixture passes this tree (the gate's own invocation: env -i, CANDIDATE_DIR = the archive).
#   3. Must-fails, each a --no-verify commit in a scratch repo (never the real index), judged on its git-archive export:
#      (a) a behaviour line in a unit; (b) a new drop-in setting SATISFIER_PROVEN_BAD_ARMED; (c) a new BOOTSTRAP name that
#      the lists carry (so the committed-tree check passes) but the fixture does not: refused, because a bootstrap
#      addition now needs the fixture edited, an operator review; (c2) an unpinned EnvironmentFile=.
#      (e) mutants: an always-pass fixture turns (a) green, so (a) detects it; a judge that skips drop-ins is caught by
#      the fixture's own positive control ("cannot judge").
#   4. The REAL shadow-eval.sh on a corpus of this fixture + parses.sh: (a) FAIL, the base PASS. federation-relay-large-frames
#      (needs a baked bun + relay node_modules) and no-self-exec-847025e2 (a 240 s pull-sync tick) are left out of this
#      scratch corpus; they judge other paths.
#   5. The REAL candidate.sh from a scratch accepted gate: (a) refused, its gate_candidate_refused gap naming
#      scripts/substrate/units/<path>:<line>: <NAME> (the line to revert), and (b) likewise; (c) with the fixture edited to admit the name is a
#      widening (never promoted on parity); a harmless unit edit soaks; the commit that ADDS the fixture to a corpus without
#      it soaks (status A is ordinary: it joins the accepted corpus when that candidate is promoted, no operator step) and is
#      not judged by its own fixture, even with a bad unit line in the same commit (the window, shown, not hidden).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
FX="$ROOT/validation/scripts/gate/fixtures/env-ratchet-units.sh"
LISTS="$ROOT/scripts/git-hooks/env-ratchet"
T="$(mktemp -d "${TMPDIR:-/tmp}/gfxer.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }; note() { echo "note - $*"; }
[ -f "$FX" ] || { echo "FAIL - no fixture at $FX"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "FAIL - cannot judge: jq is needed to run candidate.sh"; exit 1; }

# ── 1. drift ──
ents() { sed -e 's/^[[:space:]]*//' -e '/^#/d' -e '/^$/d' "$1" | awk '{print $1}'; }
blk="$(sed -n '/^# >>> embedded lists/,/^# <<< embedded lists/p' "$FX")"
if [ -z "$blk" ]; then bad "the fixture has no '# >>> embedded lists' block"; else
  emb="$(bash -c "$blk"$'\nprintf "B %s\\n" $ER_BOOTSTRAP_NAMES; printf "F %s\\n" $ER_PINNED_ENV_FILES; printf "G %s\\n" $ER_GRANDFATHERED')"
  src="$(ents "$LISTS/bootstrap-allowlist.txt" | /usr/bin/grep -v '^/' | sed 's/^/B /'; ents "$LISTS/bootstrap-allowlist.txt" | /usr/bin/grep '^/' | sed 's/^/F /'; ents "$LISTS/grandfathered-behaviour.txt" | sed 's/^/G /')"
  if [ -z "$src" ] || [ "$(wc -l <<<"$src")" -lt 3 ]; then bad "cannot read the lists under scripts/git-hooks/env-ratchet/"
  else
    missing="$(LC_ALL=C comm -23 <(LC_ALL=C sort -u <<<"$src") <(LC_ALL=C sort -u <<<"$emb") | tr '\n' ';')"
    extra="$(LC_ALL=C comm -13 <(LC_ALL=C sort -u <<<"$src") <(LC_ALL=C sort -u <<<"$emb") | tr '\n' ';')"
    [ -z "$missing" ] && ok "every name and path in scripts/git-hooks/env-ratchet/ is in the fixture's embedded lists" \
      || bad "the lists carry what the gate fixture does not (the gate would refuse a tree the hook accepts; a bootstrap addition needs the fixture edited, an operator review): ${missing}"
    if [ "$src" = "$emb" ]; then ok "the embedded lists equal the lists, entry for entry in file order ($(wc -l <<<"$src") entries)"
    elif [ -n "$extra" ]; then note "the fixture still admits ${extra} which the lists dropped (tolerated: editing an accepted fixture is a widening)"; fi
  fi
fi

# ── 2. this tree, invoked as shadow-eval invokes it ──
run_fx() { # <fixture> <candidate-dir> -> output in $T/fx.out, rc returned
  mkdir -p "$T/ws" "$T/home" "$T/tmp"
  env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" HOME="$T/home" TMPDIR="$T/tmp" LANG=C.UTF-8 \
    WORKSPACE_ROOT="$T/ws" PULLSYNC_BIN="$2/scripts/substrate/substrate-pull-sync.sh" CANDIDATE_DIR="$2" \
    timeout 120 bash "$1" > "$T/fx.out" 2>&1
}
if run_fx "$FX" "$ROOT"; then ok "(d) the fixture passes this tree: $(tail -1 "$T/fx.out")"; else bad "(d) the fixture refuses this tree: $(head -5 "$T/fx.out" | tr '\n' ' ')"; fi

# ── 3. scratch repo: each case a --no-verify commit, judged on its git-archive export ──
G() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=dev -c core.hooksPath=/dev/null "$@"; }
R="$T/r"; G init -q "$R"; mkdir -p "$R/scripts/substrate" "$R/scripts/git-hooks" "$R/validation/scripts/gate/fixtures"
cp "$ROOT/scripts/substrate/substrate-pull-sync.sh" "$R/scripts/substrate/"
cp -r "$ROOT/scripts/substrate/units" "$ROOT/scripts/substrate/gate" "$R/scripts/substrate/"
# This test judges which candidates SOAK (are promotable) versus are refused or widening, so it states its soak floor
# (3) in the scratch repo itself rather than inherit the policy's (1 since the shaped soak row). Pinned here, the
# accepted copy and every candidate carry the same floor, so no candidate reads as lowering it (a widening).
jq '.soak_ticks.default = 3' "$R/scripts/substrate/gate/gate-policy.json" > "$T/pol.json" && mv "$T/pol.json" "$R/scripts/substrate/gate/gate-policy.json"
cp -r "$LISTS" "$R/scripts/git-hooks/env-ratchet"
cp "$ROOT/validation/scripts/gate/fixtures/parses.sh" "$R/validation/scripts/gate/fixtures/"
G -C "$R" add -A; G -C "$R" commit -qm base0 --no-verify; BASE0="$(G -C "$R" rev-parse HEAD)"
cp "$FX" "$R/validation/scripts/gate/fixtures/"; G -C "$R" add -A; G -C "$R" commit -qm "add the fixture" --no-verify
BASE="$(G -C "$R" rev-parse HEAD)"; G -C "$R" tag base
export_of() { rm -rf "$T/x"; mkdir -p "$T/x"; G -C "$R" archive "$1" -- scripts/substrate | tar -x -C "$T/x"; }
commit_nv() { G -C "$R" add -A; G -C "$R" commit -qm "$1" --no-verify; G -C "$R" rev-parse HEAD; }
judged_refused() { # <commit> <must-name> [fixture] -> 0 when the fixture refuses the commit's export and names <must-name>
  export_of "$1"; ! run_fx "${3:-$FX}" "$T/x" && /usr/bin/grep -q '^FAIL - ' "$T/fx.out" && /usr/bin/grep -qF -- "$2" "$T/fx.out"
}
expect_refused() { # <label> <commit> <must-name>
  if judged_refused "$2" "$3"; then ok "$1"; else bad "$1: not refused naming '$3': $(head -3 "$T/fx.out" | tr '\n' ' ')"; fi
}
GH=scripts/substrate/units/goal-host-vessel.service
# The committed-tree check, read from its own file, so (c) shows it PASSING where the gate refuses.
CT="$ROOT/validation/scripts/env-ratchet-committed-tree.test.sh"
ct_def="$(sed -n '/^FROZEN_GRANDFATHERED="/,/"$/p' "$CT"; sed -n '/^check_tree() {/,/^}/p' "$CT")"
ct_judge() { rm -rf "$T/y"; mkdir -p "$T/y"; G -C "$R" archive "$1" | tar -x -C "$T/y"; bash -c "$ct_def"$'\ncheck_tree "$1"' _ "$T/y" > "$T/ct.out" 2>&1; }

if judged_refused "$BASE" "unused-name-never-printed"; then bad "(d) scratch base refused"; else
  /usr/bin/grep -q '^ok - ' "$T/fx.out" && ok "(d) positive control: the scratch base commit passes" || bad "(d) the scratch base fails: $(head -3 "$T/fx.out" | tr '\n' ' ')"; fi

printf 'Environment=FOO_ENABLED=1\n' >> "$R/$GH"; CA="$(commit_nv "behaviour line, hook skipped")"
expect_refused "(a) a --no-verify commit adding Environment=FOO_ENABLED=1 to a unit is REFUSED" "$CA" "FOO_ENABLED"
G -C "$R" reset -q --hard base

mkdir -p "$R/$GH.d"
printf '[Service]\nEnvironment=SATISFIER_PROVEN_BAD_ARMED=1\n' > "$R/$GH.d/50-satisfier-suppression.conf"; CB="$(commit_nv "drop-in, hook skipped")"
expect_refused "(b) a --no-verify new drop-in setting SATISFIER_PROVEN_BAD_ARMED=1 is REFUSED" "$CB" "SATISFIER_PROVEN_BAD_ARMED"
G -C "$R" reset -q --hard base

printf 'Environment=BRIDGE_PORT=8999\n' >> "$R/$GH"
printf 'BRIDGE_PORT                listen port of a new bridge\n' >> "$R/scripts/git-hooks/env-ratchet/bootstrap-allowlist.txt"
CC="$(commit_nv "new bootstrap name, listed with a reason")"
if [ -z "$ct_def" ]; then bad "(c) could not read check_tree from $CT"
elif ct_judge "$CC"; then ok "(c) control: the committed-tree check PASSES the new listed bootstrap name"
else bad "(c) control: the committed-tree check refuses it, so (c) proves nothing: $(head -3 "$T/ct.out" | tr '\n' ' ')"; fi
expect_refused "(c) a new bootstrap name the fixture's embedded list lacks is REFUSED at the gate (needs a fixture edit: an operator review)" "$CC" "BRIDGE_PORT"
# keep CC's tree for 5.; build (c+fixture) on top of it
sed -i 's/^OBSIDIAN_DISPLAY OBSIDIAN_GEOMETRY"$/OBSIDIAN_DISPLAY OBSIDIAN_GEOMETRY BRIDGE_PORT"/' "$R/validation/scripts/gate/fixtures/env-ratchet-units.sh"
CCF="$(commit_nv "admit it in the fixture")"
/usr/bin/grep -q 'OBSIDIAN_GEOMETRY BRIDGE_PORT"' "$R/validation/scripts/gate/fixtures/env-ratchet-units.sh" || bad "(c) could not edit the scratch fixture's list"
export_of "$CCF"; run_fx "$R/validation/scripts/gate/fixtures/env-ratchet-units.sh" "$T/x" \
  && ok "(c) control: the fixture edited to list BRIDGE_PORT passes that tree (the name, not the tree, was the refusal)" \
  || bad "(c) the edited fixture still refuses: $(head -3 "$T/fx.out" | tr '\n' ' ')"
G -C "$R" reset -q --hard base

printf 'EnvironmentFile=-/etc/substrate/retention-hold.env\n' >> "$R/scripts/substrate/units/activity-api.service"; CF="$(commit_nv "unpinned env file")"
expect_refused "(c2) a --no-verify commit loading an unpinned EnvironmentFile= is REFUSED" "$CF" "retention-hold.env"
G -C "$R" reset -q --hard base

printf '# a comment\n' >> "$R/$GH"; CH="$(commit_nv "harmless unit edit")"
if judged_refused "$CH" "unused-name-never-printed"; then bad "(d) a harmless unit edit is refused"; else
  /usr/bin/grep -q '^ok - ' "$T/fx.out" && ok "(d) a harmless unit edit passes" || bad "(d) a harmless unit edit fails: $(head -3 "$T/fx.out" | tr '\n' ' ')"; fi
G -C "$R" reset -q --hard base

# (e) mutants
M1="$T/mutant-always-pass.sh"; { head -n1 "$FX"; echo 'echo "ok - mutant"; exit 0'; tail -n +2 "$FX"; } > "$M1"
if judged_refused "$CA" "FOO_ENABLED" "$M1"; then bad "(e) an always-pass mutant still refuses (a): the case cannot tell a judging fixture from a rubber stamp"
else ok "(e) an always-pass mutant fixture turns (a) green, so (a) detects a fixture that stopped judging"; fi
M2="$T/mutant-no-dropins.sh"; sed 's/find "\$u" -type f -print0/find "$u" -maxdepth 1 -type f -print0/' "$FX" > "$M2"
if cmp -s "$FX" "$M2"; then bad "(e) could not build the no-drop-ins mutant (the find line moved?)"
else export_of "$CB"; run_fx "$M2" "$T/x"
  if /usr/bin/grep -q 'cannot judge: the judge.s positive control' "$T/fx.out"; then ok "(e) a judge that skips drop-ins is caught by the fixture's own positive control, not passed"
  else bad "(e) a judge that skips drop-ins was not caught by the positive control: $(head -3 "$T/fx.out" | tr '\n' ' ')"; fi
fi

# ── 4. the real shadow-eval.sh on a scratch corpus (this fixture + parses.sh) ──
SE="$ROOT/scripts/substrate/gate/shadow-eval.sh"
ACC="$T/acc"; mkdir -p "$ACC/validation/scripts/gate/fixtures"; cp "$FX" "$ROOT/validation/scripts/gate/fixtures/parses.sh" "$ACC/validation/scripts/gate/fixtures/"
sh_out="$(env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" HOME="$T/home" TMPDIR="$T/tmp" LANG=C.UTF-8 \
  SHADOW_FIXTURE_TIMEOUT=120 bash "$SE" --accepted "$ACC" --super "$R" --candidate "$CA" 2>&1)"; sh_rc=$?
if [ "$sh_rc" = 1 ] && /usr/bin/grep -q '^FAIL - env-ratchet-units.sh' <<<"$sh_out" && /usr/bin/grep -q '^PASS - parses.sh' <<<"$sh_out"; then
  ok "(a) the real shadow-eval.sh fails the candidate on env-ratchet-units.sh: $(/usr/bin/grep '^FAIL - env' <<<"$sh_out" | cut -c1-160)"
else bad "(a) shadow-eval.sh did not fail (a) on this fixture (rc=$sh_rc): $(tr '\n' ' ' <<<"$sh_out" | cut -c1-300)"; fi
sh_out="$(env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" HOME="$T/home" TMPDIR="$T/tmp" LANG=C.UTF-8 \
  SHADOW_FIXTURE_TIMEOUT=120 bash "$SE" --accepted "$ACC" --super "$R" --candidate "$BASE" 2>&1)"; sh_rc=$?
[ "$sh_rc" = 0 ] && /usr/bin/grep -q '2 fixture(s) pass' <<<"$sh_out" && ok "(d) the real shadow-eval.sh passes the base: $(tail -1 <<<"$sh_out")" \
  || bad "(d) shadow-eval.sh did not pass the base (rc=$sh_rc): $(tr '\n' ' ' <<<"$sh_out" | cut -c1-300)"

# ── 5. the real candidate.sh, run from a scratch accepted gate ──
mkgate() { # <dir> <accepted-sha>: accepted/ = git archive of the sha + a MANIFEST naming the policy's gate globs
  rm -rf "$1"; mkdir -p "$1/accepted"; G -C "$R" archive "$2" | tar -x -C "$1/accepted"
  jq -n '{sha:"scratch",gate_paths:["scripts/substrate/*","validation/scripts/*"],files:{}}' > "$1/accepted/MANIFEST.json"; echo "$2" > "$1/accepted.sha"
}
verdict_of() { # <gate-dir> <candidate> -> the verdict word
  env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" HOME="$T/home" TMPDIR="$T/tmp" LANG=C.UTF-8 SHADOW_FIXTURE_TIMEOUT=120 \
    bash "$1/accepted/scripts/substrate/gate/candidate.sh" --gate-dir "$1" --super "$R" --candidate "$2" > "$T/cs.out" 2>&1
  sed -n 's/^verdict \([a-z]*\) .*/\1/p' "$T/cs.out" | tail -1
}
expect_verdict() { # <label> <gate-dir> <candidate> <want>
  local v; v="$(verdict_of "$2" "$3")"
  [ "$v" = "$4" ] && ok "$1 → verdict $v" || bad "$1: want verdict $4, got '${v}': $(tr '\n' ' ' < "$T/cs.out" | cut -c1-300)"
}
GA="$T/gate"; mkgate "$GA" "$BASE"
expect_verdict "(a) candidate.sh refuses the behaviour-line commit" "$GA" "$CA" refused
gap_names() { # <label> <location> : the gate_candidate_refused gap's summary names the line to revert
  local sum; sum="$(sed -n 's/^GAP //p' "$T/cs.out" | jq -r 'select(.impulse.pointer.gap.category=="gate_candidate_refused") | .impulse.pointer.gap.summary' 2>/dev/null)"
  if [ -n "$sum" ] && /usr/bin/grep -qF -- "$2" <<<"$sum"; then ok "$1: the gate_candidate_refused gap names '$2'"
  else bad "$1: the gap summary does not name '$2': $(cut -c1-300 <<<"${sum:-no gap line}")"; fi
}
gap_names "(a)" "scripts/substrate/units/goal-host-vessel.service:$(G -C "$R" show "$CA:$GH" | wc -l): FOO_ENABLED"
sev="$(sed -n 's/^GAP //p' "$T/cs.out" | jq -r '.impulse.pointer.gap.severity // "absent"' 2>/dev/null | head -1)"
note "the gate_candidate_refused gap carries severity: ${sev:-unreadable} (candidate.sh's gap() sets none; the reader's category default applies)"
mkgate "$GA" "$BASE"; expect_verdict "(b) candidate.sh refuses the satisfier drop-in" "$GA" "$CB" refused
gap_names "(b)" "scripts/substrate/units/goal-host-vessel.service.d/50-satisfier-suppression.conf:2: SATISFIER_PROVEN_BAD_ARMED"
mkgate "$GA" "$BASE"; expect_verdict "(c) candidate.sh refuses an unlisted bootstrap name" "$GA" "$CC" refused
mkgate "$GA" "$BASE"; expect_verdict "(c) editing the accepted fixture to admit it is a WIDENING (an operator review, never parity)" "$GA" "$CCF" widening
mkgate "$GA" "$BASE"; expect_verdict "(d) a harmless unit edit soaks (promotable after the soak)" "$GA" "$CH" soaking
GZ="$T/gate0"; mkgate "$GZ" "$BASE0"
expect_verdict "the commit that ADDS the fixture soaks: status A is ordinary, it joins the accepted corpus on promotion" "$GZ" "$BASE" soaking
G -C "$R" checkout -q "$BASE0"; cp "$FX" "$R/validation/scripts/gate/fixtures/"; printf 'Environment=FOO_ENABLED=1\n' >> "$R/$GH"
CW="$(commit_nv "add the fixture and a bad line together")"; G -C "$R" checkout -q base
mkgate "$GZ" "$BASE0"
expect_verdict "the window: the adding commit is not judged by its own fixture, even with a bad line in it" "$GZ" "$CW" soaking

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
