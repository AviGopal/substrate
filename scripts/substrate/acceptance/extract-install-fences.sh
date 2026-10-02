#!/usr/bin/env bash
# extract-install-fences — pull the executable install sequence out of the install page.
#
# THE FENCE CONVENTION
#
# README § Installation is the only document that carries setup commands, and the
# acceptance run executes them verbatim. A command block is part of that sequence when
# its opening fence's info string starts with a shell language and names `install`:
#
#     ```bash install              runs in every acceptance case
#     ```bash install:spoke        runs only in the `spoke` case
#     ```bash install:hub,spoke    runs in the `hub` and `spoke` cases
#
# Any other block (an unmarked ```bash, a ```text transcript, a block quoted inside a
# `>` callout) is prose: it is shown to the reader and never executed. The marker is an
# extra info-string word, so every Markdown renderer still highlights the block as bash.
# The block's content is emitted byte for byte; this script never rewrites a command.
#
# WHY IT FAILS CLOSED
#
# A page with no marked blocks, a case with no blocks, or a marked block that never
# closes is an error, not an empty success. An acceptance run that executes nothing
# would otherwise report every level it could not reach as the page's fault while the
# page itself went untested — a silent skip reads as a pass.
#
# USAGE
#   extract-install-fences.sh [--case NAME] [--out DIR] FILE
#
#   Prints one index line per selected block, in document order:
#       <n>\t<line of the opening fence>\t<cases or *>\t<path or ->
#   With --out, also writes each block to DIR/<nn>.sh and the index to DIR/index.tsv.
#
# EXIT
#   0 at least one block selected · 2 none selected · 3 unclosed marked block · 64 usage
set -euo pipefail

case_name=""
out_dir=""
file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --case) case_name="${2:-}"; shift 2 ;;
    --case=*) case_name="${1#--case=}"; shift ;;
    --out) out_dir="${2:-}"; shift 2 ;;
    --out=*) out_dir="${1#--out=}"; shift ;;
    -h|--help) sed -n '2,/^set -euo/p' "$0" | sed '$d; s/^# \{0,1\}//'; exit 0 ;;
    -*) echo "extract-install-fences: unknown option $1" >&2; exit 64 ;;
    *) file="$1"; shift ;;
  esac
done
if [ -z "$file" ] || [ ! -r "$file" ]; then
  echo "extract-install-fences: usage: $0 [--case NAME] [--out DIR] FILE (got '${file}')" >&2
  exit 64
fi
if [ -n "$out_dir" ]; then
  mkdir -p "$out_dir"
  # A stale block from an earlier extraction must not be executed as part of this one.
  rm -f "$out_dir"/[0-9]*.sh "$out_dir/index.tsv"
fi

set +e
awk -v want_case="$case_name" -v out_dir="$out_dir" -v src="$file" '
  function reset() { in_fence = 0; selected = 0; body_n = 0 }
  function flush(   i, path, n) {
    if (!selected) return
    count++
    path = "-"
    if (out_dir != "") {
      path = sprintf("%s/%02d.sh", out_dir, count)
      printf "" > path
      for (i = 1; i <= body_n; i++) print body[i] > path
      close(path)
    }
    printf "%d\t%d\t%s\t%s\n", count, open_line, cases, path
    if (out_dir != "") {
      printf "%d\t%d\t%s\t%s\n", count, open_line, cases, path >> (out_dir "/index.tsv")
      close(out_dir "/index.tsv")
    }
  }
  BEGIN { count = 0; reset() }
  {
    line = $0
    if (!in_fence) {
      # An opening fence: up to three spaces of indent, then 3+ backticks or tildes.
      # Anything indented further, or behind a ">" quote marker, is not a fence here.
      if (match(line, /^ ? ? ?(```+|~~~+)/)) {
        indent = line; sub(/[`~].*$/, "", indent)
        marker = substr(line, RSTART + length(indent), RLENGTH - length(indent))
        info = substr(line, RSTART + RLENGTH)
        # A backtick fence may not carry a backtick in its info string (CommonMark).
        if (substr(marker, 1, 1) == "`" && index(info, "`") > 0) next
        in_fence = 1; fence_char = substr(marker, 1, 1); fence_len = length(marker)
        open_line = NR; selected = 0; cases = ""; body_n = 0
        n = split(info, words, /[ \t]+/)
        lang = ""
        for (i = 1; i <= n; i++) if (words[i] != "") { lang = words[i]; break }
        if (lang == "bash" || lang == "sh" || lang == "shell") {
          for (i = 1; i <= n; i++) {
            w = words[i]
            if (w == "install") { selected = 1; cases = "*" }
            else if (w ~ /^install:[A-Za-z0-9_,-]+$/) {
              list = substr(w, 9)
              if (want_case == "") { selected = 1; cases = list }
              else {
                m = split(list, cl, /,/)
                for (j = 1; j <= m; j++) if (cl[j] == want_case) { selected = 1; cases = list }
              }
            }
          }
        }
      }
      next
    }
    # Inside a fence: a closing fence is the same character, at least as long, and
    # nothing but whitespace after it.
    probe = line
    sub(/^ ? ? ?/, "", probe)
    if (substr(probe, 1, 1) == fence_char) {
      run = probe; sub("[^" fence_char "].*$", "", run)
      rest = substr(probe, length(run) + 1)
      if (length(run) >= fence_len && rest ~ /^[ \t]*$/) {
        flush(); reset(); next
      }
    }
    body[++body_n] = line
  }
  END {
    if (in_fence && selected) {
      printf "extract-install-fences: %s:%d: marked install block never closes\n", src, open_line > "/dev/stderr"
      exit 3
    }
    if (count == 0) {
      if (want_case != "")
        printf "extract-install-fences: %s: no install blocks for case \"%s\" (neither `install` nor `install:%s`)\n", src, want_case, want_case > "/dev/stderr"
      else
        printf "extract-install-fences: %s: no install blocks (mark them ```bash install)\n", src > "/dev/stderr"
      exit 2
    }
  }
' "$file"
rc=$?
set -e
exit "$rc"
