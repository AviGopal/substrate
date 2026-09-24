#!/usr/bin/env bash
# run-acceptance — execute the install page on a cold host and judge what it produced.
#
# WHY THIS EXISTS
#
# Setup runs before any substrate exists, so its detector cannot be an activity on the
# instance being installed, and an image must not grade itself. Every earlier setup audit
# ran on one host, with the image already local, the operator's credentials ambient and
# its own driver instead of the documented commands; none of their greens was ever
# measured off-host or on a pulled image. This is the judge that removes those
# advantages: a fresh runner, a fresh HOME, no client config, no credential cache, no
# local image, no pre-existing volumes, and the install page's own `install` blocks run
# verbatim (extract-install-fences.sh), once per container engine.
#
# WHAT IT JUDGES
#
#   1. cold        the host really is cold (no image, container, volumes or listening
#                  ports of the fleet, no client config, no registry credential cache,
#                  no bun on the fences' PATH)
#   2. fences      every `install` block for the case runs to completion, in page order,
#                  in one shell (cwd and variables carry over, as in a reader's terminal),
#                  with errexit: the first failing command names its block and line
#   3. levels      the image's own verdict, `substrate-status`, for live · seeded ·
#                  served · usable · connected (pass | fail | unknown; unknown never
#                  passes). Read AFTER step 4 below, because `connected` is the
#                  container observing an authenticated request arrive through a
#                  published port, and this run is what makes that request.
#   4. connection  the client config the page wrote (~/.metabob/config.json in the fresh
#                  HOME) names a local endpoint; one authenticated request through the
#                  published port answers 2xx; the cockpit itself (`npx @metabob/mcp`,
#                  the registration the page prints) answers a registry_query with at
#                  least one shape
#   5. contract    the published manifest is Docker-format (so HEALTHCHECK survives
#                  Podman), the launched container carries a healthcheck, the image
#                  carries its revision label and file, and the container's stop timeout
#                  covers the longest vessel drain plus the datastore flush
#
# MODES
#
#   gating       ACCEPTANCE_PROVIDER_KEY is set: everything above must pass, through
#                `connected` and a cockpit answer.
#   report-only  no provider key: `usable` needs an LLM arm, so usable, connected, the
#                authenticated request and the cockpit query are recorded but not
#                judged. live · seeded · served, every block, and the contract checks
#                still fail the run; the one block failure excused is the page's own
#                `substrate-status --wait` (or --level) for usable or connected.
#
# A block that stops at a wait for a judged level that reads short is reported as that
# level (the failing step names the level and carries the block as evidence), so
# "reaches served but no goal can be reached" names `usable`.
#
# The only inputs a fence sees are HOME (fresh), PATH, the locale, XDG_RUNTIME_DIR and
# DBUS_SESSION_BUS_ADDRESS for rootless Podman, the provider key under the page's
# variable name, SUBSTRATE_IMAGE, and for the hub and spoke cases the values the
# page leaves as placeholders (PUBLIC_IP; DISCOVERY_ENDPOINT + METABOB_API_KEY).
# The manifest reads the environment ahead of .env, so the placeholders the page
# writes into .env are outranked by these without rewriting the page.
# One substitution is applied to the page text and recorded in the result: the page's
# public image reference (INSTALL_IMAGE_REF) becomes the digest under test, so a run
# judges the image that was published, not whatever the tag points at when it starts.
#
# ENVIRONMENT
#   ENGINE                    docker | podman                               (required)
#   IMAGE                     image under test, a digest reference preferred (required)
#   INSTALL_DOC               the install page             (default: <repo>/README.md)
#   ACCEPTANCE_CASE           which `install:<case>` blocks run   (default: standalone)
#   ACCEPTANCE_PROFILE        profile the case launches            (default: the case)
#   ACCEPTANCE_PROVIDER_KEY   provider key secret; absent means report-only
#   ACCEPTANCE_PROVIDER_VAR   the page's provider variable  (default: ANTHROPIC_API_KEY)
#   ACCEPTANCE_PUBLIC_IP      the hub case's PUBLIC_IP                 (hub: required)
#   ACCEPTANCE_DISCOVERY_ENDPOINT, ACCEPTANCE_METABOB_API_KEY
#                             the spoke case's hub anchor and issued key (spoke: required)
#   INSTALL_IMAGE_REF         image literal the page names
#                                           (default: ghcr.io/avigopal/substrate:dev)
#   ACCEPTANCE_CONTAINER      container the page launches     (default: substrate-live)
#   ACCEPTANCE_PORTS          host ports that must be free before the run
#                                           (default: the page's default 18xxx set)
#   FENCE_TIMEOUT             seconds for the whole fence sequence      (default: 3600)
#   PODMAN_COMPOSE            podman-compose binary for the podman leg
#                                                    (default: podman-compose on PATH)
#   RESULT_DIR                result.json, logs, extracted blocks
#                                                    (default: ./acceptance-result)
#   ACCEPTANCE_RUN_URL        link recorded in the result (CI run URL)
#
# EXIT
#   0 pass or report-only with no judged failure · 1 a judged failure · 64 usage
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../../.." && pwd)"

ENGINE="${ENGINE:-}"
IMAGE="${IMAGE:-}"
INSTALL_DOC="${INSTALL_DOC:-$repo_root/README.md}"
ACCEPTANCE_CASE="${ACCEPTANCE_CASE:-standalone}"
ACCEPTANCE_PROFILE="${ACCEPTANCE_PROFILE:-$ACCEPTANCE_CASE}"
ACCEPTANCE_PROVIDER_VAR="${ACCEPTANCE_PROVIDER_VAR:-ANTHROPIC_API_KEY}"
INSTALL_IMAGE_REF="${INSTALL_IMAGE_REF:-ghcr.io/avigopal/substrate:dev}"
ACCEPTANCE_CONTAINER="${ACCEPTANCE_CONTAINER:-substrate-live}"
FENCE_TIMEOUT="${FENCE_TIMEOUT:-3600}"
RESULT_DIR="${RESULT_DIR:-$PWD/acceptance-result}"
ACCEPTANCE_RUN_URL="${ACCEPTANCE_RUN_URL:-}"

