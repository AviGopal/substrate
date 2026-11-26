#!/usr/bin/env bash
# A script that runs under `set -o pipefail` must not pipe a writer that can be long into `grep -q`.
#
# The failure it pins: grep -q exits at its first match. A writer still writing (a value past the pipe's buffer) then
# takes SIGPIPE, and pipefail makes the pipeline's status the writer's 141: a line that is there reads as not there.
# The failing-test closer read its run's "(fail) <name>" lines this way, so on a long run it found none of a gap's
# names, called them absent from the file, and took the gap out of the walk while the run's own evidence (read whole by
# jq) said each one failed. pull-sync's federation block had the same race fixed once (pull-sync-fed-baked-tree); the
# check there covered only that block, so the closer kept it. This check covers every such script.
#
#   (a) [MUST-FAIL] every script in the tree (outside repos/) that sets pipefail has no such site, except those KNOWN
#       below, whose value is small by what it is (a name list, one row, a capped reply): a value that can be long is
#       read from a here-string (grep -q … <<<"$v"), which has no writer to kill
#   (b) every KNOWN entry still names a site: an entry nothing matches is removed, so the list stays what is there
#   (c) control: the finder finds a planted site, whatever its writer, and passes a here-string, a `|| grep -q` and a
#       script without pipefail
#   (d) control: the race is real (a long value with the match first reads as no match under pipefail)
#   (e) [MUST-FAIL] the test gate's timeout-only read (pull-sync prot_timeout_only, which defers a red file for a retry
#       when every failure is a per-test timeout) refuses a long run with an unhandled error first: an error between
#       tests is not a timeout, however long the run
#
# A site is any single `|` into grep -q, whatever writes into it (the class is a writer killed by grep's early exit,
# not one command). It is keyed by its file and the value fed to grep where the writer is printf, echo or cat of a
# "$…" (a value is small or not by what it is, wherever in the file it is read), else by its whole line.
# The gate's fixtures are scanned like any script: a new one with an early-match site fails (a). The accepted ones are
# KNOWN by why their sites cannot race, never by where they are.
# usage: validation/scripts/pipefail-grep-q.test.sh [tree root]
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SELF="validation/scripts/pipefail-grep-q.test.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

