#!/usr/bin/env bash
# kind: known-valid
# The candidate's committed units set only classified environment: every Environment= name under
# scripts/substrate/units/ is a bootstrap name or a grandfathered behaviour name, and every EnvironmentFile=
# path is pinned. Run by shadow-eval.sh with CANDIDATE_DIR (see its header). known-valid: it asserts what an
# acceptable candidate looks like; the refused changes it replays live in validation/scripts/gate-fixture-env-ratchet.test.sh.
#
# WHY. An Environment= line is frozen at process start, invisible to traces and the walk, and unlearnable
# (CLAUDE.md law 1). scripts/git-hooks/pre-commit refuses a new behaviour line, and
# validation/scripts/env-ratchet-committed-tree.test.sh judges a committed tree, but both are skippable: the hook by
# --no-verify or an uninstalled clone, the tree check because pull-sync never runs the glue corpus. This fixture is
# the BLOCKING form. On a gated node every super-repo commit touching scripts/substrate is a gate candidate; its
# units are not installed (gate_overlay keeps the accepted copies) until the accepted corpus passes it for the soak,
# so a candidate this fixture refuses never reaches systemd.
#
# THE LISTS ARE EMBEDDED. shadow-eval exports only the candidate's scripts/substrate, so
# scripts/git-hooks/env-ratchet/ is out of reach, and reading the candidate's own lists would let it vouch for
# itself. The block below copies the names and paths of bootstrap-allowlist.txt and grandfathered-behaviour.txt, in
# file order; validation/scripts/gate-fixture-env-ratchet.test.sh fails the glue run when they drift. The frozen
# grandfathered set cannot be widened by a candidate: the set is this file, and an accepted fixture that a candidate
# edits or removes is classified a widening by candidate.sh, never promoted on fixture parity.
#
# ADDING ANY BOOTSTRAP NAME (or pinned env file), once this fixture is accepted, is therefore a gate WIDENING: the
# commit must edit this list, and nothing promotes it automatically. It lands only by the operator break-glass
# `gate-runner rollback-gate --to <sha>` run on EACH gated node. That is the contract, operators included: new
# bootstrap names should be rare and deliberate. SHRINKING needs nothing: removing a unit line (and its list entry) is
# judged like any edit and promotes after the soak; a name left here that no unit sets any more is harmless.
#
# A REFUSAL NAMES THE LINE TO REVERT: one `FAIL - scripts/substrate/units/<path>:<line>: <NAME>` per breach, first, then
# one summary line. shadow-eval carries the first three FAIL lines into its verdict, and candidate.sh carries that into
# the gate_candidate_refused gap summary.
#
# WHAT IS JUDGED. Every regular file under units/, at any depth: converge_units installs every top-level file and
# every file of every *.d/ directory, whatever its suffix. Lines are read as systemd reads them: '#' and ';' lines
# are comments, a trailing backslash continues a line, and an Environment= value is split into words with quotes
# honoured. A leading '-' on an EnvironmentFile= path is ignored for matching. Over-strict on purpose: an
# Environment= line in a section systemd ignores is still judged.
#
# NOT JUDGED (no tree-level signal, or out of scope): PassEnvironment=, ExecStart=env X=..., a value set inside a
# script the unit runs, drop-ins written into /etc at runtime, and a grandfathered name re-set with a new value or in
# another unit (the fixture sees one tree, not a diff; the hook refuses that at commit time), and the units an image
# bakes in, which run after a recreate until the first gated tick converges the accepted copies.
#
# SELF-CHECK FIRST. A judge that parses nothing reports nothing, and nothing reads as a pass. So the same judge first
# runs on a planted probe tree and must name exactly its planted breaches; an empty list, a name in both lists, or no
# unit file in the candidate is "cannot judge", a FAIL.
set -uo pipefail
: "${CANDIDATE_DIR:?run by shadow-eval.sh}"

