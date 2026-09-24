#!/usr/bin/env bash
# substrate-status.sh — the install verdict: five ordered levels, three values.
#
# One command answers "can this substrate be used?", at five levels, each of which
# proves one specific thing:
#
#   live       every selected core unit is active and its restart count held still
#              while it was watched. Under --quick (the image HEALTHCHECK) it also
#              covers every selected unit that serves a port, core or not: a
#              healthcheck that watched core units only stayed `healthy` over a
#              non-core vessel that could not serve a single request
#   seeded     the key substrate-connect will hand a client validates against the
#              identity that issued it
#   served     every unit the inventory selects is up, and every vessel port the
#              launch manifest publishes is bound on a non-loopback address
#   usable     an LLM completion succeeds on some arm (local or federated) AND a
#              known-answer goal baked into this file returns reached:true
#   connected  an authenticated request carrying the emitted key has arrived from
#              outside the container (recorded by activity-api)
#
# Each level is pass | fail | unknown, with the evidence for it. A level is only
# evaluated when every level below it passed; otherwise it is `unknown` and names
# the level that gated it. `unknown` — a check that could not run, timed out, or
# got an error from its data source — never passes.
#
# This is a front end over the existing checkers, not a new one: `live` and the unit
# half of `served` are substrate-ready's matrix, `seeded` is the credential check
# substrate-key whoami and substrate-doctor 3b make, and the LLM half of `usable` is
# substrate-doctor's real-completion probe (which now calls --probe llm here, so the
# probe exists once).
#
# Usage: substrate-status [--level L | --wait L] [--timeout N] [--quick] [--json]
#                         [--services-only] [--report]
#        substrate-status --probe llm|goal [--json]
#
#   --level L        evaluate up to level L; exit 0 only when L is `pass`
#   --wait L         re-evaluate until L passes or --timeout expires (default 900s)
#   --timeout N      bound for --wait, in seconds
#   --quick          one sample of the unit matrix (no restart-stability window),
#                    widened to every ported unit, no per-vessel revision scan.
#                    What the image HEALTHCHECK runs.
#   --json           machine-readable verdict on stdout
#   --services-only  leave *.timer units out of the unit matrix (the boot gate needs
#                    this: the ready-gated timers are ordered after that gate)
#   --report         after evaluating, post the verdict as an installAcceptance
#                    memoryNote (source human_reported) to the anchor this install
#                    reports to — the hub when there is one, this fleet otherwise —
#                    and, when the requested level did not pass, file a gap
#   --probe llm      run only the LLM-completion probe (substrate-doctor uses this)
#   --probe goal     run only the known-answer goal probe (substrate-doctor --smoke);
#                    with --json it also names dispatch_id, route and execution_id
#
# With neither --level nor --wait, all five levels are printed and the exit status
# reflects `usable`: `connected` is informational until a client has connected.
#
# Exit: 0 requested level pass; 1 fail; 3 unknown; 2 usage error.
#
# --wait stops early on a failure no amount of waiting repairs: the known-answer
# goal's dispatch budget spent, no provider key for the LLM probe, or no client key
# at all once identity seeding has finished.
#
# Levels at or above `usable` DISPATCH A GOAL, which writes a trace and a dispatch
# record like any other goal (tagged operator:substrate-status). They are evaluated
# only when a level at or above `usable` is requested (the HEALTHCHECK asks for
# `seeded`), and --wait re-polls one dispatch rather than dispatching once per poll.
#
# Runs inside the container (`docker exec <container> substrate-status`).
set -uo pipefail

LEVELS="live seeded served usable connected"
KNOWN_ANSWER_GOAL="How many vessels are currently registered in the discovery registry? Report the number."
OPERATOR_TAG="operator:substrate-status"

REQ_LEVEL=""; WAIT=0; TIMEOUT=900; QUICK=0; JSON=0; SERVICES_ONLY=0; REPORT=0; PROBE=""
usage() { sed -n '2,/^set -uo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }
while [ $# -gt 0 ]; do
  case "$1" in
    --level) REQ_LEVEL="${2:-}"; shift 2 ;;
    --wait) REQ_LEVEL="${2:-}"; WAIT=1; shift 2 ;;
    --timeout) TIMEOUT="${2:-}"; shift 2 ;;
    --quick) QUICK=1; shift ;;
    --json) JSON=1; shift ;;
    --services-only) SERVICES_ONLY=1; shift ;;
    --report) REPORT=1; shift ;;
    --probe) PROBE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[status] unknown arg: $1" >&2; exit 2 ;;
  esac
done
case "$TIMEOUT" in ''|*[!0-9]*) echo "[status] --timeout needs a number of seconds" >&2; exit 2 ;; esac
if [ -n "$REQ_LEVEL" ]; then
  case " $LEVELS " in *" $REQ_LEVEL "*) ;; *) echo "[status] unknown level '$REQ_LEVEL' (one of: $LEVELS)" >&2; exit 2 ;; esac
fi
case "$PROBE" in ''|llm|goal) ;; *) echo "[status] unknown probe '$PROBE' (llm|goal)" >&2; exit 2 ;; esac
command -v jq >/dev/null 2>&1 || { echo "[status] jq required" >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "[status] curl required" >&2; exit 2; }

# ── Inputs ───────────────────────────────────────────────────────────────────
ENV_FILE="${SUBSTRATE_ENV_FILE:-/etc/substrate/env}"
# The generated env file is authoritative for everything the vessels read; the
# process environment is the fallback (a `docker exec` inherits the container's
# configured env, a systemd unit only what its EnvironmentFile gives it).
envval() {
  local k="$1" v=""
  if [ -r "$ENV_FILE" ]; then
    v="$(grep -m1 "^$k=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")"
  fi
  if [ -z "$v" ]; then v="$(printenv "$k" 2>/dev/null || true)"; fi
  printf '%s' "$v"
}
# Launch inputs the manifest passes into the container but that gen-env need not
# persist: the process env, then the env file, then PID 1's environment (what the
# engine handed the container — visible even from a systemd unit), then the default.
launchval() {
  local k="$1" d="${2:-}" v
  v="$(printenv "$k" 2>/dev/null || true)"
  [ -n "$v" ] || v="$(envval "$k")"
  if [ -z "$v" ] && [ -r /proc/1/environ ]; then
    v="$(tr '\0' '\n' </proc/1/environ 2>/dev/null | grep -m1 "^$k=" | cut -d= -f2- || true)"
  fi
  printf '%s' "${v:-$d}"
}

