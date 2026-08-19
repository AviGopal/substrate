#!/usr/bin/env bash
# PATH C — a NEW network: the full fleet from zero, peered with nobody.
#
# No DISCOVERY_ENDPOINT, so no spoke derivation: this container holds its own
# store, its own identity, its own trace store, and its own registry. That is
# what makes it a network rather than a member of one.
#
# NOTE ON THE RUNBOOK'S OWN STEP 0.2 — deliberately skipped. On this machine three
# submodules sit AHEAD of their recorded gitlink with clean worktrees, so
# `git submodule update --init --recursive` would not abort; it would rewind them
# and discard substrate-authored commits. The image already exists, so neither a
# build nor a submodule sync is needed to run this path.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB=/home/avi/documents/work/substrate
V="python3 $HERE/vidkit.py"
TAG=c
NAME=${NAME:-substrate-demo-net}
OFFSET=${OFFSET:-9000}

# A NEW network must not inherit the HUB's credential. If this runs in the same
# shell as path-b.sh, API_KEY is still exported; Make's `API_KEY ?=` yields to it,
# METABOB_API_KEY := $(API_KEY), and the fresh substrate would boot holding a key
# its own identity-vessel never signed — a network that 401s against itself.
unset API_KEY METABOB_API_KEY
[ -z "${API_KEY:-}${METABOB_API_KEY:-}" ] || { echo "[path-c] hub key still in env — refusing"; exit 1; }
# The git credential IS still wanted: the human surface's workdir is the super-repo clone.
export SUBSTRATE_GIT_PAT="${SUBSTRATE_GIT_PAT:-$(gh auth token 2>/dev/null)}"
[ -n "$SUBSTRATE_GIT_PAT" ] || { echo "[path-c] no git credential (gh auth token)"; exit 1; }
# The full fleet refuses to boot without an LLM provider key — enforced twice, in
# run-live and again in gen-env. Take it from the running substrate's env rather
# than a command line; it never appears in argv, in ps, or in a frame.
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  export ANTHROPIC_API_KEY="$(timeout 30 docker exec substrate-live sh -c 'grep "^ANTHROPIC_API_KEY=" /etc/substrate/env | cut -d= -f2-' 2>/dev/null | tr -d '"')"
fi
[ -n "$ANTHROPIC_API_KEY" ] || { echo "[path-c] no ANTHROPIC_API_KEY — the full fleet refuses to boot"; exit 1; }

$V say $TAG "PATH C — a new network. Full fleet, no hub, nothing to join."
$V say $TAG "skipping the runbook's 'git submodule update' step ON PURPOSE — the submodules listed next are AHEAD of their gitlink, and the sync would silently rewind them."
$V run $TAG -- bash -c "cd $SUB && git submodule status | grep '^+' | awk '{print \$2}'"

$V say $TAG "step 1 — the whole thing is one command. No image build; the local :dev image and its size are printed next."
$V run $TAG -- docker images ghcr.io/avigopal/substrate:dev --format '{{.Repository}}:{{.Tag}}  {{.Size}}  {{.CreatedSince}}'
$V run $TAG -- make -C "$SUB/scripts/substrate" up LIVE_NAME="$NAME" PORT_OFFSET="$OFFSET"
RC=$?


if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  $V say $TAG "stopped at the create step (rc=$RC) — no container to inspect. Recording the refusal, not a partial run."
  exit "$RC"
fi

$V say $TAG "step 2 — this one is a ROOT, not a spoke. Nothing was masked."
$V run $TAG -- timeout 30 docker exec "$NAME" grep -E '^(ENABLED_ROLES|HUB_DISCOVERY_URL|DISCOVERY_ENDPOINT|FED_SUBSTRATE_ID)=' /etc/substrate/env
$V run $TAG -- bash -c "timeout 30 docker exec $NAME systemctl list-units --type=service --state=running --no-legend --no-pager | wc -l | xargs -I{} echo '{} services running'"
$V run $TAG -- bash -c "for u in identity-vessel activity-api surrealdb concept-db goal-host-vessel development-vessel; do printf '%-22s %s\n' \$u \"\$(timeout 30 docker exec $NAME systemctl is-active \$u.service 2>&1)\"; done"

