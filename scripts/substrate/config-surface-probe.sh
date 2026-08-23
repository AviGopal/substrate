#!/usr/bin/env bash
# config-surface-probe — measure what the configuration surface ACTUALLY delivers.
#
# WHY THIS EXISTS
#
# Configuration is the one region of this system with no learning loop. Env is
# frozen at process start, invisible to traces and to the walk, so no activity
# selects over it and no posterior grades it. Every other mistake eventually
# surfaces as a reached:false and gets weighted down; a configuration mistake can
# only be found by someone looking directly at it.
#
# Nothing compared the launch lanes against each other. That is why:
#   - the Makefile and gen-env.sh once disagreed about the port-offset bound, so
#     the same hub URL derived different siblings depending on which lane you used;
#   - ENABLED_EXTRA_VESSELS sat inert with no delivery path at all — not passed by
#     any lane, carried by `recreate` into a recipe that drops it, and read from a
#     secrets file nothing writes;
#   - API_KEY_SECRET_PREVIOUS is read at boot and never persisted, so the
#     key-rotation window vanishes on the first recreate without -e.
#
# Each was found by hand, months apart. This script is the check that finds the
# class: same inputs, every lane, diff what comes out the other side.
#
# WHAT IT MEASURES, AND AT WHICH LAYER
#
# It does NOT launch fleets. It runs gen-env.sh inside a throwaway container,
# because gen-env is the allowlist: every vessel unit carries
# EnvironmentFile=/etc/substrate/env and NONE carries PassEnvironment, so a name
# gen-env does not emit is invisible to every vessel no matter how it was passed.
# Comparing lanes at the docker-run layer would compare intentions; comparing at
# gen-env's output compares what a vessel can actually read.
#
# Three outputs per lane:
#   1. the names emitted into /etc/substrate/env      (what vessels can read)
#   2. the names persisted to /workspace/.substrate-secrets  (what survives recreate)
#   3. the value of each sentinel                     (accepted vs silently discarded)
#
# USAGE
#   config-surface-probe.sh                 # report; exit 1 on a regression
#   config-surface-probe.sh --baseline      # rewrite the recorded baseline
#   IMAGE=… config-surface-probe.sh         # probe a different image
#   PROBE_WORKDIR=… config-surface-probe.sh # scratch dir (must be docker-shareable)
#
# Runs on the host (needs docker). Costs no LLM tokens and writes no traces —
# unlike substrate-doctor's arm check and --smoke, it is safe in a loop.
set -uo pipefail

IMAGE="${IMAGE:-ghcr.io/avigopal/substrate:dev}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASELINE="${BASELINE:-$HERE/config-surface-baseline.txt}"
MODE=report
for a in "$@"; do
  case "$a" in
    --baseline) MODE=baseline ;;
    -h|--help)  sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

