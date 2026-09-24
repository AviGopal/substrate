#!/usr/bin/env bash
# post-result — hand an install acceptance verdict to the substrate that learns from it.
#
# WHY THIS EXISTS
#
# CI judges setup; the substrate has to learn from it. A verdict that lives only in a CI
# log is invisible to the learning loop: install health has no data source for the gap
# triple, and a failure cannot become a gap the substrate closes itself. So every result
# is posted to the reference hub, through shapes the hub already serves (reuse before
# mint), routed by shape through the hub's discovery endpoint:
#
#   memoryNote_write     one note per (case, engine, digest): the verdict, every level,
#                        every check, the failing step. Its title always starts
#                        "installAcceptance ", so a title_prefix read finds every result.
#                        It asks for note_type installAcceptance and reads the note back:
#                        a hub whose memoryNote_write does not keep that type stores the
#                        note under another one, and that is reported as a rejection
#                        (exit 5) instead of passing as delivered
#   substrateGap_write   on a judged failure: one open gap per failing STEP, keyed by the
#                        step and not by the run, so a broken block re-detected on every
#                        image and every engine stays one gap; the block text, its line,
#                        the digests and the engines seen are the evidence
#                        on a full pass (--close-on-pass, every engine green in gating
#                        mode): the case's open install-acceptance gaps are closed,
#                        because a pass on a published image is the only thing allowed to
#                        call a setup defect fixed
#
# Posting never decides a publish. It retries with backoff, then reports what it could
# not deliver so the caller can carry it forward and post it when the hub answers again.
# Every write is an idempotent upsert by id, so re-posting a carried result is harmless,
# with one guard: a failure that finished before a full pass closed its gap is history,
# not a regression, and does not reopen that gap. Callers post older results first, so
# the newest verdict is the last one written.
#
# The hub not answering and the hub having no healthy producer for the shape (discovery's
# 404 "Not found" naming the shape, or its 502 forward_failed) are both retryable: the
# result is carried, not dropped. Once one write has exhausted its attempts the hub is
# taken to be down, and every remaining result is listed as undelivered at once instead of
# paying the full backoff again. Undelivered paths are printed as they happen, so a caller
# cancelled mid-run still holds the list.
#
# USAGE
#   post-result.sh [--close-on-pass] RESULT.json...
#
# ENVIRONMENT
#   ACCEPTANCE_HUB_URL    the reference hub's discovery endpoint (as a spoke's
#                         DISCOVERY_ENDPOINT); writes go to <url>/resolve
#   ACCEPTANCE_HUB_KEY    a non-admin, non-root API key for the hub. Keys carry only
#                         generic read/write scopes, not shapes, so this key can write
#                         any memoryNote and any gap, not only acceptance results; it
#                         must be able to resolve memoryNote_write and substrateGap_write
#                         through the hub's discovery (a 404 there is retried, not posted)
#   POST_ATTEMPTS         attempts per write before giving up          (default: 5)
#   POST_BACKOFF          first retry delay in seconds, doubled per try (default: 15)
#   ACCEPTANCE_GAP_SOURCE gap source for CI-detected failures (default: substrate_detected)
#
# OUTPUT / EXIT
#   stdout: the path of every result that could not be delivered, one per line
#   0 all delivered · 3 not configured (nothing sent) · 4 some undelivered (hub
#   unreachable, erroring or without a producer; retry later) · 5 the hub rejected a
#   write, or stored the note under a type other than installAcceptance (retrying will
#   not help; read the log) · 64 usage
set -uo pipefail

close_on_pass=0
files=()
for a in "$@"; do
  case "$a" in
    --close-on-pass) close_on_pass=1 ;;
    -h|--help) sed -n '2,/^set -uo/p' "$0" | sed '$d; s/^# \{0,1\}//'; exit 0 ;;
    -*) echo "post-result: unknown option $a" >&2; exit 64 ;;
    *) files+=("$a") ;;
  esac
done
[ "${#files[@]}" -gt 0 ] || { echo "post-result: usage: $0 [--close-on-pass] RESULT.json..." >&2; exit 64; }
command -v jq >/dev/null && command -v curl >/dev/null || { echo "post-result: jq and curl are required" >&2; exit 64; }

hub="${ACCEPTANCE_HUB_URL:-}"; key="${ACCEPTANCE_HUB_KEY:-}"
if [ -z "$hub" ] || [ -z "$key" ]; then
  echo "post-result: ACCEPTANCE_HUB_URL / ACCEPTANCE_HUB_KEY not set; ${#files[@]} result(s) not posted" >&2
  printf '%s\n' "${files[@]}"
  exit 3
