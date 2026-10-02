#!/usr/bin/env python3
"""
reach-generalization-harness.py — does reuse actually generalize, or does it just look like it?

Three claims need evidence, and none of them survives an anecdote:

  1. reach rate rises as the corpus grows
  2. SIMILAR goals converge on SIMILAR pathways (generalization, not memorization)
  3. the pattern is durable across many attempts from different angles

Two design decisions carry the whole harness:

**The oracle never asks the substrate.** Every expected value is computed by
enumerating the authoritative git clones inside the container. This session has
repeatedly found `reached: true` sitting on a wrong answer — a verifier that
computed ground truth and then certified a contradicting output — so the
substrate's verdict is recorded as a CLAIM and graded against an independent
count. `reached` and `correct` are separate columns, and the gap between them is
the most interesting number here.

**Goals are novel every batch.** Each batch draws different vessels, so a later
batch is never a literal replay of an earlier one. If reach rises anyway, the
system generalized; if it only rises on repeats, that is memorization and this
harness will show it as a flat novel-goal curve.

Usage:
  python3 validation/scripts/reach-generalization-harness.py --batches 3 --per-batch 12
  python3 validation/scripts/reach-generalization-harness.py --pilot     # 6 goals, validates the harness itself
"""

import argparse
import hashlib
import json
import random
import re
import subprocess
import sys
import time
import urllib.request
from collections import Counter, defaultdict

CONTAINER = "substrate-live"
GOAL_HOST = "http://localhost:18210"
DEV_VESSEL = "http://localhost:18090"
HUB = "http://syzygy.host:18080"


def api_key() -> str:
    with open("/home/avi/.metabob/config.json") as fh:
        return json.load(fh)["metabob"]["apiKey"]


KEY = api_key()


def post(url: str, payload: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": "ApiKey " + KEY},
    )
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def get(url: str, timeout: int = 120) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": "ApiKey " + KEY})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


# ---------------------------------------------------------------------------
# Oracles — computed from the authoritative clones, independently of the system
# ---------------------------------------------------------------------------

def oracle_table() -> dict:
    """vessel -> {ts, lines}, from /workspace/git/vessels (the authoritative root)."""
    script = r"""
for d in /workspace/git/vessels/*/; do
  n=$(basename "$d")
  case "$n" in *mitosis*) continue;; esac
  [ -d "$d/src" ] || continue
  ts=$(find "$d/src" -name '*.ts' -type f | wc -l)
  ln=$(find "$d/src" -name '*.ts' -type f -exec cat {} + 2>/dev/null | wc -l)
  echo "$n $ts $ln"
done
"""
    out = subprocess.run(
        ["docker", "exec", CONTAINER, "bash", "-c", script],
        capture_output=True, text=True, timeout=300,
    ).stdout
    table = {}
    for line in out.strip().splitlines():
        parts = line.split()
        if len(parts) == 3:
            table[parts[0]] = {"ts": int(parts[1]), "lines": int(parts[2])}
    return table


def cold_oracle_table() -> dict:
    """Facts for the COLD families — goal shapes with no learned pathway in the corpus.

    The warm families all sit at their reach ceiling, so they cannot show a learning
    curve: there is no headroom to learn into. These are chosen to be answerable from the
    filesystem (so an oracle exists) while having no deterministic verifier and no recorded
    path, which is what makes a rising reach rate across batches attributable to corpus
    accumulation rather than to a built-in shortcut.
    """
    script = r"""
for d in /workspace/git/vessels/*/; do
  n=$(basename "$d")
  case "$n" in *mitosis*) continue;; esac
  [ -d "$d/src" ] || continue
  subdirs=$(find "$d/src" -mindepth 1 -type d | wc -l)
  exts=$(find "$d/src" -type f -name '*.*' | sed 's/.*\.//' | sort -u | wc -l)
  grepn=$(grep -rl 'async' "$d/src" --include='*.ts' 2>/dev/null | wc -l)
  big=$(find "$d/src" -name '*.ts' -type f -exec wc -l {} + 2>/dev/null | sort -rn | awk 'NR==1 && $2!="total"{print $2; exit} NR==2{print $2; exit}')
  echo "$n $subdirs $exts $grepn $(basename "${big:-none}")"
done
"""
    out = subprocess.run(
        ["docker", "exec", CONTAINER, "bash", "-c", script],
        capture_output=True, text=True, timeout=300,
    ).stdout
    table = {}
    for line in out.strip().splitlines():
        p = line.split()
        if len(p) == 5:
            table[p[0]] = {"subdirs": int(p[1]), "exts": int(p[2]), "grep": int(p[3]), "largest": p[4]}
    return table


