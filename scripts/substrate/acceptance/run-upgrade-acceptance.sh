#!/usr/bin/env bash
# run-upgrade-acceptance.sh — judge that upgrading a fleet keeps it: the keys it issued,
# its identity, its volumes, and that it actually runs the new image afterwards.
#
# README § Installation says an upgrade is "re-run the install command". An upgrade
# that changed how the signing secret is read once invalidated every key a hub had
# issued, and Podman's compose once kept the old container while reporting success;
# neither is visible to a run that installs one image on a fresh host. This run
# installs the PREVIOUS image, issues a key on it, then re-runs the CANDIDATE's
# installer inside the fleet directory, the way an operator upgrades, and judges:
#
#   before_install    the previous image installs and reaches seeded
#   key_valid_before  a key issued on it validates (the control: proves the address)
#   upgrade_install   the candidate's installer, re-run in the fleet directory, reaches
#                     seeded again
#   image_moved       the container now runs the candidate image
#   key_valid_after   the key issued before the upgrade still validates
#   fleet_seeded      the fleet's own client key still validates (substrate-status)
#   identity_kept     the federation id is the one the fleet had before
#
# Both images are reached through ONE local tag that is moved from the previous image
# to the candidate between the installs, as a registry :dev moves under an operator.
# That is the case compose handles differently per engine: the manifest's image name
# does not change, only what it names.
#
# No model is needed, so no provider key is read. Inputs (environment): ENGINE
# docker|podman, IMAGE (the candidate), PREVIOUS_IMAGE (default: the published :dev),
# RESULT_DIR, PODMAN_COMPOSE.
# Exit: 0 when every check passes, 1 otherwise, 64 on a harness input error.
set -uo pipefail

ENGINE="${ENGINE:-}"; IMAGE="${IMAGE:-}"
PREVIOUS_IMAGE="${PREVIOUS_IMAGE:-ghcr.io/avigopal/substrate:dev}"
RESULT_DIR="${RESULT_DIR:-./upgrade-acceptance-result}"
case "$ENGINE" in docker|podman) ;; *) echo "run-upgrade-acceptance: ENGINE must be docker or podman" >&2; exit 64 ;; esac
[ -n "$IMAGE" ] || { echo "run-upgrade-acceptance: IMAGE is required" >&2; exit 64; }
for tool in jq; do command -v "$tool" >/dev/null 2>&1 || { echo "run-upgrade-acceptance: $tool is required" >&2; exit 64; }; done

mkdir -p "$RESULT_DIR/diag"; RESULT_DIR="$(cd "$RESULT_DIR" && pwd)"
root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/upgrade-acceptance.XXXXXX")"
bin_dir="$root/bin"; fleet="$root/fleet"; mkdir -p "$bin_dir"
log() { printf '[upgrade %s %s] %s\n' "$ENGINE" "$(date -u +%H:%M:%S)" "$*" >&2; }

NAME=upg; PREFIX="${UPGRADE_PREFIX:-26}"; C="${NAME}-live"; TAG="localhost/substrate-upgrade-acceptance:current"

# The installer calls `docker compose`; on the Podman leg that means podman-compose.
if [ "$ENGINE" = "podman" ]; then
  pc="${PODMAN_COMPOSE:-$(command -v podman-compose || true)}"; pm="$(command -v podman || true)"
  [ -n "$pm" ] && [ -n "$pc" ] || { echo "run-upgrade-acceptance: podman leg needs podman and podman-compose" >&2; exit 64; }
  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
if [ "\${1:-}" = "compose" ]; then shift; exec "$pc" "\$@"; fi
exec "$pm" "\$@"
EOF
  chmod +x "$bin_dir/docker"
  # The installer is told --engine podman, so it calls `podman compose`, which hands off
  # to whichever provider it finds first; a runner's docker-compose plugin then wants a
  # Podman socket nothing started. Name the provider the page expects.
  export PODMAN_COMPOSE_PROVIDER="$pc"
fi
export PATH="$bin_dir:$PATH"
eng() { "$ENGINE" "$@"; }