case "$ENGINE" in
  docker|podman) ;;
  *) echo "run-acceptance: ENGINE must be docker or podman (got '${ENGINE}')" >&2; exit 64 ;;
esac
[ -n "$IMAGE" ] || { echo "run-acceptance: IMAGE is required" >&2; exit 64; }
[ -r "$INSTALL_DOC" ] || { echo "run-acceptance: install page not readable: $INSTALL_DOC" >&2; exit 64; }
case "$ACCEPTANCE_PROVIDER_VAR" in
  *[!A-Za-z0-9_]*|"") echo "run-acceptance: ACCEPTANCE_PROVIDER_VAR is not a variable name" >&2; exit 64 ;;
esac
for tool in jq curl awk timeout; do
  command -v "$tool" >/dev/null 2>&1 || { echo "run-acceptance: $tool is required on the runner" >&2; exit 64; }
done

mode="report-only"
[ -n "${ACCEPTANCE_PROVIDER_KEY:-}" ] && mode="gating"

mkdir -p "$RESULT_DIR"
RESULT_DIR="$(cd "$RESULT_DIR" && pwd)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/install-acceptance.XXXXXX")"
home_dir="$root/home"; work_dir="$root/work"; bin_dir="$root/bin"; state_dir="$root/state"
mkdir -p "$home_dir" "$work_dir" "$bin_dir" "$state_dir" "$RESULT_DIR/diag"
log() { printf '[acceptance %s %s] %s\n' "$ENGINE" "$(date -u +%H:%M:%S)" "$*" >&2; }

# ── The fence environment ──────────────────────────────────────────────────────
# Built once and used for every engine call below too, so a check sees exactly the
# storage, config and credentials the page saw — no more.
if [ "$ENGINE" = "podman" ]; then
  # The page says `docker`; on the Podman leg that word must mean Podman and nothing
  # else, including when the runner also has a Docker daemon. One compose
  # implementation per engine: podman-compose.
  pc="${PODMAN_COMPOSE:-$(command -v podman-compose || true)}"
  pm="$(command -v podman || true)"
  if [ -z "$pm" ] || [ -z "$pc" ]; then
    echo "run-acceptance: the podman leg needs podman and podman-compose on PATH" >&2; exit 64
  fi
  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
# Acceptance shim: the install page's \`docker\` is Podman on this leg.
if [ "\${1:-}" = "compose" ]; then shift; exec "$pc" "\$@"; fi
exec "$pm" "\$@"
EOF
  chmod +x "$bin_dir/docker"
fi
fence_env=(
  "HOME=$home_dir"
  "PATH=$bin_dir:$PATH"
  "USER=${USER:-$(id -un)}"
  "LOGNAME=${LOGNAME:-$(id -un)}"
  "LANG=C.UTF-8"
  "TERM=dumb"
  "SUBSTRATE_IMAGE=$IMAGE"
)
# Rootless Podman on cgroups v2 needs the user's runtime dir and session bus.
[ -n "${XDG_RUNTIME_DIR:-}" ] && fence_env+=("XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR")
[ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ] && fence_env+=("DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS")
[ -n "${ACCEPTANCE_PROVIDER_KEY:-}" ] && fence_env+=("$ACCEPTANCE_PROVIDER_VAR=$ACCEPTANCE_PROVIDER_KEY")
# The page's placeholders for a hub or spoke case. A case whose placeholder has no
# value is a harness input error, not a page failure: it would launch with the
# literal placeholder and report the page broken.
case "$ACCEPTANCE_CASE" in
  hub)
    [ -n "${ACCEPTANCE_PUBLIC_IP:-}" ] || { echo "run-acceptance: the hub case needs ACCEPTANCE_PUBLIC_IP" >&2; exit 64; } ;;
  spoke)
    if [ -z "${ACCEPTANCE_DISCOVERY_ENDPOINT:-}" ] || [ -z "${ACCEPTANCE_METABOB_API_KEY:-}" ]; then
      echo "run-acceptance: the spoke case needs ACCEPTANCE_DISCOVERY_ENDPOINT and ACCEPTANCE_METABOB_API_KEY" >&2; exit 64
    fi ;;
esac
[ -n "${ACCEPTANCE_PUBLIC_IP:-}" ] && fence_env+=("PUBLIC_IP=$ACCEPTANCE_PUBLIC_IP")
[ -n "${ACCEPTANCE_DISCOVERY_ENDPOINT:-}" ] && fence_env+=("DISCOVERY_ENDPOINT=$ACCEPTANCE_DISCOVERY_ENDPOINT")
[ -n "${ACCEPTANCE_METABOB_API_KEY:-}" ] && fence_env+=("METABOB_API_KEY=$ACCEPTANCE_METABOB_API_KEY")
eng() { env -i "${fence_env[@]}" "$ENGINE" "$@"; }

# Results accumulate here as JSON fragments; result.json is assembled at the end.
checks='{}'
set_check() {  # name result [detail-json]
  local detail="${3:-}"
  [ -n "$detail" ] || detail='{}'
  checks="$(jq -c --arg n "$1" --arg r "$2" --argjson d "$detail" '.[$n] = ({result: $r} + $d)' <<<"$checks")"
}

