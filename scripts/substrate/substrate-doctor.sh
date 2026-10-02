#!/usr/bin/env bash
# substrate-doctor.sh — "is this substrate actually alive?" in one command.
#
# Beyond substrate-ready's per-unit health matrix, this verifies the seams that
# have historically failed silently:
#   1. fleet readiness matrix (substrate-ready --once)
#   2. SurrealDB root auth      — catches the SURREAL_PASS/datastore drift
#                                 (regenerated pass vs persisted root user, 2026-07-02)
#   3. seeded-key auth          — METABOB_API_KEY authenticates against activity-api
#   4. discovery registry       — registered-vessel count vs a sane floor
#   5. failed systemd units     — catches silently-dead timers/crash-loops
#   6. --smoke                  — dispatch the known-answer goal substrate-status
#                                 bakes, require reached:true (an execution id alone
#                                 proves only that a walk started), and confirm the
#                                 execution trace lands (end-to-end)
#
# Usage: substrate-doctor.sh [--smoke]
# Exit 0 = all checks pass; 1 = at least one failure.
# Dual-context like substrate-ready.sh (host via docker exec, or in-container).
set -uo pipefail

CONTAINER="${CONTAINER:-substrate-live}"
SMOKE=0
[ "${1:-}" = "--smoke" ] && SMOKE=1

if command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER" >/dev/null 2>&1; then
  IN_CONTAINER=0
else
  IN_CONTAINER=1
fi
csh() { if [ "$IN_CONTAINER" = 1 ]; then sh -c "$1"; else docker exec "$CONTAINER" sh -c "$1"; fi; }