KEY="$(envval METABOB_API_KEY)"
IDENTITY_EP="$(envval IDENTITY_VESSEL_URL)"; IDENTITY_EP="${IDENTITY_EP:-http://127.0.0.1:8101}"
DISCOVERY_EP="$(envval DISCOVERY_ENDPOINT)"; DISCOVERY_EP="${DISCOVERY_EP:-http://127.0.0.1:8100}"
HUB_DISCOVERY="$(envval HUB_DISCOVERY_URL)"
PORT_PREFIX="$(launchval SUBSTRATE_PORT_PREFIX 18)"
PREFIX_PASSED=0; [ -n "$(launchval SUBSTRATE_PORT_PREFIX)" ] && PREFIX_PASSED=1
# The launch manifest forwards SUBSTRATE_PORT_PREFIX even when it is empty, so the
# name's presence in the container's environment marks a manifest launch. Without
# it the host mapping is whatever the launcher chose, and no host port is claimed.
BY_MANIFEST=0
if printenv SUBSTRATE_PORT_PREFIX >/dev/null 2>&1 \
   || { [ -r /proc/1/environ ] && tr '\0' '\n' </proc/1/environ 2>/dev/null | grep -q '^SUBSTRATE_PORT_PREFIX='; }; then
  BY_MANIFEST=1
fi
# The manifest's own precedence for one container port's host port: the deprecated
# per-port alias when it is set (an alias outranks the name that replaces it), else
# the prefix followed by the container port's last three digits.
port_alias() {
  case "$1" in
    8080) echo ACTIVITY_API_PORT ;; 8090) echo DEV_VESSEL_PORT ;; 8100) echo DISCOVERY_PORT ;;
    8101) echo IDENTITY_PORT ;; 8210) echo GOAL_HOST_PORT ;; 8250) echo ANALYSIS_PORT ;;
    8260) echo CONCEPT_DB_PORT ;; 8270) echo STATEFUL_UI_PORT ;; 8310) echo HUMAN_SURFACE_PORT ;;
    30333) echo RELAY_PORT ;;
  esac
}
host_port_for() { # container port -> host port the manifest maps it to
  local a v=""
  a="$(port_alias "$1")"
  [ -n "$a" ] && v="$(launchval "$a")"
  if [ -n "$v" ]; then printf '%s' "$v"; else printf '%s%s' "$PORT_PREFIX" "${1: -3}"; fi
}
ALIASES_USED=""
for _p in 8080 8090 8100 8101 8210 8250 8260 8270 8310 30333; do
  _a="$(port_alias "$_p")"
  [ -n "$(launchval "$_a")" ] && ALIASES_USED="${ALIASES_USED:+$ALIASES_USED }$_a"
done
unset _p _a
TRACE_HOST_PORT="$(host_port_for 8080)"
IS_SPOKE=0; [ -n "$HUB_DISCOVERY" ] && IS_SPOKE=1
case ",$(envval ENABLED_ROLES)," in *,spoke,*) IS_SPOKE=1 ;; esac
# gen-env records the composition it settled on as PROFILE_EFFECTIVE; derive it
# here only for an env file written before that name existed.
PROFILE="$(envval PROFILE_EFFECTIVE)"
[ -n "$PROFILE" ] || PROFILE="$(envval PROFILE)"
if [ -z "$PROFILE" ]; then
  if [ -n "$(envval ENABLED_ROLES)$(envval ENABLED_VESSELS)" ]; then PROFILE="custom"
  elif [ "$IS_SPOKE" = 1 ]; then PROFILE="spoke"
  else PROFILE="standalone"; fi
fi
ENGINE="unknown"
if [ -e /run/.containerenv ]; then ENGINE="podman"; elif [ -e /.dockerenv ]; then ENGINE="docker"; fi
IMAGE_REVISION="$(head -n1 /etc/substrate/image-revision 2>/dev/null || true)"
IMAGE_REVISION="${IMAGE_REVISION:-unknown}"

INV="${VESSELS_INVENTORY:-}"
if [ -z "$INV" ]; then
  for c in /workspace/substrate/fleet/vessels.inventory.json /usr/local/share/substrate/vessels.inventory.json \
           "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/vessels.inventory.json"; do
    [ -f "$c" ] && { INV="$c"; break; }
  done
fi
READY_BIN="${SUBSTRATE_READY_BIN:-}"
if [ -z "$READY_BIN" ]; then
  for c in /usr/local/bin/substrate-ready "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/substrate-ready.sh"; do
    [ -x "$c" ] && { READY_BIN="$c"; break; }
  done
fi
MANIFEST="${SUBSTRATE_MANIFEST:-/usr/local/share/substrate/docker-compose.yml}"

auth_hdr() { printf 'Authorization: ApiKey %s' "$KEY"; }
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time "${2:-5}" "$1" 2>/dev/null || true; }
unit_prop() { systemctl show "$1" -p "$2" --value 2>/dev/null || true; }
unit_active() { [ "$(systemctl is-active "$1" 2>/dev/null || true)" = "active" ]; }
level_index() { local i=0 l; for l in $LEVELS; do [ "$l" = "$1" ] && { echo "$i"; return; }; i=$((i+1)); done; echo 99; }

# ── Probes (shared with substrate-doctor via --probe) ───────────────────────
# Each sets P_VAL (pass|fail|unknown) and P_EVID.

