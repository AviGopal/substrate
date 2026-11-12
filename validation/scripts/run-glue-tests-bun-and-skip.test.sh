#!/usr/bin/env bash
# run-glue-tests.sh gives every test, bash ones included, GLUE_TESTS_BUN's directory on its PATH (env -i drops
# GLUE_TESTS_BUN itself), and reports a test's own skip as SKIP, never PASS. Each case runs the runner from this tree
# against a --root under $T holding only fixture tests, with a PATH that has no bun of its own.
#   (a) MUST-FAIL: a bash test that needs `bun` by name passes when bun lives only in GLUE_TESTS_BUN's directory
#   (b) MUST-FAIL: a bash test that prints "SKIP - …" and exits 0 is reported SKIP and counted skipped, not PASS
#   (c) a bash test that skips one leg and passes another is still PASS (a guard)
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
R="$T/root"; mkdir -p "$R/validation/scripts" "$R/scripts/substrate/lib" "$T/bunbin"
cp "$SRC/validation/scripts/run-glue-tests.sh" "$R/validation/scripts/"
cp "$SRC/scripts/substrate/lib/gap-tracked-red.sh" "$R/scripts/substrate/lib/"
printf '#!/usr/bin/env bash\necho 1.0.0\n' > "$T/bunbin/bun"; chmod +x "$T/bunbin/bun"
printf '#!/usr/bin/env bash\ncommand -v bun >/dev/null || { echo "FAIL - cannot judge: no bun"; exit 1; }\necho "ok   - has bun"\n' > "$R/validation/scripts/needs-bun.test.sh"
printf '#!/usr/bin/env bash\necho "SKIP - bun not found"\nexit 0\n' > "$R/validation/scripts/skips-itself.test.sh"
printf '#!/usr/bin/env bash\necho "SKIP - one leg needs a checkout"\necho "ok   - the other leg"\nexit 0\n' > "$R/validation/scripts/partly-skips.test.sh"
# a PATH with the shell's tools and no bun
CLEAN="$T/clean"; mkdir -p "$CLEAN"
for t in bash env date awk mktemp rm mkdir cat grep cut sed sort dirname basename ls printf tail head tr wc jq git; do
  p="$(command -v "$t" 2>/dev/null)" && ln -sf "$p" "$CLEAN/$t"
done
OUT="$T/out.txt"
PATH="$CLEAN" GLUE_TESTS_BUN="$T/bunbin/bun" bash "$R/validation/scripts/run-glue-tests.sh" --root "$R" --log-dir "$R/logs" > "$OUT" 2>&1
grep -qE '^PASS .*needs-bun\.test\.sh' "$OUT" && ok "(a) a bash test finds bun in GLUE_TESTS_BUN's directory" || bad "(a) $(grep needs-bun "$OUT")"
grep -qE '^SKIP .*skips-itself\.test\.sh' "$OUT" && ! grep -qE '^PASS .*skips-itself' "$OUT" && grep -qE ' 1 skipped' "$OUT" \
  && ok "(b) a test's own SKIP is reported and counted as a skip" || bad "(b) $(grep -E 'skips-itself|skipped' "$OUT")"
grep -qE '^PASS .*partly-skips\.test\.sh' "$OUT" && ok "(c) a test that skips one leg and passes another is PASS" || bad "(c) $(grep partly-skips "$OUT")"
echo; [ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
