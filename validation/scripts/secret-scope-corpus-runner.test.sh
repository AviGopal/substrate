#!/usr/bin/env bash
# secret-scope-corpus-runner.test.sh: goal-host's corpus-runner key (GOAL_HOST_CORPUS_RUNNER_API_KEY, scope verdict-corpus:write
# only) is a SCOPED secret. A grading credential in the shared /etc/substrate/env would sit in every unit's process env,
# local-tools' walk-driven shell included, reopening the forgery path the runner split closes (key option (d), 2026-10-12).
#   (a) secrets-manifest.json scopes it to goal-host-vessel (consumer) and identity-seeder (writer) only; no script consumer
#   (b) MUST-FAIL: render-secret-scope (values mode) writes it into private/env.d/goal-host-vessel.env and identity-seeder.env
#       and into NO other rendered file (no other unit's env.d, not admin.env)
#   (c) gen-env's shared /etc/substrate/env heredoc never names it
#   (d) MUST-FAIL: gen-env restores it from the persisted store and has NO fleet fallback: absent -> empty (not provisioned)
#   (e) goal-host-vessel.service loads its scoped file, without '-', after the shared env (the lint's rule, pinned here too)
# No value is printed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; S="$HERE/../../scripts/substrate"; G="${1:-$S/gen-env.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/corpus-runner.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
N=GOAL_HOST_CORPUS_RUNNER_API_KEY; V=mb-runnerVALUEneverprinted; FLEET=mb-fleetVALUEneverprinted
# (a)
[ "$(jq -c ".secrets.$N | {units, scripts}" "$S/secrets-manifest.json" 2>/dev/null)" = '{"units":["goal-host-vessel","identity-seeder"],"scripts":[]}' ] \
  && ok "(a) the manifest scopes $N to goal-host-vessel and identity-seeder only" || bad "(a) manifest: $(jq -c ".secrets.$N" "$S/secrets-manifest.json" 2>/dev/null | cut -c1-200)"
# (b)
mkdir -p "$T/etc"
if env -i PATH="$PATH" "$N=$V" bash "$S/render-secret-scope.sh" --mode values --env-dir "$T/etc" >"$T/r.out" 2>&1; then
  hits="$(grep -rlF "$V" "$T/etc" 2>/dev/null | sed "s|$T/etc/||" | sort | tr '\n' ' ')"
  [ "$hits" = "private/env.d/goal-host-vessel.env private/env.d/identity-seeder.env " ] && ok "(b) rendered ONLY into goal-host-vessel's and identity-seeder's env.d files" || bad "(b) the value is in: '${hits:-nowhere}'"
else bad "(b) render-secret-scope failed: $(tail -2 "$T/r.out")"; fi
# (c)
awk '/^cat > \/etc\/substrate\/env <<EOF/{f=1;next} f&&/^EOF$/{f=0} f' "$G" > "$T/shared"
[ -s "$T/shared" ] && ! grep -q "$N" "$T/shared" && ok "(c) the shared env heredoc never names $N" || bad "(c) shared env heredoc names $N (or was not found)"
# (d)
sed -n '/^persisted_secret() {/,/^}/p' "$G" > "$T/ps.sh"; grep -m1 "^$N=" "$G" > "$T/line.sh"
if [ -s "$T/line.sh" ] && [ -s "$T/ps.sh" ]; then
  r() { ( unset $N; SECRETS_FILE="$T/store"; printf 'METABOB_API_KEY=%s\n%s' "$FLEET" "$1" > "$SECRETS_FILE"; METABOB_API_KEY="$FLEET"
          prov() { :; }; . "$T/ps.sh"; . "$T/line.sh"; case "${!N:-}" in "$V") echo stored ;; "$FLEET") echo fleet ;; "") echo empty ;; *) echo other ;; esac ); }
  [ "$(r "$N=$V")" = stored ] && ok "(d) restored from the persisted store" || bad "(d) stored key rendered as $(r "$N=$V")"
  [ "$(r "")" = empty ] && ok "(d) absent: EMPTY (not provisioned), never the fleet key" || bad "(d) absent rendered as $(r "")"
else bad "(d) gen-env has no '$N=' restore line"; fi
# (e)
u="$S/units/goal-host-vessel.service"; want="EnvironmentFile=/etc/substrate/private/env.d/goal-host-vessel.env"
ls_="$(grep -nx "$want" "$u" | cut -d: -f1)"; sh_="$(grep -nE '^EnvironmentFile=-?/etc/substrate/env$' "$u" | cut -d: -f1 | head -1)"
[ -n "$ls_" ] && [ -n "$sh_" ] && [ "$ls_" -gt "$sh_" ] && ok "(e) goal-host-vessel loads its scoped file, without '-', after the shared env" || bad "(e) unit lines: scoped='${ls_:-absent}' shared='${sh_:-absent}'"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
