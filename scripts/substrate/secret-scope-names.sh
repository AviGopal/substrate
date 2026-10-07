#!/usr/bin/env bash
# secret-scope-names.sh [--all] : NAMES ONLY, never values. For every loaded .service unit, the secret names it
# receives through its EnvironmentFile= list (the shared /etc/substrate/env plus any scoped env.d file), its
# Environment= lines (unit and drop-ins) and its PassEnvironment= names, as
#   <unit> TAB <comma-separated sorted names>
# Secret names are *_API_KEY, *_KEY, *SECRET*, *TOKEN*, *PASS*, *_PAT (at the end: not _PATHS) and *BEARER*; --all lists every name.
# Used by openspec retire-metabob-names (task 1.1/1.5): run it on a node before and after a change to the
# rendered scope and diff the two outputs; the only allowed difference for the rename is SUBSTRATE_API_KEY
# appearing on exactly the units that already list METABOB_API_KEY. Runs inside a substrate container as root
# (the scoped files are root-only); reads files, prints names, and never prints, logs or exports a value.
set -uo pipefail
ALL=0; [ "${1:-}" = --all ] && ALL=1
SC="${SECRET_SCOPE_SYSTEMCTL:-systemctl}"
names_in() { # file -> the variable names it assigns (export prefix and quoting tolerated), one per line
  sed -nE 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=.*/\2/p' "$1" 2>/dev/null; }
secretish() { [ "$ALL" = 1 ] && cat || grep -E '(_API_KEY|_KEY|SECRET|TOKEN|PASS|_PAT$|BEARER)'; }
$SC list-unit-files --type=service --no-legend --plain 2>/dev/null | awk '{print $1}' | grep -v '@\.service$' | sort -u \
| while read -r u; do
  files="$($SC show "$u" -p EnvironmentFiles --value 2>/dev/null | sed -E 's/ \(ignore_errors=[a-z]+\)//g' | tr ' ' '\n' | grep '^/' || true)"
  # Environment= (unit or drop-in) and PassEnvironment= deliver keys too. Names are cut out INSIDE the pipeline;
  # the raw Environment property (which carries values) is never stored or echoed.
  inl="$($SC show "$u" -p Environment --value 2>/dev/null | tr ' ' '\n' | sed -nE 's/^"?([A-Za-z_][A-Za-z0-9_]*)=.*/\1/p')"
  pass="$($SC show "$u" -p PassEnvironment --value 2>/dev/null | tr ' ' '\n' | grep -E '^[A-Za-z_][A-Za-z0-9_]*$' || true)"
  [ -n "$files$inl$pass" ] || continue
  n="$( { for f in $files; do names_in "$f"; done; printf '%s\n' "$inl" "$pass"; } | grep . | secretish | sort -u | paste -sd, -)"
  printf '%s\t%s\n' "$u" "${n:-}"
done