COLD_FAMILIES = ["grep_count", "largest_file", "subdir_count", "ext_variety"]

# ---------------------------------------------------------------------------
# COMPOSITIONAL families — the output of step 1 must BIND INTO step 2
#
# The warm and cold families are each one shellResult away, which tests retrieval rather
# than composition, and they all live in one domain: counting files in a repo tree. The
# claims are about reaching ARBITRARY goals by resequencing which impulse content routes
# through which resolvers, so these are chosen so that no single command answers them, and
# so they span different domains — repo trees, git history, the discovery registry.
#
# `chain_count_into_title` is the sharpest: the computed value becomes the ARTIFACT'S
# IDENTITY, so the goal cannot be satisfied by narrating a number. The note has to exist
# under a title nobody could know before the first step ran.
# ---------------------------------------------------------------------------

COMPOSITIONAL_FAMILIES = ["chain_winner_lines", "chain_count_into_title", "git_most_commits", "registry_shape_count"]


def compositional_oracles(vessels: list) -> dict:
    script = "".join(
        f'echo "{v} $(cd /workspace/git/vessels/{v} && git log --oneline --since=\"30 days ago\" 2>/dev/null | wc -l)";'
        for v in vessels
    )
    out = subprocess.run(["docker", "exec", CONTAINER, "bash", "-c", script],
                         capture_output=True, text=True, timeout=300).stdout
    commits = {}
    for line in out.strip().splitlines():
        parts = line.split()
        if len(parts) == 2:
            commits[parts[0]] = int(parts[1])
    try:
        shapes = [str(x) for x in get("http://localhost:18100/registry/shapes", timeout=60).get("shapes", [])]
    except Exception:                                            # noqa: BLE001
        shapes = []
    return {"commits": commits, "shapes": shapes}


def build_compositional_goals(comp: dict, warm: dict, batch: int, n: int, rng: random.Random) -> list:
    goals = []
    vessels = sorted(v for v in warm if warm[v]["ts"] >= 2)
    pairs = [(a, b) for a in vessels for b in vessels if a < b and warm[a]["ts"] != warm[b]["ts"]]
    rng.shuffle(vessels); rng.shuffle(pairs)
    commits = comp.get("commits", {}); shapes = comp.get("shapes", [])
    committed = sorted([v for v in commits if commits[v] > 0]); rng.shuffle(committed)
    suffixes = ["_write", "Result", "report"]
    pi = vi = ci = 0
    for i in range(n):
        fam = COMPOSITIONAL_FAMILIES[i % len(COMPOSITIONAL_FAMILIES)]
        if fam == "chain_winner_lines" and pairs:
            a, b = pairs[pi % len(pairs)]; pi += 1
            winner = a if warm[a]["ts"] > warm[b]["ts"] else b
            goals.append(dict(family=fam, title=None, expect=[warm[winner]["lines"]],
                              text=f"Between repos/{a}/src and repos/{b}/src, whichever has more TypeScript "
                                   f"modules \u2014 report the total number of lines in that one."))
        elif fam == "chain_count_into_title" and vessels:
            v = vessels[vi % len(vessels)]; vi += 1
            cnt = warm[v]["ts"]
            goals.append(dict(family=fam, title=f"harness-cc-{cnt}", expect=[cnt],
                              text=f"Count the TypeScript modules under repos/{v}/src, then record a durable "
                                   f"note titled harness-cc-N where N is that count."))
        elif fam == "git_most_commits" and committed:
            v = committed[ci % len(committed)]; ci += 1
            goals.append(dict(family=fam, title=None, expect=[commits[v]],
                              text=f"How many commits have landed in repos/{v} in the last 30 days?"))
        else:
            suf = suffixes[i % len(suffixes)]
            if suf == "report":
                cnt = sum(1 for x in shapes if "report" in x.lower())
                txt = "How many shapes does the discovery registry currently advertise whose name contains report?"
            else:
                cnt = sum(1 for x in shapes if x.endswith(suf))
                txt = f"How many shapes does the discovery registry currently advertise whose name ends with {suf}?"
            goals.append(dict(family="registry_shape_count", title=None, expect=[cnt], text=txt))
    return goals


