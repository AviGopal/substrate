#!/usr/bin/env bash
# metabob-census.sh [--ref <ref>] [--root <super-repo>] : the read-site inventory for openspec retire-metabob-names.
#
# Prints a TSV, one row per line that names a retiring configuration name:
#   repo  file  line  names  fallback  kind
#   names     comma list of API_KEY, ENDPOINT, CONFIG_PATH (METABOB_*) and PATH (~/.metabob)
#   fallback  1 when the line gives the old name a default (`?? x`, `|| x` incl. after env["NAME"], `${NAME:-x}`,
#             `${NAME-x}`, `${NAME:=x}`, `.get("NAME", x)`, `.get("NAME") or x`, `{ NAME = x } = process.env`):
#             such a read does not fail when the name disappears, it falls back, so it
#             counts as a miss even when it appears to work (task 2.3b)
#   kind      test | doc | openspec | unit | ci | hook | code
# The super-repo and every submodule under repos/ are read at <ref> (default origin/dev) with `git grep`, so the
# working tree and untracked files never count. Phase 3's lint (no-metabob-names) uses the same patterns.
set -uo pipefail
REF=origin/dev; ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
while [ $# -gt 0 ]; do case "$1" in --ref) REF="$2"; shift 2 ;; --root) ROOT="$2"; shift 2 ;; *) echo "usage: $0 [--ref R] [--root DIR]" >&2; exit 2 ;; esac; done
PAT='METABOB_(API_KEY|ENDPOINT|CONFIG_PATH)\b|\.metabob(/|\b)'
census_repo() { # dir label
  git -C "$1" grep -nIE "$PAT" "$REF" -- . 2>/dev/null | sed "s#^$REF:##" | awk -v repo="$2" '
    function kind(f) {
      if (f ~ /(^|\/)(test|tests|__tests__)\// || f ~ /\.test\.|\.spec\.|^validation\//) return "test"
      if (f ~ /^openspec\//) return "openspec"
      if (f ~ /^docs\// || f ~ /\.md$/) return "doc"
      if (f ~ /\/units\// || f ~ /\.(service|timer|conf)$/ || f ~ /\/EXEMPT$|\/EXCEPTIONS$/) return "unit"
      if (f ~ /^\.github\//) return "ci"
      if (f ~ /^\.claude\// || f ~ /^\.githooks\// || f ~ /git-hooks\//) return "hook"
      return "code" }
    { f=$0; sub(/:.*/, "", f); rest=substr($0, length(f)+2); ln=rest; sub(/:.*/, "", ln); t=substr(rest, length(ln)+2)
      n=""; if (t ~ /METABOB_API_KEY/) n=n "API_KEY,"; if (t ~ /METABOB_ENDPOINT/) n=n "ENDPOINT,"
      if (t ~ /METABOB_CONFIG_PATH/) n=n "CONFIG_PATH,"; if (t ~ /\.metabob/) n=n "PATH,"; sub(/,$/, "", n)
      # fallback forms (one flag per line, however many it has): NAME [] ) quote] then ?? or ||; ${NAME:-x}
      # ${NAME-x} ${NAME:=x} ${NAME=x}; get/getenv("NAME", x); get/getenv("NAME") or x; and a destructuring
      # default { NAME = x } = process.env (bounded to lines that destructure process.env)
      fb = (t ~ /METABOB_[A-Z_]+[]\)"'"'"' \t]*(\?\?|\|\|)/ \
         || t ~ /\$\{METABOB_[A-Z_]+:?[-=]/ \
         || t ~ /(get|getenv)\([[:space:]]*["'"'"']METABOB_[A-Z_]+["'"'"'][[:space:]]*,/ \
         || t ~ /(get|getenv)\([[:space:]]*["'"'"']METABOB_[A-Z_]+["'"'"'][[:space:]]*\)[[:space:]]+or([^A-Za-z0-9_]|$)/ \
         || (t ~ /\}[[:space:]]*=[[:space:]]*process\.env/ && t ~ /METABOB_[A-Z_]+[[:space:]]*=[^=>]/)) ? 1 : 0
      print repo "\t" f "\t" ln "\t" n "\t" fb "\t" kind(f) }'
}
census_repo "$ROOT" super-repo
for r in "$ROOT"/repos/*; do [ -e "$r/.git" ] && census_repo "$r" "$(basename "$r")"; done
