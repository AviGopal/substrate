#!/usr/bin/env bash
# kind: known-valid
# The candidate's services survive a one-shot job failing or running again: no service takes a HARD dependency on a
# Type=oneshot unit. Run by shadow-eval.sh with CANDIDATE_DIR (see its header). unit-semantics.sh judges what a unit
# runs; this judges what stops it.
#
# WHY. A seeder is a one-shot job that a deployment reruns (after a records restart, after a seed change). Under
# Requires=, BindsTo=, PartOf= or Requisite= on it, systemd carries the job's stop or failure to the dependent: a
# rerun that fails stops the vessel with "Dependency failed", and the job's next successful run does not start it
# again. That is how the walk and described-shape went dead after a seeder rerun during a records restart. Wants=
# with After= keeps the boot order (the rows are written before the vessel starts) without the stop: the vessel
# reads its rows itself, and one that finds them missing exits and is restarted.
#
# WHAT IS CHECKED (deterministic; no systemd needed). For each units/<name>.service, its EFFECTIVE settings are the
# lines of the unit file, then the drop-ins in units/service.d/ (every service) and units/<name>.service.d/, ordered
# by file name, a unit's own drop-in replacing a same-named service.d one (symlinks are followed), an empty
# assignment resetting the list. Each line is read as systemd reads it: a trailing backslash joins the next line,
# and whitespace before the key and around the "=" is ignored. A one-shot job is also known by its Alias= names; a
# dependency on a name without its suffix is not a dependency (systemd refuses it: "Invalid argument"). A vessel whose unit file render-unit.sh writes at boot is here only as its
# units/<name>.service.d/ directory: its drop-ins are judged the same way (the rendered file itself sets Type=simple
# and only Wants=, so it adds no hard dependency):
#   D1. no effective Requires=, BindsTo=, PartOf= or Requisite= names a candidate service whose effective Type= is
#       oneshot.
# There is no exemption list: a service that must stop with a job is a job of its own.
# A REFUSAL NAMES THE UNIT AND THE DEPENDENCY: `FAIL - <unit>: <why>`, then a summary.
set -u
U="$CANDIDATE_DIR/scripts/substrate/units"
[ -d "$U" ] || { echo "ok - the candidate carries no units/ directory"; exit 0; }
fails=0; n=0
say_fail() { fails=$((fails + 1)); [ "$fails" -le 25 ] && echo "FAIL - $*"; }

files_of() { # <name.service> -> the unit file, then its drop-ins in systemd order, one per line
  local u="$1" d b; echo "$U/$u"
  declare -A pick=()
  for d in "$U/service.d" "$U/$u.d"; do
    [ -d "$d" ] || continue
    for b in "$d"/*.conf; do [ -e "$b" ] && pick["$(basename "$b")"]="$b"; done
  done
  for b in $(printf '%s\n' "${!pick[@]}" | sort); do echo "${pick[$b]}"; done
}
settings() { # <file> -> its settings as systemd reads them, one "key<TAB>value" per line: a line ending in a
  # backslash continues on the next (joined with a space), leading whitespace and comment lines (# or ;) are dropped,
  # and the key and the value are each trimmed around the first "="
  awk '{ sub(/\r$/, "") }
       { if (acc != "") { line = acc " " $0; acc = "" } else line = $0 }
       /\\$/ { sub(/\\$/, "", line); acc = line; next }
       { sub(/^[ \t]+/, "", line) }
       line == "" || line ~ /^[#;]/ || index(line, "=") == 0 { next }
       { k = substr(line, 1, index(line, "=") - 1); v = substr(line, index(line, "=") + 1)
         sub(/[ \t]+$/, "", k); sub(/^[ \t]+/, "", v); sub(/[ \t]+$/, "", v); print k "\t" v }
       END { if (acc != "") { sub(/^[ \t]+/, "", acc); if (index(acc, "=")) { k = substr(acc, 1, index(acc, "=") - 1)
             v = substr(acc, index(acc, "=") + 1); sub(/[ \t]+$/, "", k); sub(/^[ \t]+/, "", v); print k "\t" v } } }' "$1"
}
effective() { # <name.service> <key> -> the effective values of a list setting, one per line (Type: the last one)
  local name="$1" key="$2" f k v w vals=()
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    while IFS=$'\t' read -r k v; do
      [ "$k" = "$key" ] || continue
      if [ -z "${v//[[:space:]]/}" ]; then vals=()
      elif [ "$key" = Type ]; then vals=("${v//[[:space:]]/}")
      else for w in $v; do vals+=("$w"); done; fi
    done < <(settings "$f")
  done < <(files_of "$name")
  [ "${#vals[@]}" -gt 0 ] && printf '%s\n' "${vals[@]}"
}

services() { # every service the candidate defines: a unit file, or a drop-in directory for a rendered unit
  { find "$U" -maxdepth 1 \( -type f -o -type l \) -name '*.service' -printf '%f\n'
    find "$U" -maxdepth 1 -type d -name '?*.service.d' -printf '%f\n' | sed 's/\.d$//'; } | sort -u
}

declare -A ONESHOT=()
while IFS= read -r name; do
  [ "$(effective "$name" Type | tail -n 1)" = oneshot ] || continue
  ONESHOT["$name"]=1
  while IFS= read -r a; do [ -n "$a" ] && ONESHOT["$a"]=1; done < <(effective "$name" Alias)   # its other names
done < <(services)

while IFS= read -r name; do
  n=$((n + 1))
  for key in Requires BindsTo PartOf Requisite; do
    while IFS= read -r dep; do
      [ -n "$dep" ] && [ -n "${ONESHOT[$dep]:-}" ] \
        && say_fail "$name: $key=$dep, a one-shot job; its failure or rerun would stop $name (D1: use Wants= with After=)"
    done < <(effective "$name" "$key")
  done
done < <(services)
[ "$n" -gt 0 ] || { echo "FAIL - units/ holds no services"; exit 1; }
if [ "$fails" -gt 0 ]; then echo "FAIL - $fails hard dependenc(ies) on one-shot jobs ($n services)"; exit 1; fi
echo "ok - none of the $n services ($(echo "${!ONESHOT[@]}" | wc -w) one-shot) is stopped by a one-shot job failing or running again"
exit 0
