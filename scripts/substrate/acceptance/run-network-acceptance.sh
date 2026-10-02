#!/usr/bin/env bash
# run-network-acceptance.sh — judge that a node joins a network with two inputs and
# contributes to it.
#
# The install page's promise for a spoke is "one command, the hub's discovery endpoint
# and a key it issued". The standalone acceptance run cannot test that: it is one fleet
# on one host. This run stands up a hub with the page's `install:hub` blocks and a spoke
# with its `install:spoke` blocks, on one fresh runner, filling the page's placeholders
# the way a reader would, and then judges what joining is for:
#
#   spoke_seeded      the spoke's client key validates, against the hub's identity (the
#                     spoke runs none of its own)
#   relay_reservation the spoke's transport holds a reservation on the hub's relay
#   hub_registration  the hub's discovery lists a producer of the fileContent shape on the
#                     spoke (`<any vessel>@<spoke id>`, protocol libp2p, a circuit address)
#   hub_to_spoke      the hub reads a file that exists only on the spoke, through that
#                     producer, over the relay (the spoke's data serving the network).
#                     Both are addressed by shape: which vessels a node runs is placement.
#   leave_no_foreign_answer, leave_deadvertised, rejoin
#                     a second spoke joins; the first stops (compose stop). A read addressed
#                     to the stopped spoke must not return the second spoke's (or the hub's)
#                     copy of the file; within 60 s the hub stops offering it; after a start
#                     it is registered again and reads its own marker
#   spoke_goal        with a provider key only: a goal dispatched on the spoke reaches,
#                     and its trace is in the hub's trace store (the network learns
#                     from the spoke's work); unjudged without a key
#
# None of the first four needs a model, so they are judged in every mode. The hub's own
# `usable` wait may fall short without a key (the installer exits 20); that is excused
# here, because a spoke joins a hub whatever its model plane is doing.
#
# Inputs (environment): ENGINE docker|podman, IMAGE (digest preferred), RESULT_DIR,
# optional ACCEPTANCE_PROVIDER_KEY + ACCEPTANCE_PROVIDER_VAR, INSTALL_DOC (README.md),
# INSTALL_IMAGE_REF (ghcr.io/avigopal/substrate:dev), PODMAN_COMPOSE.
# Exit: 0 when every judged check passes, 1 otherwise, 64 on a harness input error.
set -uo pipefail

ENGINE="${ENGINE:-}"; IMAGE="${IMAGE:-}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DOC="${INSTALL_DOC:-$here/../../../README.md}"
INSTALL_IMAGE_REF="${INSTALL_IMAGE_REF:-ghcr.io/avigopal/substrate:dev}"
RESULT_DIR="${RESULT_DIR:-./network-acceptance-result}"
. "$here/provider-of-key.sh"
ACCEPTANCE_PROVIDER_VAR="$(resolve_provider_var "${ACCEPTANCE_PROVIDER_KEY:-}" "${ACCEPTANCE_PROVIDER_VAR:-}")"
case "$ENGINE" in docker|podman) ;; *) echo "run-network-acceptance: ENGINE must be docker or podman" >&2; exit 64 ;; esac
[ -n "$IMAGE" ] || { echo "run-network-acceptance: IMAGE is required" >&2; exit 64; }
for tool in jq curl awk; do command -v "$tool" >/dev/null 2>&1 || { echo "run-network-acceptance: $tool is required" >&2; exit 64; }; done

mkdir -p "$RESULT_DIR/diag"; RESULT_DIR="$(cd "$RESULT_DIR" && pwd)"
root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/network-acceptance.XXXXXX")"
bin_dir="$root/bin"; mkdir -p "$bin_dir" "$root/hub" "$root/spoke" "$root/spoke2"
log() { printf '[network %s %s] %s\n' "$ENGINE" "$(date -u +%H:%M:%S)" "$*" >&2; }