# >>> embedded lists (scripts/git-hooks/env-ratchet/, names and paths in file order)
ER_BOOTSTRAP_NAMES="PORT HOST FED_HEALTH_PORT
VESSEL_ID GOAL_HOST_VESSEL_ID LIGHT_DISPATCH_VESSEL_ID LLM_RESOLVER_VESSEL_ID STATEFUL_UI_VESSEL_ID WATCHDOG_FLOW SURREAL_USER
VESSEL_ENDPOINT DEV_VESSEL_ENDPOINT GOAL_HOST_VESSEL_ENDPOINT LIGHT_DISPATCH_ENDPOINT LLM_VESSEL_ENDPOINT CONCEPT_DB_URL
DISCOVERY_URL OBSIDIAN_LEARN_ENDPOINT
HOME WORKSPACE_ROOT MITOSIS_PUSH_CLONE_DIR MITOSIS_RUNTIME_DIR INGEST_MANIFEST OBSIDIAN_VAULT SURGICAL_SCAN_REPOS
WATCHDOG_ACTIVITY_PATHS WATCHDOG_RESTART_EXEC
OBSIDIAN_DISPLAY OBSIDIAN_GEOMETRY"
ER_PINNED_ENV_FILES="/etc/substrate/env
/etc/substrate/concept-db.env
/etc/substrate/local-tools-vessel.env
/etc/substrate/ribosome-vessel.env
/etc/substrate/private/env.d/discovery-vessel.env
/etc/substrate/private/env.d/federation-transport-vessel.env
/etc/substrate/private/env.d/goal-host-vessel.env
/etc/substrate/private/env.d/identity-seeder.env
/etc/substrate/private/env.d/identity-vessel.env"
ER_GRANDFATHERED="AUTO_DESCRIBE_RESOLVERS BOREDOM_AUTOPROMOTE_INTERVAL_MS BOREDOM_DAEMON_MODE BOREDOM_EXERCISE_INTERVAL_MS
BOREDOM_IDLE_WINDOW_SECONDS BOREDOM_IN_FLIGHT_TIMEOUT_MS BOREDOM_MAX_CONCURRENT BOREDOM_MIN_DISPATCH_INTERVAL_MS
BOREDOM_POOL_LOOP_INTERVAL_MS BOREDOM_STATE_REFRESH_MS DB_MAINTENANCE EMIT_GAPS EXTRA_WORKSPACE_ROOTS GOAL_HOST_BEHAVIOR_LIMIT
GOAL_HOST_BEHAVIOR_WINDOW_HOURS GOAL_HOST_DRAIN_MS GOAL_HOST_WS_SUBSCRIBER MAX_PEER_DEPTH MITOSIS_DIRECT_PUSH OBSIDIAN_LEARN_GRANT
OBSIDIAN_LEARN_MAX OBSIDIAN_LEARN_MODE OPERATOR_GOAL_GEN PEER_FANOUT_MODE PREFER_LIBP2P_ROUTE RECOVER_CAP REPAIR SELF_DEV_TREND
SURGICAL_SCAN_CAP SURREAL_ROCKSDB_BLOCK_CACHE_SIZE TASK_GENERATION_ENABLED VESSEL_DRAIN_MS WATCHDOG_RELEVANT_SHAPE
WATCHDOG_RESTART_IMPULSE WATCHDOG_ROUTE_FILTER WATCHDOG_STALL_MIN"
# <<< embedded lists

