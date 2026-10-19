#!/usr/bin/env bash
# kind: known-valid
# The candidate's units do what the substrate needs them to do: every service runs substrate code, ticks run from
# the accepted run-dir and never from the clone, and the secret paths stay masked. Run by shadow-eval.sh with
# CANDIDATE_DIR (see its header). unit-verify.sh judges that the files PARSE; this judges what they MEAN, as systemd
# resolves them (the unit file, then its drop-ins by file name, an empty assignment resetting the list).
#
# WHY. Units converge in place only when the coverage map proves each one at level behaviour
# (in-place-image-convergence 1.3), and for a unit file a syntax mutation proves only parse. The semantic changes
# that matter most were invisible to the corpus: a vessel whose ExecStart= runs nothing, a tick that runs the clone
# HEAD (an unjudged candidate) instead of the accepted run-dir, the fleet-wide secrets mask emptied.
#
# WHAT IS CHECKED (deterministic; no systemd needed). For each units/<name>.service, its EFFECTIVE settings are the
# lines of the unit file, then the drop-ins in units/service.d/ (every service) and units/<name>.service.d/, ordered
# by file name, a unit's own drop-in replacing a same-named service.d one (symlinks are followed):
#   E1. every declared non-empty ExecStart= line, in the unit file or a drop-in, names substrate code: a path under
#       /vessels/, /scripts/, /usr/local/bin/, /usr/local/libexec/, /usr/local/share/substrate/, or a script that
#       exists in the candidate's scripts/substrate, reached as ${SUBSTRATE_RUN_DIR}/<f>, /workspace/active-scripts/<f>
#       or (in a line a drop-in resets, only) ${SUBSTRATE_ROOT}/scripts/substrate/<f>;
#   E2. the EFFECTIVE ExecStart= (what remains after resets) is non-empty and never ${SUBSTRATE_ROOT}/...: that path
#       is the node's super clone, whose HEAD is an unjudged candidate, so a tick run from it bypasses this gate;
#   S1. every *-vessel.service masks (InaccessiblePaths=, an exact path or a parent) each path in SECRETS;
#   S2. every service not in SECRET_DIR_EXEMPT masks each path in SECRET_DIR.
# The exceptions are embedded, never read from the candidate (a candidate could otherwise excuse itself):
#   EXEC_EXEMPT: units whose ExecStart is a system program by design;
#   SECRET_DIR_EXEMPT: units that legitimately read the private store (their own drop-in replaces the mask), as
#     vessel.d/EXCEPTIONS and validation/scripts/vessel-secrets-dropin.test.sh state.
# Changing a list here is a change to an accepted fixture, so it is a widening and is reviewed as one.
# A REFUSAL NAMES THE UNIT AND THE LINE: `FAIL - <unit>: <why>`, then a summary.
set -u
U="$CANDIDATE_DIR/scripts/substrate/units"; SS="$CANDIDATE_DIR/scripts/substrate"
[ -d "$U" ] || { echo "ok - the candidate carries no units/ directory"; exit 0; }
EXEC_EXEMPT=" journald-stdout-forwarder.service novnc.service "
SECRETS=(/workspace/.substrate-secrets /workspace/.substrate-secrets.d /etc/substrate/private)
SECRET_DIR=(/etc/substrate/private /workspace/.substrate-private)
SECRET_DIR_EXEMPT=" git-push-setup.service identity-seeder.service substrate-pull-sync.service "
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
owned() { # <command line> <allow-root: 0|1> -> 0 when it names substrate code
  local c="$1" f
  case "$c" in *' /vessels/'*|/vessels/*|*' /scripts/'*|/scripts/*|*/usr/local/bin/*|*/usr/local/libexec/*|*/usr/local/share/substrate/*) return 0 ;; esac
  for f in $(printf '%s' "$c" | grep -oE '(\$\{SUBSTRATE_RUN_DIR\}|/workspace/active-scripts)/[A-Za-z0-9._/-]+'); do
    f="${f#\$\{SUBSTRATE_RUN_DIR\}/}"; f="${f#/workspace/active-scripts/}"
    [ -f "$SS/$f" ] && return 0
  done
  if [ "$2" = 1 ]; then
    for f in $(printf '%s' "$c" | grep -oE '\$\{SUBSTRATE_ROOT\}/scripts/substrate/[A-Za-z0-9._/-]+'); do
      [ -f "$SS/${f#*/scripts/substrate/}" ] && return 0
    done
  fi
  return 1
}
masks() { # <wanted path> <masked paths...> -> 0 when one of them is the path or a parent of it
  local w="$1" m; shift
  for m in "$@"; do m="${m%/}"; [ "$w" = "$m" ] || [ "${w#"$m"/}" != "$w" ] && return 0; done; return 1
}

