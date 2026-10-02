#!/bin/sh
# gate-runner — the pinned judge's irreducible core (operator-built, bootstrap tier).
#
# The code that APPLIES a change is always the already-accepted version, never the change
# itself. This runner executes only /workspace/.gate/accepted/ (a `git archive` of the
# accepted sha, hash-checked against its MANIFEST), never the clone, a candidate or
# /usr/local/bin. A new pull-sync is a candidate: the accepted body shadow-evaluates it and
# may write promote.request; only then does this runner stage and swap it in.
#
#   gate-runner tick                                   (substrate-pull-sync.service)
#   gate-runner rollback-gate --to <sha>|--previous|--image   (operator break-glass, manual
#     only: the image is built unjudged from every dev push, so it is never used automatically)
#   gate-runner rebootstrap --confirm   (operator: re-stage from HEAD over PARTIAL state, recorded)
#
# State ($GATE_DIR, root 0700, InaccessiblePaths in lane units): accepted.sha, accepted/,
# history/<sha>/ (+history.order, newest last), ledger.jsonl (L12 records), notices.jsonl (what
# humans read without the lane), bootstrapped (marker), promote.request, body-fails.
# BOOTSTRAPPED is decided by ANY of accepted.sha, accepted/, history/, ledger.jsonl or the marker;
# a missing accepted.sha with any of the others is PARTIAL state: refuse, never re-bootstrap
# (absence is not a state). Gate globs: gate-policy.json gate_paths, minus "!"-prefixed
# non_root_paths. Exit: body's rc · 3 refused · 64 usage.
set -u; set -f
G="${GATE_DIR:-/workspace/.gate}"
SUPER="${GATE_SUPER_DIR:-${SUPER_REPO_DIR:-/workspace/git/super-repo}}"
IMAGE="${GATE_IMAGE_DIR:-/usr/local/share/substrate/super-repo}"
IMAGE_REV="${GATE_IMAGE_REVISION_FILE:-/etc/substrate/image-revision}"
BRANCH="${BRANCH:-dev}"
POLICY=scripts/substrate/gate/gate-policy.json
BODY=scripts/substrate/substrate-pull-sync.sh
NODE="$(hostname 2>/dev/null || echo unknown)"

log() { echo "[gate $(date -u +%FT%TZ)] $*"; }
gap() { log "GAP $1 — $2"; }   # a journal line; the body cannot be trusted to file it when it is the fault
record() { # kind sha from_sha by evidence -> one L12 line
  jq -nc --arg at "$(date -u +%FT%TZ)" --arg k "$1" --arg s "$2" --arg f "$3" --arg b "$4" --arg e "$5" \
    --arg n "$NODE" '{at:$at,kind:$k,sha:$s,from_sha:$f,by:$b,node:$n,evidence:$e}' >> "$G/ledger.jsonl"
}
setsha() { printf '%s\n' "$1" > "$G/accepted.sha.tmp" && mv -f "$G/accepted.sha.tmp" "$G/accepted.sha"; }
notice() { # kind sha text -> one line in the gate's own store (humans read it without the lane)
  jq -nc --arg at "$(date -u +%FT%TZ)" --arg k "$1" --arg s "$2" --arg t "$3" --arg n "$NODE" \
    '{at:$at,kind:$k,sha:$s,node:$n,text:$t}' >> "$G/notices.jsonl"
}
globs_of() { jq -r '(.gate_paths // [])[], ((.non_root_paths // [])[] | "!" + .)' 2>/dev/null; }   # policy on stdin
selected() { # relpath globs... -> 0 when a gate glob matches and no "!" exclusion does ('*' crosses '/')
  _p="$1"; shift; _hit=1
  for _g in "$@"; do case "$_g" in '!'*) case "$_p" in ${_g#!}) return 1 ;; esac ;; *) case "$_p" in $_g) _hit=0 ;; esac ;; esac; done
  return $_hit
}
hashes() { # dir -> "sha256  relpath" per file but MANIFEST.json; a symlink hashes its link text
  (cd "$1" && { find . -type f ! -name MANIFEST.json -print0 | xargs -0 -r sha256sum
    find . -type l | while IFS= read -r _l; do
      printf '%s  %s\n' "$(printf 'link:%s' "$(readlink "$_l")" | sha256sum | cut -d' ' -f1)" "$_l"; done; } | sed 's#  \./#  #')
}
state_present() { for _f in accepted.sha accepted history ledger.jsonl bootstrapped; do [ -e "$G/$_f" ] && printf '%s ' "$_f"; done; }

