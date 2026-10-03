#!/usr/bin/env bash
# substrate-pull-sync.sh — the substrate pulls its OWN source updates from git.
#
# Inverts federation-pull-sync.sh: instead of a host pushing source into
# containers (docker cp), each substrate converges itself to
# origin/dev. Code flows ONLY through git remotes — this is both the update
# channel for a single substrate and how a fleet of substrates converges with no
# host mediating. Runs in-container as substrate-pull-sync.service:
#   - at boot (After=git-push-setup): converges the possibly-stale image-baked
#     /vessels runtime to the clones' origin/dev HEAD
#   - on substrate-pull-sync.timer: picks up changes landed on origin since
#
# Per vessel clone in $CLONE_DIR:
#   ahead of origin  -> skip (unpushed local cutover commits; push side owns it)
#   diverged         -> substrateGap + skip (never force)
#   behind           -> ff-only pull
#   HEAD != last-mirrored marker -> mirror-to-live + (if unit active) restart,
#     staggered + health-gated; a restart that goes unhealthy reverts to the
#     previous last-good pin and HALTS the run (emit substrateGap).
# Successful healthy mirror records /workspace/.last-good/<v> — the pin
# self-recovery reverts to (git-based, replacing revert-to-host-source).
#
# Skips the whole run while a mitosis cutover is in flight (fresh
# /workspace/mitosis-pending.json) so a pull can never clobber a mid-cutover
# mirror. Fail-open: no PAT / no network -> warn once and no-op (a substrate
# without pull access is frozen-but-functional).
set -uo pipefail
# The args this tick was started with, kept for the one self re-exec (see SELF-CONVERGE FIRST).
PULLSYNC_ARGS=("$@")
# A re-exec'd tick keeps the ORIGINAL start time: the failing-test generator's budget is
# measured against the unit timeout, which the exec does not reset.
if [ "${PULLSYNC_REEXECED:-}" = 1 ] && [ -n "${PULLSYNC_T0:-}" ]; then :; else PULLSYNC_T0="$(date +%s)"; fi
GEN_QUEUE=""
# PINNED JUDGE (scripts/substrate/gate/). gate-runner (substrate-pull-sync.service's ExecStart)
# runs THIS file from /workspace/.gate/accepted/ — a `git archive` of the accepted sha — and
# sets PULLSYNC_ACCEPTED_DIR to that copy. In that mode (the "gated" mode):
#   - SELF-CONVERGE FIRST no longer installs or execs the pulled pull-sync (the 847025e2
#     run-on-arrival path). A new pull-sync, like any change to a gate path in the accepted
#     MANIFEST, is a CANDIDATE: candidate.sh (from accepted/) classifies it and shadow-runs the
#     accepted fixture corpus against it; a pass that soaks N ticks writes promote.request, and
#     only the runner swaps it in. The code that applies a change is always the accepted one.
#   - every staged glue tree has its gate paths replaced by the ACCEPTED copies (gate_overlay),
#     so no install reads a candidate's gate file; other paths keep converging as before.
#   - mirror-to-live runs from accepted/, never from /usr/local/bin.
# Unset (the image's pre-bootstrap tick, the tests) = the old behaviour, unchanged.
PULLSYNC_ACCEPTED_DIR="${PULLSYNC_ACCEPTED_DIR:-}"
PULLSYNC_GATE_DIR="${PULLSYNC_GATE_DIR:-${PULLSYNC_ACCEPTED_DIR:+${PULLSYNC_ACCEPTED_DIR%/*}}}"
GATE_LIBEXEC_DIR="${PULLSYNC_LIBEXEC_DIR:-/usr/local/libexec/substrate}"
MIRROR_BIN=/usr/local/bin/mirror-to-live
if [ -n "$PULLSYNC_ACCEPTED_DIR" ] && [ -f "$PULLSYNC_ACCEPTED_DIR/scripts/substrate/mirror-to-live.sh" ]; then
  MIRROR_BIN="$PULLSYNC_ACCEPTED_DIR/scripts/substrate/mirror-to-live.sh"
fi

CLONE_DIR="${MITOSIS_PUSH_CLONE_DIR:-/workspace/git/vessels}"
RUNTIME_DIR="${MITOSIS_RUNTIME_DIR:-/vessels}"
INV="${VESSELS_INVENTORY:-/workspace/substrate/fleet/vessels.inventory.json}"
[ -f "$INV" ] || INV=/usr/local/share/substrate/vessels.inventory.json
MARKER_DIR=/workspace/.pull-sync
LAST_GOOD_DIR=/workspace/.last-good
BRANCH="${BRANCH:-dev}"
STAGGER_SECONDS="${STAGGER_SECONDS:-8}"
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"
MITOSIS_LOCK=/workspace/mitosis-pending.json
MITOSIS_LOCK_TTL_MIN="${MITOSIS_LOCK_TTL_MIN:-30}"
# Durable authoring-in-flight markers written by the working plane
# (patch_with_tools / feature_compose); pull-sync is a lifecycle actor and must
# consume them before converging a vessel. Deferral is FRESHNESS-only: the
# marker pid is the vessel server process (it outlives runs), so pid-liveness
# must not extend a deferral — a leaked marker would defer forever. A dead pid
# does short-circuit (vessel process gone = run definitely not in flight) and
# such markers are REAPED below (see STALE_AUTHORING_MARKER_MIN) rather than
# left to wedge convergence until an operator deletes them.
AUTHORING_MARKER_DIR="${AUTHORING_MARKER_DIR:-/workspace/authoring-inflight}"
AUTHORING_MARKER_TTL_MIN="${AUTHORING_MARKER_TTL_MIN:-40}"
# Reap threshold for LEAKED markers. Markers are (re)written at run START and a
# live run defers convergence for at most AUTHORING_MARKER_TTL_MIN, so a marker
# whose recorded pid is dead OR whose mtime is past this threshold cannot
# describe an in-flight run — it is a leak (a run that exited without
# clearAuthoringMarker). Reap it here instead of leaving it to an operator.
STALE_AUTHORING_MARKER_MIN="${STALE_AUTHORING_MARKER_MIN:-90}"
DEFERRAL_LOG=/workspace/pull-sync-deferrals.jsonl

mkdir -p "$MARKER_DIR" "$LAST_GOOD_DIR"
log() { echo "[pull-sync $(date -Iseconds)] $*"; }

# DECLARE YOURSELF BEFORE RESTARTING SOMETHING.
#
# systemd records only `Stopping <unit>`, never who asked. At least three sources
# restart a vessel — the mitosis cutover, this script, and a plain `systemctl
# restart` — and development-vessel in particular hosts feature_compose for the
# whole fleet, so every restart of it discards in-flight composes for OTHER
# vessels. Measured 2026-08-11: six restarts in 2h20m and zero isolated-vessel
# composes completing, with no way to attribute any of it.
#
# The vessel reads this at boot and logs the requester, or logs UNATTRIBUTED when
# no fresh breadcrumb exists — which is how a source that does NOT declare itself
# stays visible. Best-effort only; nothing here may block or delay a restart.
restart_breadcrumb() { # vessel reason [in_flight]
  _rb_dir="${RESTART_BREADCRUMB_DIR:-/workspace/restart-requests}"
  mkdir -p "$_rb_dir" 2>/dev/null || return 0
  _rb_if="${3:-null}"
  case "$_rb_if" in ''|*[!0-9]*) _rb_if=null ;; esac
  printf '{"requester":"pull-sync","reason":"%s","in_flight":%s,"at":"%s"}' \
    "$2" "$_rb_if" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > "$_rb_dir/$1.json" 2>/dev/null || true
}
# DEFER BY AGE, NOT BY COUNT (shared by both restart-deferral sites below).
# restart_age_defer <port> <deferred_n> — sets RA_INFLIGHT, RA_OLDEST, RA_DEFER (1 = keep
# deferring) and RA_WHY (log text). A count of busy observations breaks starvation against a
# lane that is never idle, not against a stuck request: three runs each saw a DIFFERENT young
# compose and the third restart killed it anyway ("restarting anyway ... cannot be starved").
# A vessel that publishes in_flight_oldest_ms is deferred until its OLDEST request passes the
# compose ceiling — only then is it stuck. A vessel that does not publish the age keeps the
# RESTART_DEFER_MAX count bound: without an age nothing distinguishes busy from wedged.
# PROGRESS, NOT AGE, SAYS WHETHER A PAST-CEILING REQUEST IS STUCK. A compose that walks scope -> plan ->
# apply -> verify -> own-check -> cutover routinely runs past the 900 s ceiling while still moving, and the
# age rule restarted into it. A vessel that also publishes in_flight_last_progress_ms (ms since the most
# recent STAGE TRANSITION of any in-flight request; null/absent until one has stamped) keeps a past-ceiling
# request deferred while that is under pull_sync.stall_seconds (shaped tuning row, default 600) and sets
# RA_PROGRESSING=1. EXTEND-ONLY: progress never shortens the age deferral, so a vessel that does not publish
# it (or has not stamped yet) keeps today's ceiling exactly, and the stall bound is read only when it does.
# The owed path bounds how long progress may hold a restart (pull_sync.owed_restart_max_hold_seconds).
# RA_FRESH=1 says the same thing whatever the age (published progress under the stall bound): the mirror
# path's quiesce bound reads it, because there the tick budget, not the age, is what ran out.
# AN OPEN PROBE WINDOW HOLDS EVERY RESTART ON THIS NODE (qa's rule, 2026-10-03: a declared held-out probe
# window is a maintenance hold; restarts inside one turn environment failures into reach misses). The window
# is a shaped poolImpulse (shape probeWindow, body {node, from, until, tag, reason}) read at use time from this
# node's development-vessel, the record vessel-ctl's probe_window_guard reads. Read once per tick.
#  - BOUNDED: a window holds at most pull_sync.probe_window_max_seconds (shaped tuning row, default 7200) from
#    its `from` (or the record's creation time), whatever its `until` says, because this hold stops ALL
#    convergence on the node, security fixes included. A window the cap expires is logged once.
#  - EXPLICIT NODE ONLY: pull-sync ignores node "*". Any fleet-key holder can write a pool record, so a
#    wildcard would let any of them freeze convergence fleet-wide.
#  - OVERRIDE: an open probeWindowOverride record naming this node (body {node, reason}) lets convergence
#    through the hold, logged once per tick, for a security fix that cannot wait.
#  - UNREADABLE does NOT hold here (unlike vessel-ctl, where an operator can override): pull-sync must be able
#    to restart the very vessel that serves the record. The line names the last window seen open, so a probe
#    report can join on it and flag its results environment-suspect.
PW_STATE=""
probe_window_open() { # -> 0 iff an open, in-cap window names this node and no override is open; sets PW_WHY
  if [ -z "$PW_STATE" ]; then
    _pw_me="${FED_SUBSTRATE_ID:-$(hostname 2>/dev/null)}"; _pw_h="$(hostname 2>/dev/null)"
    tuning_param pull_sync.probe_window_max_seconds 7200; _pw_max="$TP_VALUE"
    _pw_read() {
      if [ -n "${METABOB_API_KEY:-}" ]; then printf 'header = "Authorization: ApiKey %s"\n' "$METABOB_API_KEY"; fi \
        | curl -K - -s --max-time 10 -X POST "${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}/v2/impulses/resolve" \
            -H 'Content-Type: application/json' -d "{\"impulse\":{\"type\":\"poolImpulse\",\"shape\":\"$1\",\"status\":\"open\"}}" 2>/dev/null
    }
    _pw_sel='def ts: if . == null then null else (sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601? // null) end;
      if (.body.impulses | type) != "array" then "UNREADABLE" else
      [.body.impulses[] | select(.shape == $shape) | select(.body.node == $me or .body.node == $h)
        | ((.body.from | ts) // (.injected_at | ts) // (.created_at | ts)) as $from
        | ((.body.until | ts)) as $until
        | (if $from == null then null else $from + $max end) as $cap
        | {id, tag: (.body.tag // ""), from: $from, until: $until, cap: $cap}
        | select(.from == null or .from <= $now)
        | .expired_by_cap = (.cap != null and .cap <= $now and (.until == null or .until > $now))
        | select(.until == null or .until > $now)] as $w
      | ($w | map(select(.expired_by_cap | not))) as $live
      | if ($live | length) > 0 then "OPEN " + ($live[0].id | tostring) + " tag=" + ($live[0].tag | tostring)
        elif ($w | length) > 0 then "CAPPED " + ($w[0].id | tostring)
        else "NONE" end end'
    _pw_now="$(date -u +%s)"
    PW_STATE="$(_pw_read probeWindow | jq -r --arg shape probeWindow --arg me "$_pw_me" --arg h "$_pw_h" --argjson now "$_pw_now" --argjson max "$_pw_max" "$_pw_sel" 2>/dev/null)"
    [ -n "$PW_STATE" ] || PW_STATE="UNREADABLE"
    case "$PW_STATE" in
      OPEN*)
        echo "${PW_STATE#OPEN }" > "$MARKER_DIR/probe-window.last" 2>/dev/null || true
        _pw_ov="$(_pw_read probeWindowOverride | jq -r --arg shape probeWindowOverride --arg me "$_pw_me" --arg h "$_pw_h" --argjson now "$_pw_now" --argjson max "$_pw_max" "$_pw_sel" 2>/dev/null)"
        case "$_pw_ov" in OPEN*)
          log "probe window ${PW_STATE#OPEN } is open but override ${_pw_ov#OPEN } lets convergence through (security override)"
          PW_STATE="OVERRIDDEN ${PW_STATE#OPEN }" ;;
        esac ;;
      CAPPED*) log "probe window ${PW_STATE#CAPPED } passed pull_sync.probe_window_max_seconds (${_pw_max}s) — no longer holding convergence" ;;
      UNREADABLE) log "probe window: probeWindow records unreadable this tick — restarts are NOT held (pull-sync must be able to restart the record's own server); last window seen open: $(cat "$MARKER_DIR/probe-window.last" 2>/dev/null || echo none) — flag its probe results environment-suspect" ;;
    esac
  fi
  PW_WHY="probe window ${PW_STATE#OPEN }"
  case "$PW_STATE" in OPEN*) return 0 ;; *) return 1 ;; esac
}

restart_age_defer() {
  RA_INFLIGHT=""; RA_OLDEST=""; RA_DEFER=0; RA_WHY=""; RA_PROBE=0; RA_PROGRESS=""; RA_PROGRESS_ID=""; RA_PROGRESSING=0; RA_FRESH=0; RA_STALL_S=""
  if probe_window_open; then RA_DEFER=1; RA_PROBE=1; RA_WHY="$PW_WHY open on this node — restart held until it closes"; return 0; fi
  if [ -n "$1" ]; then
    _ra_h="$(curl -s --max-time 5 "http://127.0.0.1:$1/health" 2>/dev/null)"
    RA_INFLIGHT="$(printf '%s' "$_ra_h" | sed -n 's/.*"in_flight"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1)"
    RA_OLDEST="$(printf '%s' "$_ra_h" | sed -n 's/.*"in_flight_oldest_ms"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1)"
    RA_PROGRESS="$(printf '%s' "$_ra_h" | sed -n 's/.*"in_flight_last_progress_ms"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1)"
    RA_PROGRESS_ID="$(printf '%s' "$_ra_h" | sed -n 's/.*"in_flight_last_progress_id"[[:space:]]*:[[:space:]]*"\([A-Za-z0-9._:-]*\)".*/\1/p' | head -1)"
  fi
  _ra_ceiling="${COMPOSE_CEILING_MS:-900000}"
  [ -n "$RA_INFLIGHT" ] && [ "$RA_INFLIGHT" -gt 0 ] 2>/dev/null || return 0
  if [ -n "$RA_PROGRESS" ]; then
    tuning_param pull_sync.stall_seconds 600; RA_STALL_S="$TP_VALUE"
    [ "$RA_PROGRESS" -lt $(( RA_STALL_S * 1000 )) ] 2>/dev/null && RA_FRESH=1
  fi
  if [ -n "$RA_OLDEST" ]; then
    if [ "$RA_OLDEST" -lt "$_ra_ceiling" ] 2>/dev/null; then
      RA_DEFER=1; RA_WHY="$RA_INFLIGHT in flight, oldest ${RA_OLDEST}ms < ceiling ${_ra_ceiling}ms"
    elif [ "$RA_FRESH" = 1 ]; then
      RA_DEFER=1; RA_PROGRESSING=1
      RA_WHY="oldest of $RA_INFLIGHT in-flight request(s) is ${RA_OLDEST}ms, past the ${_ra_ceiling}ms ceiling, but progressing: last stage transition ${RA_PROGRESS}ms ago < pull_sync.stall_seconds ${RA_STALL_S}s${RA_PROGRESS_ID:+ (attempt $RA_PROGRESS_ID)}"
    else
      RA_WHY="oldest of $RA_INFLIGHT in-flight request(s) is ${RA_OLDEST}ms, past the ${_ra_ceiling}ms compose ceiling${RA_PROGRESS:+, and no stage transition for ${RA_PROGRESS}ms (stalled)}"
    fi
  elif [ "${2:-0}" -lt "${RESTART_DEFER_MAX:-3}" ] 2>/dev/null; then
    RA_DEFER=1; RA_WHY="$RA_INFLIGHT in flight ($(( ${2:-0} + 1 ))/${RESTART_DEFER_MAX:-3}, no in_flight_oldest_ms published)"
  else
    RA_WHY="$RA_INFLIGHT in flight after ${2:-0} deferral(s) and no in_flight_oldest_ms published — convergence must not be starved"
  fi
}
# dev_resolve <json-body> [curl-args...] — POST <json-body> to development-vessel's
# /v2/impulses/resolve with the service key the unit's EnvironmentFile carries, and print the
# response. development-vessel authenticates write-type pointers (substrateGap_write, every other
# *_write) against identity-vessel; an uncredentialed write is answered 401 and the gap is lost.
# Every resolve request here goes through this one function, reads included, so none can be
# added without the key. The key never touches argv: the header goes to curl on stdin as a
# config (`-K -`), exactly as tuning_param below sends it. Extra args (--max-time, -w, -o) follow.
dev_resolve() {
  local _dr_body="$1"; shift
  { if [ -n "${METABOB_API_KEY:-}" ]; then printf 'header = "Authorization: ApiKey %s"\n' "$METABOB_API_KEY"; fi; } \
    | curl -K - -s -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$_dr_body" "$@"
}
# tuning_param <name> <default> — sets TP_VALUE to a SHAPED value read at use time: the
# substrate_tuning_param row that activity-api serves at GET /v2/tuning-params/<name> (the same
# table its learner reads through getTuningParam, written through POST /v2/tuning-params).
# pull-sync had no shaped-setting reader, so its bounds were named constants; this is the nearest
# existing shaped path. Authenticates with the service key the unit's EnvironmentFile carries (as
# setup-git-push does).
#
# THE KEY NEVER TOUCHES ARGV. A header given as `-H "Authorization: ApiKey $KEY"` is readable in
# /proc/<pid>/cmdline by every process in the container for the life of the request. The header
# goes to curl on stdin as a config (`-K -`), written by printf, a shell builtin with no argv of
# its own.
#
# A FALLBACK IS VISIBLE. A null row, a non-numeric value, an unreachable store or a non-2xx (401)
# yields <default> — a bound is never lifted by a read failure — and is recorded once per name per
# tick (log line + DEFERRAL_LOG record `tuning_param_fallback`), so "the shaped value is not being
# read" is observable instead of indistinguishable from "the shaped value equals the default".
# Not a subshell: TP_VALUE and the once-per-tick set survive the call.
TP_FALLBACK_SEEN=" "
tuning_param() {
  local _tp_out _tp_code _tp_body _tp_why=""
  TP_VALUE=""
  _tp_out="$(if [ -n "${METABOB_API_KEY:-}" ]; then printf 'header = "Authorization: ApiKey %s"\n' "$METABOB_API_KEY"; fi \
    | curl -K - -s --max-time 5 -w '\n%{http_code}' \
        "${ACTIVITY_API_ENDPOINT:-http://127.0.0.1:8080}/v2/tuning-params/$1" 2>/dev/null)"
  _tp_code="${_tp_out##*$'\n'}"; _tp_body="${_tp_out%$'\n'*}"
  [ "$_tp_out" = "$_tp_code" ] && _tp_body=""
  case "$_tp_code" in
    2[0-9][0-9])
      TP_VALUE="$(printf '%s' "$_tp_body" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\)\(\.[0-9]*\)\{0,1\}[[:space:]]*[,}].*/\1/p' | head -1)"
      if [ -z "$TP_VALUE" ]; then
        if printf '%s' "$_tp_body" | grep -q '"value"[[:space:]]*:[[:space:]]*null'; then _tp_why=null; else _tp_why=non_numeric; fi
      fi ;;
    ''|000|*[!0-9]*) _tp_why=unreachable ;;
    *) _tp_why="http_$_tp_code" ;;
  esac
  case "$TP_VALUE" in ''|*[!0-9]*) TP_VALUE="$2"; _tp_why="${_tp_why:-non_numeric}" ;; esac
  if [ -n "$_tp_why" ] && [ "${TP_FALLBACK_SEEN#* $1 }" = "$TP_FALLBACK_SEEN" ]; then
    TP_FALLBACK_SEEN="$TP_FALLBACK_SEEN$1 "
    log "tuning_param_fallback name=$1 reason=$_tp_why default=$2"
    printf '{"at":"%s","actor":"pull-sync","action":"tuning_param_fallback","name":"%s","reason":"%s","default":%s}\n' \
      "$(date -Iseconds)" "$1" "$_tp_why" "$2" >> "$DEFERRAL_LOG" 2>/dev/null || true
  fi
}
# Failing-test names that are red ON PURPOSE in this commit: an OPEN gap's class2 check (evidence_resolve
# test_suite for vessel $1) whose test_file is among the files the commit changed ($2, newline-separated).
# That is a check-first landing (the check landed before its fix), a filed failure, not a regression.
# Keyed on the commit touching the check file, so a tracked test broken by an UNRELATED change still counts
# as a regression. Empty output (store unreachable, no jq, no match) keeps the stricter gate.
# THE PREDICATE IS SHARED (scripts/substrate/lib/gap-tracked-red.sh): the pre-commit glue runner sources
# the same file, so the two gates cannot drift. It is found next to this script FIRST (a checkout, the
# gated accepted/ archive), then under $SHARE_DIR/lib (the image's /usr/local/bin install; SELF-CONVERGE
# FIRST converges that copy every ungated tick, before any re-exec).
# A TICK WITHOUT THE PREDICATE IS A LOUD NO-OP, never a silently strict gate: "nothing is tracked" would
# refuse every armed check-first red as a regression and charge it to an innocent commit, freezing the
# fleet under a wrong name. gtr_try_load runs here and again after SELF-CONVERGE FIRST (the heal path);
# if it still fails there, the tick converges nothing and files one high-severity gap (see TRACKED-RED
# LIB MISSING below), so tracked_fail_names is only ever called with the predicate loaded.
# >>> gap-tracked-red loader
PULLSYNC_SELF_DIR="${PULLSYNC_SELF_DIR:-$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")}"
GTR_LIB=""
gtr_lib_candidates() { printf '%s\n' "$PULLSYNC_SELF_DIR/lib/gap-tracked-red.sh" "${PULLSYNC_SHARE_DIR:-/usr/local/share/substrate}/lib/gap-tracked-red.sh"; }
gtr_try_load() { # -> 0 and GTR_LIB set when a candidate sources and defines the three functions
  local c
  [ -n "$GTR_LIB" ] && return 0
  while IFS= read -r c; do
    # shellcheck disable=SC1090
    if [ -r "$c" ] && . "$c" && declare -F gtr_load gtr_tracked_names gtr_select >/dev/null; then GTR_LIB="$c"; return 0; fi
  done < <(gtr_lib_candidates)
  return 1
}
# Returns 2 when the store refused the node key (401; gtr_load printed the distinct line): the
# tracked set is UNKNOWN, and the caller holds instead of judging. Any other unreadable store is
# "nothing tracked" (0), as before: the stricter gate stands.
tracked_fail_names() {
  local st rc
  [ -n "$GTR_LIB" ] || return 0
  st="$(mktemp "${TMPDIR:-/tmp}/pullsync-gtr.XXXXXX" 2>/dev/null)" || return 0
  gtr_load "$DEV_VESSEL" "$st"; rc=$?
  [ "$rc" -eq 0 ] && gtr_tracked_names "$st" "$1" "$2"
  rm -f "$st"
  [ "$rc" -eq 2 ] && return 2
  return 0
}
gtr_try_load || true
# <<< gap-tracked-red loader

