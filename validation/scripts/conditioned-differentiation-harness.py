#!/usr/bin/env python3
"""conditioned-differentiation-harness.py

Does conditioning selection on the shapes that determine OUTPUT CONTENT
differentiate goals the current identity collapses — observably, in under 5 min?

THE DEFECT. `path_signature` = md5(path_activities). On a satisfier walk that is
`[satisfier:<targetShape>]`, and the target is a DEDUPLICATED SET of output shapes
from goal-target inference. Two goals demanding different work over the same shape
collapse to one identity. Measured twice this session: a 1-operation and a
3-operation goal recorded the identical `4502429f465d532f`.

THE IDEA (operator's words). "Idealize out the shapes that affect the expected
output content, then use that conditioned selection to improve the patterns." So:
  BASELINE key  = the deduplicated set of output shapes the goal PRODUCES
                  (what inferGoalTargetShapes computes today).
  CONDITIONED   = { shapes the output CONTENT depends on } + output-content kind,
                  with transport/write shapes IDEALIZED OUT.

The conditioned key is a function of what the answer needs, not of how the goal is
phrased — so two phrasings of one work-class must collapse to it, and two
work-classes must separate under it. Both are scored, because a key that only
separates (and splits identical goals) is the mirror defect that killed the LLM
step count earlier this session.

Runs on the local LLM arm via `docker exec`; no compose pipeline, no dispatch.
"""
import json, subprocess, time, sys, itertools, re
from collections import defaultdict

CONTAINER = "substrate-live"
LLM = "http://127.0.0.1:8220/resolve"
MODEL = "claude-sonnet-4-5"
DEADLINE_S = 300  # the operator's 5-minute observability budget

# --- the design matrix -----------------------------------------------------
# Each goal carries a ground-truth WORK class. Two phrasings per (class), so the
# harness can score BOTH invariance (same class, diff phrasing -> same key) and
# separation (diff class -> diff key). Plus a nonsense control that must match
# nothing.
GOALS = [
    # W1: content depends on the shape registry only
    ("W1", "a", "How many distinct impulse shapes does the discovery registry advertise? Report the number."),
    ("W1", "b", "Report the count of shape types the discovery registry currently serves."),
    # W2: content depends on the gap store only
    ("W2", "a", "How many substrate gaps are currently open? Report the number."),
    ("W2", "b", "Give the count of open items in the substrate gap store right now."),
    # W3: content depends on BOTH, plus a comparison
    ("W3", "a", "Compare how many shapes the registry advertises with how many gaps are open, and state which is larger."),
    ("W3", "b", "Which is bigger right now: advertised shape count, or open gap count? Report both figures."),
    # W4: content depends on BOTH, plus a derived ratio (distinct from W3's comparison)
    ("W4", "a", "Work out the ratio of advertised shapes to open gaps and report it with both counts."),
    ("W4", "b", "Divide the advertised shape count by the open gap count and give the ratio and both numbers."),
    # W5: content depends on the gap store but a DIFFERENT content than W2 (names, not a count)
    ("W5", "a", "List the ids of the three most recently updated open substrate gaps."),
    ("W5", "b", "Which three open gaps were updated most recently? Give their ids."),
    # control: unsatisfiable, must key to nothing real
    ("CTL", "a", "Report the current value of the quantum_flux_coefficient on the discovery registry."),
]

def llm(prompt: str, timeout=90) -> str:
    body = json.dumps({"type": "llm_completion", "prompt": prompt, "model": MODEL, "max_tokens": 400})
    p = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "sh", "-c",
         f"cat > /tmp/hreq.json && curl -s -m {timeout} -X POST {LLM} -H 'content-type: application/json' -d @/tmp/hreq.json"],
        input=body.encode(), capture_output=True, timeout=timeout + 20)
    return p.stdout.decode(errors="replace")

def extract_json(raw: str):
    # The resolver answers with an ENVELOPE {"resolved":true,"content":"<model text>",...}
    # and the model's JSON lives, escaped, inside `content`. A greedy {...} over the
    # whole envelope returns the envelope (no answer fields) — the bug that made
    # run 2 all-<none>. Pull `content` first, then find the inner object by the
    # field it must contain.
    text = raw
    try:
        env = json.loads(raw)
        c = env.get("content")
        if isinstance(c, str):
            text = c
        elif isinstance(c, dict):
            return c
    except Exception:
        pass
    text = text.replace("\\n", "\n").replace('\\"', '"')
    for field in ("output_content_kind", "content_domains", "content_source_shapes", "output_shapes"):
        m = re.search(r'\{[^{}]*"' + field + r'"[\s\S]*?\}', text)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                continue
    # last resort: smallest brace-balanced object
    for m in re.finditer(r'\{[^{}]*\}', text):
        try:
            o = json.loads(m.group(0))
            if any(k in o for k in ("output_content_kind", "content_domains", "content_source_shapes", "output_shapes")):
                return o
        except Exception:
            continue
    return None