FAIL=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=1; }
note() { printf '       %s\n' "$1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The LLM and goal probes live once, in substrate-status (--probe llm|goal), so the
# doctor and the install verdict cannot drift apart. From the host, the checkout's
# copy is streamed into the container, which works against images that predate it.
status_probe() { # probe -> JSON line on stdout; exit 0 pass, 1 fail, 3 unknown
  if [ "$IN_CONTAINER" = 1 ]; then
    if [ -x /usr/local/bin/substrate-status ]; then /usr/local/bin/substrate-status --probe "$1" --json
    else "$SCRIPT_DIR/substrate-status.sh" --probe "$1" --json; fi
  else
    docker exec -i "$CONTAINER" bash -s -- --probe "$1" --json < "$SCRIPT_DIR/substrate-status.sh"
  fi
}

echo "== 1. fleet readiness =="
if [ "$IN_CONTAINER" = 1 ] && [ -x /usr/local/bin/substrate-ready ]; then
  /usr/local/bin/substrate-ready --once || FAIL=1
else
  CONTAINER="$CONTAINER" "$SCRIPT_DIR/substrate-ready.sh" --once || FAIL=1
fi

echo "== 1b. datastore disk headroom =="
# A FULL DISK PRESENTS AS DATABASE-PERFORMANCE PATHOLOGY, AND NOTHING ELSE ALARMED.
#
# 2026-08-10: the hub sat at 76G/77G used — 1.1G free — and SurrealDB began timing
# out on writes: 28 "query was not executed because it exceeded the timeout" on
# INSERT INTO execution in a single 20-minute window, with the process never
# restarting. Everything downstream stopped quietly: ribosome extraction skipped
# every execution (verdict=ungraded), reaches went ungraded, and spoke traces were
# dropped by TranslatingTraceSink. No check anywhere reported a problem, and the
# investigation burned three plausible wrong causes (index count, request volume,
# restart loop) before `df -h` answered it in one line.
#
# Thresholds are on FREE SPACE, not percentage: an 18G datastore on a 99%-full 77G
# disk has 1.1G to work with regardless of what the ratio says.
DISK_AVAIL_MB="$(csh 'df -Pm /var/lib/surrealdb 2>/dev/null || df -Pm /' | awk 'NR==2 {print $4}')"
DISK_USE_PCT="$(csh 'df -P /var/lib/surrealdb 2>/dev/null || df -P /' | awk 'NR==2 {print $5}' | tr -d '%')"
if [ -z "$DISK_AVAIL_MB" ]; then
  note "could not read datastore filesystem usage — skipping headroom check"
elif [ "$DISK_AVAIL_MB" -lt 2048 ]; then
  bad "datastore disk has ${DISK_AVAIL_MB}MB free (${DISK_USE_PCT}% used) — SurrealDB WILL time out on writes"
  note "grading, ribosome extraction and trace persistence stop silently at this level"
  note "reclaim without touching data: docker builder prune -f ; journalctl --vacuum-size=200M"
  note "do NOT prune docker local volumes — that is the substrate datastore"
elif [ "$DISK_AVAIL_MB" -lt 8192 ]; then
  note "WARN datastore disk has ${DISK_AVAIL_MB}MB free (${DISK_USE_PCT}% used) — below 8G, watch it"
else
  ok "datastore disk headroom ${DISK_AVAIL_MB}MB free (${DISK_USE_PCT}% used)"
fi

# ── Topology, read once ──────────────────────────────────────────────────────
# EVERY CHECK BELOW USED TO ASSUME A STANDALONE FLEET, so on a spoke — where the
# store, the trace API and identity live on the HUB by design — four checks
# failed for reasons that were not defects, and none of them named the actual
# problem. Measured on a spoke whose hub rejected its key: check 2 failed with a
# "likely cause" that was wrong twice over (fresh volume, and a spoke has no
# local surrealdb at all), check 3 probed a masked loopback port, and the real
# fault — a 401 from the hub on every write — was named by nothing.
#
# Ask systemd what is actually here rather than inferring from env: a masked unit
# is the definitive statement that this topology does not serve that role.
masked() { [ "$(csh "systemctl is-enabled '$1' 2>/dev/null" 2>/dev/null || true)" = "masked" ]; }
IS_SPOKE=0
# STRIP THE QUOTES BEFORE TESTING FOR EMPTY. gen-env emits HUB_DISCOVERY_URL=""
# on a standalone, and `grep -E '^HUB_DISCOVERY_URL=.+'` matches that line
# because the two quote characters ARE content — which labelled every standalone
# a spoke. Read the value, not the line.
_hub="$(csh 'grep -m1 "^HUB_DISCOVERY_URL=" /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d "\"'"'"'"' 2>/dev/null || true)"
[ -n "$_hub" ] && IS_SPOKE=1
# The endpoints this fleet actually resolves against — loopback on a standalone,
# the hub on a spoke. Probing the hardcoded loopback is what made check 3 blind.
ACTIVITY_EP="$(csh 'grep -m1 "^ACTIVITY_API_ENDPOINT=" /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d "\""' 2>/dev/null || true)"
IDENTITY_EP="$(csh 'grep -m1 "^IDENTITY_VESSEL_URL=" /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d "\""' 2>/dev/null || true)"
[ -n "$ACTIVITY_EP" ] || ACTIVITY_EP="http://127.0.0.1:8080"
[ -n "$IDENTITY_EP" ] || IDENTITY_EP="http://127.0.0.1:8101"
[ "$IS_SPOKE" = 1 ] && note "topology: spoke — store/identity/trace checks target the hub ($ACTIVITY_EP)"

echo "== 2. SurrealDB root auth =="
# A masked store is only "lives on the hub" when there IS a hub. On a hubless
# standalone this branch used to PASS with that rationale — measured 2026-09-15
# (validation/reports/wiring-green-vs-miswired-proof): a fleet whose only
# functional vessel wrote to a store nothing served drew a green check with a
# false explanation, and the store was never probed anywhere. The discriminator
# is systemd's own dependency metadata: a unit that declares Wants=/Requires=
# surrealdb.service is a store client by its own declaration (After= is pure
# ordering and deliberately NOT counted — most units order after the store
# without being clients). Active clients + masked store + no hub → probe the
# RESOLVED SURREALDB_URL (never assume loopback: a remote-store topology is
# legitimate); unreachable means those clients write into the void.
if masked surrealdb.service; then
  if [ "$IS_SPOKE" = 1 ]; then
    ok "skipped — surrealdb is masked on this spoke; the datastore lives on the hub"
  else
    STORE_CLIENTS="$(csh 'systemctl list-units --type=service --state=active --no-legend --plain 2>/dev/null | awk "{print \$1}" | while read -r u; do systemctl show -p Wants -p Requires --value "$u" 2>/dev/null | tr " " "\n" | grep -qx surrealdb.service && echo "$u"; done' 2>/dev/null || true)"
    if [ -z "$STORE_CLIENTS" ]; then
      ok "skipped — store masked, no hub, and no active unit declares a store dependency; nothing to verify"
    else
      SURREAL_URL="$(csh 'grep -m1 "^SURREALDB_URL=" /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d "\""' 2>/dev/null || true)"
      [ -n "$SURREAL_URL" ] || SURREAL_URL="http://127.0.0.1:8000"
      STORE_PROBE="$(csh 'P=$(grep -m1 "^SURREALDB_PASSWORD=" /etc/substrate/env | cut -d= -f2- | tr -d "\""); U=$(grep -m1 "^SURREALDB_URL=" /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d "\""); printf "user = root:%s\n" "$P" | curl -s -m 5 -K - -X POST "${U:-http://127.0.0.1:8000}/sql" -H "Accept: application/json" -H "surreal-ns: activity-system" -H "surreal-db: learning_loop" -d "RETURN 1;"' 2>/dev/null || true)"
      if echo "$STORE_PROBE" | grep -q '"OK"'; then
        ok "store masked locally but the resolved SURREALDB_URL ($SURREAL_URL) answers — remote-store topology"
      else
        bad "surrealdb is masked, no hub is configured, and SURREALDB_URL ($SURREAL_URL) does not answer — active store client(s) write into the void: $(echo "$STORE_CLIENTS" | tr '\n' ' ')"
        note "either enable surrealdb.service here, point SURREALDB_URL at a store that exists, or disable the client unit(s)"
      fi
    fi
  fi
else
SURREAL_CHECK="$(csh 'P=$(grep -m1 "^SURREALDB_PASSWORD=" /etc/substrate/env | cut -d= -f2- | tr -d "\""); printf "user = root:%s\n" "$P" | curl -s -m 5 -K - -X POST http://127.0.0.1:8000/sql -H "Accept: application/json" -H "surreal-ns: activity-system" -H "surreal-db: learning_loop" -d "RETURN 1;"' 2>/dev/null || true)"
if echo "$SURREAL_CHECK" | grep -q '"OK"'; then
  ok "surrealdb root credentials valid"