# Prefixes are overridable for a run on a host that already uses some of them.
HUB_NAME=nethub; HUB_PREFIX="${NET_HUB_PREFIX:-25}"; SPOKE_NAME=netspoke; SPOKE_PREFIX="${NET_SPOKE_PREFIX:-27}"
SPOKE2_NAME=netspoke2; SPOKE2_PREFIX="${NET_SPOKE2_PREFIX:-29}"
HUB_C="${HUB_NAME}-live"; SPOKE_C="${SPOKE_NAME}-live"; SPOKE2_C="${SPOKE2_NAME}-live"

# The page says `docker`; on the Podman leg it means Podman (same shim as run-acceptance).
if [ "$ENGINE" = "podman" ]; then
  pc="${PODMAN_COMPOSE:-$(command -v podman-compose || true)}"; pm="$(command -v podman || true)"
  [ -n "$pm" ] && [ -n "$pc" ] || { echo "run-network-acceptance: podman leg needs podman and podman-compose" >&2; exit 64; }
  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
if [ "\${1:-}" = "compose" ]; then shift; exec "$pc" "\$@"; fi
exec "$pm" "\$@"
EOF
  chmod +x "$bin_dir/docker"
fi
export PATH="$bin_dir:$PATH"
eng() { "$ENGINE" "$@"; }

# Where each side reaches the other. The hub advertises the host's address for its relay
# (the spoke's transport dials it); the spoke reaches the hub's HTTP by the address a
# container on this engine can use for its host. Rootless Podman cannot reach the host's
# LAN address from a container (README § Installation, "A hub on the same host").
host_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") print $(i + 1)}')"
[ -n "$host_ip" ] || host_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$host_ip" ] || { echo "run-network-acceptance: cannot determine the host address" >&2; exit 64; }
if [ "$ENGINE" = "podman" ]; then join_host=host.containers.internal; else join_host="$host_ip"; fi
join_url="http://${join_host}:${HUB_PREFIX}100"

checks='{}'
set_check() { checks="$(jq -c --arg k "$1" --arg r "$2" --argjson d "${3:-null}" '. + {($k): {result: $r, detail: $d}}' <<<"$checks")"; }
secrets=("${ACCEPTANCE_PROVIDER_KEY:-}")
redact() { local t="$1" v; for v in "${secrets[@]}"; do [ -n "$v" ] && t="${t//"$v"/<redacted>}"; done; printf '%s' "$t"; }