# judge <units-dir> [<label-prefix>]: one "FAIL - <prefix><path>:<line>: ..." line per breach, then "SCANNED <n>"
# (no line at all when no file was read).
judge() {
  local u="$1"
  find "$u" -type f -print0 | sort -z | xargs -0 -r env ER_B="$ER_BOOTSTRAP_NAMES" ER_F="$ER_PINNED_ENV_FILES" \
    ER_G="$ER_GRANDFATHERED" ER_ROOT="$u/" ER_LABEL="${2:-}" awk '
    BEGIN {
      n = split(ENVIRON["ER_B"], a); for (i = 1; i <= n; i++) boot[a[i]] = 1
      n = split(ENVIRON["ER_F"], a); for (i = 1; i <= n; i++) pinned[a[i]] = 1
      n = split(ENVIRON["ER_G"], a); for (i = 1; i <= n; i++) grand[a[i]] = 1
      root = ENVIRON["ER_ROOT"]; label = ENVIRON["ER_LABEL"]; files = 0; acc = ""; pending = 0; sq = sprintf("%c", 39)
    }
    function rel(f) { return label (index(f, root) == 1 ? substr(f, length(root) + 1) : f) }
    function trim(s) { sub(/^[ \t]+/, "", s); sub(/[ \t\r]+$/, "", s); return s }
    function judge_env(v, where,   i, c, tok, q, have, name, eq) {
      tok = ""; q = ""; have = 0
      for (i = 1; i <= length(v) + 1; i++) {
        c = (i <= length(v)) ? substr(v, i, 1) : " "
        if (c == "\\" && i < length(v)) { i++; tok = tok substr(v, i, 1); have = 1; continue }
        if (q != "") { if (c == q) q = ""; else tok = tok c; continue }
        if (c == "\"" || c == sq) { q = c; have = 1; continue }
        if (c == " " || c == "\t" || c == "\r") {
          if (have) {
            eq = index(tok, "=")
            if (eq > 1) {
              name = substr(tok, 1, eq - 1)
              if (!(name in boot) && !(name in grand))
                printf "FAIL - %s: %s (Environment= name neither bootstrap nor grandfathered)\n", where, name
            }
          }
          tok = ""; have = 0; continue
        }
        tok = tok c; have = 1
      }
    }
    function judge_line(l, where,   v) {
      l = trim(l)
      if (l ~ /^Environment[ \t]*=/) { v = l; sub(/^Environment[ \t]*=/, "", v); judge_env(v, where); return }
      if (l ~ /^EnvironmentFile[ \t]*=/) {
        v = l; sub(/^EnvironmentFile[ \t]*=/, "", v); v = trim(v)
        sub(/^-/, "", v); v = trim(v); sub(/^"/, "", v); sub(/"$/, "", v)
        if (v != "" && !(v in pinned))
          printf "FAIL - %s: EnvironmentFile=%s (not a pinned path)\n", where, v
      }
    }
    function flush() { if (pending) judge_line(acc, pwhere); acc = ""; pending = 0 }
    FNR == 1 { flush(); files++ }
    {
      line = $0; sub(/\r$/, "", line)
      if (!pending && line ~ /^[ \t]*[#;]/) next
      if (line ~ /\\$/) {
        if (!pending) pwhere = rel(FILENAME) ":" FNR
        acc = acc substr(line, 1, length(line) - 1) " "; pending = 1; next
      }
      if (!pending) pwhere = rel(FILENAME) ":" FNR
      acc = acc line; pending = 1; flush()
    }
    END { flush(); print "SCANNED " files }'
}

W="$(mktemp -d "${TMPDIR:-/tmp}/fx-env-ratchet.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT

# The lists themselves: non-empty, and no name both bootstrap and behaviour.
for l in ER_BOOTSTRAP_NAMES ER_PINNED_ENV_FILES ER_GRANDFATHERED; do
  [ -n "$(printf '%s' "${!l}" | tr -d '[:space:]')" ] || { echo "FAIL - cannot judge: the embedded $l is empty"; exit 1; }
done
both="$(printf '%s\n' $ER_BOOTSTRAP_NAMES $ER_GRANDFATHERED | sort | uniq -d | tr '\n' ' ')"
[ -z "$both" ] || { echo "FAIL - cannot judge: the embedded lists name ${both% } as both bootstrap and behaviour"; exit 1; }

# Positive control through the same judge: a planted tree must yield exactly its three breaches.
P="$W/probe/units"; mkdir -p "$P/probe.service.d"
printf '[Service]\n# Environment=ER_PROBE_COMMENTED=1\nEnvironment=PORT=1 "ER_PROBE_SWITCH=a b" HOST=x\nEnvironment=HOME=/h \\\n  ER_PROBE_CONTINUED=1\nEnvironmentFile=-/etc/substrate/env\n' > "$P/probe.service"
printf '[Service]\nEnvironment="REPAIR=1"\nEnvironmentFile=-/etc/substrate/er-probe.env\n' > "$P/probe.service.d/10-probe.conf"
pout="$(judge "$P")"
want=$'FAIL - probe.service.d/10-probe.conf:3: EnvironmentFile=/etc/substrate/er-probe.env (not a pinned path)\nFAIL - probe.service:3: ER_PROBE_SWITCH (Environment= name neither bootstrap nor grandfathered)\nFAIL - probe.service:4: ER_PROBE_CONTINUED (Environment= name neither bootstrap nor grandfathered)\nSCANNED 2'
have="$(printf '%s\n' "$pout" | LC_ALL=C sort)"
want="$(printf '%s\n' "$want" | LC_ALL=C sort)"
[ "$have" = "$want" ] || { echo "FAIL - cannot judge: the judge's positive control did not name exactly its planted breaches: $(printf '%s' "$pout" | tr '\n' ';' | cut -c1-400)"; exit 1; }

U="$CANDIDATE_DIR/scripts/substrate/units"
[ -d "$U" ] || { echo "FAIL - the candidate has no scripts/substrate/units"; exit 1; }
out="$(judge "$U" scripts/substrate/units/)"
scanned="$(printf '%s\n' "$out" | sed -n 's/^SCANNED //p')"
case "$scanned" in ''|0) echo "FAIL - cannot judge: no unit file was read under the candidate's scripts/substrate/units"; exit 1 ;; esac
bad="$(printf '%s\n' "$out" | sed -n '/^FAIL - /p')"
if [ -n "$bad" ]; then
  printf '%s\n' "$bad" | head -20
  echo "FAIL - the candidate's units set $(printf '%s\n' "$bad" | wc -l) unclassified environment item(s): revert the line(s) named above. A behaviour switch belongs in a shaped impulse; a new bootstrap name needs this fixture edited, a gate widening (operator break-glass on each gated node)"
  exit 1
fi
echo "ok - the candidate's units ($scanned files) set only bootstrap or grandfathered names and load only pinned env files"
exit 0
