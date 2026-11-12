#!/usr/bin/env bash
# run-glue-tests.sh gives every test, bash ones included, GLUE_TESTS_BUN's directory on its PATH (env -i drops
# GLUE_TESTS_BUN itself), and reports a test's own skip as SKIP, never PASS. Each case runs the runner from this tree
# against a --root under $T holding only fixture tests, with a PATH that has no bun of its own.
#   (a) MUST-FAIL: a bash test that needs `bun` by name passes when bun lives only in GLUE_TESTS_BUN's directory
#   (b) MUST-FAIL: a bash test that prints "SKIP - …" and exits 0 is reported SKIP and counted skipped, not PASS
#   (c) a bash test that skips one leg and passes another is still PASS (a guard)
#   (d) MUST-FAIL: a bash test that prints only "SKIP - …" and exits non-zero is a SKIP, not a FAIL
#   (e) a bash test that prints SKIP and a failing line and exits non-zero is still FAIL (a guard)
#   (f) MUST-FAIL: acceptance's glue verdict names every skipped test, whatever its duration, and fails the
#       check in gating mode when any test was skipped; report-only keeps the exit status (a guard)
#   (g) MUST-FAIL: --print-needs prints each worktree a test reads, every one a submodule this tree declares (a
#       retired repo can never be checked out, so its test could only ever skip), and the acceptance workflow checks
#       out exactly that list, so CI runs those tests instead of skipping them
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
printf '#!/usr/bin/env bash\necho "SKIP - no worktree to judge"\nexit 3\n' > "$R/validation/scripts/skips-nonzero.test.sh"
printf '#!/usr/bin/env bash\necho "SKIP - one leg needs a checkout"\necho "FAIL - the other leg"\nexit 1\n' > "$R/validation/scripts/skips-and-fails.test.sh"
# a PATH with the shell's tools and no bun
CLEAN="$T/clean"; mkdir -p "$CLEAN"
for t in bash env date awk mktemp rm mkdir cat grep cut sed sort dirname basename ls printf tail head tr wc jq git; do
  p="$(command -v "$t" 2>/dev/null)" && ln -sf "$p" "$CLEAN/$t"
done
OUT="$T/out.txt"
PATH="$CLEAN" GLUE_TESTS_BUN="$T/bunbin/bun" bash "$R/validation/scripts/run-glue-tests.sh" --root "$R" --log-dir "$R/logs" > "$OUT" 2>&1
grep -qE '^PASS .*needs-bun\.test\.sh' "$OUT" && ok "(a) a bash test finds bun in GLUE_TESTS_BUN's directory" || bad "(a) $(grep needs-bun "$OUT")"
grep -qE '^SKIP .*skips-itself\.test\.sh' "$OUT" && ! grep -qE '^PASS .*skips-itself' "$OUT" \
  && ok "(b) a test's own SKIP is reported and counted as a skip" || bad "(b) $(grep -E 'skips-itself|skipped' "$OUT")"
grep -qE '^PASS .*partly-skips\.test\.sh' "$OUT" && ok "(c) a test that skips one leg and passes another is PASS" || bad "(c) $(grep partly-skips "$OUT")"
grep -qE '^SKIP .*skips-nonzero\.test\.sh' "$OUT" && ! grep -qE '^FAIL .*skips-nonzero' "$OUT" \
  && ok "(d) a test that only skips is a SKIP whatever its exit status" || bad "(d) $(grep skips-nonzero "$OUT")"
grep -qE '^FAIL .*skips-and-fails\.test\.sh' "$OUT" && ok "(e) a test that skips and fails is FAIL" || bad "(e) $(grep skips-and-fails "$OUT")"
grep -qE ' 2 skipped' "$OUT" && ok "(b,d) the summary counts both skips" || bad "(b,d) $(tail -n 1 "$OUT")"
# (f) the verdict acceptance records, from this run's own output (runner skips print "-", a test's own skip a duration)
printf 'SKIP      -  bun-only.test.sh  (bun not found)\n' >> "$OUT"
. "$SRC/scripts/substrate/acceptance/glue-verdict.sh"
g="$(glue_verdict "$OUT" 0 gating)"; r="$(glue_verdict "$OUT" 0 report-only)"; c="$(printf 'PASS    0.1s  x.test.sh\n' > "$T/clean.txt"; glue_verdict "$T/clean.txt" 0 gating)"
[ "$(jq -c '.skipped | sort' <<<"$g")" = '["bun-only.test.sh","skips-itself.test.sh","skips-nonzero.test.sh"]' ] \
  && [ "$(jq -r .result <<<"$g")" = fail ] && [ "$(jq -c .failed <<<"$g")" = '["skips-and-fails.test.sh"]' ] \
  && ok "(f) gating: every skip is named and fails the check" || bad "(f) gating verdict $g"
[ "$(jq -r .result <<<"$r")" = pass ] && [ "$(jq -r .result <<<"$c")" = pass ] \
  && ok "(f) report-only keeps the exit status; a run with no skip passes gating" || bad "(f) report-only $r clean $c"
# (g) the worktrees named, against this tree's .gitmodules and the acceptance workflow
pn="$(bash "$SRC/validation/scripts/run-glue-tests.sh" --print-needs 2>&1)"; prc=$?
declared="$(sed -n 's/^[[:space:]]*path = //p' "$SRC/.gitmodules")"
undeclared="$(printf '%s\n' "$pn" | grep -vxF -f <(printf '%s\n' "$declared") || true)"
[ "$prc" -eq 0 ] && [ -n "$pn" ] && [ -z "$undeclared" ] \
  && ok "(g) every worktree a test reads is a declared submodule: $(echo $pn)" || bad "(g) --print-needs rc=$prc: $(echo $pn); undeclared: $(echo $undeclared)"
grep -qF 'run-glue-tests.sh --print-needs' "$SRC/.github/workflows/install-acceptance.yml" \
  && ok "(g) the acceptance workflow checks out what --print-needs names" || bad "(g) install-acceptance.yml does not read --print-needs"
echo; [ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
