#!/usr/bin/env bash
# vessel-pre-commit-scans-modify-only.test.sh: the vessel pre-commit hook must run its secrets scan on EVERY commit,
# including one that only modifies tracked files. Its placement checks judge added or renamed paths only, and an early
# exit on "nothing added" once skipped gitleaks too, so a modify-only commit that introduced a secret passed unscanned.
# The real hook runs in a scratch vessel repo. Two gitleaks are used: a stub first on PATH that records its call and
# refuses (hermetic: the scan is reached), and the real gitleaks when installed, against a fake token built at run time
# so this file carries no secret pattern. Controls: a clean modify-only commit passes; placement still ignores modifications.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$HERE/../.."; HOOK="$ROOT/scripts/git-hooks/vessel-pre-commit"
T="$(mktemp -d "${TMPDIR:-/tmp}/vpcm.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
G() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=dev "$@"; }
G init -q "$T/r"; mkdir -p "$T/r/src" "$T/stub"
echo 'export const a = 1;' > "$T/r/src/a.ts"; echo 'x' > "$T/r/stray.ts"
G -C "$T/r" add src/a.ts stray.ts; G -C "$T/r" commit -qm base
printf '#!/usr/bin/env bash\necho called >> "%s/stub.calls"\nexit 1\n' "$T" > "$T/stub/gitleaks"; chmod +x "$T/stub/gitleaks"
run() { (cd "$T/r" && PATH="$1" bash "$HOOK") >"$T/out" 2>&1 </dev/null; }
SPATH="$T/stub:$PATH"

# stub: a modify-only commit reaches the scan, and the scan's refusal refuses the commit
echo 'export const a = 2;' > "$T/r/src/a.ts"; G -C "$T/r" add src/a.ts
rm -f "$T/stub.calls"; run "$SPATH"; rc=$?
[ -s "$T/stub.calls" ] && ok "a modify-only commit runs the secrets scan" || bad "a modify-only commit skipped the secrets scan"
[ "$rc" != 0 ] && ok "a modify-only commit is refused when the scan refuses" || bad "a modify-only commit passed although the scan refused"

# control: modifying a root file the placement checks would flag if added is still not a placement violation
echo 'y' > "$T/r/stray.ts"; G -C "$T/r" add stray.ts
run "$PATH"; /usr/bin/grep -q 'placement check failed' "$T/out" && bad "placement judged a modification" || ok "placement still ignores a modification"
G -C "$T/r" reset -q

if command -v gitleaks >/dev/null 2>&1; then
  # must-fail: a modify-only commit introducing a fake token is refused by the real scan
  tok="ghp_"'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'
  printf 'export const a = 3;\nexport const t = "%s";\n' "$tok" > "$T/r/src/a.ts"; G -C "$T/r" add src/a.ts
  run "$PATH" && bad "a modify-only commit introducing a token was NOT refused" || { /usr/bin/grep -q 'secrets detected' "$T/out" && ok "refuses a modify-only commit introducing a token" || bad "refused, but not by the secrets scan: $(head -3 "$T/out")"; }
  # control: a clean modify-only commit passes
  printf 'export const a = 4;\n' > "$T/r/src/a.ts"; G -C "$T/r" add src/a.ts
  run "$PATH" && ok "passes a clean modify-only commit" || bad "refused a clean modify-only commit: $(head -3 "$T/out")"
else
  echo "note - gitleaks is not installed: the real-scan cases did not run (the stub cases above still judge the hook)"
fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