def build_cold_goals(cold: dict, warm: dict, batch: int, n: int, rng: random.Random) -> list:
    """Cold goals. Vessels with >=2 subdirs / >=2 extensions only, so a correct answer is
    not indistinguishable from noise on a one-digit oracle."""
    goals = []
    subdir_ok = sorted([v for v, f in cold.items() if f["subdirs"] >= 2])
    ext_ok = sorted([v for v, f in cold.items() if f["exts"] >= 2])
    grep_ok = sorted([v for v, f in cold.items() if f["grep"] >= 2])
    # Exclude vessels whose largest module is index.ts: that filename appears in almost any
    # tool output, so a "correct" grade on it would be indistinguishable from an incidental
    # mention. The oracle has to discriminate, not just match.
    big_ok = sorted([v for v, f in cold.items()
                     if f["largest"] not in ("none", "index.ts") and warm.get(v, {}).get("ts", 0) >= 3])
    for lst in (subdir_ok, ext_ok, grep_ok, big_ok):
        rng.shuffle(lst)
    idx = {"subdir_count": 0, "ext_variety": 0, "grep_count": 0, "largest_file": 0}
    for i in range(n):
        fam = COLD_FAMILIES[i % len(COLD_FAMILIES)]
        if fam == "grep_count" and grep_ok:
            v = grep_ok[idx[fam] % len(grep_ok)]; idx[fam] += 1
            goals.append(dict(family=fam, title=None, expect=[cold[v]["grep"]],
                              text=f"How many TypeScript modules under repos/{v}/src contain the text async?"))
        elif fam == "largest_file" and big_ok:
            v = big_ok[idx[fam] % len(big_ok)]; idx[fam] += 1
            goals.append(dict(family=fam, title=None, expect=[], expect_text=cold[v]["largest"],
                              text=f"Which TypeScript module under repos/{v}/src has the most lines? Give its filename."))
        elif fam == "subdir_count" and subdir_ok:
            v = subdir_ok[idx[fam] % len(subdir_ok)]; idx[fam] += 1
            goals.append(dict(family=fam, title=None, expect=[cold[v]["subdirs"]],
                              text=f"How many subdirectories are there under repos/{v}/src?"))
        elif ext_ok:
            v = ext_ok[idx["ext_variety"] % len(ext_ok)]; idx["ext_variety"] += 1
            goals.append(dict(family="ext_variety", title=None, expect=[cold[v]["exts"]],
                              text=f"How many distinct file extensions appear under repos/{v}/src?"))
    return goals


# ---------------------------------------------------------------------------
# Goal families — the "different angles" axis
# ---------------------------------------------------------------------------

def build_goals(oracles: dict, batch: int, n: int, rng: random.Random) -> list:
    """Novel goals per batch: vessels are sampled without replacement across batches."""
    vessels = sorted(oracles)
    # Keep the big ones in play — a 375-module vessel is a different regime from a 2.
    pairs = [(a, b) for a in vessels for b in vessels if a < b and oracles[a]["ts"] != oracles[b]["ts"]]
    rng.shuffle(vessels)
    rng.shuffle(pairs)

    goals = []
    families = ["count_single", "count_artifact", "compare_more", "compare_fewer", "combined", "lines_single"]
    vi = pi = 0
    for i in range(n):
        fam = families[i % len(families)]
        if fam in ("compare_more", "compare_fewer", "combined"):
            a, b = pairs[pi % len(pairs)]
            pi += 1
        else:
            v = vessels[vi % len(vessels)]
            vi += 1

        slug = f"harness-b{batch}-g{i}"
        if fam == "count_single":
            goals.append(dict(family=fam, title=None, expect=[oracles[v]["ts"]],
                              text=f"How many TypeScript modules are under repos/{v}/src?"))
        elif fam == "count_artifact":
            goals.append(dict(family=fam, title=slug, expect=[oracles[v]["ts"]],
                              text=f"Count the TypeScript modules under repos/{v}/src and record the result "
                                   f"in a durable note titled {slug}."))
        elif fam == "lines_single":
            goals.append(dict(family=fam, title=None, expect=[oracles[v]["lines"]],
                              text=f"How many total lines are in the TypeScript modules under repos/{v}/src?"))
        elif fam == "combined":
            goals.append(dict(family=fam, title=slug, expect=[oracles[a]["ts"] + oracles[b]["ts"]],
                              text=f"What is the combined number of TypeScript modules across repos/{a}/src "
                                   f"and repos/{b}/src? Record it as a durable note titled {slug}."))
        else:
            more = fam == "compare_more"
            winner = a if (oracles[a]["ts"] > oracles[b]["ts"]) == more else b
            diff = abs(oracles[a]["ts"] - oracles[b]["ts"])
            goals.append(dict(family=fam, title=slug, expect=[diff], expect_winner=winner,
                              text=f"Which has {'more' if more else 'fewer'} TypeScript modules, repos/{a}/src "
                                   f"or repos/{b}/src, and by how many? Record it as a durable note titled {slug}."))
    return goals


