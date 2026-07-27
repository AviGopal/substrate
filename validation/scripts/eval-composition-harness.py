#!/usr/bin/env python3
"""
COMPOSITION harness — arbitrary compositionality via derive->emit (non-collapsible).
Each goal computes a value THEN writes it to a memoryNote: the write consumes the
computed value, so it MUST be a >=2-step composition (compute -> emit). Verifies:
  - reached
  - composed (chain >= 2)
  - last-mile CONTENT BINDING correct (the note body contains the computed number)
"""
import json, time, urllib.request, re
GH = "http://localhost:18210"; DV = "http://localhost:18090"
KEY = json.load(open("/home/avi/.metabob/config.json"))["metabob"]["apiKey"]
SEED = 424242
H = {"Authorization": f"ApiKey {KEY}", "Content-Type": "application/json"}
def post(base, p, b):
    r = urllib.request.Request(base+p, data=json.dumps(b).encode(), headers=H, method="POST")
    return json.load(urllib.request.urlopen(r, timeout=40))
def get(p):
    r = urllib.request.Request(GH+p, headers={"Authorization": f"ApiKey {KEY}"})
    return json.load(urllib.request.urlopen(r, timeout=30))

def note_body(title):
    try:
        j = post(DV, "/v2/impulses/resolve", {"impulse": {"type": "memoryNote", "title_prefix": title}})
        c = j.get("content") or j.get("body") or j
        s = json.dumps(c)
        return s
    except Exception as e:
        return f"(readback error {e})"

# derive -> emit; each MUST chain compute -> write (write needs the computed value)
GOALS = [
    ("Using a shell command, count the number of lines in /vessels/goal-host-vessel/package.json, then write ONLY that number as the body of a memory note titled 'demo-comp-lines'.", "demo-comp-lines", "21"),
    ("Using a shell command, count the number of characters in /vessels/goal-host-vessel/tsconfig.json, then write ONLY that number as the body of a memory note titled 'demo-comp-chars'.", "demo-comp-chars", "209"),
    ("Using a shell command, count the number of lines in /vessels/development-vessel/package.json, then write ONLY that number as the body of a memory note titled 'demo-comp-devlines'.", "demo-comp-devlines", "26"),
]
print("="*74); print("COMPOSITION (derive->emit; chain>=2; content-binding verified)"); print("="*74)
rows = []
for goal, title, expected in GOALS:
    t0 = time.time()
    did = post(GH, "/run-goal", {"goal": goal, "operator": "eval-comp", "seed": SEED, "ablation": {"forceFloor": True}}).get("dispatchId", "")
    reached = None; wl = []
    for _ in range(140):
        rec = get(f"/executions/{did}")
        if rec.get("status") in ("completed", "failed"): reached = rec.get("reached"); wl = rec.get("walkLog") or []; break
        time.sleep(2)
    txt = " ".join(str(x) for x in wl)
    chains = [int(m) for m in re.findall(r"chain=(\d+)", txt)]
    # Composition detection: count DISTINCT producers. forceFloor satisfier chains log
    # 'SATISFIER produced "X"' rather than chain=N, so a chain=N-only metric misses them.
    produced = set(re.findall(r'SATISFIER produced "([^"]+)"', txt))
    maxchain = max([max(chains) if chains else 0, len(produced)])
    time.sleep(2)
    body = note_body(title)
    content_ok = expected in body
    print(f"[{title}] reached={reached} chain={maxchain} content_ok={content_ok} (want '{expected}') {int((time.time()-t0)*1000)}ms")
    if not content_ok: print(f"    note body: {body[:160]}")
    rows.append({"title": title, "reached": reached, "maxchain": maxchain, "content_ok": content_ok, "expected": expected, "did": did})

n = len(rows)
reach = sum(1 for r in rows if r["reached"])
composed = sum(1 for r in rows if r["maxchain"] >= 2)
content = sum(1 for r in rows if r["content_ok"])
print(); print("="*74)
print(f"COMPOSITION: reached {reach}/{n} | composed(chain>=2) {composed}/{n} | content-binding correct {content}/{n}")
print(f"CLEAN (all reach + all compose + all content correct): {reach==n and composed==n and content==n}")
json.dump(rows, open("/home/avi/.claude/jobs/ac478476/tmp/eval_composition_result.json", "w"), indent=1)