command -v docker >/dev/null 2>&1 || { echo "[probe] docker not found" >&2; exit 2; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || {
  echo "[probe] image not present locally: $IMAGE" >&2
  echo "[probe] docker pull $IMAGE" >&2
  exit 2
}

# Scratch must be bind-mountable by the docker daemon. On Docker Desktop (and any
# daemon with a file-sharing allowlist) /tmp is typically NOT shared, and the
# failure is a daemon-side "mounts denied" that a redirected run swallows — the
# probe then reports every lane as emitting zero names, which reads exactly like
# a catastrophic regression rather than a broken harness. Default to a directory
# beside the repo, which is shared by construction.
WORK="${PROBE_WORKDIR:-$(mktemp -d "$HERE/../../.config-probe.XXXXXX")}"
# mktemp -d creates the directory; an operator-supplied PROBE_WORKDIR does not.
# Without this the HARDCODED judgment DISABLES ITSELF SILENTLY: the per-lane
# `: > "$WORK/<lane>.unjudged"` fails, the `comm` against it fails, the count
# comparison hits `[: : integer expected` — and the probe still prints
# "matches baseline" and exits 0. A harness that cannot run must say so rather
# than produce a number; that rule is stated in CONFIGURATION_SURFACE.md §6 and
# this was the probe violating it. Fail loudly if the directory is unusable.
mkdir -p "$WORK" 2>/dev/null || { echo "[probe] FATAL: cannot create workdir '$WORK'" >&2; exit 2; }
[ -w "$WORK" ] || { echo "[probe] FATAL: workdir '$WORK' is not writable" >&2; exit 2; }
trap 'rm -rf "$WORK"' EXIT

# ── Sentinels ────────────────────────────────────────────────────────────────
# Deliberately NOT secret-shaped. A value that looks like a key invites a future
# reader to think this script handles credentials; it does not, and must not.
SENTINEL_PREFIX="PROBEVAL"

# QUOTE-BEARING SENTINELS FOR THE NAMES WHOSE VALUES CARRY QUOTES.
#
# Every sentinel here was alphanumeric, which made the probe structurally unable
# to see a QUOTING defect — and there was one: gen-env emitted values with a raw
# `NAME="${VAR}"` wrap and no escaping, so a documented JSON value arrived at its
# consumer as invalid JSON, was swallowed by a console.warn, and produced a fleet
# with zero endpoint arms. The probe ran clean throughout, because a value with
# no quotes in it cannot demonstrate a quote bug.
#
# An instrument that only supplies easy inputs measures how the system handles
# easy inputs. These names are documented as JSON, so JSON is the honest input.
sentinel_for() {
  case "$1" in
    VLLM_ENDPOINTS) printf '[{"baseUrl":"http://PROBEVAL-%s.invalid/v1","models":["PROBEVAL-m1"]}]' "$1" ;;
    LLM_ARMS)       printf '[{"id":"PROBEVAL-arm","model":"PROBEVAL-m","provider":"openai","port":9998}]' ;;
    *)              printf '%s_%s' "$SENTINEL_PREFIX" "$1" ;;
  esac
}

# The provider key is the one input gen-env fails closed without, so a standalone
# probe must supply something. ASSEMBLED, never written literally: a literal
# "sk-ant-…" string here trips the repo's own gitleaks hook, and a committed
# allowlist entry for a credential pattern is a permanent hole in the one check
# that stops a real key from reaching the tree. gen-env only tests this value for
# non-emptiness.
PROBE_LLM_KEY="sk-${SENTINEL_PREFIX}-synthetic-not-a-credential"

# ── Lane extraction ──────────────────────────────────────────────────────────
# Read each lane's variable list FROM THE SOURCE rather than restating it here.
# A hand-maintained copy in this file would be a fifth enumeration of the same
# thing — the exact defect the script exists to detect.

lane_vars_makefile() {  # $1 = first line of recipe, $2 = last
  awk -v s="$1" -v e="$2" 'NR>=s && NR<=e' "$HERE/Makefile" \
    | grep -oE '\-e [A-Z_][A-Z0-9_]*' | awk '{print $2}' | sort -u
}

recipe_bounds() {  # $1 = target name -> "start end"
  awk -v t="^$1:" '
    $0 ~ t {start=NR; next}
    start && /^[a-zA-Z0-9_.-]+:/ {print start", "NR-1; exit}
    END {if (start && !done) print start", "NR}
  ' "$HERE/Makefile" | head -1 | tr -d ' '
}

lane_names() {
  case "$1" in
    run-live)
      local b; b="$(recipe_bounds run-live)"
      lane_vars_makefile "${b%,*}" "${b#*,}" ;;
    run-live-obsidian)
      local b; b="$(recipe_bounds run-live-obsidian)"
      lane_vars_makefile "${b%,*}" "${b#*,}" ;;
    compose)
      # Root compose is canonical; scripts/substrate/docker-compose.yml symlinks it.
      grep -oE '^[[:space:]]+[A-Z_][A-Z0-9_]*:' "$HERE/../../docker-compose.yml" \
        | tr -d ' :' | sort -u ;;
    *) echo "[probe] unknown lane: $1" >&2; return 1 ;;
  esac
}

# ── One probe run ────────────────────────────────────────────────────────────
# Runs gen-env with every name in the lane set to a sentinel, then reports what
# survived. /workspace is a fresh bind mount per run so no persisted state from a
# previous probe (or from a real fleet) can leak in.