# Run one case's fences in a directory, with the page's placeholders filled.
#   run_case <case> <dir> <from1> <to1> [<from2> <to2> …]
run_case() {
  local case="$1" dir="$2"; shift 2
  local fdir="$root/fences-$case" rc=0 from="" to="" US=$'\x1f'
  "$here/extract-install-fences.sh" --case "$case" --out "$fdir" "$INSTALL_DOC" >/dev/null 2>"$RESULT_DIR/diag/extract-$case.err" || return 90
  from="${INSTALL_IMAGE_REF}${US}"; to="${IMAGE}${US}"
  while [ $# -ge 2 ]; do from="${from}${1}${US}"; to="${to}${2}${US}"; shift 2; done
  : >"$dir/blocks.sh"
  while IFS=$'\t' read -r _n _line _cases path; do
    SUB_FROM="$from" SUB_TO="$to" awk '
      BEGIN { n = split(ENVIRON["SUB_FROM"], F, "\037"); split(ENVIRON["SUB_TO"], T, "\037") }
      { line = $0
        for (k = 1; k <= n; k++) { if (F[k] == "") continue
          out = ""; s = line
          while ((i = index(s, F[k])) > 0) { out = out substr(s, 1, i - 1) T[k]; s = substr(s, i + length(F[k])) }
          line = out s }
        print line }' "$path" >>"$dir/blocks.sh"
  done <"$fdir/index.tsv"
  ( cd "$dir" && bash --noprofile --norc -eo pipefail "$dir/blocks.sh" ) 2>&1 \
    | while IFS= read -r l; do redact "$l"; printf '\n'; done >"$RESULT_DIR/diag/fences-$case.log"
  rc="${PIPESTATUS[0]}"
  return "$rc"
}

[ -n "${ACCEPTANCE_PROVIDER_KEY:-}" ] && log "provider key exported as $ACCEPTANCE_PROVIDER_VAR"
key_sub_from='ANTHROPIC_API_KEY=sk-ant-…'; key_sub_to="${ACCEPTANCE_PROVIDER_VAR}=${ACCEPTANCE_PROVIDER_KEY:-}"
[ -n "${ACCEPTANCE_PROVIDER_KEY:-}" ] || { key_sub_from='ANTHROPIC_API_KEY=sk-ant-… '; key_sub_to=''; }

# ── 1. The hub, by the page's hub blocks ──────────────────────────────────────────
# Both nodes run the hold channel as declared acceptance installs, so the run judges the
# image it names: a fresh canary converges to origin/dev within minutes of boot and
# restarts what it moves under the checks. The pair is throwaway and the spoke (itself on
# hold, with no push token) is the hub's only peer, so nothing outside it lands into the
# hub's gap store, which is what lets the hub, its holder, hold.
log "installing the hub from the page's install:hub blocks (public address $host_ip)"
SUBSTRATE_NAME="$HUB_NAME" SUBSTRATE_PORT_PREFIX="$HUB_PREFIX" SUBSTRATE_IMAGE="$IMAGE" \
SUBSTRATE_ACCEPTANCE=1 SUBSTRATE_UPDATE_CHANNEL=hold \
METABOB_CONFIG_PATH="$root/hub-config.json" \
  run_case hub "$root/hub" "$key_sub_from" "$key_sub_to" '<address spokes reach>' "$host_ip"
hub_rc=$?
case "$hub_rc" in
  0) set_check hub_install pass '{"exit":0}' ;;
  20) set_check hub_install pass '{"exit":20,"note":"hub installed; its usable wait fell short (no model), which joining does not need"}' ;;
  *) set_check hub_install fail "$(jq -nc --argjson e "$hub_rc" '{exit: $e}')" ;;
esac

# ── 2. A join token the hub issues, as the page tells the hub operator to ─────────
# On Docker the token is exactly what `substrate-key join` prints: the endpoint the hub
# advertises (its PUBLIC_IP, this host's address) plus a fresh key. Rootless Podman cannot
# reach the host's own address from a container, so on that leg the same token is built
# around the engine's host name, which is what a same-host operator is told to use.
join_token=""; spoke_key=""
if [ "$hub_rc" = 0 ] || [ "$hub_rc" = 20 ]; then
  if [ "$ENGINE" = "podman" ]; then
    spoke_key="$(eng exec "$HUB_C" substrate-key issue network-acceptance-spoke 2>/dev/null | tail -1 | tr -d '[:space:]')"
    [ -n "$spoke_key" ] && join_token="sj1.$(printf '%s\n%s' "$join_url" "$spoke_key" | base64 -w0 | tr '+/' '-_' | tr -d '=')"
  else
    join_token="$(eng exec "$HUB_C" substrate-key join network-acceptance-spoke 2>"$RESULT_DIR/diag/key-join.err" | tail -1 | tr -d '[:space:]')"
  fi
fi
secrets+=("$spoke_key" "$join_token")
case "$join_token" in sj1.?*) set_check join_token pass null ;; *) set_check join_token fail "$(jq -nc --arg e "$(head -c 300 "$RESULT_DIR/diag/key-join.err" 2>/dev/null)" '{stderr: $e}')" ;; esac

# ── 3. The spoke, by the page's spoke blocks: two inputs ──────────────────────────
spoke_rc=99
if [ -n "$join_token" ]; then
  log "installing the spoke from the page's install:spoke blocks, with the hub's join token"
  SUBSTRATE_NAME="$SPOKE_NAME" SUBSTRATE_PORT_PREFIX="$SPOKE_PREFIX" SUBSTRATE_IMAGE="$IMAGE" \
  SUBSTRATE_ACCEPTANCE=1 SUBSTRATE_UPDATE_CHANNEL=hold \
  METABOB_CONFIG_PATH="$root/spoke-config.json" \
    run_case spoke "$root/spoke" '<join token from the hub>' "$join_token"
  spoke_rc=$?