# LLM: a real, minimal, paid completion — /health cannot see an unfunded account.
# Local arms first (every rendered llm-* unit that is active), then the shape routed
# through discovery, which reaches the local resolver or a federated one.
#
# A failure is held for LLM_RETRY_AFTER seconds within one --wait, so waiting on a
# failing arm does not buy a paid completion every poll.
LLM_PASSED_ONCE=0; LLM_EVID_CACHE=""; LLM_FAIL_AT=0; LLM_FAIL_EVID=""; LLM_FAIL_TERMINAL=""
LLM_RETRY_AFTER="${STATUS_LLM_RETRY_AFTER:-60}"
TERMINAL=""   # set when a failure is one no amount of waiting repairs
probe_llm() {
  P_VAL=unknown; P_EVID=""
  if [ "$LLM_PASSED_ONCE" = 1 ]; then P_VAL=pass; P_EVID="$LLM_EVID_CACHE (cached for this wait)"; return; fi
  if [ "$LLM_FAIL_AT" -gt 0 ] && [ $(( $(date +%s) - LLM_FAIL_AT )) -lt "$LLM_RETRY_AFTER" ]; then
    P_VAL=fail; P_EVID="$LLM_FAIL_EVID (held; re-probed after ${LLM_RETRY_AFTER}s)"
    [ -n "$LLM_FAIL_TERMINAL" ] && TERMINAL="$LLM_FAIL_TERMINAL"
    return
  fi
  local ports="" f p u tried=0 ok=0 why="" lr
  for f in /etc/systemd/system/llm-*.service /usr/lib/systemd/system/llm-*.service; do
    [ -f "$f" ] || continue
    u="$(basename "$f")"
    unit_active "$u" || continue
    p="$(grep -m1 '^Environment=PORT=' "$f" 2>/dev/null | cut -d= -f3 | tr -dc '0-9')"
    [ -n "$p" ] && case " $ports " in *" $p "*) ;; *) ports="$ports $p" ;; esac
  done
  # Fallback for fleets whose arms predate the rendered units.
  [ -n "$ports" ] || ports="8221 8223 8225"
  for p in $ports; do
    [ "$(http_code "http://127.0.0.1:$p/health" 3)" = "200" ] || continue
    tried=$((tried+1))
    lr="$(curl -s --max-time 45 -X POST "http://127.0.0.1:$p/resolve" -H 'Content-Type: application/json' -H "$(auth_hdr)" \
          -d '{"type":"llm_completion","prompt":"reply with the single word ok","max_tokens":16,"task_type":"install_probe"}' 2>/dev/null || true)"
    case "$lr" in
      *'"resolved":true'*) ok=$((ok+1)) ;;
      *) [ -n "$why" ] || why="$(printf '%s' "$lr" | tr -d '\n' | head -c 160)" ;;
    esac
  done
  if [ "$ok" -gt 0 ]; then
    P_VAL=pass; P_EVID="$ok/$tried local llm arm(s) answered a real completion"
    LLM_PASSED_ONCE=1; LLM_EVID_CACHE="$P_EVID"; return
  fi
  # No local arm completed: route the shape by discovery (a federated arm counts).
  lr="$(curl -s --max-time 60 -X POST "$DISCOVERY_EP/resolve" -H 'Content-Type: application/json' -H "$(auth_hdr)" \
        -d '{"pointer":{"type":"llm_completion","prompt":"reply with the single word ok","max_tokens":16,"task_type":"install_probe"}}' 2>/dev/null || true)"
  if printf '%s' "$lr" | jq -e '(.resolved == true) or ((.content // .body.content // "") | tostring | length > 0)' >/dev/null 2>&1 \
     && ! printf '%s' "$lr" | jq -e '.error' >/dev/null 2>&1; then
    P_VAL=pass; P_EVID="llm_completion answered through discovery ($DISCOVERY_EP); $tried local arm(s) listening"
    LLM_PASSED_ONCE=1; LLM_EVID_CACHE="$P_EVID"; return
  fi
  local keys="" k
  for k in ANTHROPIC_API_KEY OPENAI_API_KEY OPENROUTER_API_KEY GOOGLE_API_KEY GROQ_API_KEY MISTRAL_API_KEY CHUTES_API_KEY VLLM_BASE_URL VLLM_ENDPOINTS RUNPOD_ENDPOINT_ID; do
    [ -n "$(envval "$k")" ] && keys="$keys $k"
  done
  # Keyless and not federated: no arm can exist here, whatever discovery said (a
  # root's arms skip by ExecCondition when their key is absent). A spoke's arms are
  # its hub's, so an empty answer there is a routing question, not a verdict.
  if [ -z "$lr" ] && [ "$tried" = 0 ] && { [ -n "$keys" ] || [ "$IS_SPOKE" = 1 ]; }; then
    P_VAL=unknown; P_EVID="no local arm listening and discovery ($DISCOVERY_EP) did not answer llm_completion"
  else
    P_VAL=fail
    if [ -z "$keys" ]; then
      P_EVID="no LLM arm completed: no provider key is set (ANTHROPIC_API_KEY, OPENAI_API_KEY, ...) and no federated arm answered"
      # Terminal only with no peer to federate an arm from: the provider keys a
      # running container was given do not change, but a peer's arm can appear.
      [ "$IS_SPOKE" = 1 ] || [ -n "$(envval PEER_DISCOVERY_ENDPOINTS)" ] \
        || TERMINAL="no provider key is set and no peer is configured to federate an arm from"
    else
      P_EVID="no LLM arm completed ($tried local arm(s) tried; providers configured:$keys); first error: ${why:-$(printf '%s' "$lr" | tr -d '\n' | head -c 160)}"
    fi
    LLM_FAIL_AT="$(date +%s)"; LLM_FAIL_EVID="$P_EVID"; LLM_FAIL_TERMINAL="$TERMINAL"
  fi
}