else
  bad "surrealdb root auth FAILED — env SURREAL_PASS does not match the datastore root user"
  note "response: $(echo "$SURREAL_CHECK" | head -c 120)"
  # Offer the recreate-against-warm-volume cause only when the volume IS warm.
  # Stating it unconditionally sent a reader chasing a recreate that never
  # happened, on a fleet whose datastore had been created minutes earlier.
  if csh '[ -d /var/lib/surrealdb ] && [ -n "$(ls -A /var/lib/surrealdb 2>/dev/null)" ]' 2>/dev/null; then
    note "likely cause: container recreate regenerated SURREAL_PASS against a warm datastore volume"
  else
    note "the datastore directory is empty — this is a first boot, not a recreate against warm state"
  fi
fi
fi

echo "== 2b. no credential on any command line =="
# /proc/<pid>/cmdline is world-readable: a secret passed as a flag is readable by every
# process in the container and by `ps` on the host. surrealdb.service carried the DB
# root password as a flag for months, and probes passed it to curl as user:password.
# This check matches argv by SHAPE, never by value, so it reads no secret, and it prints
# only shape names, counts, PIDs and comm names — never argv.
#   pass  : an argument equal to the pass/password long flag, or that flag with `=…`
#   user  : the -u/--user flag followed by an argument containing ':' (or joined: -ux:y, --user=x:y)
#   authz : the -H/--header flag followed by an Authorization header (or joined)
# Severity: pass and user FAIL on any count. authz is reported as a count only: a curl
# -H request lives for milliseconds, so a sample of it cannot gate anything — the
# static ratchet in 2c is where authz sites are held to a ceiling.
# NO SELF-COUNT, by construction: every flag literal is assembled inside awk from
# fragments ("-" "-pa" "ss"), so no argument of the scanner — the awk program, the sh -c
# body — contains a contiguous flag; and matching is whole-argument, anchored at the
# argument's first byte, while each of those arguments begins with code, not a dash.
# POSITIVE CONTROL: the scan plants a short-lived process whose argv carries the bind
# flag (surreal's own counts too). If the control is not seen the scan read nothing —
# /proc empty or unreadable, or the matcher broken — and the verdict is BLIND, never
# PASS. $1 overrides the proc root (scratch tests only).
ARGV_SCAN="$(cat <<'SCAN'
R="${1:-/proc}"
C="$(printf '%s%s' '--bi' 'nd')"
sh -c 'sleep 15; :' argv-scan-control "$C" >/dev/null 2>&1 &
CP=$!
sleep 0.5
for f in "$R"/[0-9]*/cmdline; do
  [ -r "$f" ] || continue
  d="${f%/cmdline}"
  printf '\001%s\n' "${d##*/}"
  tr '\000' '\n' < "$f" 2>/dev/null
  echo
done | awk '
  BEGIN {
    BIND = "-" "-bi" "nd"; PASS = "-" "-pa" "ss"; PASSW = PASS "word"
    U = "-" "u"; USER = "-" "-us" "er"; H = "-" "H"; HDR = "-" "-hea" "der"; AUTHZ = "author" "ization:"
  }
  function hit(s,  k) { k = s SUBSEP pid; if (!(k in seen)) { seen[k] = 1; n[s]++; ids[s] = ids[s] " " pid } }
  function starts(x, p) { return index(x, p) == 1 }
  /^\001/ { pid = substr($0, 2); prev = ""; scanned++; next }
  {
    a = $0; la = tolower(a)
    if (a == BIND || starts(a, BIND "=")) hit("control")
    if (a == PASS || a == PASSW || starts(a, PASS "=") || starts(a, PASSW "=")) hit("pass")
    if ((prev == U || prev == USER) && index(a, ":") > 0) hit("user")
    if (starts(a, USER "=") && index(substr(a, length(USER) + 2), ":") > 0) hit("user")
    if (starts(a, U) && length(a) > 2 && substr(a, 3, 1) != "-" && index(a, ":") > 0) hit("user")
    if ((prev == H || prev == HDR) && index(la, AUTHZ) > 0) hit("authz")
    if ((starts(a, HDR "=") || (starts(a, H) && length(a) > 2)) && index(la, AUTHZ) > 0) hit("authz")
    prev = a
  }
  END {
    printf "scanned %d\n", scanned + 0
    split("control pass user authz", S, " ")
    for (i = 1; i <= 4; i++) printf "%s %d%s\n", S[i], n[S[i]] + 0, ids[S[i]]
  }' | while read -r shape count pids; do
  out="$shape $count"
  for p in $pids; do
    c="$(tr -cd 'A-Za-z0-9._:-' < "$R/$p/comm" 2>/dev/null)"
    out="$out $p(${c:-?})"
  done
  echo "$out"