# FAILING-TEST GAP GENERATOR (2026-09-30, user-cleared; qa-reviewed). Its evidence_resolve carries zero_field
# "requested_not_passing": gap-to-feature admission excludes a class2 check with no measured field as
# needs_information, so without it every gap filed here was silently inadmissible (found 2026-09-30 12:10).
# A non-actionable gap is also filed with operator_hold: admission reads operator_hold but NOT disposition, so a
# 'needs_information' label alone let an unlocalized assertion gap be picked (12:21); for a stale test its only
# green is changing src to match an outdated expectation, which op7 cannot see. The pre-land gate (feature-compose
# op5-op7) can only certify a landing for a gap that carries its own test_suite check, and every such gap in
# the store had been written by an operator: 196 failing activity-api tests yielded one admissible
# check-backed gap. The missing generator was the gap. This files check-backed failing_test gaps from the
# suite output the gate already produced, conservatively:
#   - only per-file results are read; bun's end-of-run summary REPEATS every failure under the last file
#     header with no error block, so parsing stops there (qa: 388 rows for 194 failures otherwise);
#   - red on two consecutive ticks (this run AND the previous tick's stored fail set: flake filter);
#   - environment failures skipped (401/403, connect, auth, port, timeout; case-insensitive): the check
#     runs under the same scrubbed env, so they could never close;
#   - by error CLASS, because op7 cannot catch a CHANGED expected value (equal count, red parent, green
#     draft): mock/wiring failures (the test's own doubles no longer match the code) edit the TEST;
#     assertion failures PROTECT the test and point edit_site at the first non-test src frame, or are filed
#     needs_information for localization when the stack names none; anything else is needs_information;
#   - names already in an open gap's only_tests, and files an open gap already checks, are skipped;
#   - an id already OPEN is skipped; a CLOSED id is never rewritten (the store carries closed fields forward),
#     a recurrence is filed as <id>-r<stamp> with recurrence_of so durability stays measurable;
#   - at most FAILTEST_GEN_PER_TICK new gaps per tick, none while FAILTEST_GEN_OPEN_MAX generator gaps are
#     open (the redispatch livelock is unfixed; a flood would wedge the lane). Smallest groups first.
# FAILTEST_GEN_DRYRUN=1 logs the payloads instead of filing them.
gen_failing_test_gaps() {
  local v="$1" out="$2" prev="$3" head="$4" dir="${5:-}" rows st payloads id ex exs n=0 flags tf
  command -v jq >/dev/null 2>&1 || return 0
  [ -s "$prev" ] || return 0
  rows="$(printf '%s' "$out" | sed 's/\x1b\[[0-9;]*m//g' | awk -v prevf="$prev" '
    BEGIN { while ((getline l < prevf) > 0) P[l] = 1 }
    /^[[:space:]]*[0-9]+ tests? (failed|skipped|todo):/ { exit }
    /^[^ (].*\.test\.[jt]sx?:$/ { file = substr($0, 1, length($0) - 1); sub(/^\.\//, "", file); err = ""; why = ""; frame = ""; next }
    /^\(pass\)/ { err = ""; why = ""; frame = ""; next }
    /^\(fail\) / {
      name = $0; sub(/^\(fail\) /, "", name); sub(/ \[[0-9.]+m?s\]$/, "", name); sub(/[[:space:]]+$/, "", name)
      e = tolower(err)
      env = (e ~ /received: 40[13]|unable to connect|econnrefused|eaddrinuse|fetch failed|authentication|timed out/) ? 1 : 0
      cls = (e ~ /typeerror|is not a function|undefined is not an object|null is not an object|is not a constructor|cannot read propert/) ? "mock" : ((e ~ /expect\(received\)/) ? "assert" : "other")
      if (file != "" && P["(fail) " name] && !seen[name]++) { gsub(/\t/, " ", name); gsub(/\t/, " ", why); print file "\t" name "\t" env "\t" cls "\t" frame "\t" why }
      err = ""; why = ""; frame = ""; next
    }
    {
      err = err "\n" $0
      if ($0 ~ /^(error:|Expected|Received)/ && length(why) < 300) why = why (why == "" ? "" : " / ") substr($0, 1, 200)
      if (frame == "" && $0 !~ /node_modules/ && match($0, /src\/[A-Za-z0-9_.\/-]+\.[jt]sx?:[0-9]+/)) { f = substr($0, RSTART, RLENGTH); sub(/:[0-9]+$/, "", f); if (f !~ /\.test\.[jt]sx?$/) frame = f }
    }')"
  [ -n "$rows" ] || return 0
  # RED ALONE (qa, 2026-09-30). The rows come from the FULL suite, but a gap's own check runs its file ALONE, and
  # bun's mock.module is process-wide: another file's partial mock can break a later file only in the full run
  # (broadcaster.account-id: 14 fail in the suite, 14/0 alone). A gap for such a name is green on the parent
  # forever: op10 refuses it, excludes it for 6 h, and it never closes. Names already found green ALONE at this
  # HEAD are skipped; the file resets when HEAD changes. The pollution root is the mock-factory debt, not a
  # per-victim gap.
  local poll="${TEST_BASELINE_DIR:-/workspace/.test-baseline}/$v.polluted"
  [ "$(head -n1 "$poll" 2>/dev/null)" = "head=${head:0:10}" ] || printf 'head=%s\n' "${head:0:10}" > "$poll" 2>/dev/null || true
  rows="$(printf '%s\n' "$rows" | awk -F'\t' -v pf="$poll" 'BEGIN { while ((getline l < pf) > 0) G[l] = 1 } !($2 in G)')"
  [ -n "$rows" ] || return 0
  # Per test FILE: does it use test doubles, and is it a SOURCE-TEXT guard (reads src and asserts on its text)?
  # A TypeError counts as mock/wiring only in a file that actually uses doubles; a source-text guard is always
  # assert-class, because its "fix" rewrites src to match text it asserts, and a guard can be stale on purpose
  # (2026-09-30: a guard demanded a predicate an operator had removed as a false-close generator).
  flags="{}"
  if [ -n "$dir" ]; then
    while IFS= read -r tf; do
      [ -n "$tf" ] && [ -f "$dir/$tf" ] || continue
      flags="$(printf '%s' "$flags" | jq -c --arg f "$tf" \
        --argjson m "$(command grep -qE 'mock\.module|spyOn|(^|[^A-Za-z_.])mock\(' "$dir/$tf" && echo true || echo false)" \
        --argjson g "$( { command grep -qE 'readFileSync\(|Bun\.file\(' "$dir/$tf" && command grep -qE 'import\.meta\.(dir|url)|/src/|["'"'"'`][^"'"'"'`]*[A-Za-z0-9_-]\.tsx?["'"'"'`]' "$dir/$tf"; } && echo true || echo false)" '. + {($f): {mocks: $m, guard: $g}}')"
    done <<< "$(printf '%s\n' "$rows" | cut -f1 | sort -u)"
  fi
  # A DIFFERENT PREDICATE FROM gap-tracked-red.sh — DO NOT UNIFY THEM. This read asks "is this failure
  # ALREADY FILED?" (dedup before WRITING a gap): any open test_suite gap for this vessel that checks the
  # file, or names the test in any file, suppresses a new one, and it counts the generator's own open gaps
  # against its caps; an unreadable store files nothing. scripts/substrate/lib/gap-tracked-red.sh asks
  # "may this red pass the gate?" (EXEMPTION): only names an open gap tracks for a file the caller passes,
  # matched exactly. Routing dedup through the exemption predicate would let a name tracked in one file
  # suppress filing its failure in another, and widening the exemption to this dedup's looser match would
  # exempt reds no gap checks. Changing one is not a reason to change the other.
  st="$(mktemp "${TMPDIR:-/tmp}/pullsync-gen-XXXXXX")" || return 0
  dev_resolve '{"impulse":{"pointer":{"type":"substrateGap","status":"open","limit":5000}}}' --max-time 30 > "$st" 2>/dev/null || true
  jq -e '.body.gaps | type == "array"' "$st" >/dev/null 2>&1 || { rm -f "$st"; log "$v: failing-test generator: gap store unreadable; nothing filed"; return 0; }
  payloads="$(printf '%s\n' "$rows" | jq -R -s -c --arg v "$v" --arg head "${head:0:10}" \
    --argjson flags "$flags" --argjson cap "${FAILTEST_GEN_PER_TICK:-3}" --argjson openmax "${FAILTEST_GEN_OPEN_MAX:-8}" --argjson infomax "${FAILTEST_GEN_INFO_MAX:-20}" --slurpfile st "$st" '
    ($st[0].body.gaps // []) as $g
    | ([$g[] | select((.classification_metadata.filed_by? // "") == "pull-sync failing-test generator")] | length) as $genall
    | ([$g[] | select((.classification_metadata.filed_by? // "") == "pull-sync failing-test generator") | select((.classification_metadata.disposition? // "") != "needs_information")] | length) as $genopen
    | ([$g[] | .classification_metadata.evidence_resolve? // empty | select(.shape? == "test_suite")
        | select(((.input.vessel // "") | sub("^repos/"; "")) == $v)]) as $ers
    | ([$ers[] | .input.test_file // empty]) as $tfiles
    | ([$ers[] | (.input.only_tests // [])[]]) as $tnames
    | split("\n") | map(select(length > 0) | split("\t") | {file: .[0], name: .[1], env: (.[2] == "1"), cls: .[3], frame: (.[4] // ""), why: (.[5] // "")})
    | map(select(.env | not) | select(.file as $f | $tfiles | index($f) | not) | select(.name as $n | $tnames | index($n) | not))
    | group_by(.file) | map(.[0].file as $f | ($flags[$f] // {mocks: false, guard: false}) as $fl
        | ([.[].cls] | unique) as $cs
        | {file: $f, guard: $fl.guard,
           cls: (if $fl.guard then "assert" elif ($cs | index("assert")) or ($cs | index("other")) then (if ($cs | index("assert")) then "assert" else "other" end)
                 elif ($fl.mocks | not) then "other" else "mock" end),
           frame: (if $fl.guard then "" else ([.[].frame | select(length > 0)] | first // "") end), t: .[:5]})
    | map(. + {actionable: (.cls == "mock" or (.cls == "assert" and .frame != ""))})
    | map(select(.actionable or $genall < $infomax))
    | sort_by([(if .actionable then 0 else 1 end), (.t | length)])
    | if $genopen >= $openmax then [] else .[: ([$cap, $openmax - $genopen] | min)] end
    | .[] | (.cls == "mock") as $mock | (.cls == "assert" and .frame != "") as $located
    | {impulse: {pointer: {type: "substrateGap_write", gap: ({
        id: ("failing-test-" + $v + "-" + (.file | ascii_downcase | gsub("[^a-z0-9]+"; "-") | sub("-+$"; "")) + "-gen-" + .cls),
        category: "failing_test", source: "substrate_detected", status: "open",
        summary: ("Failing test(s) in repos/" + $v + "/" + .file + ", detected by pull-sync at " + $head
          + " (red on two consecutive ticks under the checker env; not an environment failure): "
          + ([.t[] | (.name + (if .why != "" then " [" + .why + "]" else "" end))] | join(" ; "))
          + (if $mock then ". The failure is thrown from the test'\''s own doubles (mock/spy/factory), which no longer match the code'\''s call shape: update the doubles in the test so they model the current code. Keep every expect; do not skip or weaken a test."
             elif $located then ". An assertion fails against the source; the stack'\''s first source frame is repos/" + $v + "/" + .frame + ". The test is protected: fix the source so the named tests pass. If you conclude the expectation itself is outdated, do not edit it; say so, so the gap can be re-classified."
             else ". Not yet localized (no source frame in the stack, or an unclassified error): needs a diagnosis of whether the source or the test is wrong before any compose." end)
          + " Done when the named tests pass."),
        classification_metadata: ({
          falsifier: "class2",
          evidence_resolve: {shape: "test_suite", input: {vessel: $v, test_file: .file, only_tests: [.t[].name], timeout_ms: 180000}, zero_field: "requested_not_passing"},
          filed_by: "pull-sync failing-test generator", generator_head: $head, failure_class: .cls}
          + (if $mock then {edit_site: ("repos/" + $v + "/" + .file), region: (.t[0].name | split(" > ") | last)}
             elif $located then {edit_site: ("repos/" + $v + "/" + .frame), protected_files: [("repos/" + $v + "/" + .file)]}
             else {protected_files: [("repos/" + $v + "/" + .file)], disposition: "needs_information",
                   operator_hold: true, operator_hold_reason: "needs_localization: no source frame (or a source-text guard); release only after the edit site is localized and the test is confirmed correct"}
                  + (if .guard then {source_text_guard: true} else {} end) end))})}}}' 2>/dev/null || true)"
  rm -f "$st"
  [ -n "$payloads" ] || return 0
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    id="$(printf '%s' "$p" | jq -r '.impulse.pointer.gap.id')"
    ex="$(dev_resolve "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap\",\"id\":\"$id\",\"limit\":1}}}" --max-time 30 2>/dev/null \
       | jq -c 'if (.body.gaps | type) == "array" then ((.body.gaps[0] // {}) | {s: (.status // ""), n: (.classification_metadata.evidence_resolve.input.only_tests // [])}) else {err: true} end' 2>/dev/null || true)"
    # FAIL CLOSED (qa): an unreadable answer must not read as "no such id", or a CLOSED row would be rewritten open
    # with its closed_reason/falsifier_exercise carried forward. Unknown existence means: not this tick.
    if [ -z "$ex" ] || [ "$(printf '%s' "$ex" | jq -r '.err // false' 2>/dev/null)" != "false" ]; then log "$v: failing-test generator: existence of $id unknown (store read failed); not filing it this tick"; continue; fi
    exs="$(printf '%s' "$ex" | jq -r '.s' 2>/dev/null || true)"
    if [ "$exs" = "open" ]; then log "$v: failing-test generator: $id already open; skipped"; continue; fi
    if [ -n "$exs" ]; then
      # A re-failing name the closed gap named is a RECURRENCE (law-7 durability); a different set in the same
      # file is the REMAINDER the <=5 cap left out, never fixed, so it must not count as a reappearance (qa).
      p="$(printf '%s' "$p" | jq -c --arg rid "$id-r$(date -u +%Y%m%d%H%M)" --arg of "$id" --argjson ex "$ex" '.impulse.pointer.gap.id = $rid
          | (if ([.impulse.pointer.gap.classification_metadata.evidence_resolve.input.only_tests[] | . as $n | $ex.n | index($n)] | any(. != null))
             then .impulse.pointer.gap.classification_metadata.recurrence_of = $of
             else .impulse.pointer.gap.classification_metadata.continuation_of = $of end)')"
      log "$v: failing-test generator: $id exists ($exs); filing a new row ($(printf '%s' "$p" | jq -r '.impulse.pointer.gap.classification_metadata | if .recurrence_of then "recurrence_of" else "continuation_of" end'))"
      id="$(printf '%s' "$p" | jq -r '.impulse.pointer.gap.id')"
    fi
    tf="$(printf '%s' "$p" | jq -r '.impulse.pointer.gap.classification_metadata.evidence_resolve.input.test_file')"
    if [ -z "$dir" ] || [ -z "${BUN_BIN:-}" ]; then log "$v: failing-test generator: cannot run $tf alone (no checkout or bun); not filing $id"; continue; fi
    if [ -n "${FAILTEST_GEN_DEADLINE:-}" ] && [ $(( $(date +%s) + 170 )) -gt "$FAILTEST_GEN_DEADLINE" ]; then log "$v: failing-test generator: tick budget spent; $id left for a later tick"; break; fi
    local ar ao keep passed
    ar="$(mktemp -d "${TMPDIR:-/tmp}/pullsync-alone-XXXXXX")"
    ao="$(cd "$dir" && scrubbed_env "$ar" timeout --kill-after=15 150 "$BUN_BIN" test "./$tf" --timeout 20000 > "$ar.out" 2>&1; cat "$ar.out"; rm -f "$ar.out")"
    ao="$(printf '%s\n' "$ao" | sed 's/\x1b\[[0-9;]*m//g; s/ \[[0-9.]*m*s\]$//; s/[[:space:]]*$//')"
    rm -rf "$ar" 2>/dev/null
    # A run that printed no bun summary (unloadable alone, crashed, timed out) proves nothing: neither red nor
    # polluted. A name is red on "(fail) <name>" and polluted only on POSITIVE "(pass) <name>" (qa).
    if ! printf '%s\n' "$ao" | command grep -qE '^ *[0-9]+ (pass|fail)$'; then log "$v: failing-test generator: alone run of $tf produced no result; not filing $id, not marking polluted"; continue; fi
    keep="$(printf '%s' "$p" | jq -c --arg ao "$ao" '($ao | split("\n")) as $L | [.impulse.pointer.gap.classification_metadata.evidence_resolve.input.only_tests[] | select(("(fail) " + .) as $x | $L | index($x))]')"
    passed="$(printf '%s' "$p" | jq -r --arg ao "$ao" '($ao | split("\n")) as $L | .impulse.pointer.gap.classification_metadata.evidence_resolve.input.only_tests[] | select(("(pass) " + .) as $x | $L | index($x))')"
    [ -n "$passed" ] && printf '%s\n' "$passed" >> "$poll" 2>/dev/null
    if [ "$keep" = "[]" ] || [ -z "$keep" ]; then
      if [ -n "$passed" ]; then log "$v: failing-test generator: $tf passes when run ALONE (suite-only failure: cross-file mock pollution); not filing $id"
      else log "$v: failing-test generator: named tests of $tf neither failed nor passed alone (inconclusive); not filing $id"; fi
      continue
    fi
    p="$(printf '%s' "$p" | jq -c --argjson keep "$keep" '.impulse.pointer.gap.classification_metadata.evidence_resolve.input.only_tests = $keep | .impulse.pointer.gap.classification_metadata.red_alone = true')"
    if [ "${FAILTEST_GEN_DRYRUN:-0}" = "1" ]; then log "$v: failing-test generator DRYRUN would file: $p"; else emit_gap "$p"; log "$v: failing-test generator filed $id"; fi
    n=$((n + 1))
  done <<< "$payloads"
  [ "$n" -gt 0 ] && log "$v: failing-test generator: $n check-backed gap(s) this tick"
  return 0
}

# A gap that fails to file is worse than no detector: the condition is real, the
# log line claims "(substrateGap)", and nothing is queryable afterwards. Observed
# 2026-08-03: the hub super-repo clone sat DIVERGED for hours, refusing every
# pull-sync run and freezing 25 commits out of the runtime, while the gap store
# held ZERO pull-sync-diverged rows — development-vessel resolves regularly take
# 8-9s under load, so the old --max-time 8 timed out and `|| true` erased it.
# Keep it non-fatal (a detector must never break convergence) but never silent.
emit_gap() {
  local body code
  body="$(dev_resolve "$1" --max-time 30 -w '\n%{http_code}' 2>/dev/null || printf '\n000')"
  code="${body##*$'\n'}"
  case "$code" in
    2*) ;;
    *) log "emit_gap FAILED http=${code:-000} — gap NOT filed (detector fired but nothing is queryable): $(printf '%s' "${body%$'\n'*}" | tr -d '\n' | cut -c1-200)" ;;
  esac
}

# ONE SCRUBBED ENVIRONMENT FOR EVERYTHING THAT RUNS A CANDIDATE'S CODE. This unit loads
# /etc/substrate/env (secrets) and runs as root; a suite, or a `bun install` whose
# manifest a commit just changed, must see neither the secrets nor the live
# WORKSPACE_ROOT (a suite once refreshed 16 fixture rows in the live gap store). The
# suite runners, the failing-test generator and the clone dependency install all run
# under this one construction so they cannot drift apart.
scrubbed_env() { # throwaway-workspace-root cmd... -> runs cmd under env -i with a minimal environment
  local _se_root="$1"; shift
  env -i PATH="$PATH" HOME="${HOME:-/root}" NODE_ENV=test TZ=UTC WORKSPACE_ROOT="$_se_root" "$@"
}

# AN OVERWRITE OF CONTENT PULL-SYNC DID NOT WRITE MUST BE RECOVERABLE AND LOUD.
#
# The mirror runs toward the clone and has no notion of which side is newer. On
# 2026-10-02 10:07Z the drift heal restored human-surface-vessel from a clone that
# WAS origin/dev, over a hand-deployed CSRF fix that had never been pushed: the
# newer code was gone, and nothing said so. "Clone is origin" cannot tell a
# corrupt draft from an unpushed fix — neither is on origin.
#
# Nor can any record pull-sync keeps. $v.sha holds ONE content hash, the last
# clone tree it attempted, and the drift heal only runs when that equals the
# clone hash, so "runtime matches a hash pull-sync wrote" is false by
# construction there; .last-good is a git sha, not a content hash. Refusing every
# such overwrite would also refuse the heal of a patch_with_tools draft left in
# the live tree, which is what the drift heal exists for. So the overwrite still
# happens, but only after the live tree is copied aside and the copy verified
# byte-for-byte; if the copy cannot be made, the caller does NOT overwrite.
#
# The copy lives on the volume (/vessels can be replaced by an image rebuild),
# node_modules excluded, newest DRIFT_QUARANTINE_KEEP per vessel retained.
# Test: validation/scripts/pull-sync-drift-quarantine.test.sh.
DRIFT_QUARANTINE_DIR="${DRIFT_QUARANTINE_DIR:-/workspace/.drift-quarantine}"
DRIFT_QUARANTINE_KEEP="${DRIFT_QUARANTINE_KEEP:-3}"
drift_quarantine() { # vessel -> 0 and DQ_PATH=<copy of $RUNTIME_DIR/<v>>, or 1 and DQ_WHY
  local v="$1" ts dest keep old n
  DQ_PATH=""; DQ_WHY=""
  ts="$(date -u +%Y%m%dT%H%M%S.%NZ)"   # fixed width, so names sort by time
  dest="$DRIFT_QUARANTINE_DIR/$v-$ts"; n=0
  while [ -e "$dest" ]; do n=$((n+1)); dest="$DRIFT_QUARANTINE_DIR/$v-$ts-$n"; done
  if ! mkdir -p "$dest" 2>/dev/null; then DQ_WHY="cannot create $dest"; return 1; fi
  if ! tar -C "$RUNTIME_DIR" --exclude=node_modules -cf - "$v" 2>/dev/null | tar -C "$dest" -xf - 2>/dev/null; then
    DQ_WHY="copying $RUNTIME_DIR/$v into $dest failed"; rm -rf "$dest"; return 1
  fi
  if ! diff -rq -x node_modules "$RUNTIME_DIR/$v" "$dest/$v" >/dev/null 2>&1; then
    DQ_WHY="the copy at $dest does not match $RUNTIME_DIR/$v"; rm -rf "$dest"; return 1
  fi
  DQ_PATH="$dest/$v"
  # Retention only after the new copy is verified. Names sort by their UTC stamp.
  keep="$DRIFT_QUARANTINE_KEEP"; case "$keep" in ''|*[!0-9]*) keep=3 ;; esac
  [ "$keep" -ge 1 ] || keep=1
  ls -1d "$DRIFT_QUARANTINE_DIR/$v"-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9].[0-9]*Z* 2>/dev/null \
    | LC_ALL=C sort | head -n "-$keep" | while IFS= read -r old; do rm -rf "$old"; done
  return 0
}

# INSTALL ONLY WHAT IS COMMITTED.
#
# Every glue install below (units, the bootstrap-tier scripts, this script itself,
# mirror-to-live, self-recovery-tick, the fleet definitions, the active-scripts
# seed) used to copy from the super-repo clone's WORKING TREE. The working tree is
# not the landing channel — a commit on origin is — and on 10-01 that difference
# broke a node: a goal walk's fs_edit wrote an uncommitted change into
# scripts/substrate/substrate-pull-sync.sh in the live clone (an autonomy-scope
# excluded path), this script installed it to /usr/local/bin on its next tick,
# and the node's deploys broke. Nothing had been reviewed, committed or pushed.
#
# So every install reads a STAGED copy of scripts/substrate taken from git
# (`git archive`), never the working tree. The ref is HEAD, unless HEAD carries
# local commits touching scripts/substrate that origin/$BRANCH does not have (a
# commit made in the live clone is not a landing either) — then origin/$BRANCH.
# A tracked file that differs from the ref, or an untracked file under
# scripts/substrate, is DIVERGENCE: logged and filed as a gap each tick it
# persists, and never installed. If nothing can be staged, NOTHING is installed
# this tick (a stale glue layer is recoverable; an installed uncommitted one is
# what broke the node). Destinations are unchanged; PULLSYNC_*_DIR exist only so
# the test (validation/scripts/pull-sync-committed-glue.test.sh) can observe
# an install without root.
UNIT_DIR="${PULLSYNC_UNIT_DIR:-/usr/lib/systemd/system}"
BIN_DIR="${PULLSYNC_BIN_DIR:-/usr/local/bin}"
SHARE_DIR="${PULLSYNC_SHARE_DIR:-/usr/local/share/substrate}"
PULLSYNC_GLUE_STAGE=""
PULLSYNC_GLUE_KEY=""
PULLSYNC_GLUE_KEY_DIR=""
PULLSYNC_GLUE_STAGES=""
pullsync_glue_cleanup() { for _d in $PULLSYNC_GLUE_STAGES; do rm -rf "$_d"; done; PULLSYNC_GLUE_STAGES=""; }
# THE MIRROR PATH'S QUIESCE IS HELD UNTIL ITS RESTART (see "QUIESCE INSTEAD OF ACCEPTING THE
# LOSS" in the vessel loop). Q_HELD is the admission marker that pass still holds; this drops it.
# Called first in every vessel pass (every `continue` lands there), right after the restart,
# after the loop, and on EXIT, so no exit path leaves admission closed. A tick killed outright
# leaves the marker behind; the vessel fails open on a marker past its QUIESCE_MAX_MS.
# A CARRIED HOLD IS THE ONE DELIBERATE SURVIVOR. When the mirror path's quiesce runs out of tick budget
# while the compose is still progressing, the restart is owed instead of taken and admission must STAY
# closed across ticks, or new work enters and the drain bought nothing. That pass sets Q_CARRY to the
# marker and records it in <vessel>.quiesce-carry; quiesce_release (loop head, after the loop, EXIT) then
# leaves that one marker in place. Each later tick's owed path re-touches it (the vessel ignores a marker
# older than its QUIESCE_MAX_MS, 20 min, and a hold may last pull_sync.owed_restart_max_hold_seconds) and
# releases it the moment the hold ends: restart taken (drained, silent past the stall bound, max hold),
# nothing owed any more, or any deferral that is not progress (a probe window). If pull-sync stops
# ticking, nothing re-touches it and the vessel fails open within QUIESCE_MAX_MS.
Q_HELD=""; Q_BOUND=""; Q_CARRY=""
quiesce_release() {
  if [ -n "${Q_HELD:-}" ] && [ "${Q_CARRY:-}" != "$Q_HELD" ]; then
    rm -f "$Q_HELD" "$MARKER_DIR/${Q_HELD##*/}.quiesce-carry" 2>/dev/null
  fi
  Q_HELD=""; Q_BOUND=""; Q_CARRY=""; return 0
}
# owed_hold_bound <vessel> — progress may hold an owed restart, but not forever. Returns 0 (and sets
# RA_DEFER=0, OH_LOSSY=1, RA_WHY, logs LOSSY + a forced_owed_restart_lossy DEFERRAL_LOG record naming the
# attempt /health published) once the restart has been owed (<vessel>.restart-owed-since) for at least
# pull_sync.owed_restart_max_hold_seconds (shaped tuning row, default 2700); 1 while the hold may continue.
# Called only for a progress hold, so vessels that publish no progress never read the row.
# TODO(gap the-causal-attempt-ledger-records-only-landings-so-failed-attempts-have-no-ledger-entry): the
# killed attempt gets a log line and a DEFERRAL_LOG record only; record it in the attempt ledger as a
# killed outcome once that ledger carries failures.
owed_hold_bound() {
  OH_LOSSY=""
  tuning_param pull_sync.owed_restart_max_hold_seconds 2700; _oh_max="$TP_VALUE"
  _oh_since="$(cat "$MARKER_DIR/$1.restart-owed-since" 2>/dev/null || true)"; case "$_oh_since" in ''|*[!0-9]*) return 1 ;; esac
  _oh_held=$(( $(date +%s) - _oh_since ))
  [ "$_oh_held" -ge "$_oh_max" ] 2>/dev/null || return 1
  RA_DEFER=0; OH_LOSSY=1
  RA_WHY="owed for ${_oh_held}s, past pull_sync.owed_restart_max_hold_seconds (${_oh_max}s), though still progressing (${RA_WHY})"
  log "$1: LOSSY owed restart — restarting into ${RA_INFLIGHT:-?} in-flight request(s) still progressing (last stage transition ${RA_PROGRESS:-?}ms ago) after holding the restart ${_oh_held}s (max hold ${_oh_max}s); attempt ${RA_PROGRESS_ID:-unknown} IS lost"
  printf '{"at":"%s","actor":"pull-sync","action":"forced_owed_restart_lossy","vessel":"%s","in_flight":%s,"held_s":%s,"max_hold_s":%s,"last_progress_ms":%s,"attempt":"%s"}\n' \
    "$(date -Iseconds)" "$1" "${RA_INFLIGHT:-0}" "$_oh_held" "$_oh_max" "${RA_PROGRESS:-null}" "${RA_PROGRESS_ID:-unknown}" >> "$DEFERRAL_LOG" 2>/dev/null || true
  return 0
}
trap 'pullsync_glue_cleanup; quiesce_release' EXIT

glue_divergence_gap() { # super path what
  local id summary
  id="pull-sync-uncommitted-glue-$(printf '%s' "$2" | tr -c 'A-Za-z0-9' '-' | cut -c1-80)"
  summary="pull-sync found $2 $3 in the super-repo clone $1 and installed the committed copy instead. A working-tree change under scripts/substrate is not a landing: on 10-01 an uncommitted edit there (written by a goal walk's fs_edit) was installed to /usr/local/bin and broke the node's deploys. Find the writer (git -C $1 diff -- $2), revert or land it through review, and ask which tool wrote into the live clone."
  if command -v jq >/dev/null 2>&1; then
    emit_gap "$(jq -n -c --arg id "$id" --arg s "$summary" '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:"source_divergence",source:"substrate_detected",summary:$s,status:"open"}}}}')"
  else
    log "glue: jq missing — divergence gap $id NOT filed"
  fi
}

# gate_overlay <stage-dir> <sha> (gated mode only): every gate path in the staged tree
# (MANIFEST.gate_paths of the ACCEPTED copy, minus its "!"-prefixed non-root exclusions:
# everything root runs from the glue, render-secret-scope.sh, gen-env.sh, units, …) is
# replaced by the accepted file, a gate path
# the accepted version lacks is removed, and an accepted gate file the commit deleted comes
# back. Installs below then never read a candidate's gate file; candidate.sh judges it.
gate_overlay() {
  local d="$1" sha="$2" rel g n=0 hit globs=()
  mapfile -t globs < <(jq -r '.gate_paths[]?' "$PULLSYNC_ACCEPTED_DIR/MANIFEST.json" 2>/dev/null)
  [ "${#globs[@]}" -gt 0 ] || { log "gate: !!! the accepted MANIFEST names no gate_paths"; return 1; }
  while IFS= read -r rel; do
    hit=1   # a gate glob matches and no "!"-prefixed (non-root) exclusion does
    for g in "${globs[@]}"; do
      if [[ "$g" == '!'* ]]; then [[ "$rel" == ${g#!} ]] && { hit=1; break; }; else [[ "$rel" == $g ]] && hit=0; fi
    done
    [ "$hit" = 0 ] || continue
    if [ -e "$PULLSYNC_ACCEPTED_DIR/$rel" ] || [ -L "$PULLSYNC_ACCEPTED_DIR/$rel" ]; then
      if [ -L "$PULLSYNC_ACCEPTED_DIR/$rel" ] || [ -L "$d/$rel" ]; then
        [ "$(readlink "$PULLSYNC_ACCEPTED_DIR/$rel" 2>/dev/null)" = "$(readlink "$d/$rel" 2>/dev/null)" ] && continue
      else cmp -s "$PULLSYNC_ACCEPTED_DIR/$rel" "$d/$rel" && continue; fi
      rm -f "$d/$rel"; cp -P -p "$PULLSYNC_ACCEPTED_DIR/$rel" "$d/$rel" || return 1; n=$((n+1))
    else
      rm -f "$d/$rel" || return 1; n=$((n+1))
    fi
  done < <(cd "$d" && find scripts ! -type d 2>/dev/null)
  while IFS= read -r rel; do
    [ -e "$d/$rel" ] || [ -L "$d/$rel" ] && continue
    mkdir -p "$d/$(dirname "$rel")" && cp -P -p "$PULLSYNC_ACCEPTED_DIR/$rel" "$d/$rel" || return 1; n=$((n+1))
  done < <(cd "$PULLSYNC_ACCEPTED_DIR" && find scripts ! -type d 2>/dev/null)
  [ "$n" -gt 0 ] && log "gate: $n gate path(s) in ${sha:0:10} differ from the accepted gate — installing the ACCEPTED copies; the candidate is judged by shadow evaluation"
  return 0
}

# gate_candidate <sha> (gated mode only): judge a super-repo commit with candidate.sh from
# accepted/. It never installs or runs the candidate; its GAP lines are filed here.
gate_candidate() {
  local out line cs="$PULLSYNC_ACCEPTED_DIR/scripts/substrate/gate/candidate.sh"
  [ -f "$cs" ] || { log "gate: !!! no classifier in the accepted gate — gate candidates are NOT evaluated (and never installed)"; return 0; }
  out="$(bash "$cs" --gate-dir "$PULLSYNC_GATE_DIR" --super "$SUPER_DIR" --candidate "$1" 2>&1)"
  while IFS= read -r line; do
    case "$line" in
      'GAP '*) emit_gap "${line#GAP }" ;;
      '') ;;
      *) log "gate: $line" ;;
    esac
  done <<< "$out"
}

# stage_committed_glue <super-dir> — sets PULLSYNC_GLUE_STAGE to a directory whose
# scripts/substrate is the committed tree. Returns 1 (and installs nothing) when it
# cannot. Staged once per (clone, commit) per run.
stage_committed_glue() {
  local super="$1" ref sha unpushed dir dirty line path what
  PULLSYNC_GLUE_STAGE=""
  if ! git -C "$super" rev-parse --git-dir >/dev/null 2>&1; then
    log "glue: !!! $super is not a git checkout — installing NOTHING from it (only committed content is ever installed)"
    return 1
  fi
  ref=HEAD
  if git -C "$super" rev-parse -q --verify "origin/$BRANCH" >/dev/null 2>&1; then
    unpushed="$(git -C "$super" rev-list "origin/$BRANCH..HEAD" -- scripts/substrate 2>/dev/null | head -3 | tr '\n' ' ')"
    if [ -n "$unpushed" ]; then
      ref="origin/$BRANCH"
      log "glue: !!! DIVERGENCE — HEAD of $super carries local commit(s) touching scripts/substrate that origin/$BRANCH lacks (${unpushed% }); installing origin/$BRANCH's copy"
      glue_divergence_gap "$super" "scripts/substrate" "changed by local commit(s) not on origin/$BRANCH (${unpushed% })"
    fi
  fi
  sha="$(git -C "$super" rev-parse -q --verify "$ref^{commit}" 2>/dev/null)" || sha=""
  if [ -z "$sha" ]; then
    log "glue: !!! cannot resolve $ref in $super — installing NOTHING this tick"
    return 1
  fi
  if [ "$PULLSYNC_GLUE_KEY" = "$super@$sha" ] && [ -d "$PULLSYNC_GLUE_KEY_DIR" ]; then
    PULLSYNC_GLUE_STAGE="$PULLSYNC_GLUE_KEY_DIR"
    return 0
  fi
  dir="$(mktemp -d "${TMPDIR:-/tmp}/pull-sync-glue.XXXXXX")" || { log "glue: !!! mktemp failed — installing NOTHING this tick"; return 1; }
  PULLSYNC_GLUE_STAGES="$PULLSYNC_GLUE_STAGES $dir"
  if ! git -C "$super" archive "$sha" -- scripts/substrate 2>/dev/null | tar -x -C "$dir" 2>/dev/null || [ ! -d "$dir/scripts/substrate" ]; then
    log "glue: !!! could not stage the committed scripts/substrate from $ref (${sha:0:10}) — installing NOTHING this tick"
    return 1
  fi
  # Report divergence: tracked files that differ from the staged commit, and
  # untracked files (a planted unit or script would have been installed before).
  dirty="$(git -C "$super" diff --name-only "$sha" -- scripts/substrate 2>/dev/null; git -C "$super" ls-files --others --exclude-standard -- scripts/substrate 2>/dev/null)"
  if [ -n "$dirty" ]; then
    while IFS= read -r path; do
      [ -n "$path" ] || continue
      if ! git -C "$super" ls-files --error-unmatch -- "$path" >/dev/null 2>&1; then what="present but untracked"
      elif ! git -C "$super" diff --quiet HEAD -- "$path" 2>/dev/null; then what="modified in the working tree (uncommitted)"
      else what="changed by a local commit not on origin/$BRANCH"; fi
      log "glue: !!! DIVERGENCE — $path is $what in $super; NOT installed (the committed copy from ${sha:0:10} is)"
      glue_divergence_gap "$super" "$path" "$what"
    done <<< "$dirty"
  fi
  if [ -n "${PULLSYNC_ACCEPTED_DIR:-}" ] && ! gate_overlay "$dir" "$sha"; then
    log "glue: !!! could not overlay the accepted gate paths — installing NOTHING this tick"
    return 1
  fi
  PULLSYNC_GLUE_KEY="$super@$sha"
  PULLSYNC_GLUE_KEY_DIR="$dir"
  PULLSYNC_GLUE_STAGE="$dir"
  return 0
}

# UPDATE CHANNEL hold: CONVERGE NOTHING (openspec staged-fleet-rollout, task 3).
#
# The channel is the install input gen-env validates and renders into
# /etc/substrate/env (task 3.0), which this unit reads as its EnvironmentFile; there
# is no second reader. canary (or unset) and fleet fall through to the run below
# unchanged — fleet convergence is task 3.1, not built yet.
#
# A hold node keeps what it runs. Measured (CI run 37011691597): a fresh node from a
# published image had its first-boot pull-sync converge it from image code to
# origin/dev within ~3 min, restarting discovery and goal-host mid-probe, so install
# acceptance judged "image + current dev" instead of the image it names. On hold
# this run therefore touches no vessel (no fetch, mirror or restart), no super-repo
# glue, no units, no fleet definitions, and does not reinstall itself from the
# super-repo — a held node's converger must not change under it. It writes the
# convergence record substrate-status reads, logs one line, and exits.
#
# The SHAs recorded are what RUNS, not the clones: setup-git-push resets the clones
# to origin/dev at boot while the runtime stays at image code. A vessel's live
# revision is its last healthy mirror (last-good), else the revision the image
# baked; the super-repo's is its last-good, else the image revision.
if [ "${SUBSTRATE_UPDATE_CHANNEL:-canary}" = hold ]; then
  _h_img_rev="$(head -n1 /etc/substrate/image-revision 2>/dev/null || true)"
  _h_super="$(cat "$LAST_GOOD_DIR/super-repo" 2>/dev/null || true)"; _h_super="${_h_super:-$_h_img_rev}"
  _h_vessels="{}"
  for _h_d in "$RUNTIME_DIR"/*/; do
    [ -d "$_h_d" ] || continue
    _h_v="$(basename "$_h_d")"
    case "$_h_v" in *-mitosis-*|packages) continue ;; esac
    _h_sha="$(cat "$LAST_GOOD_DIR/$_h_v" 2>/dev/null || true)"
    [ -n "$_h_sha" ] || _h_sha="$(awk -F= -v V="$_h_v" '$1 == V {print $2}' "$SHARE_DIR/vessel-revisions" 2>/dev/null | head -n1)"
    _h_vessels="$(jq -c --arg v "$_h_v" --arg s "$_h_sha" '. + {($v): (if $s == "" then null else $s end)}' <<<"$_h_vessels")"
  done
  if jq -n --arg sha "$_h_super" --argjson vessels "$_h_vessels" --arg at "$(date -Iseconds)" \
       '{channel:"hold", ref:null, sha:(if $sha == "" then null else $sha end), vessels:$vessels, at:$at, ref_missing:false}' \
       > "$MARKER_DIR/channel.json.new" 2>/dev/null \
     && mv -f "$MARKER_DIR/channel.json.new" "$MARKER_DIR/channel.json" 2>/dev/null; then
    log "update channel hold: converging nothing (vessels, super-repo glue, units and pull-sync itself stay as they run; super-repo ${_h_super:0:10}); recorded $MARKER_DIR/channel.json"
  else
    rm -f "$MARKER_DIR/channel.json.new" 2>/dev/null || true
    log "update channel hold: converging nothing; FAILED to write $MARKER_DIR/channel.json, so substrate-status will not confirm the hold"
    exit 1
  fi
  exit 0
fi

# A cutover mid-flight owns /vessels mutation; never race it.
#
# STARVATION BOUND (2026-08-02). The freshness test alone is not enough: the
# marker is REWRITTEN by every new cutover, and an autonomous authoring loop
# stages cutovers far more often than this timer fires (observed: a new marker
# every 2-15 min against a 10-min timer). The lock is then permanently "fresh",
# every run exits here, and the vessel tree NEVER converges — the spoke was
# found running goal-host and development-vessel source that predated four
# landed fixes, so its autonomous work executed against stale logic and kept
# re-deriving problems that were already fixed on origin/dev. Indefinite
# staleness is a worse failure than a rare cutover race, and the cutover holds
# its own change-window lease (checked immediately below) which protects the
# genuine mid-swap window. So: defer, but only for a BOUNDED number of
# consecutive runs, then converge anyway and say so loudly.
MITOSIS_DEFER_COUNT_FILE=/workspace/pull-sync-mitosis-defers
MITOSIS_MAX_CONSECUTIVE_DEFERS="${MITOSIS_MAX_CONSECUTIVE_DEFERS:-4}"
# A re-exec'd tick does not re-ask: its parent already decided to converge (possibly as a
# starvation break, after which the counter above was reset and a re-check would defer).
if [ "${PULLSYNC_REEXECED:-}" != 1 ] && [ -f "$MITOSIS_LOCK" ] && [ -n "$(find "$MITOSIS_LOCK" -mmin "-$MITOSIS_LOCK_TTL_MIN" 2>/dev/null)" ]; then
  _defers="$(cat "$MITOSIS_DEFER_COUNT_FILE" 2>/dev/null || echo 0)"
  case "$_defers" in ''|*[!0-9]*) _defers=0 ;; esac
  _defers=$((_defers + 1))
  echo "$_defers" > "$MITOSIS_DEFER_COUNT_FILE" 2>/dev/null || true
  if [ "$_defers" -le "$MITOSIS_MAX_CONSECUTIVE_DEFERS" ]; then
    log "mitosis cutover in flight ($MITOSIS_LOCK fresh) — skipping this run ($_defers/$MITOSIS_MAX_CONSECUTIVE_DEFERS)"
    echo "{\"at\":\"$(date -Iseconds)\",\"actor\":\"pull-sync\",\"action\":\"deferred_mitosis\",\"consecutive\":$_defers}" >> "$DEFERRAL_LOG" 2>/dev/null || true
    exit 0
  fi
  log "STARVATION BREAK: mitosis marker has deferred $_defers consecutive runs (> $MITOSIS_MAX_CONSECUTIVE_DEFERS) — converging anyway; the change-window lease still guards a genuine mid-swap"
  echo "{\"at\":\"$(date -Iseconds)\",\"actor\":\"pull-sync\",\"action\":\"starvation_break_mitosis\",\"consecutive\":$_defers}" >> "$DEFERRAL_LOG" 2>/dev/null || true
fi
# Converging (or no lock at all) — reset the consecutive-deferral counter.
rm -f "$MITOSIS_DEFER_COUNT_FILE" 2>/dev/null || true

# Change-window (2026-07-09 contiguous-shape-flow §5): a held change_window lease
# means a change-set is landing; pull-sync defers rather than converging mid-swap.
# TTL-bounded on the lease side, so a crashed holder cannot defer us forever.
CW_HELD="$(dev_resolve '{"impulse":{"type":"maintenanceLease","name":"change_window"}}' --max-time 5 2>/dev/null \
  | grep -o '"held":true' || true)"
if [ -n "$CW_HELD" ]; then
  log "change_window lease held — deferring this run"
  echo "{\"at\":\"$(date -Iseconds)\",\"actor\":\"pull-sync\",\"action\":\"deferred_change_window\"}" >> "$DEFERRAL_LOG" 2>/dev/null || true
  exit 0
fi

# SELF-CONVERGE FIRST: the tick that pulls a commit runs that commit's pull-sync.
#
# pull-sync used to reinstall itself (and mirror-to-live) at the END of a tick, after
# the super-repo pull, so the first tick after a merge ran the OLD script against the
# NEW super-repo content. Observed 10-02 with 3b7b31b9: the old converge_units (no
# secret renderer) installed new identity/discovery units whose non-"-"
# EnvironmentFile=<scoped file> did not exist yet, so any restart of
# those units would have failed until the next tick. Any new step a commit adds to the
# converger has the same hole: it can never apply to the tick that pulls it.
#
# So, before anything converges: fetch the super-repo once (section 4 reuses the
# result), fast-forward it when it is strictly behind, stage its COMMITTED
# scripts/substrate, and if the committed pull-sync differs from the file executing
# now, install it with its helpers and exec it, once. PULLSYNC_REEXECED=1 makes the
# second pass skip this block, so a copy that never matches (a failed write, origin
# moving under us) cannot loop. A staged copy that fails `bash -n` is never installed:
# the tick finishes on the code it started with and files a gap. The hold channel
# exits above, so a held node never reaches this block and never self-updates.
SUPER_DIR="${SUPER_REPO_DIR:-/workspace/git/super-repo}"
if [ "${PULLSYNC_REEXECED:-}" = 1 ] && [ -n "${PULLSYNC_SUPER_FETCH_OK:-}" ]; then
  SUPER_FETCH_OK="$PULLSYNC_SUPER_FETCH_OK"   # the parent fetched this tick; once is enough
else
  SUPER_FETCH_OK=0
  if [ -d "$SUPER_DIR/.git" ]; then
    if git -C "$SUPER_DIR" fetch -q origin "$BRANCH" 2>/dev/null; then
      SUPER_FETCH_OK=1
    else
      log "super-repo: FETCH FAILED — glue layer NOT converged this tick (scripts, federation wrapper, and pull-sync's own self-update all skipped); the clone stays at $(git -C "$SUPER_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    fi
  fi
fi
if [ "${PULLSYNC_REEXECED:-}" != 1 ] && [ "$SUPER_FETCH_OK" = 1 ]; then
  _se_head="$(git -C "$SUPER_DIR" rev-parse HEAD 2>/dev/null || true)"
  _se_remote="$(git -C "$SUPER_DIR" rev-parse "origin/$BRANCH" 2>/dev/null || true)"
  # Strictly behind only; ahead and diverged are section 4's to report.
  if [ -n "$_se_head" ] && [ -n "$_se_remote" ] && [ "$_se_head" != "$_se_remote" ] \
     && git -C "$SUPER_DIR" merge-base --is-ancestor HEAD "origin/$BRANCH" 2>/dev/null; then
    git -C "$SUPER_DIR" checkout -q "$BRANCH" 2>/dev/null || true
    _se_err="$(git -C "$SUPER_DIR" pull -q --ff-only origin "$BRANCH" 2>&1)" \
      || log "super-repo: early ff-only pull FAILED — this tick's self-update reads $(git -C "$SUPER_DIR" rev-parse --short HEAD 2>/dev/null); git said: $(printf '%s' "$_se_err" | tr '\n' ' ' | cut -c1-300)"
  fi
  _se_self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || true)"
  if [ -n "$_se_self" ] && [ -r "$_se_self" ] && stage_committed_glue "$SUPER_DIR"; then
    _se_src="$PULLSYNC_GLUE_STAGE/scripts/substrate"
    # The shared tracked-red predicate this script sources (see the gap-tracked-red loader). The
    # /usr/local/bin copy reads it from $SHARE_DIR/lib, which the image may predate: converge it
    # every ungated tick, before any re-exec, so the exec'd tick and a lib-only commit both reach
    # it. A copy that fails `bash -n` is not installed (the old one, or none, keeps the gate strict).
    _se_lib_from="$_se_src/lib/gap-tracked-red.sh"; _se_lib_to="$SHARE_DIR/lib/gap-tracked-red.sh"
    if [ -z "$PULLSYNC_ACCEPTED_DIR" ] && [ -f "$_se_lib_from" ] && ! cmp -s "$_se_lib_from" "$_se_lib_to" 2>/dev/null; then
      if bash -n "$_se_lib_from" 2>/dev/null && mkdir -p "$SHARE_DIR/lib" 2>/dev/null \
         && install -m 0644 "$_se_lib_from" "$_se_lib_to.new" 2>/dev/null && mv -f "$_se_lib_to.new" "$_se_lib_to" 2>/dev/null; then
        log "self: converged $_se_lib_to (the shared tracked-red predicate)"
      else
        log "self: !!! could not converge $_se_lib_to — the installed copy, if any, stays in use (none = no failing test is exempted)"
      fi
    fi
    if [ -n "$PULLSYNC_ACCEPTED_DIR" ]; then
      # GATED: no run-on-arrival. The helpers converge from the overlaid stage (a gate-path
      # helper such as mirror-to-live is the ACCEPTED copy there); the pulled commit is judged.
      for _se_pair in "mirror-to-live.sh:mirror-to-live" "self-recovery-tick.sh:self-recovery-tick"; do
        _se_from="$_se_src/${_se_pair%%:*}"; _se_to="$BIN_DIR/${_se_pair#*:}"
        [ -f "$_se_from" ] && [ -e "$_se_to" ] || continue
        cmp -s "$_se_from" "$_se_to" && continue
        install -m 0755 "$_se_from" "$_se_to.new" 2>/dev/null && mv -f "$_se_to.new" "$_se_to" 2>/dev/null \
          && log "self: converged $(basename "$_se_to")"
      done
      gate_candidate "${PULLSYNC_GLUE_KEY##*@}"
    elif [ -f "$_se_src/substrate-pull-sync.sh" ] && ! cmp -s "$_se_src/substrate-pull-sync.sh" "$_se_self"; then
      if ! _se_syn="$(bash -n "$_se_src/substrate-pull-sync.sh" 2>&1)"; then
        log "self: !!! the committed substrate-pull-sync.sh does not parse — NOT installed; this tick finishes on the running code: $(printf '%s' "$_se_syn" | tr '\n' ' ' | cut -c1-300)"
        emit_gap "$(jq -n -c --arg s "pull-sync refused to install the committed scripts/substrate/substrate-pull-sync.sh because bash -n rejects it: $(printf '%s' "$_se_syn" | tr '\n' ' ' | cut -c1-300). The node keeps converging on its installed copy until a parsing commit lands." \
          '{impulse:{pointer:{type:"substrateGap_write",gap:{id:"pull-sync-self-update-unparseable",category:"service_failure",source:"substrate_detected",summary:$s,status:"open"}}}}' 2>/dev/null)"
      else
        # Helpers first, so the exec'd tick runs against its own generation of them.
        # Only what is already installed is replaced (never invent a tool the image lacks).
        for _se_pair in "mirror-to-live.sh:mirror-to-live" "self-recovery-tick.sh:self-recovery-tick"; do
          _se_from="$_se_src/${_se_pair%%:*}"; _se_to="$BIN_DIR/${_se_pair#*:}"
          [ -f "$_se_from" ] && [ -e "$_se_to" ] || continue
          cmp -s "$_se_from" "$_se_to" && continue
          install -m 0755 "$_se_from" "$_se_to.new" 2>/dev/null && mv -f "$_se_to.new" "$_se_to" 2>/dev/null \
            && log "self: converged $(basename "$_se_to")"
        done
        # Atomic: install to .new, then rename; the running bash keeps its old inode.
        if install -m 0755 "$_se_src/substrate-pull-sync.sh" "$BIN_DIR/.substrate-pull-sync.new" 2>/dev/null \
           && mv -f "$BIN_DIR/.substrate-pull-sync.new" "$BIN_DIR/substrate-pull-sync" 2>/dev/null; then
          log "self: the committed substrate-pull-sync differs from the running one — installed it; re-executing this tick on it (once)"
          pullsync_glue_cleanup   # exec does not run the EXIT trap
          shopt -s execfail       # a failed exec falls through to the log line, not exit
          exec env PULLSYNC_REEXECED=1 PULLSYNC_T0="$PULLSYNC_T0" PULLSYNC_SUPER_FETCH_OK="$SUPER_FETCH_OK" \
            bash "$BIN_DIR/substrate-pull-sync" ${PULLSYNC_ARGS[@]+"${PULLSYNC_ARGS[@]}"}
          log "self: !!! exec of the new substrate-pull-sync FAILED — this tick finishes on the running code"
        else
          log "self: !!! could not install the committed substrate-pull-sync to $BIN_DIR — this tick finishes on the running code"
        fi
      fi
    fi
  fi
elif [ "${PULLSYNC_REEXECED:-}" = 1 ]; then
  _se_self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || true)"
  if [ -n "$_se_self" ] && stage_committed_glue "$SUPER_DIR" \
     && [ -f "$PULLSYNC_GLUE_STAGE/scripts/substrate/substrate-pull-sync.sh" ] \
     && ! cmp -s "$PULLSYNC_GLUE_STAGE/scripts/substrate/substrate-pull-sync.sh" "$_se_self"; then
    log "self: still not the committed substrate-pull-sync after one re-exec — NOT re-executing again this tick (no loop); the next tick retries"
  fi
fi

# TRACKED-RED LIB MISSING: A LOUD NO-OP TICK (qa, 10-02). Placed after SELF-CONVERGE FIRST, the heal path:
# an ungated tick has just converged $SHARE_DIR/lib from the super-repo (and may have re-exec'd on a newer
# pull-sync); a gated one has just judged the pulled commit, whose fixture corpus refuses a body that cannot
# source its lib. If the predicate still loads from neither place, this tick restarts, mirrors, writes and
# installs NOTHING (no vessel, baseline, unit, fleet-def or generator step runs): without it every armed
# check-first red would read as a regression. It logs one line and files or BUMPS one high-severity gap with
# a stable per-node id; first_seen persists in $MARKER_DIR across ticks. The self_fact row
# pull_sync_tracked_red_lib_missing (scripts/substrate/self-facts.json) reads that log line from the journal,
# so the frozen state stands as a self-fact too, not only as a closable gap. A tick that loads it again
# closes the gap. The super-repo fetch above keeps running, so a fixing commit can still arrive.
# >>> gap-tracked-red missing
GTR_MISSING_FIRST="$MARKER_DIR/gap-tracked-red-lib-missing.first_seen"
GTR_MISSING_TICKS="$MARKER_DIR/gap-tracked-red-lib-missing.ticks"
GTR_NODE="$(hostname 2>/dev/null || cat /proc/sys/kernel/hostname 2>/dev/null)"; GTR_NODE="${GTR_NODE:-${HOSTNAME:-unknown}}"
GTR_MISSING_ID="pull-sync-gap-tracked-red-lib-missing-$(printf '%s' "$GTR_NODE" | tr -c 'A-Za-z0-9._-' '-')"
if ! gtr_try_load; then
  mkdir -p "$MARKER_DIR" 2>/dev/null
  [ -s "$GTR_MISSING_FIRST" ] || date -u +%Y-%m-%dT%H:%M:%SZ > "$GTR_MISSING_FIRST" 2>/dev/null
  _gm_n="$(cat "$GTR_MISSING_TICKS" 2>/dev/null)"; case "$_gm_n" in ''|*[!0-9]*) _gm_n=0 ;; esac; _gm_n=$((_gm_n + 1))
  echo "$_gm_n" > "$GTR_MISSING_TICKS" 2>/dev/null
  _gm_where="$(gtr_lib_candidates | tr '\n' ' ')"
  log "!!! TRACKED-RED LIB MISSING — gap-tracked-red.sh loads from neither ${_gm_where% }; NO-OP TICK: nothing is restarted, mirrored, written or installed (tick $_gm_n since $(cat "$GTR_MISSING_FIRST" 2>/dev/null)) — $GTR_MISSING_ID"
  emit_gap "$(jq -n -c --arg id "$GTR_MISSING_ID" --arg node "$GTR_NODE" \
      --arg first "$(cat "$GTR_MISSING_FIRST" 2>/dev/null)" --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg n "$_gm_n" --arg where "${_gm_where% }" \
      '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:"service_failure",source:"substrate_detected",status:"open",severity:"high",
        summary:("pull-sync on " + $node + " cannot load its tracked-red predicate (scripts/substrate/lib/gap-tracked-red.sh) from " + $where + ", so it is converging NOTHING: every tick is a no-op until the lib is present. Without the predicate an armed check-first red would be refused as a regression. Since " + $first + ", " + $n + " tick(s)."),
        classification_metadata:{node:$node,first_seen:$first,last_seen:$now,missing_ticks:($n|tonumber),looked_in:($where|split(" ")),edit_site:"scripts/substrate/substrate-pull-sync.sh"}}}}}' 2>/dev/null)"
  exit 0
fi
if [ -s "$GTR_MISSING_FIRST" ]; then
  log "tracked-red predicate loads again ($GTR_LIB) — closing $GTR_MISSING_ID"
  emit_gap "$(jq -n -c --arg id "$GTR_MISSING_ID" --arg first "$(cat "$GTR_MISSING_FIRST" 2>/dev/null)" --arg lib "$GTR_LIB" \
      '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:"service_failure",source:"substrate_detected",status:"closed",closed_reason:"lib_loads_again",
        summary:("pull-sync loads its tracked-red predicate again from " + $lib + "; it was missing since " + $first + "."),
        classification_metadata:{first_seen:$first,loaded_from:$lib}}}}}' 2>/dev/null)"
  rm -f "$GTR_MISSING_FIRST" "$GTR_MISSING_TICKS"
fi
# <<< gap-tracked-red missing

# Vessel -> unit map from the inventory (fallback: every clone dir, unit <v>.service).
# QUIESCE AND DRAIN. vessel port -> 0 iff in-flight reached 0; sets QD_WHY. Closes admission with
# the same marker the mirror path writes (QUIESCE_DIR/<vessel>; the vessel refuses new long-running
# work while it exists), then polls /health in_flight until 0 or until what is left of the unit's
# start timeout (less a margin) runs out. Closing admission makes in-flight fall monotonically, so
# the wait is bounded by the longest single run. The marker is always removed.
quiesce_drain() {
  QD_WHY=""
  _qd_dir="${QUIESCE_DIR:-/workspace/quiesce}"
  mkdir -p "$_qd_dir" 2>/dev/null || true
  : > "$_qd_dir/$1" 2>/dev/null || true
  log "$1: owed restart QUIESCED (admission closed); waiting for in-flight work to finish"
  : "${GATE_T0:=$(date +%s)}"
  _qd_wait="${QUIESCE_WAIT_S:-900}"
  _qd_left=$(( ${UNIT_TIMEOUT_S:-900} - ( $(date +%s) - GATE_T0 ) - ${QUIESCE_MARGIN_S:-120} ))
  [ "$_qd_left" -lt 0 ] && _qd_left=0
  [ "$_qd_wait" -gt "$_qd_left" ] && _qd_wait="$_qd_left"
  _qd_spent=0; _qd_now=1
  while :; do
    _qd_now="$(curl -s --max-time 5 "http://127.0.0.1:$2/health" 2>/dev/null \
      | grep -o '"in_flight"[[:space:]]*:[[:space:]]*[0-9][0-9]*' | grep -o '[0-9]*$' | head -1)"
    _qd_now="${_qd_now:-0}"; case "$_qd_now" in *[!0-9]*) _qd_now=0 ;; esac
    [ "$_qd_now" -eq 0 ] && break
    [ "$_qd_spent" -ge "$_qd_wait" ] && break
    sleep "${QUIESCE_STEP_S:-10}"; _qd_spent=$(( _qd_spent + ${QUIESCE_STEP_S:-10} ))
  done
  rm -f "$_qd_dir/$1" 2>/dev/null || true
  if [ "$_qd_now" -eq 0 ]; then
    QD_WHY="drained to 0 in ${_qd_spent}s, nothing lost"; log "$1: $QD_WHY"; return 0
  fi
  QD_WHY="still $_qd_now in flight after ${_qd_spent}s (bound ${_qd_wait}s); restarting anyway, that run IS lost"
  log "$1: $QD_WHY"; return 1
}

# LOADED CODE OLDER THAN THE CODE ON DISK. vessel runtime-dir unit -> 0 iff the
# unit's non-test runtime content changed while the unit kept running; sets LCS_WHY.
# Bun does not hot-reload, so changed content under an unrestarted unit is code it
# is not running, and no health signal shows it. mtime cannot tell: mirror-to-live
# copies with `cp -r`, so every mirror (test-only ones included) refreshes every
# file. So the marker $v.loaded records "<unit start>\t<non-test hash>": a start
# time that differs from the record means the unit (re)started outside this check
# and loaded what is on disk, so re-baseline; the same start with a different hash
# means content moved under a running unit. Uncomputable -> 1 (not stale): this
# check only ever ADDS a restart, so failing it leaves the pending-marker path as is.
loaded_code_stale() {
  LCS_WHY=""
  _lcs_m="$MARKER_DIR/$1.loaded"
  _lcs_at="$(systemctl show -p ActiveEnterTimestamp --value "$3" 2>/dev/null)"
  [ -n "$_lcs_at" ] || return 1
  _lcs_h="$(content_hash_nontest "$2")"
  [ -n "$_lcs_h" ] && [ "$_lcs_h" != none ] || return 1
  _lcs_rec="$(cat "$_lcs_m" 2>/dev/null || true)"
  if [ "${_lcs_rec%%	*}" != "$_lcs_at" ]; then
    printf '%s\t%s\n' "$_lcs_at" "$_lcs_h" > "$_lcs_m" 2>/dev/null || true
    return 1
  fi
  [ "${_lcs_rec#*	}" = "$_lcs_h" ] && return 1
  LCS_WHY="non-test content ${_lcs_rec#*	} -> $_lcs_h under a unit running since $_lcs_at"
  LCS_WHY="$(printf '%s' "$LCS_WHY" | sed -E 's/([0-9a-f]{10})[0-9a-f]{22}/\1/g')"
  return 0
}

vessel_unit() { # vessel -> systemd unit or empty
  if command -v jq >/dev/null 2>&1 && [ -f "$INV" ]; then
    jq -r --arg v "$1" '.vessels[] | select(.repo == $v) | .unit' "$INV" | head -1
  else
    echo "$1.service"
  fi
}

health_port() { # vessel -> port or empty
  if command -v jq >/dev/null 2>&1 && [ -f "$INV" ]; then
    jq -r --arg v "$1" '.vessels[] | select(.repo == $v) | .health_port // empty' "$INV" | head -1
  fi
}

restart_siblings() { # vessel primary-unit — restart every other active unit that runs this vessel's source
  # One vessel's source can back several units: the rendered LLM arms (llm-google,
  # llm-haiku, llm-opus, …) all run /vessels/llm-resolver-vessel. Restarting only
  # the vessel's own unit left those arms serving code weeks older than the source
  # on disk, with every health signal green. Any unit whose WorkingDirectory is the
  # converged vessel's tree is restarted too, staggered like the primary.
  local v="$1" primary="$2" u wd
  for u in $(systemctl list-units --type=service --state=active --no-legend --plain 2>/dev/null | awk '{print $1}'); do
    [ "$u" = "$primary" ] && continue
    wd="$(systemctl show "$u" -p WorkingDirectory --value 2>/dev/null)"
    case "$wd" in "/vessels/$v"|"/vessels/$v/") ;; *) continue ;; esac
    restart_breadcrumb "$v" "sibling unit $u runs the same source"
    log "$v: restarting $u, which runs the same source"
    systemctl restart "$u" 2>/dev/null || true
    sleep "$STAGGER_SECONDS"
  done
}
healthy() { # port -> 0 if 200
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$1/health" 2>/dev/null | grep -q '^200$'
}

# converge_units <super-repo-dir> — mirror scripts/substrate/units/ into the systemd
# unit tree. Dockerfile.substrate:213 copies units into the IMAGE and nothing converged
# them afterwards, so every systemd-level repair (TimeoutStopSec, drains, restart policy,
# Environment=) silently no-opped until someone rebuilt, with nothing reporting that it
# had not taken.
#
# Called UNCONDITIONALLY each tick, deliberately NOT from inside the marker-gated
# super-repo refresh. That gate fires only when origin ADVANCES past the last-converged
# sha, which means a glue capability can never apply to the commit that INTRODUCED it:
# the old binary writes the marker, then installs the new binary, and by the next tick
# the marker already says "done" (observed 2026-08-05 — unit convergence landed in
# 23ee216e and did not run for 23ee216e; DropInPaths still showed the goal-host drain
# drop-in absent and TimeoutStopUSec still 1min). Running it every tick is cheap and
# self-limiting: cmp -s makes it a no-op when nothing differs, and it logs only on a
# real change.
#
# Target /usr/lib, NOT /etc, deliberately: /etc outranks every other unit dir, so a unit
# living there can never be masked — and masking is how apply-inventory keeps vessels off
# a spoke (Dockerfile.substrate:208 vendors them low precisely so they stay maskable).
# Writing units to /etc would silently un-maskable the whole fleet.
converge_units() {
  _cu_super="$1"
  # Committed content only (stage_committed_glue): _cu_root is a staged git tree.
  stage_committed_glue "$_cu_super" || return 0
  _cu_root="$PULLSYNC_GLUE_STAGE"
  [ -d "$_cu_root/scripts/substrate/units" ] || return 0
  # SCOPED SECRETS FIRST. Consumer units load /etc/substrate/private/env.d/<unit>.env WITHOUT
  # '-' (secrets-manifest.json), but gen-env renders those files only at boot. A unit
  # converged onto a node booted before the split, then restarted (identity-vessel is,
  # whenever its repo advances), would fail on the missing file. So render them here,
  # in recover mode (values from the files already rendered, else the shared env this
  # node booted with, else the persisted store; never minted), and converge NO unit
  # this tick if that fails. After the units land, the same renderer removes each
  # scoped name from the shared env once every installed consumer loads its file.
  _cu_rss="$_cu_root/scripts/substrate/render-secret-scope.sh"
  _cu_envdir="${PULLSYNC_SECRET_ENV_DIR:-/etc/substrate}"
  if [ -f "$_cu_rss" ] && [ -f "$_cu_envdir/env" ]; then
    if ! bash "$_cu_rss" --mode recover --env-dir "$_cu_envdir" >/dev/null 2>"$_cu_envdir/.secret-scope.err"; then
      log "units: !!! render-secret-scope failed ($(tail -n1 "$_cu_envdir/.secret-scope.err" 2>/dev/null)) — converging NO unit this tick, so no consumer is installed without its scoped file"
      return 0
    fi
  fi
  # REFUSE A UNIT WHOSE REQUIRED ENVIRONMENT FILE IS ABSENT (defence in depth behind
  # SELF-CONVERGE FIRST). systemd refuses to START a unit whose EnvironmentFile= (no '-')
  # names a missing file, so installing it arms a failure for its next restart. Checked
  # here, after the render above, per unit file and per drop-in: such a file is skipped,
  # logged, and filed as one gap per unit (stable id); the installed copy, if any, stays.
  # '-' paths are optional by definition; paths with % specifiers cannot be resolved here.
  _cu_envfile_missing() { # unit-or-dropin-file -> prints the first missing required path
    local _l _p
    while IFS= read -r _l; do
      _p="${_l#*=}"; _p="${_p#"${_p%%[![:space:]]*}"}"; _p="${_p%"${_p##*[![:space:]]}"}"
      _p="${_p#\"}"; _p="${_p%\"}"
      case "$_p" in ''|-*|*%*) continue ;; esac
      [ -e "$_p" ] || { printf '%s\n' "$_p"; return 0; }
    done < <(grep -E '^[[:space:]]*EnvironmentFile[[:space:]]*=' "$1" 2>/dev/null)
    return 1
  }
  _cu_refuse() { # unit file missing-path
    local _id
    _id="pull-sync-unit-envfile-missing-$(printf '%s' "$1" | tr -c 'A-Za-z0-9' '-' | cut -c1-80)"
    log "units: !!! REFUSED $2 — it requires EnvironmentFile=$3, which does not exist; NOT installed (the installed copy, if any, stays) ($_id)"
    if command -v jq >/dev/null 2>&1; then
      emit_gap "$(jq -n -c --arg id "$_id" --arg u "$1" --arg f "$2" --arg p "$3" \
        --arg s "pull-sync refused to install $2 for unit $1: it loads EnvironmentFile=$3 without '-', and that file does not exist on this node after the secret-scope render, so systemd would refuse to start $1 on its next restart. Find who should render $3 (secrets-manifest.json / render-secret-scope.sh), or make the load optional with '-'." \
        '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:"service_failure",source:"substrate_detected",summary:$s,classification_metadata:{unit:$u,file:$f,missing_environment_file:$p},status:"open"}}}}')"
    else
      log "units: jq missing — gap $_id NOT filed"
    fi
  }
  UNITS_CHANGED=0
  for uf in "$_cu_root"/scripts/substrate/units/*; do
    [ -e "$uf" ] || continue
    ubase="$(basename "$uf")"
    if [ -d "$uf" ]; then
      # drop-in directory: <unit>.service.d/*.conf
      mkdir -p "$UNIT_DIR/$ubase" 2>/dev/null || true
      for cf in "$uf"/*; do
        [ -f "$cf" ] || continue
        dst="$UNIT_DIR/$ubase/$(basename "$cf")"
        if ! cmp -s "$cf" "$dst" 2>/dev/null; then
          if _cu_miss="$(_cu_envfile_missing "$cf")"; then _cu_refuse "${ubase%.d}" "$ubase/$(basename "$cf")" "$_cu_miss"; continue; fi
          install -m 0644 "$cf" "$dst" 2>/dev/null && { log "units: converged $ubase/$(basename "$cf")"; UNITS_CHANGED=1; }
        fi
      done
    else
      dst="$UNIT_DIR/$ubase"
      if ! cmp -s "$uf" "$dst" 2>/dev/null; then
        if _cu_miss="$(_cu_envfile_missing "$uf")"; then _cu_refuse "$ubase" "$ubase" "$_cu_miss"; continue; fi
        install -m 0644 "$uf" "$dst" 2>/dev/null && { log "units: converged $ubase"; UNITS_CHANGED=1; }
        # A REAL file in /etc outranks /usr/lib, so the convergence above is
        # inert for that unit — systemd keeps using the /etc copy and the log
        # line still says "converged". vessel-ctl renders units into /etc, so
        # every dynamically-installed vessel acquires such a shadow and freezes
        # against every later systemd-level repair. Observed 2026-08-08:
        # development-vessel kept its old ExecStartPost (and kept serializing
        # the boot) while /usr/lib carried the fixed unit, with 8 units shadowed
        # on one container. Say so rather than reporting a no-op as a success.
        if [ -f "/etc/systemd/system/$ubase" ] && [ ! -L "/etc/systemd/system/$ubase" ]; then
          log "units: !!! $ubase is SHADOWED by a real /etc/systemd/system/$ubase — the convergence above is INERT until that file is removed or re-rendered"
        fi
      fi
    fi
  done
  if [ "$UNITS_CHANGED" = "1" ]; then
    systemctl daemon-reload 2>/dev/null \
      && log "units: daemon-reload done — TimeoutStopSec/Restart apply at the next stop; Environment= needs the unit to restart (next convergence)" \
      || log "units: !!! daemon-reload FAILED — unit changes are on disk but NOT active"
  fi
  if [ -f "$_cu_rss" ] && [ -f "$_cu_envdir/env" ]; then
    # --retire-legacy only here, after the units converged: a flat-layout file an
    # installed unit still names becomes a symlink into the private directory, the
    # rest are removed (render-secret-scope.sh MIGRATION).
    bash "$_cu_rss" --mode recover --strip-shared --retire-legacy --env-dir "$_cu_envdir" \
      --unit-dirs "/etc/systemd/system /run/systemd/system $UNIT_DIR /lib/systemd/system" 2>&1 \
      | grep -E 'removed from the shared env|kept |retired |moved |created ' | while IFS= read -r _l; do log "units: $_l"; done || true
  fi
  # THE MASK, BY EFFECT, AFTER EVERY RENDER. A unit's InaccessiblePaths= binds what
  # existed when it started, so neither the drop-in text nor `systemctl show` can say
  # whether a running vessel can open the secrets: only a stat from inside its mount
  # namespace can (secret-mask-probe.sh; dev:inode only, never contents). It runs its
  # own must-fail control first (a renamed file under a file mask must be seen), so a
  # blind probe is reported as blind, never as a pass. Every tick renders, so this is
  # also the rhythm. A finding is a gap with a stable id per tick-independent cause.
  _cu_smp="$_cu_root/scripts/substrate/secret-mask-probe.sh"
  if [ -f "$_cu_smp" ] && [ "${PULLSYNC_SECRET_MASK_PROBE:-1}" = 1 ] && [ "$_cu_envdir" = /etc/substrate ]; then
    _cu_smp_rc=0
    bash "$_cu_smp" check --env-dir "$_cu_envdir" > "$_cu_envdir/.secret-mask-probe.out" 2>&1 || _cu_smp_rc=$?
    if [ "$_cu_smp_rc" != 0 ]; then
      _cu_smp_lines="$(grep -E '^(VISIBLE|UNMASKED|FAIL|BLIND)' "$_cu_envdir/.secret-mask-probe.out" | head -n 20)"
      # rc 1 = the scoped-secrets directory; 3 = another masked path (a file mask gone stale); 2 = blind
      log "units: !!! secret-mask-probe rc=$_cu_smp_rc: $(printf '%s' "$_cu_smp_lines" | tr '\n' ';')"
      if command -v jq >/dev/null 2>&1; then
        case "$_cu_smp_rc" in 2) _cu_smp_kind=blind ;; 3) _cu_smp_kind=other-path-leak ;; *) _cu_smp_kind=leak ;; esac
        emit_gap "$(jq -n -c --arg id "secret-mask-probe-$_cu_smp_kind" --arg l "$_cu_smp_lines" --arg k "$_cu_smp_kind" \
          --arg s "secret-mask-probe found the scoped-secrets directory reachable from inside a unit namespace, or could not prove it is not ($_cu_smp_kind). A unit started before the mask existed needs a restart; an UNMASKED unit needs the default-deny drop-in or a declared exemption (units/service.d/EXEMPT). Findings name units and paths only." \
          '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:"security",source:"substrate_detected",summary:$s,classification_metadata:{kind:$k,findings:$l},status:"open"}}}}')"
      fi
    fi
  fi
  # CONVERGING A TIMER'S FILE DOES NOT MAKE IT FIRE.
  #
  # `install` + daemon-reload leaves a NEW timer known-to-systemd and DISABLED:
  # WantedBy=timers.target only takes effect once `enable` writes the
  # timers.target.wants symlink. So a timer added to units/ sat on disk, correctly
  # converged, logged as "converged", and never ran — and a timer that never runs
  # emits silence, which every consumer reads as health. That is the same
  # built-but-never-connected shape this file already fights for Environment= and
  # drop-ins. Found 2026-09-09 while adding validator-liveness.timer: it only fired
  # because it was enabled BY HAND, and that symlink lives in /etc, so the next
  # image rebuild would have brought the unit back installed-and-disabled.
  #
  # Enable only what reports exactly `disabled`. `is-enabled` also returns `masked`
  # (apply-inventory's mechanism for keeping a unit off a spoke — see the /usr/lib
  # targeting note above), `static`, and `indirect`; acting on those would either
  # un-mask a deliberately-masked unit or churn. Idempotent, so it is a no-op on
  # every tick after the first, and it logs only when it actually changes something.
  for uf in "$_cu_root"/scripts/substrate/units/*.timer; do
    [ -f "$uf" ] || continue
    ubase="$(basename "$uf")"
    if [ "$(systemctl is-enabled "$ubase" 2>/dev/null)" = "disabled" ]; then
      systemctl enable --now "$ubase" >/dev/null 2>&1 \
        && log "units: ENABLED $ubase — it was converged but disabled, so it had never fired" \
        || log "units: !!! failed to enable $ubase — the unit is on disk and will not fire"
    fi
  done
}

# converge_fleet_defs <super-repo-dir> — the LAST members of the
# super-repo-not-in-self-update-set class, and the ones that decide which
# vessels a container runs at all.
#
# Two things were still stuck at image-build time:
#
#   /usr/local/bin/apply-inventory — the selector itself. entrypoint.sh runs
#   THIS copy, not the git one, so a selection feature added in the repo (e.g.
#   PROFILE=<name>) never reached any running container: the image copy had no
#   PROFILE support while the git copy did, on the same box.
#
#   $FLEET_DIR/vessels.inventory.json — seeded from the image on FIRST boot and
#   authoritative for every boot after. Deliberate: the substrate is allowed to
#   alter its own membership. But nothing ever brought a repo-side inventory
#   change to an existing container, so two substrates could not converge on a
#   shared fleet definition even when both were pulling the same commit.
#
# The inventory is therefore converged CONDITIONALLY. A sidecar records the
# content this updater last wrote; if the live file still matches it, no one has
# customised it and git wins. If it differs, the substrate (or an operator)
# changed it deliberately and we leave it alone and SAY SO — silently
# overwriting a fleet's self-chosen membership would be the worse failure, and
# an unexplained revert is exactly the kind of thing nobody traces back.
#
# apply-inventory is unconditional: it is code, not state.
converge_fleet_defs() {
  _cf_super="$1"
  # Committed content only (stage_committed_glue): _cf_src is a staged git tree.
  stage_committed_glue "$_cf_super" || return 0
  _cf_src="$PULLSYNC_GLUE_STAGE/scripts/substrate"
  [ -d "$_cf_src" ] || return 0

  # Bootstrap-tier scripts entrypoint.sh runs BEFORE systemd. All of them are
  # image copies, so a repo-side fix reached nothing until now.
  #
  # gen-env and secrets.env.sh matter as much as apply-inventory: between them
  # they decide whether the container can boot at all and what identity it boots
  # with. A truncating write in secrets.env.sh destroyed FED_SUBSTRATE_ID, so
  # every restart minted a NEW federation identity and orphaned the substrate's
  # hub records — fixed in the repo, and the fix reached no container, so the
  # identity kept churning across cycles (spoke-6e240fe0 -> 1e18b09e -> cfda39e7
  # in three restarts, observed 2026-08-08).
  # Destinations differ: apply-inventory and gen-env are installed as executables
  # in /usr/local/bin (entrypoint invokes them by name); secrets.env.sh is SOURCED
  # from /usr/local/share/substrate. Converging it to the wrong path would leave
  # the real one stale while the log claimed success.
  # render-unit and vessel-ctl are the same gap class as the three below and were
  # still stuck at image-build time. Together they decide what a dynamic vessel's
  # unit SAYS and whether its dependencies get installed, so a repair to either —
  # a missing After= ordering, an install step that silently resolved nothing —
  # sat in git reaching no running container, and the next install reproduced the
  # defect it was supposed to fix. Converging them is what makes such a repair
  # take effect on the next `vessel-ctl install`, which is the only moment either
  # script runs.
  # gen-env's own dependencies, installed even where the image never had them (the
  # "do not invent it" rule below is for scripts an image may deliberately lack):
  # the gen-env converged below refuses to boot without its secret renderer, so a
  # converged gen-env without them would brick the next container start.
  for _cf_pair in \
    "render-secret-scope.sh:$BIN_DIR/render-secret-scope:0755" \
    "secret-mask-probe.sh:$BIN_DIR/secret-mask-probe:0755" \
    "secrets-manifest.json:$SHARE_DIR/secrets-manifest.json:0644"; do
    IFS=: read -r _cf_from _cf_to _cf_mode <<< "$_cf_pair"
    [ -f "$_cf_src/$_cf_from" ] || continue
    cmp -s "$_cf_src/$_cf_from" "$_cf_to" 2>/dev/null && continue
    install -m "$_cf_mode" "$_cf_src/$_cf_from" "$_cf_to.new" 2>/dev/null \
      && mv -f "$_cf_to.new" "$_cf_to" 2>/dev/null \
      && log "fleet: converged $(basename "$_cf_to") (gen-env dependency; read at the next boot and by unit convergence)"
  done
  for _cf_pair in \
    "apply-inventory.sh:$BIN_DIR/apply-inventory" \
    "gen-env.sh:$BIN_DIR/gen-env" \
    "render-unit.sh:$BIN_DIR/render-unit" \
    "vessel-ctl.sh:$BIN_DIR/vessel-ctl" \
    "substrate-key.sh:$BIN_DIR/substrate-key" \
    "seed-identity.ts:/vessels/seed-identity.ts" \
    "setup-git-push.sh:$BIN_DIR/setup-git-push" \
    "secrets.env.sh:$SHARE_DIR/secrets.env.sh"; do
    _cf_from="${_cf_pair%%:*}"
    _cf_to="${_cf_pair#*:}"
    [ -f "$_cf_src/$_cf_from" ] || continue
    [ -e "$_cf_to" ] || continue   # not installed on this image; do not invent it
    cmp -s "$_cf_src/$_cf_from" "$_cf_to" 2>/dev/null && continue
    # SAY WHEN IT ACTUALLY TAKES EFFECT, and that differs per script.
    #
    # This message read "takes effect at next container start — this runs
    # pre-systemd" for every entry, which is true only of the boot-time ones.
    # vessel-ctl is re-executed from disk on every `docker exec`, so a converged
    # copy governs the very next invocation with no restart — measured: a
    # container ran a vessel-ctl lacking a documented flag for about an hour,
    # pull-sync converged it, and the new behaviour appeared on the next exec.
    # The wrong message told a maintainer their tool could not have changed under
    # them, which is exactly what it had done.
    case "$(basename "$_cf_to")" in
      vessel-ctl|gen-env|render-unit|substrate-key)
        _cf_when="takes effect on the NEXT INVOCATION — this is re-executed from disk each time" ;;
      apply-inventory)
        _cf_when="takes effect at next container start, or immediately via 'vessel-ctl apply'" ;;
      seed-identity.ts|setup-git-push)
        _cf_when="takes effect the next time its unit (identity-seeder / git-push-setup) runs" ;;
      *)
        _cf_when="takes effect at next container start — this runs pre-systemd" ;;
    esac
    install -m 0755 "$_cf_src/$_cf_from" "$_cf_to.new" 2>/dev/null \
      && mv -f "$_cf_to.new" "$_cf_to" 2>/dev/null \
      && log "fleet: converged $(basename "$_cf_to") ($_cf_when)"
  done

  # THE CONVERGER MUST CONVERGE ITSELF. Every glue script above self-updates from git;
  # substrate-pull-sync — the thing that performs all of it — did not appear in any
  # list, so a repair to the deploy path could never deploy itself. Found the hard way:
  # a fix for a starvation bug that was preventing four pushed commits from going live
  # was itself unable to go live by the mechanism it repaired. That is a bootstrap
  # deadlock, and the only two exits are an operator's hands or this block.
  #
  # Separate from the loop above only because that loop's message is accurate for
  # pre-systemd scripts and wrong for this one: apply-inventory and gen-env are read by
  # entrypoint at container start, while this file is exec'd fresh by systemd on every
  # tick, so a converged copy is live on the NEXT TICK with no restart.
  #
  # Safe to replace while running: install-to-.new + atomic mv, so the executing
  # process keeps its original inode and finishes on the code it started with. Never
  # edited in place, which WOULD corrupt the running interpreter mid-read.
  #
  # BACKSTOP ONLY. SELF-CONVERGE FIRST (top of the tick) normally installs and execs the
  # committed copy before anything converges, so this cmp finds nothing to do. It still
  # acts when that block could not (the running file unreadable, a refused exec), and it
  # keeps this function self-sufficient for callers that run it alone.
  _ps_src="$_cf_src/substrate-pull-sync.sh"
  _ps_dst="$BIN_DIR/substrate-pull-sync"
  if [ -f "$_ps_src" ] && [ -e "$_ps_dst" ] && ! cmp -s "$_ps_src" "$_ps_dst" 2>/dev/null; then
    install -m 0755 "$_ps_src" "$_ps_dst.new" 2>/dev/null \
      && mv -f "$_ps_dst.new" "$_ps_dst" 2>/dev/null \
      && log "fleet: converged substrate-pull-sync itself (takes effect on the NEXT tick — this run finishes on the old code)"
  fi

  # secrets.env.sh — sourced by vessel-ctl on every manifest-vessel install, so
  # it runs at BOOT and it WRITES /workspace/.substrate-private/substrate-secrets. The image copy
  # truncated that file to the six keys it owns, deleting API_KEY_SECRET, which
  # gen-env had persisted. A container in that state runs indefinitely and then
  # refuses to boot when restarted. The repaired merge-version has to reach a
  # running container or the container repairs itself back into the bug on the
  # next boot — which is exactly what was observed: the file was restored by
  # hand, and the old script deleted the key again at the next install.
  # BOTH copies. vessel-ctl sources /usr/local/share/substrate/secrets.env.sh —
  # NOT the super-repo path under it, which is a different file that happens to
  # share a name. Converging only the super-repo copy looks correct, greps
  # correct, and changes nothing: the writer that truncates the file is the
  # other one. (Found by probing: a marker key survived sourcing the converged
  # copy, and vanished at the next boot anyway.)
  for _cf_img in \
    "$SHARE_DIR/secrets.env.sh" \
    "$SHARE_DIR/super-repo/scripts/substrate/secrets.env.sh"
  do
    [ -f "$_cf_src/secrets.env.sh" ] && [ -f "$_cf_img" ] || continue
    cmp -s "$_cf_src/secrets.env.sh" "$_cf_img" 2>/dev/null && continue
    install -m 0755 "$_cf_src/secrets.env.sh" "$_cf_img.new" 2>/dev/null \
      && mv -f "$_cf_img.new" "$_cf_img" 2>/dev/null \
      && log "fleet: converged $_cf_img (persisted-secret writer)"
  done

  _cf_dir="${FLEET_DIR:-/workspace/substrate/fleet}"
  [ -d "$_cf_dir" ] || return 0
  for f in vessels.inventory.json vessels.manifest.json; do
    _cf_git="$_cf_src/$f"
    _cf_live="$_cf_dir/$f"
    _cf_mark="$_cf_dir/.$f.converged"
    [ -f "$_cf_git" ] || continue
    if [ ! -f "$_cf_live" ]; then
      install -m 0644 "$_cf_git" "$_cf_live" 2>/dev/null && cp -f "$_cf_git" "$_cf_mark" 2>/dev/null \
        && log "fleet: installed $f from git (was absent)"
      continue
    fi
    cmp -s "$_cf_git" "$_cf_live" 2>/dev/null && { cp -f "$_cf_git" "$_cf_mark" 2>/dev/null; continue; }
    if [ -f "$_cf_mark" ] && cmp -s "$_cf_mark" "$_cf_live" 2>/dev/null; then
      install -m 0644 "$_cf_git" "$_cf_live" 2>/dev/null && cp -f "$_cf_git" "$_cf_mark" 2>/dev/null \
        && log "fleet: converged $f from git (local copy was unmodified)"
    elif [ ! -f "$_cf_mark" ]; then
      # First run after this feature shipped: no sidecar exists, so we cannot
      # tell a customised file from an image-seeded one. Adopt the live copy as
      # the baseline and converge from the NEXT tick onward. Never guess on the
      # first observation.
      cp -f "$_cf_live" "$_cf_mark" 2>/dev/null \
        && log "fleet: $f differs from git; adopting the live copy as baseline (no sidecar yet) — will converge once it is unmodified"
    else
      log "fleet: $f was modified locally — leaving it alone (git version NOT applied; deleting $_cf_mark makes the next tick re-adopt the live copy and the tick after that replace it with git)"
    fi
  done
}

# TRACKED BUILD OUTPUT (e.g. human-surface-vessel's ui/dist, committed on purpose
# because nothing rebuilds on pull). Read from git, never listed. MUST EQUAL
# mirror-to-live.sh's tracked_output_dirs — that is the copy side of this hash.
tracked_output_dirs() { # clone-root -> one dir per line (e.g. ui/dist), sorted, may be empty
  git -C "$1" ls-files 2>/dev/null \
    | awk '/^(src|sql|scripts|dist)\// || /(^|\/)node_modules\// {next}
           { n = index($0, "/dist/"); if (n > 0) print substr($0, 1, n + 4) }' \
    | LC_ALL=C sort -u
}

content_hash() { # vessel-root [clone-root] -> md5 over sorted src/ + sql/ + scripts/ (.ts/.json/.surql/.sh) + tracked build output; "none" if missing
  [ -d "$1" ] || { echo none; return; }
  # .json included so pure-template/config edits (e.g. lifecycle *.json activity
  # templates like ribosome-extract) are detected — a .ts-only hash left a
  # .json-only change invisible to convergence, so it never mirrored/deployed.
  # .surql (and the sql/ tree) included so a migration-only change (e.g. a new
  # DEFINE FIELD on a SCHEMAFULL table) is detected — migrations live in sql/,
  # outside src/, so a src-only hash left a migration-only commit invisible: it
  # never mirrored and the unit never restarted to apply it. Scan src + sql.
  # scripts/ included for the same reason, a third time: mirror-to-live copies
  # scripts/ (activity-api's ExecStartPre runs scripts/init-database.ts from it),
  # but a scripts-only commit hashed identically, so it was pulled into the clone
  # and never mirrored or run on any fleet but the one that landed it.
  # THE DIRECTORY LIST HERE MUST EQUAL THE ONE mirror-to-live.sh COPIES; a
  # directory it copies but this hash omits can never converge.
  # And a fourth time: a tracked ui/dist was neither copied nor hashed, so a
  # UI-only commit hashed identically and the runtime served the previous
  # bundle indefinitely. The dir list comes from the CLONE ($2, default $1) —
  # the runtime has no .git — and every file under it counts, any extension,
  # on BOTH sides: an asset left in the runtime that git no longer tracks is
  # drift too. Appended only when the repo tracks such a dir, so every other
  # vessel's hash (and its marker) is unchanged by this.
  _ch_base="$(cd "$1" && find src sql scripts -type f \( -name '*.ts' -o -name '*.json' -o -name '*.surql' -o -name '*.sh' \) -not -path '*/node_modules/*' 2>/dev/null | sort | xargs -r md5sum | md5sum | cut -d' ' -f1)"
  _ch_out="$(tracked_output_dirs "${2:-$1}")"
  [ -n "$_ch_out" ] || { echo "$_ch_base"; return; }
  # Clone side: the TRACKED files only — the set mirror-to-live ships — so a
  # stray untracked file in the clone's dist cannot read as permanent drift
  # (a mirror/restart loop). Runtime side: everything on disk, so an asset git
  # no longer tracks still counts as drift there.
  if [ -e "$1/.git" ]; then   # -e: a git worktree's .git is a FILE (revert_target_hashes)
    _ch_outsum="$(cd "$1" && for _ch_d in $_ch_out; do git ls-files -- "$_ch_d"; done | LC_ALL=C sort | xargs -r md5sum | md5sum | cut -d' ' -f1)"
  else
    _ch_outsum="$(cd "$1" && for _ch_d in $_ch_out; do [ -d "$_ch_d" ] && find "$_ch_d" -type f; done | LC_ALL=C sort | xargs -r md5sum | md5sum | cut -d' ' -f1)"
  fi
  echo "$_ch_base-$_ch_outsum"
}

# A TEST-ONLY RANGE OWES NO RESTART. clone-dir from-sha to-sha -> 0 iff the diff
# from..to is computable, non-empty, and every changed path is a test file
# (*.test.ts, *.spec.ts, or under a test/ or tests/ directory) or tracked build
# output under a nested <dir>/dist/ (see tracked_output_dirs). Anything else —
# empty range, unknown sha, a single non-test path — returns 1, i.e. restart as
# before. The range is the last-good pin (the sha the running unit was last
# converged to) .. HEAD, so a deferred or reverted non-test commit stays inside
# it. --no-renames so src/x.ts -> test/x.ts shows its departed source path.
# Why: the check-first repair pattern lands every fix as two commits (test, then
# fix); each restarted the vessel, and a hub restart is minutes of outage for a
# commit whose runtime code is byte-identical.
# Tracked build output is in the same class: mirror-to-live swaps it on disk and
# a vessel serves it per request (human-surface-vessel: Bun.file under a path
# fixed at load, src/index.ts serveUiFile), so a UI-only commit is live the
# moment the swap lands and a restart buys only an outage. Root dist/ and
# anything under src/ sql/ scripts/ are code the unit loads — never skipped.
# ASSUMPTION: every vessel that tracks a nested dist/ SERVES it from disk per
# request. A vessel that IMPORTS a tracked nested dist at load would need a
# restart this rule skips; today only human-surface-vessel tracks one.
test_only_range() {
  [ -n "${2:-}" ] && [ -n "${3:-}" ] || return 1
  _tor_paths="$(git -C "$1" diff --no-renames --name-only "$2" "$3" 2>/dev/null)" || return 1
  [ -n "$_tor_paths" ] || return 1
  while IFS= read -r _tor_p; do
    case "$_tor_p" in
      *.test.ts|*.spec.ts|test/*|tests/*|*/test/*|*/tests/*) ;;
      src/*|sql/*|scripts/*|dist/*|*/node_modules/*) return 1 ;;
      */dist/*) ;;
      *) return 1 ;;
    esac
  done <<EOF
$_tor_paths
EOF
  return 0
}
# What a revert to <sha> SHOULD leave live, measured the way convergence measures it.
# revert_target_hashes <clone> <sha> <runtime-root> -> 0 with RT_WANT=content_hash of
# <sha>'s tree and RT_LIVE=content_hash of the runtime (tracked dirs read from <sha>, not
# HEAD, so a bundle HEAD added or dropped is judged by the tree being restored); 1 and
# RT_WHY when <sha> cannot be checked out. Throwaway detached worktree, always removed.
revert_target_hashes() {
  RT_WANT=""; RT_LIVE=""; RT_WHY=""
  local wt
  wt="$(mktemp -d "${TMPDIR:-/tmp}/pull-sync-revert.XXXXXX")" || { RT_WHY="cannot create a temp dir"; return 1; }
  git -C "$1" worktree prune >/dev/null 2>&1 || true
  if ! git -C "$1" worktree add -q --detach "$wt" "$2" >/dev/null 2>&1; then
    rm -rf "$wt"; RT_WHY="cannot check out ${2:0:10} to hash its tree"; return 1
  fi
  RT_WANT="$(content_hash "$wt")"; RT_LIVE="$(content_hash "$3" "$wt")"
  git -C "$1" worktree remove --force "$wt" >/dev/null 2>&1 || true
  rm -rf "$wt"; git -C "$1" worktree prune >/dev/null 2>&1 || true
  return 0
}
# content_hash with test files excluded (same patterns as test_only_range).
# The last-good pin lives on the volume while /vessels can come from a rebuilt
# image, so the pin alone cannot say what the unit runs: a test-only range after
# a rebuild would skip the restart onto older baked code. Equal non-test hashes
# of the PRE-mirror runtime and the clone are the evidence that it doesn't.
content_hash_nontest() { # vessel-root -> md5 over src/ sql/ scripts/ minus tests; "none" if missing
  [ -d "$1" ] || { echo none; return; }
  (cd "$1" && find src sql scripts -type f \( -name '*.ts' -o -name '*.json' -o -name '*.surql' -o -name '*.sh' \) \
     -not -path '*/node_modules/*' -not -name '*.test.ts' -not -name '*.spec.ts' -not -path '*/test/*' -not -path '*/tests/*' \
     2>/dev/null | sort | xargs -r md5sum | md5sum | cut -d' ' -f1)
}

# THE TEST GATE RUNS THE CLONE'S SUITE AGAINST THE CLONE'S node_modules, AND NOTHING
# EVER INSTALLED THEM. mirror-to-live reinstalls the RUNTIME (/vessels/<v>) when its
# package.json changes; the clone (/workspace/git/vessels/<v>) — whose node_modules
# run_suite uses directly and run_suite_at symlinks into its worktree — kept whatever
# the image or an operator left there. Measured on the hub: goal-host-vessel's clone
# node_modules dated from 2026-08-10 and lacked @avigopal/ias-executor-ts, so every
# test importing src/index.ts failed to LOAD (10 unnamed failures carried in the
# baseline); one more such test made it 11 and the gate refused a correct commit 3x,
# quiescing goal-host each time, before the starvation break blinded it.
#
# So before the gate, the clone's node_modules must satisfy its manifest. Install when
#   - node_modules is missing, or
#   - a declared dependency (dependencies + devDependencies) is absent from it, or
#   - package.json / bun.lock changed since the last install recorded here, or
#   - a file: dependency's TARGET moved: its git HEAD or its built output (the tree
#     holding its package.json "main", default dist/) differs from the install recorded.
# A file: dependency is a DIRECTORY COPY of another clone, and nothing in the
# dependant's own manifest changes when that clone moves on or is rebuilt. Measured
# 2026-10-03 on both nodes: goal-host-vessel's clone held an ias-executor-ts copy from
# August/September (0.1.1) while the sibling clone was at a 10-02 HEAD, because the
# marker hashed only package.json/bun.lock. goal-host's typecheck in the compose clone
# was red at baseline, so every lane draft on goal-host failed before its own check ran.
# So the marker folds in each file: target's identity, and a reinstall first removes the
# dependant's copy of every file: dependency (bun keeps an existing copy in place).
# For a manifest with NO file: dependency the marker is the manifest hash, byte for byte
# as before, so this keying reinstalls nothing else.
# A missing marker with every dependency present is ADOPTED, not reinstalled: the
# first tick after this lands must not reinstall the whole fleet. EXCEPT with a file:
# dependency: a directory copy cannot be dated, so without a marker it is reinstalled.
#
# THE MANIFEST IS THE CANDIDATE'S, AND NOTHING HAS JUDGED IT YET. This runs before any
# gate, as root, in a unit that loads the substrate's secrets, so a commit's lifecycle
# script would execute with all of that. The install therefore runs under scrubbed_env
# (the suite's own environment) with --ignore-scripts. A package that needs a native
# postinstall is then unbuilt pre-gate; its tests fail to load and the unresolvable-
# module rule in the gate handles them. The post-gate runtime install (mirror-to-live)
# is unchanged.
#
# Otherwise the same install as mirror-to-live (`bun install --silent`), with clone-side
# differences: bun.lock is TRACKED in every clone, so --no-save and any tracked manifest
# the install dirties is restored (a dirty tree breaks the ff-only pull); file: paths
# stay RELATIVE — in the clone file:../<dep> correctly names the sibling clone, which is
# the rewrite mirror-to-live has to undo for /vessels. A working node_modules is never
# deleted: it is moved aside (outside the clone, so bun test never scans it) only when
# an in-place install left a dependency missing, and restored if the clean retry fails.
#
# FAIL CLOSED. A missing file: target (never fabricated) or a failed install files a
# gap and the caller does NOT converge v this tick: a gate over test files that cannot
# load measures nothing, and converging ungated is how a commit escapes it. A failed
# manifest is not retried every tick (each try costs up to 2 x the install timeout,
# sequentially, inside a 900 s unit): the failing hash and time are recorded and the
# same manifest is suppressed for CLONE_DEPS_RETRY_BACKOFF_SECONDS or until it changes.
#
# -> sets CD_STATE (ok|adopted|installed|failed|suppressed) and CD_WHY; returns 0 for
# ok/adopted/installed and 1 otherwise (the caller must NOT converge v this tick).
# Test: validation/scripts/pull-sync-clone-deps.test.sh.
clone_dep_missing() { # clone-dir -> missing declared dependency names, one per line
  local _cdm_d="$1" _cdm_n
  command -v jq >/dev/null 2>&1 || return 0
  jq -r '[(.dependencies // {}), (.devDependencies // {})] | add // {} | keys[]' "$_cdm_d/package.json" 2>/dev/null \
    | while IFS= read -r _cdm_n; do
        [ -n "$_cdm_n" ] || continue
        [ -e "$_cdm_d/node_modules/$_cdm_n" ] || [ -L "$_cdm_d/node_modules/$_cdm_n" ] || printf '%s\n' "$_cdm_n"
      done
}
clone_deps_install() { # clone-dir log-file -> bun's exit status; candidate code never runs, secrets never visible
  local _cdi_root _cdi_rc
  _cdi_root="$(mktemp -d "${TMPDIR:-/tmp}/pullsync-root-XXXXXX")" || return 1
  (cd "$1" && scrubbed_env "$_cdi_root" timeout --kill-after=15 "${CLONE_DEPS_INSTALL_TIMEOUT_SECONDS:-180}" \
     "$BUN_BIN" install --silent --no-save --ignore-scripts) >> "$2" 2>&1; _cdi_rc=$?
  rm -rf "$_cdi_root" 2>/dev/null || true
  return "$_cdi_rc"
}
clone_deps_gap() { # id-prefix vessel why summary-lead
  local _cg_json
  _cg_json="$(jq -n -c --arg id "$1$2" --arg why "$3" --arg lead "$4" \
    '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:"systematic_failure",source:"substrate_detected",status:"open",summary:($lead + " " + $why)}}}}' 2>/dev/null)" \
    || _cg_json="{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"$1$2\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"status\":\"open\",\"summary\":\"$4\"}}}}"
  emit_gap "$_cg_json"
}
# COST: tree_digest runs EVERY TICK for every clone with a file: dependency (its marker
# hash) and twice per shared package (runtime vs clone dist). Acceptable at today's dist
# sizes (ias-executor-ts: ~160 files, six dependants -> well under a second per tick);
# revisit if a shared dist grows by orders of magnitude.
tree_digest() { # dir -> md5 over its sorted relative paths and contents; "none" if absent
  [ -d "$1" ] || { echo none; return; }
  (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r md5sum) | md5sum | cut -d' ' -f1
}
clone_file_deps() { # clone-dir -> "name<TAB>absolute-target" per file: dependency (needs jq; empty without)
  local _cf_d="${1%/}" _cf_n _cf_s
  command -v jq >/dev/null 2>&1 || return 0
  jq -r '[(.dependencies // {}), (.devDependencies // {})] | add // {} | to_entries[] | "\(.key)\t\(.value)"' "$_cf_d/package.json" 2>/dev/null \
    | while IFS=$'\t' read -r _cf_n _cf_s; do
        [ -n "$_cf_n" ] || continue
        case "$_cf_s" in file:*) ;; *) continue ;; esac
        printf '%s\t%s\n' "$_cf_n" "$(realpath -m "$_cf_d/${_cf_s#file:}" 2>/dev/null || echo "$_cf_d/${_cf_s#file:}")"
      done
}
file_dep_identity() { # target-dir -> "<git HEAD> <digest of the built output dir>"
  local _fi_main _fi_dir
  _fi_main="$(jq -r '.main // "dist/index.js"' "$1/package.json" 2>/dev/null)"; _fi_main="${_fi_main#./}"
  _fi_dir="$(dirname "${_fi_main:-dist/index.js}")"
  case "$_fi_dir" in .|''|/*|*..*) _fi_dir=dist ;; esac
  printf '%s %s\n' "$(git -C "$1" rev-parse HEAD 2>/dev/null || echo no-git)" "$(tree_digest "$1/$_fi_dir")"
}
ensure_clone_deps() { # vessel clone-dir
  local _cd_v="$1" _cd_d="${2%/}" _cd_mark _cd_fail _cd_hash _cd_why="" _cd_missing _cd_log _cd_rc _cd_dirty_before _cd_dirty_after
  local _cd_name _cd_target _cd_unres="" _cd_aside _cd_fhash="" _cd_ftime="" _cd_now _cd_fdeps
  CD_STATE=ok; CD_WHY=""
  [ -f "$_cd_d/package.json" ] || return 0
  _cd_mark="$MARKER_DIR/$_cd_v.clone-deps"; _cd_fail="$MARKER_DIR/$_cd_v.clone-deps-failed"
  _cd_aside="$MARKER_DIR/$_cd_v.node_modules-prev"
  rm -rf "$_cd_d/node_modules.pullsync-prev" 2>/dev/null || true
  _cd_hash="$(cat "$_cd_d/package.json" "$_cd_d/bun.lock" "$_cd_d/bun.lockb" 2>/dev/null | md5sum | cut -d' ' -f1)"
  _cd_fdeps="$(clone_file_deps "$_cd_d")"
  if [ -n "$_cd_fdeps" ]; then
    _cd_hash="$( { echo "$_cd_hash"; while IFS=$'\t' read -r _cd_name _cd_target; do
        printf '%s %s %s\n' "$_cd_name" "$_cd_target" "$( [ -d "$_cd_target" ] && file_dep_identity "$_cd_target" || echo missing)"
      done <<< "$_cd_fdeps"; } | md5sum | cut -d' ' -f1)"
  fi
  command -v jq >/dev/null 2>&1 || log "$_cd_v: jq missing — clone dependency presence unchecked; installing only on a missing node_modules or a manifest change"
  _cd_missing="$(clone_dep_missing "$_cd_d")"
  if [ ! -d "$_cd_d/node_modules" ]; then
    _cd_why="node_modules missing"
  elif [ -n "$_cd_missing" ]; then
    _cd_why="declared dependencies absent from node_modules: $(printf '%s' "$_cd_missing" | tr '\n' ' ' | sed 's/ $//')"
  elif [ -f "$_cd_mark" ] && [ "$(cat "$_cd_mark" 2>/dev/null)" != "$_cd_hash" ]; then
    _cd_why="package.json/bun.lock${_cd_fdeps:+ or the HEAD/built output of a file: dependency} changed since the last clone install"
  elif [ ! -f "$_cd_mark" ] && [ -n "$_cd_fdeps" ]; then
    _cd_why="no install recorded and file: dependencies present (a directory copy cannot be dated)"
  fi
  if [ -z "$_cd_why" ]; then
    if [ ! -f "$_cd_mark" ]; then echo "$_cd_hash" > "$_cd_mark" 2>/dev/null || true; CD_STATE=adopted; fi
    rm -f "$_cd_fail" 2>/dev/null || true
    return 0
  fi
  # file: dependencies must name something that exists BEFORE bun is asked to link it.
  while IFS=$'\t' read -r _cd_name _cd_target; do
    [ -n "$_cd_name" ] || continue
    [ -d "$_cd_target" ] || _cd_unres="${_cd_unres}${_cd_unres:+, }$_cd_name -> $_cd_target"
  done <<< "$_cd_fdeps"
  if [ -n "$_cd_unres" ]; then
    CD_STATE=failed; CD_WHY="install needed ($_cd_why) but file: dependency target(s) do not exist: $_cd_unres"
    log "$_cd_v: !!! CLONE DEPENDENCIES UNSATISFIABLE — $CD_WHY; not fabricating them, NOT converging $_cd_v this tick"
    clone_deps_gap pull-sync-clone-dep-target-missing- "$_cd_v" "$CD_WHY." \
      "Repair needed: pull-sync cannot satisfy $_cd_v's clone node_modules, so its test gate cannot measure the candidate and $_cd_v is not converged until it can. The clone layout must provide every file: dependency the manifest names (a sibling clone, or the shared packages directory at that relative path)."
    return 1
  fi
  # BACKOFF: the same manifest that failed recently is not retried.
  [ -f "$_cd_fail" ] && { read -r _cd_fhash _cd_ftime < "$_cd_fail"; } 2>/dev/null || true
  _cd_now="$(date +%s)"
  case "$_cd_ftime" in ''|*[!0-9]*) _cd_ftime="" ;; esac
  if [ -n "$_cd_ftime" ] && [ "$_cd_fhash" = "$_cd_hash" ] && [ $((_cd_now - _cd_ftime)) -lt "${CLONE_DEPS_RETRY_BACKOFF_SECONDS:-3600}" ]; then
    CD_STATE=suppressed; CD_WHY="install suppressed (same manifest failed at $(date -u -d "@$_cd_ftime" -Iseconds 2>/dev/null || echo "$_cd_ftime"); retry after ${CLONE_DEPS_RETRY_BACKOFF_SECONDS:-3600}s or a package.json/bun.lock change)"
    log "$_cd_v: $CD_WHY — still NOT converging $_cd_v this tick ($_cd_why)"
    return 1
  fi
  _cd_log="$(mktemp "${TMPDIR:-/tmp}/pullsync-clonedeps-XXXXXX")"
  _cd_dirty_before="$(git -C "$_cd_d" status --porcelain -- package.json bun.lock bun.lockb 2>/dev/null || true)"
  log "$_cd_v: clone node_modules does not satisfy its manifest ($_cd_why) — bun install in the clone before the test gate (scrubbed env, --ignore-scripts)"
  # bun leaves an existing file: copy in place, so the stale copy goes first; a target
  # that exists was checked above, and a failed install leaves it missing -> fail closed.
  while IFS=$'\t' read -r _cd_name _cd_target; do
    case "$_cd_name" in ''|*..*|/*) continue ;; esac
    rm -rf "$_cd_d/node_modules/$_cd_name" 2>/dev/null || true
  done <<< "$_cd_fdeps"
  clone_deps_install "$_cd_d" "$_cd_log"; _cd_rc=$?
  _cd_missing="$(clone_dep_missing "$_cd_d")"
  if { [ "$_cd_rc" -ne 0 ] || [ -n "$_cd_missing" ]; } && [ -d "$_cd_d/node_modules" ]; then
    # The in-place install did not produce a satisfying tree; only now is a clean one needed.
    rm -rf "$_cd_aside" 2>/dev/null || true
    if mv "$_cd_d/node_modules" "$_cd_aside" 2>/dev/null; then
      log "$_cd_v: in-place clone install left it unsatisfied (rc=$_cd_rc) — retrying clean with the old node_modules moved aside to $_cd_aside"
      clone_deps_install "$_cd_d" "$_cd_log"; _cd_rc=$?
      _cd_missing="$(clone_dep_missing "$_cd_d")"
      if [ "$_cd_rc" -eq 0 ] && [ -z "$_cd_missing" ] && [ -d "$_cd_d/node_modules" ]; then
        rm -rf "$_cd_aside" 2>/dev/null || true
      else
        rm -rf "$_cd_d/node_modules" 2>/dev/null || true
        mv "$_cd_aside" "$_cd_d/node_modules" 2>/dev/null || true
      fi
    fi
  fi
  _cd_dirty_after="$(git -C "$_cd_d" status --porcelain -- package.json bun.lock bun.lockb 2>/dev/null || true)"
  if [ -z "$_cd_dirty_before" ] && [ -n "$_cd_dirty_after" ]; then
    git -C "$_cd_d" checkout -- package.json bun.lock bun.lockb >/dev/null 2>&1 \
      || git -C "$_cd_d" checkout -- package.json bun.lock >/dev/null 2>&1 || true
    log "$_cd_v: clone install modified tracked manifests ($(printf '%s' "$_cd_dirty_after" | tr '\n' ' ')) — restored so the ff-only pull stays clean"
  fi
  if [ "$_cd_rc" -eq 0 ] && [ -z "$_cd_missing" ] && [ -d "$_cd_d/node_modules" ]; then
    echo "$_cd_hash" > "$_cd_mark" 2>/dev/null || true
    rm -f "$_cd_fail" 2>/dev/null || true
    CD_STATE=installed; CD_WHY="$_cd_why"
    log "$_cd_v: clone dependencies installed ($_cd_why)"
    rm -f "$_cd_log" 2>/dev/null || true
    return 0
  fi
  echo "$_cd_hash $_cd_now" > "$_cd_fail" 2>/dev/null || true
  CD_STATE=failed
  CD_WHY="clone bun install rc=$_cd_rc ($_cd_why)${_cd_missing:+; still missing: $(printf '%s' "$_cd_missing" | tr '\n' ' ' | sed 's/ $//')}; output tail: $(grep -v '^[[:space:]]*$' "$_cd_log" 2>/dev/null | tail -5 | tr '\n' '|' | cut -c1-400)"
  rm -f "$_cd_log" 2>/dev/null || true
  log "$_cd_v: !!! CLONE DEPENDENCY INSTALL FAILED — $CD_WHY; NOT converging $_cd_v this tick (its test gate cannot measure the candidate); this manifest is not retried for ${CLONE_DEPS_RETRY_BACKOFF_SECONDS:-3600}s unless it changes"
  clone_deps_gap pull-sync-clone-deps-install-failed- "$_cd_v" "$CD_WHY" \
    "Repair needed: pull-sync could not install $_cd_v's clone node_modules before its test gate, so it refused to converge $_cd_v (a gate over unloadable test files measures nothing)."
  return 1
}

# A SHARED PACKAGE'S CLONE DIST FOLLOWS ITS CREDITED RUNTIME BUILD.
#
# The fan-out (2c) builds a shared package into $RUNTIME_DIR/<pkg>/dist, and the runtime
# consumers resolve that. The compose clones do not: a dependant clone's file:../<pkg>
# names the package's GIT CLONE, whose dist is untracked and was built by nobody after
# the clone was first made. Measured 2026-10-03 on both nodes: ias-executor-ts's clone
# dist dated 09-30 while its HEAD (and the runtime build, LAST_GOOD == HEAD) was 10-02,
# so it lacked newer exports, and every goal-host draft typechecked against it red.
#
# So once the fan-out is credited (LAST_GOOD == the clone HEAD — the runtime dist IS this
# HEAD's build), copy that build into the clone's dist when it differs, then satisfy each
# clone that file:-depends on the package (ensure_clone_deps sees the moved dist in its
# marker and replaces the dependant's copy). Reuses the fan-out's build instead of a
# second tsc run. Called from the fan-out's credit line and from the already-converged
# branch, so an existing stale copy heals on the next tick with no hands.
# Not copied: a dist the clone TRACKS (git owns it), or a runtime dist from another HEAD
# (a rolled-back or not-yet-credited fan-out). A dependant with a young authoring marker
# is skipped this tick — swapping node_modules under its typecheck is the failure this
# exists to prevent. Test: validation/scripts/pull-sync-clone-deps.test.sh (k).
young_authoring_marker() { # vessel -> path of a young (< TTL) authoring marker naming it, or nothing; never reaps
  local _ya_mk
  for _ya_mk in "${AUTHORING_MARKER_DIR:-/workspace/authoring-inflight}"/*-"$1".json; do
    [ -f "$_ya_mk" ] && [ -n "$(find "$_ya_mk" -mmin "-${AUTHORING_MARKER_TTL_MIN:-40}" 2>/dev/null)" ] && { printf '%s\n' "$_ya_mk"; return 0; }
  done
  return 0
}
sync_clone_dist() { # pkg-vessel clone-dir -> 0 when the clone dist is current (SCD_STATE current|copied)
  local _sc_v="$1" _sc_d="${2%/}" _sc_rt="$RUNTIME_DIR/$1" _sc_stage _sc_busy
  SCD_STATE=skipped
  [ -d "$_sc_rt/dist" ] && [ -f "$_sc_d/package.json" ] || return 1
  [ "$(cat "$LAST_GOOD_DIR/$_sc_v" 2>/dev/null)" = "$(git -C "$_sc_d" rev-parse HEAD 2>/dev/null)" ] || return 1
  [ -z "$(git -C "$_sc_d" ls-files -- dist 2>/dev/null | head -1)" ] || return 1
  if [ "$(tree_digest "$_sc_rt/dist")" = "$(tree_digest "$_sc_d/dist")" ]; then SCD_STATE=current; return 0; fi
  _sc_busy="$(young_authoring_marker "$_sc_v")"
  if [ -n "$_sc_busy" ]; then   # a draft on the package itself reads this dist: no rm/mv under it
    SCD_STATE=busy; log "$_sc_v: authoring run in flight ($(basename "$_sc_busy")) — not swapping its clone dist this tick"
    return 1
  fi
  _sc_stage="$MARKER_DIR/$_sc_v.clone-dist-stage"; rm -rf "$_sc_stage" 2>/dev/null || true
  if cp -a "$_sc_rt/dist" "$_sc_stage" 2>/dev/null && rm -rf "$_sc_d/dist" && mv "$_sc_stage" "$_sc_d/dist"; then
    SCD_STATE=copied
    log "$_sc_v: clone dist was not the credited build of ${_sc_rt##*/} at $(git -C "$_sc_d" rev-parse --short HEAD 2>/dev/null) — copied the runtime build in, so file: dependants in $CLONE_DIR resolve current code"
    return 0
  fi
  rm -rf "$_sc_stage" 2>/dev/null || true
  SCD_STATE=failed; log "$_sc_v: !!! could not copy the runtime dist into the clone — its file: dependants keep resolving a stale build"
  return 1
}
refresh_clone_dependants() { # pkg-vessel clone-dir
  local _rd_v="$1" _rd_c _rd_busy _rd_u _rd_left _rd_need
  _rd_u="$(vessel_unit "$_rd_v")"
  [ -z "$_rd_u" ] || [ "${_rd_u%.service}" = "$_rd_u" ] || return 0      # a vessel, not a shared package
  grep -q '"build"[[:space:]]*:' "$RUNTIME_DIR/$_rd_v/package.json" 2>/dev/null || return 0
  sync_clone_dist "$_rd_v" "$2" || return 0
  BUN_BIN="${BUN_BIN:-/root/.bun/bin/bun}"
  [ -x "$BUN_BIN" ] || BUN_BIN="$(command -v bun 2>/dev/null || true)"
  [ -n "$BUN_BIN" ] || return 0
  # BUDGETED like the mirror quiesce (_Q_LEFT): one dependant can cost 2 x the install
  # timeout, and six of them outlive TimeoutStartSec, so a SIGTERM would land mid-tick.
  # Stop before a dependant whose worst case does not fit; the markers make it resumable.
  : "${GATE_T0:=$(date +%s)}"
  _rd_need=$(( 2 * ${CLONE_DEPS_INSTALL_TIMEOUT_SECONDS:-180} + ${QUIESCE_MARGIN_S:-120} ))
  for _rd_c in $(grep -lE "\"file:[^\"]*/$_rd_v/?\"" "$CLONE_DIR"/*/package.json 2>/dev/null | xargs -r -n1 dirname | xargs -r -n1 basename); do
    [ "$_rd_c" = "$_rd_v" ] && continue
    _rd_left=$(( ${UNIT_TIMEOUT_S:-900} - ( $(date +%s) - GATE_T0 ) - ${QUIESCE_MARGIN_S:-120} ))
    if [ "$_rd_left" -lt "$_rd_need" ]; then
      log "$_rd_v: clone dependant refresh deferred to next tick — tick budget left ${_rd_left}s (one install needs up to ${_rd_need}s)"
      return 0
    fi
    _rd_busy="$(young_authoring_marker "$_rd_c")"
    if [ -n "$_rd_busy" ]; then
      log "$_rd_c: authoring run in flight ($(basename "$_rd_busy")) — not refreshing its clone's $_rd_v copy this tick"
      continue
    fi
    ensure_clone_deps "$_rd_c" "$CLONE_DIR/$_rd_c" || true
    [ "$CD_STATE" = installed ] && log "$_rd_c: clone's file: copy of $_rd_v refreshed after $_rd_v's build moved"
  done
  return 0
}

# Module names a test run could not resolve ("Cannot find module 'x' from …" /
# "Cannot find package 'x' …"), sorted unique. bun counts each such file as one UNNAMED
# failure and drops every test in it.
unresolved_modules() { # test-output -> names, one per line
  printf '%s' "$1" | sed 's/\x1b\[[0-9;]*m//g' \
    | grep -oE "Cannot find (module|package) ['\"][^'\"]+['\"]" \
    | sed -E "s/^Cannot find (module|package) ['\"]//; s/['\"]\$//" | sort -u || true
}

synced=0; skipped=0; deferred=0; failed=0
for d in "$CLONE_DIR"/*/; do
  quiesce_release
  [ -d "$d/.git" ] || continue
  v="$(basename "$d")"
  # A held-out probe window freezes this node's code: no fetch, mirror or restart for any vessel while
  # an open probeWindow record names the node (see probe_window_open), so probes run on one version.
  if probe_window_open; then
    [ -n "${PW_LOGGED:-}" ] || { log "$PW_WHY open on this node — holding ALL vessel convergence (no fetch, mirror or restart) until it closes"; PW_LOGGED=1; }
    skipped=$((skipped+1)); continue
  fi

  # 1. Fetch + classify vs origin.
  if ! git -C "$d" fetch -q origin "$BRANCH" 2>/dev/null; then
    log "$v: fetch failed (network/PAT?) — skipping"; skipped=$((skipped+1)); continue
  fi
  HEAD="$(git -C "$d" rev-parse HEAD 2>/dev/null || true)"
  REMOTE="$(git -C "$d" rev-parse "origin/$BRANCH" 2>/dev/null || true)"
  [ -n "$HEAD" ] && [ -n "$REMOTE" ] || { skipped=$((skipped+1)); continue; }

  if [ "$HEAD" != "$REMOTE" ]; then
    if git -C "$d" merge-base --is-ancestor "origin/$BRANCH" HEAD 2>/dev/null; then
      log "$v: clone ahead of origin (unpushed cutover commits) — leaving for the push side"
      skipped=$((skipped+1)); continue
    elif git -C "$d" merge-base --is-ancestor HEAD "origin/$BRANCH" 2>/dev/null; then
      # These clones are READ-ONLY reach-oracle sources: the oracles enumerate
      # /workspace/git/super-repo/repos/<v>/src to grade counts. A dirty tree
      # (abandoned drafter files, mitosis-overlay leakage) BLOCKS `git checkout`
      # (silently, via `|| true`), stranding the clone DETACHED + behind, and the
      # untracked cruft INFLATES the oracle's file/line counts → deterministic
      # reach graded green-on-wrong denominators. Discard cruft and land on the
      # BRANCH (not detached) before pulling. No legitimate edit ever lives only
      # in a clone — all real changes flow through /vessels + git commits.
      git -C "$d" reset --hard -q HEAD 2>/dev/null || true
      git -C "$d" clean -fd -q 2>/dev/null || true
      git -C "$d" checkout -q "$BRANCH" 2>/dev/null \
        || git -C "$d" checkout -qB "$BRANCH" "origin/$BRANCH" 2>/dev/null || true
      if ! git -C "$d" pull --ff-only -q origin "$BRANCH" 2>/dev/null; then
        log "$v: ff-only pull failed — skipping"; skipped=$((skipped+1)); continue
      fi
      HEAD="$(git -C "$d" rev-parse HEAD)"
    else
      # Divergence self-heal: origin advanced while the clone holds unpushed
      # SUBSTRATE-AUTHORED landings (the stranded-cutover class — previously a
      # forever-refiled pull-sync-diverged gap an operator resolved by hand).
      # When EVERY local-only commit's author AND committer is the substrate's
      # configured git identity, rebase onto origin and push. ANY operator-
      # authored local commit, rebase conflict, or push rejection → abort the
      # rebase cleanly and fall back to the gap (naming conflicting files).
      # Never force, never touch operator work.
      SELF_ID="${SUBSTRATE_GIT_AUTHOR_NAME:-Substrate Autonomous}"
      SYS_ID="$(git -C "$d" config user.name 2>/dev/null || true)"  # setup-git-push.sh's --system identity
      FOREIGN=""
      while IFS= read -r ident; do
        [ -n "$ident" ] || continue
        [ "$ident" = "$SELF_ID" ] && continue
        [ -n "$SYS_ID" ] && [ "$ident" = "$SYS_ID" ] && continue
        FOREIGN="$ident"; break
      done < <(git -C "$d" log --format='%an%n%cn' "origin/$BRANCH..HEAD" 2>/dev/null | sort -u)
      REBASED=""
      if [ -z "$FOREIGN" ]; then
        # Discard clone CRUFT only (untracked/dirty files are never legitimate
        # in these clones — same rationale as the behind branch above); local
        # COMMITS are preserved by the rebase.
        git -C "$d" reset --hard -q HEAD 2>/dev/null || true
        git -C "$d" clean -fd -q 2>/dev/null || true
        if git -C "$d" pull --rebase -q origin "$BRANCH" 2>/dev/null \
           && git -C "$d" push -q origin "HEAD:$BRANCH" 2>/dev/null; then
          REBASED=1
          HEAD="$(git -C "$d" rev-parse HEAD)"
          log "$v: DIVERGED with only substrate-authored local commits — rebased onto origin/$BRANCH and pushed (now ${HEAD:0:10})"
        fi
      fi
      if [ -z "$REBASED" ]; then
        CONFLICT_FILES="$(git -C "$d" diff --name-only --diff-filter=U 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
        git -C "$d" rebase --abort >/dev/null 2>&1 || true
        if [ -n "$FOREIGN" ]; then
          REASON="local-only commits include non-substrate author/committer '$(echo "$FOREIGN" | tr -d '"\\')' — refusing to auto-rebase"
        elif [ -n "$CONFLICT_FILES" ]; then
          REASON="auto-rebase hit conflicts in: $CONFLICT_FILES — rebase aborted cleanly"
        else
          REASON="auto-rebase/push failed (push rejection or transport) — rebase aborted cleanly"
        fi
        log "$v: clone DIVERGED from origin/$BRANCH — $REASON (substrateGap)"
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-diverged-$v\",\"category\":\"source_divergence\",\"source\":\"substrate_detected\",\"summary\":\"$v clone at $CLONE_DIR diverged from origin/$BRANCH; $REASON; pull-sync refuses to force — needs triage\",\"status\":\"open\"}}}}"
        failed=$((failed+1)); continue
      fi
    fi
  fi

  # 2. Mirror when the live runtime's CONTENT lags the clone. A marker that
  # records a git sha can lie about a tree it doesn't describe (marker == HEAD
  # while /vessels never received the mirror -> stale runtime forever); so the
  # skip decision compares the trees themselves, and the marker records the
  # last ATTEMPTED content hash — its only remaining job is re-attempt
  # suppression after an unhealthy revert (the substrateGap owns escalation).
  MARKER="$MARKER_DIR/$v.sha"
  LAST="$(cat "$MARKER" 2>/dev/null || true)"
  CLONE_HASH="$(content_hash "$d")"
  [ -d "$RUNTIME_DIR/$v" ] || { echo "$CLONE_HASH" > "$MARKER"; continue; }  # not part of this runtime
  RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v" "$d")"
  # dist-freshness retry: a shared package whose src is already mirrored but whose
  # last fan-out was rolled back (an unhealthy consumer) leaves dist STALE vs src
  # with no retry — the src-only comparison below never re-enters 2c. Detect the
  # skew (last successful fan-out HEAD != current HEAD) and force a re-fan-out,
  # suppressed to once per HEAD via $v.fanout-fail so a persistently-unhealthy
  # consumer cannot cause a rebuild/revert loop (a new src change clears it).
  DIST_RETRY=""
  SELF_UNIT="$(vessel_unit "$v")"
  # A MASKED VESSEL MUST NOT BE CONVERGED AT ALL — NOT EVEN TESTED.
  #
  # The re-attempt suppression below already refuses to re-mirror a masked vessel,
  # but that only fires when the content is UNCHANGED. Give a masked vessel a NEW
  # commit and it sails past, straight into the test gate at 3-pre, which runs the
  # CLONE's suite before deciding anything.
  #
  # Measured 2026-08-08 on this spoke, one tick after the suppression fix landed:
  #
  #   11:52:22  activity-api: ... is MASKED — keeping suppression ...
  #   [11 minutes of silence]
  #   CGroup: ... timeout 240 /root/.bun/bin/bun test   (cwd /workspace/git/vessels/activity-api)
  #           CPU: 5.2s across 11 minutes, 6 open sockets
  #
  # activity-api's suite blocks on services that do not run here — because the unit
  # is masked — so the gate burns the whole per-tick budget on a vessel this
  # deployment will never start, and the unit is SIGKILLed at TimeoutStartSec before
  # the vessels that DO run are reached. Same starvation as before, one step earlier
  # in the loop.
  #
  # Skipping is safe and complete: mirroring source for a unit that cannot start
  # changes nothing observable, and if the role later unmasks it, the very next tick
  # converges it normally because this test is evaluated fresh each pass.
  if [ -n "$SELF_UNIT" ] && [ "${SELF_UNIT%.service}" != "$SELF_UNIT" ] \
     && [ "$(systemctl is-enabled "$SELF_UNIT" 2>/dev/null)" = masked ]; then
    log "$v: SKIPPED — $SELF_UNIT is MASKED on this deployment; not fetching, not testing, not mirroring (its suite would spend the tick budget on a vessel that cannot start)"
    skipped=$((skipped+1)); continue
  fi
  if { [ -z "$SELF_UNIT" ] || [ "${SELF_UNIT%.service}" = "$SELF_UNIT" ]; } \
     && [ -d "$RUNTIME_DIR/$v/dist" ] \
     && grep -q '"build"[[:space:]]*:' "$RUNTIME_DIR/$v/package.json" 2>/dev/null \
     && [ "$(cat "$LAST_GOOD_DIR/$v" 2>/dev/null || true)" != "$HEAD" ] \
     && [ "$(cat "$MARKER_DIR/$v.fanout-fail" 2>/dev/null || true)" != "$HEAD" ]; then
    DIST_RETRY=1
  fi
  # AN OWED RESTART OUTRANKS THE CONTENT SHORT-CIRCUIT. Content is already equal by
  # the time a restart is owed (the mirror ran), so without this the vessel is skipped
  # forever and mirrored code is never loaded. Bun does not hot-reload, and no health
  # signal can see the difference: the discriminator is unit start time vs file mtime.
  #
  # OWED MEANS OWED, WHATEVER THE CONTENT IS NOW. The marker used to count only when
  # it equalled the current CLONE_HASH, but the clone can move between the hash and
  # the mirror in the same tick (the mirror copies the newer commit). The marker then
  # named a hash that no longer exists, never matched again, and the restart was
  # stranded: measured 2026-10-03, development-vessel deferred at 10:52, later ticks
  # said nothing, and the unit kept serving 10:26 code under green health. A restart
  # loads whatever is on disk, so any recorded marker is owed. And because a marker
  # can be lost by any other path too, the effect is checked directly: non-test
  # runtime content that changed while the unit kept running means the loaded code
  # is not the code on disk, and that alone owes a restart (loaded_code_stale).
  PENDING_FILE="$MARKER_DIR/$v.restart-pending"
  # When the restart was first owed (epoch s), for the max-hold bound below. The pending marker cannot be
  # the clock: the mirror path rewrites it on every deferral. A clock with no pending marker is stale.
  OWED_SINCE_FILE="$MARKER_DIR/$v.restart-owed-since"
  P_CARRY_FILE="$MARKER_DIR/$v.quiesce-carry"
  if [ ! -s "$PENDING_FILE" ]; then   # nothing owed: no hold clock, and no carried admission hold
    rm -f "$OWED_SINCE_FILE" 2>/dev/null || true
    if [ -s "$P_CARRY_FILE" ]; then
      log "$v: dropping a carried quiesce hold — no restart is owed any more; admission reopened"
      rm -f "$(cat "$P_CARRY_FILE" 2>/dev/null)" "$P_CARRY_FILE" 2>/dev/null || true
    fi
  fi
  P_UNIT="$(vessel_unit "$v")"; P_OWED=""
  if [ -s "$PENDING_FILE" ]; then
    P_OWED="restart recorded as pending (for content $(cut -c1-10 < "$PENDING_FILE" 2>/dev/null); clone now ${CLONE_HASH:0:10})"
  elif [ -n "$P_UNIT" ] && systemctl is-active --quiet "$P_UNIT" 2>/dev/null \
       && loaded_code_stale "$v" "$RUNTIME_DIR/$v" "$P_UNIT"; then
    P_OWED="loaded code is older than the code on disk ($LCS_WHY)"
    echo "$CLONE_HASH" > "$PENDING_FILE" 2>/dev/null || true
  fi
  if [ -n "$P_OWED" ]; then
    P_PORT="$(health_port "$v")"
    P_DEFER_FILE="$MARKER_DIR/$v.restart-deferrals"
    P_DEFERRED_N="$(cat "$P_DEFER_FILE" 2>/dev/null || echo 0)"
    case "$P_DEFERRED_N" in ''|*[!0-9]*) P_DEFERRED_N=0 ;; esac
    # A CARRIED HOLD (see quiesce_release): keep admission closed while this tick decides, re-touched so
    # the vessel's QUIESCE_MAX_MS staleness never reopens it under a hold that is still live.
    P_CARRIED=""
    if [ -s "$P_CARRY_FILE" ]; then
      P_CARRIED="$(cat "$P_CARRY_FILE" 2>/dev/null)"; Q_HELD="$P_CARRIED"
      : > "$Q_HELD" 2>/dev/null || true
    fi
    restart_age_defer "$P_PORT" "$P_DEFERRED_N"; P_INFLIGHT="$RA_INFLIGHT"; P_LOSSY=""; P_HOLD=""
    # PROGRESS MAY HOLD AN OWED RESTART, BUT NOT FOREVER. A past-ceiling request that is still making stage
    # transitions is deferred (restart_age_defer), and so is any request under a carried quiesce hold that
    # still publishes fresh progress; owed_hold_bound ends either at the max hold, LOSSY. A carried hold whose
    # compose is no longer progressing restarts, as the quiesce that carried it announced. A probe window is
    # not progress and is never overridden here.
    if [ "$RA_DEFER" = 1 ] && [ "$RA_PROBE" != 1 ]; then
      if [ "${RA_PROGRESSING:-0}" = 1 ] || { [ -n "$P_CARRIED" ] && [ "${RA_FRESH:-0}" = 1 ]; }; then
        P_HOLD=1
        if owed_hold_bound "$v"; then P_HOLD=""; P_LOSSY=1; fi
      elif [ -n "$P_CARRIED" ]; then
        RA_DEFER=0; RA_WHY="carried quiesce hold, but no fresh progress ($RA_WHY) — restarting as the quiesce announced"
      fi
    fi
    # AN OWED RESTART MUST NOT BE STARVED BY A BUSY VESSEL. The age ceiling resets with
    # every new request, so a vessel that is never idle (the compose lane picks again as
    # soon as a draft ends) defers its owed restart on every tick, forever: measured
    # 2026-10-03, development-vessel held a mirrored fix unloaded from 13:54 on while
    # each tick logged "owed restart still deferred". After RESTART_DEFER_MAX deferrals,
    # close admission and drain (the mirror path's quiesce) instead of deferring again.
    # A PROGRESS deferral does not count toward this: the drain's bound would kill the progressing run at
    # deferral N, pre-empting the max-hold bound above, which is the one hard bound for progress.
    if [ "$RA_DEFER" = 1 ] && [ "$RA_PROBE" != 1 ] && [ -z "$P_HOLD" ] && [ "$P_DEFERRED_N" -ge "${RESTART_DEFER_MAX:-3}" ] 2>/dev/null; then
      quiesce_drain "$v" "$P_PORT"
      RA_DEFER=0
      RA_WHY="owed restart deferred ${P_DEFERRED_N} time(s); quiesced: $QD_WHY"
    fi
    if [ "$RA_DEFER" = 1 ]; then
      # A progress hold is not a busy-vessel deferral: it neither counts toward RESTART_DEFER_MAX nor
      # resets it (owed_hold_bound is its bound). Counting it ran the counter to the cap, so the first
      # ordinary deferral after progress stopped went straight to quiesce_drain.
      [ -n "$P_HOLD" ] || echo "$((P_DEFERRED_N + 1))" > "$P_DEFER_FILE" 2>/dev/null || true
      [ -s "$OWED_SINCE_FILE" ] || date +%s > "$OWED_SINCE_FILE" 2>/dev/null || true
      if [ -n "$P_HOLD" ] && [ -n "$P_CARRIED" ]; then
        Q_CARRY="$Q_HELD"; RA_WHY="$RA_WHY; admission stays closed (carried quiesce hold, marker re-touched)"
      fi
      log "$v: owed restart still deferred — $RA_WHY ($P_OWED)"
    else
      P_REASON="owed restart after deferral"
      if [ -n "$RA_WHY" ]; then
        log "$v: owed restart proceeding — $RA_WHY"
        [ -n "$RA_OLDEST" ] && P_REASON="owed restart: oldest in-flight ${RA_OLDEST}ms exceeded ceiling"
        [ -n "$P_LOSSY" ] && P_REASON="owed restart LOSSY: held past max hold while attempt ${RA_PROGRESS_ID:-unknown} was progressing"
      fi
      log "$v: taking OWED restart for already-mirrored content ${CLONE_HASH:0:10} — $P_OWED"
      rm -f "$P_DEFER_FILE" "$PENDING_FILE" "$OWED_SINCE_FILE" 2>/dev/null || true
      if [ -n "$P_UNIT" ] && systemctl is-active --quiet "$P_UNIT" 2>/dev/null; then
        restart_breadcrumb "$v" "$P_REASON" "$P_INFLIGHT"
        systemctl restart "$P_UNIT" 2>/dev/null || true
        Q_CARRY=""; quiesce_release   # a carried hold ends with the restart: the new process must find admission open
        sleep "$STAGGER_SECONDS"
      fi
      Q_CARRY=""; quiesce_release     # and with the owed restart dropped for an inactive unit
    fi
  fi
  if [ "$CLONE_HASH" = "$RUNTIME_HASH" ]; then
    if [ -z "$DIST_RETRY" ]; then
      [ "$LAST" = "$CLONE_HASH" ] || echo "$CLONE_HASH" > "$MARKER"
      [ "$(cat "$MARKER_DIR/$v.runtime-sha" 2>/dev/null)" = "$CLONE_HASH" ] || echo "$CLONE_HASH" > "$MARKER_DIR/$v.runtime-sha" 2>/dev/null || true
      # Say so when the clone moved but nothing mirrored changed: this branch used to
      # skip in silence, which is how a scripts-only landing sat unrun for hours with
      # `synced=0` and no line naming the vessel. Once per HEAD.
      if [ "$(cat "$MARKER_DIR/$v.noop-head" 2>/dev/null)" != "$HEAD" ]; then
        log "$v: clone at ${HEAD:0:10}, but the mirrored trees (src/ sql/ scripts/ + tracked build output) already match the runtime — nothing to mirror"
        echo "$HEAD" > "$MARKER_DIR/$v.noop-head" 2>/dev/null || true
      fi
      refresh_clone_dependants "$v" "$d"   # a converged shared package: its clone dist and file: dependants follow the build
      continue
    fi
    log "$v: src converged but dist stale (last-good != ${HEAD:0:10}) — re-running fan-out"
  fi
  # Re-attempt suppression: this exact content was already attempted (unhealthy ->
  # reverted), so don't mirror/revert loop. BUT the suppression is keyed on content
  # hash alone, and that makes its worst case a permanent wedge: restoring a
  # last-good tree produces content BYTE-IDENTICAL to a tree already attempted, so
  # `LAST = CLONE_HASH` matches and the restore is suppressed forever. That is
  # exactly the recovery path after a corrupt mirror — on 2026-08-02 a drafter
  # self-edit wrote an unrendered `{{...}}` placeholder into byte 0 of
  # feature-compose.ts, development-vessel crash-looped, and pull-sync then
  # reported `synced=0 skipped=0 failed=0` on every tick while /vessels stayed
  # broken, because the hand-pushed revert hashed to a previously-attempted value.
  #
  # The loop this guard prevents only exists when the live runtime is HEALTHY
  # (already running the reverted-to good code, so re-mirroring the bad content
  # would bounce it again). If the unit is down or failing, re-mirroring is
  # unambiguously the right move — there is no healthy state to protect. So skip
  # the suppression whenever this vessel owns a service unit that is not active.
  #
  # ...EXCEPT A UNIT THIS DEPLOYMENT DELIBERATELY DOES NOT RUN. "not active" covers
  # two opposite conditions: a unit that crashed (re-mirror it — that is this
  # override's whole purpose) and a unit that role selection MASKED, which will never
  # be active no matter how many times its content is restored. On a spoke that is
  # activity-api and identity-vessel: `is-active` says inactive, so the override fired
  # on every tick, and because it fires BEFORE the cheap up-to-date check it did the
  # full mirror work each time.
  #
  # That is not merely wasteful — it is a DEPLOYMENT DEADLOCK, and it was live.
  # Measured 2026-08-08 on this spoke: the 09:55:46 run spent its entire budget on
  # activity-api and was SIGKILLed by the unit's own timeout at 10:12:15 ("Failed with
  # result 'timeout'"), and the 10:12:16 run began the same way. goal-host-vessel sat
  # at a commit two pushes stale across four consecutive runs and 20 minutes, and
  # every vessel ordered after activity-api was starved out of the deploy path
  # entirely. A masked vessel was consuming the whole convergence budget of the ones
  # that actually run.
  #
  # `is-enabled` distinguishes them where `is-active` cannot: apply-inventory MASKS
  # what a role excludes, so masked means "this deployment does not run this", while a
  # crashed unit stays `enabled`. Failing shut on an unreadable state keeps the
  # crash-recovery behaviour this override exists for.
  SUPPRESS_REATTEMPT=1
  if [ -n "$SELF_UNIT" ] && [ "${SELF_UNIT%.service}" != "$SELF_UNIT" ] \
     && ! systemctl is-active "$SELF_UNIT" >/dev/null 2>&1; then
    if [ "$(systemctl is-enabled "$SELF_UNIT" 2>/dev/null)" = masked ]; then
      log "$v: content already attempted and $SELF_UNIT is MASKED — this deployment does not run it; keeping suppression so it cannot starve the vessels that do"
    elif [ "$RUNTIME_HASH" != none ] && [ "$RUNTIME_HASH" = "$(cat "$MARKER_DIR/$v.reverted" 2>/dev/null)" ]; then
      # Both trees already failed: the attempted one went unhealthy and the verified
      # revert to last-good did not bring the unit back either. Re-mirroring the
      # attempted content would restart a sick vessel twice and `break` the run every
      # tick, starving every vessel after it. A new origin commit re-arms this vessel;
      # self-recovery owns a down unit; the pull-sync-unhealthy gap owns escalation.
      log "$v: $SELF_UNIT is not active, but the live tree is the verified revert and the attempted content already failed — keeping suppression (not re-mirroring ${HEAD:0:10})"
    else
      SUPPRESS_REATTEMPT=""
      log "$v: content already attempted but $SELF_UNIT is not active — overriding re-attempt suppression to restore service"
    fi
  fi
  # RUNTIME TRUNCATION OVERRIDE (2026-08-02). "unit is active" is a weak proxy for
  # "healthy": bun holds the module it loaded at start, so a vessel keeps serving
  # normally while its own source on disk is destroyed. Observed today —
  # feature-compose.ts went from 190,111 bytes to 38 ("updated content to close
  # substrate gap") three separate times while development-vessel stayed active, so
  # the check above never fired, LAST still equalled CLONE_HASH, and pull-sync
  # suppressed the very re-mirror that would have healed it. The vessel imports
  # that resolver at top level, so the damage was one restart away from taking the
  # whole vessel down.
  #
  # Discriminator: the suppression exists to stop a mirror/revert BOUNCE, which
  # only happens when the runtime holds a deliberately reverted good tree. A
  # runtime file that has collapsed to a small fraction of its clone counterpart is
  # not a revert — nothing legitimately shrinks a source file by >90% — so treat it
  # as corruption and re-mirror regardless. Measured before landing: across 17
  # vessels at steady state, 16 had ZERO live-vs-clone drift of any kind, so this
  # predicate is quiet by construction.
  # DRIFT-MISLABEL GATE (2026-08-05). Everything in this block exists only to CLEAR
  # SUPPRESS_REATTEMPT, and SUPPRESS_REATTEMPT is read at exactly one place: the
  # `[ "$LAST" = "$CLONE_HASH" ]` short-circuit below. When the clone has ADVANCED
  # (LAST != CLONE_HASH) the normal mirror+restart path already runs, so this block cannot
  # change the outcome — it only logs "RUNTIME SOURCE TRUNCATED" and files a
  # systematic_failure gap for ordinary deployment lag. Measured 2026-08-05: 18 such lines in
  # 6h with the hashes CHASING each other (one tick's `clone` hash is the next tick's `live`
  # hash — the signature of a successful mirror followed by a new commit), against ZERO real
  # truncations (the "N vs M bytes" form) in 24h. Those false gaps feed goal generation, so a
  # healthy deploy was manufacturing work items describing a corruption that never happened.
  # Gating on the same condition the result is consumed under is behaviour-preserving: real
  # truncation and real unexplained drift both occur with LAST = CLONE_HASH.
  if [ -n "$SUPPRESS_REATTEMPT" ] && [ "$LAST" = "$CLONE_HASH" ]; then
    TRUNCATED=""
    while IFS= read -r cf; do
      rf="$RUNTIME_DIR/$v/${cf#"$CLONE_DIR/"}"
      [ -f "$rf" ] || continue
      cs=$(wc -c <"$cf" 2>/dev/null || echo 0)
      rs=$(wc -c <"$rf" 2>/dev/null || echo 0)
      if [ "$cs" -gt 1000 ] && [ $((rs * 10)) -lt "$cs" ]; then
        TRUNCATED="${rf#"$RUNTIME_DIR/"} ($rs vs $cs bytes)"; break
      fi
    done <<EOF
$(find "$CLONE_DIR/src" -name '*.ts' -type f 2>/dev/null)
EOF
    # GENERALISED DRIFT HEAL. Truncation is only the catastrophic tail of the same
    # class: patch_with_tools has no isolation and edits $RUNTIME_DIR directly, so a
    # draft that is never rolled back leaves LIVE source differing from git while the
    # vessel keeps serving its already-loaded module. Observed today: live
    # feature-compose.ts carried `llmCall(\n  llmEndpoint,endpoint, prompt, model)`
    # — an identifier not in scope there — while the clone and origin/dev were clean.
    # Nothing detected it; an operator restored it by hand, and a restart would have
    # taken the resolver down.
    #
    # Guarded HARDER than the deferral below: healed only when NO authoring marker
    # exists for the vessel at all, so this can never yank source out from under a
    # live drafter (a mid-run write is legitimate and often reverted). Corruption
    # therefore persists until authoring stops, exactly as for the truncation case.
    #
    # Measured before landing: at steady state 17 of 18 vessels have ZERO
    # live-vs-clone drift; the sole exception is concept-db, a separately-known
    # silent mirror-to-live failure that re-mirroring also repairs. Quiet by
    # construction.
    if [ -z "$TRUNCATED" ] && [ -z "$(ls "$AUTHORING_MARKER_DIR"/*-"$v".json 2>/dev/null)" ]; then
      RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v" "$d")"
      # Repair runs TOWARD THE CLONE, so it is only a repair while the clone IS
      # origin. Step 1 already lands the clone on origin, so this only restates
      # that invariant at the point of use. It cannot tell an unpushed newer fix
      # from a stray draft (on 10-02 the clone WAS origin and a hand-deployed
      # CSRF fix was overwritten), so the heal proceeds, but the mirror site
      # first copies a live tree pull-sync did not write to the drift
      # quarantine and files a gap naming it — and refuses the overwrite if the
      # copy fails (see drift_quarantine).
      # A VERIFIED REVERT IS NOT DRIFT. After an unhealthy convergence the runtime
      # deliberately holds PREV_GOOD while the clone holds the attempted commit; healing
      # "toward the clone" would re-mirror the unhealthy code, restart, revert again —
      # every tick (the bounce SUPPRESS_REATTEMPT exists to stop). $v.reverted is written
      # only when the revert's CONTENT was verified, and cleared by the next real mirror.
      if [ "$RUNTIME_HASH" != none ] && [ "$RUNTIME_HASH" = "$(cat "$MARKER_DIR/$v.reverted" 2>/dev/null)" ]; then
        log "$v: live content is the verified revert to last-good (${RUNTIME_HASH:0:10}), not drift — holding it; clone ${HEAD:0:10} stays unmirrored (the pull-sync-unhealthy gap owns escalation)"
      elif [ "$RUNTIME_HASH" != none ] && [ "$CLONE_HASH" != none ] && [ "$RUNTIME_HASH" != "$CLONE_HASH" ] \
         && [ "$HEAD" != "$(git -C "$d" rev-parse "origin/$BRANCH" 2>/dev/null)" ]; then
        log "$v: live content drifts from the clone, but the clone (${HEAD:0:10}) is not origin/$BRANCH — NOT repairing toward it"
      elif [ "$RUNTIME_HASH" != none ] && [ "$CLONE_HASH" != none ] && [ "$RUNTIME_HASH" != "$CLONE_HASH" ]; then
        TRUNCATED="content drift (live ${RUNTIME_HASH%"${RUNTIME_HASH#??????????}"} != clone ${CLONE_HASH%"${CLONE_HASH#??????????}"})"
      fi
    fi
    if [ -n "$TRUNCATED" ]; then
      SUPPRESS_REATTEMPT=""
      log "$v: RUNTIME SOURCE TRUNCATED — $TRUNCATED — overriding re-attempt suppression to restore it from the clone"
      emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"runtime-source-truncated-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync found live source under $RUNTIME_DIR/$v collapsed to a fraction of its git content ($TRUNCATED) while the unit was still active. A write tool truncated running vessel source; the vessel kept serving from its in-memory module, so nothing else noticed. Re-mirrored from the clone. Ops are applied against RUNTIME_ROOT (live source) rather than a scratch copy — that is the class to close.\",\"status\":\"open\"}}}}"
    fi
  fi
  if [ -z "$DIST_RETRY" ] && [ -n "$SUPPRESS_REATTEMPT" ] && [ "$LAST" = "$CLONE_HASH" ]; then continue; fi

  # 2b. Drain-awareness: never converge a vessel whose working plane shows a
  # LIVE authoring run — a marker that is fresh (< TTL) with its recorded pid
  # alive (or unrecorded) defers mirror+restart to the next tick, exactly as
  # before. Everything else is a LEAK: a dead pid means the authoring process is
  # gone; an mtime past STALE_AUTHORING_MARKER_MIN means the run that wrote it
  # is long over (markers are rewritten at run start, and deferral itself only
  # ever lasts AUTHORING_MARKER_TTL_MIN) — either way no matching run is in
  # flight, so REAP the marker loudly and proceed with the sync instead of
  # skipping past it forever until an operator deletes it.
  # A marker names the vessel being EDITED (feature_compose-activity-api.json),
  # but the authoring RUN executes inside the vessel that HOSTS the resolver —
  # development-vessel serves both feature_compose and patch_with_tools. So a
  # compose targeting activity-api defers converging activity-api while leaving
  # its own host free to be restarted out from under it. Observed 2026-08-05
  # 06:56:55: development-vessel took SIGTERM mid-compose and killed an in-flight
  # edit ("socket connection was closed unexpectedly" at the caller). The host has
  # NO SIGTERM drain of its own, so the run is simply lost. For that vessel, ANY
  # live marker defers — bounded below so a busy authoring plane cannot starve its
  # deploys forever.
  DEFER_MARKER=""
  MARKER_GLOB="$AUTHORING_MARKER_DIR/*-$v.json"
  IS_AUTHORING_HOST=""
  if [ "$v" = "${AUTHORING_HOST_VESSEL:-development-vessel}" ]; then
    MARKER_GLOB="$AUTHORING_MARKER_DIR/*.json"; IS_AUTHORING_HOST=1
  fi
  for mk in $MARKER_GLOB; do
    [ -f "$mk" ] || continue
    MPID="$(grep -o '"pid":[[:space:]]*[0-9][0-9]*' "$mk" 2>/dev/null | grep -o '[0-9]*$' | head -1)"
    PID_DEAD=""
    if [ -n "$MPID" ] && ! kill -0 "$MPID" 2>/dev/null; then PID_DEAD=1; fi
    if [ -n "$PID_DEAD" ] || [ -z "$(find "$mk" -mmin "-$STALE_AUTHORING_MARKER_MIN" 2>/dev/null)" ]; then
      log "$v: REAPING leaked authoring marker $(basename "$mk") (pid=${MPID:-none}${PID_DEAD:+ DEAD}, older-than-${STALE_AUTHORING_MARKER_MIN}m=$([ -z "$(find "$mk" -mmin "-$STALE_AUTHORING_MARKER_MIN" 2>/dev/null)" ] && echo yes || echo no)) — no matching run in flight; proceeding with sync"
      printf '{"at":"%s","actor":"pull-sync","action":"reaped_marker","vessel":"%s","marker":"%s"}\n' \
        "$(date -Iseconds)" "$v" "$(basename "$mk")" >> "$DEFERRAL_LOG" 2>/dev/null || true
      rm -f "$mk" 2>/dev/null || true
      continue
    fi
    # Young live marker: keep the deferral exactly as before.
    [ -n "$(find "$mk" -mmin "-$AUTHORING_MARKER_TTL_MIN" 2>/dev/null)" ] || continue
    DEFER_MARKER="$mk"; break
  done
  # WORK-IN-FLIGHT DEFERRAL (2026-08-05). The marker mechanism above knows two roles: the
  # vessel being EDITED (its own glob) and the vessel HOSTING THE DRAFTER
  # (AUTHORING_HOST_VESSEL). It is blind to the third: the vessel HOSTING THE DISPATCH.
  # goal-host-vessel executes every walk and is almost never itself an edit target, so no
  # marker ever named it and it was restarted on every convergence regardless of what it was
  # running. Measured 2026-08-05: 16 restarts in 6h — every one from pull-sync, NRestarts=0 —
  # while GET :8210/health reported in_flight=3 and callers logged "EARLY EDIT-INTENT routing
  # failed (The operation timed out)" and "socket connection was closed unexpectedly".
  # Edit-intent goals are excluded from auto-resume (goal-host index.ts:10315), so each one
  # killed is PERMANENT loss of a 5-8 minute compose, not a delay.
  #
  # Do not mint a second deferral mechanism — ask the vessel itself. Any vessel whose /health
  # reports in_flight > 0 is holding work a restart destroys; vessels that do not publish the
  # field yield 0 and are untouched. This deliberately sets IS_AUTHORING_HOST so the
  # STARVATION BOUND below applies unchanged: a permanently busy dispatch host must not freeze
  # the deploy channel forever, so after AUTHORING_HOST_MAX_DEFERS consecutive ticks it
  # converges anyway. The shared-package fan-out, which restarts goal-host and the other
  # consumers while iterating ANOTHER vessel, asks the same /health through restart_age_defer
  # before it bounces anyone (2c, "THE DEPENDENCY BOUNCE HONOURS THE SAME IN-FLIGHT QUIESCE").
  if [ -z "$DEFER_MARKER" ]; then
    IFPORT="$(health_port "$v")"
    if [ -n "$IFPORT" ]; then
      INFLIGHT="$(curl -s --max-time 5 "http://127.0.0.1:$IFPORT/health" 2>/dev/null \
        | grep -o '"in_flight"[[:space:]]*:[[:space:]]*[0-9][0-9]*' | grep -o '[0-9]*$' | head -1)"
      # The guard has to NORMALISE the value, not just inspect a defaulted copy of it.
      # `case "${INFLIGHT:-0}"` substitutes 0 for the empty string only inside its own
      # test, so an empty INFLIGHT — the common case, since the grep finds nothing
      # whenever /health omits in_flight or the curl fails — matches neither ''
      # (already substituted away) nor *[!0-9]* (0 is a digit), no branch assigns, and
      # INFLIGHT reaches the comparison still empty:
      #   substrate-pull-sync: line 632: [: : integer expression expected
      # Logged on every run since the guard landed. Under `set -e` semantics the erroring
      # test is false, so it happened to fail toward NOT deferring — i.e. the guard meant
      # to protect in-flight work was, in its most common path, not evaluating at all.
      INFLIGHT="${INFLIGHT:-0}"
      case "$INFLIGHT" in *[!0-9]*) INFLIGHT=0 ;; esac
      # A VESSEL THAT DRAINS DOES NOT NEED PROTECTING FROM A RESTART. This guard's own
      # rationale was "the durable fix is a SIGTERM drain in $v, which it does not
      # have". goal-host HAS one — gracefulShutdown() 503s new dispatches,
      # de-advertises, and waits for in-flight to reach zero under TimeoutStopSec — so
      # the premise was stale, and the cost was not: the busiest dispatch host is
      # almost never idle, so it deferred every tick and then took the
      # AUTHORING_HOST_MAX_DEFERS starvation break, which converges anyway and warns
      # that an in-flight run may be lost. Maximum delay AND the unsafe outcome.
      #
      # Vessels now advertise `drain_ms` on /health. A vessel that publishes a drain
      # at least as long as our own patience is safe ENOUGH to restart with work in
      # flight: systemd sends SIGTERM and the vessel finishes what it holds — but the
      # drain is BOUNDED, so a walk still running at the deadline is killed exactly as
      # it would have been without it. Observed on the first live use: goal-host waited
      # its full 240s and still logged "drain deadline with 1 in-flight". This trades a
      # near-certain loss on every convergence for an occasional one on a long walk; it
      # does not eliminate loss, and claiming it did would be the same overclaim as the
      # stale comment this replaced.
      # Absent or 0 means no drain, which stays the safe default — every vessel that
      # has not opted in behaves exactly as before.
      DRAINMS="$(curl -s --max-time 5 "http://127.0.0.1:$IFPORT/health" 2>/dev/null \
        | grep -o '"drain_ms"[[:space:]]*:[[:space:]]*[0-9][0-9]*' | grep -o '[0-9]*$' | head -1)"
      DRAINMS="${DRAINMS:-0}"
      case "$DRAINMS" in *[!0-9]*) DRAINMS=0 ;; esac
      # QUIESCE INSTEAD OF ACCEPTING THE LOSS.
      #
      # This branch used to converge on the strength of the vessel advertising a
      # SIGTERM drain, and said so honestly: "work still running past that IS
      # lost." The drain is BOUNDED, so a long compose died anyway.
      #
      # That loss is what stops the substrate measuring itself while it develops
      # itself. The outcome of an in-flight change is the evidence that attributes
      # credit to the decision that produced it; destroy the run and the dispatch
      # ends `interrupted`, no verdict is recorded, and the loop cannot tell a good
      # change from a bad one. Measured 2026-08-11: three consecutive trials died
      # exactly here, and each pushed fix triggered the convergence that killed the
      # next measurement.
      #
      # The drain is bounded only because work keeps ARRIVING. Closing admission
      # first makes in-flight fall monotonically to zero, so this wait terminates
      # on its own — bounded by the longest single compose, not unbounded — and
      # nothing is lost. The vessel already refuses new long-running work while
      # draining; the marker just lets a converger open that early.
      if [ "$INFLIGHT" -gt 0 ] && [ "$DRAINMS" -ge "${MIN_TRUSTED_DRAIN_MS:-15000}" ]; then
        QDIR="${QUIESCE_DIR:-/workspace/quiesce}"
        mkdir -p "$QDIR" 2>/dev/null || true
        : > "$QDIR/$v" 2>/dev/null || true
        log "$v: $INFLIGHT unit(s) in flight — QUIESCED (admission closed); waiting for them to finish rather than restarting into them"
        # BOUND THE WAIT BY WHAT IS LEFT OF THE UNIT'S OWN START TIMEOUT, or the branch below
        # that promises "this wait terminates on its own" is unreachable.
        #
        # QUIESCE_WAIT_S defaulted to 900 and the unit is TimeoutStartSec=900, but systemd starts
        # counting when the unit starts and this wait begins after fetch/skip work has already
        # spent part of the tick. So the 900s wait ALWAYS outlives the budget: measured
        # 2026-08-16, quiesce opened at 03:30:56 and systemd SIGTERMed the unit at 03:45:49,
        # `Result=timeout`, before a single iteration of the converge-anyway path could run.
        #
        # The failure is silent and self-perpetuating. The timer simply fires again ten minutes
        # later, quiesces again, and dies again, so a vessel with continuous in-flight work never
        # receives new code while every tick looks like ordinary caution in the log. The rest of
        # this script already reasons this way — the test gate carries a 420s per-tick budget for
        # exactly this reason — and this wait was the one step that did not.
        QWAIT="${QUIESCE_WAIT_S:-900}"; QSTEP=10; QSPENT=0
        : "${GATE_T0:=$(date +%s)}" ; GATE_BUDGET_SECONDS="${GATE_BUDGET_SECONDS:-1000}"
        _Q_LEFT=$(( ${UNIT_TIMEOUT_S:-900} - ( $(date +%s) - GATE_T0 ) - ${QUIESCE_MARGIN_S:-120} ))
        [ "$_Q_LEFT" -lt 0 ] && _Q_LEFT=0
        if [ "$QWAIT" -gt "$_Q_LEFT" ]; then
          log "$v: quiesce wait capped ${QWAIT}s -> ${_Q_LEFT}s by what remains of TimeoutStartSec (${UNIT_TIMEOUT_S:-900}s) less a ${QUIESCE_MARGIN_S:-120}s margin — an uncapped wait outlives the unit and converges nothing"
          QWAIT="$_Q_LEFT"
        fi
        while [ "$QSPENT" -lt "$QWAIT" ]; do
          sleep "$QSTEP"; QSPENT=$((QSPENT+QSTEP))
          NOW="$(curl -s --max-time 5 "http://127.0.0.1:$IFPORT/health" 2>/dev/null \
            | grep -o '"in_flight"[[:space:]]*:[[:space:]]*[0-9][0-9]*' | grep -o '[0-9]*$' | head -1)"
          NOW="${NOW:-0}"; case "$NOW" in *[!0-9]*) NOW=0 ;; esac
          [ "$NOW" -eq 0 ] && break
        done
        if [ "${NOW:-0}" -eq 0 ]; then
          log "$v: drained to 0 in ${QSPENT}s under quiesce — converging with NOTHING in flight, so no run is lost and its outcome stays attributable"
          INFLIGHT=0
        else
          # Bound exists so a wedged vessel cannot block deploys forever. Say what
          # is being given up, in the same terms as the old branch.
          log "$v: still $NOW in flight after ${QSPENT}s of quiesce (bound ${QWAIT}s) — converging anyway unless it is still progressing (decided at the restart); otherwise that run IS lost and its outcome will not be attributable"
          INFLIGHT=0; Q_BOUND=1
        fi
        # ADMISSION STAYS CLOSED UNTIL THE RESTART. The marker used to be removed right here,
        # and the test gate below runs for minutes: measured 2026-10-03 on node 1, drained at
        # 19:41:55, a new compose admitted ~19:45:20 while the gate ran, and the restart at
        # 19:47:01 logged "DEFERRING restart — 1 in flight". The drain bought nothing. It is
        # re-touched (the vessel fails open on a marker older than its QUIESCE_MAX_MS) and
        # released by quiesce_release: after the restart, or on any other exit from this pass.
        : > "$QDIR/$v" 2>/dev/null || true
        Q_HELD="$QDIR/$v"
      fi
      if [ "$INFLIGHT" -gt 0 ]; then
        DEFER_MARKER="in-flight:$INFLIGHT"
        IS_AUTHORING_HOST=1
        log "$v: $INFLIGHT unit(s) of work in flight — a restart would destroy them; deferring convergence"
      else
        # Reset the STARVATION BOUND counter here: the elif below that normally clears it only
        # runs for the real authoring host, so without this the bound would count CUMULATIVE
        # deferrals rather than CONSECUTIVE ones and stop protecting anything after six
        # lifetime deferrals.
        [ "$v" = "${AUTHORING_HOST_VESSEL:-development-vessel}" ] || rm -f "$MARKER_DIR/$v.authoring-host-defers" 2>/dev/null || true
      fi
    fi
  fi
  # STARVATION BOUND for the authoring host only. Its glob matches EVERY live
  # marker, so a continuously busy authoring plane would defer its deploys
  # indefinitely — an unbounded deferral is how a deploy channel silently stops.
  # The per-target deferral above keeps its original unbounded behaviour, which is
  # safe because that glob only matches the one vessel being edited.
  if [ -n "$DEFER_MARKER" ] && [ -n "$IS_AUTHORING_HOST" ]; then
    AH_FILE="$MARKER_DIR/$v.authoring-host-defers"
    AH="$(cat "$AH_FILE" 2>/dev/null || echo 0)"; case "$AH" in ''|*[!0-9]*) AH=0 ;; esac
    AH=$((AH + 1)); echo "$AH" > "$AH_FILE" 2>/dev/null || true
    if [ "$AH" -gt "${AUTHORING_HOST_MAX_DEFERS:-6}" ]; then
      log "$v: authoring-host deferral STARVATION BREAK — deferred $AH consecutive ticks on live markers ($(basename "$DEFER_MARKER")); converging anyway, an in-flight authoring run may be lost"
      emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-authoring-host-starved-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync deferred converging the authoring host $v for $AH consecutive ticks because markers were always live; converged anyway to avoid an indefinitely stale deploy channel. An in-flight authoring run may have been killed. The durable fix is a SIGTERM drain in $v, which it does not have.\",\"status\":\"open\"}}}}"
      DEFER_MARKER=""
      rm -f "$AH_FILE" 2>/dev/null || true
    fi
  elif [ -n "$IS_AUTHORING_HOST" ]; then
    rm -f "$MARKER_DIR/$v.authoring-host-defers" 2>/dev/null || true
  fi
  if [ -n "$DEFER_MARKER" ]; then
    log "$v: authoring run in flight ($DEFER_MARKER) — deferring convergence to next tick"
    printf '{"deferred_at":"%s","vessel":"%s","marker":"%s","head":"%s"}\n' \
      "$(date -Iseconds)" "$v" "$DEFER_MARKER" "$HEAD" >> "$DEFERRAL_LOG" 2>/dev/null || true
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-deferred-$v\",\"category\":\"convergence_deferral\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync deferred converging $v to ${HEAD:0:10}: authoring marker $(basename "$DEFER_MARKER") is live (fresh or pid alive); retrying next tick instead of killing the in-flight run\",\"status\":\"open\"}}}}"
    skipped=$((skipped+1)); continue
  fi

  # 3-pre. TEST GATE ON THE DEPLOYING CHANNEL. This script is the ONLY channel by
  # which committed code reaches the running fleet, and until now it ran no test at
  # all: the tsc gate below fires only in the shared-package fan-out branch, and the
  # health gate only asks whether /health returns 200 — which a fully regressed vessel
  # does. Run the CLONE's suite, not the runtime's (mirror-to-live omits test files).
  # DELTA, not redness: a gate on absolute redness would refuse every convergence
  # forever. An uncountable result is logged LOUDLY as a blind instrument and never
  # silently counted as a pass. Bounded refusal (TEST_GATE_MAX_REFUSALS).
  TEST_BASELINE_DIR="${TEST_BASELINE_DIR:-/workspace/.test-baseline}"
  mkdir -p "$TEST_BASELINE_DIR"
  BUN_BIN="${BUN_BIN:-/root/.bun/bin/bun}"
  [ -x "$BUN_BIN" ] || BUN_BIN="$(command -v bun 2>/dev/null || true)"
  # PER-TICK BUDGET. The unit is TimeoutStartSec=900 and this gate runs INSIDE the
  # convergence loop, so N vessels converging in one tick cost N * (up to 2 *
  # TEST_TIMEOUT_SECONDS). Exceeding 900s gets the unit SIGTERMed — and the kill
  # would land between this gate and mirror-to-live, i.e. mid-convergence. An
  # unbounded step has already wedged the sibling host loop for 56 minutes once;
  # bound it. Past the budget the gate converges UNGATED and says so, because a
  # stalled deploy channel is a worse failure than an unmeasured convergence.
  : "${GATE_T0:=$(date +%s)}" ; GATE_BUDGET_SECONDS="${GATE_BUDGET_SECONDS:-1000}"
  GATE_ELAPSED=$(( $(date +%s) - GATE_T0 ))
  if [ "$GATE_ELAPSED" -ge "${GATE_BUDGET_SECONDS:-900}" ]; then
    log "$v: !!! TEST GATE SKIPPED — per-tick budget ${GATE_BUDGET_SECONDS:-900}s exhausted (${GATE_ELAPSED}s elapsed); converging UNGATED rather than risk a SIGTERM mid-convergence"
    # FILE IT, do not merely log it. A test REGRESSION emits a gap (below); the gate
    # DISABLING ITSELF did not — and that is the more serious condition, because a
    # regression means the gate ran and objected while this means no gate ran at all.
    # Reporting the worse condition through the weaker channel is how it stayed invisible:
    # a loud line nobody queries is a silent failure. Measured 2026-08-17: several changes
    # converged under this branch and the only trace was a log line.
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-testgate-skipped-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"Repair needed: pull-sync converged $v to ${HEAD:0:10} with NO test gate — the per-tick budget (${GATE_BUDGET_SECONDS:-900}s) was exhausted after ${GATE_ELAPSED}s, so the suite never ran. This is not a passing gate, it is an absent one, and it is absent precisely when a tick is slow, which is when convergence is riskiest. Repair the capability by raising the budget, sharding the gate across ticks, or running the suite before the tick's other work.\",\"status\":\"open\"}}}}"
    BUN_BIN=""
  fi
  # The gate measures the clone's suite against the clone's node_modules: satisfy the
  # manifest first (see ensure_clone_deps). Unsatisfiable, failed or backed-off -> gap
  # (filed there) and NO convergence this tick: fail closed, never ungated.
  GATE_BLIND_WHY=""; U_EXCL=0
  if [ -n "$BUN_BIN" ]; then
    if ! ensure_clone_deps "$v" "$d"; then skipped=$((skipped + 1)); continue; fi
  fi
  count_pf() { printf '%s' "$1" | grep -oE "^ *[0-9]+ $2" | grep -oE '[0-9]+' | tail -1 || true; }
  # The SET of failing test names, sorted and stripped of timings/colour. A regression is a
  # test that USED TO PASS AND NOW FAILS — which a count cannot express and this can. See the
  # baseline block below for why the count comparison had to go.
  fail_names() {
    printf '%s' "$1" \
      | sed 's/\x1b\[[0-9;]*m//g' \
      | grep -E '^\(fail\)|^✗' \
      | sed 's/ \[[0-9.]*m*s\]$//' \
      | sed 's/[[:space:]]*$//' \
      | sort -u || true
  }
  # --kill-after IS LOAD-BEARING, not belt-and-braces. Measured 2026-08-17 19:34: a
  # convergence tick hung with pull-sync sleeping in pipe_read for 7+ minutes and no output
  # after "Starting". The leaf was `bun test` in /workspace/git/vessels/activity-api,
  # 7 minutes old, with NO `timeout` process left in the chain.
  #
  # That is the whole failure: plain `timeout N` sends SIGTERM and exits. A suite that does
  # not die on SIGTERM keeps the write end of this command substitution's pipe OPEN, so
  # `$(run_suite)` blocks forever — the timeout "expired" and bought nothing. The tick then
  # stalls until systemd's TimeoutStartSec (900s) kills the whole service, so ONE unkillable
  # suite costs the entire fleet a 15-minute convergence window, and it costs it silently:
  # the last line in the journal is "Starting", which reads like a slow tick rather than a
  # wedged one.
  #
  # --kill-after escalates to SIGKILL, which cannot be ignored, so the pipe closes and the
  # substitution returns. The gate then treats it as an unreadable suite (T_FAIL empty ->
  # TEST GATE BLIND) and converges ungated, which is the designed behaviour for "no
  # instrument" and is now reachable instead of deadlocking before it.
  # ISOLATED FROM LIVE STATE (2026-09-29). The suite used to inherit this unit's environment,
  # including WORKSPACE_ROOT=/workspace/git/super-repo, the LIVE gap store's root: a /proc
  # watcher caught this function refreshing 16 fixture rows (some-real-gap, class-b-*,
  # heal-probe, flat-*-probe, …) in the live store. It now runs under a scrubbed environment
  # with a throwaway WORKSPACE_ROOT, like the compose (d8891ed) and post-land (53b4993) runners;
  # parent and candidate are both measured this way, so the gate still compares like with like.
  # The trailing __PULLSYNC_RC line is diagnostic only (count_pf and fail_names ignore it): a BLIND tick's retained
  # tail was bun's end-of-run failure list cut mid-line at 36 s, far inside the 240 s timeout, so the run was ended
  # by something other than the timeout. Its exit status (124/137 timeout/kill, 1 normal red, other = crash or
  # signal) and wall time are what the next blind tick must show.
  # OUTPUT GOES TO A FILE, NOT THE PIPE (qa reproduced, 2026-09-30): bun exits before a stdout PIPE drains, so
  # captured through $( ) ~45% of the output was lost, cut inside the end-of-run failure list before the totals
  # (324,504 of ~594,000 bytes, mid-line). The same run redirected to a file keeps its summary. That race was the
  # ~40% "TEST GATE BLIND" rate: exit 1 (a normal red), not a timeout, kill or crash.
  run_suite() { (cd "$d" && _rs_root="$(mktemp -d "${TMPDIR:-/tmp}/pullsync-root-XXXXXX")" && _rs_out="$(mktemp "${TMPDIR:-/tmp}/pullsync-out-XXXXXX")" && _rs_t0=$(date +%s) && scrubbed_env "$_rs_root" timeout --kill-after="${TEST_KILL_GRACE_SECONDS:-30}" "${TEST_TIMEOUT_SECONDS:-240}" "$BUN_BIN" test > "$_rs_out" 2>&1; _rs_rc=$?; cat "$_rs_out"; echo "__PULLSYNC_RC=$_rs_rc wall=$(( $(date +%s) - _rs_t0 ))s"; rm -rf "$_rs_root" "$_rs_out" 2>/dev/null) || true; }
  # Run the suite at an arbitrary ref, NOW, under this tick's conditions.
  #
  # The stored baseline is a snapshot taken at some earlier tick; test outcomes here depend on
  # the environment (the note above records DB-dependent files importing only when
  # SURREALDB_NAMESPACE is set), so a name that fails under this tick's conditions but was
  # recorded passing days ago reads as a regression belonging to whatever commit is in front of
  # the gate. Measuring the PARENT right now removes that confound: parent and candidate are
  # then compared under one set of conditions, which is what "a test that used to pass and now
  # fails" actually means. Same correction 17aae9a made for the mitosis cutover gate.
  #
  # Isolated in a throwaway worktree so the live clone is never checked out from under a
  # converge. node_modules is symlinked because a fresh worktree has none and `bun test`
  # would otherwise fail wholesale — which would subtract everything and turn this into a
  # fail-open. Callers must treat an implausible result as UNUSABLE, not as "parent was broken".
  run_suite_at() {
    local _rsa_ref="$1" _rsa_wt="" _rsa_out=""
    # SWEEP FIRST. `git worktree remove` was observed failing transiently at the end of a run
    # (test child processes still holding the directory) and then succeeding on a later retry,
    # so a single best-effort removal leaks a registered worktree every time that happens.
    # Reclaim stale ones from previous invocations before adding another; an hour is far longer
    # than any suite run, so this can never touch a live one.
    find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'pullsync-base-*' -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true
    git -C "$d" worktree prune >/dev/null 2>&1 || true
    _rsa_wt="$(mktemp -d "${TMPDIR:-/tmp}/pullsync-base-XXXXXX" 2>/dev/null || true)"
    [ -n "$_rsa_wt" ] || return 1
    if ! git -C "$d" worktree add --detach "$_rsa_wt" "$_rsa_ref" >/dev/null 2>&1; then
      rm -rf "$_rsa_wt" 2>/dev/null || true; return 1
    fi
    [ -d "$d/node_modules" ] && ln -s "$d/node_modules" "$_rsa_wt/node_modules" 2>/dev/null || true
    _rsa_out="$( (cd "$_rsa_wt" && _rs_root="$(mktemp -d "${TMPDIR:-/tmp}/pullsync-root-XXXXXX")" && _rs_out="$(mktemp "${TMPDIR:-/tmp}/pullsync-out-XXXXXX")" && scrubbed_env "$_rs_root" timeout --kill-after="${TEST_KILL_GRACE_SECONDS:-30}" "${TEST_TIMEOUT_SECONDS:-240}" "$BUN_BIN" test > "$_rs_out" 2>&1; cat "$_rs_out"; rm -rf "$_rs_root" "$_rs_out" 2>/dev/null) || true )"
    git -C "$d" worktree remove --force "$_rsa_wt" >/dev/null 2>&1 || rm -rf "$_rsa_wt" 2>/dev/null || true
    git -C "$d" worktree prune >/dev/null 2>&1 || true
    printf '%s' "$_rsa_out"
  }
  # D2 FIX. A pass-count DROP alone is not a regression: consolidating or deleting
  # tests legitimately lowers it. Only count it when failures did not ALSO improve,
  # otherwise a genuine repair that removes dead tests is refused as a regression AND
  # the improvement-ratchet branch below becomes unreachable for that case.
  # is_reg() (count comparison) REMOVED 2026-08-18 — replaced by the set difference below.
  # It defined regression as `fail_now > fail_baseline` against a baseline that only ratcheted
  # DOWN, so a suite that grew could never converge again. Left as a comment rather than
  # deleted silently because its absence is the point: no count of failures, however measured,
  # can distinguish "a test broke" from "more tests exist".
  REG=""; REG_F=""; REG_P=""; REG_U=""; REG_NAMED=""; CONF_SET=""; OUT_STILL=""
  if [ -z "$BUN_BIN" ]; then
    log "$v: !!! TEST GATE BLIND — no test runner available (bun missing, or the per-tick budget line above disabled it); this is not 'no tests', it is no instrument. Converging ungated."
    # Only file when the runner is genuinely missing. When the budget branch above cleared
    # BUN_BIN it already filed, and two gaps for one cause would double-count the demand
    # the gap picker reads.
    if [ "$GATE_ELAPSED" -lt "${GATE_BUDGET_SECONDS:-900}" ]; then
      emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-testgate-no-runner-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"Repair needed: pull-sync converged $v to ${HEAD:0:10} with no test runner present, so the gate could not execute a single test. This is no instrument rather than no tests — the vessel's suite was never consulted. Repair the capability by ensuring bun is on PATH in the convergence environment.\",\"status\":\"open\"}}}}"
    fi
  else
    T_OUT="$(run_suite)"; T_FAIL="$(count_pf "$T_OUT" fail)"; T_PASS="$(count_pf "$T_OUT" pass)"
    # UNRESOLVABLE MODULES THE PARENT SHARES ARE EXCLUDED, NOT CARRIED AS A SHARED COUNT. A
    # test file that cannot resolve an import is one UNNAMED failure that hides every test in
    # it. When the parent, measured now under identical conditions, cannot resolve the same
    # module, the environment (not the commit) is what fails to load those files, and the
    # load-error gate's count comparison compares two blind spots: it carried 10 such failures
    # on the hub as if they were a baseline, then refused a correct commit when a new test
    # importing the same module made it 11. So the modules are named in one gap, the files
    # failing on them are subtracted from the unnamed count (U_EXCL, never written into the
    # baseline), and the name-set gate still judges every file that DID load. Only when no
    # test loaded at all (no pass, no named failure) is the gate blind and v converged ungated.
    # Modules only the candidate cannot resolve were introduced by the commit: not excluded.
    U_MODS=""
    if [ -n "$T_FAIL" ]; then
      U_MODS="$(unresolved_modules "$T_OUT")"
      if [ -n "$U_MODS" ]; then
        U_PARENT_REF="$(git -C "$d" rev-parse --verify --quiet "${HEAD}^" 2>/dev/null || true)"
        U_P_MODS=""
        [ -n "$U_PARENT_REF" ] && U_P_MODS="$(unresolved_modules "$(run_suite_at "$U_PARENT_REF" || true)")"
        U_SHARED="$(comm -12 <(printf '%s\n' "$U_MODS") <(printf '%s\n' "$U_P_MODS") 2>/dev/null | grep . || true)"
        if [ -n "$U_SHARED" ]; then
          U_EXCL="$(printf '%s' "$T_OUT" | sed 's/\x1b\[[0-9;]*m//g' | grep -oE "Cannot find (module|package) ['\"][^'\"]+['\"]" \
            | sed -E "s/^Cannot find (module|package) ['\"]//; s/['\"]\$//" | grep -cxF -f <(printf '%s\n' "$U_SHARED") || true)"
          case "$U_EXCL" in ''|*[!0-9]*) U_EXCL=0 ;; esac
          U_WHY="test files cannot resolve module(s) at both the parent ${U_PARENT_REF:0:10} and the candidate ${HEAD:0:10}: $(printf '%s' "$U_SHARED" | tr '\n' ' ' | sed 's/ $//')"
          if [ "${T_PASS:-0}" -eq 0 ] && [ -z "$(fail_names "$T_OUT")" ]; then
            GATE_BLIND_WHY="$U_WHY; no test file loaded at all"
            log "$v: !!! TEST GATE BLIND — $GATE_BLIND_WHY; converging UNGATED (baseline untouched)"
          else
            log "$v: $U_WHY — excluding $U_EXCL file(s) that fail to load on them from the unnamed-failure count; the files that loaded are still gated"
          fi
          emit_gap "$(jq -n -c --arg v "$v" --arg head "${HEAD:0:10}" --arg why "$U_WHY" --arg mode "$([ -n "$GATE_BLIND_WHY" ] && echo "The gate is BLIND: no test file loaded, so $v converged ungated." || echo "The $U_EXCL file(s) failing on them are excluded from the gate; files that loaded are still judged.")" --arg mods "$(printf '%s' "$U_SHARED" | tr '\n' ',' | sed 's/,$//')" \
            '{impulse:{pointer:{type:"substrateGap_write",gap:{id:("pull-sync-testgate-unresolvable-modules-" + $v),category:"systematic_failure",source:"substrate_detected",status:"open",
              summary:("Repair needed: pull-sync test gate for " + $v + " at " + $head + ": " + $why + ". Every test file importing them fails to load and hides its tests, so neither side measured them. " + $mode + " Usually the clone node_modules does not satisfy package.json, or a dependency needs a build step the pre-gate install (scripts disabled) does not run."),
              classification_metadata:{unresolvable_modules:($mods | split(",")),head:$head}}}}}' 2>/dev/null)"
        fi
      fi
    fi
    if [ -n "$GATE_BLIND_WHY" ]; then
      : # blind (above): no verdict, no baseline write
    elif [ -z "$T_FAIL" ]; then
      log "$v: !!! TEST GATE BLIND — suite produced no countable result (errored or absent); converging ungated"
      # A blind verdict that discards its output cannot be diagnosed: the same command run
      # by hand, in the unit's cgroup, TasksMax and PATH, printed a summary every time, so
      # the generator is tick-dependent and only the tick's own output can name it. Keep
      # the size and tail, and file it so an ungated convergence is queryable, not a log line.
      _blind_tail="$(printf '%s' "$T_OUT" | grep -v '^[[:space:]]*$' | tail -5 | cut -c1-240)"
      log "$v: blind output bytes=${#T_OUT} tail: $(printf '%s' "$_blind_tail" | tr '\n' '|')"
      if command -v jq >/dev/null 2>&1; then
        emit_gap "$(jq -n -c --arg v "$v" --arg head "${HEAD:0:10}" --arg bytes "${#T_OUT}" --arg tail "$_blind_tail" \
          '{impulse:{pointer:{type:"substrateGap_write",gap:{id:("pull-sync-testgate-blind-" + $v),category:"systematic_failure",source:"substrate_detected",status:"open",
            summary:("Repair needed: pull-sync converged " + $v + " to " + $head + " UNGATED because its test suite produced no countable pass/fail summary (" + $bytes + " bytes of output). The run ended without bun printing its totals, so every test was unconsulted. Output tail: " + $tail),
            classification_metadata:{blind_output_bytes:($bytes|tonumber),blind_output_tail:$tail,head:$head}}}}}')"
      fi
    else
      # ── SET-BASED GATE ────────────────────────────────────────────────────────────────
      # A COUNT CANNOT EXPRESS "REGRESSION", AND THE COUNT VERSION WEDGED CONVERGENCE.
      #
      # The old predicate was `fail_now > fail_baseline`, with a baseline that only ever
      # RATCHETED DOWN. So any vessel that legitimately GREW its suite could never converge
      # again: the stale absolute count stayed permanently exceeded, and every subsequent
      # commit — correct or not — was refused for the same reason.
      #
      # Measured 2026-08-18: activity-api was refused three ticks running with
      #   "baseline 177 fail/1136 pass -> 193 fail/1185 pass"
      # Note the PASS count also rose, by 49. The suite had grown by ~65 tests; the baseline
      # had been recorded when 1313 existed and the run had 1378. Comparing those two numbers
      # is comparing different measurements. Reproduced locally with the same env the hub uses
      # (SURREALDB_NAMESPACE set, so the DB-dependent files import): three runs at the
      # candidate and three at its parent gave 194/193/194 fail on BOTH — identical. There was
      # no regression to find, and the gate had blocked a fix for the outage it was protecting.
      #
      # A regression is a test that USED TO PASS AND NOW FAILS. That is a set difference, and
      # it is stable under a growing suite: adding passing tests changes nothing, adding a
      # BROKEN test is correctly caught, and removing a test cannot manufacture a pass.
      #
      # The baseline file now holds the sorted failing-test NAMES. A legacy two-number file is
      # treated as absent so the next observation re-baselines into the new format rather than
      # comparing across formats — which is the very mistake being fixed.
      B_NAMES_FILE="$TEST_BASELINE_DIR/$v.failnames"
      T_NAMES="$(fail_names "$T_OUT")"
      # OUTSTANDING REGRESSIONS ARE NEVER ABSORBED INTO THE BASELINE (2026-10-02). The starvation
      # break below used to write the regressed names into failnames, and so did every later
      # baseline refresh — after which the gate could no longer see the regression at all. A
      # regression the break deployed is held in $v.outstanding instead: failnames stays the
      # pre-regression baseline, every write to it goes through tg_write_failnames (which subtracts
      # the outstanding set), an outstanding name is not re-charged to later commits (it is
      # already live; the gap below tracks it, like the tracked-by-open-gap subtraction), and it
      # leaves the list only when it no longer fails. Absent from the fail set is read as passing;
      # a file that stops loading is the load-error gate's to catch.
      OUT_FILE="$TEST_BASELINE_DIR/$v.outstanding"
      tg_minus_outstanding() { comm -23 <(printf '%s\n' "$1" | sort -u) <(sort -u "$OUT_FILE" 2>/dev/null) 2>/dev/null | grep . || true; }
      tg_write_failnames() { printf '%s\n' "$(tg_minus_outstanding "$1")" > "$B_NAMES_FILE"; }
      # OUTSTANDING NAMES AGE (qa, 2026-10-02). Without an age, "baseline + outstanding" is a
      # permanent shadow baseline. $v.outstanding-since holds "<epoch-first-outstanding>\t<name>";
      # a name outstanding longer than TG_OUTSTANDING_ESCALATE_SECONDS escalates: the gap goes from
      # severity "medium" to "high" (boredom-vessel gapPriorityWeight reads gap.severity, so an aged
      # regression outranks routine work) and a distinct OUTSTANDING REGRESSION AGED line is logged.
      # Aging never clears and never closes anything: the gap closes ONLY when every name passes.
      # A named constant, not an env knob: pull-sync has no shaped-setting reader, and an env var
      # would be frozen and invisible to traces (law 1). 3 days.
      TG_OUTSTANDING_ESCALATE_SECONDS=259200
      OUT_SINCE="$OUT_FILE-since"
      # Stamp every outstanding name that has none; drop stamps of names no longer outstanding.
      tg_stamp_outstanding() {
        local now; now="$(date +%s)"
        { cat "$OUT_SINCE" 2>/dev/null || true; } | awk -F'\t' -v now="$now" -v outf="$OUT_FILE" 'BEGIN{while((getline l < outf)>0) if(l!="") O[l]=1}
          ($2 in O) && !($2 in S) && $1 ~ /^[0-9]+$/ {S[$2]=$1}
          END{for(n in O) printf "%s\t%s\n", ((n in S)?S[n]:now), n}' | sort -t$'\t' -k2 > "$OUT_SINCE.tmp" \
          && mv "$OUT_SINCE.tmp" "$OUT_SINCE"
      }
      # One gap per vessel, re-emitted every gated tick while any name is outstanding, so the
      # regression the break deployed stays queryable (names, first-outstanding times, aged names
      # in classification_metadata). Open while anything is outstanding; closed only by tg_close_outstanding.
      tg_emit_outstanding() {
        tg_stamp_outstanding
        local now aged; now="$(date +%s)"
        aged="$(awk -F'\t' -v now="$now" -v w="$TG_OUTSTANDING_ESCALATE_SECONDS" '$1 ~ /^[0-9]+$/ && now - $1 > w {print $2}' "$OUT_SINCE" 2>/dev/null || true)"
        if [ -n "$aged" ]; then
          log "$v: !!! OUTSTANDING REGRESSION AGED — $(printf '%s' "$aged" | grep -c .) test(s) live and failing for longer than ${TG_OUTSTANDING_ESCALATE_SECONDS}s, escalating the gap to severity high: $(printf '%s' "$aged" | tr '\n' ';' | cut -c1-400)"
        fi
        emit_gap "$(jq -n -c --arg v "$v" --arg head "${HEAD:0:10}" --arg names "$1" --arg aged "$aged" --arg w "$TG_OUTSTANDING_ESCALATE_SECONDS" \
          --argjson since "$(jq -R -s -c 'split("\n") | map(select(length > 0) | split("\t") | {key: .[1], value: (.[0] | tonumber | todate)}) | from_entries' "$OUT_SINCE" 2>/dev/null || echo '{}')" \
          '($names | split("\n") | map(select(length > 0))) as $n | ($aged | split("\n") | map(select(length > 0))) as $a | {impulse:{pointer:{type:"substrateGap_write",gap:{id:("pull-sync-testgate-outstanding-regression-" + $v),category:"systematic_failure",source:"substrate_detected",status:"open",
            severity:(if ($a | length) > 0 then "high" else "medium" end),
            summary:("Repair needed: pull-sync converged " + $v + " past its test gate on a starvation break, so " + ($n | length | tostring) + " regressed test(s) are LIVE and still failing at " + $head + ": " + ($n | join("; ")) + ". They are held outstanding, never written into the baseline: later commits are judged against the pre-regression baseline, and this closes only when the named tests pass again." + (if ($a | length) > 0 then " ESCALATED: " + ($a | length | tostring) + " outstanding for longer than " + $w + "s." else "" end)),
            classification_metadata:{vessel:$v,outstanding_tests:$n,outstanding_since:($since | with_entries(select(.key as $k | $n | index($k)))),aged_tests:$a,escalate_after_seconds:($w | tonumber),head:$head}}}}}' 2>/dev/null)"
      }
      # The only closing path: every outstanding name passed again.
      tg_close_outstanding() {
        emit_gap "$(jq -n -c --arg v "$v" --arg head "${HEAD:0:10}" --arg names "$1" \
          '($names | split("\n") | map(select(length > 0))) as $n | {impulse:{pointer:{type:"substrateGap_write",gap:{id:("pull-sync-testgate-outstanding-regression-" + $v),category:"systematic_failure",source:"substrate_detected",status:"closed",closed_reason:"outstanding_tests_passed",
            summary:("pull-sync test gate: every outstanding regressed test of " + $v + " passes again at " + $head + ": " + ($n | join("; "))),
            classification_metadata:{vessel:$v,outstanding_tests:[],cleared_tests:$n,head:$head}}}}}' 2>/dev/null)"
      }
      if [ -s "$OUT_FILE" ]; then
        OUT_STILL="$(comm -12 <(sort -u "$OUT_FILE") <(printf '%s\n' "$T_NAMES" | sort -u) 2>/dev/null | grep . || true)"
        OUT_CLEARED="$(comm -23 <(sort -u "$OUT_FILE") <(printf '%s\n' "$T_NAMES" | sort -u) 2>/dev/null | grep . || true)"
        [ -n "$OUT_CLEARED" ] && log "$v: outstanding regression(s) cleared — no longer failing at ${HEAD:0:10}: $(printf '%s' "$OUT_CLEARED" | tr '\n' ';' | cut -c1-400)"
        if [ -n "$OUT_STILL" ]; then
          printf '%s\n' "$OUT_STILL" > "$OUT_FILE"
          log "$v: $(printf '%s' "$OUT_STILL" | grep -c .) outstanding regression(s) still failing at ${HEAD:0:10} (deployed by a starvation break; never absorbed into the baseline): $(printf '%s' "$OUT_STILL" | tr '\n' ';' | cut -c1-400)"
          tg_emit_outstanding "$OUT_STILL"
        else
          tg_close_outstanding "$OUT_CLEARED"
          rm -f "$OUT_FILE" "$OUT_SINCE" 2>/dev/null || true
        fi
      fi
      # The reference a candidate is judged against: the pre-regression baseline plus what is
      # already outstanding (live, tracked, not this commit's).
      B_REF="$( { cat "$B_NAMES_FILE" 2>/dev/null; printf '%s\n' "$OUT_STILL"; } | grep . | sort -u || true)"
      # Before the baseline is refreshed below: B_NAMES_FILE still holds the PREVIOUS tick's fail set,
      # which is what the generator's two-tick flake filter compares against. Never fatal.
      # Queued, not run: the generator's alone-runs (up to 3 x 165 s) must never sit in front of a deploy in a
      # 900 s unit (qa). Its inputs are snapshotted here, before the baseline below is refreshed, and it runs at
      # the END of the tick, after every vessel has converged, only while the tick budget allows.
      _gq="$(mktemp -d "${TMPDIR:-/tmp}/pullsync-genq-XXXXXX")" && printf '%s' "$T_OUT" > "$_gq/out" && cp "$B_NAMES_FILE" "$_gq/prev" 2>/dev/null \
        && GEN_QUEUE="${GEN_QUEUE}${v}|${_gq}|${HEAD}|${d}"$'\n' || rm -rf "${_gq:-/nonexistent-genq}" 2>/dev/null || true
      # The gate compares NAME SETS; the old two-number baseline is no longer read. The old
      # count variable was left behind in two log strings after that rewrite and, under
      # `set -u`, an unbound variable ABORTS the whole converge — so a string that only
      # DESCRIBED the result took the code channel down with it, and every fix landed on
      # origin sat unconverged. Report the baseline's named-failure count instead, which is
      # what this gate actually reasons about.
      B_NAMED="$(grep -c . "$B_NAMES_FILE" 2>/dev/null || true)"; B_NAMED="${B_NAMED:-0}"
      T_NAMED="$(printf '%s' "$T_NAMES" | grep -c . || true)"; T_NAMED="${T_NAMED:-0}"
      T_UNNAMED=$((T_FAIL - T_NAMED - U_EXCL)); [ "$T_UNNAMED" -ge 0 ] || T_UNNAMED=0
      # A FILE THAT STOPS LOADING READS AS AN IMPROVEMENT TO A NAME-SET GATE. bun counts a test
      # file that fails to load as ONE failure with no "(fail)" name, and drops every test in it.
      # So the named set SHRINKS (its failing names vanish), its passing tests vanish, and the
      # set comparison below converges it. Measured 2026-09-29: the summary count has been
      # named + 2 all day on both nodes, i.e. the unnamed count is a stable constant, so a rise
      # in it — confirmed on a second run — is a load regression the name set cannot see.
      # The baseline's third field is its own unnamed count, written with it, so the check never
      # depends on the names file and the count file staying in step (the starvation break used
      # to rewrite only the counts). A legacy two-field file derives it from the names file.
      B_SUM_FAIL="$(awk 'NR==1{print $1}' "$TEST_BASELINE_DIR/$v" 2>/dev/null || true)"
      B_UNNAMED="$(awk 'NR==1{print $3}' "$TEST_BASELINE_DIR/$v" 2>/dev/null || true)"
      case "$B_SUM_FAIL" in ''|*[!0-9]*) B_SUM_FAIL="" ;; esac
      case "$B_UNNAMED" in ''|*[!0-9]*) B_UNNAMED="" ;; esac
      if [ -z "$B_UNNAMED" ] && [ -n "$B_SUM_FAIL" ] && [ "$B_SUM_FAIL" -ge "$B_NAMED" ]; then B_UNNAMED=$((B_SUM_FAIL - B_NAMED)); fi
      if [ -s "$B_NAMES_FILE" ] && [ -n "$B_UNNAMED" ]; then
        if [ "$T_UNNAMED" -gt "$B_UNNAMED" ]; then
          L_OUT="$(run_suite)"; L_FAIL="$(count_pf "$L_OUT" fail)"
          L_NAMED="$(fail_names "$L_OUT" | grep -c . || true)"; L_NAMED="$(( ${L_NAMED:-0} + U_EXCL ))"
          if [ -n "$L_FAIL" ] && [ $((L_FAIL - L_NAMED)) -gt "$B_UNNAMED" ]; then
            REG="test file(s) no longer load: unnamed failures $B_UNNAMED -> $T_UNNAMED, $((L_FAIL - L_NAMED)) on a re-run (a file that fails to load hides its failing names and drops its passing tests; pass ${T_PASS:-?})"
            REG_F="$T_FAIL"; REG_P="${T_PASS:-0}"; REG_U="$T_UNNAMED"
          else
            log "$v: unnamed failures rose $B_UNNAMED -> $T_UNNAMED but not on a re-run — flake"
            # Noise is additive, so the lower of the two runs is the deterministic count; storing
            # the flaky one would raise the baseline and hide a later genuine load failure.
            if [ -n "$L_FAIL" ] && [ $((L_FAIL - L_NAMED)) -lt "$T_UNNAMED" ]; then T_UNNAMED=$((L_FAIL - L_NAMED)); [ "$T_UNNAMED" -ge 0 ] || T_UNNAMED=0; fi
          fi
        fi
      fi
      if [ -n "$REG" ]; then
        log "$v: load-error gate — $REG"
      elif [ ! -s "$B_NAMES_FILE" ]; then
        log "$v: test baseline recorded — $T_FAIL fail / ${T_PASS:-?} pass, $(printf '%s' "$T_NAMES" | grep -c . || true) named failing tests (no gate on first observation)"
        tg_write_failnames "$T_NAMES"
        echo "$T_FAIL ${T_PASS:-0} $T_UNNAMED" > "$TEST_BASELINE_DIR/$v"
      elif [ -n "$(comm -23 <(printf '%s\n' "$T_NAMES") <(printf '%s\n' "$B_REF") 2>/dev/null | grep -c . | grep -v '^0$')" ]; then
        # BEST OF TWO: these suites are measurably flaky (development-vessel reported
        # 98 then 103 failures on an identical tree). Noise is additive, so the minimum
        # failure count approximates the deterministic one; a single second sample
        # would fire on that spread, the minimum does not.
        T2_OUT="$(run_suite)"; F2="$(count_pf "$T2_OUT" fail)"; P2="$(count_pf "$T2_OUT" pass)"
        BEST_F="$T_FAIL"; BEST_P="$T_PASS"
        if [ -n "$F2" ] && [ "$F2" -lt "$BEST_F" ]; then BEST_F="$F2"; fi
        if [ -n "$P2" ] && { [ -z "$BEST_P" ] || [ "$P2" -gt "$BEST_P" ]; }; then BEST_P="$P2"; fi
        if [ -n "$F2" ] && [ "$F2" != "$T_FAIL" ]; then
          log "$v: FLAKY suite — $T_FAIL then $F2 fail on identical source; using $BEST_F. Deltas narrower than that spread are not admissible evidence."
        fi
        # CONFIRM ON THE SECOND RUN, AND ONLY ON TESTS THAT FAILED IN BOTH. These suites are
        # measurably flaky, so a name appearing in one run and not the other is noise, not a
        # regression. Intersecting the two runs' newly-failing sets is the set-valued analogue
        # of the old best-of-two minimum.
        T2_NAMES="$(fail_names "$T2_OUT")"
        NEW1="$(comm -23 <(printf '%s\n' "$T_NAMES") <(printf '%s\n' "$B_REF") 2>/dev/null || true)"
        NEW2="$(comm -23 <(printf '%s\n' "$T2_NAMES") <(printf '%s\n' "$B_REF") 2>/dev/null || true)"
        CONFIRMED="$(comm -12 <(printf '%s\n' "$NEW1" | sort -u) <(printf '%s\n' "$NEW2" | sort -u) 2>/dev/null | grep -c . || true)"
        if [ "${CONFIRMED:-0}" -gt 0 ]; then
          # CONFIRM AGAINST A FRESHLY-MEASURED PARENT, NOT ONLY THE STORED SNAPSHOT.
          #
          # Both runs above are at the CANDIDATE, so intersecting them removes per-run flakes but
          # cannot remove the confound between the candidate's conditions and the conditions the
          # stored baseline was recorded under. Observed 2026-08-28: the baseline file was two
          # days old and held 103 names while a fresh run at HEAD produced 97; the single
          # genuinely-new failure belonged to 14e530e (which enabled the docs-align accuracy
          # invariant), yet the gate charged it to e785d13 and refused a commit measured, at the
          # same commit and its parent under identical conditions, to add zero failing tests.
          # A name that already fails at the parent RIGHT NOW is not this commit's regression.
          CONF_SET="$(comm -12 <(printf '%s\n' "$NEW1" | sort -u) <(printf '%s\n' "$NEW2" | sort -u) 2>/dev/null || true)"
          PARENT_REF="$(git -C "$d" rev-parse --verify --quiet "${HEAD}^" 2>/dev/null || true)"
          if [ -n "$PARENT_REF" ]; then
            # BOTH SIDES IN A WORKTREE, NOT ONE OF EACH. Comparing candidate-in-clone against
            # parent-in-worktree would reintroduce the confound in a new place: the two runs sit
            # at different filesystem paths, so a path-dependent test failing only under the
            # worktree would be subtracted from the candidate's set and mask a real regression —
            # a fail-open, the one direction this gate must never take. Measuring both refs the
            # same way is what makes the difference attributable to the commit and nothing else.
            P_OUT="$(run_suite_at "$PARENT_REF" || true)"
            C_OUT="$(run_suite_at "$HEAD" || true)"
            P_PASS="$(count_pf "$P_OUT" pass)"; C_PASS="$(count_pf "$C_OUT" pass)"
            if [ -n "${P_PASS:-}" ] && [ "${P_PASS:-0}" -gt 0 ] && [ -n "${C_PASS:-}" ] && [ "${C_PASS:-0}" -gt 0 ]; then
              P_NAMES="$(fail_names "$P_OUT")"; C_NAMES="$(fail_names "$C_OUT")"
              # INTERSECT with the two-run set, do not replace it. The overlay runs each ref
              # once, so adopting its difference wholesale would discard the flake confirmation
              # already earned above and let a single-run overlay flake read as attributable.
              # A name must now clear BOTH filters: failing in both candidate runs against the
              # stored baseline, AND failing at the candidate but not the parent under identical
              # conditions. Strictly stronger than either test alone.
              OVL_NEW="$(comm -23 <(printf '%s\n' "$C_NAMES" | sort -u) <(printf '%s\n' "$P_NAMES" | sort -u) 2>/dev/null || true)"
              CONF_SET="$(comm -12 <(printf '%s\n' "$CONF_SET" | sort -u) <(printf '%s\n' "$OVL_NEW" | sort -u) 2>/dev/null || true)"
              CONFIRMED="$(printf '%s' "$CONF_SET" | grep -c . || true)"
              log "$v: overlay comparison ${PARENT_REF:0:10} -> ${HEAD:0:10} under identical conditions — $(printf '%s' "$P_NAMES" | grep -c . || true) failing at parent, $(printf '%s' "$C_NAMES" | grep -c . || true) at candidate, ${CONFIRMED:-0} attributable to this commit"
            else
              # UNUSABLE, NOT CLEAN. A run with no passing tests means the measurement failed
              # (missing deps, timeout), not that the tree was healthy. Subtracting on that basis
              # would wave every candidate through, so keep the stored-baseline refusal instead.
              log "$v: overlay re-measure UNUSABLE (parent pass=${P_PASS:-none}, candidate pass=${C_PASS:-none}) — keeping the stored-baseline verdict rather than failing open"
            fi
          fi
        fi
        # A FAILING TEST AN OPEN GAP ALREADY TRACKS IS NOT A REGRESSION (2026-09-30). Check-first landings
        # (activity-api f636900 added a deliberately red check for an open performance gap) were refused
        # here for 3 cycles, and the regression gap they filed invited a lane to "repair" by weakening the
        # check. Names in an open gap's evidence_resolve.only_tests for this vessel are subtracted.
        TRACKED_ONLY=""
        if [ "${CONFIRMED:-0}" -gt 0 ]; then
          TRACKED="$(tracked_fail_names "$v" "$(git -C "$d" diff --name-only "${HEAD}^" "$HEAD" 2>/dev/null || true)")"; TFN_RC=$?
          if [ "$TFN_RC" -eq 2 ]; then
            # A STALE KEY IS NOT A REGRESSION. The gap store refused the node key (401), so whether
            # these failures are tracked is unknown. Refusing would count a refusal and file a
            # regression gap blaming the commit for an environment fault; converging would wave an
            # untracked regression through. Hold: neither, until the store answers. (A gap about the
            # stale key would be written with the same key and refused too: this line is the report.)
            log "$v: credential refused (401) — key stale? the gap store refused the node key, so whether the ${CONFIRMED} newly-failing test(s) at ${HEAD:0:10} are tracked by open gaps is UNKNOWN (environment fault, not a regression) — HOLDING $v this tick: no refusal counted, no regression gap, runtime keeps its current code"
            skipped=$((skipped + 1)); continue
          fi
          if [ -n "$TRACKED" ]; then
            # Exact leaf match (the line ENDS with " > <name>"), at most ONE line per tracked name: a leaf name
            # shared by another test file must not hide that file's real regression (qa, 09-30).
            # A FULL-PATH name ("describe > test") is the whole line after the "(fail) "/"✗ " marker, so it
            # can never end with " > <name>"; it matches only as the entire line (still exact, never substring).
            SUBTRACTED="$(gtr_select tracked "$TRACKED" "${CONF_SET:-}")"
            UNTRACKED="$(gtr_select untracked "$TRACKED" "${CONF_SET:-}")"
            N_LEFT="$(printf '%s' "$UNTRACKED" | grep -c . || true)"
            if [ "${N_LEFT:-0}" -lt "$CONFIRMED" ]; then
              log "$v: $((CONFIRMED - ${N_LEFT:-0})) newly-failing test(s) are tracked by open gaps (evidence_resolve.only_tests), not counted as a regression: $(printf '%s' "$SUBTRACTED" | tr '\n' ';' | cut -c1-400)"
              CONF_SET="$UNTRACKED"; CONFIRMED="${N_LEFT:-0}"
              [ "$CONFIRMED" -eq 0 ] && TRACKED_ONLY=1
            fi
          fi
        fi
        if [ "${CONFIRMED:-0}" -gt 0 ]; then
          FIRST_NEW="$(printf '%s' "${CONF_SET:-}" | grep -m1 . || true)"
          REG="$CONFIRMED test(s) newly failing in both candidate runs and attributable to this commit, e.g. ${FIRST_NEW:-?} (counts: $B_NAMED -> $BEST_F fail)"
          REG_F="$BEST_F"; REG_P="${BEST_P:-0}"; REG_U="$T_UNNAMED"; REG_NAMED=1
        else
          if [ -n "$TRACKED_ONLY" ]; then
            log "$v: every newly-failing test is tracked by an open gap — converging"
          else
            log "$v: newly-failing tests did not reproduce on re-run — flake, converging (run1 $(printf '%s' "$NEW1" | grep -c . || true) new, run2 $(printf '%s' "$NEW2" | grep -c . || true) new, intersection 0)"
          fi
          # UNFREEZE THE BASELINE. The refresh used to live only in the no-newly-failing branch
          # below, so any persistently newly-failing name pinned the stored baseline forever and
          # every later commit was judged against an ever-staler reference. Observed 2026-08-28:
          # the file was two days old (103 names vs 97 on a fresh run) because one docs-align
          # accuracy test kept the gate on this path every tick. When the gate has decided to
          # converge, the tree it converged is the new reference — otherwise the same drift is
          # re-litigated, and re-charged to an innocent commit, on every subsequent tick.
          tg_write_failnames "$T_NAMES"
          echo "$T_FAIL ${T_PASS:-0} $T_UNNAMED" > "$TEST_BASELINE_DIR/$v"
        fi
      else
        # No newly-failing test. Re-baseline whenever the SET changed at all, so a suite that
        # grows or whose flakes settle does not carry a stale reference forward — the failure
        # mode that wedged this gate in the first place.
        if [ "$(tg_minus_outstanding "$T_NAMES")" != "$(grep . "$B_NAMES_FILE" 2>/dev/null)" ]; then
          log "$v: no newly-failing test; refreshing baseline ($B_NAMED -> $T_NAMED named failing; $T_FAIL fail in the summary)"
          tg_write_failnames "$T_NAMES"
          echo "$T_FAIL ${T_PASS:-0} $T_UNNAMED" > "$TEST_BASELINE_DIR/$v"
        fi
      fi
    fi
  fi
  if [ -n "$REG" ]; then
    RC_FILE="$MARKER_DIR/$v.testgate-refusals"
    RC="$(cat "$RC_FILE" 2>/dev/null || echo 0)"; case "$RC" in ''|*[!0-9]*) RC=0 ;; esac
    RC=$((RC + 1)); echo "$RC" > "$RC_FILE" 2>/dev/null || true
    # A TEST-ONLY RANGE NEVER TAKES THE STARVATION BREAK (2026-10-02). The break exists because
    # indefinite staleness of RUNTIME code is the worse failure. A range that changes only tests
    # (last-good pin .. HEAD, test_only_range) leaves the unit's code byte-identical, so refusing
    # it costs no staleness at all — and breaking would deploy nothing but the regression's
    # absorption. It is refused for as long as it regresses. Uncomputable -> not test-only.
    TG_PREV_GOOD="$(cat "${LAST_GOOD_DIR:-/nonexistent}/$v" 2>/dev/null || true)"
    TG_TESTONLY=""
    test_only_range "$d" "$TG_PREV_GOOD" "$HEAD" && TG_TESTONLY=1
    if [ -n "$TG_TESTONLY" ]; then
      emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-test-regression-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync test gate: $v at ${HEAD:0:10} regressed its own suite ($REG), confirmed on a second run. The range ${TG_PREV_GOOD:0:10}..${HEAD:0:10} changes only tests, so it is refused until repaired (refusal $RC); the starvation break never applies to a test-only range, which changes no runtime code.\",\"status\":\"open\"}}}}"
      log "$v: TEST REGRESSION at ${HEAD:0:10} ($REG) — REFUSING to converge (refusal $RC; ${TG_PREV_GOOD:0:10}..${HEAD:0:10} is test-only, so no starvation break); runtime keeps running its current code"
      skipped=$((skipped + 1)); continue
    fi
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-test-regression-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync test gate: $v at ${HEAD:0:10} regressed its own suite ($REG), confirmed on a second run. Refusal $RC of ${TEST_GATE_MAX_REFUSALS:-3}; the runtime stays on the code it is already running until this is repaired or the refusal bound is reached.\",\"status\":\"open\"}}}}"
    if [ "$RC" -le "${TEST_GATE_MAX_REFUSALS:-3}" ]; then
      log "$v: TEST REGRESSION at ${HEAD:0:10} ($REG) — REFUSING to converge ($RC/${TEST_GATE_MAX_REFUSALS:-3}); runtime keeps running its current code"
      skipped=$((skipped + 1)); continue
    fi
    # THE BREAK DEPLOYS; IT DOES NOT FORGIVE. Converging past a confirmed regression is the
    # lesser evil for runtime code, but the regressed names are NOT written into failnames (that
    # was the old D1 fix, and it made the gate permanently blind to the regression it had just
    # let through, with only a "baseline degraded" gap to show for it). They are held in
    # $v.outstanding: failnames stays the pre-regression baseline, later commits are not
    # re-charged for names already live (the D1 starvation it fixed stays fixed), every gated
    # tick re-reports them and re-emits their gap, and they clear only when they pass again.
    # The count file still records the observed counts; its unnamed field is what the
    # load-error gate reads.
    echo "$REG_F $REG_P ${REG_U:-}" > "$TEST_BASELINE_DIR/$v"
    if [ -n "$REG_NAMED" ] && [ -n "$(printf '%s' "${CONF_SET:-}" | grep . || true)" ]; then
      { cat "$OUT_FILE" 2>/dev/null; printf '%s\n' "$CONF_SET"; } | grep . | sort -u > "$OUT_FILE.tmp" && mv "$OUT_FILE.tmp" "$OUT_FILE"
      log "$v: TEST-GATE STARVATION BREAK — refused $RC consecutive runs at ${HEAD:0:10} ($REG); indefinite staleness is the worse failure, converging anyway. The regressed test(s) are held OUTSTANDING, not written into the baseline: $(printf '%s' "$CONF_SET" | tr '\n' ';' | cut -c1-400)"
      tg_emit_outstanding "$(cat "$OUT_FILE")"
    else
      # A load regression (unnamed count) has no names to hold outstanding; unchanged behaviour.
      log "$v: TEST-GATE STARVATION BREAK — refused $RC consecutive runs at ${HEAD:0:10} ($REG); indefinite staleness is the worse failure, converging anyway and accepting $REG_F fail/$REG_P pass as the new baseline"
      tg_write_failnames "${T_NAMES:-}"
      emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-testgate-baseline-degraded-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync test gate accepted a DEGRADED baseline for $v ($REG) after $RC refusals. The gate is now blind to this regression until the suite is repaired and the baseline lowered.\",\"status\":\"open\"}}}}"
    fi
  fi
  rm -f "$MARKER_DIR/$v.testgate-refusals" 2>/dev/null || true

  PREV_GOOD="$(cat "$LAST_GOOD_DIR/$v" 2>/dev/null || true)"
  # THE LIVE TREE IS NOT WHAT PULL-SYNC LAST PUT THERE: copy it aside before the
  # mirror overwrites it (see drift_quarantine). "Put there" is the last attempted
  # clone hash ($v.sha) or the hash recorded after the last mirror/revert
  # ($v.runtime-sha). This covers the drift heal and an ordinary advance that
  # lands on top of hand-deployed content alike. A first run (no marker) is the
  # image-baked tree and stays quiet. The copy failing means NO overwrite.
  DQ_WROTE="$(cat "$MARKER_DIR/$v.runtime-sha" 2>/dev/null || true)"
  if [ -n "${LAST:-}" ] && [ "$RUNTIME_HASH" != none ] && [ "$RUNTIME_HASH" != "$LAST" ] && [ "$RUNTIME_HASH" != "$DQ_WROTE" ]; then
    if ! drift_quarantine "$v"; then
      log "$v: live content ${RUNTIME_HASH:0:10} is not what pull-sync last wrote, and quarantining it failed ($DQ_WHY) — NOT overwriting it"
      emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-drift-quarantine-failed-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync would have overwritten live content under $RUNTIME_DIR/$v (content $RUNTIME_HASH, not a tree pull-sync wrote) with the clone (content $CLONE_HASH, git $HEAD), but could not copy it aside ($DQ_WHY), so it refused the overwrite. $v is held off the clone until the copy succeeds or the live tree is reconciled by hand.\",\"status\":\"open\"}}}}"
      failed=$((failed+1)); continue
    fi
    log "$v: live content ${RUNTIME_HASH:0:10} is not what pull-sync last wrote — QUARANTINED to $DQ_PATH before overwriting it with the clone (${CLONE_HASH:0:10}, git ${HEAD:0:10})"
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-drift-quarantined-$v\",\"category\":\"source_divergence\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync overwrote live content under $RUNTIME_DIR/$v that it had not written (live content $RUNTIME_HASH) with the clone (content $CLONE_HASH, git $HEAD). The live tree was copied first to $DQ_PATH. If it held a change newer than origin (a hand deploy that was never pushed), recover it from there and land it through git; if it was a stray draft, nothing is lost.\",\"classification_metadata\":{\"vessel\":\"$v\",\"quarantine_path\":\"$DQ_PATH\",\"runtime_hash\":\"$RUNTIME_HASH\",\"clone_hash\":\"$CLONE_HASH\",\"clone_head\":\"$HEAD\"},\"status\":\"open\"}}}}"
  fi
  # Taken BEFORE the mirror: what the running unit's non-test code is, vs the clone's.
  RUNTIME_NONTEST="$(content_hash_nontest "$RUNTIME_DIR/$v")"; CLONE_NONTEST="$(content_hash_nontest "$d")"
  log "$v: content ${RUNTIME_HASH:0:10} -> ${CLONE_HASH:0:10} (git ${HEAD:0:10}) — mirroring into $RUNTIME_DIR"
  # Gated: the ACCEPTED mirror-to-live, never /usr/local/bin's (the literal stays for the slice tests).
  if ! { if [ -n "${PULLSYNC_ACCEPTED_DIR:-}" ]; then bash "$MIRROR_BIN" "$v" "$CLONE_DIR"; else /usr/local/bin/mirror-to-live "$v" "$CLONE_DIR"; fi; }; then
    log "$v: mirror failed — skipping"; failed=$((failed+1)); continue
  fi
  echo "$CLONE_HASH" > "$MARKER"
  # Record what is MEASURABLY live, not what was meant to land: a mirror that exits 0
  # but does not fully land would otherwise read as foreign content next tick and be
  # quarantined and gapped as someone else's write when it is pull-sync's own partial one.
  _rt_after="$(content_hash "$RUNTIME_DIR/$v" "$d")"
  [ "$_rt_after" = "$CLONE_HASH" ] || log "$v: mirror exited 0 but live (${_rt_after:0:10}) != clone (${CLONE_HASH:0:10})"
  echo "$_rt_after" > "$MARKER_DIR/$v.runtime-sha" 2>/dev/null || true
  rm -f "$MARKER_DIR/$v.reverted" 2>/dev/null || true

  # 2c. Shared-package fan-out. A mirrored clone with NO unit of its own but a
  # build step that OTHER runtime vessels file:-dep (e.g. @avigopal/ias-executor-ts,
  # imported as its BUILT dist via absolute per-file symlinks in each consumer's
  # node_modules). Mirroring src alone leaves consumers on a stale dist. Build to a
  # STAGING dir and verify BEFORE any swap (a bad build touches no consumer), atomic-
  # swap dist (consumer symlinks are absolute, so this propagates by reference), then
  # restart each consumer staggered + health-gated; any consumer unhealthy restores the
  # prior dist, restarts the already-bounced consumers, emits a gap and HALTS. Reuses
  # vessel_unit/health_port/healthy/STAGGER_SECONDS/LAST_GOOD_DIR/emit_gap. Generic:
  # consumers are discovered at use-time (no hardcoded package/consumer list).
  # Once credited, the build is also carried into the package's CLONE dist and its
  # file: dependants in $CLONE_DIR are refreshed (refresh_clone_dependants): those
  # resolve the clone, not /vessels, and are what feature_compose drafts against.
  SELF_UNIT="$(vessel_unit "$v")"
  if { [ -z "$SELF_UNIT" ] || [ "${SELF_UNIT%.service}" = "$SELF_UNIT" ]; } \
     && [ -d "$RUNTIME_DIR/$v/dist" ] \
     && grep -q '"build"[[:space:]]*:' "$RUNTIME_DIR/$v/package.json" 2>/dev/null; then
    CONSUMERS="$(grep -lE "file:[^\"]*/$v\"" "$RUNTIME_DIR"/*/package.json 2>/dev/null | xargs -r -n1 dirname | xargs -r -n1 basename | grep -vx "$v" || true)"
    if [ -n "$CONSUMERS" ]; then
      log "$v: shared package changed -- rebuilding dist for consumers: $(echo $CONSUMERS | tr '\n' ' ')"
      # THE DEPENDENCY BOUNCE HONOURS THE SAME IN-FLIGHT QUIESCE AS A VESSEL'S OWN RESTART.
      #
      # The loop below restarts every consumer, and the consumers serve each other's work:
      # a compose on development-vessel runs its suite through local-tools-vessel, so
      # bouncing EITHER loses it. Measured: a compose died when this fan-out restarted
      # local-tools-vessel and then development-vessel under a young in-flight request
      # ("1 request(s) ... not waited for"; no trace, no lesson), while a vessel's own
      # convergence restart would have deferred on the same /health. So ask every active
      # consumer with the shared restart_age_defer (same ceiling, same count bound) BEFORE
      # the build and the swap (a symlinked consumer sees the swap by reference): if any
      # is busy, bounce none this tick.
      #
      # THE BOUNCE STAYS OWED WITHOUT A MARKER: LAST_GOOD is not written, so DIST_RETRY
      # (top of loop) re-enters this fan-out on the next tick. COST, not correctness: that
      # retry re-runs this package's test gate each deferred tick, which spends gate budget.
      #
      # BOUNDED BY AGE AND BY TICKS. "Defer all if any consumer is busy" must not postpone
      # a dependency rollout forever: a fleet whose consumers take turns being busy has no
      # idle tick. Once the first deferral is older than pull_sync.bounce_defer_max_seconds
      # OR has repeated pull_sync.bounce_defer_max_ticks times, the bounce proceeds,
      # logs FORCED-AFTER-DEFER, and files (or bumps) ONE gap with a stable id. Both bounds
      # are shaped tuning rows read at use time (tuning_param), not env constants.
      BQ_FILE="$MARKER_DIR/$v.bounce-deferrals"; BQ_SINCE_FILE="$MARKER_DIR/$v.bounce-deferred-since"
      BQ_N="$(cat "$BQ_FILE" 2>/dev/null || echo 0)"; case "$BQ_N" in ''|*[!0-9]*) BQ_N=0 ;; esac
      BQ_SINCE="$(cat "$BQ_SINCE_FILE" 2>/dev/null || true)"; case "$BQ_SINCE" in ''|*[!0-9]*) BQ_SINCE="" ;; esac
      BQ_BUSY=""; BQ_WHY=""; BQ_PROBE=0
      for c in $CONSUMERS; do
        CU="$(vessel_unit "$c")"; CP="$(health_port "$c")"
        [ -n "$CU" ] && [ "${CU%.service}" != "$CU" ] && [ -n "$CP" ] || continue
        systemctl is-active "$CU" >/dev/null 2>&1 || continue
        restart_age_defer "$CP" "$BQ_N"
        [ -n "$RA_WHY" ] && log "$v: consumer $c — $RA_WHY"
        [ "$RA_DEFER" = 1 ] && { BQ_BUSY="$BQ_BUSY $c"; BQ_WHY="${BQ_WHY:+$BQ_WHY; }$c: $RA_WHY"; }
        [ "$RA_PROBE" = 1 ] && BQ_PROBE=1
      done
      if [ -n "$BQ_BUSY" ]; then
        tuning_param pull_sync.bounce_defer_max_ticks 6; BQ_MAX_TICKS="$TP_VALUE"
        tuning_param pull_sync.bounce_defer_max_seconds 5400; BQ_MAX_S="$TP_VALUE"
        BQ_AGE=0; [ -n "$BQ_SINCE" ] && BQ_AGE=$(( $(date +%s) - BQ_SINCE ))
        # An open probe window is not a busy consumer: it never counts toward FORCED-AFTER-DEFER.
        if [ "$BQ_PROBE" != 1 ] && { [ "$BQ_N" -ge "$BQ_MAX_TICKS" ] || { [ -n "$BQ_SINCE" ] && [ "$BQ_AGE" -ge "$BQ_MAX_S" ]; }; }; then
          log "$v: dependency bounce FORCED-AFTER-DEFER — deferred $BQ_N tick(s) over ${BQ_AGE}s (bounds ${BQ_MAX_TICKS} ticks / ${BQ_MAX_S}s); bouncing anyway, in-flight work on$BQ_BUSY may be lost ($BQ_WHY)"
          printf '{"at":"%s","actor":"pull-sync","action":"forced_dependency_bounce","vessel":"%s","busy":"%s","deferrals":%s,"age_s":%s}\n' \
            "$(date -Iseconds)" "$v" "${BQ_BUSY# }" "$BQ_N" "$BQ_AGE" >> "$DEFERRAL_LOG" 2>/dev/null || true
          emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-bounce-forced-$v\",\"category\":\"convergence_deferral\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync forced the $v dependency bounce after deferring it $BQ_N tick(s) over ${BQ_AGE}s because consumers$BQ_BUSY always had young in-flight work; in-flight work may have been lost. A fleet with no idle tick needs a drain that does not depend on one.\",\"status\":\"open\"}}}}"
        else
          [ -n "$BQ_SINCE" ] || date +%s > "$BQ_SINCE_FILE" 2>/dev/null || true
          echo "$((BQ_N + 1))" > "$BQ_FILE" 2>/dev/null || true
          log "$v: DEFERRING dependency bounce of$(echo " "$CONSUMERS | tr '\n' ' ') — in flight on$BQ_BUSY ($BQ_WHY); bounce recorded as PENDING (last-good withheld) and will be taken on a later tick ($((BQ_N + 1))/${BQ_MAX_TICKS})"
          printf '{"at":"%s","actor":"pull-sync","action":"deferred_dependency_bounce_inflight","vessel":"%s","busy":"%s","deferral":%s}\n' \
            "$(date -Iseconds)" "$v" "${BQ_BUSY# }" "$((BQ_N + 1))" >> "$DEFERRAL_LOG" 2>/dev/null || true
          deferred=$((deferred+1)); continue
        fi
      fi
      rm -f "$BQ_FILE" "$BQ_SINCE_FILE" 2>/dev/null || true
      STAGE="$RUNTIME_DIR/$v/.dist.stage"; rm -rf "$STAGE"
      # A package whose tsconfig.build.json is declarations-only (cpg-inference-ts: `bun build`
      # emits the JS, tsc only the .d.ts) can never yield index.js from tsc alone, so this check
      # failed every tick and the package never converged. Fall back to the package's OWN build
      # script, run in a scratch copy so its hardcoded `dist` output never touches the live dist.
      (cd "$RUNTIME_DIR/$v" && /root/.bun/bin/bun run tsc --project tsconfig.build.json --outDir "$STAGE") || true
      if [ ! -s "$STAGE/index.js" ]; then
        BUILD_TMP="$RUNTIME_DIR/$v/.build.tmp"; rm -rf "$BUILD_TMP" "$STAGE"; mkdir -p "$BUILD_TMP"
        (cd "$RUNTIME_DIR/$v" && tar --exclude=./node_modules --exclude=./dist --exclude=./.dist.stage --exclude=./.dist.prev --exclude=./.build.tmp -cf - .) | (cd "$BUILD_TMP" && tar -xf -) \
          && ln -s "$RUNTIME_DIR/$v/node_modules" "$BUILD_TMP/node_modules" \
          && (cd "$BUILD_TMP" && PATH="/root/.bun/bin:$PATH" /root/.bun/bin/bun run build) && mv "$BUILD_TMP/dist" "$STAGE" || true
        rm -rf "$BUILD_TMP"
      fi
      if [ ! -s "$STAGE/index.js" ]; then
        log "$v: BUILD FAILED -- keeping live dist, no consumer touched"; rm -rf "$STAGE"
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-build-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$v build failed at ${HEAD:0:10}; live dist kept, no consumer touched\",\"status\":\"open\"}}}}"
        failed=$((failed+1)); continue
      fi
      rm -rf "$RUNTIME_DIR/$v/.dist.prev"; mv "$RUNTIME_DIR/$v/dist" "$RUNTIME_DIR/$v/.dist.prev"; mv "$STAGE" "$RUNTIME_DIR/$v/dist"

      # PROPAGATE BY CONTENT, NOT BY ASSUMPTION.
      #
      # The swap above is only visible to a consumer whose node_modules copy is a
      # SYMLINK into this dist. That was assumed of every consumer and was true of
      # exactly one. Measured 2026-08-16, @avigopal/ias-executor-ts:
      #
      #   development-vessel   realfiles=0    symlinks=164   <- propagated
      #   ribosome-vessel      realfiles=164  symlinks=0     <- frozen at 08-05
      #   goal-host-vessel / analysis-vessel / llm-resolver-vessel / local-tools-vessel
      #                        realfiles=164  symlinks=0     <- frozen at 08-05
      #
      # For the five real-file consumers the swap was a no-op, the bounce restarted
      # them onto identical bytes, and every health check passed — so the run logged
      # "fan-out healthy", wrote LAST_GOOD=$HEAD, and thereby also disarmed the
      # dist-freshness retry that exists to catch exactly this. Eleven days of
      # ias-executor-ts changes were inert in the vessel that MINTS activity
      # templates; a rule added to ribosome-extract.json never reached a single mint.
      #
      # Health cannot witness this: a consumer running stale code is perfectly
      # healthy. So copy dist into any consumer that does not resolve to it, and
      # verify by content below before crediting the fan-out.
      for c in $CONSUMERS; do
        CPKG="$(grep -lE "file:[^\"]*/$v\"" "$RUNTIME_DIR/$c/package.json" 2>/dev/null >/dev/null \
                && sed -nE 's/.*"([^"]+)"[[:space:]]*:[[:space:]]*"file:[^"]*\/'"$v"'".*/\1/p' "$RUNTIME_DIR/$c/package.json" | head -1)"
        [ -n "$CPKG" ] || continue
        CDIST="$RUNTIME_DIR/$c/node_modules/$CPKG/dist"
        [ -d "$CDIST" ] || continue
        # A symlinked consumer already sees the new dist by reference; leave its
        # layout alone. A real-file consumer gets the new bytes copied in, matching
        # the layout it already has rather than converting it.
        if [ ! -L "$CDIST/index.js" ]; then
          log "$v: consumer $c holds a REAL-FILE dist — copying new build in (swap alone is invisible to it)"
          rm -rf "$CDIST" && cp -a "$RUNTIME_DIR/$v/dist" "$CDIST" || { bad="$c"; break; }
        fi
      done

      BOUNCED=""; bad="${bad:-}"
      for c in $CONSUMERS; do
        [ -z "$bad" ] || break   # a failed dist copy goes straight to the revert path below
        CU="$(vessel_unit "$c")"; CP="$(health_port "$c")"
        [ -n "$CU" ] && [ "${CU%.service}" != "$CU" ] || continue
        systemctl is-active "$CU" >/dev/null 2>&1 || continue
        restart_breadcrumb "$c" "dependency bounce after $v converged"; systemctl restart "$CU" 2>/dev/null || true; BOUNCED="$BOUNCED $c"; sleep "$STAGGER_SECONDS"
        if [ -n "$CP" ]; then ok=0; for _ in 1 2 3 4 5; do healthy "$CP" && { ok=1; break; }; sleep 4; done; [ "$ok" = 1 ] || { bad="$c"; break; }; fi
      done
      if [ -n "$bad" ]; then
        log "$v: consumer $bad UNHEALTHY after fan-out -- restoring prior dist, restarting bounced, HALTING"
        rm -rf "$RUNTIME_DIR/$v/dist"; mv "$RUNTIME_DIR/$v/.dist.prev" "$RUNTIME_DIR/$v/dist"
        for c in $BOUNCED; do restart_breadcrumb "$c" "dependency re-bounce after $v converged"; systemctl restart "$(vessel_unit "$c")" 2>/dev/null || true; done
        echo "$HEAD" > "$MARKER_DIR/$v.fanout-fail"  # suppress fan-out retry for this HEAD; a new src change (new HEAD) clears it — prevents a rebuild/revert loop on a persistently-unhealthy consumer
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-fanout-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$v fan-out to ${HEAD:0:10} left $bad unhealthy; dist reverted, run halted\",\"status\":\"open\"}}}}"
        failed=$((failed+1)); break
      fi
      # CREDIT THE FAN-OUT ONLY IF THE BYTES ACTUALLY ARRIVED.
      #
      # LAST_GOOD is what suppresses the dist-freshness retry, so writing it on a
      # health pass alone is what made the eleven-day staleness self-sustaining:
      # the one mechanism built to notice a stale dist was disarmed by the run that
      # left it stale. Verify the shipped artifact at each consumer against the
      # shared build and withhold the marker on any mismatch, so the next tick
      # re-enters the fan-out instead of skipping it.
      SHARED_SUM="$(md5sum "$RUNTIME_DIR/$v/dist/index.js" 2>/dev/null | cut -d' ' -f1)"
      UNPROP=""
      for c in $CONSUMERS; do
        CPKG="$(sed -nE 's/.*"([^"]+)"[[:space:]]*:[[:space:]]*"file:[^"]*\/'"$v"'".*/\1/p' "$RUNTIME_DIR/$c/package.json" 2>/dev/null | head -1)"
        [ -n "$CPKG" ] || continue
        CIDX="$RUNTIME_DIR/$c/node_modules/$CPKG/dist/index.js"
        [ -e "$CIDX" ] || continue
        [ "$(md5sum "$CIDX" 2>/dev/null | cut -d' ' -f1)" = "$SHARED_SUM" ] || UNPROP="$UNPROP $c"
      done
      if [ -n "$UNPROP" ]; then
        log "$v: FAN-OUT UNPROPAGATED to$UNPROP — healthy but running OLD code; withholding last-good so the next tick retries"
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-unpropagated-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$v fan-out at ${HEAD:0:10} left consumers$UNPROP resolving a stale dist while reporting healthy; a built artifact that no consumer resolves is inert, and health cannot witness it\",\"status\":\"open\"}}}}"
        failed=$((failed+1)); continue
      fi
      rm -rf "$RUNTIME_DIR/$v/.dist.prev"; echo "$HEAD" > "$LAST_GOOD_DIR/$v"; rm -f "$MARKER_DIR/$v.fanout-fail"; log "$v: fan-out healthy AND propagated across$BOUNCED"
      refresh_clone_dependants "$v" "$d"   # the compose clones' file: dependants resolve the clone, not /vessels: carry the credited build there too
      synced=$((synced+1)); continue
    fi
  fi

  # 3. Restart + health-gate (only for active long-running units).
  UNIT="$(vessel_unit "$v")"
  # A vessel whose INVENTORY unit is a .timer can still run a long-lived
  # <vessel>.service alongside it. The .service-only guard below tests
  # "${UNIT%.service}" != "$UNIT", which is FALSE for a .timer, so the whole
  # restart block was skipped: the source was mirrored and the running process
  # never reloaded it. Observed on boredom-vessel — inventory unit
  # boredom-vessel.timer, boredom-vessel.service active since the previous day
  # with NRestarts=0, serving 25-hour-old code while pull-sync reported it
  # synced. A landed fix that never executes is indistinguishable from no fix.
  # Exactly one vessel in the current inventory matches (measured), so this
  # prefers the active long-running service only where one genuinely exists.
  case "$UNIT" in
    *.service) ;;
    *) if systemctl is-active "$v.service" >/dev/null 2>&1; then
         log "$v: inventory unit $UNIT is not a service, but $v.service is active — restarting it so the mirrored source takes effect"
         UNIT="$v.service"
       fi ;;
  esac
  PORT="$(health_port "$v")"

  # DETECTOR: MASKED **AND RUNNING** IS A LATENT UNRECOVERABLE OUTAGE.
  #
  # Masked-and-inactive is normal — apply-inventory masks what a role excludes, and the
  # suppression above depends on it. Masked WHILE ACTIVE is the dangerous state: the unit
  # serves traffic, `is-active` reports active, and yet it cannot be restarted, cannot be
  # recovered by `Restart=on-failure`, and cannot receive new code. It looks healthiest
  # precisely when it is least recoverable.
  #
  # Found by hand FOUR times (2026-08-15 x3, 2026-08-17 activity-api, MainPID 1094541,
  # masked and up since 06:23). Each instance cost a manual diagnosis because nothing
  # asserted the conjunction — every existing check reads one half or the other.
  # This is the detector those four instances kept not producing.
  #
  # BOTH mask forms are matched. A NEGATIVE CONTROL run before committing this — masking a
  # live unit with `--runtime` and re-checking — showed `is-enabled` returns
  # `masked-runtime`, not `masked`, so a predicate testing only `= masked` would have
  # reported clean on exactly the transient case an operator is most likely to create by
  # hand. That is the vacuous-check class this session has hit four times; here the control
  # caught it before the detector shipped rather than after it lied.
  # MASKED + FAILED IS THE SAME PATHOLOGY, and my first version of this check missed it.
  # Measured 2026-08-17: surrealdb.service was OOM-killed at 14:19:58 with NRestarts=0 and
  # never came back, because a masked unit cannot be restarted by Restart=on-failure. The
  # local store stayed dead for 5.5 hours; activity-api answered 503 the whole time and its
  # test suite hung forever on connections to it, wedging every convergence tick.
  # A check that only looked at masked+ACTIVE reported clean throughout. Masked is dangerous
  # whenever the unit is not cleanly inactive — running (cannot be updated) or failed (cannot
  # be revived) are both states nothing can get out of.
  UNIT_ACTIVE_STATE="$(systemctl is-active "$UNIT" 2>/dev/null || true)"
  if [ -n "$UNIT" ] && [ "${UNIT%.service}" != "$UNIT" ] \
     && case "$UNIT_ACTIVE_STATE" in active|activating|failed) true ;; *) false ;; esac \
     && case "$(systemctl is-enabled "$UNIT" 2>/dev/null)" in masked|masked-runtime) true ;; *) false ;; esac; then
    MP="$(systemctl show "$UNIT" -p MainPID --value 2>/dev/null || echo '?')"
    log "$v: !!! MASKED AND $UNIT_ACTIVE_STATE — $UNIT is masked (MainPID $MP); it cannot be restarted, recovered, or updated"
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"unit-masked-while-active-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"Repair needed: $UNIT is MASKED and in state ${UNIT_ACTIVE_STATE} (MainPID $MP). A masked unit cannot be restarted, cannot be recovered by Restart=on-failure, and cannot receive converged code, so this process is serving traffic that no mechanism can update or revive — while is-active reports it healthy. Repair the capability by unmasking it if this deployment should run it (the running process is untouched by unmask), or by stopping it if the role excludes it.\",\"status\":\"open\"}}}}"
  fi

  # The mirror and the suite gate above ran as for any commit; only the restart is
  # skipped, and only when ALL hold: the pre-mirror runtime's non-test content equals
  # the clone's (the unit already runs this code — the pin alone can't say so after
  # an image rebuild), no restart is owed, and PREV_GOOD..HEAD is test-only.
  # Anything uncomputable fails toward restart.
  if [ -n "$UNIT" ] && [ "${UNIT%.service}" != "$UNIT" ] && systemctl is-active "$UNIT" >/dev/null 2>&1 \
     && ! { [ "$RUNTIME_NONTEST" != none ] && [ "$RUNTIME_NONTEST" = "$CLONE_NONTEST" ] \
            && [ ! -e "$MARKER_DIR/$v.restart-pending" ] \
            && test_only_range "$d" "$PREV_GOOD" "$HEAD" \
            && log "$v: restart SKIPPED — ${PREV_GOOD:0:10}..${HEAD:0:10} is test-only (mirrored; $UNIT keeps running identical non-test code)"; }; then
    # IN-FLIGHT WORK ON THE ORCHESTRATING VESSEL DEFERS ITS RESTART.
    #
    # The authoring markers above protect the vessel being EDITED. Nothing
    # protected the vessel RUNNING the walk. goal-host publishes `in_flight` on
    # /health, and pull-sync never read it: converging on a ~10 min timer while a
    # feature_compose draft against a large file takes longer killed the dispatch
    # outright. Measured repeatedly — correctly-routed edit goals died
    # `interrupted:none` with nothing landed and no trace worth grading.
    #
    # BOUNDED, because a permanently-busy vessel must not freeze convergence:
    # after RESTART_DEFER_MAX consecutive deferrals the restart proceeds and says
    # so. The counter resets whenever the vessel is idle or is actually restarted.
    RESTART_DEFER_MAX="${RESTART_DEFER_MAX:-3}"
    DEFER_FILE="$MARKER_DIR/$v.restart-deferrals"
    DEFERRED_N="$(cat "$DEFER_FILE" 2>/dev/null || echo 0)"
    case "$DEFERRED_N" in ''|*[!0-9]*) DEFERRED_N=0 ;; esac
    [ -n "${Q_HELD:-}" ] && { : > "$Q_HELD" 2>/dev/null || true; }   # keep the held marker fresh past a long gate
    restart_age_defer "$PORT" "$DEFERRED_N"; INFLIGHT="$RA_INFLIGHT"
    # The quiesce above already gave up on the run it could not drain ("converging anyway"):
    # deferring now would strand the restart behind that same run. A probe window still holds.
    # UNLESS THAT RUN IS STILL PROGRESSING: then the tick budget ran out, not the compose. Hold instead —
    # the restart is owed (deferral below), and admission stays closed across ticks (Q_CARRY, see
    # quiesce_release) so no new work enters; the owed path ends the hold on drain, on silence past
    # pull_sync.stall_seconds, or LOSSY at pull_sync.owed_restart_max_hold_seconds (owed_hold_bound).
    # A vessel that publishes no progress keeps today's converge-anyway.
    if [ -n "${Q_BOUND:-}" ] && [ "$RA_DEFER" = 1 ] && [ "$RA_PROBE" != 1 ]; then
      if [ "${RA_FRESH:-0}" = 1 ]; then
        if ! owed_hold_bound "$v"; then
          Q_CARRY="$Q_HELD"; echo "$Q_HELD" > "$MARKER_DIR/$v.quiesce-carry" 2>/dev/null || true
          RA_WHY="quiesce bound reached this tick, but the compose is progressing ($RA_WHY) — holding admission closed across ticks instead of restarting into it"
        fi
      else
        RA_DEFER=0; RA_WHY="quiesce bound reached this tick, $RA_WHY — restarting as the quiesce announced"
      fi
    fi
    if [ "$RA_DEFER" = 1 ]; then
      # A progress hold (past-ceiling progress, or a carried quiesce hold) does not count toward
      # RESTART_DEFER_MAX, as on the owed path.
      { [ "${RA_PROGRESSING:-0}" = 1 ] || [ -n "${Q_CARRY:-}" ]; } || echo "$((DEFERRED_N + 1))" > "$DEFER_FILE" 2>/dev/null || true
      # RECORD THAT A RESTART IS OWED. Without this the deferral is permanent, and
      # the log line below is a lie. The content marker was already written at the
      # mirror step, and the top-of-loop short-circuit compares CLONE_HASH to
      # RUNTIME_HASH — which are EQUAL the moment the mirror succeeds. So on every
      # later tick this vessel is skipped before it can reach this block: the
      # deferral counter never increments again, RESTART_DEFER_MAX is unreachable,
      # and "takes effect on the next tick" never happens.
      #
      # Measured: goal-host-vessel served code from 2026-08-19 01:54:10 while the
      # mirrored file on disk was 23 hours newer (2026-08-20 01:13:54), with
      # NRestarts=0, ActiveState=active and /health 200 — every signal green while
      # the fixes it was supposed to load sat unread. The deferral counter was
      # frozen at 1 of 3 and three later ticks said nothing about the vessel.
      echo "$CLONE_HASH" > "$MARKER_DIR/$v.restart-pending" 2>/dev/null || true
      [ -s "$MARKER_DIR/$v.restart-owed-since" ] || date +%s > "$MARKER_DIR/$v.restart-owed-since" 2>/dev/null || true
      log "$v: DEFERRING restart — $RA_WHY; restart recorded as PENDING and will be taken on a later tick"
      printf '{"at":"%s","actor":"pull-sync","action":"deferred_restart_inflight","vessel":"%s","in_flight":%s,"deferral":%s}\n' \
        "$(date -Iseconds)" "$v" "$INFLIGHT" "$((DEFERRED_N + 1))" >> "$DEFERRAL_LOG" 2>/dev/null || true
      deferred=$((deferred+1)); continue
    fi
    [ -n "$RA_WHY" ] && log "$v: restarting — $RA_WHY"
    rm -f "$DEFER_FILE" 2>/dev/null || true
    rm -f "$MARKER_DIR/$v.restart-pending" "$MARKER_DIR/$v.restart-owed-since" 2>/dev/null || true
    restart_breadcrumb "$v" "converged to origin/dev${RA_OLDEST:+ (oldest in-flight ${RA_OLDEST}ms)}" "$INFLIGHT"
    systemctl restart "$UNIT" 2>/dev/null || true
    Q_CARRY=""; quiesce_release   # the new process must find admission open, a carried hold included
    sleep "$STAGGER_SECONDS"
    if [ -n "$PORT" ]; then
      ok=0
      for _ in 1 2 3 4 5; do healthy "$PORT" && { ok=1; break; }; sleep 4; done
      if [ "$ok" = 0 ]; then
        log "$v: UNHEALTHY after mirror+restart — reverting to last-good ${PREV_GOOD:0:10} and HALTING run"
        # THE REVERT IS AN INPUT TO THE MIRROR, AND ITS RESULT IS MEASURED. This used to
        # `checkout PREV_GOOD -- .` in the clone and call mirror-to-live, whose first act
        # is `reset --hard HEAD`: the checkout was discarded, HEAD (the unhealthy code)
        # re-mirrored, and this log and the gap below both said "reverted". Now the
        # mirror materialises PREV_GOOD itself (the clone never leaves $BRANCH), and the
        # revert counts only if the live content hashes to PREV_GOOD's tree.
        REVERT_OK=0; REVERT_WHY=""; REVERT_HEALTH=""
        if [ -z "$PREV_GOOD" ]; then
          REVERT_WHY="no last-good pin recorded"
        elif ! { if [ -n "${PULLSYNC_ACCEPTED_DIR:-}" ]; then bash "$MIRROR_BIN" "$v" "$CLONE_DIR" "$PREV_GOOD" "$PREV_GOOD"; else /usr/local/bin/mirror-to-live "$v" "$CLONE_DIR" "$PREV_GOOD" "$PREV_GOOD"; fi; }; then
          REVERT_WHY="mirror-to-live of ${PREV_GOOD:0:10} failed"
        elif ! revert_target_hashes "$d" "$PREV_GOOD" "$RUNTIME_DIR/$v"; then
          REVERT_WHY="$RT_WHY"
        elif [ "$RT_LIVE" != "$RT_WANT" ]; then
          REVERT_WHY="live content ${RT_LIVE:0:10} != ${PREV_GOOD:0:10}'s tree ${RT_WANT:0:10}"
        else
          REVERT_OK=1
        fi
        # The clone stays on its branch at HEAD whatever happened above.
        [ "$(git -C "$d" symbolic-ref -q --short HEAD 2>/dev/null)" = "$BRANCH" ] || git -C "$d" checkout -q "$BRANCH" 2>/dev/null || true
        git -C "$d" reset --hard -q "$HEAD" 2>/dev/null || true
        # Whatever is live now was written by pull-sync: record what it MEASURABLY is, so
        # the next mirror over it is not mistaken for overwriting foreign content.
        _rv_rt="$(content_hash "$RUNTIME_DIR/$v" "$d")"
        echo "$_rv_rt" > "$MARKER_DIR/$v.runtime-sha" 2>/dev/null || true
        if [ "$REVERT_OK" = 1 ]; then
          echo "$_rv_rt" > "$MARKER_DIR/$v.reverted" 2>/dev/null || true
          log "$v: reverted to ${PREV_GOOD:0:10} — verified: live content ${RT_LIVE:0:10} == its tree"
        else
          rm -f "$MARKER_DIR/$v.reverted" 2>/dev/null || true
          log "$v: revert FAILED — $REVERT_WHY; $UNIT is still serving unhealthy code from ${HEAD:0:10} (pull-sync-revert-failed-$v)"
          emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-revert-failed-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$v went unhealthy after pull-sync to ${HEAD:0:10} and the revert to last-good ${PREV_GOOD:0:10} did NOT land: $REVERT_WHY. The live tree under $RUNTIME_DIR/$v is not the last-good tree, so the unit is still running the code that failed its health check.\",\"classification_metadata\":{\"vessel\":\"$v\",\"attempted_head\":\"$HEAD\",\"prev_good\":\"$PREV_GOOD\",\"runtime_hash\":\"$_rv_rt\",\"prev_good_hash\":\"${RT_WANT:-}\"},\"status\":\"open\"}}}}"
        fi
        systemctl restart "$UNIT" 2>/dev/null || true
        # Re-check after the revert restart: a revert that lands but stays unhealthy
        # says the commit was not (only) the cause.
        if [ "$REVERT_OK" = 1 ]; then
          sleep "$STAGGER_SECONDS"; REVERT_HEALTH=unhealthy
          for _ in 1 2 3 4 5; do healthy "$PORT" && { REVERT_HEALTH=healthy; break; }; sleep 4; done
          if [ "$REVERT_HEALTH" = healthy ]; then
            log "$v: reverted and healthy on ${PREV_GOOD:0:10}"
          else
            log "$v: reverted to ${PREV_GOOD:0:10} but STILL UNHEALTHY — ${HEAD:0:10} may not be (the only) cause"
          fi
        fi
        # marker stays at $CLONE_HASH (last ATTEMPTED content): live code is PREV_GOOD,
        # but re-attempting the same bad commit every tick would be a mirror/
        # revert loop — the substrateGap below owns the escalation instead.
        if [ "$REVERT_OK" = 1 ]; then
          _rv_sum="$v unhealthy after pull-sync to ${HEAD:0:10}; reverted to ${PREV_GOOD:0:10} (live content verified against its tree; $REVERT_HEALTH after the revert restart) and halted the sync run"
        else
          _rv_sum="$v unhealthy after pull-sync to ${HEAD:0:10}; revert to ${PREV_GOOD:-<none>} FAILED ($REVERT_WHY) — still running the unhealthy code; halted the sync run"
        fi
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-unhealthy-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$_rv_sum\",\"status\":\"open\"}}}}"
        failed=$((failed+1))
        break
      fi
    fi
    restart_siblings "$v" "$UNIT"
  fi
  echo "$HEAD" > "$LAST_GOOD_DIR/$v"
  synced=$((synced+1))