fi
hub="${hub%/}"
attempts="${POST_ATTEMPTS:-5}"; backoff="${POST_BACKOFF:-15}"
gap_source="${ACCEPTANCE_GAP_SOURCE:-substrate_detected}"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
log() { printf '[post-result] %s\n' "$*" >&2; }

# resolve POINTER-JSON → 0 delivered (response on fd 1) · 1 retryable · 2 rejected
resolve_once() {
  local code
  code="$(curl -sS -m 30 -o "$tmp/resp" -w '%{http_code}' -X POST "$hub/resolve" \
    -H 'Content-Type: application/json' -H "Authorization: ApiKey $key" \
    --data-binary "$(jq -c '{pointer: .}' <<<"$1")" 2>"$tmp/curl.err")" || code="000"
  case "$code" in
    2??)
      if jq -e '(.success != false) and (.shape != "structuredError") and ((.body.action? // "") != "rejected") and ((.error? // null) == null)' "$tmp/resp" >/dev/null 2>&1; then
        cat "$tmp/resp"; return 0
      fi
      log "rejected ($code): $(head -c 400 "$tmp/resp")"; return 2 ;;
    000|408|425|429|5??)
      log "hub not answering ($code): $(cat "$tmp/curl.err" "$tmp/resp" 2>/dev/null | head -c 200 | tr '\n' ' ')"; return 1 ;;
    404)
      # Discovery answers 404 "Not found" naming the shape when no healthy producer is
      # registered (a vessel restarting, say). That describes the hub's state, not the
      # request, so the result is carried and posted later.
      if jq -e '.error == "Not found" and ((.shape // "") | type == "string" and length > 0)' "$tmp/resp" >/dev/null 2>&1; then
        log "no producer on the hub right now ($code): $(head -c 200 "$tmp/resp")"; return 1
      fi
      log "refused ($code): $(head -c 400 "$tmp/resp")"; return 2 ;;
    *)
      log "refused ($code): $(head -c 400 "$tmp/resp")"; return 2 ;;
  esac
}
hub_down=0
resolve() {
  local i delay="$backoff" rc
  # Once a write has exhausted its attempts, later writes in this run are not retried:
  # each would cost the whole backoff again against a hub already known not to answer.
  [ "$hub_down" -eq 1 ] && return 1
  for ((i = 1; i <= attempts; i++)); do
    resolve_once "$1"; rc=$?
    [ "$rc" -ne 1 ] && return "$rc"
    [ "$i" -lt "$attempts" ] && { log "retry $i/$((attempts - 1)) in ${delay}s"; sleep "$delay"; delay=$((delay * 2 > 300 ? 300 : delay * 2)); }
  done
  hub_down=1
  log "the hub did not take a write after ${attempts} attempts; the remaining results are carried without retrying"
  return 1
}

# An undelivered result is printed the moment it is known, once, so the caller's list
# is complete even if this run is cut short.
declare -A owed=()
owe() {
  [ -n "${owed[$1]:-}" ] && return 0
  owed[$1]=1
  printf '%s\n' "$1"
}

short() { local d="${1##*sha256:}"; printf '%s' "${d:0:12}"; }
step_key() {  # result-json → a stable key for the failing step
  local kind name text
  kind="$(jq -r '.failing_step.kind // "unknown"' <<<"$1")"
  case "$kind" in
    block)
      # Keyed by the block's text, not its position: inserting a block above it must
      # not mint a second gap for the same broken command, and fixing its text is a
      # different step.
      text="$(jq -r '.failing_step.text // ""' <<<"$1")"
      printf 'block-%s' "$(printf '%s' "$text" | sha256sum | cut -c1-10)" ;;
    level|check)
      name="$(jq -r '.failing_step.name // "unknown"' <<<"$1")"
      printf '%s-%s' "$kind" "$name" ;;
    *) printf 'unknown' ;;
  esac
}