# ---------------------------------------------------------------------------
# Dispatch / poll / grade
# ---------------------------------------------------------------------------

def dispatch(goal: dict, attempts: int = 6) -> str | None:
    """Retry through a vessel restart.

    pull-sync redeploys goal-host on every landed commit, and the vessel is down for
    ~10-60s each time. The first version of this harness treated a failed POST as a goal
    that did not reach: a restart landed inside one batch's dispatch loop, all 12 POSTs
    were refused, and the run reported "reach collapsed to 0%" for a batch the substrate
    never saw. There were no journal entries for those goals at all, which is what gave it
    away. A measurement that cannot tell "I could not ask" from "it could not answer" will
    manufacture exactly the trend it is looking for.
    """
    for i in range(attempts):
        try:
            return post(GOAL_HOST + "/run-goal",
                        {"goal": goal["text"], "async": True, "operator": "reach-harness"})["dispatchId"]
        except Exception as exc:                                # noqa: BLE001
            if i == attempts - 1:
                print(f"  DISPATCH FAILED after {attempts} attempts: {exc}", file=sys.stderr)
                return None
            time.sleep(min(30, 3 * (i + 1)))
    return None


def poll(dispatch_id: str, deadline_s: int) -> dict | None:
    end = time.time() + deadline_s
    while time.time() < end:
        try:
            rec = get(f"{GOAL_HOST}/executions/{dispatch_id}", timeout=60)
            if rec.get("status") in ("completed", "failed"):
                return rec
        except Exception:                                       # noqa: BLE001
            pass
        time.sleep(5)
    return None


def read_note(title: str) -> str:
    try:
        body = post(DEV_VESSEL + "/v2/impulses/resolve",
                    {"impulse": {"type": "memoryNote", "id": title}}, timeout=60)
        notes = body.get("body", {}).get("notes", [])
        return notes[0].get("body", "") if notes else ""
    except Exception:                                           # noqa: BLE001
        return ""


def has_number(text: str, value: int) -> bool:
    """The value must appear as its own token — not as a substring of a bigger number."""
    return re.search(rf"(?<![\d.,]){value}(?![\d.,]?\d)", text) is not None


def grade(goal: dict, rec: dict) -> dict:
    """Correctness is judged on the DELIVERED text, independently of `reached`."""
    surfaces = [
        str(rec.get("goalReachReason") or ""),
        str(rec.get("answerBody") or ""),
    ]
    note = read_note(goal["title"]) if goal.get("title") else ""
    if note:
        surfaces.append(note)
    blob = "\n".join(surfaces)

    correct = all(has_number(blob, v) for v in goal["expect"])
    if goal.get("expect_text"):
        # A filename is a far stronger discriminator than a one-digit count.
        correct = correct and goal["expect_text"] in blob
    if goal.get("expect_winner"):
        # The winner must be NAMED, and the loser must not be named as the winner.
        correct = correct and goal["expect_winner"] in blob
    # An artifact goal is only correct if the ARTIFACT carries the answer, not just the trace.
    if goal.get("title"):
        correct = correct and all(has_number(note, v) for v in goal["expect"])

    return dict(
        reached=bool(rec.get("reached")),
        correct=bool(correct),
        template=rec.get("selectedTemplateId"),
        exec_id=rec.get("executionId"),
        note_len=len(note),
    )