fi
case "$spoke_rc" in
  0|20) set_check spoke_install pass "$(jq -nc --argjson e "$spoke_rc" '{exit: $e}')" ;;
  *) set_check spoke_install fail "$(jq -nc --argjson e "$spoke_rc" '{exit: $e}')" ;;
esac

# ── 4. What joining is for ────────────────────────────────────────────────────────
poll() { # <seconds> <command…>: re-run until it succeeds or time runs out
  local deadline=$(( $(date +%s) + $1 )); shift
  while :; do "$@" && return 0; [ "$(date +%s)" -ge "$deadline" ] && return 1; sleep 10; done
}
if [ "$spoke_rc" = 0 ] || [ "$spoke_rc" = 20 ]; then
  if eng exec "$SPOKE_C" substrate-status --quick --level seeded >"$RESULT_DIR/diag/spoke-seeded.txt" 2>&1; then
    set_check spoke_seeded pass "$(jq -nc --arg e "$(sed -n 's/^ *seeded *pass *//p' "$RESULT_DIR/diag/spoke-seeded.txt" | head -1)" '{evidence: $e}')"
  else set_check spoke_seeded fail null; fi

  # reservationsHeld is what the relay granted; activeReservations counts listen addresses and
  # reads 1 on a phantom (a circuit advertised with no reservation behind it).
  reservations() { r="$(eng exec "$SPOKE_C" curl -s -m5 http://127.0.0.1:8401/health 2>/dev/null | jq -r '.transport.reservationsHeld // 0')"; [ "${r:-0}" -ge 1 ] 2>/dev/null; }
  if poll 180 reservations; then set_check relay_reservation pass "$(jq -nc --argjson n "$r" '{reservationsHeld: $n}')"
  else set_check relay_reservation fail "$(jq -nc --arg n "${r:-0}" '{reservationsHeld: $n}')"; fi

  spoke_id="$(eng exec "$SPOKE_C" sh -c 'sed -n "s/^FED_SUBSTRATE_ID=//p" /etc/substrate/env | tr -d "\""' 2>/dev/null | head -1)"
  hub_key="$(jq -r '.metabob.apiKey // empty' "$root/hub-config.json" 2>/dev/null)"; secrets+=("$hub_key")
  # Addressed by SHAPE, not by vessel name: whichever vessel on the spoke advertises
  # fileContent is the one the hub reads through. Which vessels a node runs is placement,
  # never something a caller (or this check) may depend on.
  target=""
  registered() {
    target="$(eng exec "$HUB_C" curl -s -m10 -H "Authorization: ApiKey $hub_key" -H 'Content-Type: application/json' \
      -X POST http://127.0.0.1:8100/resolve -d '{"pointer":{"type":"vesselCapability","shape":"fileContent"}}' 2>/dev/null \
      | jq -r --arg s "@${spoke_id}" '[.content.vessels[]? | select(((.id // .vesselId) | endswith($s)) and .protocol == "libp2p" and ((.libp2p_multiaddr // []) | length) > 0) | (.id // .vesselId)][0] // empty')"
    [ -n "$target" ]
  }
  if [ -n "$spoke_id" ] && [ -n "$hub_key" ] && poll 300 registered; then
    set_check hub_registration pass "$(jq -nc --arg t "$target" '{row: $t, protocol: "libp2p", shape: "fileContent"}')"
  else set_check hub_registration fail "$(jq -nc --arg s "@${spoke_id}" '{wanted: ("a fileContent producer ending " + $s)}')"; fi

  marker="spoke-only-$(date +%s)-$RANDOM"
  # Inside a data directory the file tools serve: /workspace itself is never a tool root,
  # because it holds the fleet's secrets file.
  marker_path=/workspace/validation/network-acceptance-marker.txt
  eng exec "$SPOKE_C" sh -c "mkdir -p /workspace/validation && printf '%s\n' '$marker' > $marker_path" >/dev/null 2>&1
  eng exec "$HUB_C" sh -c "mkdir -p /workspace/validation && printf '%s\n' 'hub-copy-must-not-be-read' > $marker_path" >/dev/null 2>&1
  read_via_spoke() {
    answer="$(eng exec "$HUB_C" curl -s -m40 -H 'Content-Type: application/json' -X POST \
      "http://127.0.0.1:8401/egress/resolve?vessel=${target}" \
      -d "{\"pointer\":{\"type\":\"fileContent\",\"path\":\"$marker_path\"}}" 2>/dev/null)"
    printf '%s' "$answer" | grep -qF "$marker"
  }
  if [ -n "$target" ] && poll 120 read_via_spoke; then
    set_check hub_to_spoke pass "$(jq -nc --arg t "$target" --arg p "$(printf '%s' "$answer" | jq -r '.content.produced_by // empty')" '{vessel: $t, produced_by: $p}')"
  else set_check hub_to_spoke fail "$(jq -nc --arg t "$target" --arg a "$(printf '%s' "${answer:-}" | head -c 300)" '{vessel: $t, answer: $a}')"; fi

  # A goal from the spoke, graded on the hub. Needs a model, so it is judged only with a key.
  if [ -n "${ACCEPTANCE_PROVIDER_KEY:-}" ]; then
    spoke_client_key="$(jq -r '.metabob.apiKey // empty' "$root/spoke-config.json" 2>/dev/null)"; secrets+=("$spoke_client_key")
    done_goal() { rec="$(eng exec "$SPOKE_C" curl -s -m10 -H "Authorization: ApiKey $spoke_client_key" "http://127.0.0.1:8210/executions/$did" 2>/dev/null)"; case "$(jq -r '.status // empty' <<<"$rec")" in running|pending|"") return 1 ;; esac; }
    # Up to three dispatches, the same budget substrate-status gives its own known-answer
    # goal: reach is expected with high probability, not certainty, and one miss must not
    # decide a publish. Every attempt is recorded, so a miss stays visible in the result.
    r=fail; attempts='[]'
    for attempt in 1 2 3; do
      did="$(eng exec "$SPOKE_C" sh -c "curl -s -m30 -X POST http://127.0.0.1:8210/run-goal -H 'Content-Type: application/json' -H 'Authorization: ApiKey $spoke_client_key' -d '{\"goal\":\"Read $marker_path and tell me exactly what it says.\",\"operator\":\"operator:network-acceptance\",\"tags\":[\"network_acceptance\"]}'" 2>/dev/null | jq -r '.dispatchId // empty')"
      reached=""; on_hub=""; quoted=""
      if [ -n "$did" ] && poll 600 done_goal; then
        reached="$(jq -r '.goalReached // .reached // false' <<<"$rec")"; exe="$(jq -r '.executionId // .execution_id // empty' <<<"$rec")"
        on_hub="$(curl -s -m10 -o /dev/null -w '%{http_code}' -H "Authorization: ApiKey $hub_key" "http://localhost:${HUB_PREFIX}080/v2/activities/execution-traces/$exe")"
        # Which copy the answer quoted: the spoke's marker (right), the hub's decoy (the read
        # was placed on the wrong node), or neither (the walk never read the file).
        quoted=neither
        case "$rec" in *"$marker"*) quoted=spoke ;; *hub-copy-must-not-be-read*) quoted=hub_decoy ;; esac
        [ "$reached" = true ] && [ "$on_hub" = 200 ] && [ "$quoted" = spoke ] && r=pass
        # A miss keeps its execution record, so the result says why, not only that it missed.
        [ "$r" = pass ] || printf '%s\n' "$rec" >"$RESULT_DIR/diag/spoke-goal-$attempt.json"
      fi
      attempts="$(jq -c --arg d "${did:-}" --arg re "${reached:-not finished in 600s}" --arg h "${on_hub:-}" --arg q "${quoted:-}" '. + [{dispatch: $d, reached: $re, trace_on_hub_http: $h, quoted: $q}]' <<<"$attempts")"
      [ "$r" = pass ] && break
    done
    set_check spoke_goal "$r" "$(jq -nc --argjson a "$attempts" '{attempts: $a}')"
  else
    set_check spoke_goal unknown '{"note":"needs a provider key; not judged"}'
  fi
