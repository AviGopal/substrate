#!/usr/bin/env bash
# shadow-eval.sh — run the ACCEPTED fixture corpus against a candidate gate, sandboxed.
#
#   shadow-eval.sh --accepted <accepted-dir> --super <clone> --candidate <sha>
#
# The corpus is read from accepted/ (validation/scripts/gate/fixtures/*.sh), never from the
# candidate: a candidate may ADD fixtures, which join only once it is promoted (H2). Each
# fixture is a check that exits 0 when the candidate behaves as the accepted gate requires
# (`# kind: known-invalid` fixtures replay a refused change; `# kind: known-valid` ones a
# required acceptance). The candidate's committed scripts/substrate is staged by `git archive`
# into a scratch dir; fixtures get it as PULLSYNC_BIN / CANDIDATE_DIR, a throwaway
# WORKSPACE_ROOT and HOME, and a scrubbed environment. As root they run under
# `setpriv --reuid=nobody --no-new-privs`; otherwise as the calling uid (said, not silent).
#
# Exit 0 only when every fixture passes. An EMPTY corpus fails: nothing checked is not a pass
# (an image-restored gate carries no validation/ tree, so it can promote nothing).
set -uo pipefail
ACC=""; SUPER=""; CAND=""
while [ $# -gt 0 ]; do
  case "$1" in --accepted) ACC="$2"; shift ;; --super) SUPER="$2"; shift ;; --candidate) CAND="$2"; shift ;; esac; shift
done
[ -n "$ACC" ] && [ -n "$SUPER" ] && [ -n "$CAND" ] || { echo "usage: shadow-eval.sh --accepted D --super S --candidate SHA" >&2; exit 64; }
shopt -s nullglob
CORPUS=("$ACC"/validation/scripts/gate/fixtures/*.sh)
shopt -u nullglob
[ "${#CORPUS[@]}" -gt 0 ] || { echo "REFUSE - the accepted corpus is empty; an unchecked candidate is not a pass"; exit 2; }

S="$(mktemp -d "${TMPDIR:-/tmp}/gate-shadow.XXXXXX")"; trap 'rm -rf "$S"' EXIT
mkdir -p "$S/cand" "$S/home" "$S/tmp"
if ! git -C "$SUPER" archive "$CAND" -- scripts/substrate 2>/dev/null | tar -x -C "$S/cand" 2>/dev/null \
   || [ ! -f "$S/cand/scripts/substrate/substrate-pull-sync.sh" ]; then
  echo "REFUSE - could not stage the candidate's committed scripts/substrate at ${CAND:0:12}"; exit 2
fi
cp -r "$ACC/validation/scripts/gate/fixtures" "$S/fixtures"
DROP=()
if [ "$(id -u)" = 0 ]; then
  chown -R nobody "$S" 2>/dev/null
  DROP=(setpriv --reuid=nobody --regid=nogroup --clear-groups --no-new-privs)
else
  echo "note: not root — fixtures run as uid $(id -u), not nobody"
fi
fail=0
for f in "$S"/fixtures/*.sh; do
  b="$(basename "$f")"; w="$S/ws-$b"; mkdir -p "$w"; [ "${#DROP[@]}" -gt 0 ] && chown nobody "$w"
  out="$("${DROP[@]}" env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" HOME="$S/home" \
      TMPDIR="$S/tmp" LANG=C.UTF-8 WORKSPACE_ROOT="$w" PULLSYNC_BIN="$S/cand/scripts/substrate/substrate-pull-sync.sh" \
      CANDIDATE_DIR="$S/cand" GIT_AUTHOR_NAME=shadow GIT_AUTHOR_EMAIL=shadow@localhost \
      GIT_COMMITTER_NAME=shadow GIT_COMMITTER_EMAIL=shadow@localhost \
      timeout --kill-after=10 "${SHADOW_FIXTURE_TIMEOUT:-300}" bash "$f" 2>&1)"
  rc=$?
  if [ "$rc" = 0 ]; then echo "PASS - $b"; else echo "FAIL - $b (exit $rc): $(printf '%s' "$out" | grep -E 'FAIL' | head -3 | tr '\n' ' ')"; fail=$((fail+1)); fi
done
[ "$fail" = 0 ] && { echo "shadow: ${#CORPUS[@]} fixture(s) pass for ${CAND:0:12}"; exit 0; }
echo "shadow: $fail of ${#CORPUS[@]} fixture(s) failed for ${CAND:0:12}"; exit 1
