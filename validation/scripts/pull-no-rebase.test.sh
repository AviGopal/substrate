#!/usr/bin/env bash
# pull-no-rebase.test.sh: every fast-forward-only `git pull` in scripts/substrate must carry --no-rebase, and the glue layer's
# super-repo pull must converge a clone whose git config says pull.rebase=true while an UNRELATED tracked file is dirty.
# Why: with pull.rebase=true, `git pull --ff-only` becomes a rebase, and a rebase refuses any dirty tracked file ("cannot pull
# with rebase: You have unstaged changes") even when the incoming range never touches it. 2026-10-10 the hub's glue layer
# stopped converging that way on a runtime lease file, while node1 (no such config) pulled past the same kind of file.
#   static:     no `pull … --ff-only` without --no-rebase in scripts/substrate/*.sh
#   control:    on the fixture, the pull WITHOUT --no-rebase fails (the fixture reproduces the hazard)
#   behaviour:  the real super-repo pull line from substrate-pull-sync.sh, run on the fixture, fast-forwards and keeps the
#               dirty file's content
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$HERE/../.."
PS="$ROOT/scripts/substrate/substrate-pull-sync.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/pull-no-rebase.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
off=$(grep -nE 'git( -C [^ ]+)? pull\b[^#]*--ff-only' "$ROOT"/scripts/substrate/*.sh | grep -v -- '--no-rebase' || true)
[ -z "$off" ] && ok "static: every ff-only pull in scripts/substrate carries --no-rebase" || bad "ff-only pull without --no-rebase: $off"
G() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=dev "$@"; }
fixture() { rm -rf "$T/o" "$T/c"; G init -q "$T/o" && echo x > "$T/o/lease" && echo y > "$T/o/other" && G -C "$T/o" add . && G -C "$T/o" commit -qm a \
  && G clone -q "$T/o" "$T/c" && echo z > "$T/o/other" && G -C "$T/o" commit -qam b \
  && G -C "$T/c" config pull.rebase true && echo dirty > "$T/c/lease"; }
fixture; G -C "$T/c" pull -q --ff-only origin dev >/dev/null 2>&1 && bad "control: the fixture did not reproduce the rebase refusal" || ok "control: plain --ff-only refuses under pull.rebase=true with an unrelated dirty file"
line=$(grep -m1 -E '^\s*_sp_err="\$\(git -C "\$SUPER_DIR" pull ' "$PS" || true)
[ -n "$line" ] || { bad "could not find the super-repo pull line in substrate-pull-sync.sh"; echo "$FAILS FAILED"; exit 1; }
fixture; want=$(G -C "$T/o" rev-parse HEAD)
( SUPER_DIR="$T/c"; BRANCH=dev; eval "$line"; exit 0 ) </dev/null
[ "$(G -C "$T/c" rev-parse HEAD)" = "$want" ] && ok "behaviour: the real super-repo pull line fast-forwards the fixture" || bad "the super-repo pull line did not fast-forward under pull.rebase=true"
[ "$(cat "$T/c/lease")" = dirty ] && ok "behaviour: the unrelated dirty file is kept" || bad "the dirty file was changed"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