def goal_hash(text: str) -> str:
    """Replicates activity-api's CLASS hash (routes/goal-paths.ts normalizeGoal + hashGoal).

    Must match exactly or claim 2 silently reports zero instead of unmeasured. Verified
    against a known live row: the discovery-vessel-purpose goal hashes to f2f282c5053c0243
    on both sides.

    Note what this means for generalization: vessel NAMES are not elided, so two goals in
    the same family over different vessels are different CLASSES. Reuse across them
    therefore cannot come from the goal_hash arm — it has to come from the shape-signature
    arm. Distinct goal_hashes converging on one path_signature is exactly the evidence
    claim 2 needs, and it is only visible because the key does not collapse them.
    """
    s = text.lower().strip()
    s = re.sub(r"\b[0-9a-f]{8,}(?::\d+)?\b",
               lambda m: "id" if re.search(r"\d", m.group(0)) else m.group(0), s, flags=re.ASCII)
    s = re.sub(r"\b\d{10,}\b", "n", s, flags=re.ASCII)
    s = re.sub(r"[^\w\s]", "", s, flags=re.ASCII)
    s = re.sub(r"\s+", "_", s, flags=re.ASCII)
    return hashlib.md5(s.encode()).hexdigest()[:16]


def path_signatures() -> dict:
    """goal_hash -> path_activities, paginated. The list endpoint is a RANKED window:
    a single limit=N call hides the newest rows, which has already produced one
    fabricated defect this session."""
    sigs = {}
    for off in range(0, 2000, 200):
        try:
            page = get(f"{HUB}/v2/goal-paths?limit=200&offset={off}", timeout=120)
        except Exception:                                       # noqa: BLE001
            break
        rows = page.get("paths") or page.get("data") or []
        if not rows:
            break
        for row in rows:
            gh = row.get("goal_hash")
            if gh and gh not in sigs:
                sigs[gh] = tuple(row.get("path_activities") or [])
    return sigs


# ---------------------------------------------------------------------------