manifest() { # dir id globs... -> writes dir/MANIFEST.json over every non-directory file in dir
  _d="$1"; _id="$2"; shift 2
  hashes "$_d" | jq -R -s --arg sha "$_id" --arg at "$(date -u +%FT%TZ)" --args \
      '{sha:$sha, staged_at:$at, gate_paths:$ARGS.positional,
        files:(split("\n")|map(select(length>0)|{(.[66:]):.[0:64]})|add // {})}' "$@" > "$_d/MANIFEST.json"
}
verify() { # dir -> 0 when the file set and every sha256 match MANIFEST.json exactly
  [ -f "$1/MANIFEST.json" ] || return 1
  _want="$(jq -r '.files|to_entries[]|"\(.value)  \(.key)"' "$1/MANIFEST.json" 2>/dev/null | LC_ALL=C sort)" || return 1
  [ -n "$_want" ] || return 1
  _have="$(hashes "$1" | LC_ALL=C sort)"
  [ "$_want" = "$_have" ] && [ -f "$1/$BODY" ]
}
stage_sha() { # sha dest globs... -> git archive of the selected committed blobs (never the working tree)
  _s="$1"; _dst="$2"; shift 2
  rm -rf "$_dst" && mkdir -p "$_dst" || return 1
  _sel="$(git -C "$SUPER" ls-tree -r "$_s" 2>/dev/null | while IFS="$(printf '\t')" read -r _meta _p; do
     case "$_meta" in 160000*) continue ;; esac   # gitlinks: never staged
     selected "$_p" "$@" && printf '%s\n' "$_p"; done)"
  [ -n "$_sel" ] || return 1
  # shellcheck disable=SC2086  # literal paths, one per word; globbing is off (set -f)
  GIT_LITERAL_PATHSPECS=1 git -C "$SUPER" archive "$_s" -- $_sel | tar -x -C "$_dst" || return 1
  manifest "$_dst" "$_s" "$@" && verify "$_dst"
}
history_push() { # sha: accepted/ -> history/<sha>, keep the newest history_keep
  [ -n "$1" ] && [ -d "$G/accepted" ] || return 0
  mkdir -p "$G/history"; rm -rf "$G/history/$1"; mv "$G/accepted" "$G/history/$1"
  { grep -vx "$1" "$G/history.order" 2>/dev/null; echo "$1"; } > "$G/history.order.tmp"
  _keep="$(jq -r '.history_keep // 5' "$G/accepted.new/$POLICY" 2>/dev/null)"; case "$_keep" in ''|*[!0-9]*) _keep=5 ;; esac
  while [ "$(wc -l < "$G/history.order.tmp")" -gt "$_keep" ]; do
    rm -rf "$G/history/$(head -n1 "$G/history.order.tmp")"; sed -i 1d "$G/history.order.tmp"; done
  mv -f "$G/history.order.tmp" "$G/history.order"
}
install_new() { # sha kind by evidence: accepted.new -> accepted (the old one to history), + L12
  _from="$(cat "$G/accepted.sha" 2>/dev/null)"
  if verify "$G/accepted" 2>/dev/null; then history_push "$_from"; else rm -rf "$G/accepted"; fi
  mv "$G/accepted.new" "$G/accepted" && setsha "$1" && record "$2" "$1" "$_from" "$3" "$4"
}
fallback() { # why -> restore the newest valid history version, + integrity_fallback record
  _cur="$(cat "$G/accepted.sha" 2>/dev/null)"
  for _h in $(tac "$G/history.order" 2>/dev/null); do
    verify "$G/history/$_h" || continue
    rm -rf "$G/rejected"; mkdir -p "$G/rejected"; [ -d "$G/accepted" ] && mv "$G/accepted" "$G/rejected/${_cur:-unknown}"
    mv "$G/history/$_h" "$G/accepted"; grep -vx "$_h" "$G/history.order" > "$G/history.order.tmp"; mv -f "$G/history.order.tmp" "$G/history.order"
    setsha "$_h"; rm -f "$G/body-fails"; record integrity_fallback "$_h" "$_cur" gate-runner "$1"
    log "!!! $1 — restored history/$_h as accepted (was ${_cur:-none})"; return 0
  done
  return 1
}
bootstrap() { # L12 bootstrap: the super-repo's committed HEAD becomes the first accepted version
  _ref=HEAD
  [ -n "$(git -C "$SUPER" rev-list "origin/$BRANCH..HEAD" 2>/dev/null | head -n1)" ] && _ref="origin/$BRANCH"
  _s="$(git -C "$SUPER" rev-parse -q --verify "$_ref^{commit}" 2>/dev/null)" || return 1
  # TODO(a-fresh-node-trusts-an-unjudged-dev-head-image-as-its-first-accepted-version): a fresh
  # node (new install, wiped volume) bootstraps from whatever HEAD its clone/image carries, built
  # unjudged from dev. Next slice: refuse/hold here unless $_s is a fleet-ACCEPTED sha (published
  # by a gate-runner as a record/tag), and file a gap instead of bootstrapping.
  _why="${1:-}"; set -- $(git -C "$SUPER" show "$_s:$POLICY" 2>/dev/null | globs_of)
  [ $# -gt 0 ] || { log "bootstrap: $_ref (${_s}) has no $POLICY"; return 1; }
  stage_sha "$_s" "$G/accepted.new" "$@" || return 1
  set -- "$_why"; install_new "$_s" bootstrap bootstrap "${1:-first gated tick on $NODE}: staged $_ref by git archive; the commit that installed this runner was the last one judged by the run-on-arrival path" \
    && printf '%s %s\n' "$_s" "$(date -u +%FT%TZ)" > "$G/bootstrapped"
  log "bootstrap: accepted.sha=$_s"
}
promote() { # a promote.request written by the accepted body -> stage that sha, swap, + L12
  _req="$(jq -r '.sha // empty' "$G/promote.request" 2>/dev/null)"; _ev="$(jq -c . "$G/promote.request" 2>/dev/null)"
  rm -f "$G/promote.request"
  case "$_req" in *[!0-9a-f]*|'') log "promote: malformed request — ignored"; return 0 ;; esac
  [ "$_req" = "$(cat "$G/accepted.sha" 2>/dev/null)" ] && return 0
  git -C "$SUPER" cat-file -e "$_req^{commit}" 2>/dev/null || { log "promote: $_req is not in the mirror — ignored"; return 0; }
  # accepted gate globs ∪ the candidate's; exclusions are the candidate's only (candidate.sh
  # refuses a candidate that ADDS one, so they never exceed the accepted set)
  set -- $(jq -r '.gate_paths[]? | select(startswith("!")|not)' "$G/accepted/MANIFEST.json") $(git -C "$SUPER" show "$_req:$POLICY" 2>/dev/null | globs_of)
  stage_sha "$_req" "$G/accepted.new" "$@" || { log "promote: could not stage $_req — accepted unchanged"; rm -rf "$G/accepted.new"; return 0; }
  install_new "$_req" promote accepted-gate "$_ev"; log "promote: accepted.sha=$_req"
}
lock() { mkdir -p "$G" && chmod 700 "$G" && exec 9>"$G/.lock" && flock -w 60 9 || { log "lock busy — no-op"; exit 0; }; }