undelivered=0
rejected=0
all_pass=1
cases=()
for f in "${files[@]}"; do
  if ! r="$(jq -c . "$f" 2>/dev/null)" || [ "$(jq -r '.kind // ""' <<<"$r")" != "installAcceptance" ]; then
    log "skipping $f: not an installAcceptance result"; rejected=1; continue
  fi
  verdict="$(jq -r .verdict <<<"$r")"; mode="$(jq -r .mode <<<"$r")"
  engine="$(jq -r .engine <<<"$r")"; case_name="$(jq -r .case <<<"$r")"
  digest="$(jq -r '.digest // .image' <<<"$r")"
  [ "$verdict" = "pass" ] && [ "$mode" = "gating" ] || all_pass=0
  printf '%s\n' "${cases[@]+"${cases[@]}"}" | grep -qxF "$case_name" || cases+=("$case_name")
  if [ "$hub_down" -eq 1 ]; then owe "$f"; undelivered=1; continue; fi

  note_id="install-acceptance:${case_name}:${engine}:$(short "$digest")"
  gap_id=""
  [ "$verdict" = "fail" ] && gap_id="install-acceptance-${case_name}-$(step_key "$r")"

  body="$(jq -r --arg gap "$gap_id" '
    "Install acceptance — \(.engine) / \(.case): \(.verdict) (\(.mode))\n\n" +
    "Image: \(.digest // .image)\nRevision: \(.image_revision // "unknown")\n" +
    "Install page: \(.install_doc), \(.blocks.completed) of \(.blocks.total) blocks completed\n" +
    "Levels: " + ([.levels | to_entries[] | "\(.key)=\(.value)"] | join(" ")) + "\n" +
    "Checks: " + ([.checks | to_entries[] | "\(.key)=\(.value.result)"] | join(" ")) + "\n" +
    (if .failing_step then "Failing step: \(.failing_step.kind) \(.failing_step.name // ("block " + ((.failing_step.index // "?") | tostring) + " line " + ((.failing_step.doc_line // "?") | tostring)))\n" else "" end) +
    (if $gap != "" then "Gap: \($gap)\n" else "" end) +
    (if .run_url then "Run: \(.run_url)\n" else "" end) +
    "\n```json\n" + (. | tojson) + "\n```\n"' <<<"$r")"
  note="$(jq -nc --arg id "$note_id" --arg body "$body" --argjson r "$r" '{
    type: "memoryNote_write",
    note: {
      id: $id,
      note_type: "installAcceptance",
      title: "installAcceptance \($r.verdict) \($r.engine) \($r.case) \(($r.digest // $r.image) | sub(".*sha256:"; "") | .[0:12])",
      body: $body,
      confidence_weight: 1,
      last_validated_at: $r.finished_at
    }
  }')"
  resolve "$note" >/dev/null; rc=$?
  case "$rc" in
    0)
      log "note $note_id delivered"
      # The write answers only {id, action}; what the hub kept is read back. A hub whose
      # memoryNote_write does not know the installAcceptance type stores the note as
      # another type, and a read by note_type then finds nothing: that is a loss, and it
      # is reported as one.
      # The read-back is retried like a write, and an unconfirmed note is not counted as
      # delivered: the result is carried and re-posted (an idempotent upsert) later.
      resolve "$(jq -nc --arg id "$note_id" '{type: "memoryNote", id: $id, limit: 1}')" >"$tmp/readback"; rc=$?
      if [ "$rc" -eq 0 ]; then
        stored="$(jq -r '(.body.notes // [])[0].type // "(missing)"' "$tmp/readback" 2>/dev/null)"
        if [ "$stored" != "installAcceptance" ]; then
          log "note $note_id was stored as type '${stored}', not installAcceptance: the hub's memoryNote_write does not keep that note type, so a read by note_type installAcceptance will not find it (its title prefix still does)"
          rejected=1
        fi
      elif [ "$rc" -eq 1 ]; then
        log "note $note_id: could not read it back to confirm its stored type; carried"
        owe "$f"; undelivered=1; continue
      else
        log "note $note_id: the read-back was refused, so its stored type is unconfirmed"
        rejected=1
      fi ;;
    1) owe "$f"; undelivered=1; continue ;;
    2) rejected=1 ;;
  esac

  [ -n "$gap_id" ] || continue
  # Merge with what the hub already holds for this step: the engines and digests it
  # has been seen on accumulate instead of the last writer's replacing them.
  prior='{}'
  if got="$(resolve_once "$(jq -nc --arg id "$gap_id" '{type: "substrateGap", id: $id, limit: 1}')")"; then
    prior="$(jq -c '(.body.gaps // [])[0] // {}' <<<"$got" 2>/dev/null || echo '{}')"
  fi
  # A failure that finished before a full pass closed this gap is older news than the
  # pass (a result carried from a run whose hub was down): writing it would reopen a gap
  # the newer verdict closed, and count a reopen that never happened.
  if jq -e --argjson r "$r" '.status == "closed"
        and ((.classification_metadata.closed_by_acceptance // null) != null)
        and (($r.finished_at // "") < (.classification_metadata.closed_by_acceptance.finished_at // .classification_metadata.closed_by_acceptance.at // ""))' \
        <<<"$prior" >/dev/null 2>&1; then
    log "gap $gap_id: this failure finished before the full pass that closed it; not reopened"
    continue
  fi
  gap="$(jq -nc --arg id "$gap_id" --arg src "$gap_source" --arg note "$note_id" \
      --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson r "$r" --argjson prior "$prior" '
    ($prior.classification_metadata // {}) as $pm
    | (if ($prior.status // "open") == "open" then (($pm.engines // []) + [$r.engine] | unique) else [$r.engine] end) as $engines
    | ((($pm.digests // []) + [($r.digest // $r.image)]) | unique | .[-10:]) as $digests
    | $r.failing_step as $s
    | {
        type: "substrateGap_write",
        gap: {
          id: $id,
          category: "systematic_failure",
          source: $src,
          status: "open",
          detected_at: $now,
          summary: (
            "Install acceptance fails on a published image (\($engines | join(", ")), case \($r.case)): " +
            (if $s.kind == "block" and $s.index == null then "the install blocks did not start: `\($s.command // "?")` (exit \($s.exit // "?"))"
             elif $s.kind == "block" then "install block \($s.index) at \($r.install_doc):\($s.doc_line // "?") stops at `\($s.command // "?")` (exit \($s.exit // "?"))"
             elif $s.kind == "level" then "readiness level `\($s.name)` is \($s.value)" + (if $s.detail then " — \($s.detail)" else "" end)
               + (if $s.block then " (install block \($s.block.index) at \($r.install_doc):\($s.block.doc_line // "?") waits for it: `\($s.block.command // "?")`)" else "" end)
             else "check `\($s.name)` is \($s.detail.result // "fail")" end) +
            ". Closes only when the acceptance run passes on a published image containing the fix."
          ),
          classification_metadata: {
            kind: "install_acceptance_failure",
            detector: "install_acceptance",
            falsifier: "install acceptance run passes on a published image (every engine, gating mode)",
            case: $r.case, profile: $r.profile,
            engines: $engines, digests: $digests,
            image_revision: $r.image_revision,
            install_doc: $r.install_doc,
            failing_step: ($s | del(.text)),
            block_text: ($s.text // null),
            levels: $r.levels,
            checks: ($r.checks | map_values(.result)),
            acceptance_note_id: $note,
            run_url: $r.run_url
          }
        }
      }')"
  resolve "$gap" >/dev/null; rc=$?
  case "$rc" in
    0) log "gap $gap_id filed" ;;
    1) owe "$f"; undelivered=1 ;;
    2) rejected=1 ;;
  esac
done

# A full pass closes the case's open install-acceptance gaps: every step they name has
# just run green on a published image, on every engine.
if [ "$close_on_pass" -eq 1 ] && [ "$all_pass" -eq 1 ] && [ "$undelivered" -eq 0 ]; then
  # Narrowed by source as well as category and status, so the page of open gaps read
  # here is this detector's, not the whole store's systematic failures.
  if got="$(resolve_once "$(jq -nc --arg src "$gap_source" '{type: "substrateGap", status: "open", category: "systematic_failure", source: $src, limit: 500}')")"; then
    passed_at="$(jq -rs '[.[] | .finished_at // empty] | max // empty' "${files[@]}")"
    for c in "${cases[@]}"; do
      jq -c --arg p "install-acceptance-${c}-" '(.body.gaps // [])[] | select((.id | type) == "string" and (.id | startswith($p)))' <<<"$got" |
      while IFS= read -r g; do
        closing="$(jq -nc --argjson g "$g" --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg fin "$passed_at" \
          --argjson digests "$(jq -sc '[.[] | .digest // .image] | unique' "${files[@]}")" '{
          type: "substrateGap_write",
          gap: ($g + {status: "closed",
                      classification_metadata: (($g.classification_metadata // {}) + {closed_by_acceptance: {at: $now, finished_at: (if $fin == "" then $now else $fin end), digests: $digests}})})
        }')"
        if resolve "$closing" >/dev/null; then log "gap $(jq -r .id <<<"$g") closed by a full acceptance pass"
        else log "gap $(jq -r .id <<<"$g") could not be closed now; the next full pass closes it"; fi
      done
    done
  else
    log "could not list open gaps to close; they stay open until the next full pass"
  fi
fi

[ "$undelivered" -ne 0 ] && exit 4
[ "$rejected" -ne 0 ] && exit 5
exit 0