# The known-answer goal: its answer is recomputed by goal-host's deterministic
# registry oracle, so `reached` here is evidence, not an LLM judge's prose. Local
# goal-host when this fleet runs one; otherwise dispatched by shape through
# discovery to whichever goal-host serves it.
#
# A federated dispatch is polled by its id (goalWalkState), not by scanning a
# goal-host's newest dispatches: on a busy hub the probe's record falls out of any
# newest-N window. Discovery's reply names no provider, so the poll cannot be
# pinned to the goal-host that accepted the dispatch; when the one the poll reaches
# does not know the id, the evidence says so (a routing split) instead of waiting
# out the bound in silence.
GOAL_DISPATCHES=0; GOAL_DISPATCH_ID=""; GOAL_ROUTE=""; GOAL_LAST_EVID=""
GOAL_LAST_ID=""; GOAL_LAST_EXEC=""
WAIT_DEADLINE=0   # set by --wait; a poll never outlives it
GOAL_MAX_DISPATCHES="${STATUS_GOAL_MAX_DISPATCHES:-3}"
GOAL_BOUND="${STATUS_GOAL_TIMEOUT:-180}"
probe_goal() {
  P_VAL=unknown; P_EVID=""
  local gh="http://127.0.0.1:8210" resp id rec raw st reached reason exec deadline body notfound=0
  if [ -z "$GOAL_DISPATCH_ID" ]; then
    if [ "$GOAL_DISPATCHES" -ge "$GOAL_MAX_DISPATCHES" ]; then
      P_VAL=fail; P_EVID="known-answer goal did not reach after $GOAL_DISPATCHES dispatch(es); last: ${GOAL_LAST_EVID:-none}"
      TERMINAL="the known-answer goal's dispatch budget ($GOAL_MAX_DISPATCHES) is spent"
      return
    fi
    body="$(jq -nc --arg g "$KNOWN_ANSWER_GOAL" --arg op "substrate-status" --arg t "$OPERATOR_TAG" \
            '{goal:$g, operator:$op, tags:[$t,"install_probe"]}')"
    if [ "$(http_code "$gh/health" 4)" = "200" ]; then
      GOAL_ROUTE="local"
      resp="$(curl -s --max-time 30 -X POST "$gh/run-goal" -H 'Content-Type: application/json' -H "$(auth_hdr)" -d "$body" 2>/dev/null || true)"
    else
      GOAL_ROUTE="federated"
      resp="$(curl -s --max-time 30 -X POST "$DISCOVERY_EP/resolve" -H 'Content-Type: application/json' -H "$(auth_hdr)" \
              -d "$(printf '%s' "$body" | jq -c '{pointer:(. + {type:"goalDispatchAsync"})}')" 2>/dev/null || true)"
    fi
    id="$(printf '%s' "$resp" | jq -r '.dispatchId // .body.dispatchId // empty' 2>/dev/null || true)"
    if [ -z "$id" ]; then
      if [ "$GOAL_ROUTE" = "local" ]; then
        P_VAL=fail; P_EVID="goal-host did not accept the known-answer goal: $(printf '%s' "$resp" | tr -d '\n' | head -c 160)"
      elif [ -z "$resp" ] || printf '%s' "$resp" | jq -e '.error' >/dev/null 2>&1; then
        P_VAL=fail; P_EVID="no goal-host could be reached to dispatch the known-answer goal (no local goal-host; discovery answered: $(printf '%s' "${resp:-nothing}" | tr -d '\n' | head -c 120))"
      else
        P_VAL=unknown; P_EVID="federated dispatch returned no dispatchId: $(printf '%s' "$resp" | tr -d '\n' | head -c 120)"
      fi
      return
    fi
    GOAL_DISPATCH_ID="$id"; GOAL_DISPATCHES=$((GOAL_DISPATCHES+1))
  fi
  id="$GOAL_DISPATCH_ID"; GOAL_LAST_ID="$id"
  deadline=$(( $(date +%s) + GOAL_BOUND ))
  [ "$WAIT_DEADLINE" -gt 0 ] && [ "$WAIT_DEADLINE" -lt "$deadline" ] && deadline="$WAIT_DEADLINE"
  st=""; reached=""; reason=""; exec=""
  while :; do
    if [ "$GOAL_ROUTE" = "local" ]; then
      rec="$(curl -s --max-time 10 -H "$(auth_hdr)" "$gh/executions/$id" 2>/dev/null || true)"
    else
      raw="$(curl -s --max-time 15 -X POST "$DISCOVERY_EP/resolve" -H 'Content-Type: application/json' -H "$(auth_hdr)" \
             -d "$(jq -nc --arg id "$id" '{pointer:{type:"goalWalkState", dispatchId:$id}}')" 2>/dev/null || true)"
      if printf '%s' "$raw" | jq -e '(.body.dispatchId // null) != null' >/dev/null 2>&1; then
        rec="$(printf '%s' "$raw" | jq -c '.body' 2>/dev/null)"; notfound=0
      else
        rec=""
        # "dispatch not found" is a goal-host that does not know the id; "Not found"
        # is discovery reporting that no goal-host it can reach, local or peer,
        # answered for it.
        case "$raw" in *"dispatch not found"*|*'"error":"Not found"'*) notfound=$((notfound+1)) ;; esac
        # The accepting goal-host records the id before it answers, so a goal-host
        # that does not know it on three polls in a row is a different goal-host.
        [ "$notfound" -ge 3 ] && break
      fi
    fi
    st="$(printf '%s' "$rec" | jq -r '.status // empty' 2>/dev/null || true)"
    reached="$(printf '%s' "$rec" | jq -r 'if has("reached") and (.reached != null) then (.reached|tostring) else "" end' 2>/dev/null || true)"
    reason="$(printf '%s' "$rec" | jq -r '.goalReachReason // empty' 2>/dev/null | head -c 200 || true)"
    exec="$(printf '%s' "$rec" | jq -r '.executionId // empty' 2>/dev/null || true)"
    [ -n "$st" ] && [ "$st" != "running" ] && break
    [ "$(date +%s)" -ge "$deadline" ] && break
    sleep 5
  done
  GOAL_LAST_EXEC="$exec"
  if [ -z "$st" ]; then
    P_VAL=unknown
    if [ "$notfound" -ge 3 ]; then
      P_EVID="dispatched $id ($GOAL_ROUTE) but no goal-host discovery routes goalWalkState to knows it — a routing split between goal-hosts, so no verdict is readable from here"
    else
      P_EVID="dispatched $id ($GOAL_ROUTE) but its record is not pollable"
    fi
    return
  fi
  if [ "$st" = "running" ]; then
    P_VAL=unknown; P_EVID="dispatch $id ($GOAL_ROUTE) still running at the poll bound (${GOAL_BOUND}s)"
    return   # keep the id: the next --wait iteration polls the same dispatch
  fi
  GOAL_DISPATCH_ID=""   # finished: a later retry dispatches afresh
  case "$reached" in
    true)
      P_VAL=pass; P_EVID="known-answer goal reached (dispatch $id, $GOAL_ROUTE): ${reason:-no reason recorded}" ;;
    false)
      P_VAL=fail; P_EVID="known-answer goal NOT reached (dispatch $id, $GOAL_ROUTE, status $st): ${reason:-no reason recorded}"
      GOAL_LAST_EVID="$P_EVID" ;;
    *)
      # Finished without a reach verdict: goal-host did not grade it, which is not
      # evidence either way.
      P_VAL=unknown; P_EVID="dispatch $id ($GOAL_ROUTE) finished (status $st) with no reach verdict recorded"
      GOAL_LAST_EVID="$P_EVID" ;;
  esac
}

if [ -n "$PROBE" ]; then
  case "$PROBE" in llm) probe_llm ;; goal) probe_goal ;; esac
  if [ "$JSON" = 1 ]; then
    if [ "$PROBE" = goal ]; then
      jq -nc --arg p "$PROBE" --arg v "$P_VAL" --arg e "$P_EVID" --arg d "$GOAL_LAST_ID" --arg r "$GOAL_ROUTE" --arg x "$GOAL_LAST_EXEC" \
        '{probe:$p, value:$v, evidence:$e, dispatch_id:(if $d=="" then null else $d end),
          route:(if $r=="" then null else $r end), execution_id:(if $x=="" then null else $x end)}'
    else
      jq -nc --arg p "$PROBE" --arg v "$P_VAL" --arg e "$P_EVID" '{probe:$p, value:$v, evidence:$e}'
    fi
  else
    printf '%-8s %-7s %s\n' "$PROBE" "$P_VAL" "$P_EVID"
  fi
  case "$P_VAL" in pass) exit 0 ;; fail) exit 1 ;; *) exit 3 ;; esac
fi

# ── Levels ───────────────────────────────────────────────────────────────────
READY_JSON=""
run_ready() { # -> READY_JSON, READY_RC
  local args="--json"
  if [ "$QUICK" = 1 ]; then args="$args --quick"; else args="$args --once"; fi
  [ "$SERVICES_ONLY" = 1 ] && args="$args --services-only"
  # shellcheck disable=SC2086
  READY_JSON="$("$READY_BIN" $args 2>/dev/null)"; READY_RC=$?
}
core_units() { jq -r '.vessels[] | select(.core == true) | .unit' "$INV" 2>/dev/null; }
row_status() { printf '%s' "$READY_JSON" | jq -r --arg u "$1" '.vessels[] | select(.unit == $u) | .status' 2>/dev/null | head -n1; }

