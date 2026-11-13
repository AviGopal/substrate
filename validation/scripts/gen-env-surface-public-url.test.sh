#!/usr/bin/env bash
# gen-env-surface-public-url.test.sh: a deployment states the address people open its human surface at
# (HUMAN_SURFACE_PUBLIC_URL, one full origin) and gen-env delivers it to the surface's env file. Unset, nothing is
# written and nothing changes.
#   (a) MUST-FAIL: gen-env checks the value and refuses anything but a bare https origin (plain http, a path, a query,
#       a fragment, credentials, a space, no scheme, no host, a port that is not a number, or a bracketed host)
#   (b) MUST-FAIL: bare https origins pass (with and without a port)
#   (c) MUST-FAIL: the value is written to the env file only when set, and is recorded as supplied by the run env
#   (d) MUST-FAIL: the compose lane forwards it to the container
# The check block is extracted from gen-env and run with _refuse stubbed; nothing touches the network or /etc.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; G="${1:-$HERE/../../scripts/substrate/gen-env.sh}"
C="${2:-$HERE/../../docker-compose.yml}"
T="$(mktemp -d "${TMPDIR:-/tmp}/surfpub.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
awk "/# ★ THE SURFACE'S PUBLIC ADDRESS/{on=1} on{print} /# ★ END THE SURFACE'S PUBLIC ADDRESS/{exit}" "$G" > "$T/blk.sh"
grep -q 'HUMAN_SURFACE_PUBLIC_URL' "$T/blk.sh" || { echo "FAIL - gen-env does not check HUMAN_SURFACE_PUBLIC_URL (red)"; exit 1; }
# verdict <value> -> refused|passed
verdict() { ( _refuse() { echo refused; exit 3; }; HUMAN_SURFACE_PUBLIC_URL="$1"; . "$T/blk.sh"; echo passed ) 2>/dev/null | tail -1; }
for v in "https://surface.example/" "https://surface.example/app" "https://surface.example?x=1" "https://surface.example#a" \
         "https://user@surface.example" "https://surface .example" "surface.example" "ftp://surface.example" "https://" \
         "https://:8443" "https://surface.example:abc" "https://surface.example:" "https://surface.example:84:43" "https://[::1]:8443" \
         "http://surface.example" "http://surface.example:8080"; do
  [ "$(verdict "$v")" = refused ] && ok "(a) refused: '$v'" || bad "(a) accepted: '$v'"
done
for v in "https://surface.example" "https://surface.example:8443"; do
  [ "$(verdict "$v")" = passed ] && ok "(b) passed: '$v'" || bad "(b) refused: '$v'"
done
[ "$(verdict "")" = passed ] && ok "(b) unset is not checked" || bad "(b) unset was refused"
grep -qE '^\s*\[ -n "\$\{HUMAN_SURFACE_PUBLIC_URL:-\}" \] && echo "HUMAN_SURFACE_PUBLIC_URL=' "$G" \
  && ok "(c) written to the env file only when set" || bad "(c) not written, or written unconditionally"
awk '/^_ENV_SUPPLIED=""/{on=1} on && /; do$/{print; exit} on{print}' "$G" | grep -q 'HUMAN_SURFACE_PUBLIC_URL' \
  && ok "(c) recorded among the names the run env supplied" || bad "(c) not in the supplied-names list"
grep -qE '^\s+HUMAN_SURFACE_PUBLIC_URL: \$\{HUMAN_SURFACE_PUBLIC_URL:-\}$' "$C" \
  && ok "(d) the compose lane forwards it" || bad "(d) the compose lane does not forward it"
[ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "FAILED ($FAILS)"; exit 1; }
