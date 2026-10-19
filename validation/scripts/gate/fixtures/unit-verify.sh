#!/usr/bin/env bash
# kind: known-valid
# The candidate's unit files are well-formed systemd units: every file under scripts/substrate/units/ (*.service,
# *.timer, and the drop-ins in *.d/*.conf) parses, and the main units carry what makes them runnable. Run by
# shadow-eval.sh with CANDIDATE_DIR (see its header).
#
# WHY. Units converge in place: pull-sync installs the candidate's units/ into /usr/lib/systemd/system once the
# accepted corpus passes the candidate for the soak. Until this fixture, no fixture read a unit file, so the coverage
# map exempted all of them (units_exempt) and a broken unit would reach systemd on every gated node. systemd itself
# does not refuse a bad line: it logs "Missing '=', ignoring line" and runs the unit without it. A unit can lose
# its ExecStart= (or a sandboxing line) silently, and nothing downstream names the cause.
#
# WHAT IS CHECKED (deterministic; no systemd needed, so it judges the same in CI and on a node):
#   1. every non-blank, non-comment line is a [Section] header, a Key=Value assignment (the key is letters and
#      digits), or the continuation of a previous line that ended in a backslash;
#   2. every section is one the file kind allows ([Unit] [Service] [Install] for a service and its drop-ins,
#      [Unit] [Timer] [Install] for a timer and its drop-ins); units/ carries no other kinds;
#   3. every *.service has a [Service] section with ExecStart= (any Type), and every *.timer a [Timer] section with
#      at least one On*= trigger, whose Unit= (or same-named .service) exists in units/ or names a system unit;
#   4. a drop-in that is a symlink resolves to a file inside units/ (vessel.d/ shares one drop-in across vessels);
#   5. the three lists beside the drop-ins (service.d/EXEMPT, service.d/WRITERS, vessel.d/EXCEPTIONS) keep their
#      declared formats, naming only units in units/ and drop-ins in service.d/ (systemd ignores them, but the
#      secret and trust-root tests read them, and a malformed entry silently widens an exemption).
# A REFUSAL NAMES THE LINE: `FAIL - scripts/substrate/units/<path>:<line>: <why>`, the first ones first, then a summary.
set -u
U="$CANDIDATE_DIR/scripts/substrate/units"
[ -d "$U" ] || { echo "ok - the candidate carries no units/ directory"; exit 0; }
fails=0; n=0
say_fail() { fails=$((fails + 1)); [ "$fails" -le 20 ] && echo "FAIL - $*"; }
check_file() { # <path> <kind: service|timer> <dropin: 0|1>
  local f="$1" kind="$2" dropin="$3" rel="scripts/substrate/units/${1#"$U"/}" out
  out="$(awk -v kind="$kind" -v dropin="$dropin" -v rel="$rel" '
    BEGIN { ok["service"]="Unit Service Install"; ok["timer"]="Unit Timer Install"
            split(ok[kind], a, " "); for (i in a) allowed[a[i]] = 1; sec = ""; cont = 0 }
    { line = $0; sub(/\r$/, "", line) }
    cont { cont = (line ~ /\\$/); next }
    line ~ /^[[:space:]]*$/ || line ~ /^[[:space:]]*[#;]/ { next }
    line ~ /^\[[A-Za-z]+\][[:space:]]*$/ {
      sec = line; gsub(/[][[:space:]]/, "", sec)
      if (!(sec in allowed)) printf "%s:%d: section [%s] is not valid in a %s%s\n", rel, NR, sec, (dropin ? "drop-in for a " : ""), kind
      seen[sec] = 1; next }
    line ~ /^[A-Za-z][A-Za-z0-9]*[[:space:]]*=/ {
      if (sec == "") printf "%s:%d: an assignment before any [Section]\n", rel, NR
      k = line; sub(/[[:space:]]*=.*/, "", k); keys[sec "." k] = 1
      cont = (line ~ /\\$/); next }
    { printf "%s:%d: not a [Section], Key=Value or continuation line: %s\n", rel, NR, substr(line, 1, 60) }
    END {
      if (dropin) exit
      if (kind == "service" && !(("Service.ExecStart") in keys)) printf "%s: a service with no ExecStart= in [Service]\n", rel
      if (kind == "timer") {
        trig = 0; for (k in keys) if (k ~ /^Timer\.On[A-Za-z]+$/) trig = 1
        if (!trig) printf "%s: a timer with no On*= trigger in [Timer]\n", rel }
    }' "$f")"
  [ -z "$out" ] || while IFS= read -r l; do say_fail "$l"; done <<< "$out"
}
check_list() { # <path> <format: unit|dropin-unit>
  local f="$1" fmt="$2" rel="scripts/substrate/units/${1#"$U"/}" ln=0 line a b c
  while IFS= read -r line || [ -n "$line" ]; do
    ln=$((ln + 1)); case "$line" in ''|'#'*|[[:space:]]'#'*) continue ;; esac
    read -r a b c <<< "$line"
    if [ "$fmt" = unit ]; then
      case "$a" in *.service) ;; *) say_fail "$rel:$ln: expected '<unit>.service <reason>'"; continue ;; esac
      [ -f "$U/$a" ] || say_fail "$rel:$ln: $a is not a unit in units/"
      [ -n "$b" ] || say_fail "$rel:$ln: $a has no reason"
    else
      case "$a" in [0-9][0-9]-*.conf) ;; *) say_fail "$rel:$ln: expected '<NN-name>.conf <unit>.service <reason>'"; continue ;; esac
      [ -f "$U/service.d/$a" ] || say_fail "$rel:$ln: $a is not a drop-in in service.d/"
      case "$b" in *.service) [ -f "$U/$b" ] || say_fail "$rel:$ln: $b is not a unit in units/" ;; *) say_fail "$rel:$ln: '$b' is not a .service" ;; esac
      [ -n "$c" ] || say_fail "$rel:$ln: $a $b has no reason"
    fi
  done < "$f"
}
for l in service.d/EXEMPT:unit vessel.d/EXCEPTIONS:unit service.d/WRITERS:dropin-unit; do
  [ -f "$U/${l%%:*}" ] && { n=$((n + 1)); check_list "$U/${l%%:*}" "${l#*:}"; }
