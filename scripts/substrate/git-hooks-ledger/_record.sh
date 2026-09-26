#!/bin/sh
# _record.sh — shared by the ledger git hooks (causal-attempt-ledger).
#
# WHY THIS EXISTS. Landings reach git through more routes than the gated cutover:
# shell resolvers offered to the walk's tool fallback, `bash` steps in goal-host's
# embedded executor, development-vessel git_commit, pull-sync self-heal. A record made
# only by cooperating routes measures only cooperating routes. Installed as the
# container-wide core.hooksPath, these hooks see every commit made in the container
# and spool one event per commit/rewrite/ref-update for the ledger to ingest.
#
# RULES. Record, never refuse: every path exits with the chained local hook's status
# (or 0). Never touch the network: an event is a file in the spool; the ledger drains
# it, so a down ledger delays delivery and never delays a commit. Chain to the
# repository's own hook of the same name, because setting core.hooksPath disables
# `.git/hooks` — silently dropping an existing gate would be a fail-open regression.

ledger_spool() {
  d="${ATTEMPT_LEDGER_DIR:-/workspace/attempt-ledger}/spool"
  mkdir -p "$d" 2>/dev/null
  echo "$d"
}

# ledger_emit <event-kind> <json-object-with-event-fields>
ledger_emit() {
  kind="$1"; fields="$2"
  top=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  # Transient checkouts (test fixtures, verify clones) live under /tmp and are thrown
  # away; they carry no landing. Recording them flooded the spool at ~900 events/hour.
  case "$top" in /tmp/*) return 0 ;; esac
  spool=$(ledger_spool) || return 0
  branch=$(git symbolic-ref --short -q HEAD 2>/dev/null || echo "")
  ts=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)
  f="$spool/$(date -u +%s%N 2>/dev/null || date -u +%s)-$$-$kind.json"
  # Who ran git: the hook's parent is git, git's parent is the committer. Its systemd unit
  # and command line attribute a commit that arrives without SUBSTRATE_EXECUTION_ID, so an
  # unlinked landing names the path that dropped the id instead of needing a hunt.
  # git usually runs under a shell under the resolver, so walk up until a .service cgroup.
  cpid=$(awk '{print $4}' "/proc/$PPID/stat" 2>/dev/null)
  ccmd=$(tr '\0' ' ' < "/proc/${cpid:-0}/cmdline" 2>/dev/null | cut -c1-160)
  cunit=""; cpids=""; p="$cpid"; n=0
  while [ -n "$p" ] && [ "$p" -gt 1 ] 2>/dev/null && [ $n -lt 8 ]; do
    cpids="${cpids:+$cpids,}$p"
    cunit=$(grep -o '[^/]*\.service' "/proc/$p/cgroup" 2>/dev/null | tail -1)
    [ -n "$cunit" ] && break
    p=$(awk '{print $4}' "/proc/$p/stat" 2>/dev/null); n=$((n+1))
  done
  jq -cn --arg kind "$kind" --arg repo "$top" --arg branch "$branch" --arg at "$ts" \
     --arg exec_id "${SUBSTRATE_EXECUTION_ID:-}" --argjson fields "$fields" \
     --arg cunit "${cunit:-}" --arg ccmd "${ccmd:-}" --arg cpids "${cpids:-}" \
     '{event:$kind, repo:$repo, branch:$branch, at:$at,
       execution_id:(if $exec_id=="" then null else $exec_id end),
       committer_unit:(if $cunit=="" then null else $cunit end),
       committer_cmd:(if $ccmd=="" then null else $ccmd end),
       committer_pids:(if $cpids=="" then null else $cpids end)} + $fields' \
     > "$f.tmp" 2>/dev/null && mv "$f.tmp" "$f" 2>/dev/null
  rm -f "$f.tmp" 2>/dev/null
  return 0
}

# ledger_commit_fields <sha> -> json with sha, author, subject, attempt_id trailer
ledger_commit_fields() {
  sha="$1"
  author=$(git log -1 --format='%an <%ae>' "$sha" 2>/dev/null)
  subject=$(git log -1 --format='%s' "$sha" 2>/dev/null)
  attempt=$(git log -1 --format='%(trailers:key=Attempt-Id,valueonly,separator=%x2C)' "$sha" 2>/dev/null | head -1 | tr -d ' \n')
  jq -cn --arg sha "$sha" --arg author "$author" --arg subject "$subject" --arg attempt "$attempt" \
     '{sha:$sha, author:$author, subject:$subject, attempt_id:(if $attempt=="" then null else $attempt end)}'
}

# ledger_chain <hook-name> [args...] — run the repository's own hook, stdin passed through.
ledger_chain() {
  name="$1"; shift
  gd=$(git rev-parse --git-common-dir 2>/dev/null) || return 0
  local_hook="$gd/hooks/$name"
  if [ -x "$local_hook" ]; then
    "$local_hook" "$@"
    return $?
  fi
  return 0
}
