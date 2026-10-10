#!/usr/bin/env bash
# pre-commit-refuses-ignored-additions.test.sh: the pre-commit block "ignored paths stay untracked" must refuse a staged
# ADDITION whose path .gitignore ignores (the edc68d49 class: runtime files force-added by an autonomous commit), pass a normal
# addition, and not refuse a MODIFICATION of an already-tracked ignored file. The block is extracted from the real hook
# (between its own marker and the next section) and run in a scratch repo carrying the real .gitignore, so the hook's other
# checks (placement, glue tests) do not decide the result. validation/results/*.json is an ignored path inside an allowed dir.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$HERE/../.."; HOOK="$ROOT/scripts/git-hooks/pre-commit"
T="$(mktemp -d "${TMPDIR:-/tmp}/pcig.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
awk '/^# ─── ignored paths stay untracked ───/{on=1} /^# ─── SOPS encryption check ───/{on=0} on' "$HOOK" > "$T/block.sh"
/usr/bin/grep -q 'check-ignore' "$T/block.sh" && /usr/bin/grep -q 'exit 1' "$T/block.sh" || { echo "FAIL - could not extract the block from the hook"; exit 1; }
G() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=dev "$@"; }
G init -q "$T/r"; cp "$ROOT/.gitignore" "$T/r/.gitignore"; mkdir -p "$T/r/validation/scripts" "$T/r/validation/results"
echo ok > "$T/r/validation/scripts/base.sh"; G -C "$T/r" add .gitignore validation/scripts/base.sh; G -C "$T/r" commit -qm base
G -C "$T/r" check-ignore -q --no-index validation/results/x.json || { echo "FAIL - fixture premise: validation/results/x.json is not ignored by .gitignore"; exit 1; }
run() { (cd "$T/r" && RED= NC= DIM= YELLOW= bash "$T/block.sh") >"$T/out" 2>&1 </dev/null; }
echo '{}' > "$T/r/validation/results/x.json"; G -C "$T/r" add -f validation/results/x.json
run && bad "a forced addition of an ignored path was NOT refused" || { /usr/bin/grep -q "validation/results/x.json" "$T/out" && ok "refuses a forced addition of an ignored path, naming it" || bad "refused without naming the path"; }
G -C "$T/r" restore --staged validation/results/x.json
echo x > "$T/r/validation/scripts/new.sh"; G -C "$T/r" add validation/scripts/new.sh
run && ok "passes a normal addition" || bad "refused a normal addition: $(head -3 "$T/out")"
G -C "$T/r" commit -qm add; G -C "$T/r" add -f validation/results/x.json; G -C "$T/r" commit -qm forced
echo '{"a":1}' > "$T/r/validation/results/x.json"; G -C "$T/r" add -f validation/results/x.json
run && ok "does not refuse a modification of an already-tracked ignored file" || bad "refused a modification of a tracked ignored file"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
