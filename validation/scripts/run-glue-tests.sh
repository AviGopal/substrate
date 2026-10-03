#!/usr/bin/env bash
# run-glue-tests — run every validation/scripts/*.test.sh and *.test.ts, so none of them
# is a gate with no call sites.
#
# WHY THIS EXISTS. The pull-sync, secrets drop-in and copy-pin tests in this directory
# guard the glue that runs before any substrate exists to host a validating activity.
# They were only ever run by hand, and a test nothing invokes cannot be observed failing,
# so its pass proves nothing. This runner is called by scripts/git-hooks/pre-commit
# (against the STAGED tree) and by scripts/substrate/acceptance/run-acceptance.sh.
#
# WHAT IT RUNS. Every validation/scripts/*.test.sh (bash) and *.test.ts (bun test) under
# --root, discovered by glob, never by a hand list: a new test is run by default. Compiled
# siblings (*.test.js, *.test.d.ts) are not tests and are not globbed. Each test gets a
# fresh TMPDIR and a scrubbed environment (env -i: PATH, HOME, TMPDIR, LANG, a fixed git
# identity), so a git hook's GIT_DIR / GIT_INDEX_FILE or an ambient SUBSTRATE_* variable
# cannot reach the git or pull-sync code under test. Output goes to one file per test in the log dir.
# Needs no container, network or docker; the tests stub every lifecycle call.
#
# SKIP IS NOT PASS. A bun test is SKIPPED, loudly and counted, when bun is absent or when
# a submodule worktree it reads is not checked out (NEEDS below). A skip never prints as
# PASS and never fails the run; the summary names how many were skipped and why.
#
# TRACKED RED IS NOT A REGRESSION. A check-first glue test (deliberately red until its fix lands,
# tracked by an OPEN gap) may be committed: a red *.test.sh is reported TRACKED-RED and does not
# fail the run when every case it reports as "FAIL - <label>" is named by an open gap whose
# evidence_resolve is {shape:"test_suite", input:{vessel:"super-repo",
# test_file:"validation/scripts/<file>", only_tests:["<label>", ...]}}. The predicate is
# scripts/substrate/lib/gap-tracked-red.sh under --root — the SAME file pull-sync's test gate
# sources, so the two cannot drift (see its header for the name rules). Displayed as
# <file>::<label>. A red file with no "FAIL - " line, any untracked case, no --gap-store, or an
# unreadable store is a failure: no store, no exemption. A tracked test that is green passes,
# with a note that its gap can close. bun tests (*.test.ts) are never exempted here.
#
# A REFUSED CREDENTIAL IS UNKNOWN, NOT RED. When the store answers 401 (gtr_load exit 2: the node
# key is stale or wrong), whether a red *.test.sh is tracked cannot be known. Such a test is
# reported UNKNOWN, never FAIL or TRACKED-RED, the output carries `credential refused (401) — key
# stale?`, and the run exits 3 (environment) when nothing else failed. That still stops the
# pre-commit hook, under its own banner: the fault is in the environment and no test failed.
#
# usage: run-glue-tests.sh [--fast] [--root DIR] [--log-dir DIR] [--gap-store SRC] [--list]
#   --fast      run only the declared FAST subset (the bounded-time tests)
#   --root DIR  tree to test (default: the tree this script sits in). The pre-commit hook
#               passes a checkout-index export of the index here.
#   --log-dir   where per-test output lands (default: a fresh mktemp dir, kept)
#   --gap-store the gap store that can exempt a tracked red: a development-vessel base URL
#               (read through the substrateGap resolver), a JSON file, or `client-config`:
#               the address the emitted client config names (below). Absent = no exemption.
#   --list      print the tests that would run, and exit
# env: GLUE_TESTS_BUN  path to a bun binary (default: bun on PATH)
#      GTR_MAX_TIME    seconds to wait for a --gap-store URL (default 10)
#
# --gap-store client-config. The store address is never a pinned default. It is, in order:
#   DEV_VESSEL_ENDPOINT, when set (an explicit operator override, named in the output);
#   else `.substrate.gapStoreEndpoint` of the client config substrate-connect emits, found by the
#   cockpit's own rule: METABOB_CONFIG_PATH when set, else ./.metabob/config.json, else
#   ~/.metabob/config.json.
# No config file, or one without that field (a config emitted before substrate-connect wrote it),
# is FAIL CLOSED: no exemption, and the output says which file was read and what it lacked.
# exit: 0 no failure (a TRACKED-RED test is not a failure) · 1 a test failed · 3 no test failed,
#       but a red test's tracking is UNKNOWN because the gap store refused the credential (401) · 64 usage
set -uo pipefail