fi

# ── 5. A spoke leaves, and comes back ─────────────────────────────────────────────
# Joining is half of membership. A second spoke that serves the same shape, with its own
# copy of the marker path, is what a departure is judged against: when the first spoke
# stops, a read ADDRESSED to it must fail honestly, never come back with the second
# spoke's file (the transport's fallback once settled on any live circuit that answered,
# so node-local data was silently served from the wrong node). Then the hub must stop
# offering the departed spoke, and a restart must bring it back under the same identity.
#   leave_no_foreign_answer  an addressed read to the stopped spoke returns neither the
#                            second spoke's marker nor the hub's decoy
#   leave_deadvertised       within 60 s the hub no longer offers the stopped spoke
#   rejoin                   after a start, the spoke is registered again and an addressed
#                            read returns its own marker
if [ -n "${target:-}" ] && [ -n "${hub_key:-}" ]; then
  spoke2_key=""; spoke2_token=""
  if [ "$ENGINE" = "podman" ]; then
    spoke2_key="$(eng exec "$HUB_C" substrate-key issue network-acceptance-spoke2 2>/dev/null | tail -1 | tr -d '[:space:]')"
    [ -n "$spoke2_key" ] && spoke2_token="sj1.$(printf '%s\n%s' "$join_url" "$spoke2_key" | base64 -w0 | tr '+/' '-_' | tr -d '=')"
  else
    spoke2_token="$(eng exec "$HUB_C" substrate-key join network-acceptance-spoke2 2>/dev/null | tail -1 | tr -d '[:space:]')"
  fi
  secrets+=("$spoke2_key" "$spoke2_token")
  first_target="$target"; first_id="$spoke_id"; second_target=""; spoke_dir=""
  spoke2_rc=99
  if [ -n "$spoke2_token" ]; then
    log "installing a second spoke, so a departure has another producer of the same shape"
    SUBSTRATE_NAME="$SPOKE2_NAME" SUBSTRATE_PORT_PREFIX="$SPOKE2_PREFIX" SUBSTRATE_IMAGE="$IMAGE" \
    SUBSTRATE_ACCEPTANCE=1 SUBSTRATE_UPDATE_CHANNEL=hold \
    METABOB_CONFIG_PATH="$root/spoke2-config.json" \
      run_case spoke "$root/spoke2" '<join token from the hub>' "$spoke2_token"
    spoke2_rc=$?
  fi
  spoke2_id="$(eng exec "$SPOKE2_C" sh -c 'sed -n "s/^FED_SUBSTRATE_ID=//p" /etc/substrate/env | tr -d "\""' 2>/dev/null | head -1)"
  marker2="second-spoke-$(date +%s)-$RANDOM"
  eng exec "$SPOKE2_C" sh -c "mkdir -p /workspace/validation && printf '%s\n' '$marker2' > $marker_path" >/dev/null 2>&1
  spoke_id="$spoke2_id"
  if [ "$spoke2_rc" != 0 ] && [ "$spoke2_rc" != 20 ] || [ -z "$spoke2_id" ] || ! poll 300 registered; then
    for c in leave_no_foreign_answer leave_deadvertised rejoin; do
      set_check "$c" unknown "$(jq -nc --argjson e "$spoke2_rc" '{note: "the second spoke did not join, so a departure has nothing to be judged against", spoke2_install_exit: $e}')"
    done
  else
    second_target="$target"
    # A departure is only a test of the fallback if the hub holds a live circuit to another
    # spoke, as it does whenever traffic has flowed. Read the second spoke's own marker
    # first: it proves that spoke is reachable and opens the circuit the fallback walks.
    target="$second_target"; marker_saved="$marker"; marker="$marker2"
    poll 120 read_via_spoke >/dev/null 2>&1 || log "warn: the second spoke's own marker was not readable before the departure"
    marker="$marker_saved"; target="$first_target"
    # The installer writes the fleet into a directory of its own; the container's compose
    # label names it (docker and podman both set it), so stop and start run where the
    # fleet lives rather than where the page's blocks ran.
    spoke_dir="$(eng container inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$SPOKE_C" 2>/dev/null)"
    log "stopping the first spoke the way an operator does (compose stop in its fleet directory ${spoke_dir:-?})"
    # The same compose the page's blocks ran under: on the Podman leg that is podman-compose
    # itself. `podman compose` picks a provider, and on a runner that also has Docker it
    # chose the docker-compose plugin, which found no Podman socket, so the stop never
    # happened (CI run 37046962127, podman leg).
    fleet_compose() { if [ "$ENGINE" = podman ]; then "$pc" "$@"; else eng compose "$@"; fi; }
    ( cd "${spoke_dir:-/nonexistent}" && fleet_compose stop ) >"$RESULT_DIR/diag/spoke-stop.txt" 2>&1
    spoke_id="$first_id"; target="$first_target"
  fi
  # A departure that did not happen cannot be judged: every leave check would pass on a
  # spoke that is still answering. So the stop itself must be observed first.
  if [ -n "${second_target:-}" ] && [ "$(eng container inspect -f '{{.State.Running}}' "$SPOKE_C" 2>/dev/null)" = true ]; then
    for c in leave_no_foreign_answer leave_deadvertised rejoin; do
      set_check "$c" fail "$(jq -nc --arg d "${spoke_dir:-}" '{note: "the first spoke was still running after compose stop, so the departure was never exercised", fleet_dir: $d, log: "diag/spoke-stop.txt"}')"
    done
  elif [ -n "${second_target:-}" ]; then
    gone() { ! registered; }
    if poll 60 gone; then set_check leave_deadvertised pass null
    else set_check leave_deadvertised fail "$(jq -nc --arg t "$first_target" '{still_offered: $t, within_s: 60}')"; fi
    target="$first_target"
    leave_answer="$(eng exec "$HUB_C" curl -s -m40 -H 'Content-Type: application/json' -X POST \
      "http://127.0.0.1:8401/egress/resolve?vessel=${first_target}" \
      -d "{\"pointer\":{\"type\":\"fileContent\",\"path\":\"$marker_path\"}}" 2>/dev/null)"
    leave_by="$(printf '%s' "$leave_answer" | jq -r '.content.produced_by // empty' 2>/dev/null)"
    case "$leave_answer" in
      *"$marker2"*) set_check leave_no_foreign_answer fail "$(jq -nc --arg t "$first_target" --arg b "$leave_by" '{addressed: $t, answered_by: $b, served: "the second spoke'"'"'s file"}')" ;;
      *hub-copy-must-not-be-read*) set_check leave_no_foreign_answer fail "$(jq -nc --arg t "$first_target" --arg b "$leave_by" '{addressed: $t, answered_by: $b, served: "the hub'"'"'s decoy"}')" ;;
      *) set_check leave_no_foreign_answer pass "$(jq -nc --arg t "$first_target" --arg a "$(printf '%s' "$leave_answer" | head -c 200)" '{addressed: $t, answer: $a}')" ;;
    esac
    log "starting the first spoke again"
    ( cd "${spoke_dir:-/nonexistent}" && fleet_compose start ) >>"$RESULT_DIR/diag/spoke-stop.txt" 2>&1
    spoke_id="$first_id"
    if poll 240 registered && poll 120 read_via_spoke; then set_check rejoin pass "$(jq -nc --arg t "$target" '{vessel: $t}')"
    else set_check rejoin fail "$(jq -nc --arg t "${target:-}" --arg a "$(printf '%s' "${answer:-}" | head -c 200)" '{vessel: $t, answer: $a}')"; fi
  fi