checks='{}'
set_check() { checks="$(jq -c --arg k "$1" --arg r "$2" --argjson d "${3:-null}" '. + {($k): {result: $r, detail: $d}}' <<<"$checks")"; }
secrets=()
redact() { local t="$1" v; for v in "${secrets[@]}"; do [ -n "$v" ] && t="${t//"$v"/<redacted>}"; done; printf '%s' "$t"; }
image_id() { eng image inspect -f '{{.Id}}' "$1" 2>/dev/null | sed 's/^sha256://'; }
validates() { # <key>: identity-vessel's own verdict on it
  eng exec "$C" curl -s -m10 -X POST http://127.0.0.1:8101/v1/keys/validate \
    -H 'Content-Type: application/json' -d "{\"api_key\":\"$1\"}" 2>/dev/null | jq -r '.data.valid // false'
}
fed_id() { eng exec "$C" sh -c 'sed -n "s/^FED_SUBSTRATE_ID=//p" /etc/substrate/env | tr -d "\""' 2>/dev/null | head -1; }

# ── The two images, behind one tag ────────────────────────────────────────────────
log "pulling the previous image ($PREVIOUS_IMAGE) and the candidate ($IMAGE)"
have_or_pull() { eng image inspect "$1" >/dev/null 2>&1 && case "$1" in localhost/*) return 0 ;; esac; eng pull -q "$1" >/dev/null; }
have_or_pull "$PREVIOUS_IMAGE" 2>"$RESULT_DIR/diag/pull-previous.err" || { echo "run-upgrade-acceptance: cannot pull $PREVIOUS_IMAGE" >&2; exit 64; }
have_or_pull "$IMAGE" 2>"$RESULT_DIR/diag/pull-candidate.err" || { echo "run-upgrade-acceptance: cannot pull $IMAGE" >&2; exit 64; }
prev_id="$(image_id "$PREVIOUS_IMAGE")"; cand_id="$(image_id "$IMAGE")"
same_image=false; [ "$prev_id" = "$cand_id" ] && same_image=true
[ "$same_image" = true ] && log "the previous image IS the candidate; this run judges a same-image re-install"

# ── 1. Install the previous image ─────────────────────────────────────────────────
eng tag "$PREVIOUS_IMAGE" "$TAG"
log "installing the previous image as $TAG"
eng run --rm "$PREVIOUS_IMAGE" install 2>"$RESULT_DIR/diag/emit-previous.err" >"$root/install-previous.sh"
( SUBSTRATE_IMAGE="$TAG" METABOB_CONFIG_PATH="$root/client-config.json" \
    sh "$root/install-previous.sh" --name "$NAME" --prefix "$PREFIX" --dir "$fleet" --engine "$ENGINE" --wait seeded ) \
  >"$RESULT_DIR/diag/install-previous.log" 2>&1
before_rc=$?
if [ "$before_rc" = 0 ]; then set_check before_install pass null
else set_check before_install fail "$(jq -nc --argjson e "$before_rc" '{exit: $e}')"; fi

key=""; fed_before=""
if [ "$before_rc" = 0 ]; then
  key="$(eng exec "$C" substrate-key issue upgrade-acceptance 2>"$RESULT_DIR/diag/key-issue.err" | tail -1 | tr -d '[:space:]')"
  secrets+=("$key")
  fed_before="$(fed_id)"
  v="$( [ -n "$key" ] && validates "$key" )"
  if [ "$v" = true ]; then set_check key_valid_before pass null
  else set_check key_valid_before fail "$(jq -nc --arg v "${v:-}" --argjson k "$([ -n "$key" ] && echo true || echo false)" '{issued: $k, valid: $v}')"; fi
fi

# ── 2. Upgrade: move the tag, re-run the candidate's installer in the fleet dir ───
after_rc=99
if [ -n "$key" ]; then
  eng tag "$IMAGE" "$TAG"
  log "upgrading: the tag now names the candidate; re-running its installer inside the fleet directory"
  eng run --rm "$IMAGE" install 2>"$RESULT_DIR/diag/emit-candidate.err" >"$root/install-candidate.sh"
  ( cd "$fleet" && METABOB_CONFIG_PATH="$root/client-config.json" sh "$root/install-candidate.sh" --engine "$ENGINE" --wait seeded ) \
    >"$RESULT_DIR/diag/install-candidate.log" 2>&1
  after_rc=$?
  if [ "$after_rc" = 0 ]; then set_check upgrade_install pass null
  else set_check upgrade_install fail "$(jq -nc --argjson e "$after_rc" '{exit: $e}')"; fi
  # The re-run must have updated this fleet, not nested a new one inside it.
  [ -e "$fleet/substrate" ] && set_check upgrade_install fail '{"note":"the re-run created ./substrate inside the fleet directory instead of updating it"}'
fi

if [ "$after_rc" = 0 ]; then
  running="$(eng container inspect -f '{{.Image}}' "$C" 2>/dev/null | sed 's/^sha256://')"
  if [ "$running" = "$cand_id" ]; then set_check image_moved pass "$(jq -nc --argjson s "$same_image" '{same_image: $s}')"
  else set_check image_moved fail "$(jq -nc --arg r "${running:0:12}" --arg c "${cand_id:0:12}" --arg p "${prev_id:0:12}" '{running: $r, candidate: $c, previous: $p}')"; fi

  v="$(validates "$key")"
  if [ "$v" = true ]; then set_check key_valid_after pass null
  else set_check key_valid_after fail "$(jq -nc --arg v "${v:-}" '{valid: $v, note: "a key issued before the upgrade no longer validates: the effective signing secret changed"}')"; fi

  if eng exec "$C" substrate-status --quick --level seeded >"$RESULT_DIR/diag/status-seeded.txt" 2>&1; then set_check fleet_seeded pass null
  else set_check fleet_seeded fail null; fi

  fed_after="$(fed_id)"
  if [ -n "$fed_before" ] && [ "$fed_after" = "$fed_before" ]; then set_check identity_kept pass null
  else set_check identity_kept fail "$(jq -nc --arg b "$fed_before" --arg a "$fed_after" '{before: $b, after: $a}')"; fi
fi

# ── Diagnostics and the verdict ───────────────────────────────────────────────────
eng exec "$C" substrate-status --quick >"$RESULT_DIR/diag/status.txt" 2>&1 || true
eng logs "$C" 2>&1 | grep -F '[gen-env]' | tail -60 >"$RESULT_DIR/diag/gen-env.log" || true
eng exec "$C" sh -c 'journalctl -u identity-vessel --no-pager -n 80' >"$RESULT_DIR/diag/identity.log" 2>&1 || true
for f in "$RESULT_DIR"/diag/*; do [ -f "$f" ] && { t="$(cat "$f")"; redact "$t" >"$f"; }; done
# The fleet exists only for this run; a host that is not a throwaway runner gets its
# names, ports and kernel keys back (UPGRADE_KEEP=1 keeps it for inspection).
if [ "${UPGRADE_KEEP:-0}" != 1 ] && [ -f "$fleet/docker-compose.yml" ]; then
  ( cd "$fleet" && eng compose down -v -t 60 ) >/dev/null 2>&1 || true
  eng image rm "$TAG" >/dev/null 2>&1 || true
fi

failed="$(jq -r '[to_entries[] | select(.value.result == "fail") | .key] | join(",")' <<<"$checks")"
verdict=pass; [ -n "$failed" ] && verdict=fail
[ "$before_rc" = 0 ] || verdict=fail
jq -n --arg v "$verdict" --arg e "$ENGINE" --arg i "$IMAGE" --arg p "$PREVIOUS_IMAGE" --arg f "$failed" --argjson c "$checks" \
  '{kind: "upgrade", verdict: $v, engine: $e, image: $i, previous_image: $p, failing: ($f | split(",") | map(select(. != ""))), checks: $c}' \
  >"$RESULT_DIR/result.json"
log "verdict: $verdict${failed:+ (failing: $failed)}"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && {
  echo "### Upgrade acceptance — $ENGINE: **$verdict**"
  echo "previous \`$PREVIOUS_IMAGE\` → candidate \`$IMAGE\`"
  jq -r 'to_entries[] | "- \(.key): \(.value.result)"' <<<"$checks"
} >>"$GITHUB_STEP_SUMMARY"
[ "$verdict" = pass ]
