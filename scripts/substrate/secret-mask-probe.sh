#!/usr/bin/env bash
# secret-mask-probe.sh — prove BY EFFECT that the secret directories (the scoped
# trust-root files, /etc/substrate/private, and the persisted store's directory,
# /workspace/.substrate-private) are out of reach inside unit namespaces. Names, paths and dev:inode pairs only: it never opens,
# prints or hashes a secret file, and never reads /proc/*/environ or cmdline.
#
# WHY. A unit's InaccessiblePaths= is applied when the unit STARTS and binds whatever
# the path named then. Two ways that silently stops protecting anything:
#   - a mask on a FILE that is later replaced by rename covers the dead inode; the
#     unit opens the live file (measured 10-02: admin.env inode inside a vessel ==
#     inode outside). Hence the directory mask (units/service.d/05-secret-dir-out-of-reach.conf).
#   - a path that did not exist when the unit started ('-' skips it) stays visible
#     until that unit restarts.
# Reading unit configuration cannot see either; only looking from inside can.
#
# usage:
#   secret-mask-probe check     [--manifest M] [--env-dir D]
#       Live, read-only (plus one throwaway control unit). For every running service:
#       if its effective InaccessiblePaths= names the private dir, nothing it masks
#       may be visible from inside its mount namespace (same dev:inode as outside);
#       if it does not, it must be a DECLARED exemption (a same-named override of the
#       default-deny drop-in). Run by pull-sync after every secret render (every tick).
#   secret-mask-probe selftest  [--manifest M] [--env-dir D] [--renderer R]
#       Privileged, systemd-PID1 throwaway or acceptance container only: starts a
#       vessel-style and a tick-style probe unit, re-renders every scoped file by
#       rename (the renderer, recover mode), and asserts neither probe can see any of
#       them; then the positive control: every manifest consumer, started as a copy
#       of its own EnvironmentFile=/InaccessiblePaths= lines, still receives every
#       name of its scoped file; and every declared exemption (the store's runtime
#       readers) still sources the store and receives every name in it. Writes only scoped files (re-rendered from their own
#       values), /run/systemd/system/secret-mask-*.service and scratch under /var/tmp.
# Both modes first run a MUST-FAIL CONTROL: a throwaway unit masking a scratch FILE
# that is then replaced by rename must be reported visible (else the probe is blind),
# and the same unit's scratch DIRECTORY mask must hold.
# exit: 0 pass · 1 finding on the scoped-secrets directory (visible / unmasked / consumer
#       lost a name) · 3 only OTHER masked paths visible (VISIBLE-OTHER: the same stale-mask
#       class on a path that is still masked as a file, e.g. the persisted store) · 2 blind
set -uo pipefail

MODE="${1:-}"; shift || true
MANIFEST=""; ENV_DIR=/etc/substrate; RENDERER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --manifest) MANIFEST="$2"; shift 2 ;;
    --env-dir)  ENV_DIR="$2"; shift 2 ;;
    --renderer) RENDERER="$2"; shift 2 ;;
    *) echo "secret-mask-probe: unknown argument $1" >&2; exit 2 ;;
  esac
done
_here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$MANIFEST" ]; then
  for _m in "$_here/secrets-manifest.json" /usr/local/share/substrate/secrets-manifest.json; do [ -f "$_m" ] && { MANIFEST="$_m"; break; }; done
fi
case "$MODE" in check|selftest) ;; *) sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2 ;; esac
for _t in jq stat nsenter systemctl systemd-run; do
  command -v "$_t" >/dev/null 2>&1 || { echo "BLIND: $_t is not installed"; exit 2; }
done
[ -f "$MANIFEST" ] || { echo "BLIND: no secrets manifest"; exit 2; }