done
kill "$CP" 2>/dev/null
# PENDING-RESTART EVIDENCE for surrealdb (read here, in the container, where systemd is).
# The unit fix lands by convergence, but the running surreal keeps its old argv until
# its next restart. Emit: MainPID, its wall-clock start, the installed unit file's
# mtime, and whether that file still carries the pass flag. Start time comes from
# /proc/<pid>/stat field 22 (ticks since boot) + /proc/stat btime: it is anchored to
# the PID we matched, integer-only, and needs no date parsing (ExecMainStart* is
# systemd's record of the start, which is not necessarily the PID in hand).
# $2/$3 override the PID and the unit path (scratch tests only).
SP="${2:-$(systemctl show -p MainPID --value surrealdb 2>/dev/null)}"
FP="${3:-$(systemctl show -p FragmentPath --value surrealdb 2>/dev/null)}"
ST=""; MT=""; UF=""
case "$SP" in ''|0|*[!0-9]*) SP="" ;; esac
if [ -n "$SP" ] && [ -r "$R/$SP/stat" ] && [ -r "$R/stat" ]; then
  _rest="$(sed 's/^.*) //' "$R/$SP/stat" 2>/dev/null)"
  _tk="$(printf '%s\n' "$_rest" | awk '{ print $20 }')"
  _bt="$(awk '$1 == "btime" { print $2 }' "$R/stat")"
  _hz="$(getconf CLK_TCK 2>/dev/null || echo 100)"
  case "$_tk$_bt$_hz" in ''|*[!0-9]*) ;; *) ST=$(( _bt + _tk / _hz )) ;; esac
fi
if [ -n "$FP" ] && [ -f "$FP" ]; then
  MT="$(stat -c %Y "$FP" 2>/dev/null)"
  _pf="$(printf '%s%s' '--pa' 'ss')"
  # fixed = no non-comment line of the installed unit carries the flag
  if grep -v '^[[:space:]]*#' "$FP" 2>/dev/null | grep -q -e "$_pf"; then UF=0; else UF=1; fi
fi
echo "surreal ${SP:--} ${ST:--} ${MT:--} ${UF:--}"
SCAN
)"
ARGV_OUT="$(csh "$ARGV_SCAN" 2>/dev/null || true)"
_argv() { printf '%s\n' "$ARGV_OUT" | awk -v s="$1" '$1==s { $1=""; sub(/^ /, ""); print; exit }'; }
_argv_n() { _v="$(_argv "$1")"; _v="${_v%% *}"; case "$_v" in ''|*[!0-9]*) echo 0 ;; *) echo "$_v" ;; esac; }
ARGV_CTL="$(_argv_n control)"; ARGV_SCANNED="$(_argv_n scanned)"
if [ "$ARGV_CTL" -lt 1 ]; then
  bad "BLIND — the positive control matched no process (scanned $ARGV_SCANNED); the argv scan read nothing, so its zeros are not a pass"
else
  ARGV_HITS=0; _hit_pids=""
  for _s in pass user; do
    _n="$(_argv_n "$_s")"
    if [ "$_n" -gt 0 ]; then
      ARGV_HITS=1
      _ids="$(_argv "$_s")"; _ids="${_ids#* }"
      for _t in $_ids; do _hit_pids="$_hit_pids ${_t%%(*}"; done
    fi
  done
  # PENDING RESTART: the ONLY pass/user carrier is surrealdb's MainPID, that process
  # started before the installed unit file was written, and the installed unit no longer
  # carries the flag outside comments — i.e. the fix has landed and only the restart
  # (deferred to the rotation window) is owed. Still a FAIL, but labelled, so a known
  # owed restart does not read like a new leak. Anything else is a plain FAIL.
  read -r _sp _st _mt _uf <<< "$(_argv surreal)"
  _uniq="$(printf '%s\n' $_hit_pids | sort -u | tr '\n' ' ')"; _uniq="${_uniq% }"
  ARGV_PENDING=0
  case "$_sp$_st$_mt" in
    ''|*[!0-9]*) ;;
    *) [ "$_uniq" = "$_sp" ] && [ "$_uf" = 1 ] && [ "$_st" -lt "$_mt" ] && ARGV_PENDING=1 ;;
  esac
  if [ "$ARGV_PENDING" = 1 ]; then
    bad "(pending restart: unit fixed, process predates it) surrealdb MainPID $_sp is the only credential-flag carrier; it started at epoch $_st, before the installed unit was written at $_mt — clears at the next surrealdb restart"
  else
    for _s in pass user; do
      _n="$(_argv_n "$_s")"
      [ "$_n" -gt 0 ] || continue
      _ids="$(_argv "$_s")"; _ids="${_ids#* }"
      case "$_s" in
        pass) bad "$_n process(es) carry a pass/password flag in argv: $_ids" ;;
        user) bad "$_n process(es) carry -u/--user <x>:<y> in argv: $_ids" ;;
      esac
    done
  fi
  _n="$(_argv_n authz)"
  if [ "$_n" -gt 0 ]; then _ids="$(_argv authz)"; note "authz (count only, not a gate): $_n process(es) carried an Authorization header in argv at sample time: ${_ids#* }"
  else note "authz (count only, not a gate): 0 at sample time"; fi
  if [ "$ARGV_HITS" = 1 ] && [ "$ARGV_PENDING" = 1 ]; then
    note "owed: one surrealdb restart (the rotation window); no code change is needed"
  elif [ "$ARGV_HITS" = 1 ]; then
    note "pass credentials through the environment (SURREAL_PASS) or stdin (curl -K -), never a flag"
  else
    ok "no pass/user credential flag on any command line (scanned $ARGV_SCANNED, control $ARGV_CTL)"
  fi
fi

