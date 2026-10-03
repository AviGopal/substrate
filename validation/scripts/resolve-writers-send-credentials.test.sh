#!/usr/bin/env bash
# resolve-writers-send-credentials.test.sh — a script that writes through a resolve route
# must send a credential on every request it makes to that route.
#
#   bash validation/scripts/resolve-writers-send-credentials.test.sh [repo-root]
#
# WHY. development-vessel authenticates write-type pointers (every `*_write` shape) posted to
# /v2/impulses/resolve and /resolvers/execute against identity-vessel. A writer that sends no
# `Authorization: ApiKey <key>` is answered 401, and a fire-and-forget writer (`|| true`,
# an unchecked fetch) loses its gap, pool impulse or memory note with no visible error: the
# detector fired and nothing is queryable. This lint is the class detector for that defect, so
# a new uncredentialed writer is refused at commit instead of found by a silent gap store.
#
# WHAT IT SCANS. Every *.sh, *.ts (not *.d.ts) and *.mjs under scripts/ and .claude/hooks/,
# node_modules excluded. Compiled *.js siblings under scripts/ are not scanned: no unit, hook or
# script invokes them (the .ts is what runs). validation/scripts is not scanned: its writers are
# hand-run harnesses and this lint's own fixtures live in the temp dir it creates.
#
# THE HEURISTIC (a line scanner, deliberately simple; comment lines are ignored throughout):
#   1. A file is a WRITER when it names a write-type pointer as a quoted string: an identifier
#      ending in `_write` immediately followed by a quote (", ', `, or an escaped \"). A prose
#      mention ("the memoryNote_write resolver") does not make a file a writer.
#   2. In a writer file, a REQUEST SITE is any line naming /v2/impulses/resolve or
#      /resolvers/execute, except a line that only binds the route to a name (`const RESOLVE =
#      …`, `URL="…"`) or names it as a bare path field value (`resolve_endpoint: '/v2/…'` in a
#      registration record); for such a bound name, a line that calls `fetch(NAME` or names `$NAME` /
#      `${NAME}` next to `curl` is a request site instead. A binding whose value is an arrow
#      function (`const resolve = (p) => http("POST", "/v2/impulses/resolve", p)`) is a request
#      site itself: the route rides into a helper there.
#   3. A site is CREDENTIALED when the lines from 3 above to 8 below it carry a caller credential
#      (`ApiKey`, or `Authorization` that is not the database login: `Basic …`/`sqlAuth` go to
#      SurrealDB, not to a vessel), a curl config read from stdin or a file (`-K`, `--config`),
#      or a name the file binds to a credential: a function, const/let/var or shell variable
#      whose definition is within the 15 lines above a credential line (a `headers()` helper, a
#      `HEADERS` object, a `post()` wrapper that sets the header). A binding of a request's
#      result (`const r = await fetch(…)`) is never such a name.
#   Every request site in a writer file must be credentialed — reads included. A line scanner
#   cannot tell a read from a write whose pointer is assembled elsewhere (a wrapper such as
#   emit_gap is called with the payload many lines away), and a credential on a read costs
#   nothing. Known blind spots: a route held in a variable defined in another file, and a
#   request whose credential sits more than 3 lines above or 8 below the route line.
#
# TWO MORE PREDICATES ON THE SAME CLASS (the key has to arrive, and its absence has to be heard):
#   4. KEY ON ARGV — in EVERY scanned file, writer or not: a header option (`-H`/`--header`) whose
#      value is an ApiKey or x-api-key credential expanded from a variable (`-H "Authorization:
#      ApiKey $KEY"`, `-H 'x-api-key: ${K}'`, including inside an `sh -c "…"` string). argv is
#      world-readable in a process listing (ps, /proc/<pid>/cmdline) for as long as curl runs, so
#      a credential there is disclosed to every local user and container co-tenant. The key goes
#      to curl as a config line instead: on stdin (`printf … | curl -K -`) or on a file
#      descriptor (`curl -K <(apikey_cfg "$KEY")`, printf being a builtin). Bearer/JWT and
#      registry tokens are a different credential and are not linted here.
#      validation/scripts/** is scanned for this predicate too (*.sh, *.ts, *.mjs; this file excluded,
#      since its fixtures quote the very lines it refuses): harnesses there run on a schedule
#      (run-weekly-harness) or by hand on a live node, and their argv is as readable as a unit's.
#      Unit files are scanned for this predicate too: every scripts/substrate/units/**/*.service and
#      drop-in *.conf, on its ExecStart=/ExecStartPre=/ExecStartPost=/ExecReload=/ExecStop= lines and
#      their backslash continuations (a unit's command line is a process's argv like any other; `$$K`
#      is systemd's escape for a shell `$K`). Comments and non-Exec lines are not requests.
#   5. SILENT WRITER — in a writer file, a request site whose request discards both its output and
#      its status: a shell request ending `>/dev/null 2>&1 || true` (or `|| :`) on its own line
#      or a continuation line, or a fetch/post chained to `.catch(() => {})` / `() => undefined` /
#      `() => null` before its statement ends. Once the vessel answers 401, such a writer loses
#      its gap or pool impulse with no line anywhere; a writer must at least say so (a journal
#      line naming the HTTP status and what was not written).
#   6. SECRET IN A CURL BODY ON ARGV — in every file predicate 4 scans (scripts/, .claude/hooks/,
#      validation/scripts/ minus this file, and unit Exec lines): a curl data option (-d, --data,
#      --data-raw, --data-binary, --data-urlencode) whose argument expands a variable named like a
#      credential: *SECRET*, *PASSWORD*, *TOKEN* or *_KEY, case-insensitive (`-d "{\"s\":\"$API_KEY_SECRET\"}"`,
#      `--data "$(printf '…' "$X_TOKEN")"`, a unit's `$$PASSWORD`). A request body on argv is as readable
#      in a process listing as a header is (predicate 4). The option may sit on a backslash-continuation
#      line of the curl command; a `[ -d "$KEY_DIR" ]` test with no curl in its command chain is not a
#      request. Build the body with printf (a builtin) and pipe it: `printf '…' "$S" | curl --data-binary @-`.
#      An argument starting with @ (`@-`, `@file`, `@<(printf …)`) reads the body from a file or stdin and
#      is not flagged. Blind spot: a secret first copied into a variable with an unremarkable name.
#   7. EVERY RESOLVE CALL SENDS A CREDENTIAL — writer or not, reads included: a `fetch(` or `curl`
#      to a URL ending in `/resolve` or `/v2/impulses/resolve` (any vessel, discovery included) must
#      send Authorization: an ApiKey header, a curl config on stdin or a file (`-K -`, `-K <(…)`,
#      `--config`), a header read from stdin (`-H @-`), a name the file binds to a credential (as in
#      3), or a headers object spread from a name containing `auth` (`...authHeaders`, `headers:
#      auth`: the caller built it). Every vessel validates its caller against identity-vessel; an
#      unauthenticated call is refused, or served as an anonymous tenant, and a read that silently
#      returns nothing is the same lost signal as a refused write. A request site is a line that
#      names such a URL with `fetch(` or curl (followed by an option or a quoted/expanded word, so a
#      log message that says "curl exit" is not one) on it, on one of the 3 lines above, or on its
#      backslash-continuation chain; or a `fetch(NAME` / curl `$NAME` of a name bound to such a URL.
#      The credential window is predicate 3's (3 above to 8 below), except that a name bound near a
#      credential counts only when the window CALLS it or its name says what it carries (auth, header,
#      hdrs, cred, key): in a large vessel file a bare `body` or `ok` bound near some credential
#      elsewhere is not evidence. In a unit file the window is the request's own Exec line chain.
#      A request that exists to prove the route refuses an unauthenticated caller (it expects 401) is
#      exempt when a comment within the 2 lines above it says `resolve-auth: deliberately
#      unauthenticated`, so the exemption is greppable and reviewed with the line. identity-vessel's
#      `/v1/auth/resolve` is exempt: it is the validation step, its credential is the body.
#      SCOPE: scripts/** and validation/scripts/** (*.sh, *.ts, *.mjs), unit Exec lines, and every
#      vessel's src/** under repos/<vessel>/ (.gitmodules names them). A vessel whose src/ is not
#      checked out is SKIPPED with a logged line, never passed silently. LINT_EXTRA_ROOTS (colon-
#      separated directories, each laid out like this repo: <dir>/repos/<vessel>/src) adds trees, so
#      a vessel's source can be checked from a scratch clone without its submodule. Test files
#      (*.test.*, *.check.sh, test/ and __tests__/ directories), *.d.ts, node_modules and this file
#      (its fixtures quote the very lines it refuses) are not scanned.
#
# CONTROLS. A writer fixture with no credential (fetch, curl, fetch through a bound route name)
# must be flagged at the exact lines; a credentialed fixture in each idiom must pass; a prose-only
# `_write` mention must not make a file a writer. Fixtures carry a placeholder, never a key.
# Prints file:line only — never a header value. Exit 0 = all pass.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
ok()  { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fails=$((fails + 1)); }

