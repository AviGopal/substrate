#!/usr/bin/env bash
# installed-replay — at boot, put back the dynamic vessels installed.json names.
#
# Dynamic (vessel-ctl-installed) units live in /etc/systemd/system, on the container filesystem, NOT a volume, so a
# recreate drops every one of them while installed.json (the volume-backed record vessel-ctl keeps of what it
# installed) and their sources survive. Each member is restored here, before units start. Run by the entrypoint; it
# must never stop a boot: every outcome is a log line and the exit is 0.
#
# Per member of installed.json:
#   - named by DISABLED_VESSELS: left alone (the operator's choice outranks the record);
#   - in vessels.manifest.json: restored with vessel-ctl install when its /etc unit is missing, and wanted at boot;
#   - not in the manifest, with a baked unit in /usr/lib/systemd/system: it was a dynamic vessel and is now part of the
#     image (records, walk and described-shape became baked units of role "learner"). Its /etc copy and wants link,
#     if any, are removed, so the baked unit is the one that runs, and it is dropped from installed.json;
#   - in neither: logged and skipped.
#
# Inputs (each defaults to the in-container path; tests point them elsewhere): FLEET_DIR (installed.json),
# VESSELS_MANIFEST, SYSTEMD_ETC_DIR, SYSTEMD_LIB_DIR, VESSEL_CTL, DISABLED_VESSELS.
set -u

FLEET_DIR="${FLEET_DIR:-/workspace/substrate/fleet}"
INSTALLED="$FLEET_DIR/installed.json"
MANIFEST="${VESSELS_MANIFEST:-$FLEET_DIR/vessels.manifest.json}"
[ -f "$MANIFEST" ] || MANIFEST=/usr/local/share/substrate/vessels.manifest.json
ETC="${SYSTEMD_ETC_DIR:-/etc/systemd/system}"
LIB="${SYSTEMD_LIB_DIR:-/usr/lib/systemd/system}"
VESSEL_CTL="${VESSEL_CTL:-/usr/local/bin/vessel-ctl}"
log() { echo "[substrate] installed.json: $*"; }

[ -f "$INSTALLED" ] || exit 0
command -v jq >/dev/null 2>&1 || { log "jq is missing: nothing restored"; exit 0; }

in_manifest() { jq -e --arg n "$1" '.vessels[]? | select(.name == $n)' "$MANIFEST" >/dev/null 2>&1; }

dis=",$(echo "${DISABLED_VESSELS:-}" | tr -d '[:space:]'),"
retired=""
for v in $(jq -r '.installed[]? // empty' "$INSTALLED" 2>/dev/null); do
  case "$dis" in *,"$v.service",*|*,"$v",*) log "$v is in DISABLED_VESSELS — restore skipped"; continue ;; esac
  if in_manifest "$v"; then
    [ -f "$ETC/$v.service" ] && continue
    log "restoring dynamic vessel $v"
    if [ -x "$VESSEL_CTL" ]; then
      "$VESSEL_CTL" install "$v" || log "restore of $v failed — see the line above; boot continues"
    else
      log "no vessel-ctl at $VESSEL_CTL: $v not restored; boot continues"
    fi
    # vessel-ctl's `systemctl enable --now` no-ops pre-systemd; the offline wants-symlink makes boot-start deterministic.
    if [ -f "$ETC/$v.service" ]; then
      mkdir -p "$ETC/multi-user.target.wants"
      ln -sf "../$v.service" "$ETC/multi-user.target.wants/$v.service"
    fi
  elif [ -f "$LIB/$v.service" ]; then
    rm -f "$ETC/$v.service" "$ETC/multi-user.target.wants/$v.service"
    retired="$retired $v"
    log "$v is now a baked unit ($LIB/$v.service): its dynamic install is retired (no /etc copy, dropped from installed.json)"
  else
    log "$v is in neither the manifest nor the image's units: skipped; boot continues"
  fi
done

if [ -n "$retired" ]; then
  tmp="$INSTALLED.tmp.$$"
  if jq --arg r "$retired" '($r | split(" ") | map(select(length > 0))) as $drop | .installed |= map(select(. as $v | $drop | index($v) | not))' "$INSTALLED" > "$tmp" 2>/dev/null; then
    mv -f "$tmp" "$INSTALLED" || { rm -f "$tmp"; log "could not rewrite installed.json; boot continues"; }
  else
    rm -f "$tmp"; log "could not rewrite installed.json; boot continues"
  fi
fi
exit 0
