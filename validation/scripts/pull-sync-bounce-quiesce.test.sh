#!/usr/bin/env bash
# A shared-package DEPENDENCY BOUNCE honours the same in-flight quiesce and compose
# ceiling as pull-sync's own convergence restart (scripts/substrate/substrate-pull-sync.sh,
# 2c "Shared-package fan-out" vs 3. "IN-FLIGHT WORK ON THE ORCHESTRATING VESSEL DEFERS
# ITS RESTART" and restart_age_defer).
#
# Measured: a feature_compose on development-vessel was lost when an ias-executor-ts
# change converged and the fan-out restarted its consumers one after another —
# local-tools-vessel (running the compose's test suite) and then development-vessel
# itself ("dependency bounce after ias-executor-ts converged"), while development-vessel's
# /health reported a young in-flight request. The convergence restart of a vessel's OWN
# code already defers on exactly that signal ("DEFERRING restart ... recorded as PENDING");
# the fan-out loop restarted every consumer unconditionally. There is no `systemctl stop`
# in pull-sync: the local-tools-vessel stop is the same fan-out loop's restart (it is a
# file: consumer of ias-executor-ts), so it is covered here as the second must-fail.
#
# Runs the WHOLE substrate-pull-sync.sh (paths rewritten to temp dirs; systemctl, curl,
# sleep and bun stubbed) with the REAL mirror-to-live.sh, against temp remotes for
# development-vessel and local-tools-vessel (units, health ports) and ias-executor-ts
# (no unit, a build script, a dist both consumers file:-depend on). The curl stub serves
# each port's /health body from a file, so in_flight / in_flight_oldest_ms are set per case.
#
#   (a) MUST-FAIL  ias-executor-ts converges while development-vessel reports 1 in-flight
#                  request younger than the ceiling: no consumer is restarted that tick
#                  (neither development-vessel nor local-tools-vessel), and the deferral
#                  is logged as DEFERRING ... PENDING naming development-vessel
#   (b) MUST-FAIL  the next tick, in_flight 0, takes the owed bounce: exactly one restart
#                  of each consumer
#   (c) CONTROL    the same tick with in_flight 0 bounces immediately (once each)
#   (d) CONTROL    an in-flight request OLDER than the ceiling does not block the bounce
#   (e) CONTROL    the existing owed-restart deferral of a vessel's own convergence is
#                  unchanged (defers + PENDING, then one restart on the next idle tick)
#   (f) STARVATION a consumer busy on EVERY tick gets its bounce within the shaped tick
#                  bound (pull_sync.bounce_defer_max_ticks, served by the tuning-params stub):
#                  below it the bounce still defers; at it the bounce proceeds, logs
#                  FORCED-AFTER-DEFER, and files exactly one gap with a stable id
#   (g) STARVATION the same through the age bound (pull_sync.bounce_defer_max_seconds)
#   (h) SECRET     the tuning read authenticates without the API key in any curl argv
#                  (/proc/<pid>/cmdline is world-readable in the container); the key does
#                  reach curl, through its stdin config
#   (i) FALLBACK   a 401 or unreachable tuning store yields the default and is recorded
#                  visibly, exactly once per name per tick, even with two shared packages
#                  reading both names in the same tick
#   The done line counts a deferred bounce as deferred, never as synced ((a), (b)).
#
# The fixture guard keys on the "shared package changed" line ANYWHERE in the output, or on
# a structured DEFERRAL_LOG record for the package, so a harmless reordering of the log
# cannot make the cases vacuous.
#
# usage: validation/scripts/pull-sync-bounce-quiesce.test.sh [repo-root]
# Needs bash, git, jq, tar, md5sum. No root, no live state: every path is a temp dir.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRIPT="$ROOT/scripts/substrate/substrate-pull-sync.sh"
MIRROR="$ROOT/scripts/substrate/mirror-to-live.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }

# ── the script under test, its fixed paths moved into the temp tree ─────────────
sed -e "s#/usr/local/share/substrate#$T/share#g" -e "s#/usr/local/bin#$T/bin#g" \
    -e "s#/usr/lib/systemd/system#$T/unit#g" -e "s#/etc/substrate#$T/etc#g" \
    -e "s#/root/.bun/bin#$T/bunbin#g" -e "s#/workspace#$T/ws#g" "$SCRIPT" > "$T/pull-sync.sh"

DV=development-vessel; LT=local-tools-vessel; PKG=ias-executor-ts
DV_PORT=18901; LT_PORT=18902
CALLS="$T/calls.txt"; OUT="$T/out.txt"; ALLCALLS="$T/allcalls.txt"