done
quiesce_release

# 4. Super-repo convergence — the glue layer the vessel loop can't see: the
# federation transport server wrapper (federation-transport-vessel's ExecStart
# runs it FROM this clone), the boot-seeded active-scripts, and this updater
# itself. Same discipline as vessels: ahead -> skip, diverged -> gap + skip,
# behind -> ff-only pull. The marker records the last ATTEMPTED sha so an
# unhealthy convergence (reverted below) is not re-attempted every tick — only
# a fresh origin commit re-arms it. The fetch and the fast-forward happen at the top of
# the tick (SELF-CONVERGE FIRST); the refresh below runs after the vessel loop so a bad
# glue change can never block vessel convergence. Gap: super-repo-not-in-self-update-set.
SUPER_MARKER="$MARKER_DIR/super-repo.sha"
# A FAILED FETCH SKIPPED THE ENTIRE GLUE LAYER IN SILENCE.
#
# This condition used to be `[ -d ... ] && git fetch ...` with no else: when the fetch
# returned non-zero the whole super-repo block — glue scripts, the federation wrapper, and
# pull-sync's own self-update — was skipped and NOTHING was logged. The tick reported
# "done" and looked healthy.
#
# Measured 2026-08-17: the container's super-repo sat at c23558d9 while its own origin/dev
# read 8501a021, 24 commits behind, across multiple "successful" ticks. The link to the
# remote is BURSTY (probed: one >20s connect failure and one 7.3s connect within three
# attempts, then 10/10 fast), so the fetch fails occasionally — and every occurrence was
# invisible. The same burstiness silently lost an alpha-credit on the reach path.
#
# Non-fatal by design (a transient network fault should not fail the tick), but it must be
# SAYABLE. Convergence that did not happen has to be distinguishable from convergence that
# had nothing to do.
# Fetch ONCE and branch on the result. An earlier draft of this fix ran the fetch twice —
# once to test, once in the condition — which doubles the network call and lets the two
# attempts disagree on a bursty link, reporting a failure that the second call then hides.
# The fetch itself now runs ONCE, at the top of the tick (SELF-CONVERGE FIRST), so the
# pull-sync that converges this commit is this commit's; SUPER_DIR and SUPER_FETCH_OK
# come from there, and a failed fetch was logged there.
if [ "$SUPER_FETCH_OK" = 1 ]; then
  SHEAD="$(git -C "$SUPER_DIR" rev-parse HEAD 2>/dev/null || true)"
  SREMOTE="$(git -C "$SUPER_DIR" rev-parse "origin/$BRANCH" 2>/dev/null || true)"
  SLAST="$(cat "$SUPER_MARKER" 2>/dev/null || true)"
  if [ -n "$SHEAD" ] && [ -n "$SREMOTE" ] && [ "$SREMOTE" != "$SLAST" ]; then
    if [ "$SHEAD" != "$SREMOTE" ]; then
      if git -C "$SUPER_DIR" merge-base --is-ancestor "origin/$BRANCH" HEAD 2>/dev/null; then
        log "super-repo: clone ahead of origin (unpushed commits) — leaving for the push side"
      elif git -C "$SUPER_DIR" merge-base --is-ancestor HEAD "origin/$BRANCH" 2>/dev/null; then
        git -C "$SUPER_DIR" checkout -q "$BRANCH" 2>/dev/null || true
        # CAPTURE WHY. "ff-only pull failed — skipping" named a symptom and discarded the
        # only evidence, so every occurrence needed a hand diagnosis to learn the same thing.
        #
        # Measured 2026-08-17: the clone sat 24 commits behind for hours while every tick
        # reported "done". I first assumed the cause was structural — the incoming range
        # modifies five submodule gitlinks and those paths are permanently dirty here, since
        # pull-sync converges each vessel worktree independently — but running the pull by
        # hand REFUTED that: it fast-forwarded cleanly through exactly those gitlinks. The
        # remaining explanation is the bursty link (probed: one >20s connect failure and one
        # 7.3s connect in three attempts, then 10/10 fast), which fails the FETCH and skips
        # this whole block silently.
        #
        # Which is the point of printing git's own message: I could not tell those two
        # causes apart from the journal, and one of them was wrong.
        _sp_err="$(git -C "$SUPER_DIR" pull --ff-only origin "$BRANCH" 2>&1)"
        if [ $? -eq 0 ]; then
          SHEAD="$(git -C "$SUPER_DIR" rev-parse HEAD)"
        else
          log "super-repo: ff-only pull FAILED — glue layer stays at $(git -C "$SUPER_DIR" rev-parse --short HEAD 2>/dev/null) while origin is ${SREMOTE:0:10}; git said: $(printf '%s' "$_sp_err" | tr '\n' ' ' | cut -c1-300)"
        fi
      else
        log "super-repo: clone DIVERGED from origin/$BRANCH — refusing (substrateGap)"
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-diverged-super-repo\",\"category\":\"source_divergence\",\"source\":\"substrate_detected\",\"summary\":\"super-repo clone at $SUPER_DIR diverged from origin/$BRANCH; pull-sync refuses to force — needs triage\",\"status\":\"open\"}}}}"
        failed=$((failed+1))
      fi
    fi
    if [ "$SHEAD" = "$SREMOTE" ] && [ "$SHEAD" != "$SLAST" ]; then
      SPREV="$(cat "$LAST_GOOD_DIR/super-repo" 2>/dev/null || true)"
      if [ -n "$SLAST" ]; then
        CHANGED="$(git -C "$SUPER_DIR" diff --name-only "$SLAST..$SHEAD" 2>/dev/null || echo all)"
      else
        CHANGED="all"  # first convergence: no baseline, refresh everything
      fi
      echo "$SHEAD" > "$SUPER_MARKER"
      log "super-repo: ${SLAST:-none} -> ${SHEAD:0:10} — refreshing glue layer"
      # Converge submodule worktrees onto the new gitlinks: repos/<v> under the
      # super-repo are the reach-oracle enumeration source, and an ff-pull alone
      # leaves those worktrees detached at the OLD pointers — the stale-oracle
      # drift class behind the green-on-wrong denominator incident. Non-fatal:
      # a lagging worktree is logged, not a sync failure.
      # PER-SUBMODULE, not one call over all of them. `git submodule update`
      # ABORTS on the first worktree it cannot check out, so a single vessel
      # carrying uncommitted substrate-authored work stopped the other
      # seventeen from advancing — and the one-line failure said only "may
      # lag", naming nothing. Observed 2026-08-08: development-vessel held
      # modified src/seed/*.ts, and every submodule silently stayed at its old
      # pointer for as long as that work sat there.
      #
      # Dirty worktrees are SKIPPED BY NAME, never forced. Forcing would
      # discard work the substrate authored and has not yet landed — the same
      # work that, on the hub, turned out to be a real in-progress activity.
      # Lagging is recoverable; discarding is not.
      #
      # TRACKED FILES ONLY (--untracked-files=no). Measured 2026-09-07: the
      # development-vessel worktree carried 2,526 porcelain entries, of which
      # 2,494 were UNTRACKED build artifacts (.js/.d.ts/.map from a compiler
      # run). A submodule checkout does not touch untracked files, so they are
      # not the hazard this guard exists for — but counting them froze the
      # worktree at a pointer 396 commits behind origin/dev for three weeks.
      # That checkout is what the compose vacuous-edit gate's whole-file
      # backstop reads, so the gate could not see any binding added in those
      # three weeks and refused correct declaration repairs as "binding never
      # used". A guard that fails open on an UNREADABLE file does not fail open
      # on a READABLE-but-stale one: it reads confidently and concludes wrongly.
      # Counting only tracked changes preserves the protection (real in-progress
      # edits still skip) while ending the build-artifact freeze.
      _sm_lag=""
      for _sm in $(git -C "$SUPER_DIR" config --file .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}'); do
        [ -d "$SUPER_DIR/$_sm" ] || continue
        if [ -n "$(git -C "$SUPER_DIR/$_sm" status --porcelain --untracked-files=no 2>/dev/null)" ]; then
          _sm_lag="$_sm_lag $_sm"
          continue
        fi
        git -C "$SUPER_DIR" submodule update --init --quiet -- "$_sm" 2>/dev/null \
          || _sm_lag="$_sm_lag $_sm(checkout-failed)"
      done
      [ -n "$_sm_lag" ] && log "super-repo: submodule worktrees left at old pointers (uncommitted work — NOT discarded):$_sm_lag"
      # Every install in this block reads the COMMITTED tree (stage_committed_glue);
      # when it cannot be staged, none of them runs.
      _sg_ok=0; stage_committed_glue "$SUPER_DIR" && _sg_ok=1
      _sg_src="$PULLSYNC_GLUE_STAGE/scripts/substrate"
      # substrate-pull-sync, mirror-to-live and self-recovery-tick are NOT installed here
      # any more: SELF-CONVERGE FIRST installs them at the top of the tick (compare-based,
      # every tick), and re-executes this tick on the new pull-sync. Installing them here,
      # after the pull, is what made the first tick after a merge run the old converger
      # against the new content.
      # SYSTEMD UNITS are the same super-repo-not-in-self-update-set gap class, and
      # were the last part of the glue layer still stuck at image-build time.
      # Dockerfile.substrate:213 copies units/ into the image; nothing converged
      # them afterwards. So EVERY systemd-level repair — TimeoutStopSec, drains,
      # restart policy, Environment= — silently no-opped until someone rebuilt the
      # image, and nothing reported that it had not taken. A whole repair class
      # looked landed and was inert (observed 2026-08-05: a goal-host drain drop-in
      # sat in git with DropInPaths showing it absent from the container).
      #
      # Target /usr/lib, NOT /etc, deliberately: /etc outranks every other unit dir,
      # so a unit living there can never be masked — and masking is how
      # apply-inventory keeps vessels off a spoke (Dockerfile.substrate:208 vendors
      # them low precisely so they remain maskable). Writing units to /etc would
      # silently un-maskable the whole fleet.
      # Unit convergence itself now runs UNCONDITIONALLY each tick (converge_units,
      # called after this whole block) rather than only when origin advances. See the
      # rationale there — it is idempotent, so calling it here too would be redundant.
      # Reseed the active-scripts run-dir (same source substrate-active-scripts-seed uses at boot).
      [ "$_sg_ok" = 1 ] && cp -f "$_sg_src"/*.ts /workspace/active-scripts/ 2>/dev/null || true
      # SUPER-REPO-HOSTED VESSELS — the last thing a convergence changes on disk
      # that nothing then restarts.
      #
      # A manifest vessel whose workdir is $REPO_ROOT/repos/<name> runs its code
      # STRAIGHT OUT OF THIS CLONE. There is no mirror-to-live step for it, so the
      # mirror+restart path that keeps /vessels/<name> current never applies to it
      # at all. bun loads its module graph once at start and does not hot-reload,
      # so a pulled fix sits on disk — fully converged, correct on inspection —
      # while the process keeps serving the old code and EVERY instrument agrees
      # it is fine: the unit is active, /health returns 200, and the clone's own
      # `git log` shows the new commit. Nothing in that set is wrong; none of them
      # observes the running module graph.
      #
      # Measured 2026-08-19 across three containers: the human surface was serving
      # code from Aug-11 and Aug-14 against clones pulled minutes earlier. One had
      # been stale for eight days. The discriminator is the unit's start time
      # against the file mtime — not any health signal.
      #
      # Derived from the manifest, never a vessel list: the property that matters
      # is "source lives in a repo inside this clone", so any future vessel with
      # it is covered without being named. federation-relay and
      # federation-transport-vessel are $REPO_ROOT vessels too, but under
      # scripts/substrate/federation-relay rather than repos/, so this selector
      # excludes them by construction — deliberately. Their restart policy below
      # is narrower on purpose (bouncing the relay drops every peer's reservation
      # at once) and must not be widened by accident.
      _mf="${FLEET_DIR:-/workspace/substrate/fleet}/vessels.manifest.json"
      [ -f "$_mf" ] || _mf=/usr/local/share/substrate/vessels.manifest.json
      if [ -f "$_mf" ] && command -v jq >/dev/null 2>&1; then
        for _sv in $(jq -r '.vessels[] | select((.workdir // "") | startswith("$REPO_ROOT/repos/")) | .name' "$_mf" 2>/dev/null); do
          systemctl is-active "$_sv.service" >/dev/null 2>&1 || continue
          _svdir="$(jq -r --arg n "$_sv" '.vessels[] | select(.name==$n) | .workdir' "$_mf" 2>/dev/null | head -1)"
          _svdir="${_svdir##*/repos/}"
          [ -n "$_svdir" ] || continue
          # Only when THIS vessel's tree moved. "all" is the first-convergence
          # case, where there is no baseline to diff against.
          if [ "$CHANGED" != "all" ] && ! echo "$CHANGED" | grep -q "^repos/$_svdir/"; then continue; fi
          restart_breadcrumb "$_sv" "super-repo convergence to ${SHEAD:0:10}" 2>/dev/null || true
          systemctl restart "$_sv.service" 2>/dev/null || true
          log "super-repo: restarted $_sv — it runs from repos/$_svdir in this clone and bun does not hot-reload a pulled change"
          sleep "$STAGGER_SECONDS"
          _svport="$(jq -r --arg n "$_sv" '.vessels[] | select(.name==$n) | .health_port // empty' "$_mf" 2>/dev/null | head -1)"
          if [ -n "$_svport" ]; then
            _ok=0
            for _ in 1 2 3 4 5; do healthy "$_svport" && { _ok=1; break; }; sleep 4; done
            [ "$_ok" = 0 ] && log "super-repo: $_sv did NOT return healthy on :$_svport after restart — left running; self-recovery owns escalation"
          fi
        done
      fi

      # The relay is restarted ONLY on a real relay.ts change (never on first
      # convergence): bouncing it drops every peer's reservation at once.
      if [ "$CHANGED" != "all" ] && echo "$CHANGED" | grep -q '^scripts/substrate/federation-relay/relay\.ts$' \
         && systemctl is-active federation-relay.service >/dev/null 2>&1; then
        systemctl restart federation-relay.service 2>/dev/null || true
      fi
      if { [ "$CHANGED" = "all" ] || echo "$CHANGED" | grep -q '^scripts/substrate/federation-relay/'; } \
         && systemctl is-active federation-transport-vessel.service >/dev/null 2>&1; then
        systemctl restart federation-transport-vessel.service 2>/dev/null || true
        sleep "$STAGGER_SECONDS"
        ok=0
        for _ in 1 2 3 4 5; do healthy 8401 && { ok=1; break; }; sleep 4; done
        if [ "$ok" = 0 ]; then
          log "super-repo: federation-transport UNHEALTHY after convergence — reverting clone to ${SPREV:0:10} (marker keeps ${SHEAD:0:10}; substrateGap owns escalation)"
          [ -n "$SPREV" ] && git -C "$SUPER_DIR" reset --hard -q "$SPREV" 2>/dev/null || true
          systemctl restart federation-transport-vessel.service 2>/dev/null || true
          emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-unhealthy-super-repo\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"federation-transport-vessel unhealthy after super-repo convergence to ${SHEAD:0:10}; clone reverted to ${SPREV:0:10}\",\"status\":\"open\"}}}}"
          failed=$((failed+1))
        else
          echo "$SHEAD" > "$LAST_GOOD_DIR/super-repo"
          synced=$((synced+1))
        fi
      else
        echo "$SHEAD" > "$LAST_GOOD_DIR/super-repo"
        synced=$((synced+1))
      fi
    fi
  fi