tick() {
  lock
  if [ ! -f "$G/accepted.sha" ]; then
    _st="$(state_present)"
    if [ -n "$_st" ]; then
      gap gate-state-partial "accepted.sha is missing but gate state exists ($_st); NO body runs and nothing re-bootstraps. Operator: gate-runner rollback-gate --to <sha> or rebootstrap --confirm"
      notice gate_state_partial "" "accepted.sha missing with gate state present ($_st): refusing every tick until an operator restores it"; exit 3
    fi
    bootstrap || { gap gate-bootstrap-failed "could not stage $SUPER's committed HEAD; nothing runs this tick"; exit 3; }
  fi
  if ! verify "$G/accepted"; then
    fallback "accepted/ failed its MANIFEST" || {
      gap gate-no-valid-accepted-version "accepted/ and every history/ version fail integrity; NO gate body runs. Break-glass: gate-runner rollback-gate --image"; exit 3; }
  fi
  [ -f "$G/promote.request" ] && promote
  _sha="$(cat "$G/accepted.sha")"
  env PULLSYNC_ACCEPTED_DIR="$G/accepted" PULLSYNC_GATE_DIR="$G" bash "$G/accepted/$BODY" "$@" 9>&-
  _rc=$?
  if [ "$_rc" -ge 2 ]; then
    _n=$(( $(awk -v s="$_sha" '$1==s{print $2}' "$G/body-fails" 2>/dev/null || true) + 0 + 1 )); echo "$_sha $_n" > "$G/body-fails"
    _lim="$(jq -r '.body_fail_limit // 3' "$G/accepted/$POLICY" 2>/dev/null)"
    if [ "$_n" -ge "${_lim:-3}" ]; then
      fallback "accepted body exited $_rc on $_n consecutive ticks" \
        || gap gate-body-failing-no-fallback "accepted ${_sha} exited $_rc on $_n ticks and no valid history exists; break-glass: rollback-gate"
    fi
  else rm -f "$G/body-fails"; fi
  exit "$_rc"
}

