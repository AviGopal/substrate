#!/usr/bin/env python3
"""
Minimal EVALUATION HARNESS — the ablation curve.

Uses the per-dispatch evaluability controls landed this session (goal-host 0fe201f):
  ablation.forceFloor  -> suppress learned-pathway reuse (cold derivation = the FLOOR arm)
  learning_mode:observe -> no-learn (the measurement does not mutate the learner)
  seed                  -> reproducible recommendation (activity-api 70a9963)

For each held-out compute goal it runs three arms and records reach + wall-latency:
  SEED  (learn)               : warm the reached-command pathway
  WARM  (learn, learned path) : should REUSE (fast)
  FLOOR (forceFloor, observe) : reuse SUPPRESSED -> cold derivation (should still reach)

Clean outcome (the hypothesis, mechanism-level):
  - FLOOR reach rate == WARM reach rate (floor parity: ablating reuse does not lose reach)
  - reuse fires on WARM, is SUPPRESSED on FLOOR (the ablation actually changed one lever)
  - WARM latency <= FLOOR latency (the learned pathway is cheaper — compounding signal)
  - observe arm writes nothing (independent trials)
"""
import json, time, urllib.request, sys

BASE = "http://localhost:18210"
KEY = json.load(open("/home/avi/.metabob/config.json"))["metabob"]["apiKey"]
SEED = 424242  # frozen seed -> reproducible

# Held-out frozen suite: distinct compute goals over distinct real files.
GOALS = [
    "Using a single shell command, count how many lines are in /vessels/goal-host-vessel/package.json and report just the number.",
    "Using a single shell command, count how many words are in /vessels/goal-host-vessel/tsconfig.json and report just the number.",
    "Using a single shell command, count how many lines are in /vessels/development-vessel/package.json and report just the number.",
    "Using a single shell command, count the number of characters in /vessels/activity-api/package.json and report just the number.",
]

def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(),
        headers={"Authorization": f"ApiKey {KEY}", "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def get(path):
    req = urllib.request.Request(BASE + path, headers={"Authorization": f"ApiKey {KEY}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def run_arm(goal, extra):
    body = {"goal": goal, "operator": "eval-harness", **extra}
    t0 = time.time()
    did = post("/run-goal", body).get("dispatchId", "")
    reached = None; wl = []
    for _ in range(60):
        rec = get(f"/executions/{did}")
        st = rec.get("status")
        if st in ("completed", "failed"):
            reached = rec.get("reached"); wl = rec.get("walkLog") or []; break
        time.sleep(2)
    wall = time.time() - t0
    txt = " ".join(str(x) for x in wl)
    reuse = ("REUSED verified command" in txt) or ("REBOUND verified command" in txt)
    suppressed = "reuse SUPPRESSED by ablation" in txt
    return {"dispatchId": did, "reached": reached, "wall_ms": int(wall*1000), "reuse": reuse, "suppressed": suppressed}

rows = []
for i, g in enumerate(GOALS):
    tag = g.split("/")[-1].split(" ")[0]
    print(f"\n[{i+1}/{len(GOALS)}] {tag}", flush=True)
    run_arm(g, {"seed": SEED})                                        # SEED (learn) — warm the pathway
    warm  = run_arm(g, {"seed": SEED})                                # WARM (learned)
    floor = run_arm(g, {"seed": SEED, "ablation": {"forceFloor": True}, "learning_mode": "observe"})  # FLOOR (cold, observe)
    print(f"   WARM  reached={warm['reached']} reuse={warm['reuse']} {warm['wall_ms']}ms")
    print(f"   FLOOR reached={floor['reached']} suppressed={floor['suppressed']} {floor['wall_ms']}ms")
    rows.append({"goal": tag, "warm": warm, "floor": floor})

print("\n" + "="*72)
print("ABLATION CURVE — held-out compute suite (seed=%d)" % SEED)
print("="*72)
n = len(rows)
warm_reach  = sum(1 for r in rows if r["warm"]["reached"])
floor_reach = sum(1 for r in rows if r["floor"]["reached"])
reuse_warm  = sum(1 for r in rows if r["warm"]["reuse"])
supp_floor  = sum(1 for r in rows if r["floor"]["suppressed"])
import statistics
warm_lat  = statistics.median(r["warm"]["wall_ms"] for r in rows)
floor_lat = statistics.median(r["floor"]["wall_ms"] for r in rows)
print(f"WARM  reach: {warm_reach}/{n}   reuse fired: {reuse_warm}/{n}   median latency: {warm_lat}ms")
print(f"FLOOR reach: {floor_reach}/{n}   reuse suppressed: {supp_floor}/{n}   median latency: {floor_lat}ms")
print(f"floor parity (FLOOR reach == WARM reach): {floor_reach == warm_reach}")
print(f"compounding (WARM median <= FLOOR median): {warm_lat <= floor_lat}  ({warm_lat}ms vs {floor_lat}ms)")
clean = (warm_reach == n and floor_reach == n and reuse_warm == n and supp_floor == n)
print(f"\nCLEAN OUTCOME (all reach, reuse fires warm, suppressed floor): {clean}")
json.dump(rows, open("/home/avi/.claude/jobs/ac478476/tmp/eval_harness_result.json", "w"), indent=1)