echo "== 2c. credential-in-argv sites in source (ratchet) =="
# The runtime sample in 2b sees only what is running at that instant; the source is
# where every future carrier comes from. Each `argv_shape_sites` row in
# scripts/substrate/self-facts.json names a shape (site_pattern, an ERE), the paths it
# covers (super_repo_pathspecs) and a ceiling (max) — the same ratchet Row B
# (typed_seam_sites) uses. max only moves DOWN, by a data commit, as sites migrate to
# env/stdin; above it is a FAIL, below it is a note to lower it. Comment lines never
# count. The doctor holds no copy of any site_pattern (they live in the JSON, which no
# pathspec covers), so this check cannot count itself.
SRC_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$SRC_ROOT" ] && [ -f "$SRC_ROOT/scripts/substrate/self-facts.json" ] || SRC_ROOT=""
if [ -z "$SRC_ROOT" ] && [ "$IN_CONTAINER" = 1 ] && [ -f /workspace/git/super-repo/scripts/substrate/self-facts.json ]; then
  SRC_ROOT=/workspace/git/super-repo
fi
SITE_ROWS=""
[ -n "$SRC_ROOT" ] && SITE_ROWS="$(jq -r '.rows[] | select(.instrument == "argv_shape_sites") | .id' "$SRC_ROOT/scripts/substrate/self-facts.json" 2>/dev/null || true)"
if [ -z "$SITE_ROWS" ]; then
  bad "UNOBSERVED — no source tree with argv_shape_sites rows in self-facts.json (looked at ${SRC_ROOT:-the checkout holding this doctor, and /workspace/git/super-repo}); the ratchet did not run"
else
  for _id in $SITE_ROWS; do
    _row="$(jq -c --arg id "$_id" '.rows[] | select(.id == $id)' "$SRC_ROOT/scripts/substrate/self-facts.json")"
    _pat="$(printf '%s' "$_row" | jq -r '.site_pattern // empty')"
    _max="$(printf '%s' "$_row" | jq -r '.max // empty')"
    _specs=(); while IFS= read -r _sp; do _specs+=("$_sp"); done < <(printf '%s' "$_row" | jq -r '.super_repo_pathspecs[]?')
    case "$_max" in ''|*[!0-9]*) bad "$_id: no numeric max in its row — the ratchet cannot be read"; continue ;; esac
    if [ -z "$_pat" ] || [ "${#_specs[@]}" = 0 ]; then bad "$_id: row has no site_pattern or pathspecs"; continue; fi
    _gout="$(git -C "$SRC_ROOT" grep -nE -e "$_pat" -- "${_specs[@]}" 2>&1)"; _grc=$?
    if [ "$_grc" -gt 1 ]; then bad "$_id: git grep failed (rc $_grc) — not a count"; continue; fi
    _sites="$(printf '%s\n' "$_gout" | awk 'NF { l = $0; sub(/^[^:]*:[0-9]+:/, "", l); if (l ~ /^[[:space:]]*(#|\/\/|\*)/) next; print }')"
    _cnt="$(printf '%s' "$_sites" | grep -c .)"
    if [ "$_cnt" -gt "$_max" ]; then
      bad "$_id: $_cnt site(s), above the ceiling of $_max — a new credential-in-argv site was added"
      note "sites: $(printf '%s\n' "$_sites" | cut -d: -f1,2 | tr '\n' ' ')"
    elif [ "$_cnt" -lt "$_max" ]; then
      ok "$_id: $_cnt remaining (ceiling $_max) — lower max to $_cnt in self-facts.json"
    else
      ok "$_id: $_cnt remaining (ceiling $_max)"
    fi
  done
fi

echo "== 3. seeded API key =="
# Probe the endpoint this fleet actually uses. Hardcoded loopback meant that on a
# spoke — where activity-api is masked and the trace store is the hub's — this
# check reported a local probe error, and the ONE check positioned to say
# "your hub rejected your key" said "HTTP 000" instead.
KEY_CODE="$(csh "K=\$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); curl -s -o /dev/null -w '%{http_code}' -m 8 -H \"Authorization: ApiKey \$K\" '$ACTIVITY_EP/v2/activities/templates?limit=1'" 2>/dev/null || true)"
_where="activity-api"; [ "$IS_SPOKE" = 1 ] && _where="the hub's activity-api ($ACTIVITY_EP)"
case "$KEY_CODE" in
  200) ok "METABOB_API_KEY authenticates against $_where" ;;
  401|403)
    bad "METABOB_API_KEY rejected by $_where (HTTP $KEY_CODE)"
    if [ "$IS_SPOKE" = 1 ]; then
      note "THIS SPOKE HAS NOT JOINED. The hub does not accept this key, so every write it"
      note "attempts — template seeding, traces, capability mirroring — is refused."
      note "Mint one on the hub: docker exec <hub-container> substrate-key issue <name>"
    else
      note "reseed needed (identity-seeder)"
    fi ;;
  *) bad "authed probe against $_where returned HTTP ${KEY_CODE:-none}" ;;
esac

echo "== 3b. credential is accepted by the identity that issued it =="
# The discriminator the spoke audit found missing. `substrate-key whoami` reports
# it correctly and doctor never asked, so a fleet could be comprehensively
# unable to join while doctor listed four unrelated failures.
VALID="$(csh "K=\$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); curl -s -m 8 -X POST '$IDENTITY_EP/v1/keys/validate' -H 'Content-Type: application/json' -d \"{\\\"api_key\\\":\\\"\$K\\\"}\"" 2>/dev/null || true)"
if echo "$VALID" | grep -q '"valid":[[:space:]]*true'; then
  ok "METABOB_API_KEY validates against $IDENTITY_EP"