# ── stubs ────────────────────────────────────────────────────────────────────────
mkdir -p "$T/stub" "$T/bin" "$T/bunbin" "$T/share/lib" "$T/unit" "$T/etc" "$T/health" "$T/tuning"
cp "$(dirname "$SCRIPT")/lib/gap-tracked-red.sh" "$T/share/lib/"
cat > "$T/stub/systemctl" <<EOF
#!/usr/bin/env bash
echo "systemctl \$*" >> "$CALLS"
case "\$1" in
  is-enabled) echo enabled ;;
  is-active) case " \$* " in *" $DV.service "*|*" $LT.service "*) exit 0 ;; *) exit 3 ;; esac ;;
esac
exit 0
EOF
# /health: the status probe (-w %{http_code}) answers 200; a body read gets the port's file.
cat > "$T/stub/curl" <<EOF
#!/usr/bin/env bash
echo "curl \$*" >> "$CALLS"
case "\$*" in
  */v2/tuning-params/*) a="\$*"; n="\${a##*/v2/tuning-params/}"; n="\${n%% *}"
             case " \$* " in *" -K - "*) cat >> "$T/curlcfg" ;; esac
             case "\$(cat "$T/tuning-mode" 2>/dev/null)" in
               down) printf 000; exit 7 ;;
               401) printf '{"error":"unauthorized"}\n401'; exit 0 ;;
             esac
             cat "$T/tuning/\$n" 2>/dev/null || printf '{"name":"%s","value":null}' "\$n"; printf '\n200'; exit 0 ;;
  *http_code*) printf 200; exit 0 ;;
  */health*) p="\$(printf '%s' "\$*" | grep -o '127\.0\.0\.1:[0-9]*' | head -1 | cut -d: -f2)"
             cat "$T/health/\$p" 2>/dev/null || printf '{"status":"ok"}'; exit 0 ;;
esac
exit 7
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/stub/sleep"
# bun: the package build writes a dist; anything else is a no-op
cat > "$T/bunbin/bun" <<'EOF'
#!/usr/bin/env bash
out=""; prev=""
for a in "$@"; do [ "$prev" = --outDir ] && out="$a"; prev="$a"; done
if [ "$1" = run ] && [ "$2" = tsc ] && [ -n "$out" ]; then mkdir -p "$out"; echo "// built $(date +%s%N)" > "$out/index.js"; exit 0; fi
if [ "$1" = run ] && [ "$2" = build ]; then mkdir -p dist; echo "// built $(date +%s%N)" > dist/index.js; exit 0; fi
exit 0
EOF
sed -e "s#/root/.bun/bin#$T/bunbin#g" "$MIRROR" > "$T/bin/mirror-to-live"
chmod +x "$T/stub/"* "$T/bunbin/bun" "$T/bin/mirror-to-live"
printf '{"vessels":[{"repo":"%s","unit":"%s.service","health_port":"%s"},{"repo":"%s","unit":"%s.service","health_port":"%s"}]}\n' \
  "$DV" "$DV" "$DV_PORT" "$LT" "$LT" "$LT_PORT" > "$T/share/vessels.inventory.json"

