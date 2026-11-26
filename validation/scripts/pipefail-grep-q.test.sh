#!/usr/bin/env bash
# A script that runs under `set -o pipefail` must not test a value with `printf|echo|cat … | grep -q`.
#
# The failure it pins: grep -q exits at its first match. A writer still writing (a value past the pipe's buffer) then
# takes SIGPIPE, and pipefail makes the pipeline's status the writer's 141: a line that is there reads as not there.
# The failing-test closer read its run's "(fail) <name>" lines this way, so on a long run it found none of a gap's
# names, called them absent from the file, and took the gap out of the walk while the run's own evidence (read whole by
# jq) said each one failed. pull-sync's federation block had the same race fixed once (pull-sync-fed-baked-tree); the
# check there covered only that block, so the closer kept it. This check covers every such script.
#
#   (a) [MUST-FAIL] every script in the tree (outside repos/ and validation/scripts/gate/fixtures/) that sets pipefail
#       has no such site, except those KNOWN
#       below, whose value is small by what it is (a name list, one row, a capped reply): a value that can be long is
#       read from a here-string (grep -q … <<<"$v"), which has no writer to kill
#   (b) every KNOWN entry still names a site: an entry nothing matches is removed, so the list stays what is there
#   (c) control: the finder finds a planted site, and passes a here-string and a script without pipefail
#   (d) control: the race is real (a long value with the match first reads as no match under pipefail)
#   (e) [MUST-FAIL] the test gate's timeout-only read (pull-sync prot_timeout_only, which defers a red file for a retry
#       when every failure is a per-test timeout) refuses a long run with an unhandled error first: an error between
#       tests is not a timeout, however long the run
#
# A site is keyed by its file and the value fed to grep (the first "$…" the writer prints), or by its whole line where
# it prints no variable: a value is small or not by what it is, wherever in the file it is read.
# The gate's fixtures (validation/scripts/gate/fixtures/) are not scanned: the gate runs its accepted copies of them,
# which change only on the person's acceptance, and the value each one tests is a short drive's output.
# usage: validation/scripts/pipefail-grep-q.test.sh [tree root]
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SELF="validation/scripts/pipefail-grep-q.test.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