fi

# THE GATE RUNNER ARRIVES BEFORE THE UNIT THAT NAMES IT (ungated mode only: the last
# run-on-arrival tick, stated). substrate-pull-sync.service's ExecStart runs
# $GATE_LIBEXEC_DIR/gate-runner; installing that unit with the runner absent would stop
# self-update on this node. The unit also guards it (see its ExecStart). Once gated, the
# runner is bootstrap tier: image, or this path on a node not yet bootstrapped.
if [ -z "$PULLSYNC_ACCEPTED_DIR" ] && [ "$SUPER_FETCH_OK" = 1 ] && stage_committed_glue "${SUPER_REPO_DIR:-/workspace/git/super-repo}"; then
  _gr_src="$PULLSYNC_GLUE_STAGE/scripts/substrate/gate/gate-runner.sh"
  if [ -f "$_gr_src" ] && ! cmp -s "$_gr_src" "$GATE_LIBEXEC_DIR/gate-runner" 2>/dev/null; then
    if _gr_syn="$(sh -n "$_gr_src" 2>&1)" && mkdir -p "$GATE_LIBEXEC_DIR" 2>/dev/null \
       && install -m 0755 "$_gr_src" "$GATE_LIBEXEC_DIR/.gate-runner.new" 2>/dev/null \
       && mv -f "$GATE_LIBEXEC_DIR/.gate-runner.new" "$GATE_LIBEXEC_DIR/gate-runner" 2>/dev/null; then
      log "gate: installed $GATE_LIBEXEC_DIR/gate-runner — the next tick runs the accepted gate (bootstrap)"
      # Exists before the lane units' next restart, so their InaccessiblePaths= binds (a '-'
      # path absent at namespace build is skipped). entrypoint.sh does the same on boot.
      mkdir -p -m 0700 /workspace/.gate 2>/dev/null || true
    else
      log "gate: !!! could not install $GATE_LIBEXEC_DIR/gate-runner ${_gr_syn:+(sh -n: $(printf '%s' "$_gr_syn" | tr '\n' ' ' | cut -c1-200))}"
    fi
  fi