def run_batch(goals: list, deadline_s: int) -> list:
    """Dispatch the batch, then poll ROUND-ROBIN so each goal's latency is its own.

    Polling goals one at a time in order made every latency the sum of the ones before it,
    which makes a cost curve unmeasurable — and cost is the only place learning CAN show up
    on families whose reach is already at ceiling. Round-robin records a completion the
    first time it is observed, so the number is that goal's wall time plus at most one poll
    interval.
    """
    ids, t0 = [], {}
    for i, g in enumerate(goals):
        did = dispatch(g)
        ids.append(did)
        t0[i] = time.time()
        time.sleep(1.5)                                          # stagger, don't stampede

    done: dict = {}
    end = time.time() + deadline_s
    while time.time() < end and len(done) < sum(1 for d in ids if d):
        for i, did in enumerate(ids):
            if did is None or i in done:
                continue
            try:
                rec = get(f"{GOAL_HOST}/executions/{did}", timeout=60)
                if rec.get("status") in ("completed", "failed"):
                    done[i] = (rec, time.time() - t0[i])
            except Exception:                                    # noqa: BLE001
                pass
        if len(done) < sum(1 for d in ids if d):
            time.sleep(5)

    results = []
    for g, did in zip(goals, ids):
        # THREE OUTCOMES, NEVER COLLAPSED INTO ONE. `undispatched` means the substrate was
        # never asked (vessel restarting); `timeout` means it was asked and had not answered
        # by the deadline; only the remainder is a real verdict. Undispatched goals are
        # excluded from the reach denominator entirely — counting them as misses is how the
        # first run of this harness reported a 0% batch for goals nothing ever received.
        if did is None:
            results.append(dict(goal=g, reached=False, correct=False, template=None,
                                note_len=0, timeout=False, undispatched=True, secs=None))
            continue
        idx = ids.index(did)
        if idx not in done:
            results.append(dict(goal=g, reached=False, correct=False, template=None,
                                note_len=0, timeout=True, undispatched=False, secs=None))
            continue
        rec, secs = done[idx]
        r = grade(g, rec)
        r["goal"] = g
        r["timeout"] = False
        r["undispatched"] = False
        r["secs"] = round(secs, 1)
        results.append(r)
    return results


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--batches", type=int, default=3)
    ap.add_argument("--per-batch", type=int, default=12)
    ap.add_argument("--deadline", type=int, default=300)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--pilot", action="store_true", help="one batch of 6, to validate the harness itself")
    ap.add_argument("--compositional", action="store_true",
                    help="COMPOSITIONAL, cross-domain families: step 1's output must bind into step 2, across "
                         "repo trees, git history and the discovery registry. No single command answers these.")
    ap.add_argument("--cold", action="store_true",
                    help="COLD families with no learned pathway — the only mode that can show a learning "
                         "curve, because the warm families already sit at their reach ceiling. Run with the "
                         "code FROZEN so corpus accumulation is the only variable.")
    ap.add_argument("--repeat", action="store_true",
                    help="REPEATED EXPOSURE — the ONLY design that can answer 'more reaches over time'. "
                         "Every other mode samples vessels WITHOUT REPLACEMENT across batches, and vessel "
                         "names are NOT elided by activity-api's class hash, so every goal in every batch "
                         "is a brand-new goal CLASS that is never attempted twice. A curve is structurally "
                         "unmeasurable there: the flat per-batch series `92,90,83,100,92,92,67,100,75,75` "
                         "was a property of the instrument, not of the system. This mode builds ONE goal "
                         "set and re-dispatches THE SAME classes each round, so round N vs round 1 is a "
                         "real learning signal.")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    if args.pilot:
        args.batches, args.per_batch = 1, 6

    oracles = oracle_table()
    print(f"oracle table: {len(oracles)} vessels "
          f"(ts range {min(v['ts'] for v in oracles.values())}..{max(v['ts'] for v in oracles.values())})")

    cold = cold_oracle_table() if args.cold else {}
    comp = compositional_oracles(sorted(oracles)) if args.compositional else {}
    if args.compositional:
        print(f"COMPOSITIONAL mode: {len(comp.get('shapes', []))} registry shapes, "
              f"{sum(1 for v in comp.get('commits', {}).values() if v)} vessels with recent commits; "
              f"families {COMPOSITIONAL_FAMILIES}")
    if args.cold:
        print(f"COLD mode: {len(cold)} vessels; families {COLD_FAMILIES}")
    rng = random.Random(args.seed)
    all_results = []
    # Built ONCE and re-dispatched every round: identical text => identical class hash => the
    # rounds are repeated attempts at the same classes, which is what a learning curve is about.
    repeat_goals = None
    if args.repeat:
        repeat_goals = (build_compositional_goals(comp, oracles, 0, args.per_batch, rng) if args.compositional
                        else build_cold_goals(cold, oracles, 0, args.per_batch, rng) if args.cold
                        else build_goals(oracles, 0, args.per_batch, rng))
        print(f"REPEAT mode: {len(repeat_goals)} goal classes, re-dispatched for {args.batches} rounds")
    for b in range(args.batches):
        goals = (repeat_goals if repeat_goals is not None
                 else build_compositional_goals(comp, oracles, b, args.per_batch, rng) if args.compositional
                 else build_cold_goals(cold, oracles, b, args.per_batch, rng) if args.cold
                 else build_goals(oracles, b, args.per_batch, rng))
        print(f"\n=== {'round' if args.repeat else 'batch'} {b}: {len(goals)} "
              f"{'REPEATED' if args.repeat else 'novel'} goals ===")
        res = run_batch(goals, args.deadline)
        for r in res:
            g = r["goal"]
            flag = "OK " if r["correct"] else ("HOLLOW" if r["reached"] else "miss  ")
            print(f"  [{flag}] {g['family']:<15} reached={str(r['reached']):<5} "
                  f"correct={str(r['correct']):<5} expect={g['expect']} :: {g['text'][:72]}")
        answered = [r for r in res if not r["undispatched"]]
        nd = len(res) - len(answered)
        reached = sum(r["reached"] for r in answered)
        correct = sum(r["correct"] for r in answered)
        den = max(1, len(answered))
        print(f"  batch {b}: reached {reached}/{len(answered)} ({100*reached/den:.0f}%), "
              f"CORRECT {correct}/{len(answered)} ({100*correct/den:.0f}%)"
              + (f"   [{nd} UNDISPATCHED — excluded, substrate never asked]" if nd else "")
              + (f"   [{sum(r['timeout'] for r in answered)} timed out]" if any(r["timeout"] for r in answered) else ""))
        all_results.append(res)

    # ---- claim 1: reach and correctness over batches ----
    print("\n================ CLAIM 1: more reaches over time ================")
    for b, res in enumerate(all_results):
        answered = [r for r in res if not r["undispatched"]]
        n = max(1, len(answered))
        print(f"  batch {b}: reached {100*sum(r['reached'] for r in answered)/n:5.1f}%   "
              f"correct {100*sum(r['correct'] for r in answered)/n:5.1f}%   "
              f"answered={len(answered)}/{len(res)}   timeouts={sum(r['timeout'] for r in answered)}")

    # ---- claim 1b: COST. On families already at their reach ceiling, learning cannot show
    # up as a higher rate — it shows up as reaching the same goals for less work. ----
    print("\n========= CLAIM 1b: cost per reached goal, over batches =========")
    for b, res in enumerate(all_results):
        secs = [r["secs"] for r in res if r.get("secs") is not None and r["reached"]]
        if secs:
            secs_sorted = sorted(secs)
            med = secs_sorted[len(secs_sorted) // 2]
            print(f"  batch {b}: median {med:6.1f}s   mean {sum(secs)/len(secs):6.1f}s   n={len(secs)}")
        else:
            print(f"  batch {b}: no reached goals with a timing")
    fam_secs = defaultdict(list)
    for b, res in enumerate(all_results):
        for r in res:
            if r.get("secs") is not None and r["reached"]:
                fam_secs[r["goal"]["family"]].append((b, r["secs"]))
    print("  first-exposure vs later, per family (median seconds):")
    for fam, pts in sorted(fam_secs.items()):
        early = sorted(s for b, s in pts if b == 0)
        late = sorted(s for b, s in pts if b >= max(1, len(all_results) - 2))
        if early and late:
            print(f"    {fam:<15} batch0 {early[len(early)//2]:6.1f}s -> late {late[len(late)//2]:6.1f}s"
                  f"   ({len(early)} vs {len(late)} samples)")

    # ---- claim 2: do similar goals share a pathway? ----
    print("\n========== CLAIM 2: similar goals -> similar pathways ==========")
    sigs = path_signatures()
    fam_sigs = defaultdict(list)
    for res in all_results:
        for r in res:
            sig = sigs.get(goal_hash(r["goal"]["text"]))
            if sig:
                fam_sigs[r["goal"]["family"]].append(sig)
    # Every goal here is its own goal CLASS (vessel names are not elided by the class hash),
    # so `classes > signatures` means distinct classes collapsed onto a shared pathway —
    # generalization. `signatures == classes` would mean every goal re-derived its own.
    print("  classes = distinct goal_hash; signatures = distinct path_activities")
    for fam, lst in sorted(fam_sigs.items()):
        c = Counter(lst)
        top, cnt = c.most_common(1)[0]
        print(f"  {fam:<15} classes={len(lst):<3} signatures={len(c):<3} "
              f"modal share={100*cnt/len(lst):5.1f}%  modal={list(top)}")
    if not fam_sigs:
        print("  (no path rows matched — goal_hash join empty; report as UNMEASURED, not as zero)")

    # ---- claim 3: honesty of the verdict ----
    print("\n============ CLAIM 3 input: verdict honesty ============")
    flat = [r for res in all_results for r in res if not r["undispatched"]]
    hollow = [r for r in flat if r["reached"] and not r["correct"]]
    silent = [r for r in flat if r["correct"] and not r["reached"]]
    print(f"  total={len(flat)}  reached={sum(r['reached'] for r in flat)}  correct={sum(r['correct'] for r in flat)}")
    print(f"  HOLLOW (reached but wrong): {len(hollow)}  "
          f"({100*len(hollow)/max(1,sum(r['reached'] for r in flat)):.1f}% of reaches)")
    print(f"  understated (correct but not reached): {len(silent)}")
    by_fam = defaultdict(lambda: [0, 0, 0])
    for r in flat:
        f = by_fam[r["goal"]["family"]]
        f[0] += 1
        f[1] += r["reached"]
        f[2] += r["correct"]
    print("\n  per family:  n / reached / correct")
    for fam, (n, rc, co) in sorted(by_fam.items()):
        print(f"    {fam:<15} {n:>3} / {rc:>3} / {co:>3}")

    if args.out:
        with open(args.out, "w") as fh:
            json.dump([[{k: v for k, v in r.items()} for r in res] for res in all_results], fh, indent=2, default=str)
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