$V say $TAG "step 3 — the seed. A genuine FIRST boot: signup succeeds, so the admin key is minted."
# NOT a verbatim journal dump: on a genuine first boot seed-identity.ts prints SIX
# issued keys in cleartext, one of them admin-scoped. Making redaction catch all six
# on camera is a weaker guarantee than not printing them. Show what the seeder DID,
# and drop any line carrying a key-like token before it ever reaches the log.
$V run $TAG -- bash -c "timeout 60 docker exec $NAME journalctl -u identity-seeder.service -n 40 --no-pager 2>/dev/null \
  | grep -viE 'mb-[A-Za-z0-9]|api[_ ]?key[^s]*[:=] *[A-Za-z0-9]{8}|secret|bearer' | tail -10"
$V run $TAG -- bash -c "timeout 30 docker exec $NAME sh -c 'grep -c \"^SUBSTRATE_ADMIN_KEY=.\\+\" /workspace/.substrate-secrets' | xargs -I{} echo 'SUBSTRATE_ADMIN_KEY present: {} (value never shown)'"
$V say $TAG "on any LATER boot signup returns 409 and that block is never reached — which is why substrate-live has none."

$V say $TAG "step 4 — the first activity templates, minted before any operator asks for anything"
$V run $TAG -- bash -c "timeout 90 docker exec $NAME journalctl -u bootstrap-seeder.service -n 8 --no-pager --output=cat 2>&1 | tail -8; echo \"(journalctl exit \${PIPESTATUS[0]} — 124 would mean it was KILLED, and tail would hide that)\""

$V say $TAG "step 5 — auth on the new network. Rung 2: does THIS identity's secret sign a key it issued?"
$V run $TAG -- bash -c "K=\$(timeout 30 docker exec $NAME sh -c 'grep \"^METABOB_API_KEY=\" /etc/substrate/env | cut -d= -f2-' | tr -d '\"'); \
  curl -s -m 8 http://127.0.0.1:$((OFFSET+18101))/v1/keys/validate -H 'Content-Type: application/json' \
  -d \"{\\\"api_key\\\":\\\"\$K\\\"}\" | jq -c '.data // .'"
$V say $TAG "and the negative control — the HUB's key against THIS identity must NOT validate."
$V run $TAG -- bash -c "curl -s -m 8 http://127.0.0.1:$((OFFSET+18101))/v1/keys/validate -H 'Content-Type: application/json' \
  -d \"{\\\"api_key\\\":\\\"\$(jq -r .metabob.apiKey ~/.metabob/config.json)\\\"}\" | jq -c '.data // .error // .'"

$V say $TAG "step 6 — attach the human surface to the new network"
$V run $TAG -- bash -c "timeout 30 docker exec $NAME mkdir -p /etc/systemd/system/human-surface-vessel.service.d && \
  timeout 30 docker exec $NAME bash -c 'printf \"[Service]\nEnvironment=HOST=0.0.0.0\n\" > /etc/systemd/system/human-surface-vessel.service.d/host.conf' && \
  timeout 30 docker exec $NAME systemctl daemon-reload && echo 'drop-in written'"
$V run $TAG -- "$SUB/scripts/substrate/vessel-ctl.sh" install human-surface-vessel --container "$NAME"
$V run $TAG -- bash -c "for i in 1 2 3 4 5 6 7 8; do c=\$(curl -s -o /dev/null -w '%{http_code}' -m 4 http://127.0.0.1:$((OFFSET+18310))/health); echo \"attempt \$i: /health -> \$c\"; [ \"\$c\" = 200 ] && break; sleep 6; done"

# PROVE THE CONTAINER CARRIES THE FIX. The surface installs from the IN-CONTAINER
# super-repo clone, so a stale clone would put old code on camera under a caption
# saying otherwise — a file read is a snapshot, and this is the frame that dates it.
$V say $TAG "which proxy.ts is this container actually running?"
$V run $TAG -- bash -c "W=\$(timeout 30 docker exec $NAME systemctl show human-surface-vessel -p WorkingDirectory --value 2>/dev/null); \
  echo \"unit WorkingDirectory: \$W\"; \
  timeout 30 docker exec $NAME git -C \"\$W\" log -1 --format='%h %ad %s' --date=short -- src/routes/proxy.ts 2>&1 | head -2"