SHAPE_VOCAB = None
def load_vocab():
    global SHAPE_VOCAB
    try:
        r = subprocess.run(["curl", "-s", "-m", "10", "http://localhost:18100/registry/shapes"],
                           capture_output=True, timeout=15)
        allsh = json.loads(r.stdout.decode())["shapes"]
        SHAPE_VOCAB = sorted(s for s in allsh if any(
            k in s.lower() for k in ("registry", "shape", "gap", "concept", "memory", "note", "trace", "vessel", "count", "report")))
    except Exception:
        SHAPE_VOCAB = ["substrateGap", "memoryNote_write", "discoverByShapesQuery", "vessel_health_report"]

# The data DOMAINS — the phrasing-invariant idealization of a source.
#
# Run 1 conditioned on SHAPE NAMES and split identical goals: "how many shapes"
# chose advertised_shape_coverage_scan, its rephrasing chose
# discovery_vessel_registry_observer — two shapes for ONE source. The registry
# has 324 shapes and several touch each store, so free choice among them is free
# to move with phrasing. Collapsing a source to its OWNING STORE removes that
# freedom: both registry-reading shapes are the discovery store, both gap shapes
# are the gap store. This is data locality (law 11) used as the canonicalization.
DOMAINS = [
    "discovery-registry (advertised shapes, which vessels serve what)",
    "gap-store (open substrate gaps)",
    "memory-store (memory notes)",
    "concept-store (concepts, prose knowledge)",
    "trace-store (execution traces, activity metrics, posteriors)",
    "none (the answer needs no live data / cannot be answered)",
]
DOMAIN_KEYS = ["discovery-registry", "gap-store", "memory-store", "concept-store", "trace-store", "none"]

def _canon_domain(s: str) -> str:
    s = s.lower()
    for k in DOMAIN_KEYS:
        if k in s or k.split("-")[0] in s:
            return k
    return "none"

# BASELINE — what the declared OUTPUT shape tells you: the delivered content kind
# and nothing about its source. This is what path_signature effectively captures
# (a "count" goal and another "count" goal look identical), so it collapses two
# goals that read DIFFERENT stores to the same key.
# A parse/format miss is UNMEASURED, not "depends on nothing". Retry once; only
# then return None so scoring can EXCLUDE the cell rather than count it as a split
# — conflating "not read" with "read as none" is the exact defect this session
# keeps catching, and it belongs out of my own instrument.
def baseline_key(goal: str):
    for _ in range(2):
        o = extract_json(llm(
            "What KIND of value is this goal's answer, independent of how it is delivered "
            "(e.g. count, comparison, ratio, id-list, name)?\n\n"
            f"GOAL: {goal}\n\n"
            'Return ONLY: {"output_content_kind":"<kind>"}  No prose, no fences.'))
        k = str((o or {}).get("output_content_kind") or "").strip().lower()
        if k:
            return k
    return None

# CONDITIONED — the data DOMAINS the answer's content depends on (idealized to the
# owning store, transport excluded) plus the content kind. Small, closed choice
# space, so phrasing cannot move it.
def conditioned_key(goal: str):
    for _ in range(2):
        o = extract_json(llm(
            "Identify what the CORRECT ANSWER's CONTENT depends on.\n"
            "- content_domains: which of the DATA STORES below the answer's value is computed FROM. "
            "Pick every store the answer would change if you removed. A store you merely SAVE the "
            "answer INTO is NOT a dependency — exclude it.\n"
            "- output_content_kind: the kind of value the content is "
            "(count, comparison, ratio, id-list, name), independent of delivery.\n\n"
            "DATA STORES:\n  - " + "\n  - ".join(DOMAINS) + "\n\n"
            f"GOAL: {goal}\n\n"
            'Return ONLY: {"content_domains":["<store>", ...], "output_content_kind":"<kind>"}  '
            "Use the store names exactly as written before the parenthesis. No prose, no fences."))
        if not o:
            continue
        doms = sorted({_canon_domain(str(s)) for s in (o.get("content_domains") or []) if str(s).strip()} - {"none"})
        kind = str(o.get("output_content_kind") or "").strip().lower()
        if kind:                       # a real answer; empty domains is legitimate only for the control
            return "|".join(doms or ["none"]) + "=>" + kind
    return None

def score(keys):
    """keys: {(cls,ph): keystr}. Returns (correct_merges, total_merges, correct_splits, total_splits, purity)."""
    items = list(keys.items())
    cm = tm = cs = ts = 0
    for (a, ka), (b, kb) in itertools.combinations(items, 2):
        (ca, _), (cb, _) = a, b
        if ca == "CTL" or cb == "CTL":
            continue
        if ka is None or kb is None:   # UNMEASURED — a parse miss is not evidence
            continue
        if ca == cb:               # SHOULD be same (same work, diff phrasing)
            tm += 1; cm += (ka == kb)
        else:                       # SHOULD differ (diff work)
            ts += 1; cs += (ka != kb)
    # cluster purity: fraction of goals whose key's majority class is its own class
    byk = defaultdict(list)
    for (c, _), k in keys.items():
        if c != "CTL" and k is not None:
            byk[k].append(c)
    correct = sum(max(defaultdict(int, {c: v.count(c) for c in set(v)}).values()) for v in byk.values())
    total = sum(len(v) for v in byk.values())
    return cm, tm, cs, ts, (correct / total if total else 0)

