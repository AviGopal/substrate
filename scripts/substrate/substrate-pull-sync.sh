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
# A gap that fails to file is worse than no detector: the condition is real, the
# log line claims "(substrateGap)", and nothing is queryable afterwards. Observed
# 2026-08-03: the hub super-repo clone sat DIVERGED for hours, refusing every
# pull-sync run and freezing 25 commits out of the runtime, while the gap store
# held ZERO pull-sync-diverged rows — development-vessel resolves regularly take
# 8-9s under load, so the old --max-time 8 timed out and `|| true` erased it.
# Keep it non-fatal (a detector must never break convergence) but never silent.
emit_gap() {
  local body code
  body="$(curl -s --max-time 30 -w '\n%{http_code}' -X POST "$DEV_VESSEL/v2/impulses/resolve" \
    -H 'Content-Type: application/json' -d "$1" 2>/dev/null || printf '\n000')"
  code="${body##*$'\n'}"
  case "$code" in
    2*) ;;
    *) log "emit_gap FAILED http=${code:-000} — gap NOT filed (detector fired but nothing is queryable): $(printf '%s' "${body%$'\n'*}" | tr -d '\n' | cut -c1-200)" ;;
  esac
}

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
if [ -f "$MITOSIS_LOCK" ] && [ -n "$(find "$MITOSIS_LOCK" -mmin "-$MITOSIS_LOCK_TTL_MIN" 2>/dev/null)" ]; then
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
CW_HELD="$(curl -s --max-time 5 -X POST "$DEV_VESSEL/v2/impulses/resolve" \
  -H 'Content-Type: application/json' \
  -d '{"impulse":{"type":"maintenanceLease","name":"change_window"}}' 2>/dev/null \
  | grep -o '"held":true' || true)"
if [ -n "$CW_HELD" ]; then
  log "change_window lease held — deferring this run"
  echo "{\"at\":\"$(date -Iseconds)\",\"actor\":\"pull-sync\",\"action\":\"deferred_change_window\"}" >> "$DEFERRAL_LOG" 2>/dev/null || true
  exit 0
fi