$V say $TAG "the surface's own goal-shape route — the one the board reads, and the one 4e50f1fa fixed."
$V run $TAG -- bash -c "curl -s -m 25 -X POST http://127.0.0.1:$((OFFSET+18310))/api/resolve \
  -H 'Content-Type: application/json' -d '{\"type\":\"activeDispatches\"}' \
  -w 'HTTP %{http_code}\n' -o /tmp/r.$$ 2>&1; head -c 500 /tmp/r.$$; echo; rm -f /tmp/r.$$"

$V say $TAG "step 7 — its own registry, its own vocabulary. Nothing here was resolved on anyone else's substrate."
$V run $TAG -- bash -c "curl -s -m 6 http://127.0.0.1:$((OFFSET+18100))/registry/stats | jq -c . ; echo"
# substrate-doctor.sh has NO --container flag: it parses only `--smoke` and otherwise
# reads the CONTAINER env var, defaulting to substrate-live. Passing --container would
# have made this closing shot report the operator's production substrate instead.
$V run $TAG -- bash -c "CONTAINER=$NAME $SUB/scripts/substrate/substrate-doctor.sh 2>&1 | head -40"

$V say $TAG "why exit $RC — and note the trap in asking: the readiness verdict prints neither PASS nor FAIL, so a grep for those two words CANNOT see it."
$V run $TAG -- bash -c "CONTAINER=$NAME $SUB/scripts/substrate/substrate-doctor.sh 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'PASS|FAIL|NOT ready|fleet ready' | sed 's/^ *//' | tail -14"
# COMPUTED from this path's own captured output, so the count and the names cannot
# drift from the frame they sit under. See the note in vidkit's cmd_verdict.
$V verdict $TAG
# NOT "readiness is timers still down this early" — that clause asserted a second
# failure the computed list above may not contain. On this run the fleet WAS ready
# and the verdict printed ONE, so the caption would have contradicted the line
# directly above it. Say only what is true of whatever the list holds.
$V say $TAG "check 7 is the substantive one and it is not about masking: the llm arms run HERE and cannot complete."
# Was: "confirmed against the API itself" — which described a direct call to the
# provider that no log in this film contains. The real evidence is stronger and is
# already on screen: the arm's own completion carried the provider's verbatim body.
$V run $TAG -- bash -c "grep -h 'authentication_error' $HERE/../logs/$TAG.jsonl 2>/dev/null | head -1 | cut -c1-360"
$V say $TAG "that refusal is the PROVIDER's, returned to the arm's own call — so the request reached Anthropic and was rejected there, rather than failing inside the substrate."
# The shape count is read back from the registry rather than typed. The previous cut
# said "404 shapes"; it happened to be right on that run and would have been a false
# claim on any other.
# NO APOSTROPHE in the jq program. It sits inside a single-quoted jq string inside
# an inner `bash -c` double-quoted string, so "network's" would terminate the quote
# one shell deeper than `bash -n` can see: the outer script stays well-formed and
# the command breaks only when it runs, on camera.
$V run $TAG -- bash -c "curl -s -m 6 http://127.0.0.1:$((OFFSET+18100))/registry/stats | jq -r '\"registry for this network: \\(.totalVessels) vessels, \\(.totalShapes) shapes, \\(.healthyCount) healthy\"'"
# "Everything else here is sound" was asserted over a COUNTED readiness failure that
# this path never explains and never names — and on a path that has already said on
# camera "nothing was masked", so B's excuse is unavailable here. Name them, then
# close on what is actually true.
$V say $TAG "the readiness item above is not excused by masking — this is a ROOT and nothing was masked. These are the units behind it:"
$V run $TAG -- bash -c "timeout 30 docker exec $NAME systemctl list-units --type=service --state=activating,failed --no-legend --no-pager 2>/dev/null | awk '{print \"  \" \$1 \"  \" \$3 \"/\" \$4}'; echo '  (activating = restarting, i.e. a crash loop that PASS-no-failed-units cannot see)'"
$V say $TAG "so: a real network with its own identity and the registry printed above, with the two counted failures named — the arms cannot draft without a working provider key, and the units listed here are still coming up or looping."

$V say $TAG "PATH C exit code: $RC"
exit $RC