eval_live() {
  if [ -z "$READY_BIN" ] || [ -z "$INV" ]; then V=unknown; E="substrate-ready or the vessel inventory is missing from this image"; return; fi
  # No systemd, no unit matrix: every unit would read as down, which is a verdict
  # about the checker, not the fleet.
  if [ ! -d /run/systemd/system ]; then V=unknown; E="systemd is not running here, so unit state cannot be read"; return; fi
  run_ready
  if ! printf '%s' "$READY_JSON" | jq -e '.vessels' >/dev/null 2>&1; then
    V=unknown; E="substrate-ready produced no verdict (exit $READY_RC)"; return
  fi
  local down="" u s n units scope
  # Full evaluation: the core units, as the level is defined. --quick: every row
  # the quick matrix returned, which is the core units plus every unit serving a
  # port — the coverage the image HEALTHCHECK has always gated on.
  if [ "$QUICK" = 1 ]; then
    units="$(printf '%s' "$READY_JSON" | jq -r '.vessels[].unit' 2>/dev/null)"
    scope="core and ported unit(s)"
  else
    units="$(core_units)"
    scope="core unit(s)"
  fi
  while read -r u; do
    [ -n "$u" ] || continue
    s="$(row_status "$u")"
    if [ "$s" = "down" ]; then
      n="$(unit_prop "$u" NRestarts)"
      down="$down $u($(systemctl is-active "$u" 2>/dev/null || true), NRestarts=${n:-?})"
    fi
  done <<<"$units"
  local window="restart counts watched over ${READY_LOOP_WINDOW:-25}s"
  [ "$QUICK" = 1 ] && window="single sample, restart stability not observed"
  if [ -n "$down" ]; then
    V=fail; E="$scope down or restarting:$down"
  else
    V=pass; E="every selected $scope active ($window)"
  fi
}

eval_seeded() {
  # Re-read on every evaluation: identity-seeder rewrites the env file on a fresh
  # volume, so the key a --wait started with may not be the key it ends with.
  KEY="$(envval METABOB_API_KEY)"
  local st=""
  if [ "$(systemctl is-enabled identity-seeder.service 2>/dev/null || true)" != "masked" ]; then
    st="$(unit_prop identity-seeder.service ActiveState)"
    case "$st" in activating|reloading) V=fail; E="identity seeding in progress (identity-seeder.service $st) — the key may still be replaced"; return ;; esac
  fi
  if [ -z "$KEY" ]; then
    V=fail; E="no METABOB_API_KEY in $ENV_FILE — nothing for a client to use"
    # Seeding has run to completion this boot (or does not run here) and left no
    # key: waiting longer changes nothing. `inactive` alone is not that — a seeder
    # that has not started yet rests inactive too — so ask whether it has exited.
    local exited load
    load="$(unit_prop identity-seeder.service LoadState)"
    exited="$(unit_prop identity-seeder.service ExecMainExitTimestampMonotonic)"
    if [ -z "$st" ] || [ "$load" = "not-found" ] || { [ -n "$exited" ] && [ "$exited" != 0 ]; }; then
      TERMINAL="identity seeding finished without a client key"
    fi
    return
  fi
  local v valid xff=()
  # identity-vessel rate-limits validation per client address, and an in-container
  # caller that names none shares one bucket with every vessel validating its
  # callers. This check runs every 30s as the HEALTHCHECK, so against this fleet's
  # own identity it names the address it truly has (loopback, which the generated
  # env allowlists) instead of spending that shared budget. Never toward a remote
  # identity, where the header would be a claim, not a fact.
  case "$IDENTITY_EP" in http://127.0.0.1:*|http://localhost:*) xff=(-H 'X-Forwarded-For: 127.0.0.1') ;; esac
  v="$(curl -s --max-time 8 -X POST "$IDENTITY_EP/v1/keys/validate" -H 'Content-Type: application/json' "${xff[@]}" \
       -d "$(jq -nc --arg k "$KEY" '{api_key:$k}')" 2>/dev/null || true)"
  # Not `.data.valid // .valid`: `//` treats false as absent, so a rejected key would
  # read as "no verdict" and a revoked key could never fail this level.
  valid="$(printf '%s' "$v" | jq -r 'if ((.data | type) == "object") and (.data | has("valid")) then .data.valid else .valid end | tostring' 2>/dev/null || true)"
  case "$valid" in
    true)
      KEY_ID="$(printf '%s' "$v" | jq -r '.data.key_id // empty' 2>/dev/null || true)"
      V=pass; E="the client key validates against $IDENTITY_EP (key_id ${KEY_ID:-?}, org $(printf '%s' "$v" | jq -r '.data.org_id // "?"'))" ;;
    false)
      V=fail; E="the client key is REJECTED by $IDENTITY_EP: $(printf '%s' "$v" | jq -r '.data.error // .error // "no reason given"' 2>/dev/null)"
      [ "$IS_SPOKE" = 1 ] && E="$E — this spoke has not joined; issue a key on the hub" ;;
    *)
      V=unknown; E="identity at $IDENTITY_EP did not give a verdict: $(printf '%s' "${v:-no answer}" | tr -d '\n' | head -c 120)" ;;
  esac
}

# Published container ports, read from the launch manifest baked into the image so
# the list exists once. A manifest line looks like `- "<host>:8080"` in any of the
# forms compose accepts; the container port is the last number.
published_ports() {
  if [ -n "${SUBSTRATE_PUBLISHED_PORTS:-}" ]; then printf '%s\n' $SUBSTRATE_PUBLISHED_PORTS; return; fi
  if [ -f "$MANIFEST" ]; then
    awk '/^[[:space:]]*ports:/{p=1; next} p && /^[[:space:]]*[a-z_]+:/{p=0} p' "$MANIFEST" \
      | sed -n -E 's/^[[:space:]]*-[[:space:]]*"?[^"#]*:([0-9]{2,5})(\/tcp)?"?[[:space:]]*(#.*)?$/\1/p' | sort -un
  else
    printf '%s\n' 8080 8090 8100 8101 8210 8250 8260 8270 8310
  fi
}
# Units that serve a container port: the inventory's health_port, plus the relay,
# whose libp2p port has no HTTP health endpoint.
port_unit() {
  local u
  u="$(jq -r --argjson p "$1" '.vessels[] | select(.health_port == $p) | .unit' "$INV" 2>/dev/null | head -n1)"
  if [ -z "$u" ]; then
    case "$1" in 30333|8333) u="federation-relay.service" ;; esac
  fi
  printf '%s' "$u"
}
# LISTEN sockets on a port, classified. /proc/net/tcp prints IPv4 addresses as
# little-endian hex, so 127.0.0.1 is 0100007F; ::1 is 000…01000000 in tcp6, and a
# v4-mapped loopback ends in 7F behind FFFF.
bind_class() { # port -> "nonloopback" | "loopback" | "none"
  local hex any_nl=0 any_lo=0 a
  hex="$(printf '%04X' "$1")"
  while read -r a; do
    [ -n "$a" ] || continue
    case "$a" in
      ????????) case "$a" in ??????7F) any_lo=1 ;; *) any_nl=1 ;; esac ;;
      00000000000000000000000001000000) any_lo=1 ;;
      0000000000000000FFFF0000??????7F) any_lo=1 ;;
      *) any_nl=1 ;;
    esac
  done < <(awk -v P="$hex" '$4 == "0A" { n = split($2, a, ":"); if (a[n] == P) print a[1] }' /proc/net/tcp /proc/net/tcp6 2>/dev/null)
  if [ "$any_nl" = 1 ]; then echo nonloopback; elif [ "$any_lo" = 1 ]; then echo loopback; else echo none; fi
}