elif echo "$VALID" | grep -q '"valid":[[:space:]]*false'; then
  bad "METABOB_API_KEY REJECTED by $IDENTITY_EP: $(echo "$VALID" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')"
  [ "$IS_SPOKE" = 1 ] && note "this is the join failure — nothing this spoke writes to the hub will be accepted"
else
  bad "identity validate unreadable at $IDENTITY_EP"
  note "response: $(echo "$VALID" | head -c 120)"
fi

echo "== 3c. the substrate can still manage its own keyspace =="
# SUBSTRATE_ADMIN_KEY is what /v1/jwt/generate's role gate (SEC-5, a9db360)
# requires before it will mint the admin JWT that `substrate-key issue|list|revoke`
# each present. Historically it was written by exactly ONE path —
# seed-identity.ts's genuine-first-boot branch — so any substrate seeded before
# that step shipped carries it EMPTY, and key management is unreachable with no
# way back: the only credential that could mint a replacement is the missing one.
#
# Measured on a hub 2026-08-26: an ACTIVE `substrate-admin` row, minted
# out-of-band through /v1/keys/issue (which returns the plaintext once over HTTP
# and stores only a hash), with the variable empty in both /etc/substrate/env and
# .substrate-secrets. The fleet was healthy and every other check passed. Nothing
# noticed until an operator tried to issue a key — which is why this check exists
# rather than being left to surface at the moment of need.
ADMIN_LEN="$(csh "grep -m1 '^SUBSTRATE_ADMIN_KEY=' /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d '\"' | wc -c" 2>/dev/null || echo 0)"
if [ "${ADMIN_LEN:-0}" -gt 1 ] 2>/dev/null; then
  ok "SUBSTRATE_ADMIN_KEY present — key management reachable"
else
  bad "SUBSTRATE_ADMIN_KEY is EMPTY — this substrate cannot issue, list, or revoke API keys"
  note "recover from inside the container: substrate-key bootstrap-admin"
  note "an active admin key may still exist in the datastore; its plaintext is not recoverable"
fi

echo "== 4. discovery registry =="
REG="$(csh 'curl -s -m 5 http://127.0.0.1:8100/registry/stats' 2>/dev/null || true)"
REG_N="$(echo "$REG" | jq -r '.total_vessels // .totalVessels // .registered // empty' 2>/dev/null || true)"
# Floor scales with topology: a role-subset container (spoke/hub) legitimately
# registers far fewer vessels than the full fleet.
REG_FLOOR=5
if csh 'grep -qE "^ENABLED_(ROLES|VESSELS)=." /etc/substrate/env 2>/dev/null' 2>/dev/null; then REG_FLOOR=2; fi
if [ -n "$REG_N" ] && [ "$REG_N" -ge "$REG_FLOOR" ] 2>/dev/null; then
  ok "discovery registry populated ($REG_N vessels)"
elif [ -n "$REG_N" ]; then
  bad "discovery registry looks hollow ($REG_N vessels registered)"
else
  bad "discovery registry stats unreadable"
  note "response: $(echo "$REG" | head -c 120)"
fi

echo "== 4b. shape resolution round-trip =="
# Liveness green is not wiring green — measured 2026-09-15
# (validation/reports/wiring-green-vs-miswired-proof): a fleet can be healthy
# at every port while a registered shape's producer cannot serve it. This is
# the positive control at the consuming layer: take one shape the LOCAL
# registry advertises, resolve it back THROUGH discovery the way a walk would
# (vesselCapability), and confirm the endpoint discovery hands out actually
# answers. It also catches the converse starvation: a vessel that runs
# indefinitely unregistered because its /register 401s every 60s — visible
# only in its own journal until this check.
RT_SHAPE="$(csh 'curl -s -m 5 http://127.0.0.1:8100/registry/shapes 2>/dev/null | jq -r ".shapes[0] // empty" 2>/dev/null' 2>/dev/null || true)"
if [ -z "$RT_SHAPE" ]; then
  if [ "$IS_SPOKE" = 1 ]; then
    note "local registry advertises no shapes — on a spoke whose vessels all resolve on the hub this can be by design; skipping round-trip"
  else
    bad "local registry advertises no shapes — nothing on this fleet is resolvable by a walk"
  fi
else
  RT_EP="$(csh "K=\$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); curl -s -m 8 -X POST http://127.0.0.1:8100/resolve -H 'Content-Type: application/json' -H \"Authorization: ApiKey \$K\" -d '{\"pointer\":{\"type\":\"vesselCapability\",\"shape\":\"$RT_SHAPE\"}}' | jq -r '.content.vessels[0].endpoint // empty'" 2>/dev/null || true)"
  if [ -z "$RT_EP" ]; then
    bad "discovery could not resolve a producer for its own advertised shape '$RT_SHAPE'"
  else
    RT_CODE="$(csh "curl -s -o /dev/null -w '%{http_code}' -m 5 '$RT_EP/health' 2>/dev/null" 2>/dev/null || true)"
    case "$RT_CODE" in
      200) ok "round-trip: shape '$RT_SHAPE' resolves to $RT_EP and the producer answers" ;;
      000) bad "round-trip: shape '$RT_SHAPE' resolves to $RT_EP but nothing answers there — the registry advertises a producer that does not exist" ;;
      *)   bad "round-trip: shape '$RT_SHAPE' resolves to $RT_EP which answers HTTP $RT_CODE — the producer exists but reports unhealthy" ;;
    esac
  fi