rollback() { # --to <sha> | --previous | --image  (manual operator recovery; never automatic)
  lock; _mode="${1:-}"; _arg="${2:-}"; _how="rollback-gate $*"
  [ "$_mode" = --previous ] && { _arg="$(tail -n1 "$G/history.order" 2>/dev/null)"; _mode=--to; [ -n "$_arg" ] || { log "no history"; exit 3; }; }
  case "$_mode" in
    --to) [ -n "$_arg" ] || { log "rollback-gate --to <sha>"; exit 64; }
      if verify "$G/history/$_arg"; then rm -rf "$G/accepted.new"; cp -a "$G/history/$_arg" "$G/accepted.new"
      else set -- $(git -C "$SUPER" show "$_arg:$POLICY" 2>/dev/null | globs_of)
        _arg="$(git -C "$SUPER" rev-parse -q --verify "$_arg^{commit}" 2>/dev/null)" && [ $# -gt 0 ] \
          && stage_sha "$_arg" "$G/accepted.new" "$@" || { log "rollback: no valid history or commit for that sha"; exit 3; }
      fi ;;
    --image) _rev="$(cat "$IMAGE_REV" 2>/dev/null)"
      git -C "$SUPER" cat-file -e "${_rev:-x}^{commit}" 2>/dev/null && _arg="$_rev" || _arg="image:${_rev:-unknown}"
      set -- $(globs_of < "$IMAGE/$POLICY"); [ $# -gt 0 ] || { log "rollback: the image has no $POLICY"; exit 3; }
      rm -rf "$G/accepted.new"; mkdir -p "$G/accepted.new"
      (cd "$IMAGE" && find . ! -type d | sed 's#^\./##') | while IFS= read -r _p; do
        selected "$_p" "$@" && mkdir -p "$G/accepted.new/$(dirname "$_p")" && cp -P -p "$IMAGE/$_p" "$G/accepted.new/$_p"; done
      manifest "$G/accepted.new" "$_arg" "$@"; verify "$G/accepted.new" || { log "rollback: the image copy has no gate body"; exit 3; }
      notice gate_from_image "$_arg" "accepted gate restored from the image (no fixture corpus): every gate change is REFUSED until gate-runner rollback-gate --to <a known-good sha>" ;;
    *) log "usage: gate-runner rollback-gate --to <sha>|--previous|--image"; exit 64 ;;
  esac
  rm -f "$G/body-fails"; [ -f "$G/accepted/MANIFEST.json" ] || rm -rf "$G/accepted"
  install_new "$_arg" rollback "operator:$(id -un 2>/dev/null || echo root)" "$_how"
  log "rollback: accepted.sha=$_arg"
}

rebootstrap() { # --confirm: the ONLY way back to a bootstrap over existing state (recorded)
  [ "${1:-}" = --confirm ] || { log "usage: gate-runner rebootstrap --confirm"; exit 64; }
  lock; _was="$(cat "$G/accepted.sha" 2>/dev/null)"
  record rebootstrap "" "$_was" "operator:$(id -un 2>/dev/null || echo root)" "rebootstrap --confirm over state: $(state_present)"
  rm -rf "$G/rejected"; mkdir -p "$G/rejected"; [ -d "$G/accepted" ] && mv "$G/accepted" "$G/rejected/${_was:-partial}"
  rm -f "$G/accepted.sha"
  bootstrap "operator rebootstrap on $NODE" || { gap gate-bootstrap-failed "rebootstrap could not stage $SUPER's committed HEAD"; exit 3; }
}

case "${1:-}" in
  tick) shift; tick "$@" ;;
  rollback-gate) shift; rollback "$@" ;;
  rebootstrap) shift; rebootstrap "$@" ;;
  *) echo "usage: gate-runner tick | rollback-gate --to <sha>|--previous|--image | rebootstrap --confirm" >&2; exit 64 ;;
esac