fi

# ── Diagnostics and the verdict ───────────────────────────────────────────────────
for c in "$HUB_C" "$SPOKE_C" "$SPOKE2_C"; do
  eng container inspect "$c" >/dev/null 2>&1 || continue
  eng exec "$c" substrate-status --quick >"$RESULT_DIR/diag/status-$c.txt" 2>&1 || true
  # Whole-boot logs: a circuit that never forms is decided minutes before the check
  # gives up, and 120 lines held only the re-dial loop, not its cause. The relay runs
  # as its own unit on the hub, so its side of a reservation or a refused dial is here too.
  eng exec "$c" sh -c 'journalctl -b -u federation-transport-vessel --no-pager -n 1500' >"$RESULT_DIR/diag/transport-$c.log" 2>&1 || true
  eng exec "$c" sh -c 'journalctl -b -u federation-relay --no-pager -n 1500' >"$RESULT_DIR/diag/relay-$c.log" 2>&1 || true
  eng exec "$c" sh -c 'curl -s -m5 http://127.0.0.1:8401/health' >"$RESULT_DIR/diag/transport-health-$c.json" 2>&1 || true
done
# Last: both nodes still run the code the image baked (substrate-status compares each
# vessel's src/ hash with the image's build-time marker). hold stops pull-sync, but other
# writers can still change /vessels, and a verdict about a moved tree is not about the image.
ic='{}'
for c in "$HUB_C" "$SPOKE_C" "$SPOKE2_C"; do
  [ "$c" = "$SPOKE2_C" ] && ! eng container inspect "$c" >/dev/null 2>&1 && continue
  eng exec "$c" substrate-status --level live --json >"$RESULT_DIR/diag/status-end-$c.json" 2>/dev/null || true
  ic="$(jq -c --arg c "$c" --slurpfile s "$RESULT_DIR/diag/status-end-$c.json" '. + {($c): (
          if ($s | length) > 0 and ($s[0].vessels | type) == "array" then
            {moved: [$s[0].vessels[] | select(.running == "moved") | .vessel],
             unchecked: [$s[0].vessels[] | select(.running == "unknown") | .vessel],
             channel: $s[0].update_channel.channel, enforced: $s[0].update_channel.enforced}
          else {why: "substrate-status gave no vessel rows"} end)}' <<<"$ic" 2>/dev/null || echo "$ic")"