# Tests excluded from --fast: each costs >10s (hold-channel runs the whole pull-sync,
# whose real STAGGER_SECONDS sleep its control leg hits). Everything else is fast.
SLOW=(pull-sync-hold-channel.test.sh)

# Submodule worktrees a test reads (space-separated, relative to --root). Absent -> SKIP.
declare -A NEEDS=(
  [argument-chain-check.test.ts]="repos/ias-executor-ts repos/activity-api"
  [verdict-token-copies.test.ts]="repos/activity-api repos/development-vessel"
  [write-containment-copies.test.ts]="repos/local-tools-vessel repos/development-vessel"
)

FAST=0; LIST=0; ROOT=""; LOG_DIR=""; GAP_STORE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --fast) FAST=1 ;;
    --list) LIST=1 ;;
    --root) ROOT="${2:-}"; shift ;;
    --root=*) ROOT="${1#--root=}" ;;
    --log-dir) LOG_DIR="${2:-}"; shift ;;
    --log-dir=*) LOG_DIR="${1#--log-dir=}" ;;
    --gap-store) GAP_STORE="${2:-}"; shift ;;
    --gap-store=*) GAP_STORE="${1#--gap-store=}" ;;
    -h|--help) sed -n '2,46p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "run-glue-tests: unknown argument: $1" >&2; exit 64 ;;
  esac
  shift
done
[ -n "$ROOT" ] || ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT="$(cd "$ROOT" 2>/dev/null && pwd)" || { echo "run-glue-tests: --root is not a directory" >&2; exit 64; }
DIR="$ROOT/validation/scripts"
[ -d "$DIR" ] || { echo "run-glue-tests: no validation/scripts under $ROOT" >&2; exit 64; }

BUN="${GLUE_TESTS_BUN:-$(command -v bun 2>/dev/null || true)}"
[ -n "$BUN" ] && [ ! -x "$BUN" ] && BUN=""

is_slow() { local s; for s in "${SLOW[@]}"; do [ "$1" = "$s" ] && return 0; done; return 1; }