probe_lane() {  # $1 = lane name; writes $WORK/<lane>.{env,secrets,values}
  local lane="$1" names envargs=() n
  names="$(lane_names "$lane")" || return 1

  # Names the probe does NOT sentinel, and therefore cannot judge. Recorded per
  # lane so the reporting can exclude them explicitly: an un-sentinelled name has
  # no sentinel to look for, so counting it as "your value was discarded" would
  # be the probe measuring its own abstention.
  : > "$WORK/$lane.unjudged"

  for n in $names; do
    case "$n" in
      # The provider key gates the fail-closed boot, so it must carry a
      # plausible value rather than a sentinel.
      ANTHROPIC_API_KEY)
        envargs+=( -e "$n=$PROBE_LLM_KEY" )
        echo "$n" >> "$WORK/$lane.unjudged" ;;
      # Endpoints: a sentinel here is not merely unjudgeable, it is actively
      # misleading — a non-loopback DISCOVERY_ENDPOINT flips the whole run into
      # spoke mode and measures a different topology than the one requested.
      DISCOVERY_ENDPOINT|HUB_DISCOVERY_URL|ACTIVITY_API_ENDPOINT|IDENTITY_VESSEL_URL|\
      IDENTITY_ENDPOINT|METABOB_ENDPOINT|SURREALDB_URL|REDIS_URL|PEER_DISCOVERY_ENDPOINTS)
        echo "$n" >> "$WORK/$lane.unjudged" ;;
      *) envargs+=( -e "$n=$(sentinel_for "$n")" ) ;;
    esac
  done
  sort -u -o "$WORK/$lane.unjudged" "$WORK/$lane.unjudged"

  local ws="$WORK/ws-$lane"; mkdir -p "$ws"
  # Run the WORKTREE's gen-env, not the image's baked copy.
  #
  # The probe also greps the worktree gen-env for its persisted_secret call
  # sites. Executing the baked copy while reading the worktree copy compares two
  # different revisions and attributes the difference to the substrate: after
  # editing gen-env, phantom went 2 -> 7 purely because the worktree had gained
  # five reads the baked image had not yet gained writes for. Both halves must
  # come from the same source, and for a pre-commit check that source is the
  # worktree. Set PROBE_USE_IMAGE=1 to measure what is actually published.
  # stderr is KEPT. Swallowing it once turned a daemon-side "mounts denied" into
  # a report that every lane emitted zero names — a harness failure wearing the
  # costume of the most alarming possible finding. A probe that cannot run must
  # say so, never produce a number.
  local genenv_mount=() genenv_cmd='/usr/local/bin/gen-env'
  if [ -z "${PROBE_USE_IMAGE:-}" ]; then
    genenv_mount=( -v "$HERE/gen-env.sh:/probe-gen-env.sh:ro" )
    genenv_cmd='bash /probe-gen-env.sh'
  fi

  docker run --rm -v "$ws:/workspace" "${genenv_mount[@]}" "${envargs[@]}" \
    --entrypoint bash "$IMAGE" -c "
      $genenv_cmd >/dev/null 2>&1 || true
      echo '===ENV==='
      grep -oE '^[A-Z_][A-Z0-9_]*=' /etc/substrate/env 2>/dev/null | tr -d '=' | sort -u
      echo '===SECRETS==='
      grep -oE '^[A-Z_][A-Z0-9_]*=' /workspace/.substrate-secrets 2>/dev/null | tr -d '=' | sort -u
      echo '===VALUES==='
      # READ AT THE CONSUMING LAYER, not off the raw line. Grepping the file text
      # judged the STORED form, so once gen-env began correctly escaping quotes
      # (as it must for JSON values) a perfectly delivered value stopped matching
      # its own sentinel and was reported HARDCODED. What a vessel sees is the
      # SOURCED value; compare that. env -i so nothing is inherited.
      env -i sh -c 'set -a; . /etc/substrate/env 2>/dev/null; set +a; env' 2>/dev/null \
        | grep -E '^[A-Z_][A-Z0-9_]*=.*PROBEVAL' | sort
    " > "$WORK/$lane.raw" 2> "$WORK/$lane.err"
  local rc=$?

  # An empty emission set is never a legitimate measurement: gen-env either
  # fails closed (writing nothing AND exiting non-zero) or writes ~72 names.
  # Zero with a successful run means the probe itself broke.
  if [ "$rc" -ne 0 ] || ! grep -q '^===ENV===' "$WORK/$lane.raw"; then
    echo "[probe] FATAL: lane '$lane' did not run." >&2
    sed 's/^/[probe]   /' "$WORK/$lane.err" >&2
    exit 2
  fi

  awk '/^===ENV===/{f="env";next} /^===SECRETS===/{f="sec";next} /^===VALUES===/{f="val";next} f=="env"' \
    "$WORK/$lane.raw" > "$WORK/$lane.env"
  awk '/^===SECRETS===/{f="sec";next} /^===VALUES===/{f="val";next} f=="sec"' \
    "$WORK/$lane.raw" > "$WORK/$lane.secrets"
  awk '/^===VALUES===/{f="val";next} f=="val"' \
    "$WORK/$lane.raw" > "$WORK/$lane.values"

  printf '%s\n' "$names" > "$WORK/$lane.offered"
}

