#!/usr/bin/env bash
# setup-obsidian-probe-vault.sh — build a dedicated Obsidian PROBE vault so the
# action-effect learner (obsidian:action_effect_model / probe-obsidian-action-
# effects) can run safely.
#
# WHY a separate vault: the resolver's hard safety gate refuses to execute any
# Obsidian command unless the *currently open vault* equals the supplied
# probe_vault_path. That guarantees the probe NEVER runs commands against your
# real vault. So action-effect learning requires a throwaway vault that Obsidian
# is actually open on. This builds one as a SEPARATE instance:
#   - its own server port (27184, vs the real vault's 27183) so both can run at once
#   - its own vesselId (obsidian-vessel-probe)
#   - ALL syncing disabled, so it never mirrors your concept graph into the scratch vault
#   - the same plugin build (symlinked from repos/obsidian-vessel), kept current
#
# Idempotent — safe to re-run. After running, open the printed vault in Obsidian
# (a second window is fine), then: ./obsidian-learning-probe.sh --action-effects
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLUGIN_SRC="${REPO_ROOT}/repos/obsidian-vessel"
PROBE_VAULT="${OBSIDIAN_PROBE_VAULT:-${HOME}/obsidian-probe-vault}"
PROBE_PORT="${OBSIDIAN_PROBE_PORT:-27184}"
REAL_DATA="${REPO_ROOT}/vault/.obsidian/plugins/metabob-vessel/data.json"

PDIR="${PROBE_VAULT}/.obsidian/plugins/metabob-vessel"
mkdir -p "${PDIR}" "${PROBE_VAULT}/Scratch"

# Plugin files — symlink the same build the real vault uses (stays current).
ln -sf "${PLUGIN_SRC}/main.js"           "${PDIR}/main.js"
ln -sf "${PLUGIN_SRC}/manifest.json"     "${PDIR}/manifest.json"
ln -sf "${PLUGIN_SRC}/styles/styles.css" "${PDIR}/styles.css"

# Enable the plugin in this vault.
printf '%s\n' '["metabob-vessel"]' > "${PROBE_VAULT}/.obsidian/community-plugins.json"
[ -f "${PROBE_VAULT}/.obsidian/app.json" ] || printf '%s\n' '{}' > "${PROBE_VAULT}/.obsidian/app.json"

# data.json: clone the real vault's (reuses apiKey/activityApiUrl/advertisedHost/
# allowedOrigins) but override identity + port and FORCE all syncing off.
if [ -f "${REAL_DATA}" ]; then
  jq '.vesselId="obsidian-vessel-probe"
      | .vesselName="Obsidian Probe Vault"
      | .serverPort='"${PROBE_PORT}"'
      | .serverEnabled=true
      | .syncOnStart=false
      | .autoSync=false
      | .enableConceptDbSync=false
      | .historicalSyncLimit=0
      | .shapes=((.shapes // []) + ["obsidian:execute_command"] | unique)' \
     "${REAL_DATA}" > "${PDIR}/data.json"
else
  echo "WARN: real vault data.json not found at ${REAL_DATA}; writing minimal config (set apiKey manually)" >&2
  printf '%s\n' '{"vesselId":"obsidian-vessel-probe","vesselName":"Obsidian Probe Vault","serverEnabled":true,"serverPort":'"${PROBE_PORT}"',"advertisedHost":"host.docker.internal","activityApiUrl":"http://127.0.0.1:18080","syncOnStart":false,"autoSync":false,"enableConceptDbSync":false}' > "${PDIR}/data.json"
fi

# Scratch notes so probed commands (open/navigate/toggle/fold) have content to act on.
cat > "${PROBE_VAULT}/Probe Home.md" <<'MD'
# Probe Home
Throwaway vault for obsidian action-effect learning. Nothing here is real.
Links: [[Probe Note A]] · [[Scratch/sandbox]]
MD
printf '# Probe Note A\n\nSandbox note. Tags: #probe\n' > "${PROBE_VAULT}/Probe Note A.md"
printf '# sandbox\n\n- [ ] task one\n- [ ] task two\n\nSome text to fold/outline.\n' > "${PROBE_VAULT}/Scratch/sandbox.md"

PROBE_ABS="$(cd "${PROBE_VAULT}" && pwd)"
cat <<EOF

probe vault ready:
  path (probe_vault_path) : ${PROBE_ABS}
  plugin server port      : ${PROBE_PORT}   (real vault stays on 27183)
  vesselId                : obsidian-vessel-probe
  syncing                 : DISABLED (won't touch your concept graph)

NEXT (one operator step — the safety gate requires Obsidian open on THIS vault):
  1. In Obsidian: "Open another vault" → "Open folder as vault" → select:
       ${PROBE_ABS}
     (a second window alongside your real vault is fine)
  2. If prompted, turn OFF Restricted Mode / enable community plugins for this vault.
  3. Confirm the probe server is up:
       curl -s http://localhost:${PROBE_PORT}/health
  4. Run the action-effect learner:
       ./scripts/substrate/obsidian-learning-probe.sh --action-effects

The resolver will REFUSE (safety_breach) if Obsidian's active vault != ${PROBE_ABS},
so it can never run against your real vault.
EOF