done
if jq -e 'to_entries | length >= 2 and all(.value.moved != null and (.value.moved | length) == 0 and (.value.unchecked | length) == 0)' <<<"$ic" >/dev/null 2>&1; then
  set_check image_code pass "$ic"
else set_check image_code fail "$ic"; fi
for f in "$RESULT_DIR"/diag/*; do [ -f "$f" ] && { t="$(cat "$f")"; redact "$t" >"$f"; }; done

failed="$(jq -r '[to_entries[] | select(.value.result == "fail") | .key] | join(",")' <<<"$checks")"
verdict=pass; [ -n "$failed" ] && verdict=fail
jq -n --arg v "$verdict" --arg e "$ENGINE" --arg i "$IMAGE" --arg f "$failed" --argjson c "$checks" \
  '{kind: "network", verdict: $v, engine: $e, image: $i, failing: ($f | split(",") | map(select(. != ""))), checks: $c}' \
  >"$RESULT_DIR/result.json"
log "verdict: $verdict${failed:+ (failing: $failed)}"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && {
  echo "### Network acceptance — $ENGINE: **$verdict**"
  jq -r 'to_entries[] | "- \(.key): \(.value.result)"' <<<"$checks"
} >>"$GITHUB_STEP_SUMMARY"
[ "$verdict" = pass ]