# ── Findings ─────────────────────────────────────────────────────────────────

report_lane() {
  local lane="$1" offered emitted dropped
  offered="$(wc -l < "$WORK/$lane.offered" | tr -d ' ')"
  emitted="$(wc -l < "$WORK/$lane.env" | tr -d ' ')"

  echo "## lane: $lane"
  echo "   offered by lane: $offered    emitted by gen-env: $emitted"

  # A name the lane passes that gen-env never emits is delivered to nothing:
  # no unit carries PassEnvironment, so it cannot reach any vessel.
  # Two names are consumed at ENTRYPOINT time, before systemd starts, and so
  # legitimately never appear in the env file: LLM_ARMS (render-llm-arms.sh reads
  # it from the container env) and ALLOW_INSECURE_API_KEY_SECRET (a gen-env branch
  # condition, never a delivered value). Listing them as defects every run trains
  # a reader to skim the section, which is how a real entry gets missed.
  dropped="$(comm -23 "$WORK/$lane.offered" "$WORK/$lane.env" \
             | grep -vxE 'LLM_ARMS|ALLOW_INSECURE_API_KEY_SECRET')"
  # Persist for the baseline comparison, not just for the eye. These lists were
  # printed and then discarded: the compared summary held counts only, so a
  # value-replacement regression — a name that starts being overwritten by a
  # literal — changed no count and the probe printed "matches baseline" and
  # exited 0. A check that cannot fail on the defect it is looking at is not a
  # check.
  printf '%s\n' $dropped | grep -v '^$' | sort > "$WORK/$lane.dropped" || true
  if [ -n "$dropped" ]; then
    echo "   DROPPED (lane passes it, no vessel can read it):"
    printf '     %s\n' $dropped
  fi

  # A sentinel that did not survive into the value was overwritten by a literal.
  # `-e TRACE_STORE_CAP=999` emerging as 150000 is the canonical case.
  #
  # Judge ONLY names that actually carried a sentinel. Comparing against every
  # emitted name counted the probe's own abstentions (the provider key, the nine
  # endpoints) as discarded values — ten false positives, and they looked
  # entirely plausible, which is what made them dangerous.
  local accepted judged discarded
  accepted="$(cut -d= -f1 < "$WORK/$lane.values" | sort -u)"
  judged="$(comm -23 <(comm -12 "$WORK/$lane.offered" "$WORK/$lane.env") \
                     "$WORK/$lane.unjudged")"
  discarded="$(comm -23 <(printf '%s\n' "$judged") <(printf '%s\n' "$accepted"))"
  printf '%s\n' $discarded | grep -v '^$' | sort > "$WORK/$lane.hardcoded" || true

  # MANGLED: the name is emitted and the value still carries the marker, but it
  # is not BYTE-IDENTICAL to what we supplied.
  #
  # "accepted" above asks whether the emitted value CONTAINS the sentinel marker.
  # A quoting defect does not remove the marker — it removes the quotes around
  # it — so a corrupted JSON value still contained PROBEVAL and passed. The probe
  # reported clean against an image whose gen-env demonstrably destroyed the
  # value. A contains-check cannot see damage that leaves the substring intact;
  # compare the whole value.
  # SCOPED to names whose value must arrive VERBATIM. gen-env legitimately
  # DERIVES many values — CONCEPT_DB_API_KEY aliases the metabob key,
  # DISCOVERY_PUBLIC_URL is built from PUBLIC_IP, FED_VESSEL_ID is composed — so
  # an unscoped byte-comparison reports nine false positives and would be
  # switched off within a week. The names below are documented as JSON: for them
  # "transformed" and "corrupted" are the same thing, and there is no legitimate
  # derivation to confuse it with.
  local mangled=""
  local _mn _mgot _mwant
  while IFS= read -r _mn; do
    [ -n "$_mn" ] || continue
    case "$_mn" in VLLM_ENDPOINTS|LLM_ARMS) ;; *) continue ;; esac
    _mgot="$(awk -F= -v n="$_mn" '$1==n{sub("^"n"=",""); print; exit}' "$WORK/$lane.values")"
    [ -n "$_mgot" ] || continue
    _mwant="$(sentinel_for "$_mn")"
    [ "$_mgot" = "$_mwant" ] || mangled="$mangled $_mn"
  done <<< "$(printf '%s\n' "$accepted")"
  printf '%s\n' $mangled | grep -v '^$' | sort > "$WORK/$lane.mangled" || true
  if [ -n "$mangled" ]; then
    echo "   MANGLED (emitted, marker intact, but the value was CORRUPTED in transit):"
    for _mn in $mangled; do
      echo "     $_mn"
      echo "       supplied: $(sentinel_for "$_mn")"
      echo "       arrived : $(awk -F= -v n="$_mn" '$1==n{sub("^"n"=",""); print; exit}' "$WORK/$lane.values")"
    done
  fi

  if [ -n "$discarded" ]; then
    echo "   HARDCODED (emitted, but your value was replaced by a literal):"
    printf '     %s\n' $discarded
  fi
  local nunjudged; nunjudged="$(grep -c . "$WORK/$lane.unjudged" || true)"
  [ "$nunjudged" -gt 0 ] && echo "   (not judged — no sentinel supplied: $nunjudged names)"

  # UNOFFERED: documented in .env.example, but this lane does not pass it.
  #
  # This is the axis the probe could not see, and it is the one that mattered.
  # Every other check here starts from what a lane ALREADY passes, so a variable
  # the lane never passes at all is outside the whole field of view — it drops
  # out before DROPPED can consider it. Both documented safety switches
  # (MITOSIS_DIRECT_PUSH, ROUTE_EDIT_INTENT_TO_COMPOSE) sat in that hole: the
  # make lane silently discarded a `0` and both resolved to their permissive
  # defaults, while this probe printed "matches baseline" and exited 0.
  #
  # Compare against the operator-facing contract (.env.example), because that is
  # what a reader believes they can set. Compose-mechanics names are excluded:
  # compose consumes them to build the run rather than forwarding them.
  local envex unoffered
  envex="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.env.example"
  if [ -f "$envex" ]; then
    unoffered="$(comm -23 \
      <(grep -oE '^#? ?[A-Z_][A-Z0-9_]*=' "$envex" | sed 's/^# *//;s/=$//' \
        | grep -vxE '.*_PORT|SUBSTRATE_CONTAINER|SUBSTRATE_IMAGE|WORKSPACE_VOLUME|SURREAL_VOLUME' | sort -u) \
      "$WORK/$lane.offered")"
    printf '%s\n' $unoffered | grep -v '^$' | sort > "$WORK/$lane.unoffered" || true
    if [ -n "$unoffered" ]; then
      echo "   UNOFFERED (.env.example documents it; this lane never passes it):"
      printf '     %s\n' $unoffered
    fi
  else
    : > "$WORK/$lane.unoffered"
  fi
  echo
}

