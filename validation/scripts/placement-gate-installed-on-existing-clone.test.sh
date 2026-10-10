#!/usr/bin/env bash
# placement-gate-installed-on-existing-clone.test.sh: with the container-wide ledger hooks path (core.hooksPath =
# scripts/substrate/git-hooks-ledger, whose pre-commit only chains to .git/hooks/pre-commit and returns 0 when that is absent),
# a super-repo clone that was NOT created this boot must still get setup-git-push's placement-gate wrapper, so a commit adding
# a top-level path outside ALLOWED_TOPLEVEL_DIRS is refused. Measured 2026-10-10 on node1: the clone predated the
# "install only into a clone created this boot" rule, .git/hooks/pre-commit never existed, and every system commit skipped
# the gate (edc68d49 force-added runtime leases/ that way).
#   control:  ledger hooksPath + no .git/hooks/pre-commit => the out-of-place commit LANDS (the hole)
#   fix:      the installer block from setup-git-push, run with SUPER_CLONED_THIS_BOOT=0 => wrapper written, same commit REFUSED
#             by the placement check; an existing foreign hook (no marker) is left alone
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
SG="$ROOT/scripts/substrate/setup-git-push.sh"; LEDGER="$ROOT/scripts/substrate/git-hooks-ledger"
T="$(mktemp -d "${TMPDIR:-/tmp}/pgi.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
blk=$(awk '/^PLACEMENT_HOOK_MARKER=/{on=1} /^echo "\[setup-git-push\] done"/{on=0} on' "$SG")
case "$blk" in *'cat > "$_ph"'*) ;; *) echo "FAIL - could not extract the installer block from setup-git-push.sh"; exit 1;; esac
G() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=dev "$@"; }
mk() { rm -rf "$T/s"; G init -q "$T/s"; mkdir -p "$T/s/scripts/git-hooks"; cp "$ROOT/scripts/git-hooks/pre-commit" "$T/s/scripts/git-hooks/pre-commit"
  cp "$ROOT/.gitignore" "$T/s/.gitignore"; G -C "$T/s" add -A; G -C "$T/s" commit -qm base --no-verify
  G -C "$T/s" config core.hooksPath "$LEDGER"; mkdir -p "$T/s/zzz-not-allowed"; echo '{}' > "$T/s/zzz-not-allowed/x.json"; G -C "$T/s" add zzz-not-allowed/x.json; }
export DEV_VESSEL_ENDPOINT=http://127.0.0.1:9 SUBSTRATE_INSTALL_DIR="$T/install"; unset METABOB_API_KEY
mk; [ ! -e "$T/s/.git/hooks/pre-commit" ] || { echo "FAIL - fixture premise: a repo hook exists"; exit 1; }
G -C "$T/s" commit -qm hole >/dev/null 2>&1 && ok "control: ledger hooksPath + no repo hook => the out-of-place commit lands (the hole)" || bad "control: the commit was refused without the wrapper (fixture does not reproduce the hole)"
mk; ( SUPER_REPO_DIR="$T/s"; SUPER_CLONED_THIS_BOOT=0; eval "$blk" ) >"$T/inst.out" 2>&1 </dev/null
[ -x "$T/s/.git/hooks/pre-commit" ] && /usr/bin/grep -q substrate-placement-gate "$T/s/.git/hooks/pre-commit" && ok "fix: the wrapper is installed into a clone NOT created this boot" || bad "fix: no wrapper installed ($(head -2 "$T/inst.out"))"
G -C "$T/s" commit -qm should-refuse >"$T/c.out" 2>&1 && bad "fix: the out-of-place commit still LANDED" \
  || { /usr/bin/grep -q "placement check failed" "$T/c.out" && ok "fix: the commit is refused by the placement check" || bad "fix: refused, but not by placement: $(sed 's/\x1b\[[0-9;]*m//g' "$T/c.out" | /usr/bin/grep -m2 '━━━')"; }
mk; printf '#!/bin/sh\nexit 0\n' > "$T/s/.git/hooks/pre-commit"; chmod +x "$T/s/.git/hooks/pre-commit"
( SUPER_REPO_DIR="$T/s"; SUPER_CLONED_THIS_BOOT=0; eval "$blk" ) >/dev/null 2>&1 </dev/null
/usr/bin/grep -q substrate-placement-gate "$T/s/.git/hooks/pre-commit" && bad "a repo's own hook (no marker) was overwritten" || ok "a repo's own hook (no marker) is left alone"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