# ── fixture ──────────────────────────────────────────────────────────────────────
seed() { # vessel package.json-body
  local v="$1" S="$T/seed/$1"
  git init -q --bare "$T/o/$v.git"; git -C "$T/o/$v.git" symbolic-ref HEAD refs/heads/dev
  mkdir -p "$S/src"; printf '%s\n' "$2" > "$S/package.json"
  echo 'export const x = 1;' > "$S/src/index.ts"
  printf 'node_modules\ndist\n' > "$S/.gitignore"
  git -C "$S" init -q -b dev; g "$S" add -A; g "$S" commit -m base
  g "$S" remote add origin "$T/o/$v.git"; g "$S" push origin dev
  git clone -q --branch dev "$T/o/$v.git" "$T/ws/git/vessels/$v"
  mkdir -p "$T/rt/$v"
  MITOSIS_RUNTIME_DIR="$T/rt" bash "$T/bin/mirror-to-live" "$v" "$T/ws/git/vessels" >/dev/null 2>&1
  [ -f "$T/rt/$v/package.json" ] || cp "$S/package.json" "$T/rt/$v/package.json"
  git -C "$S" rev-parse HEAD > "$T/ws/.last-good/$v"
}
push_change() { # vessel
  local S="$T/seed/$1"
  echo "export const y = $RANDOM;" >> "$S/src/index.ts"; g "$S" commit -am change; g "$S" push origin dev
}
setup() {
  rm -rf "$T/ws" "$T/rt" "$T/o" "$T/seed" "$T/health"/* "$T/tuning"/* "$T/tuning-mode" "$T/curlcfg"; : > "$CALLS"; : > "$ALLCALLS"
  mkdir -p "$T/ws/git/vessels" "$T/ws/.last-good" "$T/rt" "$T/o"
  local dep='{"name":"%s","dependencies":{"@avigopal/ias-executor-ts":"file:../ias-executor-ts"}}'
  # shellcheck disable=SC2059
  seed "$DV" "$(printf "$dep" "$DV")"
  # shellcheck disable=SC2059
  seed "$LT" "$(printf "$dep" "$LT")"
  seed "$PKG" '{"name":"@avigopal/ias-executor-ts","scripts":{"build":"tsc"}}'
  echo '{}' > "$T/rt/$PKG/tsconfig.build.json"
  mkdir -p "$T/rt/$PKG/dist"; echo '// old build' > "$T/rt/$PKG/dist/index.js"
}
health() { # port in_flight [oldest_ms]
  if [ -n "${3:-}" ]; then printf '{"status":"ok","in_flight":%s,"in_flight_oldest_ms":%s}\n' "$2" "$3" > "$T/health/$1"
  else printf '{"status":"ok","in_flight":%s}\n' "$2" > "$T/health/$1"; fi
}
run() { # [VAR=value ...] extra environment for this tick
  : > "$CALLS"
  ( unset SUBSTRATE_UPDATE_CHANNEL COMPOSE_CEILING_MS RESTART_DEFER_MAX METABOB_API_KEY ACTIVITY_API_ENDPOINT
    PATH="$T/stub:$PATH" MITOSIS_PUSH_CLONE_DIR="$T/ws/git/vessels" MITOSIS_RUNTIME_DIR="$T/rt" \
    SUPER_REPO_DIR="$T/ws/git/no-super-repo" STAGGER_SECONDS=0 GATE_BUDGET_SECONDS=0 DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 \
    env "$@" timeout 120 bash "$T/pull-sync.sh" > "$OUT" 2>&1 ); RC=$?
  cat "$CALLS" >> "$ALLCALLS"
}
tuning() { printf '{"name":"%s","value":%s}' "$1" "$2" > "$T/tuning/$1"; }
fallbacks() { grep -c "tuning_param_fallback name=$1 reason=$2 " "$OUT"; }
done_line() { grep 'done — synced=' "$OUT" | tail -1; }
fanout_ran() { grep -q "$PKG: shared package changed" "$OUT" || grep -q "\"vessel\":\"$PKG\"" "$T/ws/pull-sync-deferrals.jsonl" 2>/dev/null; }
gaps_forced() { grep -c "pull-sync-bounce-forced-$PKG" "$ALLCALLS"; }
restarts() { grep -c "^systemctl restart $1.service" "$CALLS"; }
show() { sed 's/^/    /' "$OUT" | grep -v '^    $' | tail -25; }

# ── (a) young in-flight on development-vessel: the fan-out bounce defers ─────────
setup; push_change "$PKG"
health "$DV_PORT" 1 60000; health "$LT_PORT" 0 0
run
fanout_ran || { bad "fixture: the shared-package fan-out never ran"; show; }
[ "$(restarts "$DV")" = 0 ] && ok "(a) development-vessel is not restarted while its young in-flight request runs" \
  || bad "(a) development-vessel restarted by the dependency bounce under a young in-flight request"
[ "$(restarts "$LT")" = 0 ] && ok "(a) local-tools-vessel is not stopped while development-vessel has young in-flight work" \
  || bad "(a) local-tools-vessel stopped by the dependency bounce while development-vessel had young in-flight work"
grep -E 'DEFERRING.*PENDING' "$OUT" | grep -q "$DV" && ok "(a) the deferred bounce is logged as DEFERRING ... PENDING naming development-vessel" \
  || bad "(a) no DEFERRING ... PENDING line naming development-vessel for the dependency bounce"
done_line | grep -q 'synced=0 .*deferred=1 ' && ok "(a) the done line counts the deferred bounce as deferred, not synced" \
  || bad "(a) the done line does not count the deferred bounce as deferred=1 with synced=0"

# ── (b) the next tick, idle: the owed bounce is taken once ───────────────────────
health "$DV_PORT" 0 0
run
[ "$(restarts "$DV")" = 1 ] && ok "(b) the next idle tick takes the owed bounce of development-vessel exactly once" \
  || bad "(b) the next idle tick did not take the owed bounce of development-vessel exactly once"
[ "$(restarts "$LT")" = 1 ] && ok "(b) the next idle tick takes the owed bounce of local-tools-vessel exactly once" \
  || bad "(b) the next idle tick did not take the owed bounce of local-tools-vessel exactly once"

done_line | grep -q 'synced=1 .*deferred=0 ' && ok "(b) the done line counts the taken bounce as synced, nothing deferred" \
  || bad "(b) the done line does not count the taken bounce as synced=1 with deferred=0"

# ── (c) control: idle on the first tick bounces immediately ──────────────────────
setup; push_change "$PKG"
health "$DV_PORT" 0 0; health "$LT_PORT" 0 0
run
[ "$(restarts "$DV")" = 1 ] && ok "(c) control: idle development-vessel is bounced once on the converging tick" \
  || { bad "(c) control: idle development-vessel was not bounced once on the converging tick"; show; }
[ "$(restarts "$LT")" = 1 ] && ok "(c) control: idle local-tools-vessel is bounced once on the converging tick" \
  || bad "(c) control: idle local-tools-vessel was not bounced once on the converging tick"
grep -q "$PKG: fan-out healthy" "$OUT" && ok "(c) control: the fan-out is credited" || bad "(c) control: the fan-out was not credited"

# ── (d) control: a request older than the ceiling no longer blocks ───────────────
setup; push_change "$PKG"
health "$DV_PORT" 1 1000000; health "$LT_PORT" 0 0
run
[ "$(restarts "$DV")" = 1 ] && ok "(d) control: an in-flight request past the ceiling does not block the bounce" \
  || bad "(d) control: an in-flight request past the ceiling still blocked the bounce"
[ "$(restarts "$LT")" = 1 ] && ok "(d) control: local-tools-vessel is bounced when the only in-flight request is past the ceiling" \
  || bad "(d) control: local-tools-vessel was not bounced although the only in-flight request is past the ceiling"

# ── (e) control: the existing owed-restart deferral is unchanged ─────────────────
# A vessel converging its OWN code first meets the pre-mirror work-in-flight deferral;
# the restart-time deferral ("DEFERRING restart ... PENDING") is what remains once that
# deferral's starvation bound breaks. AUTHORING_HOST_MAX_DEFERS=0 reaches it in one tick.
setup; push_change "$DV"
health "$DV_PORT" 1 60000; health "$LT_PORT" 0 0
run AUTHORING_HOST_MAX_DEFERS=0
[ "$(restarts "$DV")" = 0 ] && ok "(e) control: development-vessel's own convergence restart defers under young in-flight" \
  || bad "(e) control: development-vessel's own convergence restart did not defer under young in-flight"
grep -q "$DV: DEFERRING restart .*PENDING" "$OUT" && ok "(e) control: logged DEFERRING restart ... PENDING" \
  || bad "(e) control: no DEFERRING restart ... PENDING line"
[ -s "$T/ws/.pull-sync/$DV.restart-pending" ] \
  && ok "(e) control: the owed restart is recorded" || bad "(e) control: no restart-pending record for the deferred restart"
health "$DV_PORT" 0 0
run
[ "$(restarts "$DV")" = 1 ] && ok "(e) control: the next idle tick takes the owed restart exactly once" \
  || bad "(e) control: the next idle tick did not take the owed restart exactly once"

# ── (f) starvation: busy on every tick, the shaped tick bound forces the bounce ──
setup; push_change "$PKG"
tuning pull_sync.bounce_defer_max_ticks 2
health "$DV_PORT" 1 60000; health "$LT_PORT" 0 0
run
fanout_ran || { bad "fixture: the starvation fan-out never ran"; show; }
run
[ "$(grep -c "^systemctl restart $DV.service" "$ALLCALLS")" = 0 ] && ok "(f) below the tick bound a busy consumer still defers the bounce" \
  || bad "(f) below the tick bound the bounce was not deferred"
[ "$(gaps_forced)" = 0 ] && ok "(f) no forced-bounce gap below the bound" || bad "(f) a forced-bounce gap was filed below the bound"
run
[ "$(restarts "$DV")" = 1 ] && ok "(f) at the shaped tick bound the bounce proceeds for development-vessel" \
  || bad "(f) development-vessel was not bounced at the shaped tick bound although it is busy on every tick"
[ "$(restarts "$LT")" = 1 ] && ok "(f) at the shaped tick bound the bounce proceeds for local-tools-vessel" \
  || bad "(f) local-tools-vessel was not bounced at the shaped tick bound"
grep -q "$PKG: dependency bounce FORCED-AFTER-DEFER" "$OUT" && ok "(f) the forced bounce is logged FORCED-AFTER-DEFER" \
  || bad "(f) no FORCED-AFTER-DEFER line for the forced dependency bounce"
[ "$(gaps_forced)" = 1 ] && ok "(f) exactly one forced-bounce gap with a stable id" \
  || bad "(f) not exactly one pull-sync-bounce-forced gap for the forced bounce"
run
[ "$(restarts "$DV")" = 0 ] && [ "$(gaps_forced)" = 1 ] && ok "(f) the tick after the forced bounce neither bounces again nor files again" \
  || bad "(f) the tick after the forced bounce bounced again or filed another gap"

# ── (g) starvation: the shaped AGE bound forces the bounce too ───────────────────
setup; push_change "$PKG"
tuning pull_sync.bounce_defer_max_seconds 0
health "$DV_PORT" 1 60000; health "$LT_PORT" 0 0
run
[ "$(restarts "$DV")" = 0 ] && ok "(g) the first busy tick defers (no age yet)" || bad "(g) the first busy tick did not defer under the age bound"
run
[ "$(restarts "$DV")" = 1 ] && grep -q "FORCED-AFTER-DEFER" "$OUT" \
  && ok "(g) once the first deferral is older than the shaped age bound the bounce is forced" \
  || bad "(g) the shaped age bound did not force the bounce"

# ── (h) the API key never reaches curl's argv ───────────────────────────────────
FIXTURE_KEY="fixture-key-$$-$RANDOM"   # generated per run: a fixture, never a credential
setup; push_change "$PKG"
tuning pull_sync.bounce_defer_max_ticks 6
health "$DV_PORT" 1 60000; health "$LT_PORT" 0 0
run METABOB_API_KEY="$FIXTURE_KEY"
grep -q 'v2/tuning-params/pull_sync.bounce_defer_max_ticks' "$CALLS" || bad "fixture: the tuning read never happened"
grep -qF "$FIXTURE_KEY" "$ALLCALLS" && bad "(h) the API key value appears in a curl argument" \
  || ok "(h) the API key value appears in no curl argument"
grep -qF "Authorization: ApiKey $FIXTURE_KEY" "$T/curlcfg" 2>/dev/null && ok "(h) the API key reaches curl through its stdin config" \
  || bad "(h) the API key does not reach curl through its stdin config"

# ── (i) a failed tuning read falls back visibly, once per name per tick ──────────
P2=zz-shared-ts
setup
seed "$P2" '{"name":"@avigopal/zz-shared-ts","scripts":{"build":"tsc"}}'
echo '{}' > "$T/rt/$P2/tsconfig.build.json"
mkdir -p "$T/rt/$P2/dist"; echo '// old build' > "$T/rt/$P2/dist/index.js"
printf '{"name":"%s","dependencies":{"@avigopal/ias-executor-ts":"file:../ias-executor-ts","@avigopal/zz-shared-ts":"file:../zz-shared-ts"}}\n' "$DV" > "$T/rt/$DV/package.json"
push_change "$PKG"; push_change "$P2"
health "$DV_PORT" 1 60000; health "$LT_PORT" 0 0
echo 401 > "$T/tuning-mode"
run
[ "$(grep -c "DEFERRING dependency bounce" "$OUT")" = 2 ] || bad "fixture: two shared packages did not both defer"
[ "$(fallbacks pull_sync.bounce_defer_max_ticks http_401)" = 1 ] && [ "$(fallbacks pull_sync.bounce_defer_max_seconds http_401)" = 1 ] \
  && ok "(i) a 401 tuning store is recorded exactly once per name in the tick" \
  || bad "(i) a 401 tuning store is not recorded exactly once per name in the tick"
grep -q 'DEFERRING dependency bounce .*(1/6)' "$OUT" && ok "(i) the default applies when the tuning store answers 401" \
  || bad "(i) the default does not apply when the tuning store answers 401"
[ "$(grep -c '"action":"tuning_param_fallback"' "$T/ws/pull-sync-deferrals.jsonl" 2>/dev/null)" = 2 ] \
  && ok "(i) the fallback is recorded in the deferral log once per name" || bad "(i) the fallback is not recorded in the deferral log once per name"
echo down > "$T/tuning-mode"
run
[ "$(fallbacks pull_sync.bounce_defer_max_ticks unreachable)" = 1 ] && [ "$(fallbacks pull_sync.bounce_defer_max_seconds unreachable)" = 1 ] \
  && ok "(i) an unreachable tuning store is recorded again on the next tick, once per name" \
  || bad "(i) an unreachable tuning store is not recorded once per name on the next tick"
grep -q 'DEFERRING dependency bounce .*(2/6)' "$OUT" && ok "(i) the default applies when the tuning store is unreachable" \
  || bad "(i) the default does not apply when the tuning store is unreachable"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