SCAN_AWK='
function trim(s) { sub(/^[ \t]+/, "", s); return s }
function iscomment(s) { s = trim(s); return (s ~ /^(#|\/\/|\*|\/\*)/) }
function defname(s,   m) {
  if (match(s, /function[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*\(/)) { m = substr(s, RSTART, RLENGTH); sub(/^function[ \t]+/, "", m); sub(/[ \t]*\($/, "", m); return m }
  if (match(s, /^[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*\(\)[ \t]*\{/)) { m = substr(s, RSTART, RLENGTH); m = trim(m); sub(/[ \t]*\(.*/, "", m); return m }
  if (match(s, /(const|let|var)[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*[=:]/)) { m = substr(s, RSTART, RLENGTH); sub(/^(const|let|var)[ \t]+/, "", m); sub(/[ \t]*[=:]$/, "", m); return m }
  if (match(s, /^[ \t]*(local[ \t]+|export[ \t]+)?[A-Za-z_][A-Za-z0-9_]*=/)) { m = substr(s, RSTART, RLENGTH); m = trim(m); sub(/^(local|export)[ \t]+/, "", m); sub(/=$/, "", m); return m }
  return ""
}
# A caller credential: an ApiKey header, or an Authorization header that is not the database
# login (Basic / sqlAuth go to SurrealDB, not to a vessel).
function credline(s) { return (s ~ /ApiKey/ || (s ~ /Authorization/ && s !~ /Basic|sql[A-Za-z]*Auth/)) }
BEGIN { ROUTE = "/v2/impulses/resolve|/resolvers/execute" }
NR == FNR {
  line[FNR] = $0; n = FNR
  if (iscomment($0)) next
  if ($0 ~ /[A-Za-z][A-Za-z0-9]*_write\\?["\047`]/) writer = 1
  d = ($0 ~ /(fetch\(|curl|await)/) ? "" : defname($0)
  if ($0 ~ ROUTE && d != "" && $0 !~ /=>/) { routeid[d] = 1; routedef[FNR] = 1 }
  if (d != "") defat[FNR] = d
  if (credline($0)) for (k = FNR - 15; k <= FNR; k++) if (k in defat) authid[defat[k]] = 1
  next
}
FNR == 1 { if (!writer) exit }
{
  if (iscomment($0) || routedef[FNR]) next
  site = ($0 ~ ROUTE && $0 !~ /[A-Za-z_]["\047]?[ \t]*:[ \t]*["\047`]\/(v2\/impulses\/resolve|resolvers\/execute)["\047`]/)
  if (!site) for (r in routeid) {
    if ($0 ~ ("fetch\\([ \t]*" r "([^A-Za-z0-9_]|$)")) { site = 1; break }
    if ($0 ~ /curl/ && ($0 ~ ("\\$" r "([^A-Za-z0-9_]|$)") || index($0, "${" r "}"))) { site = 1; break }
  }
  if (!site) next
  cred = 0
  for (i = FNR - 3; i <= FNR + 8 && !cred; i++) {
    if (i < 1 || i > n || iscomment(line[i])) continue
    w = line[i]
    if (credline(w) || w ~ /curl[^|]*[ \t](-K|--config)([ \t=]|$)/) { cred = 1; break }
    k = split(w, tok, /[^A-Za-z0-9_]+/)
    for (j = 1; j <= k; j++) if (tok[j] in authid) { cred = 1; break }
  }
  if (!cred) printf "%s:%d\n", DISPLAY, FNR
}'

scan_file() { # <file> <display-name> -> uncredentialed request sites, one "name:line" per line
  awk -v DISPLAY="$2" "$SCAN_AWK" "$1" "$1"
}
# Predicate 4: a credential expanded from a variable inside a header option, anywhere on a line.
ARGV_AWK='
function trim(s) { sub(/^[ \t]+/, "", s); return s }
{
  if (trim($0) ~ /^(#|\/\/|\*|\/\*)/) next
  if ($0 ~ /(-H|--header)[ \t=]*["\047]?([Aa]uthorization:[ \t]*[Aa]pi[Kk]ey|[Xx]-[Aa][Pp][Ii]-[Kk][Ee][Yy]:)[ \t]*\$/) printf "%s:%d\n", DISPLAY, FNR
}'
scan_argv_file() { # <file> <display-name> -> lines that put a key on curl argv
  awk -v DISPLAY="$2" "$ARGV_AWK" "$1"
}
# Predicate 4 on unit files: only Exec*= lines and their continuations are command lines.
UNIT_ARGV_AWK='
{
  line = $0
  if (line ~ /^[ \t]*[#;]/) { cont = 0; next }
  isexec = (line ~ /^[ \t]*Exec(Start|StartPre|StartPost|Reload|Stop|StopPost|Condition)=/)
  if (isexec || cont) {
    if (line ~ /(-H|--header)[ \t=]*["\047]?([Aa]uthorization:[ \t]*[Aa]pi[Kk]ey|[Xx]-[Aa][Pp][Ii]-[Kk][Ee][Yy]:)[ \t]*\$/) printf "%s:%d\n", DISPLAY, FNR
    cont = (line ~ /\\[ \t]*$/)
  } else cont = 0
}'
scan_unit_argv_file() { # <unit-file> <display-name> -> Exec lines that put a key on argv
  awk -v DISPLAY="$2" "$UNIT_ARGV_AWK" "$1"
}
# Predicate 5: a request site in a writer file whose request swallows both output and status.
SILENT_AWK='
function trim(s) { sub(/^[ \t]+/, "", s); return s }
function iscomment(s) { s = trim(s); return (s ~ /^(#|\/\/|\*|\/\*)/) }
BEGIN { ROUTE = "/v2/impulses/resolve|/resolvers/execute" }
NR == FNR { line[FNR] = $0; n = FNR; if (!iscomment($0) && $0 ~ /[A-Za-z][A-Za-z0-9]*_write\\?["\047`]/) writer = 1; next }
FNR == 1 { if (!writer) exit }
{
  if (iscomment($0) || $0 !~ ROUTE) next
  sh = (DISPLAY ~ /\.sh$/)
  for (i = FNR; i <= FNR + 15 && i <= n; i++) {
    w = line[i]
    if (w ~ />[ \t]*\/dev\/null[ \t]+2>&1[ \t]*\|\|[ \t]*(true|:)/ || w ~ /\.catch\([ \t]*(async[ \t]*)?\([ \t]*[A-Za-z_]*[ \t]*\)[ \t]*=>[ \t]*(undefined|null|\{[ \t]*\}|void 0)[ \t]*\)/) { printf "%s:%d\n", DISPLAY, FNR; break }
    if (sh && w !~ /\\[ \t]*$/) break
    if (!sh && w ~ /;[ \t]*$/) break
  }
}'
scan_silent_file() { # <file> <display-name> -> request sites in a writer that swallow output and status
  awk -v DISPLAY="$2" "$SILENT_AWK" "$1" "$1"
}
scanned_files() { # <root> -> every scanned file under scripts/ and .claude/hooks/
  local r="$1"
  for d in "$r/scripts" "$r/.claude/hooks"; do
    [ -d "$d" ] || continue
    find "$d" -type f \( -name '*.sh' -o -name '*.ts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -path '*/node_modules/*' -print
  done | LC_ALL=C sort
}
scan_tree() { # <root> -> every uncredentialed request site under scripts/ and .claude/hooks/
  local r="$1" f
  scanned_files "$r" | while IFS= read -r f; do scan_file "$f" "${f#"$r"/}"; done
}
scan_tree_argv() { # <root> -> every key on curl argv under scripts/, .claude/hooks/ and the unit files
  local r="$1" f
  scanned_files "$r" | while IFS= read -r f; do scan_argv_file "$f" "${f#"$r"/}"; done
  if [ -d "$r/validation/scripts" ]; then
    find "$r/validation/scripts" -type f \( -name '*.sh' -o -name '*.ts' -o -name '*.mjs' \) -not -name '*.d.ts' \
      -not -name 'resolve-writers-send-credentials.test.sh' -not -path '*/node_modules/*' -print | LC_ALL=C sort \
      | while IFS= read -r f; do scan_argv_file "$f" "${f#"$r"/}"; done
  fi
  [ -d "$r/scripts/substrate/units" ] || return 0
  find "$r/scripts/substrate/units" -type f \( -name '*.service' -o -name '*.conf' \) -print | LC_ALL=C sort \
    | while IFS= read -r f; do scan_unit_argv_file "$f" "${f#"$r"/}"; done
}
# Predicate 6: a curl data option whose argument expands a credential-named variable. A line is in
# a curl command when any line of its backslash-continuation chain names curl. UNIT=1 limits the scan
# to Exec*= lines and their continuations (a unit's `$$X` is a shell `$X`).
BODY_AWK='
function trim(s) { sub(/^[ \t]+/, "", s); return s }
function iscomment(s) { s = trim(s); if (UNIT) return (s ~ /^[#;]/); return (s ~ /^(#|\/\/|\*|\/\*)/) }
function contd(s) { return (s ~ /\\[ \t]*$/) }
function argof(s,   c, q, i, d, out) { # the option argument at the start of s
  c = substr(s, 1, 1)
  if (c == "\"" || c == "\047") {
    q = c; d = 0; out = c
    for (i = 2; i <= length(s); i++) {
      c = substr(s, i, 1); out = out c
      if (q == "\"" && c == "\\") { i++; out = out substr(s, i, 1); continue }
      if (q == "\"" && c == "$" && substr(s, i + 1, 1) == "(") { d++; continue }
      if (q == "\"" && c == ")" && d > 0) { d--; continue }
      if (c == q && d == 0) break
    }
    return out
  }
  match(s, /^[^ \t]*/); return substr(s, 1, RLENGTH)
}
function secretvar(a,   v) {
  while (match(a, /\$\$?\{?[A-Za-z_][A-Za-z0-9_]*/)) {
    v = tolower(substr(a, RSTART, RLENGTH)); a = substr(a, RSTART + RLENGTH)
    gsub(/[^a-z0-9_]/, "", v)
    if (v ~ /secret|password|token|_key$/) return 1
  }
  return 0
}
function bodyhit(s,   rest, a) {
  rest = s
  while (match(rest, /(^|[ \t"\047])(-d|--data|--data-raw|--data-binary|--data-urlencode)([ \t]+|=)/)) {
    rest = substr(rest, RSTART + RLENGTH)
    a = argof(rest)
    if (substr(a, 1, 1) != "@" && substr(a, 2, 1) != "@" && secretvar(a)) return 1
  }
  return 0
}
{ line[NR] = $0; n = NR }
END {
  inexec = 0
  for (i = 1; i <= n; i++) {
    w = line[i]
    start = !(i > 1 && contd(line[i - 1]))
    if (start) {
      chain = 0; inexec = (!UNIT || w ~ /^[ \t]*Exec(Start|StartPre|StartPost|Reload|Stop|StopPost|Condition)=/)
      for (j = i; j <= n; j++) { if (!iscomment(line[j]) && line[j] ~ /curl/) chain = 1; if (!contd(line[j])) break }
    }
    if (!inexec || !chain || iscomment(w)) continue
    if (bodyhit(w)) printf "%s:%d\n", DISPLAY, i
  }
}'
scan_body_file() { # <file> <display-name> [unit] -> lines that put a credential-named variable in a curl body on argv
  awk -v DISPLAY="$2" -v UNIT="${3:-0}" "$BODY_AWK" "$1"
}
scan_tree_silent() { # <root> -> every silent writer request under scripts/ and .claude/hooks/
  local r="$1" f
  scanned_files "$r" | while IFS= read -r f; do scan_silent_file "$f" "${f#"$r"/}"; done
}

scan_tree_body() { # <root> -> every curl body on argv carrying a credential-named variable (predicate 4's scope)
  local r="$1" f
  scanned_files "$r" | while IFS= read -r f; do scan_body_file "$f" "${f#"$r"/}"; done
  if [ -d "$r/validation/scripts" ]; then
    find "$r/validation/scripts" -type f \( -name '*.sh' -o -name '*.ts' -o -name '*.mjs' \) -not -name '*.d.ts' \
      -not -name 'resolve-writers-send-credentials.test.sh' -not -path '*/node_modules/*' -print | LC_ALL=C sort \
      | while IFS= read -r f; do scan_body_file "$f" "${f#"$r"/}"; done
  fi
  [ -d "$r/scripts/substrate/units" ] || return 0
  find "$r/scripts/substrate/units" -type f \( -name '*.service' -o -name '*.conf' \) -print | LC_ALL=C sort \
    | while IFS= read -r f; do scan_body_file "$f" "${f#"$r"/}" 1; done
}

# Predicate 7: every request to a resolve route carries a credential (no writer gate). UNIT=1 limits
# the scan to Exec*= lines and their continuations.
ANY_RESOLVE_AWK='
function trim(s) { sub(/^[ \t]+/, "", s); return s }
function iscomment(s) { s = trim(s); if (UNIT) return (s ~ /^[#;]/); return (s ~ /^(#|\/\/|\*|\/\*)/) }
function defname(s,   m) {
  if (match(s, /function[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*\(/)) { m = substr(s, RSTART, RLENGTH); sub(/^function[ \t]+/, "", m); sub(/[ \t]*\($/, "", m); return m }
  if (match(s, /^[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*\(\)[ \t]*\{/)) { m = substr(s, RSTART, RLENGTH); m = trim(m); sub(/[ \t]*\(.*/, "", m); return m }
  if (match(s, /(const|let|var)[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*[=:]/)) { m = substr(s, RSTART, RLENGTH); sub(/^(const|let|var)[ \t]+/, "", m); sub(/[ \t]*[=:]$/, "", m); return m }
  if (match(s, /^[ \t]*(local[ \t]+|export[ \t]+)?[A-Za-z_][A-Za-z0-9_]*=/)) { m = substr(s, RSTART, RLENGTH); m = trim(m); sub(/^(local|export)[ \t]+/, "", m); sub(/=$/, "", m); return m }
  return ""
}
function credline(s) { return (s ~ /ApiKey/ || (s ~ /Authorization/ && s !~ /Basic|sql[A-Za-z]*Auth/)) }
function isroute(s) { return (s ~ /\/(v2\/impulses\/)?resolve(["\047`\\ \t]|$)/ && s !~ /\/auth\/resolve(["\047`\\ \t]|$)/) }
function transport(s) { return (s ~ /fetch\(/ || s ~ /(^|[^A-Za-z0-9_.-])curl[ \t]+[-"\047$]/ || s ~ /["\047]curl["\047]/) }
function contd(s) { return (s ~ /\\[ \t]*$/) }
{ line[NR] = $0; n = NR }
END {
  inexec = 0
  for (i = 1; i <= n; i++) {
    w = line[i]
    if (!(i > 1 && contd(line[i - 1]))) cs = i
    chain[i] = cs
    if (UNIT) {
      if (cs == i) inexec = (w ~ /^[ \t]*Exec(Start|StartPre|StartPost|Reload|Stop|StopPost|Condition)=/)
      ex[i] = inexec
    } else ex[i] = 1
    if (iscomment(w)) continue
    d = (transport(w) || w ~ /await/) ? "" : defname(w)
    if (isroute(w) && d != "" && w !~ /=>/) { routeid[d] = 1; routedef[i] = 1 }
    if (d != "") defat[i] = d
    if (credline(w)) for (k = i - 15; k <= i; k++) if (k in defat) authid[defat[k]] = 1
  }
  for (i = 1; i <= n; i++) {
    w = line[i]
    if (!ex[i] || iscomment(w) || routedef[i]) continue
    site = 0
    if (isroute(w) && w !~ /[A-Za-z_]["\047]?[ \t]*:[ \t]*["\047`]\/(v2\/impulses\/)?resolve["\047`]/) {
      for (k = i - 3; k <= i && !site; k++) if (k >= 1 && ex[k] && !iscomment(line[k]) && transport(line[k])) site = 1
      for (k = i; !site && k > 1 && contd(line[k - 1]); k--) if (transport(line[k - 1])) site = 1
    }
    if (!site) for (r in routeid) {
      if (w ~ ("fetch\\([ \t]*" r "([^A-Za-z0-9_]|$)")) { site = 1; break }
      if (w ~ /curl/ && (w ~ ("\\$" r "([^A-Za-z0-9_]|$)") || index(w, "${" r "}"))) { site = 1; break }
    }
    if (!site) continue
    # A deliberate unauthenticated probe (a test that the route answers 401) says so within 2 lines above.
    allow = 0
    for (k = i - 2; k <= i; k++) if (k >= 1 && line[k] ~ /resolve-auth: deliberately unauthenticated/) allow = 1
    if (allow) continue
    cred = 0
    for (k = i - 3; k <= i + 8 && !cred; k++) {
      if (k < 1 || k > n || !ex[k] || iscomment(line[k])) continue
      if (UNIT && chain[k] != chain[i]) continue # a unit request is credentialed on its own Exec line
      v = line[k]
      if (credline(v) || v ~ /curl[^|]*[ \t](-K|--config)([ \t=]|$)/ || v ~ /(-H|--header)[ \t]+@-/ \
          || v ~ /\.\.\.[ \t]*[A-Za-z_]*[Aa]uth[A-Za-z0-9_]*/ || v ~ /headers[ \t]*:[ \t]*[A-Za-z_]*[Aa]uth[A-Za-z0-9_]*[ \t]*[,})]/) { cred = 1; break }
      # A credential-bound name counts when it is CALLED here (a headers()/post() helper) or is named
      # for what it carries; a bare token such as body / ok / pointer that happens to be bound near some
      # credential elsewhere in a large file is not evidence.
      m = split(v, tok, /[^A-Za-z0-9_]+/)
      for (j = 1; j <= m; j++) if (tok[j] in authid && (tolower(tok[j]) ~ /auth|header|hdrs?$|cred|key/ || v ~ ("(^|[^A-Za-z0-9_])" tok[j] "[ \t]*\\("))) { cred = 1; break }
    }
    if (!cred) printf "%s:%d\n", DISPLAY, i
  }
}'
scan_any_resolve_file() { # <file> <display-name> [unit] -> resolve-route requests with no credential
  awk -v DISPLAY="$2" -v UNIT="${3:-0}" "$ANY_RESOLVE_AWK" "$1"
}
p7_files() { # <dir> -> scannable non-test source files under it
  find "$1" -type f \( -name '*.sh' -o -name '*.ts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.test.*' \
    -not -name '*.check.sh' -not -name 'resolve-writers-send-credentials.test.sh' \
    -not -path '*/node_modules/*' -not -path '*/test/*' -not -path '*/tests/*' -not -path '*/__tests__/*' -print | LC_ALL=C sort
}
p7_vessel_trees() { # <root> -> every vessel src/ under <root>/repos (gitmodules + present dirs); SKIP lines on fd 3
  local r="$1" v
  {
    [ -f "$r/.gitmodules" ] && sed -n 's/^[ \t]*path[ \t]*=[ \t]*\(repos\/[^ \t]*\)[ \t]*$/\1/p' "$r/.gitmodules"
    for v in "$r"/repos/*/; do [ -d "$v" ] && echo "repos/$(basename "$v")"; done
  } | LC_ALL=C sort -u | while IFS= read -r v; do
    if [ -n "$(find "$r/$v/src" -type f 2>/dev/null | head -1)" ]; then echo "$v/src"
    else echo "SKIP $v/src (not checked out)" >&3; fi
  done
}
scan_tree_any_resolve() { # <root> -> every uncredentialed resolve-route request in predicate 7's scope
  local r="$1" f d
  for d in "$r/scripts" "$r/validation/scripts"; do
    [ -d "$d" ] && p7_files "$d" | while IFS= read -r f; do scan_any_resolve_file "$f" "${f#"$r"/}"; done
  done
  if [ -d "$r/scripts/substrate/units" ]; then
    find "$r/scripts/substrate/units" -type f \( -name '*.service' -o -name '*.conf' \) -print | LC_ALL=C sort \
      | while IFS= read -r f; do scan_any_resolve_file "$f" "${f#"$r"/}" 1; done
  fi
  p7_vessel_trees "$r" | while IFS= read -r d; do
    p7_files "$r/$d" | while IFS= read -r f; do scan_any_resolve_file "$f" "${f#"$r"/}"; done
  done
}

echo "== resolve-writers-send-credentials ($ROOT)"

# ── controls ────────────────────────────────────────────────────────────────────
F="$T/fx"; mkdir -p "$F"
cat > "$F/neg.ts" <<'EOF'
const DEV = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const RESOLVE = DEV + "/v2/impulses/resolve";
async function fileGap(gap: unknown) {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ impulse: { pointer: { type: "substrateGap_write", gap } } }),
  });
}
async function seed(body: unknown) {
  await fetch(RESOLVE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function sql(q: string) {
  const r = await fetch(`${SURREAL}/sql`, { method: "POST", headers: { Authorization: `Basic ${LOGIN}` }, body: q });
  return r.json();
}
async function fileAgain(gap: unknown) {
  const r = await fetch(`${DEV}/v2/impulses/resolve`, { method: "POST", body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }) });
}
EOF
cat > "$F/neg.sh" <<'EOF'
#!/usr/bin/env bash
emit_gap() {
  curl -s --max-time 8 -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$1" || true
}
emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"x\"}}}}"
EOF
cat > "$F/pos.ts" <<'EOF'
const KEY = process.env.METABOB_API_KEY ?? "";
const DEV = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const RESOLVE = DEV + "/v2/impulses/resolve";
function hdrs(): Record<string, string> {
  return { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) };
}
async function fileGap(gap: unknown) {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
    body: JSON.stringify({ impulse: { pointer: { type: "substrateGap_write", gap } } }),
  });
}
async function seed(body: unknown) {
  await fetch(RESOLVE, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}
EOF
cat > "$F/pos.sh" <<'EOF'
#!/usr/bin/env bash
emit_gap() {
  { if [ -n "${METABOB_API_KEY:-}" ]; then printf 'header = "Authorization: ApiKey %s"\n' "$METABOB_API_KEY"; fi; } \
    | curl -K - -s --max-time 8 -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$1" || true
}
emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"x\"}}}}"
EOF
cat > "$F/prose.sh" <<'EOF'
#!/usr/bin/env bash
# reads gaps; the memoryNote_write resolver is someone else's concern
curl -s -X POST "$DEV_VESSEL/v2/impulses/resolve" -d '{"impulse":{"pointer":{"type":"substrateGap"}}}'
EOF

got="$(scan_file "$F/neg.ts" neg.ts | tr '\n' ' ')"
[ "$got" = "neg.ts:4 neg.ts:11 neg.ts:18 " ] \
  && ok "negative control (ts): an uncredentialed fetch, a fetch through a bound route name, and a fetch whose only nearby credential is a database login are flagged (neg.ts:4, :11, :18)" \
  || bad "negative control (ts): expected 'neg.ts:4 neg.ts:11 neg.ts:18', got '${got}'"
got="$(scan_file "$F/neg.sh" neg.sh | tr '\n' ' ')"
[ "$got" = "neg.sh:3 " ] && ok "negative control (sh): an uncredentialed curl inside an emit_gap wrapper is flagged (neg.sh:3)" \
  || bad "negative control (sh): expected 'neg.sh:3', got '${got}'"
got="$(scan_file "$F/pos.ts" pos.ts)"
[ -z "$got" ] && ok "positive control (ts): inline header and a header helper pass" || bad "positive control (ts) flagged: $(echo $got)"
got="$(scan_file "$F/pos.sh" pos.sh)"
[ -z "$got" ] && ok "positive control (sh): a header piped to curl -K - passes" || bad "positive control (sh) flagged: $(echo $got)"
got="$(scan_file "$F/prose.sh" prose.sh)"
[ -z "$got" ] && ok "a prose-only *_write mention does not make a file a writer" || bad "prose-only mention made a writer: $(echo $got)"

cat > "$F/argv.sh" <<'EOF'
#!/usr/bin/env bash
curl -s -X POST "$DEV/v2/impulses/resolve" -H "Authorization: ApiKey $METABOB_API_KEY" -d "$1"
curl -s -X POST "$DEV/v2/impulses/resolve" \
  -H 'Content-Type: application/json' -H "Authorization: ApiKey ${KEY:-}" -d "$1"
eng exec "$C" sh -c "curl -s http://127.0.0.1:8210/run-goal -H 'Authorization: ApiKey $client_key' -d '{}'"
curl -s "$HUB/resolve" --header "x-api-key: $KEY" -d "$1"
# a comment that quotes -H "Authorization: ApiKey $KEY" is not a request
EOF
cat > "$F/keyfd.sh" <<'EOF'
#!/usr/bin/env bash
apikey_cfg() { [ -n "${1:-}" ] && printf 'header = "Authorization: ApiKey %s"\n' "$1"; return 0; }
curl -s -X POST "$DEV/v2/impulses/resolve" -K <(apikey_cfg "$METABOB_API_KEY") -d "$1"
apikey_cfg "$KEY" | eng exec -i "$C" curl -K - -s http://127.0.0.1:8210/run-goal -d '{}'
curl -s "$REGISTRY/v2/x/manifests/y" -H "Authorization: Bearer $tok"
EOF
cat > "$F/silent.sh" <<'EOF'
#!/usr/bin/env bash
emit_gap() {
  srv_auth | curl -K - -s -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$1" >/dev/null 2>&1 || true
}
emit_gap2() {
  srv_auth | curl -K - -s -X POST "$DEV_VESSEL/v2/impulses/resolve" \
    -d "$1" >/dev/null 2>&1 || :
}
emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\"}}}"
EOF
cat > "$F/silent.ts" <<'EOF'
const KEY = process.env.METABOB_API_KEY ?? "";
async function emitGap(gap: unknown) {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
    body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }),
  }).catch(() => undefined);
}
async function report(body: unknown) {
  await post(`${DEV}/v2/impulses/resolve`, { impulse: { type: "poolImpulse_write", body } }, 5000).catch(() => {})
}
EOF
cat > "$F/loud.sh" <<'EOF'
#!/usr/bin/env bash
emit_gap() {
  local out code
  out="$(srv_auth | curl -K - -s -w '\n%{http_code}' -X POST "$DEV_VESSEL/v2/impulses/resolve" -d "$1" 2>/dev/null || printf '\n000')"
  code="${out##*$'\n'}"
  case "$code" in 2*) ;; *) echo "emit_gap FAILED http=$code" >&2 ;; esac
}
read_lease() { srv_auth | curl -K - -s -X POST "$DEV_VESSEL/v2/impulses/resolve" -d '{}' > "$st" 2>/dev/null || true; }
emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\"}}}"
EOF
cat > "$F/loud.ts" <<'EOF'
const KEY = process.env.METABOB_API_KEY ?? "";
async function emitGap(id: string, gap: unknown) {
  try {
    const r = await fetch(`${DEV}/v2/impulses/resolve`, {
      method: "POST",
      headers: { ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
      body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }),
    });
    if (!r.ok) console.error(`gap ${id} NOT filed: http=${r.status}`);
  } catch (e) {
    console.error(`gap ${id} NOT filed: ${String(e)}`);
  }
}
EOF

got="$(scan_argv_file "$F/argv.sh" argv.sh | tr '\n' ' ')"
[ "$got" = "argv.sh:2 argv.sh:4 argv.sh:5 argv.sh:6 " ] \
  && ok "negative control (argv): a key in -H (double- and single-quoted, inside sh -c, x-api-key, --header) is flagged (argv.sh:2, :4, :5, :6); a comment is not" \
  || bad "negative control (argv): expected 'argv.sh:2 argv.sh:4 argv.sh:5 argv.sh:6', got '${got}'"
got="$(scan_argv_file "$F/keyfd.sh" keyfd.sh)"
[ -z "$got" ] && ok "positive control (argv): a key on curl -K <(…) or on stdin to curl -K - passes; a Bearer token is out of scope" \
  || bad "positive control (argv) flagged: $(echo $got)"
got="$(scan_argv_file "$F/pos.sh" pos.sh)"
[ -z "$got" ] && ok "positive control (argv): the printf | curl -K - writer passes" || bad "positive control (argv) flagged pos.sh: $(echo $got)"
cat > "$F/argv.service" <<'EOF'
[Service]
# ExecStart=/bin/bash -c 'curl -H "Authorization: ApiKey $$K" x' is a comment, not a request
Description=not a request: -H "Authorization: ApiKey $$K"
ExecStartPre=/bin/bash -c 'K=$$(cat /k); curl -s -H "Authorization: ApiKey $$K" "${E}/health"'
ExecStart=/usr/bin/env bash -c 'curl -s \
  -H "Authorization: ApiKey $${METABOB_API_KEY}" "${E}/x"'
ExecStartPost=/bin/bash -c 'K=$$(cat /k); printf "Authorization: ApiKey %%s" "$$K" | curl -s -H @- "${E}/x"'
ExecReload=/bin/bash -c 'printf "header = \"Authorization: ApiKey %%s\"" "$$K" | curl -K - "${E}/x"'
EOF
got="$(scan_unit_argv_file "$F/argv.service" argv.service | tr '\n' ' ')"
[ "$got" = "argv.service:4 argv.service:6 " ] \
  && ok "unit files (argv): a key in -H on an ExecStartPre= line and on an ExecStart= continuation is flagged (argv.service:4, :6); a comment, a non-Exec line, -H @- and -K - are not" \
  || bad "unit files (argv): expected 'argv.service:4 argv.service:6', got '${got}'"
got="$(scan_silent_file "$F/silent.sh" silent.sh | tr '\n' ' ')"
[ "$got" = "silent.sh:3 silent.sh:6 " ] \
  && ok "negative control (silent, sh): a writer request ending >/dev/null 2>&1 || true (same line, continuation line) is flagged (silent.sh:3, :6)" \
  || bad "negative control (silent, sh): expected 'silent.sh:3 silent.sh:6', got '${got}'"
got="$(scan_silent_file "$F/silent.ts" silent.ts | tr '\n' ' ')"
[ "$got" = "silent.ts:3 silent.ts:10 " ] \
  && ok "negative control (silent, ts): a writer fetch/post chained to .catch(() => undefined|{}) is flagged (silent.ts:3, :10)" \
  || bad "negative control (silent, ts): expected 'silent.ts:3 silent.ts:10', got '${got}'"
got="$(scan_silent_file "$F/loud.sh" loud.sh)$(scan_silent_file "$F/loud.ts" loud.ts)"
[ -z "$got" ] && ok "positive control (silent): a writer that logs its status passes, and a read whose output goes to a file is not silent" \
  || bad "positive control (silent) flagged: $(echo $got)"

cat > "$F/body.sh" <<'EOF'
#!/usr/bin/env bash
curl -s -X POST "$ID/v1/x" -d "{\"s\":\"$API_KEY_SECRET\"}"
resp=$(curl -s "$ID/v1/y" -H "Content-Type: application/json" \
         -K <(apikey_cfg "$K") \
         --data "{\"api_key\":\"${metabob_api_key}\"}")
curl -s "$ID/v1/z" --data-raw "$(printf '{"t":"%s"}' "$X_TOKEN")"
curl -s "$ID/v1/w" --data-urlencode "password=$DB_PASSWORD"
# a comment that quotes curl -d "{\"s\":\"$API_KEY_SECRET\"}" is not a request
EOF
cat > "$F/bodyok.sh" <<'EOF'
#!/usr/bin/env bash
printf '{"s":"%s"}' "$API_KEY_SECRET" | curl -s -X POST "$ID/v1/x" --data @-
curl -s "$ID/v1/x" --data-binary @"$BODY_FILE_KEY"
curl -s "$ID/v1/x" --data-binary @body.json
curl -s "$ID/v1/x" --data-binary @<(printf '{"s":"%s"}' "$API_KEY_SECRET")
curl -s "$ID/v1/x" -d "$BODY" -d "{\"id\":\"$key_id\",\"n\":\"$NAME\"}"
[ -d "$PULLSYNC_GLUE_KEY_DIR" ] && [ -d "$SECRET_DIR" ] && echo present
EOF
cat > "$F/body.service" <<'EOF'
[Service]
# ExecStart=/bin/bash -c 'curl -d "p=$$DB_PASSWORD" x' is a comment, not a request
Description=not a request: curl -d "p=$$DB_PASSWORD"
ExecStartPre=/bin/bash -c 'curl -s -d "p=$$DB_PASSWORD" "${E}/x"'
ExecStart=/usr/bin/env bash -c 'curl -s \
  --data "{\"t\":\"$${SVC_TOKEN}\"}" "${E}/x"'
ExecStartPost=/bin/bash -c 'printf "p=%%s" "$$DB_PASSWORD" | curl -s --data-binary @- "${E}/x"'
EOF
got="$(scan_body_file "$F/body.sh" body.sh | tr '\n' ' ')"
[ "$got" = "body.sh:2 body.sh:5 body.sh:6 body.sh:7 " ] \
  && ok "negative control (body): a credential-named variable in -d (same line), --data (continuation line), --data-raw \$(printf …) and --data-urlencode is flagged (body.sh:2, :5, :6, :7); a comment is not" \
  || bad "negative control (body): expected 'body.sh:2 body.sh:5 body.sh:6 body.sh:7', got '${got}'"
got="$(scan_body_file "$F/bodyok.sh" bodyok.sh)"
[ -z "$got" ] && ok "positive control (body): printf | curl --data @-, --data-binary @file / @<(…), a non-secret variable and a [ -d \"\$KEY_DIR\" ] test pass" \
  || bad "positive control (body) flagged: $(echo $got)"
got="$(scan_body_file "$F/body.service" body.service 1 | tr '\n' ' ')"
[ "$got" = "body.service:4 body.service:6 " ] \
  && ok "unit files (body): \$\$PASSWORD on an ExecStartPre= line and \$\${TOKEN} on an ExecStart= continuation are flagged (body.service:4, :6); a comment, a non-Exec line and --data-binary @- are not" \
  || bad "unit files (body): expected 'body.service:4 body.service:6', got '${got}'"

# predicate 7 controls (file names are p7-* so they never collide with another predicate's fixtures)
cat > "$F/p7-neg.ts" <<'EOF'
const DISCOVERY = process.env.DISCOVERY_ENDPOINT ?? "http://127.0.0.1:8100";
const RESOLVE_URL = `${DISCOVERY}/resolve`;
async function shapeOwner(shape: string) {
  const r = await fetch(`${DISCOVERY}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }) });
  return r.json();
}
async function viaName() {
  return fetch(RESOLVE_URL, { method: "POST", body: "{}" });
}
async function gaps() {
  const r = await fetch(
    `${DEV}/v2/impulses/resolve`,
    { method: "POST", body: JSON.stringify({ impulse: { type: "substrateGap" } }) },
  );
}
EOF
cat > "$F/p7-neg.sh" <<'EOF'
#!/usr/bin/env bash
curl -s -X POST "$DISCOVERY/resolve" -H 'Content-Type: application/json' -d '{"pointer":{"type":"vesselRegistry"}}'
out="$(curl -s --max-time 4 -X POST \
  "$DEV/v2/impulses/resolve" -d '{}')"
EOF
cat > "$F/p7-pos.ts" <<'EOF'
const KEY = process.env.METABOB_API_KEY ?? "";
async function a() { await fetch(`${DISCOVERY}/resolve`, { method: "POST", headers: { Authorization: `ApiKey ${KEY}` } }); }
async function b(endpoint: string, authHeaders: Record<string, string>) {
  await fetch(`${endpoint}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
  });
}
async function c(obsidian: string, auth: Record<string, string>) { await fetch(`${obsidian}/resolve`, { method: "POST", headers: auth }); }
async function d(base: string) { await fetch(`${base}/v1/auth/resolve`, { method: "POST", body: "{}" }); }
async function e() { await fetch(`${DISCOVERY}/v1/resolve-url?shape=x`); }
const field = { resolve_endpoint: "/v2/impulses/resolve" };
// resolve-auth: deliberately unauthenticated (expects 401)
async function f() { return fetch(`${DEV}/v2/impulses/resolve`, { method: "POST", body: "{}" }); }
const HEADERS = { "Content-Type": "application/json", Authorization: `ApiKey ${KEY}` };
async function g() { await fetch(`${DEV}/v2/impulses/resolve`, { method: "POST", headers: HEADERS }); }
EOF
cat > "$F/p7-pos.sh" <<'EOF'
#!/usr/bin/env bash
srv_auth | curl -K - -s -X POST "$DISCOVERY/resolve" -d '{}'
printf 'Authorization: ApiKey %s' "$K" | curl -s -H @- -X POST "$DEV/v2/impulses/resolve" -d '{}'
echo "FAIL: could not read ${ENDPOINT}/v2/impulses/resolve (curl exit ${RC})" >&2
# curl -s "$DISCOVERY/resolve"  (a comment is not a request)
EOF
cat > "$F/p7.service" <<'EOF'
[Service]
Description=not a request: curl "$${E}/resolve"
ExecStartPre=/bin/bash -c 'curl -s -X POST "$${DISCOVERY}/resolve" -d "{}"'
ExecStart=/bin/bash -c 'srv_auth | curl -K - -s -X POST "$${DISCOVERY}/resolve" -d "{}"'
EOF
got="$(scan_any_resolve_file "$F/p7-neg.ts" p7-neg.ts | tr '\n' ' ')"
[ "$got" = "p7-neg.ts:4 p7-neg.ts:8 p7-neg.ts:12 " ] \
  && ok "negative control (P7, ts): a discovery /resolve read, a fetch through a bound route name and a multi-line fetch with no credential are flagged (p7-neg.ts:4, :8, :12)" \
  || bad "negative control (P7, ts): expected 'p7-neg.ts:4 p7-neg.ts:8 p7-neg.ts:12', got '${got}'"
got="$(scan_any_resolve_file "$F/p7-neg.sh" p7-neg.sh | tr '\n' ' ')"
[ "$got" = "p7-neg.sh:2 p7-neg.sh:4 " ] \
  && ok "negative control (P7, sh): a curl read with no credential, on its own line and on a continuation line, is flagged (p7-neg.sh:2, :4)" \
  || bad "negative control (P7, sh): expected 'p7-neg.sh:2 p7-neg.sh:4', got '${got}'"
got="$(scan_any_resolve_file "$F/p7-pos.ts" p7-pos.ts)$(scan_any_resolve_file "$F/p7-pos.sh" p7-pos.sh)"
[ -z "$got" ] && ok "positive control (P7): an ApiKey header, a spread authHeaders / headers: auth, curl -K - and -H @- pass; /v1/auth/resolve, /v1/resolve-url, a resolve_endpoint field, a log line and a comment are not requests; a marked 401 probe is exempt; a HEADERS object bound to a credential passes" \
  || bad "positive control (P7) flagged: $(echo $got)"
got="$(scan_any_resolve_file "$F/p7.service" p7.service 1 | tr '\n' ' ')"
[ "$got" = "p7.service:3 " ] \
  && ok "unit files (P7): an Exec line's uncredentialed curl to a resolve route is flagged (p7.service:3); a non-Exec line and curl -K - are not" \
  || bad "unit files (P7): expected 'p7.service:3', got '${got}'"
# A vessel's src/ through LINT_EXTRA_ROOTS: goal-host-vessel src/index.ts landedShaForGoal, verbatim
# (lines 27-50 at the time this control was written: the discovery fetch at :32 sends only Content-Type).
X="$T/p7-root"; mkdir -p "$X/repos/goal-host-vessel/src" "$X/repos/goal-host-vessel/test" "$X/repos/absent-vessel"
printf 'path = repos/absent-vessel\n' > "$X/.gitmodules"
{ for _ in $(seq 1 27); do echo "// line"; done; cat <<'EOF'
const FED_SUBSTRATE_ID = process.env.FED_SUBSTRATE_ID ?? 'local';

async function landedShaForGoal(goal: string): Promise<string | null> {
  try {
    const response = await fetch(`${Config.discoveryEndpoint}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pointer: { type: 'goal_path_sha', goal },
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.warn(`Failed to resolve SHA for goal '${goal.slice(0, 50)}...': ${response.status} ${response.statusText}`);
      return null;
    }
    const json = await response.json();
    return json?.content?.sha ?? null;
  } catch (e) {
    console.error(`Error resolving SHA for goal '${goal.slice(0, 50)}...': ${e}`);
    return null;
  }
}
EOF
} > "$X/repos/goal-host-vessel/src/index.ts"
cp "$X/repos/goal-host-vessel/src/index.ts" "$X/repos/goal-host-vessel/test/index.test.ts"
got="$(scan_tree_any_resolve "$X" 3>"$T/p7-skips" | tr '\n' ' ')"
[ "$got" = "repos/goal-host-vessel/src/index.ts:32 " ] \
  && ok "vessel src (P7): goal-host-vessel's uncredentialed discovery fetch is flagged at src/index.ts:32; its test/ copy is not scanned" \
  || bad "vessel src (P7): expected 'repos/goal-host-vessel/src/index.ts:32', got '${got}'"
grep -qx 'SKIP repos/absent-vessel/src (not checked out)' "$T/p7-skips" \
  && ok "vessel src (P7): a vessel whose src/ is not checked out is reported as SKIP, not passed silently" \
  || bad "vessel src (P7): no SKIP line for an absent vessel src/ (got: $(tr '\n' ' ' < "$T/p7-skips"))"

# ── the tree ────────────────────────────────────────────────────────────────────
hits="$(scan_tree "$ROOT")"
if [ -z "$hits" ]; then
  ok "every resolve-route request in a writer script under scripts/ and .claude/hooks/ sends a credential"
else
  while IFS= read -r h; do bad "$h: resolve-route request in a *_write writer sends no Authorization"; done <<< "$hits"
fi

hits="$(scan_tree_argv "$ROOT")"
if [ -z "$hits" ]; then
  ok "no script under scripts/, .claude/hooks/ or validation/scripts/, and no unit Exec line, puts an ApiKey/x-api-key on curl argv"
else
  while IFS= read -r h; do bad "$h: a key on curl argv (readable in any process listing); send it with curl -K - or -K <(…)"; done <<< "$hits"
fi
hits="$(scan_tree_silent "$ROOT")"
if [ -z "$hits" ]; then
  ok "no writer under scripts/ or .claude/hooks/ discards both the output and the status of a resolve-route request"
else
  while IFS= read -r h; do bad "$h: a writer request that swallows its output and status (a 401 would lose the write with no line anywhere)"; done <<< "$hits"
fi

hits="$(scan_tree_body "$ROOT")"
if [ -z "$hits" ]; then
  ok "no curl under scripts/, .claude/hooks/ or validation/scripts/, and no unit Exec line, carries a secret/password/token/*_KEY variable in its body on argv"
else
  while IFS= read -r h; do bad "$h: a credential in a curl body on argv (readable in any process listing); printf it into curl --data-binary @-"; done <<< "$hits"
fi

p7_roots=("$ROOT")
if [ -n "${LINT_EXTRA_ROOTS:-}" ]; then IFS=: read -r -a _extra <<< "$LINT_EXTRA_ROOTS"; p7_roots+=("${_extra[@]}"); fi
for r in "${p7_roots[@]}"; do
  [ -d "$r" ] || { bad "LINT_EXTRA_ROOTS entry is not a directory: $r"; continue; }
  hits="$(scan_tree_any_resolve "$r" 3>"$T/p7-tree-skips")"
  while IFS= read -r sk; do [ -n "$sk" ] && echo "  $sk [$r]"; done < "$T/p7-tree-skips"
  if [ -z "$hits" ]; then
    ok "every fetch/curl to a /resolve or /v2/impulses/resolve URL under $r (scripts/, validation/scripts/, unit Exec lines, checked-out vessel src/) sends a credential"
  else
    while IFS= read -r h; do bad "$h: a request to a resolve route sends no Authorization [$r]"; done <<< "$hits"
  fi
done

if [ "$fails" -eq 0 ]; then echo "PASSED"; exit 0; fi
echo "FAILED ($fails)"; exit 1