def main():
    t0 = time.time()
    print("conditioned-differentiation-harness — 5-minute observability budget\n")
    load_vocab()
    print(f"grounded on {len(SHAPE_VOCAB)} real registry shapes\n")

    base, cond, ctl = {}, {}, {}
    for cls, ph, goal in GOALS:
        if time.time() - t0 > DEADLINE_S - 30:
            print(f"\n!! approaching {DEADLINE_S}s budget — stopping at goal {cls}-{ph}"); break
        bk = baseline_key(goal); ck = conditioned_key(goal)
        (ctl if cls == "CTL" else base)[(cls, ph)] = bk
        if cls != "CTL":
            cond[(cls, ph)] = ck
        tag = f"{cls}-{ph}"
        print(f"  {tag:6}  baseline={bk!r:38}  conditioned={ck!r}")

    b_un = sum(1 for k in base.values() if k is None)
    c_un = sum(1 for k in cond.values() if k is None)
    print(f"\n=== elapsed {time.time()-t0:.0f}s ===")
    if b_un or c_un:
        print(f"  UNMEASURED cells (parse miss after retry, excluded from scoring): baseline {b_un}, conditioned {c_un}")
    bcm, btm, bcs, bts, bpur = score(base)
    ccm, ctm, ccs, cts, cpur = score(cond)
    print("\n                       correct-merges   correct-splits   cluster-purity")
    print(f"  BASELINE (output-shape set)   {bcm}/{btm}            {bcs}/{bts}            {bpur:.2f}")
    print(f"  CONDITIONED (content-deps)    {ccm}/{ctm}            {ccs}/{cts}            {cpur:.2f}")
    b_ok = (bcm + bcs); b_tot = (btm + bts)
    c_ok = (ccm + ccs); c_tot = (ctm + cts)
    print(f"\n  overall correct pair-decisions:  baseline {b_ok}/{b_tot}   conditioned {c_ok}/{c_tot}")

    # THE CELL THAT MATTERS: pairs the BASELINE COLLAPSES (same key) but that are
    # genuinely different work — and whether conditioning SEPARATES them. This is
    # the source-blind collapse path_signature has: two goals that differ only in
    # which store they read. A raw pair-decision delta hides it, because content
    # kind already separates most of the matrix.
    fixed = missed = 0
    items = list(base.keys())
    for a, b in itertools.combinations(items, 2):
        if a[0] == "CTL" or b[0] == "CTL" or a[0] == b[0]:
            continue
        if base[a] is None or base[b] is None or cond.get(a) is None or cond.get(b) is None:
            continue
        if base[a] == base[b]:                    # baseline collapses this different-work pair
            if cond.get(a) != cond.get(b):
                fixed += 1
            else:
                missed += 1
    print(f"\n  SOURCE-BLIND COLLAPSES the baseline makes on different-work goals: {fixed+missed}")
    print(f"    of those, conditioning SEPARATES: {fixed}   still merged: {missed}")

    ctl_match = any(ctl.get(("CTL", "a")) == v for v in base.values())
    print(f"\n  CONTROL: must-fail goal's key collides with a real goal: {ctl_match}  "
          f"({'BAD' if ctl_match else 'ok'})")

    invariant = (ccm == ctm)
    separating = (ccs == cts)
    if invariant and separating and fixed > 0:
        print(f"\n  VERDICT: CONDITIONED SELECTION WORKS — {ccm}/{ctm} phrasings invariant, "
              f"{ccs}/{cts} work-classes separated, and it fixes {fixed} source-blind collapse(s) "
              "the baseline cannot. This is differentiation by the work the output depends on.")
    elif not invariant:
        print(f"\n  VERDICT: SPLITS IDENTICAL GOALS — {ctm-ccm} phrasing pair(s) diverged. "
              "Same failure class as the step count.")
    elif not separating:
        print(f"\n  VERDICT: does not separate all work classes ({ccs}/{cts} splits).")
    else:
        print("\n  VERDICT: invariant and separating but adds nothing over baseline on this matrix.")

    out = f"validation/results/{time.strftime('%Y-%m-%d')}-conditioned-differentiation.json"
    try:
        json.dump({"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "elapsed_s": round(time.time()-t0),
                   "baseline": {f"{c}-{p}": k for (c, p), k in base.items()},
                   "conditioned": {f"{c}-{p}": k for (c, p), k in cond.items()},
                   "scores": {"baseline_correct": [b_ok, b_tot], "conditioned_correct": [c_ok, c_tot],
                              "source_blind_collapses_fixed": fixed, "still_merged": missed,
                              "invariant": ccm==ctm, "separating": ccs==cts}},
                  open(out, "w"), indent=1)
        print(f"\n  wrote {out}")
    except Exception as e:
        print(f"\n  (result not written: {e})")

if __name__ == "__main__":
    main()