echo "[probe] image: $IMAGE"
echo "[probe] measuring at gen-env output — the layer a vessel actually reads"
echo

LANES="run-live run-live-obsidian compose"
for l in $LANES; do probe_lane "$l"; done
for l in $LANES; do report_lane "$l"; done

# ── Cross-lane differential ──────────────────────────────────────────────────
# The finding the per-lane view cannot produce: two lanes that claim to launch
# the same thing and do not.
echo "## cross-lane differential"
for a in $LANES; do
  for b in $LANES; do
    [ "$a" = "$b" ] && continue
    only="$(comm -23 "$WORK/$a.offered" "$WORK/$b.offered")"
    [ -z "$only" ] && continue
    echo "   in $a but NOT in $b:"
    printf '     %s\n' $only
  done
done
echo

# ── Persistence differential ─────────────────────────────────────────────────
# What survives `docker rm` + recreate. A name read from .substrate-secrets that
# nothing writes there is a phantom: the code consults it forever and it is never
# there.
echo "## persistence (run-live lane)"
persisted="$(cat "$WORK/run-live.secrets")"
# Strip comments before extracting call sites: gen-env's own prose mentions
# `$(persisted_secret X)` while explaining the subshell rule, and a naive grep
# reports X as a phantom secret — a finding invented by the scanner.
read_back="$(sed 's/#.*//' "$HERE/gen-env.sh" \
             | grep -oE 'persisted_secret [A-Z_][A-Z0-9_]*' \
             | awk '{print $2}' | sort -u)"