fi
# Registration starvation: a vessel whose /register is rejected retries forever
# and stays invisible to routing; the only trace is its own journal.
REG_STARVED="$(csh 'journalctl --since "-15 min" --no-pager 2>/dev/null | grep -E "discovery register (failed|error)" | sed -E "s/^.* ([a-zA-Z0-9-]+)\[[0-9]+\]: \[([a-zA-Z0-9-]+)\].*/\2/" | sort -u | head -5' 2>/dev/null || true)"
if [ -n "$REG_STARVED" ]; then
  bad "vessel(s) failing discovery registration in the last 15 min: $(echo "$REG_STARVED" | tr '\n' ' ')"
  note "they run but no walk can route to them; check identity/key wiring for the register call"
fi

echo "== 5. failed systemd units =="
FAILED_UNITS="$(csh 'systemctl --failed --no-legend --plain 2>/dev/null' 2>/dev/null | awk '{print $1}' | grep -v '^$' || true)"
if [ -z "$FAILED_UNITS" ]; then
  ok "no failed units"
else
  bad "failed units: $(echo "$FAILED_UNITS" | tr '\n' ' ')"
fi

echo "== 5b. restart loops =="
# `systemctl --failed` CANNOT SEE A RESTART LOOP. A unit with Restart= that keeps
# dying reports `activating`/`active` forever and never `failed`, so check 5
# above is structurally blind to it. Measured on a spoke: bootstrap-seeder
# cycling roughly once every 20s, doctor reporting no failed units, and the
# fleet's actual fault invisible.
#
# A DELTA, NOT A LIFETIME COUNT. NRestarts is cumulative for the life of the
# boot, so failing on NRestarts>0 would condemn every unit that ever recovered —
# including a healthy fleet whose vessel restarted once at boot. Take two
# samples and report only units whose counter MOVES between them; that is a loop
# happening now, which is what an operator needs to know.
# One call, parsed by block. systemd prints NRestarts BEFORE Id, so an
# order-assuming parser pairs each count with the previous unit's name — measured
# as a looping vessel reporting 0 while a direct query said 29.
_snap() {
  csh 'systemctl list-units --type=service --all --no-legend --plain 2>/dev/null | awk "{print \$1}" | grep -v "^$" | tr "\n" " " | xargs -r systemctl show --property=Id,NRestarts --no-pager 2>/dev/null' 2>/dev/null \
    | awk -F= '
        /^Id=/{id=$2}
        /^NRestarts=/{n=$2}
        /^[[:space:]]*$/{ if(id!=""){print id " " n} ; id=""; n="" }
        END{ if(id!=""){print id " " n} }'
}
SNAP1="$(_snap)"
# Must exceed one restart cycle. A measured seeder loop cycled about every 20s,
# so a 12s window saw no change and the loop read as healthy.
sleep "${DOCTOR_LOOP_WINDOW:-25}"
SNAP2="$(_snap)"
LOOPING=""
while read -r u n2; do
  [ -n "$u" ] || continue
  n1="$(echo "$SNAP1" | awk -v U="$u" '$1==U {print $2}')"
  [ -n "$n1" ] && [ -n "$n2" ] || continue
  [ "$n2" -gt "$n1" ] 2>/dev/null || continue
  # A COUNTER THAT MOVED IS NOT YET A LOOP. During boot a unit may retry and
  # then succeed — measured on a fresh fleet: concept-db-seeder went +1 inside
  # the window and settled at Result=success / inactive / dead, and flagging it
  # reported a FAILURE on a fleet that had come up correctly. That is the same
  # "validator fails on correct state" defect this check exists to remove.
  #
  # A real loop is still CYCLING when the window closes. A settled retry is
  # resting with a successful result. Ask for both before condemning.
  _st="$(csh "systemctl show '$u' -p ActiveState --value 2>/dev/null" 2>/dev/null || true)"
  _rs="$(csh "systemctl show '$u' -p Result --value 2>/dev/null" 2>/dev/null || true)"
  if [ "$_st" = "inactive" ] && [ "$_rs" = "success" ]; then continue; fi
  LOOPING="$LOOPING $u(+$((n2-n1)) in ${DOCTOR_LOOP_WINDOW:-25}s, total $n2, now $_st/$_rs)"
done <<EOF
$SNAP2
EOF
if [ -z "$LOOPING" ]; then
  ok "no unit restarted during a ${DOCTOR_LOOP_WINDOW:-25}s observation window"
else
  bad "restart loop:$LOOPING"
  note "these report 'activating'/'active', never 'failed' — check 5 cannot see them"
  note "read the cause: journalctl -u <unit> -n 50"
fi