# ── 1. Cold host ───────────────────────────────────────────────────────────────
warm=()
eng version >"$RESULT_DIR/diag/engine-version.txt" 2>&1 || warm+=("engine does not answer '$ENGINE version' in the fence environment")
eng compose version >"$RESULT_DIR/diag/compose-version.txt" 2>&1 \
  || env -i "${fence_env[@]}" docker compose version >"$RESULT_DIR/diag/compose-version.txt" 2>&1 \
  || warm+=("no compose implementation answers 'docker compose version'")
[ -e "$home_dir/.metabob" ] && warm+=("client config exists before install")
for ref in "$IMAGE" "$INSTALL_IMAGE_REF"; do
  eng image inspect "$ref" >/dev/null 2>&1 && warm+=("image already present locally: $ref")
done
eng container inspect "$ACCEPTANCE_CONTAINER" >/dev/null 2>&1 && warm+=("container already exists: $ACCEPTANCE_CONTAINER")
for v in "${ACCEPTANCE_CONTAINER%-live}-workspace" "${ACCEPTANCE_CONTAINER%-live}-surreal"; do
  eng volume inspect "$v" >/dev/null 2>&1 && warm+=("volume already exists: $v")
done
# The engine's view is not the host's: a fresh HOME gives rootless Podman a fresh
# store, which cannot see a fleet another user or store already runs. A listener on
# a port the page publishes is that fleet, whatever store it lives in.
for port in ${ACCEPTANCE_PORTS:-18080 18090 18100 18101 18210 18250 18260 18270 18310 18333}; do
  (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && warm+=("port $port already answers on this host")
done
# No build toolchain: a page step that quietly builds instead of pulling would pass here
# and fail for a reader who has none. PATH is the runner's, so it is checked as the
# fences see it.
env -i "${fence_env[@]}" bash --noprofile --norc -c 'command -v bun' >/dev/null 2>&1 \
  && warm+=("a build toolchain is on the fence PATH: bun")
# No CLI credential cache: the fresh HOME covers the docker CLI (~/.docker) and
# Podman's per-user file (~/.config/containers); Podman also reads the runtime dir the
# fences inherit, and root's Docker config would serve a rootful daemon's CLI.
for cred in "$home_dir/.docker/config.json" "$home_dir/.config/containers/auth.json" \
            "${XDG_RUNTIME_DIR:+$XDG_RUNTIME_DIR/containers/auth.json}" /root/.docker/config.json; do
  [ -n "$cred" ] && [ -r "$cred" ] && [ -s "$cred" ] && warm+=("a registry credential cache is visible to the fences: $cred")
done
if [ "${#warm[@]}" -gt 0 ]; then
  set_check cold fail "$(printf '%s\n' "${warm[@]}" | jq -R . | jq -sc '{problems: .}')"
else
  set_check cold pass
fi

# ── 2. Extract and run the install blocks ──────────────────────────────────────
fence_dir="$RESULT_DIR/fences"
extract_rc=0
"$here/extract-install-fences.sh" --case "$ACCEPTANCE_CASE" --out "$fence_dir" "$INSTALL_DOC" \
  >"$RESULT_DIR/fences.index" 2>"$RESULT_DIR/diag/extract.err" || extract_rc=$?
fence_total=0
[ -s "$fence_dir/index.tsv" ] && fence_total="$(wc -l <"$fence_dir/index.tsv" | tr -d ' ')"

substitutions=0
fence_rc=0; fence_failed_index=""; fence_failed_line=""; fence_failed_cmd=""; fences_ran=0
if [ "$extract_rc" -ne 0 ]; then
  set_check extraction fail "$(jq -nc --arg e "$(cat "$RESULT_DIR/diag/extract.err")" --argjson rc "$extract_rc" '{exit: $rc, detail: $e}')"
elif [ "${#warm[@]}" -gt 0 ]; then
  set_check extraction pass "$(jq -nc --argjson n "$fence_total" '{blocks: $n}')"
  log "host is not cold; the install blocks are not run (a warm host masks the failures this run exists to find)"
else
  set_check extraction pass "$(jq -nc --argjson n "$fence_total" '{blocks: $n}')"
  run_dir="$root/run"; mkdir -p "$run_dir"
  driver="$run_dir/driver.sh"
  {
    echo 'set -eE'
    echo "trap '[ -e \"$state_dir/err\" ] || printf \"%s\\t%s\\t%s\\n\" \"\$__acceptance_block\" \"\$LINENO\" \"\$BASH_COMMAND\" >\"$state_dir/err\"' ERR"
  } >"$driver"
  while IFS=$'\t' read -r n line _cases path; do
    # The one declared substitution: the page's public tag becomes the digest under test.
    run_copy="$run_dir/$(basename "$path")"
    awk -v from="$INSTALL_IMAGE_REF" -v to="$IMAGE" '
      { out = ""; s = $0
        while ((i = index(s, from)) > 0) { out = out substr(s, 1, i - 1) to; s = substr(s, i + length(from)); hits++ }
        print out s }
      END { printf "%d\n", hits + 0 > "/dev/stderr" }' "$path" >"$run_copy" 2>"$run_dir/hits"
    substitutions=$((substitutions + $(cat "$run_dir/hits")))
    {
      echo "__acceptance_block=$n"
      echo "printf '%s\\t%s\\n' $n $line >\"$state_dir/current\""
      echo "echo \"::group::install block $n (${INSTALL_DOC##*/}:$line)\" >&2"
      echo "source \"$run_copy\""
      echo "echo '::endgroup::' >&2"
      echo "printf '%s\\n' $n >>\"$state_dir/completed\""
    } >>"$driver"
  done <"$fence_dir/index.tsv"
  log "running $fence_total install block(s) from ${INSTALL_DOC##*/} (case $ACCEPTANCE_CASE, $substitutions image reference(s) pinned to the digest)"
  (
    cd "$work_dir" &&
    env -i "${fence_env[@]}" timeout --kill-after=60 "$FENCE_TIMEOUT" \
      bash --noprofile --norc "$driver" </dev/null
  ) 2>&1 | tee "$RESULT_DIR/fences.log"
  fence_rc="${PIPESTATUS[0]}"
  [ -s "$state_dir/completed" ] && fences_ran="$(wc -l <"$state_dir/completed" | tr -d ' ')"
  if [ "$fence_rc" -ne 0 ]; then
    if [ -s "$state_dir/err" ]; then
      IFS=$'\t' read -r fence_failed_index fence_failed_line fence_failed_cmd <"$state_dir/err"
    elif [ -s "$state_dir/current" ]; then
      IFS=$'\t' read -r fence_failed_index _ <"$state_dir/current"
    fi
    [ "$fence_rc" -eq 124 ] && fence_failed_cmd="timed out after ${FENCE_TIMEOUT}s: ${fence_failed_cmd}"
  fi
fi

fence_json='null'
if [ -n "$fence_failed_index" ]; then
  f_path="$(awk -F'\t' -v n="$fence_failed_index" '$1 == n {print $4}' "$fence_dir/index.tsv")"
  f_doc_line="$(awk -F'\t' -v n="$fence_failed_index" '$1 == n {print $2}' "$fence_dir/index.tsv")"
  fence_json="$(jq -nc \
    --argjson i "$fence_failed_index" \
    --arg doc_line "$f_doc_line" \
    --arg block_line "$fence_failed_line" \
    --arg cmd "$fence_failed_cmd" \
    --rawfile text "$f_path" \
    --argjson rc "$fence_rc" \
    '{index: $i, doc_line: ($doc_line | tonumber? // null), block_line: ($block_line | tonumber? // null), command: $cmd, exit: $rc, text: $text}')"
fi

# ── 3–5. Inspect what the page produced ─────────────────────────────────────────
have_container=0
eng container inspect "$ACCEPTANCE_CONTAINER" >"$RESULT_DIR/diag/container-inspect.json" 2>/dev/null && have_container=1

# 5a. Manifest format, read from the registry itself (engine-independent).
registry_manifest() {  # prints "<content-type>\t<body-file>"
  local ref="$1" accept="$2" name reg repo tag host url hdr body auth realm service scope token
  name="${ref%%@*}"; tag="latest"
  [ "$name" != "$ref" ] && tag="${ref#*@}"
  # A tag is a colon in the LAST path component; a colon before it is a registry port.
  if [[ "${name##*/}" == *:* ]]; then
    [ "$name" = "$ref" ] && tag="${name##*:}"
    name="${name%:*}"
  fi
  reg="${name%%/*}"; repo="${name#*/}"
  if [ "$reg" = "$name" ] || { [[ "$reg" != *.* ]] && [[ "$reg" != *:* ]] && [ "$reg" != localhost ]; }; then
    reg="docker.io"; repo="$name"; [[ "$repo" == */* ]] || repo="library/$repo"
  fi
  host="$reg"; [ "$reg" = "docker.io" ] && host="registry-1.docker.io"
  url="https://$host/v2/$repo/manifests/$tag"
  hdr="$root/manifest.hdr"; body="$root/manifest.$RANDOM.json"
  curl -sS -m 30 -D "$hdr" -o "$body" -H "Accept: $accept" "$url" || return 1
  if grep -qiE '^HTTP/[0-9.]+ 401' "$hdr"; then
    auth="$(grep -i '^www-authenticate:' "$hdr" | tail -1 | tr -d '\r')"
    realm="$(sed -n 's/.*realm="\([^"]*\)".*/\1/p' <<<"$auth")"
    service="$(sed -n 's/.*service="\([^"]*\)".*/\1/p' <<<"$auth")"
    scope="$(sed -n 's/.*scope="\([^"]*\)".*/\1/p' <<<"$auth")"
    [ -n "$scope" ] || scope="repository:$repo:pull"
    token="$(curl -sS -m 30 -G "$realm" --data-urlencode "service=$service" --data-urlencode "scope=$scope" | jq -r '.token // .access_token // empty')"
    [ -n "$token" ] || return 1
    curl -sS -m 30 -D "$hdr" -o "$body" -H "Accept: $accept" -H "Authorization: Bearer $token" "$url" || return 1
    printf '%s' "$token" >"$root/manifest.token"
  fi
  grep -qiE '^HTTP/[0-9.]+ 200' "$hdr" || return 1
  printf '%s\t%s\n' "$(grep -i '^content-type:' "$hdr" | tail -1 | cut -d: -f2- | tr -d ' \r')" "$body"
}
accept_all='application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json'
docker_list='application/vnd.docker.distribution.manifest.list.v2+json'
docker_manifest='application/vnd.docker.distribution.manifest.v2+json'
if top="$(registry_manifest "$IMAGE" "$accept_all")"; then
  top_type="${top%%$'\t'*}"; top_body="${top#*$'\t'}"
  child_type="$(jq -r '[.manifests[]? | select(.platform.os == "linux" and .platform.architecture == "amd64")][0].mediaType // empty' "$top_body")"
  attest="$(jq -r '[.manifests[]? | select(.annotations["vnd.docker.reference.type"] == "attestation-manifest")] | length' "$top_body")"
  fmt=fail
  if [ "$top_type" = "$docker_manifest" ]; then fmt=pass
  elif [ "$top_type" = "$docker_list" ] && [ "$child_type" = "$docker_manifest" ]; then fmt=pass
  fi
  set_check image_format "$fmt" "$(jq -nc --arg t "$top_type" --arg c "$child_type" --argjson a "${attest:-0}" \
    '{media_type: $t, platform_media_type: (if $c == "" then null else $c end), attestation_manifests: $a,
      why: "Podman drops HEALTHCHECK from OCI-format images; Docker-format manifests keep it"}')"
else
  set_check image_format unknown '{"detail":"the registry manifest could not be read anonymously"}'
fi

# 5b. Healthcheck on the launched container (the effective one, per engine).
if [ "$have_container" -eq 1 ]; then
  hc="$(eng container inspect --format '{{json .Config.Healthcheck}}' "$ACCEPTANCE_CONTAINER" 2>/dev/null || echo null)"
  if jq -e 'type == "object" and ((.Test // []) | length > 0) and ((.Test // [])[0] != "NONE")' <<<"$hc" >/dev/null 2>&1; then
    set_check healthcheck pass "$(jq -c '{test: .Test}' <<<"$hc")"
  else
    set_check healthcheck fail "$(jq -nc --arg h "$hc" '{detail: ("container has no healthcheck: " + $h)}')"
  fi
else
  set_check healthcheck unknown '{"detail":"no container to inspect"}'
fi

# 5c. Revision label and file.
labels="$(eng image inspect --format '{{json .Config.Labels}}' "$IMAGE" 2>/dev/null || echo null)"
label_rev="$(jq -r '(. // {})["org.opencontainers.image.revision"] // empty' <<<"$labels" 2>/dev/null)"
# The Dockerfile's default when no revision was passed is a placeholder, not a revision.
[ "$label_rev" = "unknown" ] && label_rev=""
file_rev=""
[ "$have_container" -eq 1 ] && file_rev="$(eng exec "$ACCEPTANCE_CONTAINER" cat /etc/substrate/image-revision 2>/dev/null | tr -d '[:space:]')"
if [ -n "$label_rev" ] && [ "$label_rev" = "$file_rev" ]; then
  set_check revision pass "$(jq -nc --arg r "$label_rev" '{revision: $r}')"
elif [ -n "$label_rev" ] || [ -n "$file_rev" ] || [ "$labels" != "null" ]; then
  set_check revision fail "$(jq -nc --arg l "$label_rev" --arg f "$file_rev" '{label: $l, file: $f, detail: "org.opencontainers.image.revision and /etc/substrate/image-revision must both be present and agree"}')"
else
  set_check revision unknown '{"detail":"image not present to inspect"}'
fi

# 5d. Stop timeout versus the drain budget.
#   budget = the longest vessel drain (any *_DRAIN_MS a unit is started with)
#          + the datastore's own stop timeout (its flush allowance)
to_seconds() {  # systemd timespan ("1min 30s", "5min", "90s", "500ms", "infinity") -> seconds
  awk '{
    if ($0 ~ /infinity/) { print "inf"; exit }
    t = 0; s = $0
    while (match(s, /[0-9.]+[a-z]*/)) {
      tok = substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH)
      num = tok; sub(/[a-z]+$/, "", num); unit = tok; sub(/^[0-9.]+/, "", unit)
      if (unit == "" || unit == "s" || unit == "sec") t += num
      else if (unit == "ms" || unit == "msec") t += num / 1000
      else if (unit == "us" || unit == "usec") t += num / 1000000
      else if (unit == "min" || unit == "m") t += num * 60
      else if (unit == "h" || unit == "hr") t += num * 3600
      else if (unit == "d") t += num * 86400
    }
    printf "%d\n", (t == int(t)) ? t : int(t) + 1
  }' <<<"$1"
}
if [ "$have_container" -eq 1 ]; then
  stop_raw="$(eng container inspect --format '{{.Config.StopTimeout}}' "$ACCEPTANCE_CONTAINER" 2>/dev/null || true)"
  case "$stop_raw" in ''|'<nil>'|'<no value>') stop_s=10 ;; *) stop_s="$stop_raw" ;; esac
  stop_via="container"
  # podman-compose never sets the container's StopTimeout from stop_grace_period; it
  # passes the grace as `-t` on `compose stop` / `compose down` only, so inspect
  # reads the engine default on this leg. The page's stop is `docker compose stop`,
  # so on Podman the budget is judged against the grace that command applies: the
  # manifest's stop_grace_period as this leg's compose resolves it. A bare
  # `podman stop` of the container still gets the engine default, which the result
  # records beside it.
  if [ "$ENGINE" = "podman" ]; then
    grace_raw="$(cd "$work_dir" && env -i "${fence_env[@]}" docker compose config 2>/dev/null \
      | awk '/^[[:space:]]*stop_grace_period:/ { v = $2; gsub(/["\047]/, "", v); print v; exit }')"
    if [ -n "$grace_raw" ]; then
      grace_s="$(to_seconds "$grace_raw")"
      if [[ "$grace_s" =~ ^[0-9]+$ ]] && { ! [[ "$stop_s" =~ ^[0-9]+$ ]] || [ "$grace_s" -gt "$stop_s" ]; }; then
        stop_s="$grace_s"; stop_via="compose_stop"
      fi
    fi
  fi
  units_env="$(eng exec "$ACCEPTANCE_CONTAINER" bash -c \
    'systemctl show --property=Id --property=Environment $(systemctl list-units --type=service --all --no-legend --plain | awk "{print \$1}")' 2>/dev/null || true)"
  drain_ms="$(grep -oE '[A-Z0-9_]*DRAIN_MS=[0-9]+' <<<"$units_env" | cut -d= -f2 | sort -n | tail -1)"
  flush_raw="$(eng exec "$ACCEPTANCE_CONTAINER" systemctl show --property=TimeoutStopUSec --value surrealdb.service 2>/dev/null || true)"
  flush_s=""; [ -n "$flush_raw" ] && flush_s="$(to_seconds "$flush_raw")"
  if [ -n "$drain_ms" ] && [ -n "$flush_s" ] && [ "$flush_s" != "inf" ] && [[ "$stop_s" =~ ^[0-9]+$ ]]; then
    budget_s=$(( (drain_ms + 999) / 1000 + flush_s ))
    r=fail; [ "$stop_s" -ge "$budget_s" ] && r=pass
    set_check stop_timeout "$r" "$(jq -nc --argjson s "$stop_s" --argjson b "$budget_s" --argjson d "$(( (drain_ms + 999) / 1000 ))" --argjson f "$flush_s" \
      --arg via "$stop_via" --arg c "$stop_raw" \
      '{stop_timeout_s: $s, budget_s: $b, longest_drain_s: $d, datastore_flush_s: $f, via: $via, container_stop_timeout: $c}')"
  else
    set_check stop_timeout unknown "$(jq -nc --arg s "$stop_raw" --arg d "$drain_ms" --arg f "$flush_raw" \
      '{stop_timeout: $s, longest_drain_ms: $d, datastore_timeout: $f, detail: "drain budget not computable from the running units"}')"
  fi