# Vessel -> unit map from the inventory (fallback: every clone dir, unit <v>.service).
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
  [ -d "$_cu_super/scripts/substrate/units" ] || return 0
  UNITS_CHANGED=0
  for uf in "$_cu_super"/scripts/substrate/units/*; do
    [ -e "$uf" ] || continue
    ubase="$(basename "$uf")"
    if [ -d "$uf" ]; then
      # drop-in directory: <unit>.service.d/*.conf
      mkdir -p "/usr/lib/systemd/system/$ubase" 2>/dev/null || true
      for cf in "$uf"/*; do
        [ -f "$cf" ] || continue
        dst="/usr/lib/systemd/system/$ubase/$(basename "$cf")"
        if ! cmp -s "$cf" "$dst" 2>/dev/null; then
          install -m 0644 "$cf" "$dst" 2>/dev/null && { log "units: converged $ubase/$(basename "$cf")"; UNITS_CHANGED=1; }
        fi
      done
    else
      dst="/usr/lib/systemd/system/$ubase"
      if ! cmp -s "$uf" "$dst" 2>/dev/null; then
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
  _cf_src="$_cf_super/scripts/substrate"
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
  for _cf_pair in \
    "apply-inventory.sh:/usr/local/bin/apply-inventory" \
    "gen-env.sh:/usr/local/bin/gen-env" \
    "secrets.env.sh:/usr/local/share/substrate/secrets.env.sh"; do
    _cf_from="${_cf_pair%%:*}"
    _cf_to="${_cf_pair#*:}"
    [ -f "$_cf_src/$_cf_from" ] || continue
    [ -e "$_cf_to" ] || continue   # not installed on this image; do not invent it
    cmp -s "$_cf_src/$_cf_from" "$_cf_to" 2>/dev/null && continue
    install -m 0755 "$_cf_src/$_cf_from" "$_cf_to.new" 2>/dev/null \
      && mv -f "$_cf_to.new" "$_cf_to" 2>/dev/null \
      && log "fleet: converged $(basename "$_cf_to") (takes effect at next container start — this runs pre-systemd)"
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
  _ps_src="$_cf_src/substrate-pull-sync.sh"
  _ps_dst="/usr/local/bin/substrate-pull-sync"
  if [ -f "$_ps_src" ] && [ -e "$_ps_dst" ] && ! cmp -s "$_ps_src" "$_ps_dst" 2>/dev/null; then
    install -m 0755 "$_ps_src" "$_ps_dst.new" 2>/dev/null \
      && mv -f "$_ps_dst.new" "$_ps_dst" 2>/dev/null \
      && log "fleet: converged substrate-pull-sync itself (takes effect on the NEXT tick — this run finishes on the old code)"
  fi

  # secrets.env.sh — sourced by vessel-ctl on every manifest-vessel install, so
  # it runs at BOOT and it WRITES /workspace/.substrate-secrets. The image copy
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
    /usr/local/share/substrate/secrets.env.sh \
    /usr/local/share/substrate/super-repo/scripts/substrate/secrets.env.sh
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
      log "fleet: $f was modified locally — leaving it alone (git version NOT applied; delete $_cf_mark to accept git)"
    fi
  done
}

content_hash() { # vessel-root -> md5 over sorted src/ + sql/ (.ts/.json/.surql); "none" if missing
  [ -d "$1" ] || { echo none; return; }
  # .json included so pure-template/config edits (e.g. lifecycle *.json activity
  # templates like ribosome-extract) are detected — a .ts-only hash left a
  # .json-only change invisible to convergence, so it never mirrored/deployed.
  # .surql (and the sql/ tree) included so a migration-only change (e.g. a new
  # DEFINE FIELD on a SCHEMAFULL table) is detected — migrations live in sql/,
  # outside src/, so a src-only hash left a migration-only commit invisible: it
  # never mirrored and the unit never restarted to apply it. Scan src + sql.
  (cd "$1" && find src sql -type f \( -name '*.ts' -o -name '*.json' -o -name '*.surql' \) 2>/dev/null | sort | xargs -r md5sum | md5sum | cut -d' ' -f1)
}

synced=0; skipped=0; failed=0
for d in "$CLONE_DIR"/*/; do
  [ -d "$d/.git" ] || continue
  v="$(basename "$d")"

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
  RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v")"
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
  if [ "$CLONE_HASH" = "$RUNTIME_HASH" ]; then
    if [ -z "$DIST_RETRY" ]; then
      [ "$LAST" = "$CLONE_HASH" ] || echo "$CLONE_HASH" > "$MARKER"
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
      RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v")"
      if [ "$RUNTIME_HASH" != none ] && [ "$CLONE_HASH" != none ] && [ "$RUNTIME_HASH" != "$CLONE_HASH" ]; then
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
  # converges anyway. NOTE this does NOT cover the shared-package fan-out restart, which
  # restarts goal-host as a CONSUMER while iterating another vessel — same permanent loss,
  # rarer trigger. That leg of the class is still open.
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
        : "${GATE_T0:=$(date +%s)}"
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
          log "$v: still $NOW in flight after ${QSPENT}s of quiesce (bound ${QWAIT}s) — converging anyway; that run IS lost and its outcome will not be attributable"
          INFLIGHT=0
        fi
        rm -f "$QDIR/$v" 2>/dev/null || true
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
  : "${GATE_T0:=$(date +%s)}"
  GATE_ELAPSED=$(( $(date +%s) - GATE_T0 ))
  if [ "$GATE_ELAPSED" -ge "${GATE_BUDGET_SECONDS:-420}" ]; then
    log "$v: !!! TEST GATE SKIPPED — per-tick budget ${GATE_BUDGET_SECONDS:-420}s exhausted (${GATE_ELAPSED}s elapsed); converging UNGATED rather than risk a SIGTERM mid-convergence"
    # FILE IT, do not merely log it. A test REGRESSION emits a gap (below); the gate
    # DISABLING ITSELF did not — and that is the more serious condition, because a
    # regression means the gate ran and objected while this means no gate ran at all.
    # Reporting the worse condition through the weaker channel is how it stayed invisible:
    # a loud line nobody queries is a silent failure. Measured 2026-08-17: several changes
    # converged under this branch and the only trace was a log line.
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-testgate-skipped-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"Repair needed: pull-sync converged $v to ${HEAD:0:10} with NO test gate — the per-tick budget (${GATE_BUDGET_SECONDS:-420}s) was exhausted after ${GATE_ELAPSED}s, so the suite never ran. This is not a passing gate, it is an absent one, and it is absent precisely when a tick is slow, which is when convergence is riskiest. Repair the capability by raising the budget, sharding the gate across ticks, or running the suite before the tick's other work.\",\"status\":\"open\"}}}}"
    BUN_BIN=""
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
  run_suite() { (cd "$d" && timeout --kill-after="${TEST_KILL_GRACE_SECONDS:-30}" "${TEST_TIMEOUT_SECONDS:-240}" "$BUN_BIN" test 2>&1) || true; }
  # D2 FIX. A pass-count DROP alone is not a regression: consolidating or deleting
  # tests legitimately lowers it. Only count it when failures did not ALSO improve,
  # otherwise a genuine repair that removes dead tests is refused as a regression AND
  # the improvement-ratchet branch below becomes unreachable for that case.
  # is_reg() (count comparison) REMOVED 2026-08-18 — replaced by the set difference below.
  # It defined regression as `fail_now > fail_baseline` against a baseline that only ratcheted
  # DOWN, so a suite that grew could never converge again. Left as a comment rather than
  # deleted silently because its absence is the point: no count of failures, however measured,
  # can distinguish "a test broke" from "more tests exist".
  REG=""; REG_F=""; REG_P=""
  if [ -z "$BUN_BIN" ]; then
    log "$v: !!! TEST GATE BLIND — no test runner available (bun missing, or the per-tick budget line above disabled it); this is not 'no tests', it is no instrument. Converging ungated."
    # Only file when the runner is genuinely missing. When the budget branch above cleared
    # BUN_BIN it already filed, and two gaps for one cause would double-count the demand
    # the gap picker reads.
    if [ "$GATE_ELAPSED" -lt "${GATE_BUDGET_SECONDS:-420}" ]; then
      emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-testgate-no-runner-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"Repair needed: pull-sync converged $v to ${HEAD:0:10} with no test runner present, so the gate could not execute a single test. This is no instrument rather than no tests — the vessel's suite was never consulted. Repair the capability by ensuring bun is on PATH in the convergence environment.\",\"status\":\"open\"}}}}"
    fi
  else
    T_OUT="$(run_suite)"; T_FAIL="$(count_pf "$T_OUT" fail)"; T_PASS="$(count_pf "$T_OUT" pass)"
    if [ -z "$T_FAIL" ]; then
      log "$v: !!! TEST GATE BLIND — suite produced no countable result (errored or absent); converging ungated"
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
      # The gate compares NAME SETS; the old two-number baseline is no longer read. The old
      # count variable was left behind in two log strings after that rewrite and, under
      # `set -u`, an unbound variable ABORTS the whole converge — so a string that only
      # DESCRIBED the result took the code channel down with it, and every fix landed on
      # origin sat unconverged. Report the baseline's named-failure count instead, which is
      # what this gate actually reasons about.
      B_NAMED="$(grep -c . "$B_NAMES_FILE" 2>/dev/null || true)"; B_NAMED="${B_NAMED:-0}"
      if [ ! -s "$B_NAMES_FILE" ]; then
        log "$v: test baseline recorded — $T_FAIL fail / ${T_PASS:-?} pass, $(printf '%s' "$T_NAMES" | grep -c . || true) named failing tests (no gate on first observation)"
        printf '%s\n' "$T_NAMES" > "$B_NAMES_FILE"
        echo "$T_FAIL ${T_PASS:-0}" > "$TEST_BASELINE_DIR/$v"
      elif [ -n "$(comm -23 <(printf '%s\n' "$T_NAMES") <(sort -u "$B_NAMES_FILE") 2>/dev/null | grep -c . | grep -v '^0$')" ]; then
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
        NEW1="$(comm -23 <(printf '%s\n' "$T_NAMES") <(sort -u "$B_NAMES_FILE") 2>/dev/null || true)"
        NEW2="$(comm -23 <(printf '%s\n' "$T2_NAMES") <(sort -u "$B_NAMES_FILE") 2>/dev/null || true)"
        CONFIRMED="$(comm -12 <(printf '%s\n' "$NEW1" | sort -u) <(printf '%s\n' "$NEW2" | sort -u) 2>/dev/null | grep -c . || true)"
        if [ "${CONFIRMED:-0}" -gt 0 ]; then
          FIRST_NEW="$(comm -12 <(printf '%s\n' "$NEW1" | sort -u) <(printf '%s\n' "$NEW2" | sort -u) 2>/dev/null | head -1)"
          REG="$CONFIRMED test(s) that passed at baseline now fail in BOTH runs, e.g. ${FIRST_NEW:-?} (counts: $B_NAMED -> $BEST_F fail)"
          REG_F="$BEST_F"; REG_P="${BEST_P:-0}"
        else
          log "$v: newly-failing tests did not reproduce on re-run — flake, converging (run1 $(printf '%s' "$NEW1" | grep -c . || true) new, run2 $(printf '%s' "$NEW2" | grep -c . || true) new, intersection 0)"
        fi
      else
        # No newly-failing test. Re-baseline whenever the SET changed at all, so a suite that
        # grows or whose flakes settle does not carry a stale reference forward — the failure
        # mode that wedged this gate in the first place.
        if [ "$(printf '%s\n' "$T_NAMES")" != "$(cat "$B_NAMES_FILE" 2>/dev/null)" ]; then
          log "$v: no newly-failing test; refreshing baseline ($B_NAMED -> $T_FAIL fail, $(printf '%s' "$T_NAMES" | grep -c . || true) named)"
          printf '%s\n' "$T_NAMES" > "$B_NAMES_FILE"
          echo "$T_FAIL ${T_PASS:-0}" > "$TEST_BASELINE_DIR/$v"
        fi
      fi
    fi
  fi
  if [ -n "$REG" ]; then
    RC_FILE="$MARKER_DIR/$v.testgate-refusals"
    RC="$(cat "$RC_FILE" 2>/dev/null || echo 0)"; case "$RC" in ''|*[!0-9]*) RC=0 ;; esac
    RC=$((RC + 1)); echo "$RC" > "$RC_FILE" 2>/dev/null || true
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-test-regression-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync test gate: $v at ${HEAD:0:10} regressed its own suite ($REG), confirmed on a second run. Refusal $RC of ${TEST_GATE_MAX_REFUSALS:-3}; the runtime stays on the code it is already running until this is repaired or the refusal bound is reached.\",\"status\":\"open\"}}}}"
    if [ "$RC" -le "${TEST_GATE_MAX_REFUSALS:-3}" ]; then
      log "$v: TEST REGRESSION at ${HEAD:0:10} ($REG) — REFUSING to converge ($RC/${TEST_GATE_MAX_REFUSALS:-3}); runtime keeps running its current code"
      skipped=$((skipped + 1)); continue
    fi
    # D1 FIX. Accept the observed numbers as the new baseline on the starvation break.
    # Without this the old, better baseline persists forever, so EVERY later commit to
    # this vessel is re-judged a regression and pays 3 refusals (~30min of deploy
    # staleness) plus 6 full suite runs — permanently, until someone hand-edits the
    # baseline file. Accepting a degraded baseline blinds the gate to THIS regression,
    # so the acceptance itself is filed as its own gap rather than passing silently.
    log "$v: TEST-GATE STARVATION BREAK — refused $RC consecutive runs at ${HEAD:0:10} ($REG); indefinite staleness is the worse failure, converging anyway and accepting $REG_F fail/$REG_P pass as the new baseline"
    echo "$REG_F $REG_P" > "$TEST_BASELINE_DIR/$v"
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-testgate-baseline-degraded-$v\",\"category\":\"systematic_failure\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync test gate accepted a DEGRADED baseline for $v ($REG) after $RC refusals. The gate is now blind to this regression until the suite is repaired and the baseline lowered.\",\"status\":\"open\"}}}}"
  fi
  rm -f "$MARKER_DIR/$v.testgate-refusals" 2>/dev/null || true

  PREV_GOOD="$(cat "$LAST_GOOD_DIR/$v" 2>/dev/null || true)"
  log "$v: content ${RUNTIME_HASH:0:10} -> ${CLONE_HASH:0:10} (git ${HEAD:0:10}) — mirroring into $RUNTIME_DIR"
  if ! /usr/local/bin/mirror-to-live "$v" "$CLONE_DIR"; then
    log "$v: mirror failed — skipping"; failed=$((failed+1)); continue
  fi
  echo "$CLONE_HASH" > "$MARKER"

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
  SELF_UNIT="$(vessel_unit "$v")"
  if { [ -z "$SELF_UNIT" ] || [ "${SELF_UNIT%.service}" = "$SELF_UNIT" ]; } \
     && [ -d "$RUNTIME_DIR/$v/dist" ] \
     && grep -q '"build"[[:space:]]*:' "$RUNTIME_DIR/$v/package.json" 2>/dev/null; then
    CONSUMERS="$(grep -lE "file:[^\"]*/$v\"" "$RUNTIME_DIR"/*/package.json 2>/dev/null | xargs -r -n1 dirname | xargs -r -n1 basename | grep -vx "$v" || true)"
    if [ -n "$CONSUMERS" ]; then
      log "$v: shared package changed -- rebuilding dist for consumers: $(echo $CONSUMERS | tr '\n' ' ')"
      STAGE="$RUNTIME_DIR/$v/.dist.stage"; rm -rf "$STAGE"
      if ! (cd "$RUNTIME_DIR/$v" && /root/.bun/bin/bun run tsc --project tsconfig.build.json --outDir "$STAGE") || [ ! -s "$STAGE/index.js" ]; then
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
      rm -rf "$RUNTIME_DIR/$v/.dist.prev"; echo "$HEAD" > "$LAST_GOOD_DIR/$v"; rm -f "$MARKER_DIR/$v.fanout-fail"; log "$v: fan-out healthy AND propagated across$BOUNCED"; synced=$((synced+1)); continue
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

  if [ -n "$UNIT" ] && [ "${UNIT%.service}" != "$UNIT" ] && systemctl is-active "$UNIT" >/dev/null 2>&1; then
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
    INFLIGHT=""
    if [ -n "$PORT" ]; then
      INFLIGHT="$(curl -s --max-time 5 "http://127.0.0.1:$PORT/health" 2>/dev/null \
        | sed -n 's/.*"in_flight"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1)"
    fi
    DEFERRED_N="$(cat "$DEFER_FILE" 2>/dev/null || echo 0)"
    case "$DEFERRED_N" in ''|*[!0-9]*) DEFERRED_N=0 ;; esac
    if [ -n "$INFLIGHT" ] && [ "$INFLIGHT" -gt 0 ] 2>/dev/null && [ "$DEFERRED_N" -lt "$RESTART_DEFER_MAX" ]; then
      echo "$((DEFERRED_N + 1))" > "$DEFER_FILE" 2>/dev/null || true
      log "$v: $INFLIGHT dispatch(es) in flight — DEFERRING restart ($((DEFERRED_N + 1))/$RESTART_DEFER_MAX); mirrored source takes effect on the next tick"
      printf '{"at":"%s","actor":"pull-sync","action":"deferred_restart_inflight","vessel":"%s","in_flight":%s,"deferral":%s}\n' \
        "$(date -Iseconds)" "$v" "$INFLIGHT" "$((DEFERRED_N + 1))" >> "$DEFERRAL_LOG" 2>/dev/null || true
      continue
    fi
    if [ -n "$INFLIGHT" ] && [ "$INFLIGHT" -gt 0 ] 2>/dev/null; then
      log "$v: $INFLIGHT dispatch(es) still in flight after $DEFERRED_N deferral(s) — restarting anyway so convergence cannot be starved"
    fi
    rm -f "$DEFER_FILE" 2>/dev/null || true
    restart_breadcrumb "$v" "converged to origin/dev" "$INFLIGHT"
    systemctl restart "$UNIT" 2>/dev/null || true
    sleep "$STAGGER_SECONDS"
    if [ -n "$PORT" ]; then
      ok=0
      for _ in 1 2 3 4 5; do healthy "$PORT" && { ok=1; break; }; sleep 4; done
      if [ "$ok" = 0 ]; then
        log "$v: UNHEALTHY after mirror+restart — reverting to last-good ${PREV_GOOD:0:10} and HALTING run"
        if [ -n "$PREV_GOOD" ] && git -C "$d" checkout -q "$PREV_GOOD" -- . 2>/dev/null; then
          /usr/local/bin/mirror-to-live "$v" "$CLONE_DIR" || true
          git -C "$d" checkout -q "$BRANCH" 2>/dev/null || true
          git -C "$d" reset --hard -q "$HEAD" 2>/dev/null || true
          systemctl restart "$UNIT" 2>/dev/null || true
        fi
        # marker stays at $CLONE_HASH (last ATTEMPTED content): live code is PREV_GOOD,
        # but re-attempting the same bad commit every tick would be a mirror/
        # revert loop — the substrateGap below owns the escalation instead.
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-unhealthy-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$v unhealthy after pull-sync to ${HEAD:0:10}; reverted to ${PREV_GOOD:0:10} and halted the sync run\",\"status\":\"open\"}}}}"
        failed=$((failed+1))
        break
      fi
    fi
  fi
  echo "$HEAD" > "$LAST_GOOD_DIR/$v"
  synced=$((synced+1))
done

# 4. Super-repo convergence — the glue layer the vessel loop can't see: the
# federation transport server wrapper (federation-transport-vessel's ExecStart
# runs it FROM this clone), the boot-seeded active-scripts, and this updater
# itself. Same discipline as vessels: ahead -> skip, diverged -> gap + skip,
# behind -> ff-only pull. The marker records the last ATTEMPTED sha so an
# unhealthy convergence (reverted below) is not re-attempted every tick — only
# a fresh origin commit re-arms it. Runs after the vessel loop so a bad glue
# change can never block vessel convergence. Gap: super-repo-not-in-self-update-set.
SUPER_DIR="${SUPER_REPO_DIR:-/workspace/git/super-repo}"
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
SUPER_FETCH_OK=0
if [ -d "$SUPER_DIR/.git" ]; then
  if git -C "$SUPER_DIR" fetch -q origin "$BRANCH" 2>/dev/null; then
    SUPER_FETCH_OK=1
  else
    log "super-repo: FETCH FAILED — glue layer NOT converged this tick (scripts, federation wrapper, and pull-sync's own self-update all skipped); the clone stays at $(git -C "$SUPER_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  fi
fi
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
      _sm_lag=""
      for _sm in $(git -C "$SUPER_DIR" config --file .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}'); do
        [ -d "$SUPER_DIR/$_sm" ] || continue
        if [ -n "$(git -C "$SUPER_DIR/$_sm" status --porcelain 2>/dev/null)" ]; then
          _sm_lag="$_sm_lag $_sm"
          continue
        fi
        git -C "$SUPER_DIR" submodule update --init --quiet -- "$_sm" 2>/dev/null \
          || _sm_lag="$_sm_lag $_sm(checkout-failed)"
      done
      [ -n "$_sm_lag" ] && log "super-repo: submodule worktrees left at old pointers (uncommitted work — NOT discarded):$_sm_lag"
      # Updater self-refresh (atomic: the running bash keeps its old inode).
      if [ -f "$SUPER_DIR/scripts/substrate/substrate-pull-sync.sh" ]; then
        install -m 0755 "$SUPER_DIR/scripts/substrate/substrate-pull-sync.sh" /usr/local/bin/.substrate-pull-sync.new 2>/dev/null \
          && mv -f /usr/local/bin/.substrate-pull-sync.new /usr/local/bin/substrate-pull-sync 2>/dev/null || true
      fi
      # mirror-to-live is part of the same glue layer: converge it too, or a
      # repo-side mirror fix never reaches the running container (the
      # super-repo-not-in-self-update-set gap class).
      if [ -f "$SUPER_DIR/scripts/substrate/mirror-to-live.sh" ]; then
        install -m 0755 "$SUPER_DIR/scripts/substrate/mirror-to-live.sh" /usr/local/bin/mirror-to-live 2>/dev/null || true
      fi
      # self-recovery-tick is the immune-system tick installed to /usr/local/bin
      # at boot but (until now) never re-converged — the SAME super-repo-not-in-
      # self-update-set gap: a repo-side recovery fix (e.g. the 2026-07-31
      # sustained-DB-wedge -> restart-surrealdb escalation) never reached the
      # running unit. Converge it here so operator immune-system logic ships via
      # git like everything else (running unit picks it up next timer fire).
      if [ -f "$SUPER_DIR/scripts/substrate/self-recovery-tick.sh" ]; then
        install -m 0755 "$SUPER_DIR/scripts/substrate/self-recovery-tick.sh" /usr/local/bin/.self-recovery-tick.new 2>/dev/null \
          && mv -f /usr/local/bin/.self-recovery-tick.new /usr/local/bin/self-recovery-tick 2>/dev/null || true
      fi
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
      cp -f "$SUPER_DIR"/scripts/substrate/*.ts /workspace/active-scripts/ 2>/dev/null || true
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

# Converge systemd units every tick, independent of whether the super-repo sha advanced.
# See converge_units for why this must NOT sit inside the marker-gated refresh above.
converge_units "${SUPER_REPO_DIR:-/workspace/git/super-repo}"

# Same reasoning, same cadence: the selector and the fleet definition it reads
# must converge on every tick, not only when the super-repo sha advances — a
# container that boots on an already-current commit would otherwise never pick
# them up at all.
converge_fleet_defs "${SUPER_REPO_DIR:-/workspace/git/super-repo}"

log "done — synced=$synced skipped=$skipped failed=$failed"
exit 0