SITE='(^|[^|])\|[[:space:]]*(command[[:space:]]+)?grep[[:space:]]+(-[a-zA-Z]*q|[^|]*[[:space:]]-[a-zA-Z]*q)'
# sites <root> [file...]: "<file>\t<key>" for each site in a pipefail script (all of them under <root> when no file)
sites() {
  local root="$1"; shift
  { if [ "$#" -gt 0 ]; then printf '%s\n' "$@"
    else (cd "$root" && find . -path ./repos -prune -o -path ./.git -prune -o -name node_modules -prune -o -type f -print | sed 's#^\./##'); fi; } \
  | while IFS= read -r f; do
      [ "$f" = "$SELF" ] && continue
      command grep -qsE 'set -[a-zA-Z]*o pipefail|shopt -so pipefail' "$root/$f" || continue
      command grep -hE "$SITE" "$root/$f" | command grep -vE '^[[:space:]]*#' | while IFS= read -r l; do
        k="$(command grep -oE '(^|[^[:alnum:]_])(printf[^|]*|echo|cat)[[:space:]]+\\?"[^"]*"[[:space:]]*\|' <<<"$l" | head -n 1 | command grep -oE '\$\{?[A-Za-z_0-9@*]+|\$\([^)]*\)' | head -n 1)"
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
scripts/substrate/acceptance/run-acceptance.sh	if ! eng exec "$ACCEPTANCE_CONTAINER" journalctl -u substrate-pull-sync -n 1 --no-pager -q 2>/dev/null | grep -q .; then	at most one journal line (-n 1)
scripts/substrate/acceptance/secret-leak-scan.sh	fleet_key_named() { cut -f1 "$1" | grep -qxE 'SUBSTRATE_API_KEY|METABOB_API_KEY'; }	env names
scripts/substrate/apply-inventory.sh	all_units | grep -qx "$u" || continue          # not inventory-named at all	unit names
scripts/substrate/apply-inventory.sh	if all_units | grep -qx "$t.service"; then echo "$t.service"; return 0; fi	unit names
scripts/substrate/apply-inventory.sh	if all_units | grep -qx "$t"; then echo "$t"; return 0; fi	unit names
scripts/substrate/apply-inventory.sh	if all_units | grep -qx "$t.timer"; then echo "$t.timer"; return 0; fi	unit names
scripts/substrate/apply-inventory.sh	if manageable_units | grep -qx "$_svc"; then	unit names
scripts/substrate/apply-inventory.sh	if manageable_units | grep -qx "$_tmr"; then	unit names
scripts/substrate/apply-inventory.sh	manageable_units | grep -qx "$u" && continue   # handled by the loop above	unit names
scripts/substrate/federation-pull-sync.sh	if ! docker ps --format '{{.Names}}' | grep -qx "$c"; then	container names
scripts/substrate/gen-env.sh	&& grep -m1 '^API_KEY_SECRET=' "$SECRETS_FILE" | cut -d= -f2- | grep -q '^".*"$'; then	one secret's value, cut to its first line
scripts/substrate/reseed-restart.sh	systemctl show -p EnvironmentFiles --value "$u" 2>/dev/null | grep -q '/etc/substrate/env' || continue	one unit's property, or a scope's file list
scripts/substrate/secret-mask-probe.sh	if systemctl show -p DropInPaths --value "$u" 2>/dev/null | tr ' ' '\n' | grep -q "/$u.d/$DROPIN_NAME\$"; then	one unit's property, or a scope's file list
scripts/substrate/secret-mask-probe.sh	if systemctl show -p DropInPaths --value "$u.service" | tr ' ' '\n' | grep -q "/$u.service.d/$DROPIN_NAME\$"; then	one unit's property, or a scope's file list
scripts/substrate/secret-mask-probe.sh	scoped_files | grep -qxF "$1"	one unit's property, or a scope's file list
scripts/substrate/secret-mask-probe.sh	systemctl show -p EnvironmentFiles --value "$u.service" | grep -q "^$want (ignore_errors=no)" \	one unit's property, or a scope's file list
scripts/substrate/self-recovery-tick.sh	done" 2>/dev/null | grep -q yes	one HTTP code, or one yes
scripts/substrate/self-recovery-tick.sh	if csh "curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:$2/health 2>/dev/null" 2>/dev/null | grep -q 200; then return 0; fi	one HTTP code, or one yes
scripts/substrate/substrate-doctor.sh	if grep -v '^[[:space:]]*#' "$FP" 2>/dev/null | grep -q -e "$_pf"; then UF=0; else UF=1; fi	one unit file, or a unit list
scripts/substrate/substrate-doctor.sh	STORE_CLIENTS="$(csh 'systemctl list-units --type=service --state=active --no-legend --plain 2>/dev/null | awk "{print \$1}" | while read -r u; do systemctl show -p Wants -p Requires --value "$u" 2>/dev/null | tr " " "\n" | grep -qx surrealdb.service && echo "$u"; done' 2>/dev/null || true)"	one unit file, or a unit list
scripts/substrate/substrate-install.sh	&& head -1 docker-compose.yml 2>/dev/null | grep -q '^# Substrate launch manifest'; then	one line, or one port's listeners
scripts/substrate/substrate-install.sh	ss -Hltn "sport = :${prefix}${p}" 2>/dev/null | grep -q . && busy="$busy ${prefix}${p}"	one line, or one port's listeners
scripts/substrate/substrate-pull-sync.sh	curl -s -o /dev/null -w '%{http_code}' --max-time "${2:-5}" "http://127.0.0.1:$1/health" 2>/dev/null | grep -q '^200$'	one HTTP code, or one yes
scripts/substrate/substrate-pull-sync.sh	grep -E '^ExecStart=' "$f" | grep -qE '(^ExecStart=|[[:space:]])(\$\{SUBSTRATE_RUN_DIR\}|/workspace/active-scripts)/[A-Za-z0-9._-]+([[:space:]]|$)' || continue	one unit file's ExecStart lines
scripts/substrate/substrate-ready.sh	if csh "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:$port$path 2>/dev/null" 2>/dev/null | grep -q '^200$'; then	one HTTP code, or one yes
scripts/substrate/substrate-status.sh	|| { [ -r /proc/1/environ ] && tr '\0' '\n' </proc/1/environ 2>/dev/null | grep -q '^SUBSTRATE_PORT_PREFIX='; }; then	one process's environment
validation/scripts/commit-refused-filing.test.sh	$S	one value a test built (a summary, a cut block, a run's names)
validation/scripts/commit-refused-filing.test.sh	grep -E '^\[placement-gate\].*(401|credential refused)' "$T/env401.err" | grep -q 'pending-reports' \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/gen-env-bootstrap-key-policy.test.sh	grep -q 'draw_bootstrap_key' "$T/blk.sh" && tail -1 "$T/blk.sh" | grep -qx 'fi' && grep -q 'persisted_secret() {' "$T/ps.sh" \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/gen-env-surface-public-url.test.sh	awk '/^_ENV_SUPPLIED=""/{on=1} on && /; do$/{print; exit} on{print}' "$G" | grep -q 'HUMAN_SURFACE_PUBLIC_URL' \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/hub-firewall-18333.check.sh	mutations | grep -q "18080 -j RETURN" && bad "control: an empty ALLOW_18080_SRC still admits 18080" || ok "control: empty ALLOW_18080_SRC still closes 18080"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/lib-refresh-dropin.test.sh	stage_left() { find "$R" -name '.src-refresh.*' 2>/dev/null | grep -q .; }	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-bounce-quiesce.test.sh	done_line | grep -q 'synced=0 .*deferred=1 ' && ok "(a) the done line counts the deferred bounce as deferred, not synced" \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-bounce-quiesce.test.sh	done_line | grep -q 'synced=1 .*deferred=0 ' && ok "(b) the done line counts the taken bounce as synced, nothing deferred" \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-bounce-quiesce.test.sh	grep -E 'DEFERRING.*PENDING' "$OUT" | grep -q "$DV" && ok "(a) the deferred bounce is logged as DEFERRING ... PENDING naming development-vessel" \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-clone-deps.test.sh	grep 'GAP .*clone-dep-unbuilt' "$CALLS" | grep -q '@avigopal/ias-executor-ts' && ok "(l2) a gap names the package" || bad "(l2) no clone-dep-unbuilt gap naming @avigopal/ias-executor-ts (calls: $(grep -a '^GAP' "$CALLS" | cut -c1-200))"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-clone-deps.test.sh	grep 'GAP .*unresolvable-modules' "$CALLS" | grep -q '@avigopal/ias-executor-ts' && ok "(d) the gap names the module" || bad "(d) the gap does not name the module"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-clone-nested-deps.test.sh	grep 'GAP .*clone-nested-deps-install-failed' "$CALLS" | grep -q 'lockfile is frozen' && ok "(n5) the gap carries bun's frozen-lockfile error" \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-gtr-lib-missing.test.sh	tail -1 "$POSTS" | grep -q '"type":"record_read"' && { printf '[]'; exit 0; }	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-held-gap-release.test.sh	&& grep -qE '^lift_held_gaps_each "\$CLONE_DIR"' "$SCRIPT" && ! sed -n '/^while IFS=.|. read -r gv gq gh gd/,/^done/p' "$SCRIPT" | grep -q lift_held_gaps; then	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-installs-only-covered-paths.test.sh	if grep -nE 'mirror-to-live "\$v"' "$SCRIPT" | grep -q 'cov_'; then bad "(j) a mirror-to-live vessel call consults the coverage map"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-owed-restart-settle.test.sh	$SC	one value a test built (a summary, a cut block, a run's names)
validation/scripts/pull-sync-owed-restart.test.sh	if [ ! -e "$QD2/zz-last" ] && [ ! -e "$MARKER_DIR/zz-last.quiesce-carry" ] && rel_line zz-last | grep -q "fetch failed" && owed_kept zz-last; then	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-owed-restart.test.sh	if [ -n "$_ts" ] && [ "$_df" = "UNIT_TIMEOUT_S:-$_ts" ] && sed -n '/^quiesce_mark() {/,/^}/p' "$SCRIPT" | grep -q 'UNIT_TIMEOUT_S'; then	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-owed-restart.test.sh	if sed -n '/^quiesce_mark() {/,/^}/p' "$SCRIPT" | grep -q 'PULLSYNC_T0' \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-restart-window.test.sh	if [ "$Z" = '[[{"repo":"local-tools-vessel","commit":"c4","vessel":"tools"}]]' ] && why | grep -q '^pull-sync restarted local-tools-vessel walk-vessel:'; then	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-restart-window.test.sh	&& ! sed -n '/^restart /,$p' "$CALLS" | grep -q '^is-active --quiet described-shape-vessel.service$' \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-restart-window.test.sh	&& sed -n '/^restart /,$p' "$CALLS" | grep -q '^is-active --quiet described-shape-vessel.service$'; then	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-restart-window.test.sh	&& why | grep -q '^pull-sync restarted walk-vessel: a call cut by the restart (status 0) was stopped, not failed; it installed walk-vessel at c1|' \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-runtime-behind-clone-alarm.test.sh	grep -q "^CONVERGED $VESSEL" "$CALLS" && GV | grep -q " ${HEAD:0:10} passed$" && ok "(g) a passing gate records 'passed'" || bad "(g) passed verdict: '$(GV)'"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-runtime-behind-clone-alarm.test.sh	GV | grep -q " ${HEAD:0:10} blind: no countable result" && ok "(g) a blind gate records 'blind: no countable result' at its HEAD" || bad "(g) blind verdict: '$(GV)' (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-runtime-behind-clone-alarm.test.sh	m last_gate_verdict | grep -q 'blind: no countable result' && m wall_why | grep -q 'x1.5' && ok "(a) it carries the last gate verdict and the wall's why" || bad "(a) verdict/why: $(m last_gate_verdict) / $(m wall_why)"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-scrubbed-env-runtime-root.check.sh	keys="$(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$T/plain.out" | while read -r k; do val "$k" | grep -qE "$iso" || echo "$k"; done | sort | tr '\n' ' ' | sed 's/ $//')"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-seed-apply.test.sh	! grep -nE "^\[.*\] && apply_reseeded_seeds|^apply_reseeded_seeds( |$)" "$SCRIPT" | grep -q . || order_ok=0	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-carry.test.sh	grep 'carried candidate result DISCARDED' "$LOG" | grep -q 'changed: [a-z_, ]*\bhead\b' && ok "(c) the discard names the changed part: head" || bad "(c) the discard does not name head ($(grep -o 'DISCARDED.*from scratch' "$LOG" | head -1))"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-carry.test.sh	grep 'carried candidate result DISCARDED' "$LOG" | grep -q 'parts unknown (older carry)' && ok "(g) an older carry is discarded as 'parts unknown (older carry)'" || bad "(g) older carry: $(grep -o 'DISCARDED.*from scratch' "$LOG" | head -1)"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-carry.test.sh	ls "$MARKER_DIR" | grep -q 'testgate-carry\.tmp' && bad "(b) a temp carry file was left behind" || ok "(b) no temp carry file left behind"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_field "$ENV_GAP_ID" '.summary' | grep -qF "$MOD" && ok "(a) the environment gap's summary names the module" || bad "(a) the environment gap's summary does not name $MOD"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_ids | grep -q '^pull-sync-testgate-baseline-degraded-' && bad "(a) a degraded baseline was accepted" || ok "(a) no baseline-degraded gap"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_ids | grep -q '^pull-sync-testgate-baseline-degraded-' && bad "(b) a degraded baseline was accepted" || ok "(b) no baseline-degraded gap"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_ids | grep -q '^pull-sync-testgate-unresolvable-modules-' && bad "(a) a second gap for the same cause (unresolvable-modules) was filed alongside the environment gap" || ok "(a) one gap for one cause"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_ids | grep -q '^pull-sync-test-regression-' && bad "(a) an environment red filed a test-regression gap (it invites a lane to 'repair' a non-defect)" || ok "(a) no test-regression gap"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_ids | grep -qxF "$ENV_GAP_ID" && bad "(b) a commit's load regression was filed as an environment gap" || ok "(b) not classified as environment"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_ids | grep -qxF "$ENV_GAP_ID" && bad "(c) a green gate filed an environment gap" || ok "(c) no environment gap"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-environment-hold.test.sh	gap_ids | grep -qxF "pull-sync-testgate-unresolvable-modules-$VESSEL" && ok "(c) a green gate with a shared unresolvable module still files the unresolvable-modules gap" || bad "(c) the unresolvable-modules gap was not filed outside a hold (ids: $(gap_ids | tr '\n' ' '))"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-outstanding.test.sh	[ "$(og .status)" = open ] && outstanding_gap_names | grep -qxF "$X" && E_OPEN=$((E_OPEN+1))	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-outstanding.test.sh	grep '^GAP ' "$CALLS" | grep -q '"status":"closed"' && bad "(d) aging emitted a closed gap" || ok "(d) aging closed nothing"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-outstanding.test.sh	grep '^GAP ' "$CALLS" | grep -q '"status":"closed"' && E_CLOSED=$((E_CLOSED+1))	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-outstanding.test.sh	grep -q 'OUTSTANDING REGRESSION AGED' "$LOG" && grep 'OUTSTANDING REGRESSION AGED' "$LOG" | grep -qF "$X" && ok "(d) a distinct AGED notice names the name" || bad "(d) no 'OUTSTANDING REGRESSION AGED' line naming '$X'"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-outstanding.test.sh	outstanding_gap_names | grep -qxF "$X" && ok "(b2) the outstanding gap is re-emitted with the name" || bad "(b2) the outstanding gap was not re-emitted"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-outstanding.test.sh	outstanding_gap_names | grep -qxF "$X" && ok "(d) the name is still outstanding" || bad "(d) the name left the outstanding set by aging"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-slow-lane.test.sh	&& jq -r '.impulse.pointer.gap.summary' <<<"$G" | grep -q 'src/x.real.test.ts: (fail) real > boots'; then	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-unmeasured.test.sh	gap_field "pull-sync-testgate-blind-$VESSEL" '.summary' | grep -qi 'held' && ok "(f) the gap says the vessel is HELD" || bad "(f) the gap does not say the vessel is held: $(gap_field "pull-sync-testgate-blind-$VESSEL" '.summary' | cut -c1-200)"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-unmeasured.test.sh	gap_ids | grep -q 'budget-starved' && bad "(c) starved gap after one deferral" || ok "(c) no starved gap after one deferral"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-unmeasured.test.sh	gap_ids | grep -q 'budget-starved' && bad "(d) a new candidate inherited the starved gap" || ok "(d) no starved gap for the new candidate's first deferral"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-unmeasured.test.sh	gap_ids | grep -q '^pull-sync-testgate-unresolvable-modules-' && bad "(a) a second gap for the same cause" || ok "(a) one gap for one cause"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-unmeasured.test.sh	gap_ids | grep -qxF "pull-sync-testgate-blind-$VESSEL" && ok "(f) gap pull-sync-testgate-blind-$VESSEL" || bad "(f) no pull-sync-testgate-blind gap (ids: $(gap_ids | tr '\n' ' '))"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-unmeasured.test.sh	gap_ids | grep -qxF "pull-sync-testgate-budget-starved-$VESSEL" && D_GAPS="$D_GAPS $i"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-testgate-unmeasured.test.sh	gap_ids | grep -qxF "pull-sync-testgate-no-runner-$GTR_NODE" && ok "(b) gap pull-sync-testgate-no-runner-$GTR_NODE" || bad "(b) no pull-sync-testgate-no-runner-$GTR_NODE gap (ids: $(gap_ids | tr '\n' ' '))"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-tier-b-converges-baked-tree.test.sh	awk '/^converge_fleet_defs "/{f=1} f && /^converge_tier_b$/{print "after"; exit}' "$SCRIPT" | grep -q after \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-unhealthy-revert.test.sh	grep "pull-sync-unhealthy-$V" "$CALLS" | grep -q "reverted to" && bad "(e) the unhealthy gap claims a revert" || ok "(e) the unhealthy gap does not claim a revert"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/pull-sync-unhealthy-revert.test.sh	grep "pull-sync-unhealthy-$V" "$CALLS" | grep -q "unhealthy after the revert restart" && ok "(f) the gap carries the post-revert verdict" || bad "(f) the gap lacks the post-revert verdict"	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/retiring-names-gen-env.test.sh	$r	one value a test built (a summary, a cut block, a run's names)
validation/scripts/secret-dir-mask.test.sh	exempt_list | grep -qx "$u" || bad "(d) $u overrides the default-deny drop-in but is not in service.d/EXEMPT"	unit or env names
validation/scripts/secret-scope-lint.test.sh	consumers_of "$n" | grep -qx "$un" || bad "$u's resolved env holds $n, and the manifest does not name it a consumer"	unit or env names
validation/scripts/status-boot-stall-window.test.sh	grep -q 'boot_jobs_sample' "$T/blk.sh" 2>/dev/null && grep -q 'boot_jobs_sample() {' "$T/sample.sh" && tail -1 "$T/blk.sh" | grep -q 'esac' \	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/status-usable-walk.test.sh	if grep -q -- '--ask-rows' "$T/rows-block.sh" && tail -1 "$T/rows-block.sh" | grep -q '^    fi$'; then	a test fixture's own lines (its calls, log, gap rows, or a block cut from a script)
validation/scripts/gate/fixtures/walk-owner-seed-clone-repo.sh	$out	matches the drive's one VERDICT line, its last, so the writer has finished before grep can exit (an accepted gate fixture)
validation/scripts/gate/fixtures/walk-owner-seed-gap-site.sh	$out	matches the drive's one VERDICT line, its last, so the writer has finished before grep can exit (an accepted gate fixture)
validation/scripts/gate/fixtures/walk-owner-seed-repositories.sh	$out	matches the drive's one VERDICT line, its last, so the writer has finished before grep can exit (an accepted gate fixture)
validation/scripts/gate/fixtures/walk-owner-seed-rows.sh	$out	matches the drive's one VERDICT line, its last, so the writer has finished before grep can exit (an accepted gate fixture)
validation/scripts/gate/fixtures/walk-owner-seed-wait-bound.sh	$out	matches the drive's one VERDICT line, its last, so the writer has finished before grep can exit (an accepted gate fixture)
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
printf '#!/usr/bin/env bash\nset -uo pipefail\nif grep -q x <<<"$out"; then :; fi\nfalse || grep -q x f\n' > "$T/tree/here.sh"
printf '#!/usr/bin/env bash\nset -uo pipefail\njournalctl -u u --no-pager | grep -q .\n' > "$T/tree/writer.sh"
printf '#!/usr/bin/env bash\nif printf %s "$out" | grep -q x; then :; fi\n' "'%s\n'" > "$T/tree/nopipefail.sh"
C="$(sites "$T/tree" planted.sh here.sh nopipefail.sh writer.sh)"
if [ "$C" = "$(printf 'planted.sh\t$out\nwriter.sh\tjournalctl -u u --no-pager | grep -q .')" ]; then
  ok "(c) control: the finder names a planted site by its value and another writer's by its line, and passes a here-string, a || grep -q and a script without pipefail"
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