done
while IFS= read -r f; do
  n=$((n + 1))
  if [ -L "$f" ]; then
    t="$(readlink -f "$f" 2>/dev/null)"
    case "$t" in "$U"/*) [ -f "$t" ] || { say_fail "scripts/substrate/units/${f#"$U"/}: a symlink to a missing file"; continue; } ;;
      *) say_fail "scripts/substrate/units/${f#"$U"/}: a symlink that leaves units/ (${t:-unresolved})"; continue ;; esac
  fi
  case "$f" in
    *.d/*.conf) base="${f%/*}"; base="${base##*/}"; base="${base%.d}"
                case "$base" in *.timer) k=timer ;; *) k=service ;; esac; check_file "$f" "$k" 1 ;;   # service.d, vessel.d -> service
    *.service) check_file "$f" service 0 ;;
    *.timer)   check_file "$f" timer 0
               want="$(sed -n 's/^[[:space:]]*Unit[[:space:]]*=[[:space:]]*//p' "$f" | tail -1)"
               [ -n "$want" ] || { want="${f##*/}"; want="${want%.timer}.service"; }
               case "$want" in *.service) [ -f "$U/$want" ] || [ -f "/usr/lib/systemd/system/$want" ] || [ -f "/lib/systemd/system/$want" ] \
                 || say_fail "scripts/substrate/units/${f#"$U"/}: the timer starts $want, which is not in units/ or on the system" ;; esac ;;
  esac
done < <(find "$U" \( -type f -o -type l \) \( -name '*.service' -o -name '*.timer' -o -path '*.d/*.conf' \) | sort)
[ "$n" -gt 0 ] || { echo "FAIL - units/ holds no unit files"; exit 1; }
if [ "$fails" -gt 0 ]; then echo "FAIL - $fails problem(s) in the candidate's unit files ($n checked)"; exit 1; fi
echo "ok - all $n unit files under scripts/substrate/units/ are well-formed"
exit 0