phantom="$(comm -23 <(printf '%s\n' "$read_back") <(printf '%s\n' "$persisted"))"
if [ -n "$phantom" ]; then
  echo "   PHANTOM (gen-env reads it from .substrate-secrets; nothing writes it):"
  printf '     %s\n' $phantom
fi
notpersisted="$(comm -23 "$WORK/run-live.env" <(printf '%s\n' "$persisted"))"
echo "   emitted but not persisted: $(printf '%s\n' "$notpersisted" | grep -c . || true) names"
echo

# ── Baseline comparison ──────────────────────────────────────────────────────
SUMMARY="$WORK/summary.txt"
{
  for l in $LANES; do
    echo "lane=$l offered=$(wc -l < "$WORK/$l.offered" | tr -d ' ') emitted=$(wc -l < "$WORK/$l.env" | tr -d ' ')"
    # NAMES, not counts. A regression that swaps one dropped name for another
    # leaves the count identical, so counts alone cannot see it — and the two
    # axes that describe how a value is LOST are exactly the ones worth
    # regression-guarding.
    echo "lane=$l dropped=$(tr '\n' ',' < "$WORK/$l.dropped" 2>/dev/null | sed 's/,$//')"
    echo "lane=$l hardcoded=$(tr '\n' ',' < "$WORK/$l.hardcoded" 2>/dev/null | sed 's/,$//')"
    echo "lane=$l unoffered=$(tr '\n' ',' < "$WORK/$l.unoffered" 2>/dev/null | sed 's/,$//')"
    echo "lane=$l mangled=$(tr '\n' ',' < "$WORK/$l.mangled" 2>/dev/null | sed 's/,$//')"
  done
  echo "phantom=$(printf '%s\n' "$phantom" | grep -c . || true)"
} > "$SUMMARY"

if [ "$MODE" = baseline ]; then
  cp "$SUMMARY" "$BASELINE"
  echo "[probe] baseline written: $BASELINE"
  cat "$BASELINE"
  exit 0
fi

if [ -f "$BASELINE" ]; then
  if diff -u "$BASELINE" "$SUMMARY" > "$WORK/drift.diff"; then
    echo "[probe] matches baseline"
    exit 0
  fi
  echo "[probe] DRIFT from baseline:"
  cat "$WORK/drift.diff"
  echo "[probe] if this change is intended: config-surface-probe.sh --baseline"
  exit 1
fi

echo "[probe] no baseline recorded yet — run with --baseline to establish one"
cat "$SUMMARY"
exit 0