else
  set_check stop_timeout unknown '{"detail":"no container to inspect"}'
fi

# 4. The connection the page handed the client.
cfg="$home_dir/.metabob/config.json"
endpoint=""; api_key=""
if [ -s "$cfg" ]; then
  endpoint="$(jq -r '.metabob.endpoint // empty' "$cfg" 2>/dev/null)"
  api_key="$(jq -r '.metabob.apiKey // empty' "$cfg" 2>/dev/null)"
fi
local_endpoint=0
[[ "$endpoint" =~ ^https?://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?(/.*)?$ ]] && local_endpoint=1
if [ -z "$endpoint" ] || [ -z "$api_key" ]; then
  set_check client_config fail "$(jq -nc --arg p 'HOME/.metabob/config.json' --argjson e "$([ -s "$cfg" ] && echo true || echo false)" \
    '{path: $p, exists: $e, detail: "the install page left no client config with metabob.endpoint and metabob.apiKey"}')"
elif [ "$local_endpoint" -ne 1 ]; then
  set_check client_config fail "$(jq -nc --arg e "$endpoint" '{endpoint: $e, detail: "the client config does not point at this host; the cockpit would talk to another substrate"}')"
else
  set_check client_config pass "$(jq -nc --arg e "$endpoint" '{endpoint: $e}')"
fi

if [ "$(jq -r '.client_config.result' <<<"$checks")" = "pass" ]; then
  code="$(curl -sS -m 30 -o "$RESULT_DIR/diag/auth-request.body" -w '%{http_code}' \
    -H "Authorization: ApiKey $api_key" "${endpoint%/}/v2/activities/execution-traces?limit=1" 2>"$RESULT_DIR/diag/auth-request.err" || true)"
  r=fail; [[ "$code" =~ ^2 ]] && r=pass
  set_check auth_request "$r" "$(jq -nc --arg u "${endpoint%/}/v2/activities/execution-traces?limit=1" --arg c "$code" '{url: $u, http_status: $c}')"

  # The cockpit itself: the registration the page prints is `npx -y @metabob/mcp`,
  # launched from an empty directory so no project-local config can shadow the one
  # the page wrote.
  if command -v npx >/dev/null 2>&1; then
    cdir="$root/cockpit"; mkdir -p "$cdir/cwd"; mkfifo "$cdir/in"
    ( cd "$cdir/cwd" && env -i "${fence_env[@]}" timeout 300 npx -y @metabob/mcp <"$cdir/in" >"$cdir/out" 2>"$RESULT_DIR/diag/cockpit.err" ) &
    cpid=$!
    exec 7>"$cdir/in"
    wait_for_id() {  # id seconds
      local i
      for ((i = 0; i < $2; i++)); do
        jq -e --argjson id "$1" 'select(.id == $id)' "$cdir/out" >/dev/null 2>&1 && return 0
        kill -0 "$cpid" 2>/dev/null || return 1
        sleep 1
      done
      return 1
    }
    printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"install-acceptance","version":"1"}}}' >&7
    answer=""
    if wait_for_id 1 240; then
      printf '%s\n' '{"jsonrpc":"2.0","method":"notifications/initialized"}' >&7
      printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"registry_query","arguments":{"mode":"shapes"}}}' >&7
      wait_for_id 2 120 && answer="$(jq -r 'select(.id == 2) | [.result.content[]?.text // empty] | join("\n")' "$cdir/out" 2>/dev/null)"
    fi
    exec 7>&-
    kill "$cpid" 2>/dev/null; wait "$cpid" 2>/dev/null
    cp "$cdir/out" "$RESULT_DIR/diag/cockpit.out" 2>/dev/null
    shapes="$(sed -n 's/^Advertised shapes (\([0-9][0-9]*\)).*/\1/p' <<<"$answer" | head -1)"
    r=fail; [ -n "$shapes" ] && [ "$shapes" -gt 0 ] && r=pass
    set_check cockpit_query "$r" "$(jq -nc --arg a "$(head -c 400 <<<"$answer")" --arg n "${shapes:-0}" \
      '{tool: "registry_query", shapes: ($n | tonumber), answer: $a}')"
  else
    set_check cockpit_query fail '{"detail":"npx is not on PATH; the install page requires node/npx for the cockpit"}'
  fi