eval_served() {
  if [ -z "$READY_JSON" ]; then V=unknown; E="no unit matrix (live was not evaluated)"; return; fi
  local down n_ok
  # `served` is about the vessels that serve. Self-maintenance units (inventory roles
  # infra, autonomy and seed: pull-sync, recovery, ticks, seeders) can fail without
  # the node serving any less — a self-update that cannot build one package keeps
  # the live copy. Their failures are reported in the evidence, never hidden, but
  # they do not fail this level.
  local maint_roles='["infra","autonomy","seed"]' all_down maint_down=""
  all_down="$(printf '%s' "$READY_JSON" | jq -r '[.vessels[] | select(.status == "down") | .unit] | join(" ")' 2>/dev/null)"
  down=""
  for u in $all_down; do
    if jq -e --arg u "$u" --argjson m "$maint_roles" \
         '[.vessels[] | select(.unit == $u) | .role] | any(. as $r | $m | index($r))' "$INV" >/dev/null 2>&1; then
      maint_down="$maint_down $u"
    else
      down="$down $u"
    fi
  done
  down="${down# }"
  n_ok="$(printf '%s' "$READY_JSON" | jq -r '[.vessels[] | select(.status == "ok")] | length' 2>/dev/null)"
  if [ -n "$down" ]; then V=fail; E="selected unit(s) not serving: $down"; return; fi
  local p u s b bad="" checked=""
  while read -r p; do
    [ -n "$p" ] || continue
    u="$(port_unit "$p")"
    if [ -n "$u" ]; then
      s="$(row_status "$u")"
      if [ -z "$s" ]; then unit_active "$u" && s=ok || s=skipped; fi
      # A vessel this profile does not run is not expected to answer.
      [ "$s" = "ok" ] || continue
    fi
    b="$(bind_class "$p")"
    if [ -z "$u" ] && [ "$b" = "none" ]; then continue; fi
    checked="$checked $p"
    case "$b" in
      nonloopback) ;;
      loopback) bad="$bad ${u:-port}:$p(bound to loopback only — the published port cannot reach it)" ;;
      none) bad="$bad ${u:-port}:$p(not listening)" ;;
    esac
  done < <(published_ports)
  # Host ports are claimed only for a manifest launch, and then as the mapping the
  # manifest declares — an override file can still bind one to 127.0.0.1 or remap
  # it, which nothing inside the container can see.
  local host_note q hp=""
  if [ "$BY_MANIFEST" = 1 ]; then
    for q in $checked; do hp="$hp $(host_port_for "$q")"; done
    host_note="host ports the manifest maps them to:${hp:- none}; prefix $PORT_PREFIX"
    [ "$PREFIX_PASSED" = 1 ] || host_note="$host_note (default — SUBSTRATE_PORT_PREFIX empty)"
    [ -n "$ALIASES_USED" ] && host_note="$host_note; deprecated alias(es) set: $ALIASES_USED"
  else
    host_note="launched outside the launch manifest, so the host mapping is unknown from here"
  fi
  if [ -n "$bad" ]; then
    V=fail; E="container port(s) the manifest publishes are unreachable from outside:$bad"
  else
    V=pass; E="${n_ok:-?} selected unit(s) up; container ports the manifest publishes bound non-loopback:${checked:- none selected} ($host_note)"
    [ -n "$maint_down" ] && E="$E; self-maintenance unit(s) failing, not counted against serving:$maint_down"
  fi
}

eval_usable() {
  probe_llm
  if [ "$P_VAL" != pass ]; then V="$P_VAL"; E="$P_EVID"; return; fi
  local llm_e="$P_EVID"
  probe_goal
  V="$P_VAL"; E="$llm_e; $P_EVID"
}

# The marker activity-api writes on an authenticated request from outside the
# container. Two forms are read: the flat record of the process's first such request
# ({first_at, remote, key_id, pid, process_started_at}), and a per-key map under
# `by_key_id` holding the first request for each key. With the map, a hub whose
# first outside caller was a spoke's vessel still records the emitted key's first
# request; with the flat form only, a different key first means `unknown`.
#
# The marker lives on the volume, so one written by an earlier container survives
# a recreate: it counts only when its process started no earlier than the running
# activity-api did.
to_epoch() { [ -n "$1" ] && date -d "$1" +%s 2>/dev/null || true; }
eval_connected() {
  local f="${SUBSTRATE_INSTALL_DIR:-/workspace/.install}/connected.json" rec first remote kid started enter_s started_s
  if ! unit_active activity-api.service; then
    V=unknown; E="activity-api does not run in this fleet; client connections are observed where the trace store runs"
    [ "$IS_SPOKE" = 1 ] && E="$E (the hub)"
    return
  fi
  if [ ! -f "$f" ]; then V=unknown; E="no authenticated request from outside the container has been observed yet — connect a client (substrate-connect), then make one cockpit call"; return; fi
  if ! jq -e 'type == "object"' "$f" >/dev/null 2>&1; then V=unknown; E="$f is unreadable"; return; fi
  rec=""
  if [ -n "${KEY_ID:-}" ]; then
    rec="$(jq -c --arg k "$KEY_ID" '(.by_key_id // {})[$k] // empty' "$f" 2>/dev/null || true)"
  fi
  [ -n "$rec" ] || rec="$(jq -c '{first_at, remote, key_id, process_started_at}' "$f" 2>/dev/null || true)"
  first="$(printf '%s' "$rec" | jq -r '.first_at // empty' 2>/dev/null || true)"
  if [ -z "$first" ]; then V=unknown; E="$f records no request"; return; fi
  remote="$(printf '%s' "$rec" | jq -r '.remote // "?"' 2>/dev/null)"; kid="$(printf '%s' "$rec" | jq -r '.key_id // empty' 2>/dev/null)"
  started="$(printf '%s' "$rec" | jq -r '.process_started_at // empty' 2>/dev/null || true)"
  [ -n "$started" ] || started="$(jq -r '.process_started_at // empty' "$f" 2>/dev/null || true)"
  enter_s="$(to_epoch "$(unit_prop activity-api.service ActiveEnterTimestamp)")"
  started_s="$(to_epoch "${started:-$first}")"
  # A few seconds of slack: systemd stamps the unit active before bun has taken
  # its own start time, never after.
  if [ -n "$enter_s" ] && [ -n "$started_s" ] && [ "$started_s" -lt $((enter_s - 5)) ]; then
    V=unknown; E="the only recorded connection ($first from $remote) is a marker from an earlier boot; none observed since activity-api started — make one cockpit call"
    return
  fi
  if [ -n "$kid" ] && [ -n "${KEY_ID:-}" ] && [ "$kid" != "$KEY_ID" ]; then
    V=unknown; E="a client connected at $first from $remote, but with key $kid, not the emitted key $KEY_ID"
    jq -e 'has("by_key_id")' "$f" >/dev/null 2>&1 || E="$E (this activity-api records only its first outside request, so a later one with the emitted key is not visible until it restarts)"
    return
  fi
  V=pass; E="first external authenticated request at $first from $remote${kid:+ (key $kid)}"
}

