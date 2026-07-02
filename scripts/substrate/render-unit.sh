#!/usr/bin/env bash
# render-unit.sh — render a systemd unit from a vessels.manifest.json entry.
#
#   render-unit.sh <vessel-name> [manifest-path]   -> unit text on stdout
#
# THE single unit template for dynamic vessels — used by vessel-ctl.sh
# (runtime install) and available to a Dockerfile build-time render, so the
# two paths cannot drift. Path variables resolved IN-CONTAINER:
#   $REPO_ROOT     -> the super-repo clone /workspace/git/super-repo (the
#                     legacy host-checkout substitution is gone: units must
#                     never reference a host path)
#   $VESSEL_CLONE  -> /workspace/git/vessels/<name>
#   $RUNTIME       -> /vessels/<name>
# The rendered unit deregisters from discovery on ANY clean stop
# (ExecStopPost) so planned detaches leave the registry immediately instead
# of rotting for the 5-min TTL.
set -euo pipefail

VESSEL="${1:?usage: render-unit.sh <vessel-name> [manifest-path]}"
MANIFEST="${2:-${VESSELS_MANIFEST:-/workspace/substrate/fleet/vessels.manifest.json}}"
[ -f "$MANIFEST" ] || MANIFEST=/usr/local/share/substrate/vessels.manifest.json

SUPER_REPO_DIR="${SUBSTRATE_SUPER_REPO_DIR:-/workspace/git/super-repo}"
CLONE_DIR="${MITOSIS_PUSH_CLONE_DIR:-/workspace/git/vessels}"
RUNTIME_DIR="${MITOSIS_RUNTIME_DIR:-/vessels}"
BUN="${BUN_BIN:-/root/.bun/bin/bun}"

e="$(jq -e --arg n "$VESSEL" '.vessels[] | select(.name==$n)' "$MANIFEST")" \
  || { echo "render-unit: vessel '$VESSEL' not in manifest $MANIFEST" >&2; exit 1; }

workdir="$(echo "$e" | jq -r '.workdir')"
workdir="${workdir//\$REPO_ROOT/$SUPER_REPO_DIR}"
workdir="${workdir//\$VESSEL_CLONE/$CLONE_DIR/$VESSEL}"
workdir="${workdir//\$RUNTIME/$RUNTIME_DIR/$VESSEL}"
exec_ts="$(echo "$e" | jq -r '.exec')"
restart="$(echo "$e" | jq -r '.restart // "always"')"
desc="$(echo "$e" | jq -r '.description // .name')"
env_lines="$(echo "$e" | jq -r '.env // {} | to_entries[] | "Environment=\(.key)=\(.value)"')"
after="$(echo "$e" | jq -r '(.depends_on // []) | map(. + ".service") | join(" ")')"

cat <<UNIT
[Unit]
Description=$desc
After=network.target discovery-vessel.service $after

[Service]
Type=simple
EnvironmentFile=/etc/substrate/env
EnvironmentFile=-/workspace/.substrate-secrets
$env_lines
WorkingDirectory=$workdir
ExecStart=$BUN $workdir/$exec_ts
# Graceful detach: any clean stop deregisters from discovery immediately
# (best-effort; TTL expiry remains the crash backstop).
ExecStopPost=-/usr/local/bin/discovery-deregister $VESSEL
Restart=$restart
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