echo "== 6. recovery-coverage lint =="
# Every long-running vessel service must be reachable by SOME recovery path:
# a health_port (self-recovery tick) or Restart= in its unit (systemd converge).
UNCOVERED="$(csh 'INV=/workspace/substrate/fleet/vessels.inventory.json; [ -f "$INV" ] || INV=/usr/local/share/substrate/vessels.inventory.json;
  jq -r ".vessels[] | select((.unit | endswith(\".service\")) and .health_port == null and (.role != \"seed\") and ((.manifest // false) | not)) | .unit" "$INV" 2>/dev/null | while read -r u; do
    # Resolve the unit wherever it is vendored. The image installs units to
    # /usr/lib/systemd/system (Dockerfile: /etc outranks and cannot be masked),
    # so a `[ -f /etc/systemd/system/$u ]` test matched ZERO of the fleet and
    # this check silently passed on every deployment. `systemctl cat` reads the
    # effective unit from /etc, /usr/lib or /run alike.
    uc="$(systemctl cat "$u" 2>/dev/null)"
    [ -n "$uc" ] || continue
    printf '%s\n' "$uc" | grep -q "^Type=oneshot" && continue
    printf '%s\n' "$uc" | grep -q "^Restart=" || echo "$u"
  done' 2>/dev/null || true)"
if [ -z "$UNCOVERED" ]; then
  ok "every long-running service has a health_port or Restart= policy"
else
  bad "no recovery path (no health_port, no Restart=): $(echo "$UNCOVERED" | tr '\n' ' ')"
fi

echo "== 7. llm arms answer a real call =="
# Not /health. Measured 2026-08-10: every local arm reported 200 with
# providers=[anthropic] and discovery listed nine servers for llm_completion,
# while EVERY actual call returned "Your credit balance is too low". The account
# was unfunded, so no compose could draft anything for hours, and each layer
# reported something true but not causal — the compose verdict even quoted the
# trailing federation-egress arm, which is the LAST candidate tried.
#
# A paid dependency is only provably alive if a real, minimal, paid call
# succeeds. 16 tokens costs a fraction of a cent and buys the one fact that
# matters: can this substrate draft at all.
LLM_OUT="$(status_probe llm 2>/dev/null)"; LLM_RC=$?
LLM_EV="$(printf '%s' "$LLM_OUT" | jq -r '.evidence // empty' 2>/dev/null)"
case "$LLM_RC" in
  0) ok "${LLM_EV:-an llm arm answered a real completion}" ;;
  1)
    bad "no LLM arm can complete a real call — the substrate cannot draft"
    note "${LLM_EV:-no evidence returned}"
    note "credit/quota or key problem, not a code problem; /health cannot see it" ;;
  *)
    note "llm probe could not decide (${LLM_EV:-probe unavailable, exit $LLM_RC})"
    note "expected on a role-subset node with no arm and no reachable federated one" ;;
esac

if [ "$SMOKE" = 1 ]; then
  echo "== 8. smoke: known-answer goal -> reached:true -> trace lands =="
  # `reached`, not `status` and not an execution id: a hollow walk completes and
  # still mints an id. The goal's answer is recomputed by goal-host's deterministic
  # registry oracle, so a pass here is evidence rather than a judge's prose.
  SMOKE_OUT="$(status_probe goal 2>/dev/null)"; SMOKE_RC=$?
  SMOKE_EV="$(printf '%s' "$SMOKE_OUT" | jq -r '.evidence // empty' 2>/dev/null)"
  # The probe names its dispatch, route and execution id as fields; nothing here
  # parses them out of the evidence prose.
  SMOKE_ROUTE="$(printf '%s' "$SMOKE_OUT" | jq -r '.route // empty' 2>/dev/null)"
  EXEC_ID="$(printf '%s' "$SMOKE_OUT" | jq -r '.execution_id // empty' 2>/dev/null)"
  if [ "$SMOKE_RC" = 0 ]; then
    ok "known-answer goal reached"
    note "$SMOKE_EV"
    if [ -z "$EXEC_ID" ] && [ "$SMOKE_ROUTE" = "federated" ]; then
      # A federated goal-host answers the poll through discovery, and not every
      # one reports the execution id it minted; name the check that did not run.
      note "SKIPPED trace check: the goal ran on a federated goal-host that reported no executionId"
    elif [ -z "$EXEC_ID" ]; then
      bad "the local goal-host reached the goal but recorded no executionId — a walk with no trace"
    else
      TRACE_OK=0
      for _ in $(seq 1 20); do
        CODE="$(csh "K=\$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); curl -s -o /dev/null -w '%{http_code}' -m 8 -H \"Authorization: ApiKey \$K\" $ACTIVITY_EP/v2/activities/execution-traces/$EXEC_ID" 2>/dev/null || true)"
        [ "$CODE" = "200" ] && { TRACE_OK=1; break; }
        sleep 3
      done
      if [ "$TRACE_OK" = 1 ]; then ok "execution trace landed ($EXEC_ID)"; else bad "trace for $EXEC_ID not readable within 60s"; fi
    fi
  elif [ "$SMOKE_RC" = 1 ]; then
    bad "known-answer goal did NOT reach"
    note "${SMOKE_EV:-no evidence returned}"
    note "why: the cockpit's goal_reasoning on that dispatch, or GET :8210/executions/<dispatch id> in-container"
  else
    bad "smoke could not be decided (${SMOKE_EV:-probe unavailable, exit $SMOKE_RC}) — an undecided smoke is not a pass"
  fi
fi

echo
if [ "$FAIL" = 0 ]; then echo "[doctor] all checks PASS"; else echo "[doctor] FAILURES detected" >&2; fi
exit "$FAIL"
