# coverage-all-behaviour.sh — for pull-sync glue tests that stage a scratch super-repo.
# pull-sync installs a glue path only when scripts/substrate/gate/coverage.json proves it at level behaviour on its
# exact blob (in-place-image-convergence 1.3). A test that is about something ELSE (self-update, committed-glue
# staging, the hold channel) states that precondition explicitly: cov_all <tree> marks every file under
# <tree>/scripts/substrate behaviour on its current blob. Call it right before each `git add -A` / commit of the tree.
# The coverage gate itself is judged by pull-sync-installs-only-covered-paths.test.sh, not here.
cov_all() { # <tree>
  local t="$1" f m="$1/scripts/substrate/gate/coverage.json"
  mkdir -p "$t/scripts/substrate/gate"
  { echo '{"paths":{'; local first=1
    while IFS= read -r f; do
      [ "$f" = "$m" ] && continue
      [ "$first" = 1 ] && first=0 || echo ','
      printf '"/test/%s":{"src":"%s","src_blob":"%s","level":"behaviour","reason":"mutation-proven","fixtures":["test"]}' \
        "${f#"$t"/}" "${f#"$t"/}" "$(git hash-object "$f")"
    done < <(find "$t/scripts/substrate" -type f | sort)
    echo '}}'; } > "$m"
}