while IFS= read -r unit; do
  n=$((n + 1)); name="${unit##*/}"
  exec_lines=(); eff=(); ip=()
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    while IFS= read -r line; do
      line="${line%$'\r'}"
      case "$line" in
        ExecStart=*|ExecStart\ =*)
          v="${line#*=}"; v="${v#"${v%%[![:space:]]*}"}"
          if [ -z "$v" ]; then eff=(); else v="${v#[-@:+!]}"; exec_lines+=("$v"); eff+=("$v"); fi ;;
        InaccessiblePaths=*|InaccessiblePaths\ =*)
          v="${line#*=}"
          if [ -z "${v//[[:space:]]/}" ]; then ip=(); else for p in $v; do ip+=("${p#[-+]}"); done; fi ;;
      esac
    done < "$f"
  done < <(files_of "$name")
  if [[ "$EXEC_EXEMPT" != *" $name "* ]]; then
    last=$(( ${#eff[@]} ))
    for v in "${exec_lines[@]}"; do
      owned "$v" 1 || say_fail "$name: ExecStart=$(printf '%.70s' "$v") does not run substrate code (E1)"
    done
    [ "$last" -gt 0 ] || say_fail "$name: no effective ExecStart= after its drop-ins (E2)"
    for v in "${eff[@]}"; do
      # The script it EXECUTES, not any mention: the run-dir seeder copies from the clone on a never-gated node.
      if [[ "$v" == *'${SUBSTRATE_ROOT}/'* ]] || [[ "$v" =~ ^([^[:space:]]+[[:space:]]+)?(bash[[:space:]]+)?/workspace/git/super-repo/ ]]; then
        say_fail "$name: its effective ExecStart= runs the clone, not the accepted run-dir: $(printf '%.70s' "$v") (E2)"; fi
      owned "$v" 0 || case "$v" in *'${SUBSTRATE_ROOT}'*) ;; *) say_fail "$name: effective ExecStart=$(printf '%.70s' "$v") does not run substrate code (E2)" ;; esac
    done
  fi
  case "$name" in *-vessel.service)
    for w in "${SECRETS[@]}"; do masks "$w" "${ip[@]}" || say_fail "$name: $w is not masked (InaccessiblePaths=, S1)"; done ;;
  esac
  if [[ "$SECRET_DIR_EXEMPT" != *" $name "* ]]; then
    for w in "${SECRET_DIR[@]}"; do masks "$w" "${ip[@]}" || say_fail "$name: $w is not masked (InaccessiblePaths=, S2)"; done
  fi
done < <(find "$U" -maxdepth 1 \( -type f -o -type l \) -name '*.service' | sort)
[ "$n" -gt 0 ] || { echo "FAIL - units/ holds no services"; exit 1; }
if [ "$fails" -gt 0 ]; then echo "FAIL - $fails problem(s) in what the candidate's units do ($n services)"; exit 1; fi
echo "ok - all $n services run substrate code from the accepted run-dir, and keep the secret paths masked"
exit 0