shopt -s nullglob
TESTS=()
for f in "$DIR"/*.test.sh "$DIR"/*.test.ts; do
  b="$(basename "$f")"
  [ "$FAST" = 1 ] && is_slow "$b" && continue
  TESTS+=("$b")
done
shopt -u nullglob

if [ "$LIST" = 1 ]; then printf '%s\n' "${TESTS[@]}"; exit 0; fi
[ "${#TESTS[@]}" -gt 0 ] || { echo "run-glue-tests: no tests found under $DIR" >&2; exit 1; }

base_tmp="${TMPDIR:-/tmp}"
if [ -z "$LOG_DIR" ]; then LOG_DIR="$(mktemp -d "$base_tmp/glue-tests-logs.XXXXXX")"; fi
mkdir -p "$LOG_DIR" && LOG_DIR="$(cd "$LOG_DIR" && pwd)"

# THE TRACKED-RED PREDICATE, loaded once from the tree under test (the staged copy, in the hook).
# GTR_STATE: none (no --gap-store) | unreadable (fail closed) | environment (401) | loaded.
GTR_STATE=none; GTR_STORE="$LOG_DIR/.open-gaps.json"; GTR_NONE_WHY=""; GAP_STORE_FROM=""
client_config_store() { # -> prints the store address; or prints nothing and sets nothing (why on fd 3)
  local cfg ep
  if [ -n "${DEV_VESSEL_ENDPOINT:-}" ]; then printf '%s' "$DEV_VESSEL_ENDPOINT"; echo "DEV_VESSEL_ENDPOINT (explicit override)" >&3; return 0; fi
  if [ -n "${METABOB_CONFIG_PATH:-}" ]; then cfg="$METABOB_CONFIG_PATH"
  elif [ -f "$PWD/.metabob/config.json" ]; then cfg="$PWD/.metabob/config.json"
  else cfg="${HOME:-/nonexistent}/.metabob/config.json"; fi
  if [ ! -r "$cfg" ]; then
    echo "no client config: $cfg is absent or unreadable (METABOB_CONFIG_PATH ${METABOB_CONFIG_PATH:+set}${METABOB_CONFIG_PATH:-unset}; no ./.metabob/config.json) and DEV_VESSEL_ENDPOINT is unset — emit one with substrate-connect" >&3
    return 1
  fi
  ep="$(jq -r '.substrate.gapStoreEndpoint // empty' "$cfg" 2>/dev/null)"
  if [ -z "$ep" ]; then
    echo "client config $cfg names no .substrate.gapStoreEndpoint — re-emit it with substrate-connect" >&3
    return 1
  fi
  printf '%s' "$ep"; echo "client config $cfg" >&3
}
if [ "$GAP_STORE" = client-config ]; then
  GTR_SRC_NOTE="$(mktemp "${TMPDIR:-/tmp}/glue-gtr-src.XXXXXX")"
  GAP_STORE="$(client_config_store 3>"$GTR_SRC_NOTE")" || GAP_STORE=""
  GTR_SRC_WHY="$(cat "$GTR_SRC_NOTE" 2>/dev/null)"; rm -f "$GTR_SRC_NOTE"
  if [ -z "$GAP_STORE" ]; then GTR_STATE=unreadable; GTR_NONE_WHY="$GTR_SRC_WHY"; else GAP_STORE_FROM="$GTR_SRC_WHY"; fi
fi
if [ -n "$GAP_STORE" ]; then
  GTR_STATE=unreadable; GTR_NONE_WHY="gap store unreadable: $GAP_STORE${GAP_STORE_FROM:+ (from $GAP_STORE_FROM)}"
  GTR_MAX_TIME="${GTR_MAX_TIME:-10}"
  # shellcheck disable=SC1091
  if [ -r "$ROOT/scripts/substrate/lib/gap-tracked-red.sh" ] && . "$ROOT/scripts/substrate/lib/gap-tracked-red.sh" \
     && declare -F gtr_load gtr_tracked_names gtr_select >/dev/null; then
    gtr_load "$GAP_STORE" "$GTR_STORE"
    case $? in
      0) GTR_STATE=loaded ;;
      2) GTR_STATE=environment
         GTR_NONE_WHY="credential refused (401) — key stale? the gap store $GAP_STORE${GAP_STORE_FROM:+ (from $GAP_STORE_FROM)} refused the node key" ;;
    esac
  fi
fi
# tracked_red <file> <log> -> 0 when every "FAIL - <label>" case is tracked; GTR_WHY says why not, GTR_CASES what.
tracked_red() {
  local labels names lines untracked
  GTR_WHY=""; GTR_CASES=""
  case "$1" in *.test.sh) ;; *) GTR_WHY="bun tests are not exempted"; return 1 ;; esac
  case "$GTR_STATE" in
    none) GTR_WHY="no --gap-store"; return 1 ;;
    unreadable|environment) GTR_WHY="$GTR_NONE_WHY"; return 1 ;;
  esac
  labels="$(sed -n 's/^FAIL - //p' "$2" 2>/dev/null)"
  [ -n "$labels" ] || { GTR_WHY="no 'FAIL - <label>' line names the failure"; return 1; }
  names="$(gtr_tracked_names "$GTR_STORE" super-repo "validation/scripts/$1")"
  lines="$(printf '%s\n' "$labels" | sed 's/^/(fail) /')"
  untracked="$(gtr_select untracked "$names" "$lines")"
  if [ -n "$untracked" ]; then
    GTR_WHY="not tracked by an open gap: $(printf '%s\n' "$untracked" | sed "s/^(fail) /$1::/" | head -3 | tr '\n' ';')"
    return 1
  fi
  GTR_CASES="$(printf '%s\n' "$labels" | sed "s/^/$1::/" | tr '\n' ';')"
  return 0
}

now() { date +%s.%N; }
secs() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.1f", b - a }'; }

pass=0; fail=0; skip=0; tracked=0; unknown=0; FAILED=(); UNKNOWN=()
t_all="$(now)"
mode="full"; [ "$FAST" = 1 ] && mode="fast"
echo "glue tests ($mode) under $ROOT — logs: $LOG_DIR"
case "$GTR_STATE" in
  loaded) echo "tracked-red exemptions: open gaps from $GAP_STORE${GAP_STORE_FROM:+ (from $GAP_STORE_FROM)}" ;;
  unreadable) echo "tracked-red exemptions: NONE — $GTR_NONE_WHY; every red test fails" ;;
  environment) echo "tracked-red exemptions: UNKNOWN — $GTR_NONE_WHY; a red glue test is reported UNKNOWN (environment), not FAIL" ;;
esac
for b in "${TESTS[@]}"; do
  log="$LOG_DIR/$b.log"
  reason=""
  case "$b" in
    *.test.ts)
      if [ -z "$BUN" ]; then reason="bun not found (set GLUE_TESTS_BUN)"
      else
        for need in ${NEEDS[$b]:-}; do
          # A submodule worktree is checked out when it holds anything at all.
          if [ -z "$(ls -A "$ROOT/$need" 2>/dev/null)" ]; then reason="needs $need checkout"; break; fi
        done
      fi
      ;;
  esac
  if [ -n "$reason" ]; then
    printf 'SKIP  %5s  %s  (%s)\n' "-" "$b" "$reason"
    echo "SKIPPED: $reason" > "$log"
    skip=$((skip + 1)); continue
  fi
  tdir="$(mktemp -d "$base_tmp/glue-test.XXXXXX")"
  t0="$(now)"
  tpath="$PATH"
  case "$b" in
    *.test.sh) cmd=(bash "$DIR/$b") ;;
    # A bun test may spawn `bun` by name (the seeder test does): put GLUE_TESTS_BUN's
    # directory first on that test's PATH only, never on the caller's.
    *.test.ts) cmd=("$BUN" test "$DIR/$b"); tpath="$(dirname "$BUN"):$PATH" ;;
  esac
  # Git identity is supplied, not inherited: a fresh runner (CI, a clean HOME) has no
  # global config, and the tests commit into their own temp repos.
  ( cd "$ROOT" && env -i PATH="$tpath" HOME="${HOME:-$tdir}" TMPDIR="$tdir" LANG="${LANG:-C.UTF-8}" \
      GIT_AUTHOR_NAME="glue-tests" GIT_AUTHOR_EMAIL="glue-tests@localhost" \
      GIT_COMMITTER_NAME="glue-tests" GIT_COMMITTER_EMAIL="glue-tests@localhost" \
      "${cmd[@]}" ) >"$log" 2>&1 </dev/null
  rc=$?
  t1="$(now)"
  rm -rf "$tdir"
  if [ "$rc" -eq 0 ]; then
    note=""
    if [ "$GTR_STATE" = loaded ] && [ -n "$(gtr_tracked_names "$GTR_STORE" super-repo "validation/scripts/$b")" ]; then
      note="  (tracked by an open gap and now green: that gap can close)"
    fi
    printf 'PASS  %5ss  %s%s\n' "$(secs "$t0" "$t1")" "$b" "$note"; pass=$((pass + 1))
  elif [ "$GTR_STATE" = environment ] && [[ "$b" == *.test.sh ]]; then
    printf 'UNKNOWN  %5ss  %s  (exit %s, log %s; tracking unknown: %s)\n' "$(secs "$t0" "$t1")" "$b" "$rc" "$log" "$GTR_NONE_WHY"
    unknown=$((unknown + 1)); UNKNOWN+=("$b")
  elif tracked_red "$b" "$log"; then
    printf 'TRACKED-RED  %5ss  %s  (exit %s; every failing case is tracked by an open gap: %s log %s)\n' "$(secs "$t0" "$t1")" "$b" "$rc" "$GTR_CASES" "$log"
    tracked=$((tracked + 1))
  else
    printf 'FAIL  %5ss  %s  (exit %s, log %s; not exempt: %s)\n' "$(secs "$t0" "$t1")" "$b" "$rc" "$log" "$GTR_WHY"
    fail=$((fail + 1)); FAILED+=("$b")
  fi
done
echo "glue tests: $pass passed, $fail failed, $tracked tracked-red, $skip skipped in $(secs "$t_all" "$(now)")s ($mode)${unknown:+$([ "$unknown" -gt 0 ] && echo "; $unknown unknown (environment: credential refused)")}"
if [ "$fail" -gt 0 ]; then
  echo "failed: ${FAILED[*]}"
  [ "$unknown" -gt 0 ] && echo "unknown: ${UNKNOWN[*]}"
  exit 1
fi
if [ "$unknown" -gt 0 ]; then
  echo "unknown: ${UNKNOWN[*]} — $GTR_NONE_WHY (an environment fault; no test failed)"
  exit 3
fi
exit 0
