#!/usr/bin/env python3
"""vidkit — capture and compose a bring-up recording from REAL artifacts.

This is not a screen recorder. It captures three independent real streams while a
bring-up path actually runs, then composes them into one video:

  run    <tag> -- <cmd...>   run a command, stream its output to the terminal log,
                             timestamped and REDACTED at the tee (a secret must never
                             reach a frame).
  ui     <tag> <url>         background loop: headless-firefox screenshot every UI_EVERY
                             seconds into frames/ui/<tag>/<epoch>.png
  stats  <tag>               background loop: docker/systemd/registry status into
                             status/<tag>/<epoch>.txt
  say    <tag> <text>        write an operator caption into the terminal log
  compose <tag> [tag...]     render the terminal log to frames, pair each with the
                             UI screenshot in force at that moment, and encode.

Time is real throughout: every frame carries the wall-clock at which its content was
true, and compose() states the speed-up factor on screen.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "logs"
FRAMES = ROOT / "frames"
STATUS = ROOT / "status"
FFPROF = ROOT / "ffprof"
for d in (LOGS, FRAMES, STATUS, FFPROF):
    d.mkdir(parents=True, exist_ok=True)

FONT = "/usr/share/fonts/TTF/JetBrainsMonoNerdFontMono-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/TTF/JetBrainsMonoNerdFontMono-Bold.ttf"
UI_EVERY = float(os.environ.get("UI_EVERY", "5"))
STATS_EVERY = float(os.environ.get("STATS_EVERY", "10"))
# Seconds of video held on each segment's final state so its verdict is readable.
HOLD_SECS = float(os.environ.get("HOLD_SECS", "4"))
# Minimum video seconds any single record stays on screen before the next arrives.
MIN_DWELL = float(os.environ.get("MIN_DWELL", "0.35"))

# ── Redaction ───────────────────────────────────────────────────────────────
# Two independent rules, the same shape as ui-only-up.sh's redact(): a NAME rule
# (anything that looks like an assignment to a secret-ish name) and a VALUE rule
# (known credential prefixes). The second exists to catch a secret that arrives
# under a name the first does not match. Applied at the tee, so no downstream
# consumer — log, frame, or video — can ever see the cleartext.
_NAME = re.compile(
    r"\b([A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|APIKEY|PAT)[A-Za-z0-9_]*)(\s*[=:]\s*\"?)"
    r"([^\s\"',]{6,})",
    re.I,
)
# `PAT` as a case-insensitive substring also matches PATH, and a video whose every
# frame reads `PATH=<redacted>` is unreadable. These names are never secret.
_NAME_SAFE = {"PATH", "LD_LIBRARY_PATH", "PYTHONPATH", "MANPATH", "GOPATH", "CLASSPATH",
              "INFOPATH", "XDG_DATA_DIRS", "PATHEXT", "KEYBOARD", "KEYMAP"}
_VALUE = re.compile(
    r"\b((?:sk-ant-|sk-proj-|sk-|gho_|ghp_|ghu_|ghs_|github_pat_|mb-|eyJ)[A-Za-z0-9_\-\.]{8,})"
)
# An opaque credential with no recognisable prefix still announces itself by the
# header it rides in. Without this, `Authorization: ApiKey <32 hex>` survives both
# rules above — confirmed empirically before this line existed.
_AUTH = re.compile(r"((?:Authorization|X-Api-Key)\s*:\s*(?:ApiKey|Bearer|Token)?\s*)(\S{8,})", re.I)
# Credentials in URL userinfo (a datastore DSN is the usual carrier).
_USERINFO = re.compile(r"(://[^/\s:@]{1,64}):([^/\s@]{1,128})@")


def _name_sub(m: re.Match) -> str:
    if m.group(1).upper() in _NAME_SAFE:
        return m.group(0)
    return m.group(1) + m.group(2) + "<redacted>"


_ANSI = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')


def redact(line: str) -> str:
    # Colour codes have no glyph in the render font: substrate-doctor's green PASS
    # and red FAIL arrived on screen as literal "[32mPASS[0m" boxes.
    line = _ANSI.sub('', line)
    line = _NAME.sub(_name_sub, line)
    line = _AUTH.sub(lambda m: m.group(1) + "<redacted>", line)
    line = _USERINFO.sub(lambda m: m.group(1) + ":<redacted>@", line)
    # WHOLESALE, not prefix-preserving. This used to keep `m.group(1)[:6]`, which is
    # harmless for a 7-char marker like `sk-ant-` and NOT harmless for `mb-`: it would
    # publish three characters of a real key. Six characters of a secret is still
    # secret material, and the name-rule next to it already replaces values outright.
    line = _VALUE.sub("<redacted>", line)
    # Tabs have no glyph in the render font and draw as a missing-character box,
    # which turns `docker ps`'s columns into noise. Expand before anything stores it.
    return line.expandtabs(4)


# ── Capture ─────────────────────────────────────────────────────────────────
def _append(tag: str, kind: str, text: str) -> None:
    rec = {"t": time.time(), "kind": kind, "text": redact(text.rstrip("\n"))}
    with (LOGS / f"{tag}.jsonl").open("a") as fh:
        fh.write(json.dumps(rec) + "\n")


def cmd_run(tag: str, argv: list[str]) -> int:
    """Run argv, tee-ing redacted output into the terminal log.

    The command line itself is logged redacted too. Secrets are passed through the
    ENVIRONMENT by the caller, never argv — argv is visible in `ps` as well as here.
    """
    _append(tag, "cmd", "$ " + " ".join(argv))
    t0 = time.time()
    limit = float(os.environ.get("RUN_TIMEOUT", "900"))
    proc = subprocess.Popen(
        argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1
    )
    assert proc.stdout is not None
    # A hung child would otherwise stall the whole recording with no frame ever
    # showing why. Bound the drain AND the wait, and record the kill as content:
    # a visible "[KILLED after Ns]" is a truthful frame, a frozen video is not.
    killed = False
    for line in proc.stdout:
        clean = redact(line.rstrip("\n"))
        print(clean, flush=True)
        _append(tag, "out", clean)
        if time.time() - t0 > limit:
            proc.kill()
            killed = True
            break
    try:
        rc = proc.wait(timeout=30)
    except subprocess.TimeoutExpired:
        proc.kill()
        rc = -9
        killed = True
    elapsed = time.time() - t0
    if killed:
        _append(tag, "rc", f"[KILLED after {elapsed:.0f}s — exceeded RUN_TIMEOUT={limit:.0f}s]")
    else:
        _append(tag, "rc", f"[exit {rc} after {elapsed:.0f}s]")
    return rc


def cmd_say(tag: str, text: str) -> None:
    _append(tag, "say", text)
    print(f"## {text}", flush=True)


def cmd_verdict(tag: str) -> None:
    """Emit a closing caption COMPUTED from this tag's own captured stdout.

    The first cut of this film hand-wrote its verdicts. Path B's caption said
    "FOUR checks failed — readiness, surrealdb, activity-api, llm arms. Count them
    from the output above, not from my summary." Five had failed. The unnamed one
    was `FAIL failed units: bootstrap-seeder.service`, and it is exactly the one
    the "a spoke masks these datastores" argument cannot absorb — path C's seeder
    ran clean, so B's failure was substantive and unique to B, and my summary
    silently dropped it. A line inviting the viewer to check my count, printed as
    a constant regardless of the output above it, is worse than no claim.

    So: read the records this tag actually wrote, take the doctor's own verdict
    lines, and name every one. The caption cannot disagree with the frame it sits
    under, because it is derived from it.

    Readiness is counted separately ON PURPOSE — `[ready] NOT ready:` prints
    neither PASS nor FAIL, so a grep for those two words cannot see it, which is
    the trap the path scripts already narrate.
    """
    parts = _counted_failures(tag)
    n = len(parts)
    if n == 0:
        cmd_say(tag, "counted from the output above: no doctor check reported FAIL.")
        return
    word = {1: "ONE", 2: "TWO", 3: "THREE", 4: "FOUR", 5: "FIVE", 6: "SIX", 7: "SEVEN"}.get(n, str(n))
    cmd_say(tag, f"{word} check(s) failed. This list is counted from the output above, not written by hand:")
    for i, p in enumerate(parts, 1):
        cmd_say(tag, f"  {i}. {p}")


def _counted_failures(tag: str) -> list[str]:
    """The same list `cmd_verdict` prints — the single source of truth for narration."""
    path = LOGS / f"{tag}.jsonl"
    fails: list[str] = []
    ready: str | None = None
    if path.exists():
        for ln in path.read_text(errors="replace").splitlines():
            try:
                rec = json.loads(ln)
            except Exception:
                continue
            if rec.get("kind") != "out":
                continue
            text = _ANSI.sub("", str(rec.get("text", ""))).strip()
            # A tag can contain SEVERAL doctor runs. Unioning their FAIL lines means a
            # check that failed early and passed on the closing run is still narrated
            # as failing "from the output above" — the caption would then describe a
            # frame that says PASS. Restart the accumulation at each run boundary so
            # membership is the LAST run's, which is the one the viewer is looking at.
            if "substrate doctor" in text.lower() or text.startswith("== 1."):
                fails.clear()
                ready = None
            if text.startswith("FAIL "):
                item = text[5:].strip()
                if item not in fails:
                    fails.append(item)
            m = re.search(r"NOT ready: (\d+) unit\(s\) down", text)
            if m:
                ready = m.group(1)
    out = []
    if ready:
        out.append(f"fleet readiness ({ready} unit(s) down)")
    out.extend(fails)
    return out


def _counted_failures_note() -> str:
    """Why membership is per-run, not a union — see `_counted_failures`."""
    return "the LAST doctor run in this tag, not every run it ever made"


def cmd_ifcounted(tag: str, needle: str, if_present: str, if_absent: str = "") -> None:
    """Speak a line ONLY if the computed failure list actually contains `needle`.

    THE CLASS FIX, after patching the same defect four times. `cmd_verdict` made the
    COUNTS honest and left every other sentence free to assume which failures occurred.
    So the bugs kept moving: a wrong count, then an asserted failure ("the seeder
    failure is NOT covered by that argument" on a run with no seeder failure), then a
    commentary on "the readiness item above" on a run where readiness passed, then a
    closer saying "the two counted failures" over a list of one.

    Every one of those was me writing a sentence about a PREVIOUS run's failure set.
    A narration that reasons about which failures occurred must read the same list the
    viewer is looking at, or it is a guess with good grammar.
    """
    items = _counted_failures(tag)
    hit = any(needle.lower() in i.lower() for i in items)
    text = if_present if hit else if_absent
    if text:
        cmd_say(tag, text)


def cmd_countword(tag: str) -> None:
    """Print the count as a word, for a sentence that needs to name it."""
    n = len(_counted_failures(tag))
    word = {0: "no", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six"}.get(n, str(n))
    cmd_say(tag, f"({word} counted failure(s) above)")


def cmd_ui(tag: str, url: str) -> None:
    """Screenshot `url` every UI_EVERY seconds until killed.

    One firefox profile, one shot at a time: overlapping launches on a shared
    profile lock-error and leave gaps in the frame series.
    """
    out = FRAMES / "ui" / tag
    out.mkdir(parents=True, exist_ok=True)
    FFPROF.mkdir(parents=True, exist_ok=True)
    errlog = LOGS / f"{tag}.ui-errors"
    env = dict(os.environ, MOZ_HEADLESS="1", HOME=str(FFPROF))
    while True:
        stamp = int(time.time())
        dest = out / f"{stamp}.png"
        # PROBE BEFORE LAUNCHING. A docker-published port whose in-container listener
        # does not exist yet ACCEPTS the TCP connection (docker-proxy) and then never
        # answers, so firefox blocks until killed — 60s per attempt, every attempt,
        # for the whole pre-install phase. Measured: 5 attempts, 5 timeouts, and the
        # surface came up in the last 30s of the run with no attempt left to catch it.
        # curl with a short deadline turns that 60s hang into a 3s answer, which keeps
        # the poller in step and lets it photograph the surface the moment it lives.
        try:
            probe = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "3", url],
                capture_output=True, text=True, timeout=8)
            serving = probe.stdout.strip() == "200"
        except Exception:
            serving = False
        if not serving:
            with errlog.open("a") as fh:
                fh.write(f"{stamp} not-serving-yet\n")
            time.sleep(UI_EVERY)
            continue
        # SCREENSHOT WITH A BROWSER THAT WAITS FOR THE PAGE'S OWN FETCHES.
        #
        # `firefox --headless --screenshot` captures at the LOAD EVENT, before any
        # client-side request resolves. The surface is a React app that fetches its
        # board and its shape vocabulary after load, so every firefox capture showed
        # the pre-fetch placeholder — "Reading the board…" — no matter what the
        # substrate was doing. Proof: three captures taken against two different
        # substrates, one of them demonstrably holding seven runs, were BYTE-IDENTICAL
        # (md5 f61d39b8…). The UI pane was reporting the screenshotter's timing, not
        # the fleet's state.
        #
        # Chrome's --virtual-time-budget advances a SIMULATED clock until the page
        # settles, so the capture contains the data. It is simulated time, so a 5s
        # budget costs ~1s of wall clock — faster than firefox as well as correct.
        prof = tempfile.mkdtemp(prefix="chrome-", dir=str(FFPROF))
        try:
            r = subprocess.run(
                ["google-chrome-stable", "--headless=new", "--disable-gpu", "--no-sandbox",
                 "--hide-scrollbars", "--virtual-time-budget=6000",
                 "--window-size=980,1240", f"--screenshot={dest}",
                 f"--user-data-dir={prof}", url],
                env=env, timeout=60,
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            )
            if not dest.exists():
                with errlog.open("a") as fh:
                    fh.write(f"{stamp} no-screenshot rc={r.returncode} "
                             f"{(r.stderr or b'').decode()[:200].strip()}\n")
        except subprocess.TimeoutExpired:
            with errlog.open("a") as fh:
                fh.write(f"{stamp} timeout after 60s\n")
        finally:
            shutil.rmtree(prof, ignore_errors=True)
        time.sleep(UI_EVERY)


STATUS_CMDS = [
    ("containers", ["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"]),
]


def cmd_stats(tag: str, container: str, ports: str) -> None:
    """Periodic third-stream capture: what the fleet looks like from outside."""
    out = STATUS / tag
    out.mkdir(parents=True, exist_ok=True)
    port_list = [p for p in ports.split(",") if p]
    while True:
        stamp = int(time.time())
        chunks = []
        for title, argv in STATUS_CMDS:
            try:
                r = subprocess.run(argv, capture_output=True, text=True, timeout=15)
                chunks.append(f"== {title} ==\n{r.stdout.strip()}")
            except Exception as exc:  # a status probe must never stop the stream
                chunks.append(f"== {title} ==\n<{exc}>")
        try:
            r = subprocess.run(
                ["docker", "exec", container, "systemctl", "list-units",
                 "--type=service", "--state=running", "--no-legend", "--no-pager"],
                capture_output=True, text=True, timeout=20)
            names = [ln.split()[0] for ln in r.stdout.splitlines() if ln.strip()]
            chunks.append(f"== units running in {container} ({len(names)}) ==\n" +
                          "\n".join(f"  {n}" for n in sorted(names)))
        except Exception as exc:
            chunks.append(f"== units in {container} ==\n<{exc}>")
        health = []
        for p in port_list:
            try:
                r = subprocess.run(
                    ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                     "-m", "3", f"http://127.0.0.1:{p}/health"],
                    capture_output=True, text=True, timeout=6)
                health.append(f"  :{p} -> {r.stdout.strip() or '000'}")
            except Exception:
                health.append(f"  :{p} -> timeout")
        chunks.append("== host port health ==\n" + "\n".join(health))
        (out / f"{stamp}.txt").write_text(redact("\n\n".join(chunks)))
        time.sleep(STATS_EVERY)


# ── Compose ─────────────────────────────────────────────────────────────────
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

W, H = 1920, 1080
LEFT_W = 1080          # terminal pane
RIGHT_W = W - LEFT_W   # UI pane
BG = (11, 14, 20)
FG = (200, 211, 224)
DIM = (120, 133, 150)
ACCENT = (126, 200, 227)
SAY = (240, 200, 120)
OK = (140, 205, 140)
BAR_H = 64

FS = 15
LINE_H = 19
TERM_LINES = (H - BAR_H - 24) // LINE_H

_f = ImageFont.truetype(FONT, FS)
_fb = ImageFont.truetype(FONT_BOLD, FS)
_fbig = ImageFont.truetype(FONT_BOLD, 22)
_fsmall = ImageFont.truetype(FONT, 13)


def _wrap(text: str, cols: int) -> list[str]:
    out = []
    for raw in text.split("\n"):
        if not raw:
            out.append("")
        while len(raw) > cols:
            out.append(raw[:cols])
            raw = raw[cols:]
        if raw:
            out.append(raw)
    return out or [""]


def _load(tag: str) -> list[dict]:
    p = LOGS / f"{tag}.jsonl"
    if not p.exists():
        return []
    recs = [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    # Logs captured before ANSI stripping existed still carry escapes.
    for r in recs:
        r["text"] = _ANSI.sub("", r["text"])
    return recs


def _ui_series(tag: str) -> list[tuple[float, Path]]:
    d = FRAMES / "ui" / tag
    if not d.exists():
        return []
    out = []
    for f in sorted(d.glob("*.png")):
        try:
            out.append((float(f.stem), f))
        except ValueError:
            continue
    return out


def _status_series(tag: str) -> list[tuple[float, Path]]:
    d = STATUS / tag
    if not d.exists():
        return []
    return sorted(((float(f.stem), f) for f in d.glob("*.txt")), key=lambda x: x[0])


def _at(series, t):
    """Last item whose timestamp <= t — what was on screen at that moment."""
    cur = None
    for ts, item in series:
        if ts <= t:
            cur = item
        else:
            break
    return cur


# Each segment publishes the surface on its own host port (offset per container),
# so the pane label is per-tag. A single global would be wrong for two of three.
_UI_PORTS = dict(
    kv.split("=", 1) for kv in os.environ.get("UI_PORTS", "").split(",") if "=" in kv
)


def compose(tags: list[str], title: str, speed: float, fps: int, out_path: Path) -> None:
    frame_dir = FRAMES / "video"
    frame_dir.mkdir(parents=True, exist_ok=True)
    for old in frame_dir.glob("*.png"):
        old.unlink()

    n = 0
    for tag in tags:
        recs = _load(tag)
        if not recs:
            print(f"[compose] no log for {tag} — skipping", file=sys.stderr)
            continue
        # The path name lives OUTSIDE the scroll region: its say-line is pushed off
        # the pane within a second, leaving no persistent label for the rest of the segment.
        seg_title = next((r["text"] for r in recs if r["kind"] == "say"), "") or title
        if len(seg_title) > 78:
            seg_title = seg_title[:75] + "..."
        ui = _ui_series(tag)
        st = _status_series(tag)
        t0, t1 = recs[0]["t"], recs[-1]["t"]
        span = max(t1 - t0, 1.0)
        vid_secs = span / speed
        steps = max(int(vid_secs * fps), 1)
        cols = (LEFT_W - 28) // 9   # 9px advance at 15pt in this face

        # Pre-wrap the whole log once; each frame is a window into it.
        wrapped: list[tuple[float, str, str]] = []
        for r in recs:
            for ln in _wrap(r["text"], cols):
                wrapped.append((r["t"], r["kind"], ln))

        # +1 so the last frame lands exactly on t1, and an end-hold so a viewer can
        # actually READ the conclusion. Without both, `range(steps)` stopped short of
        # t1 and the closing records of every segment — the PASS/FAIL verdict block,
        # the exit code, the `Cannot find module` lines that ARE the diagnosis — were
        # rendered into no frame at all. Measured on segment A: 14 records dropped.
        hold = int(HOLD_SECS * fps)
        # Build a MONOTONE time map that guarantees every record a minimum time on
        # screen. Without it the compression is honest about the clock and useless
        # about the content: a burst of 40 records in 6 real seconds is 0.6s of video.
        # The floor applies ONLY to the records a viewer must actually READ — operator
        # captions and exit lines. Applying it to every stdout line turned a 460s
        # segment into 240s+ of video and blew a 10-minute encode budget: ordinary
        # output should stream past, conclusions should linger.
        key_t = {r["t"] for r in recs if r["kind"] in ("say", "rc")}
        # THE TIMELINE IS NOT ONLY THE LOG. Built from stdout records alone, a long
        # quiet stretch — `make up` waiting up to 240s for fleet readiness — is ONE
        # interval, so the whole pane and the wall-clock banner freeze for its entire
        # compressed length. Measured on the previous cut: 32 of 156 seconds frozen,
        # while 24 status snapshots taken INSIDE one of those gaps (showing the
        # container coming up, 0 -> 10 units) were captured and never drawn.
        #
        # The status and UI series are real observations with real timestamps, so
        # folding them in costs nothing in honesty and makes the wait legible as a
        # wait. Clamped to the log's own window: a shot outside it has no frame to
        # land in, and widening the window to admit one would misdate the segment.
        extra = {ts for ts, _ in st} | {ts for ts, _ in ui}
        lo, hi = recs[0]["t"], recs[-1]["t"]
        stamps = sorted({r["t"] for r in recs} | {ts for ts in extra if lo <= ts <= hi})
        vmap: list[tuple[float, float]] = []   # (video_second, real_t)
        v = 0.0
        prev_ts = None
        for k, ts in enumerate(stamps):
            if k:
                floor = MIN_DWELL if prev_ts in key_t else 0.0
                v = max(v + floor, (ts - t0) / speed)
            vmap.append((v, ts))
            prev_ts = ts
        vid_secs = vmap[-1][0] if vmap else 1.0
        steps = max(int(vid_secs * fps), 1)
        print(f"[compose] {tag}: {span:.0f}s real -> {vid_secs:.0f}s video + {HOLD_SECS}s hold, "
              f"{steps + 1 + hold} frames (min dwell {MIN_DWELL}s)")
        for i in range(steps + 1 + hold):
            # CLAMP IN VIDEO-SECONDS, NOT IN FRAME INDEX. `steps = int(vid_secs*fps)`
            # floors, so `steps/fps` lands just SHORT of the final map entry and every
            # hold frame rendered the second-to-last record — the same "the last thing
            # is never shown" defect as the original range(steps), one layer down.
            # Measured: segment B held on its exit line while the surface screenshots
            # taken 65s later were never drawn at all.
            vsec = min(i / fps, vid_secs)
            # the real instant this frame depicts
            t = t0
            for vs, ts in vmap:
                if vs <= vsec:
                    t = ts
                else:
                    break
            img = Image.new("RGB", (W, H), BG)
            d = ImageDraw.Draw(img)

            # ── terminal pane ────────────────────────────────────────────
            vis = [w for w in wrapped if w[0] <= t][-TERM_LINES:]
            y = 12
            for ts, kind, ln in vis:
                col = {"cmd": ACCENT, "say": SAY, "rc": OK}.get(kind, FG)
                d.text((14, y), ln, font=_fb if kind in ("cmd", "say") else _f, fill=col)
                y += LINE_H

            # ── UI pane ──────────────────────────────────────────────────
            d.rectangle([LEFT_W, 0, W, H], fill=(18, 22, 30))
            shot = _at(ui, t)
            pane_y = 34
            if shot:
                try:
                    im = Image.open(shot).convert("RGB")
                    scale = min((RIGHT_W - 24) / im.width, (H - BAR_H - pane_y - 210) / im.height)
                    im = im.resize((int(im.width * scale), int(im.height * scale)))
                    img.paste(im, (LEFT_W + 12, pane_y))
                    ui_bottom = pane_y + im.height + 10
                except Exception:
                    ui_bottom = pane_y
            else:
                d.text((LEFT_W + 14, pane_y + 8),
                       "human surface: not serving yet", font=_f, fill=DIM)
                ui_bottom = pane_y + 34
            d.text((LEFT_W + 12, 10), "HUMAN SURFACE  :" + _UI_PORTS.get(tag, "----"),
                   font=_fb, fill=ACCENT)

            # ── status strip under the UI ────────────────────────────────
            sfile = _at(st, t)
            if sfile:
                try:
                    lines = sfile.read_text().split("\n")
                except Exception:
                    lines = []
                yy = ui_bottom
                room = max(int((H - BAR_H - 6 - ui_bottom) / 15), 4)
                for ln in lines[:room]:
                    d.text((LEFT_W + 12, yy), ln[:96], font=_fsmall,
                           fill=ACCENT if ln.startswith("==") else DIM)
                    yy += 15

            # ── bottom bar: what is true, and when ───────────────────────
            d.rectangle([0, H - BAR_H, W, H], fill=(6, 8, 12))
            d.text((14, H - BAR_H + 10), seg_title or title, font=_fbig, fill=FG)
            clock = time.strftime("%H:%M:%S", time.localtime(t))
            d.text((14, H - BAR_H + 38),
                   f"real wall-clock {clock}   ·   compressed ~{speed:.0f}x, bursts slowed so each step stays readable"
                   f"   ·   composed from captured stdout + polled screenshots, not a screen recording",
                   font=_fsmall, fill=DIM)
            d.text((W - 190, H - BAR_H + 22), f"[{tag}]", font=_fb, fill=SAY)

            img.save(frame_dir / f"{n:06d}.png")
            n += 1

    if n == 0:
        raise SystemExit("[compose] nothing to encode")
    subprocess.run(
        ["ffmpeg", "-y", "-framerate", str(fps), "-i", str(frame_dir / "%06d.png"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
         "-movflags", "+faststart", str(out_path)],
        check=True,
    )
    print(f"[compose] wrote {out_path} ({n} frames)")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    sub = sys.argv[1]
    if sub == "run":
        tag = sys.argv[2]
        argv = sys.argv[3:]
        if argv and argv[0] == "--":
            argv = argv[1:]
        return cmd_run(tag, argv)
    if sub == "say":
        cmd_say(sys.argv[2], " ".join(sys.argv[3:]))
        return 0
    if sub == "verdict":
        cmd_verdict(sys.argv[2])
        return 0
    if sub == "ifcounted":
        cmd_ifcounted(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "")
        return 0
    if sub == "countword":
        cmd_countword(sys.argv[2])
        return 0
    if sub == "ui":
        cmd_ui(sys.argv[2], sys.argv[3])
        return 0
    if sub == "stats":
        cmd_stats(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "")
        return 0
    if sub == "compose":
        tags = sys.argv[2].split(",")
        title = sys.argv[3] if len(sys.argv) > 3 else "substrate bring-up"
        speed = float(os.environ.get("SPEED", "8"))
        fps = int(os.environ.get("FPS", "12"))
        out = Path(sys.argv[4]) if len(sys.argv) > 4 else ROOT / "bringup.mp4"
        compose(tags, title, speed, fps, out)
        return 0
    print(f"unknown subcommand {sub}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