# Per-vessel revision: what the image baked vs what is running now. Pull-sync mirrors
# a vessel's clone into /vessels/<v> when origin moves, so the running code can be
# newer than the image. The build records a content hash of each baked src tree;
# a tree that no longer hashes the same has moved. The vessel's clone HEAD is
# reported beside it as the clone head — the revision pull-sync last converged the
# clone to, which is what it mirrors in, but not proof the mirror took it.
VESSEL_ROWS=""
scan_revisions() {
  VESSEL_ROWS=""
  local marks=/usr/local/share/substrate/vessel-src.sha256 revs=/usr/local/share/substrate/vessel-revisions
  local d v img_hash now_hash img_rev run_rev state
  for d in /vessels/*/; do
    v="$(basename "$d")"
    case "$v" in *-mitosis-*|packages) continue ;; esac
    [ -d "$d/src" ] || continue
    img_hash="$(awk -v V="$v" '$2 == V {print $1}' "$marks" 2>/dev/null | head -n1)"
    img_rev="$(awk -F= -v V="$v" '$1 == V {print $2}' "$revs" 2>/dev/null | head -n1)"
    run_rev="$(git -C "/workspace/git/vessels/$v" rev-parse --short=12 HEAD 2>/dev/null || true)"
    if [ ! -f "$marks" ]; then
      state="nomarker"   # the image predates the build-time marker
    elif [ -z "$img_hash" ]; then
      state="unmarked"   # the marker exists but was taken before this vessel was added
    else
      now_hash="$(cd "$d" && find src -type f -print0 2>/dev/null | LC_ALL=C sort -z | xargs -0 sha256sum 2>/dev/null | sha256sum | cut -c1-16)"
      if [ "$now_hash" = "$img_hash" ]; then state="image"; else state="moved"; fi
    fi
    VESSEL_ROWS="${VESSEL_ROWS}${v}|${state}|${img_rev:-}|${run_rev:-}
"
  done
}

# ── Evaluate ─────────────────────────────────────────────────────────────────
TARGET="${REQ_LEVEL:-usable}"
EVAL_TO="${REQ_LEVEL:-connected}"
TIDX="$(level_index "$EVAL_TO")"
declare -A VAL EVID
FIRST_FAIL=""
evaluate() {
  local l i=0 gate=""
  KEY_ID=""; TERMINAL=""; FIRST_FAIL=""
  for l in $LEVELS; do
    if [ "$i" -gt "$TIDX" ]; then VAL[$l]="unknown"; EVID[$l]="not requested"
    elif [ -n "$gate" ]; then VAL[$l]="unknown"; EVID[$l]="not evaluated: $gate"
    else
      V=unknown; E=""
      "eval_$l"
      VAL[$l]="$V"; EVID[$l]="$E"
      [ "$V" = pass ] || { gate="$l is $V"; FIRST_FAIL="$l"; }
    fi
    i=$((i+1))
  done
}

[ "$WAIT" = 1 ] && WAIT_DEADLINE=$(( $(date +%s) + TIMEOUT ))
evaluate
if [ "$WAIT" = 1 ]; then
  deadline="$WAIT_DEADLINE"
  while [ "${VAL[$TARGET]}" != pass ] && [ "$(date +%s)" -lt "$deadline" ]; do
    if [ -n "$TERMINAL" ] && [ "${VAL[$FIRST_FAIL]:-}" = fail ]; then
      echo "[status] stopped waiting for $TARGET: $FIRST_FAIL failed and will not recover by waiting ($TERMINAL)" >&2
      break
    fi
    echo "[status] waiting for $TARGET: $(for l in $LEVELS; do printf '%s=%s ' "$l" "${VAL[$l]}"; done)" >&2
    sleep 10
    evaluate
  done
fi
[ "$QUICK" = 1 ] || scan_revisions

# ── Output ───────────────────────────────────────────────────────────────────
verdict_json() {
  local l levels_json="[]" vessels_json
  for l in $LEVELS; do
    levels_json="$(jq -c --arg l "$l" --arg v "${VAL[$l]}" --arg e "${EVID[$l]}" '. + [{level:$l, value:$v, evidence:$e}]' <<<"$levels_json")"
  done
  vessels_json="$(printf '%s' "$VESSEL_ROWS" | jq -R -s -c 'split("\n") | map(select(length>0) | split("|")
      | {vessel:.[0], running:(if .[1]=="image" then "image" elif .[1]=="moved" then "moved" else "unknown" end),
         unknown_because:(if .[1]=="nomarker" then "image predates the build-time marker"
                          elif .[1]=="unmarked" then "no build-time marker line for this vessel" else null end),
         image_revision:(.[2] // "" | if .=="" then null else . end),
         clone_head:(.[3] // "" | if .=="" then null else . end)})')"
  jq -nc --argjson levels "$levels_json" --argjson vessels "$vessels_json" \
    --arg target "$TARGET" --arg value "${VAL[$TARGET]}" --arg img "$IMAGE_REVISION" \
    --arg profile "$PROFILE" --arg engine "$ENGINE" --arg prefix "$PORT_PREFIX" \
    --arg thp "$TRACE_HOST_PORT" --argjson bym "$BY_MANIFEST" --arg aliases "$ALIASES_USED" \
    '{requested_level:$target, value:$value, ok:($value=="pass"), image_revision:$img,
      profile:$profile, engine:$engine, port_prefix:$prefix,
      trace_host_port:$thp, launched_by_manifest:($bym == 1),
      deprecated_port_aliases:($aliases | split(" ") | map(select(length > 0))),
      levels:$levels, vessels:$vessels}'
}

if [ "$JSON" = 1 ]; then
  verdict_json
else
  printf 'substrate-status  image %s  profile %s  engine %s  port prefix %s\n' "$IMAGE_REVISION" "$PROFILE" "$ENGINE" "$PORT_PREFIX"
  for l in $LEVELS; do printf '  %-10s %-8s %s\n' "$l" "${VAL[$l]}" "${EVID[$l]}"; done
  if [ -n "$VESSEL_ROWS" ]; then
    moved="$(printf '%s' "$VESSEL_ROWS" | awk -F'|' '$2=="moved"{printf "    %-28s image %s -> clone head %s\n", $1, ($3==""?"(baked)":$3), ($4==""?"(no clone)":$4)}')"
    nomark="$(printf '%s' "$VESSEL_ROWS" | awk -F'|' '$2=="nomarker"{n++} END{print n+0}')"
    unmarked="$(printf '%s' "$VESSEL_ROWS" | awk -F'|' '$2=="unmarked"{printf " %s", $1}')"
    if [ -n "$moved" ]; then echo "  vessels whose running code differs from the image (pull-sync moved them; clone head = the revision their clone was converged to):"; echo "$moved"; fi
    [ "$nomark" -gt 0 ] && echo "  $nomark vessel(s) unchecked: this image predates the build-time revision marker"
    [ -n "$unmarked" ] && echo "  unchecked, no build-time marker line:$unmarked"
    [ -z "$moved" ] && [ "$nomark" = 0 ] && [ -z "$unmarked" ] && echo "  every vessel runs the code this image baked"
  fi
  printf '  requested %s: %s\n' "$TARGET" "${VAL[$TARGET]}"
fi

# ── Report ───────────────────────────────────────────────────────────────────
# The installAcceptance record goes to the anchor this install reports to: the hub
# when there is one (its gap store is the one the network learns from), this fleet's
# own discovery otherwise. Posting retries and then spools, so a hub outage never
# costs the record — the next --report sends what is spooled first.
accepted() { [ -n "$1" ] && ! printf '%s' "$1" | jq -e '(.error // .body.error // null) != null or (.success == false) or (.shape == "structuredError") or (.body.action == "rejected")' >/dev/null 2>&1; }
post_resolve() { # anchor pointer-json -> 0 on an accepted write
  local base="$1" ptr="$2" r i
  for i in 1 2 3; do
    r="$(curl -s --max-time 15 -X POST "$base/resolve" -H 'Content-Type: application/json' -H "$(auth_hdr)" \
         -d "$(jq -nc --argjson p "$ptr" '{pointer:$p}')" 2>/dev/null || true)"
    accepted "$r" && return 0
    # With no hub, this fleet's own development-vessel is the producer: if routing
    # through discovery fails, hand it the impulse directly, in the form its other
    # callers use.
    if [ -z "$HUB_DISCOVERY" ]; then
      r="$(curl -s --max-time 15 -X POST "http://127.0.0.1:8090/v2/impulses/resolve" -H 'Content-Type: application/json' -H "$(auth_hdr)" \
           -d "$(jq -nc --argjson p "$ptr" '{impulse:{pointer:$p}}')" 2>/dev/null || true)"
      accepted "$r" && return 0
    fi
    sleep $((i * 3))
  done
  REPORT_ERR="$(printf '%s' "${r:-no answer}" | tr -d '\n' | head -c 160)"
  return 1
}
if [ "$REPORT" = 1 ]; then
  ANCHOR="$DISCOVERY_EP"; [ -n "$HUB_DISCOVERY" ] && ANCHOR="$HUB_DISCOVERY"
  SPOOL="${SUBSTRATE_INSTALL_DIR:-/workspace/.install}/pending-reports"
  mkdir -p "$SPOOL" 2>/dev/null || true
  for f in "$SPOOL"/*.json; do
    [ -f "$f" ] || continue
    post_resolve "$ANCHOR" "$(cat "$f")" && rm -f "$f"
  done
  NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # The id and title carry the `installAcceptance:` prefix and the body names the
  # kind, so the record is findable even where the memory resolver does not keep
  # note_type installAcceptance and stores the note under a type it does know.
  VJSON="$(verdict_json | jq -c --arg now "$NOW" '. + {record_kind:"installAcceptance", source:"human_reported", reported_at:$now}')"
  FAILING=""
  for l in $LEVELS; do
    [ "$(level_index "$l")" -le "$(level_index "$TARGET")" ] || break
    [ "${VAL[$l]}" = pass ] || { FAILING="$l"; break; }
  done
  NOTE_ID="installAcceptance:${PROFILE}:${IMAGE_REVISION:0:12}:${NOW}"
  NOTE_PTR="$(jq -nc --arg id "$NOTE_ID" --arg title "installAcceptance ${VAL[$TARGET]} ${TARGET} ${PROFILE} ${ENGINE} ${IMAGE_REVISION:0:12}" \
      --arg body "$VJSON" \
      '{type:"memoryNote_write", note:{id:$id, note_type:"installAcceptance", title:$title, body:$body, provenance_trace_ids:[], confidence_weight:0.9}}')"
  if post_resolve "$ANCHOR" "$NOTE_PTR"; then
    echo "[status] posted memoryNote $NOTE_ID to $ANCHOR (find it by the installAcceptance: id prefix)" >&2
  else
    printf '%s' "$NOTE_PTR" > "$SPOOL/$(date +%s)-note.json" 2>/dev/null || true
    echo "[status] could not post the installAcceptance record to $ANCHOR ($REPORT_ERR); spooled for the next --report" >&2
  fi
  if [ -n "$FAILING" ]; then
    # One gap per (level, profile, image): a re-run of the same failure dedups on
    # the id instead of filing another.
    GAP_ID="install-acceptance-${FAILING}-${PROFILE}-${IMAGE_REVISION:0:12}"
    GAP_PTR="$(jq -nc --arg id "$GAP_ID" --arg now "$NOW" --arg lvl "$FAILING" --arg val "${VAL[$FAILING]}" \
        --arg ev "${EVID[$FAILING]}" --arg prof "$PROFILE" --arg eng "$ENGINE" --arg img "$IMAGE_REVISION" --arg note "$NOTE_ID" \
        '{type:"substrateGap_write", gap:{id:$id, category:"systematic_failure", source:"human_reported", status:"open",
          detected_at:$now,
          summary:("An install stopped at level \($lvl) (\($val)) on profile \($prof), engine \($eng), image \($img): \($ev)"),
          classification_metadata:{class:"install_acceptance", failing_level:$lvl, value:$val, profile:$prof,
            engine:$eng, image_revision:$img, installAcceptance_note:$note}}}')"
    if post_resolve "$ANCHOR" "$GAP_PTR"; then
      echo "[status] filed gap $GAP_ID at $ANCHOR" >&2
    else
      printf '%s' "$GAP_PTR" > "$SPOOL/$(date +%s)-gap.json" 2>/dev/null || true
      echo "[status] could not file gap $GAP_ID at $ANCHOR ($REPORT_ERR); spooled for the next --report" >&2
    fi
  fi
fi

case "${VAL[$TARGET]}" in pass) exit 0 ;; fail) exit 1 ;; *) exit 3 ;; esac