DROPIN_NAME=05-secret-dir-out-of-reach.conf
PRIV_REL="$(jq -r '.private_dir // empty' "$MANIFEST")"
PRIV=""; [ -n "$PRIV_REL" ] && PRIV="$ENV_DIR/$PRIV_REL"
UNIT_TMPL="$(jq -r '.unit_file // "env.d/{unit}.env"' "$MANIFEST")"   # legacy-path: an older manifest has no private_dir
ADMIN="$ENV_DIR/$(jq -r '.admin_file // "admin.env"' "$MANIFEST")"     # legacy-path
CONSUMERS="$(jq -r '[.secrets[].units[]?, .patterns[]?.units[]?] | unique | .[]' "$MANIFEST")"
# The persisted store: its own stable directory in the workspace volume (an older manifest
# has none; the flat path is then the store).
STORE_DIR="$(jq -r '.store_dir // empty' "$MANIFEST")"
LEGACY_STORE="$(jq -r '.legacy_store // "/workspace/.substrate-secrets"' "$MANIFEST")"   # legacy-path
STORE="$LEGACY_STORE"; [ -n "$STORE_DIR" ] && STORE="$STORE_DIR/$(jq -r '.store_file' "$MANIFEST")"
MASK_DIRS=""; [ -n "$PRIV" ] && MASK_DIRS="$PRIV"; [ -n "$STORE_DIR" ] && MASK_DIRS="$MASK_DIRS $STORE_DIR"
is_gating() { # <path>: one of the secret directories, under one, or a secret file
  local d; for d in $MASK_DIRS; do [ "$1" = "$d" ] || [[ "$1" == "$d"/* ]] && return 0; done
  scoped_files | grep -qxF "$1"
}
scoped_files() { _scoped_files | sort -u; }
_scoped_files() { # every scoped file the manifest implies, plus the flat-layout paths if present
  echo "$ADMIN"
  local u; for u in $CONSUMERS; do echo "$ENV_DIR/${UNIT_TMPL//\{unit\}/$u}"; done
  [ -e "$ENV_DIR/admin.env" ] && echo "$ENV_DIR/admin.env"            # legacy-path
  local s; for s in "$STORE" "$STORE.prev" "$LEGACY_STORE" "$LEGACY_STORE.prev"; do [ -e "$s" ] && echo "$s"; done
  for u in "$ENV_DIR"/env.d/*.env; do [ -e "$u" ] && echo "$u"; done   # legacy-path
  return 0
}

FIND=0
OTHER=0
say() { echo "$*"; }
host_id() { stat -L -c '%d:%i' -- "$1" 2>/dev/null; }
ns_id()   { nsenter -t "$1" -m -- stat -L -c '%d:%i' -- "$2" 2>/dev/null; }
# visible <pid> <path>: the namespace resolves <path> to the very object outside.
visible() { local h; h="$(host_id "$2")" || return 1; [ -n "$h" ] && [ "$(ns_id "$1" "$2")" = "$h" ]; }
mainpid() { systemctl show -p MainPID --value "$1" 2>/dev/null; }
wait_pid() { local i p; for i in $(seq 1 50); do p="$(mainpid "$1")"; [ -n "$p" ] && [ "$p" != 0 ] && { echo "$p"; return 0; }; sleep 0.1; done; return 1; }
rewrite() { # replace <file> by rename with its own bytes (the renderer's write pattern)
  cp -p -- "$1" "$1.mask-probe.$$" && mv -f -- "$1.mask-probe.$$" "$1"
}

# ── must-fail control ─────────────────────────────────────────────────────────
control() {
  local s="/var/tmp/secret-mask-probe.$$" u="secret-mask-control-$$" pid r=0
  mkdir -p "$s/d" && : > "$s/f" && : > "$s/d/g" || { say "BLIND: cannot create scratch under /var/tmp"; return 2; }
  if ! systemd-run --quiet --collect --unit="$u" -p Type=exec -p InaccessiblePaths="-$s/f" -p InaccessiblePaths="-$s/d" sleep 120 >/dev/null 2>&1 \
     || ! pid="$(wait_pid "$u")"; then
    say "BLIND: could not start the control unit"; systemctl stop "$u" >/dev/null 2>&1; rm -rf "$s"; return 2
  fi
  visible "$pid" "$s/f" && { say "BLIND: control file visible BEFORE rewrite (masks are not applied)"; r=2; }
  rewrite "$s/f"; rewrite "$s/d/g"
  if [ "$r" = 0 ]; then
    if visible "$pid" "$s/f"; then say "control: a FILE mask replaced by rename is visible (expected; the probe can see a leak)"
    else say "BLIND: the stale file mask was not detected; this probe cannot see a leak"; r=2; fi
    if visible "$pid" "$s/d/g"; then say "FAIL control: a DIRECTORY mask leaked a renamed file"; r=1
    else say "control: a DIRECTORY mask held across rename"; fi
  fi
  systemctl stop "$u" >/dev/null 2>&1; rm -rf "$s"
  return "$r"
}

# ── check: every running service ─────────────────────────────────────────────
check() {
  local u pid ip p f n_ok=0 n_ex=0
  local d
  for d in $MASK_DIRS; do
    if [ -L "$d" ] || [ ! -d "$d" ]; then say "FAIL $d is not a real directory"; FIND=1
    else [ "$(stat -c '%a %u' "$d")" = "700 0" ] || { say "FAIL $d is $(stat -c '%a uid=%u' "$d") (want 700 uid=0)"; FIND=1; }; fi
  done
  while read -r u _; do
    case "$u" in *.service) ;; *) continue ;; esac
    case "$u" in secret-mask-*) continue ;; esac
    pid="$(mainpid "$u")"; [ -n "$pid" ] && [ "$pid" != 0 ] || continue
    ip=" $(systemctl show -p InaccessiblePaths --value "$u" 2>/dev/null) "
    local missing=""
    for d in $MASK_DIRS; do [[ "$ip" == *" $d "* ]] || [[ "$ip" == *" -$d "* ]] || missing="$missing $d"; done
    if [ -n "$missing" ]; then
      if systemctl show -p DropInPaths --value "$u" 2>/dev/null | tr ' ' '\n' | grep -q "/$u.d/$DROPIN_NAME\$"; then
        say "EXEMPT $u (declared override of $DROPIN_NAME)"; n_ex=$((n_ex + 1))
      else
        say "UNMASKED $u: its InaccessiblePaths= does not name$missing and it is not a declared exemption"; FIND=1
      fi
      continue
    fi
    for p in $ip; do
      p="${p#-}"
      visible "$pid" "$p" || continue
      if is_gating "$p"; then say "VISIBLE $u $p"; FIND=1
      else say "VISIBLE-OTHER $u $p"; OTHER=1; fi
    done
    while read -r f; do visible "$pid" "$f" && { say "VISIBLE $u $f"; FIND=1; }; done < <(scoped_files)
    n_ok=$((n_ok + 1))
  done < <(systemctl list-units --type=service --state=running --no-legend --plain 2>/dev/null)
  say "checked $n_ok masked running service(s), $n_ex declared exemption(s)"
}

# ── selftest ─────────────────────────────────────────────────────────────────
selftest() {
  local R="${RENDERER:-$_here/render-secret-scope.sh}" vd sd=/run/systemd/system pr pid f u
  [ -f "$R" ] || { say "BLIND: no renderer at $R"; return 2; }
  [ -d /run/systemd/system ] || { say "BLIND: systemd is not PID1 here"; return 2; }
  vd=""; for f in /usr/lib/systemd/system/vessel.d/10-secrets-out-of-reach.conf /etc/systemd/system/vessel.d/10-secrets-out-of-reach.conf; do [ -f "$f" ] && vd="$f"; done
  [ -n "$vd" ] || { say "BLIND: no installed vessel drop-in"; return 2; }
  bash "$R" --mode recover --manifest "$MANIFEST" --env-dir "$ENV_DIR" >/dev/null 2>&1 || { say "BLIND: the renderer failed before the probes started"; return 2; }
  # Two probes: a vessel (its own drop-in + the default) and a tick (the default only).
  printf '[Service]\nType=exec\nExecStart=/bin/sleep 600\n' > "$sd/secret-mask-selftest-vessel.service"
  mkdir -p "$sd/secret-mask-selftest-vessel.service.d"; ln -sfn "$vd" "$sd/secret-mask-selftest-vessel.service.d/10-secrets-out-of-reach.conf"
  printf '[Unit]\nDescription=tick-style oneshot probe (no vessel drop-in)\n[Service]\nType=exec\nExecStart=/bin/sleep 600\n' > "$sd/secret-mask-selftest-tick.service"
  systemctl daemon-reload
  for pr in vessel tick; do systemctl start "secret-mask-selftest-$pr.service" || { say "FAIL the $pr probe did not start"; FIND=1; }; done
  # The write pattern that defeated the file mask: re-render every scoped file by rename,
  # AFTER the probes built their namespaces.
  bash "$R" --mode recover --manifest "$MANIFEST" --env-dir "$ENV_DIR" >/dev/null 2>&1 || { say "FAIL the re-render failed"; FIND=1; }
  # The store's writers (gen-env, seed-identity, secrets.env.sh) replace it the same way.
  for f in "$STORE" "$STORE.prev"; do [ -f "$f" ] && rewrite "$f"; done
  for pr in vessel tick; do
    pid="$(wait_pid "secret-mask-selftest-$pr.service")" || continue
    local seen=0 n=0
    while read -r f; do
      [ -e "$f" ] || continue; n=$((n + 1))
      visible "$pid" "$f" && { say "VISIBLE $pr-probe $f (after rename-rewrite)"; seen=1; FIND=1; }
    done < <(scoped_files; for f in $MASK_DIRS; do echo "$f"; done)
    [ "$seen" = 0 ] && say "ok $pr-probe: none of $n scoped path(s) visible after the re-render"
  done
  # Positive control: each consumer, as a copy of its own environment and mask lines.
  mkdir -p /run/secret-mask-selftest
  for u in $CONSUMERS; do
    systemctl cat "$u.service" >/dev/null 2>&1 || { say "skip consumer $u: not installed in this image"; continue; }
    local want; want="$ENV_DIR/${UNIT_TMPL//\{unit\}/$u}"
    systemctl show -p EnvironmentFiles --value "$u.service" | grep -q "^$want (ignore_errors=no)" \
      || { say "FAIL consumer $u: EnvironmentFiles does not list $want (required)"; FIND=1; }
    {
      echo "[Service]"; echo "Type=oneshot"
      systemctl cat "$u.service" 2>/dev/null | grep -E '^[[:space:]]*EnvironmentFile[[:space:]]*='
      for f in $(systemctl show -p InaccessiblePaths --value "$u.service"); do echo "InaccessiblePaths=$f"; done
      echo "ExecStart=/bin/sh -c 'env | cut -d= -f1 | sort > /run/secret-mask-selftest/$u.names; { [ -e \"$want\" ] || [ -e \"$STORE\" ] && echo visible || echo masked; } > /run/secret-mask-selftest/$u.sight'"
    } > "$sd/secret-mask-consumer-$u.service"
    # A declared exemption is mirrored, so the copy sees exactly what the unit sees.
    if systemctl show -p DropInPaths --value "$u.service" | tr ' ' '\n' | grep -q "/$u.service.d/$DROPIN_NAME\$"; then
      mkdir -p "$sd/secret-mask-consumer-$u.service.d"
      printf '[Service]\n' > "$sd/secret-mask-consumer-$u.service.d/$DROPIN_NAME"
      : > "/run/secret-mask-selftest/$u.exempt"
    fi
  done
  systemctl daemon-reload
  for u in $CONSUMERS; do
    [ -f "$sd/secret-mask-consumer-$u.service" ] || continue
    local want; want="$ENV_DIR/${UNIT_TMPL//\{unit\}/$u}"
    if ! systemctl start "secret-mask-consumer-$u.service" 2>/dev/null; then say "FAIL consumer $u: the copy did not start (its EnvironmentFile= failed to load)"; FIND=1; continue; fi
    local miss="" nm
    for nm in $(grep -oE '^[A-Z_][A-Z0-9_]*=' "$want" | tr -d '='); do
      grep -qx "$nm" "/run/secret-mask-selftest/$u.names" || miss="$miss $nm"
    done
    if [ -n "$miss" ]; then say "FAIL consumer $u lost:$miss"; FIND=1
    else say "ok consumer $u: every name in its scoped file reached its environment ($(grep -cE '^[A-Z_][A-Z0-9_]*=' "$want") name(s))"; fi
    if [ -e "/run/secret-mask-selftest/$u.exempt" ]; then
      say "ok consumer $u: a declared exemption (service.d/EXEMPT); it opens $want at runtime by design"
    elif [ "$(cat "/run/secret-mask-selftest/$u.sight")" = masked ]; then say "ok consumer $u: its own process cannot see $want or the store"
    else say "VISIBLE consumer $u sees $want or the store from inside"; FIND=1; fi
  done
  # Positive control for the store's runtime readers: every declared exemption, as a copy
  # with its own mask lines and its exemption mirrored, sources the store the way its
  # script does and must receive every NAME the store holds (values never leave the copy).
  local ex=""; for f in /usr/lib/systemd/system/service.d/EXEMPT /etc/systemd/system/service.d/EXEMPT; do [ -f "$f" ] && ex="$f"; done
  if [ -n "$STORE_DIR" ] && { [ ! -f "$STORE" ] || [ -z "$ex" ]; }; then
    say "FAIL no persisted store at $STORE or no installed service.d/EXEMPT: the store readers cannot be proven"; FIND=1
  fi
  if [ -n "$STORE_DIR" ] && [ -f "$STORE" ] && [ -n "$ex" ]; then
    for u in $(sed -e 's/#.*//' "$ex" | awk 'NF{print $1}'); do
      u="${u%.service}"
      systemctl cat "$u.service" >/dev/null 2>&1 || { say "skip store reader $u: not installed"; continue; }
      {
        echo "[Service]"; echo "Type=oneshot"
        for f in $(systemctl show -p InaccessiblePaths --value "$u.service"); do echo "InaccessiblePaths=$f"; done
        echo "ExecStart=/bin/sh -c 'env -i sh -c \". $STORE; set | cut -d= -f1\" | sort -u > /run/secret-mask-selftest/$u.store-names'"
      } > "$sd/secret-mask-reader-$u.service"
      mkdir -p "$sd/secret-mask-reader-$u.service.d"; printf '[Service]\n' > "$sd/secret-mask-reader-$u.service.d/$DROPIN_NAME"
    done
    systemctl daemon-reload
    for u in $(sed -e 's/#.*//' "$ex" | awk 'NF{print $1}'); do
      u="${u%.service}"; [ -f "$sd/secret-mask-reader-$u.service" ] || continue
      systemctl start "secret-mask-reader-$u.service" 2>/dev/null || { say "FAIL store reader $u: the copy did not run"; FIND=1; continue; }
      local miss="" nm n=0
      for nm in $(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$STORE" | tr -d '=' | sort -u); do
        n=$((n + 1)); grep -qx "$nm" "/run/secret-mask-selftest/$u.store-names" || miss="$miss $nm"
      done
      if [ -n "$miss" ]; then say "FAIL store reader $u could not read:$(echo $miss | wc -w) name(s)"; FIND=1
      else say "ok store reader $u (declared exemption): sources the store and receives all $n name(s)"; fi
    done
  fi
  for pr in vessel tick; do systemctl stop "secret-mask-selftest-$pr.service" >/dev/null 2>&1; done
  rm -rf "$sd"/secret-mask-selftest-* "$sd"/secret-mask-consumer-* "$sd"/secret-mask-reader-* /run/secret-mask-selftest
  systemctl daemon-reload
}

control; rc=$?
[ "$rc" = 2 ] && { echo "RESULT blind"; exit 2; }
[ "$rc" = 1 ] && FIND=1
if [ "$MODE" = check ]; then check; else selftest || { echo "RESULT blind"; exit 2; }; fi
[ "$FIND" = 1 ] && { echo "RESULT fail"; exit 1; }
[ "$OTHER" = 1 ] && { echo "RESULT fail-other (the scoped-secrets directory holds; another masked path does not)"; exit 3; }
echo "RESULT pass"; exit 0