SITE='(printf|echo|cat)[^|]*\|[[:space:]]*(command[[:space:]]+)?grep[[:space:]]+(-[a-zA-Z]*q|[^|]*[[:space:]]-[a-zA-Z]*q)'
# sites <root> [file...]: "<file>\t<key>" for each site in a pipefail script (all of them under <root> when no file)
sites() {
  local root="$1"; shift
  { if [ "$#" -gt 0 ]; then printf '%s\n' "$@"
    else (cd "$root" && find . -path ./repos -prune -o -path ./.git -prune -o -path ./validation/scripts/gate/fixtures -prune -o -name node_modules -prune -o -type f -print | sed 's#^\./##'); fi; } \
  | while IFS= read -r f; do
      [ "$f" = "$SELF" ] && continue
      command grep -qsE 'set -[a-zA-Z]*o pipefail|shopt -so pipefail' "$root/$f" || continue
      command grep -hE "$SITE" "$root/$f" | command grep -vE '^[[:space:]]*#' | while IFS= read -r l; do
        k="$(command grep -oE '(printf[^|]*|echo|cat)[[:space:]]+\\?"[^"]*"[[:space:]]*\|' <<<"$l" | head -n 1 | command grep -oE '\$\{?[A-Za-z_0-9@*]+|\$\([^)]*\)' | head -n 1)"
        [ -n "$k" ] || k="$(sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' <<<"$l")"
        printf '%s\t%s\n' "$f" "$k"
      done
    done | sort -u
}

# KNOWN: <file>\t<key>\t<why its value is small>
cat > "$T/known" <<'K'
.claude/hooks/substrate-vessel-edit-gate.sh	$fp	a file path
scripts/substrate/acceptance/post-result.sh	printf '%s\n' "${cases[@]+"${cases[@]}"}" | grep -qxF "$case_name" || cases+=("$case_name")	the case names of one run
scripts/substrate/acceptance/run-acceptance.sh	${judged_levels	the level names
scripts/substrate/apply-inventory.sh	$DESIRED	unit names
scripts/substrate/apply-inventory.sh	$known_roles	role names
scripts/substrate/apply-inventory.sh	$ROLES	role names
scripts/substrate/apply-llm-arms.sh	$_expansion	one role's expansion line
scripts/substrate/gen-env.sh	$_known	the environment names this script writes
scripts/substrate/setup-git-push.sh	$report	cut at 3000 bytes
scripts/substrate/substrate-config.sh	$name	one name
scripts/substrate/substrate-doctor.sh	$STORE_PROBE	a probe's one-line reply
scripts/substrate/substrate-doctor.sh	$SURREAL_CHECK	a probe's one-line reply
scripts/substrate/substrate-doctor.sh	$uc	one unit's file
scripts/substrate/substrate-doctor.sh	$VALID	identity's validate reply
scripts/substrate/substrate-install.sh	$v	identity's validate reply
scripts/substrate/vessel-ctl.sh	$_inv	unit names
scripts/substrate/vessel-ctl.sh	$_inv_seed	unit names
validation/scripts/acceptance-upgrade-seeded-wait.test.sh	$cmd	one command line
validation/scripts/image-timers-run-on-a-fresh-boot.test.sh	$enabled	unit names
validation/scripts/lib-refresh-dropin.test.sh	$script	one ExecStart line
validation/scripts/pull-sync-clone-deps.test.sh	grep -B2 -A2 'echo "\$HEAD" > "\$LAST_GOOD_DIR/\$v"; rm -f "\$MARKER_DIR/\$v.fanout-fail"; log "\$v: fan-out healthy' "$SCRIPT" | grep -q 'refresh_clone_dependants "\$v" "\$d"' && ok "(k6) called after a credited fan-out" || bad "(k6) not called after a credited fan-out"	five lines of the script
validation/scripts/pull-sync-drift-quarantine.test.sh	$gap	one gap row
validation/scripts/pull-sync-fed-baked-tree.test.sh	$CHANGED	the race's own control, and a pattern that names the old form
validation/scripts/pull-sync-fed-baked-tree.test.sh	[ "$old" = 0 ] && ok "(j) control: the echo|grep -q form misses it under pipefail (the race is real)" || echo "  note: (j) the echo|grep -q control did not race on this host (got $old); (i) still holds"	text naming the old form, not a pipe
validation/scripts/pull-sync-owed-restart.test.sh	$line	one log line
validation/scripts/pull-sync-owed-restart.test.sh	$LOOP_HEAD	a loop's first lines
validation/scripts/pull-sync-testgate-contention-settle.test.sh	$HC_WHY	one reason line
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_field "$ENV_GAP_ID" '.classification_metadata.unresolvable_modules[]?' | grep -qxF "$MOD" && ok "(a) the environment gap names the unresolvable module" || bad "(a) the environment gap does not name $MOD in classification_metadata.unresolvable_modules"	one gap field's list
validation/scripts/pull-sync-testgate-outstanding.test.sh	og '.classification_metadata.aged_tests[]' | grep -qxF "$X" && ok "(d) aged_tests names it" || bad "(d) aged_tests does not name it"	one gap field's list
validation/scripts/pull-sync-testgate-rotation.test.sh	$FIRSTS4	four vessel names
validation/scripts/pull-sync-testgate-slow-lane.test.sh	$GATE_ARGV	argv lines
validation/scripts/pull-sync-testgate-slow-lane.test.sh	$SLOW_ARGV	argv lines
validation/scripts/pull-sync-testgate-unmeasured.test.sh	gap_field "$ENV_GAP_ID" '.classification_metadata.unresolvable_modules[]?' | grep -qxF "$MOD" && ok "(a) it names the module" || bad "(a) the environment gap does not name $MOD"	one gap field's list
validation/scripts/secret-scope-lint.test.sh	$env_now	one unit's environment names
validation/scripts/secret-scope-lint.test.sh	$SHARED_NAMES	environment names
K
cut -f1,2 "$T/known" | sort -u > "$T/known.keys"
sites "$ROOT" > "$T/found"

unknown="$(comm -23 "$T/found" "$T/known.keys")"
if [ -z "$unknown" ]; then ok "[MUST-FAIL] (a) no script that sets pipefail tests a value it may not hold whole with a pipe into grep -q"
else bad "(a) $(printf '%s\n' "$unknown" | wc -l) site(s) pipe a value into grep -q under pipefail (use grep -q … <<<\"\$v\"):"; printf '%s\n' "$unknown" | sed 's/^/       /'; fi

stale="$(comm -13 "$T/found" "$T/known.keys")"
if [ -z "$stale" ]; then ok "(b) every known small site is still there"
else bad "(b) known entries no site matches (remove them):"; printf '%s\n' "$stale" | sed 's/^/       /'; fi

mkdir -p "$T/tree"
printf '#!/usr/bin/env bash\nset -uo pipefail\nif printf %s "$out" | grep -q x; then :; fi\n' "'%s\n'" > "$T/tree/planted.sh"
printf '#!/usr/bin/env bash\nset -uo pipefail\nif grep -q x <<<"$out"; then :; fi\n' > "$T/tree/here.sh"
printf '#!/usr/bin/env bash\nif printf %s "$out" | grep -q x; then :; fi\n' "'%s\n'" > "$T/tree/nopipefail.sh"
C="$(sites "$T/tree" planted.sh here.sh nopipefail.sh)"
if [ "$C" = "$(printf 'planted.sh\t$out')" ]; then ok "(c) control: the finder names the planted site by its value, and passes a here-string and a script without pipefail"
else bad "(c) the finder found: $C"; fi

big="$(printf 'x\n'; head -c 8388608 /dev/zero | tr '\0' 'y' | fold -w 100)"
old="$(set -o pipefail; { printf '%s\n' "$big" | command grep -q '^x$'; } && echo 1 || echo 0)"
new="$(set -o pipefail; command grep -q '^x$' <<<"$big" && echo 1 || echo 0)"
if [ "$new" = 1 ] && [ "$old" = 0 ]; then ok "(d) control: an 8 MiB value with its match first: the pipe into grep -q reads no match, the here-string finds it"
elif [ "$new" = 1 ]; then ok "(d) control: the here-string finds the match"; echo "  note: (d) the pipe did not race on this host (got $old); (a) still holds"
else bad "(d) the here-string missed the match"; fi

PS="$ROOT/scripts/substrate/substrate-pull-sync.sh"
sed -n '/^  prot_timeout_only() {/,/^  }$/p' "$PS" > "$T/pto.sh"
if grep -q 'prot_timeout_only()' "$T/pto.sh"; then
  # shellcheck disable=SC1090
  source "$T/pto.sh"
  run="$(printf '# Unhandled error between tests\n'; head -c 8388608 /dev/zero | tr '\0' 'l' | fold -w 100; printf '\n(fail) a > b\n  ^ this test timed out after 5000ms.\n')"
  ok_run="$(printf '(fail) a > b\n  ^ this test timed out after 5000ms.\n')"
  if ! prot_timeout_only "$run" 1 1 && prot_timeout_only "$ok_run" 1 1; then
    ok "[MUST-FAIL] (e) a long red run with an unhandled error first is not timeout-only (a run of timeouts alone still is)"
  else bad "(e) prot_timeout_only read a long run with an unhandled error first as timeout-only"; fi
else bad "(e) could not extract prot_timeout_only from $PS"; fi

[ "$FAILS" = 0 ] && { echo "PASS - no script under pipefail reads a long value through a pipe into grep -q"; exit 0; }
echo "$FAILS FAILED"; exit 1