fi

# Converge systemd units every tick, independent of whether the super-repo sha advanced.
# See converge_units for why this must NOT sit inside the marker-gated refresh above.
converge_units "${SUPER_REPO_DIR:-/workspace/git/super-repo}"

# Same reasoning, same cadence: the selector and the fleet definition it reads
# must converge on every tick, not only when the super-repo sha advances — a
# container that boots on an already-current commit would otherwise never pick
# them up at all.
converge_fleet_defs "${SUPER_REPO_DIR:-/workspace/git/super-repo}"

# FAILING-TEST GENERATOR, deferred to the end of the tick (see the queue note at the test gate).
while IFS='|' read -r gv gq gh gd; do
  [ -n "$gv" ] || continue
  gleft=$(( ${UNIT_TIMEOUT_S:-900} - ( $(date +%s) - PULLSYNC_T0 ) - ${FAILTEST_GEN_MARGIN_S:-240} ))
  if [ "$gleft" -lt 200 ]; then log "$gv: failing-test generator deferred to a later tick (${gleft}s of tick budget left)"; rm -rf "$gq"; continue; fi
  FAILTEST_GEN_DEADLINE=$(( $(date +%s) + gleft )) gen_failing_test_gaps "$gv" "$(cat "$gq/out" 2>/dev/null)" "$gq/prev" "$gh" "$gd" || true
  rm -rf "$gq"
done <<< "$GEN_QUEUE"

log "done — synced=$synced skipped=$skipped deferred=$deferred failed=$failed"

# EXIT NON-ZERO WHEN SOMETHING FAILED.
#
# This was an unconditional `exit 0`, so a converger that could not converge
# reported success to everything downstream. Measured: `done — synced=3
# skipped=0 failed=1` with `cpg-inference-ts: BUILD FAILED` — permanent, it
# never converges — and EXIT=0 on every run. Anything gating on the status (the
# timer's own result, a watchdog, an operator's `&&`) reads a permanently
# failing converger as a healthy one, which is why the failure survived long
# enough to be found by reading the log rather than by anything noticing.
#
# `skipped` deliberately does NOT fail the run: a skip is the documented
# outcome for an unreachable remote or an absent PAT, which is a condition of
# the environment rather than a fault in the sync — failing on it would make a
# laptop that closed its lid look like a broken substrate.
if [ "$failed" -gt 0 ]; then
  log "exiting non-zero: $failed repo(s) did not converge"
  exit 1
fi
exit 0