else
  set_check auth_request unknown '{"detail":"no usable client config"}'
  set_check cockpit_query unknown '{"detail":"no usable client config"}'
fi

# 3. The verdict, read after the request above so `connected` can observe it.
levels='{"live":"unknown","seeded":"unknown","served":"unknown","usable":"unknown","connected":"unknown"}'
status_note=""
image_revision_reported=""
if [ "$have_container" -eq 1 ]; then
  sleep 5
  # substrate-status exits non-zero whenever `usable` is short (always, in report-only
  # mode), and its --json verdict is a complete object either way: the JSON is used
  # whenever it parses, whatever the exit status. Only when it does not parse is the
  # text form read, which is a second evaluation.
  st="$(eng exec "$ACCEPTANCE_CONTAINER" substrate-status --json 2>"$RESULT_DIR/diag/status.err")"
  st_json_rc=$?
  if jq -e 'type == "object"' <<<"$st" >/dev/null 2>&1; then
    printf '%s\n' "$st_json_rc" >"$RESULT_DIR/diag/status.exit"
    printf '%s\n' "$st" >"$RESULT_DIR/diag/status.json"
    # Accept {levels:{live:"pass"}}, {levels:{live:{value:"pass"}}} and [{level,value}] forms.
    levels="$(jq -c --argjson base "$levels" '
      (.levels // .) as $l
      | if ($l | type) == "array" then ($l | map({key: (.level // .name), value: (.value // .result // .status)}) | from_entries)
        else ($l | with_entries(.value = (if (.value | type) == "object" then (.value.value // .value.result // .value.status) else .value end)))
        end
      | $base + with_entries(select(.key | IN("live","seeded","served","usable","connected")))
      | with_entries(.value = (if (.value | IN("pass","fail","unknown")) then .value else "unknown" end))' <<<"$st")"
    image_revision_reported="$(jq -r '.image_revision // .image.revision // empty' <<<"$st")"
  else
    # Text fallback: one "<level> <value>" per line, in any column layout.
    eng exec "$ACCEPTANCE_CONTAINER" substrate-status >"$RESULT_DIR/diag/status.txt" 2>&1
    st_rc=$?
    if [ "$st_rc" -eq 126 ] || [ "$st_rc" -eq 127 ] || grep -qiE 'executable file not found|not found in \$PATH|no such file' "$RESULT_DIR/diag/status.txt"; then
      status_note="substrate-status is not in the image"
    else
      for lv in live seeded served usable connected; do
        v="$(grep -oiE "(^|[^a-z])${lv}[^a-z]+(pass|fail|unknown)" "$RESULT_DIR/diag/status.txt" | head -1 | grep -oiE '(pass|fail|unknown)$' | tr '[:upper:]' '[:lower:]')"
        [ -n "$v" ] && levels="$(jq -c --arg k "$lv" --arg v "$v" '.[$k] = $v' <<<"$levels")"
      done
    fi
  fi
  # Diagnostics only: the verdict is substrate-status's, never re-derived here.
  eng exec "$ACCEPTANCE_CONTAINER" substrate-ready --quick >"$RESULT_DIR/diag/substrate-ready.txt" 2>&1
  eng exec "$ACCEPTANCE_CONTAINER" substrate-key whoami >"$RESULT_DIR/diag/whoami.txt" 2>&1
  eng exec "$ACCEPTANCE_CONTAINER" systemctl --failed --no-legend --plain >"$RESULT_DIR/diag/failed-units.txt" 2>&1
  eng logs --tail 300 "$ACCEPTANCE_CONTAINER" >"$RESULT_DIR/diag/container.log" 2>&1
else
  status_note="the install page launched no container named $ACCEPTANCE_CONTAINER"
fi
digest="$(eng image inspect --format '{{json .RepoDigests}}' "$IMAGE" 2>/dev/null | jq -r '.[0] // empty' 2>/dev/null)"
[ -n "$digest" ] || { [[ "$IMAGE" == *@sha256:* ]] && digest="$IMAGE"; }

# ── Judgement ──────────────────────────────────────────────────────────────────
judged_levels=(live seeded served)
judged_checks=(cold extraction image_format healthcheck revision stop_timeout)
if [ "$mode" = "gating" ]; then
  judged_levels+=(usable connected)
  judged_checks+=(client_config auth_request cockpit_query)
fi
failing='null'
reasons=()
# Order is causal: a warm host or a missing page explains everything after it, a
# failing block explains the levels it never reached, the lowest failing level
# explains the ones above it.
for c in cold extraction; do
  r="$(jq -r --arg c "$c" '.[$c].result // "unknown"' <<<"$checks")"
  if [ "$r" != "pass" ]; then
    reasons+=("check:$c")
    [ "$failing" = 'null' ] && failing="$(jq -nc --arg c "$c" --argjson d "$(jq -c --arg c "$c" '.[$c]' <<<"$checks")" '{kind: "check", name: $c, detail: $d}')"
  fi
done
# A failed block is judged unless the command that stopped it is the page's own wait for
# a level, `substrate-status --wait|--level <level>`:
#   - a wait for a level this mode does not judge (usable or connected, report-only)
#     fails by design and is excused, and only that command is: any other failing
#     command is a page defect, whatever the levels read afterwards;
#   - a wait for a judged level that still reads short is named by that level, not by
#     the block (the reader's question is which level, and the gap is keyed by it); the
#     block that waited is kept on the failing step as evidence;
#   - a wait for a judged level that has since passed is still a failed block: the page
#     told the reader to wait and the wait gave up.
wait_level=""
wait_re='substrate-status([[:space:]].*)?[[:space:]]--(wait|level)(=|[[:space:]]+)([a-z]+)'
[[ "$fence_failed_cmd" =~ $wait_re ]] && wait_level="${BASH_REMATCH[4]}"
level_block_json='null'
if [ "$fence_rc" -ne 0 ]; then
  block_judged=1
  if [ -n "$wait_level" ] && [ -n "$fence_failed_index" ]; then
    if ! printf '%s\n' "${judged_levels[@]}" | grep -qxF "$wait_level"; then
      block_judged=0
      log "block $fence_failed_index stops at a wait for '$wait_level', which $mode mode does not judge; excused"
    elif [ "$(jq -r --arg k "$wait_level" '.[$k] // "unknown"' <<<"$levels")" != "pass" ]; then
      block_judged=0
      level_block_json="$(jq -c '{index, doc_line, block_line, command, exit}' <<<"$fence_json")"
    fi
  fi
  if [ "$block_judged" -eq 1 ]; then
    if [ -n "$fence_failed_index" ]; then
      reasons+=("block:$fence_failed_index")
      [ "$failing" = 'null' ] && failing="$(jq -nc --argjson f "$fence_json" '{kind: "block"} + $f')"
    else
      # The driver stopped before any block began (a timeout, or the shell itself):
      # nothing on the page ran, which is a failure, not an absence of evidence.
      reasons+=("block:none")
      [ "$failing" = 'null' ] && failing="$(jq -nc --arg cmd "$fence_failed_cmd" --argjson rc "$fence_rc" \
        '{kind: "block", index: null, doc_line: null, block_line: null, command: (if $cmd == "" then null else $cmd end), exit: $rc, text: ""}')"
    fi
  fi
fi
for lv in "${judged_levels[@]}"; do
  v="$(jq -r --arg k "$lv" '.[$k]' <<<"$levels")"
  if [ "$v" != "pass" ]; then
    reasons+=("level:$lv=$v")
    blk='null'; [ "$lv" = "$wait_level" ] && blk="$level_block_json"
    [ "$failing" = 'null' ] && failing="$(jq -nc --arg l "$lv" --arg v "$v" --arg n "$status_note" --argjson b "$blk" \
      '{kind: "level", name: $l, value: $v} + (if $n == "" then {} else {detail: $n} end) + (if $b == null then {} else {block: $b} end)')"
  fi
done
for c in "${judged_checks[@]}"; do
  case "$c" in cold|extraction) continue ;; esac
  r="$(jq -r --arg c "$c" '.[$c].result // "unknown"' <<<"$checks")"
  if [ "$r" != "pass" ]; then
    reasons+=("check:$c=$r")
    [ "$failing" = 'null' ] && failing="$(jq -nc --arg c "$c" --argjson d "$(jq -c --arg c "$c" '.[$c]' <<<"$checks")" '{kind: "check", name: $c, detail: $d}')"
  fi
done

if [ "${#reasons[@]}" -gt 0 ]; then verdict=fail
elif [ "$mode" = "gating" ]; then verdict=pass
else verdict=report-only
fi

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
jq -n \
  --arg verdict "$verdict" --arg mode "$mode" --arg engine "$ENGINE" \
  --arg case "$ACCEPTANCE_CASE" --arg profile "$ACCEPTANCE_PROFILE" \
  --arg image "$IMAGE" --arg digest "$digest" --arg install_ref "$INSTALL_IMAGE_REF" \
  --arg doc "${INSTALL_DOC#"$repo_root"/}" --arg container "$ACCEPTANCE_CONTAINER" \
  --arg rev "${image_revision_reported:-$label_rev}" \
  --arg run_url "$ACCEPTANCE_RUN_URL" --arg started "$started_at" --arg finished "$finished_at" \
  --argjson levels "$levels" --argjson checks "$checks" --argjson failing "$failing" \
  --argjson fence_total "$fence_total" --argjson fences_ran "$fences_ran" --argjson fence_rc "$fence_rc" \
  --argjson fence_failed "$fence_json" --argjson subs "$substitutions" \
  --arg status_note "$status_note" \
  --argjson reasons "$(printf '%s\n' "${reasons[@]+"${reasons[@]}"}" | jq -R 'select(. != "")' | jq -sc .)" \
  '{
     kind: "installAcceptance",
     source: "ci_acceptance",
     verdict: $verdict, mode: $mode,
     engine: $engine, case: $case, profile: $profile,
     image: $image, digest: (if $digest == "" then null else $digest end),
     image_revision: (if $rev == "" then null else $rev end),
     install_doc: $doc, install_image_ref: $install_ref, image_ref_substitutions: $subs,
     container: $container,
     levels: $levels,
     status_note: (if $status_note == "" then null else $status_note end),
     blocks: {total: $fence_total, completed: $fences_ran, exit: $fence_rc, failed: $fence_failed},
     checks: $checks,
     failing_step: $failing,
     reasons: $reasons,
     run_url: (if $run_url == "" then null else $run_url end),
     started_at: $started, finished_at: $finished
   }' >"$RESULT_DIR/result.json"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Install acceptance — $ENGINE / $ACCEPTANCE_CASE: **$verdict** ($mode)"
    echo ""
    echo "Image: \`${digest:-$IMAGE}\`"
    echo ""
    echo "| level | value |"; echo "|---|---|"
    jq -r 'to_entries[] | "| \(.key) | \(.value) |"' <<<"$levels"
    echo ""
    echo "| check | result |"; echo "|---|---|"
    jq -r 'to_entries[] | "| \(.key) | \(.value.result) |"' <<<"$checks"
    echo ""
    echo "Blocks: $fences_ran of $fence_total completed."
    if [ "$failing" != 'null' ]; then
      echo ""
      echo "**Failing step:**"
      echo '```json'
      jq . <<<"$failing"
      echo '```'
    fi
    if [ "$mode" = "report-only" ]; then
      echo ""
      echo "_Report-only: no provider key secret, so usable and connected are recorded, not judged._"
    fi
  } >>"$GITHUB_STEP_SUMMARY"
fi

log "verdict: $verdict ($mode)${reasons[*]:+ — ${reasons[*]}}"
[ "$verdict" = "fail" ] && exit 1
exit 0
