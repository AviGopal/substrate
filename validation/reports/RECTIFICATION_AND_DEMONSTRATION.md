# Rectifying the commands that returned wrong results, and demonstrating the documented path

The standard applied here: **no command, executable, or documented instruction
should produce an incorrect result.** Scope is what the README instruction audit
measured — thirteen filed gaps plus the instruction defects found alongside them.

Every fix below was verified against a fleet on which the defect could actually
fire, with a negative control on a fleet where it could not. A fix confirmed only
on the healthy path is a fix confirmed against nothing.

---

## The diagnostics were the worst of it

Two tools exist to answer "is this fleet healthy". Both answered wrongly, in the
same way, on the failure mode this repository's own documentation warns about
most often.

**A restart loop was invisible to both.** A unit with `Restart=` that keeps dying
reports `activating` or `active` forever and never `failed`, so
`systemctl --failed` cannot see it and `is-active` says it is fine. Measured:
`substrate-ready` printed `boredom-vessel.service ok` and `substrate-doctor`
printed `no failed units` for a vessel restarting every twenty seconds.

Detection is a **delta**, never a lifetime count — `NRestarts` is cumulative for
the boot, so failing on `>0` would condemn every fleet whose vessel ever
recovered.

**`substrate-doctor` assumed a standalone fleet.** On a spoke, where store, trace
API and identity live on the hub by design, four checks failed for reasons that
were not defects and none named the actual fault — a 401 from the hub on every
write. It now detects topology, skips the masked datastore check, probes the
endpoint the fleet actually resolves against, and carries a check that validates
the credential against the issuing identity. On the same joined-to-nothing spoke
it now says:

```
FAIL METABOB_API_KEY rejected by the hub's activity-api (401)
     THIS SPOKE HAS NOT JOINED. …
FAIL METABOB_API_KEY REJECTED by http://…:18101: Invalid API key signature
     this is the join failure — nothing this spoke writes to the hub will be accepted
```

### Four bugs in the fix itself, each caught by measuring

Recorded because each would have shipped a check that looked implemented and did
nothing:

1. `systemctl show "*.service"` returned **25 rows on a 99-service fleet** — the
   glob expands against loaded units only.
2. systemd prints `NRestarts=` **before** `Id=` in each block, so an
   order-assuming parser paired every count with the *previous* unit's name. The
   looping vessel read as `0` while a direct query said `29`. Second instance of
   that class in one day; the first was `paste - -`.
3. A five-second window is shorter than a twenty-second restart cycle, so the
   delta was zero and the loop read as healthy — the exact false green being
   fixed.
4. **A counter that moved is not yet a loop.** On a fleet booting from scratch,
   `concept-db-seeder` retried once, succeeded, and settled; flagging it reported
   FAILURE on a fleet that had come up correctly. Both tools now require the unit
   to still be cycling when the window closes.

The first crash-loop reproduction was also wrong and had to be rebuilt: a unit
failing every three seconds is rarely sampled `active`, so the *old* code caught
it too and proved nothing. Only a mostly-up loop isolates the defect.

Bug 4 was findable only because the fix was exercised against a fleet booting
from scratch. Steady-state testing produces no boot-time retry to trip over.

---

## Commands that reported success without doing anything

| Command | Was | Now |
|---|---|---|
| `vessel-ctl apply` | started seven units on every run of a converged fleet, so "no action lines" — the documented converged signal — was unreachable | **0 action lines** on a converged fleet |
| `vessel-ctl deregister` | `ok:true` whether or not a registry row was removed | `deregistered` / `noop` / `ok:false`, three distinct outcomes |
| `vessel-ctl status <unknown>` | printed a row, exit 0 | refuses by name, exit 1 |
| `drift` unmanaged warning | named every *installed* manifest vessel as a packaging omission | names only units genuinely absent from the inventory |
| `config-surface-probe.sh` | printed `matches baseline` and exited 0 while its own check was dead | exits 2 with FATAL when it cannot run |
| `gen-env` | silently discarded sixteen supplied values | says so on stderr for each |
| `bootstrap-seeder` | counted a law-3 reuse refusal as a failed upload, ending a correct first boot red | classifies seeded / already-served / failed |
| `spoke-federate` | refused to derive a relay from a hub that was advertising one | falls back to `/bootstrap`, the transport's own source |
| `substrate-pull-sync` | claimed converged tooling takes effect "at next container start" | per-script; `vessel-ctl` and friends take effect on the next invocation |

---

## Instructions that would send a reader somewhere wrong

- The join pre-flight passed on a **dead** relay. Deliberately not "fixed" with a
  TCP dial: the decommissioned host *accepts* TCP, so a dial would be a new wrong
  instruction wearing a check's clothes. Documented as unresolvable by a
  one-liner, with the signal that does settle it — the transport's circuit
  reservation in the journal.
- The README's doctor caveat was **inverted**: it said the registry check passes
  identically on an unjoined spoke; measured, it failed.
- `.env.example` claimed no launch path passes `PUBLIC_IP`; compose does, and the
  wrong claim sent operators to hand-edit a file `gen-env` truncates every boot.
- `deploy-hub.sh` needs a PAT and a positional public IP, neither documented, and
  its usage example named a decommissioned host.
- `SUBSTRATE_REPO_OWNER` reaches neither deploy script.
- The two launch lanes name a second instance differently and neither translates
  the other; a reader who learned `make up` and switched to compose got a
  container named `substrate-live` on the production volumes.
- `TRACE_STORE_CAP` and `TRACE_STORE_HOT_WINDOW_DAYS` documented activity-api's
  in-code fallbacks, which no fleet has ever run — off by 3× and 4.7×.

---

## The demonstration

A fleet was brought up from scratch by the documented path and driven only with
documented commands.

| Documented claim | Result |
|---|---|
| One command brings up a fleet | container healthy |
| Gate on the key, not on `healthy` | `valid:true` at **43s** |
| Nine ports published | 9 distinct container ports |
| Every port answers `/health` | 8/8 `200` (the ninth needs an install) |
| `:18310` answers only after `vessel-ctl install` | `000` before, `200` after |
| Readiness is one command | `[ready] fleet ready` |
| `drift` is read-only, three sections | three sections, no false unmanaged entry |
| **`apply` on a converged fleet prints no action lines** | **0 action lines** (was 7) |
| `make stop` drains rather than kills | reported 1 in flight, drained, volumes retained |
| Stop/start preserves state | identity valid after restart; 92 templates intact |

Restart-loop detection was then exercised in both directions on that same fleet:
a settled boot retry was **not** flagged, and a planted mostly-up loop was
reported by doctor as `+2 in 25s, total 3, now active/success` and by readiness
as `down`.

**Documentation checker, whole-sweep differential.** Every doc edited in this
session, scanned before and after with line numbers normalised:
`docs/SUBSTRATE.md` 16 → 16, `README.md` 2 → 2, **no finding introduced**. All
eighteen remaining are one known false-positive class in the checker itself,
tracked and dispatched.

---

## Still open, and why

- **Three fixes live in gated vessel source** and were dispatched as goals rather
  than hand-edited, per law 6. Two failed honestly first — one could not route,
  one drafted and its own typecheck gate rejected it and rolled back. The
  rollback was correct: the draft had rewritten an unrelated import to a package
  that does not exist. Re-dispatched with an explicit single-file constraint.
- **Compose/`make` port parity** stays open as a decision. The mitigation — an
  explicit warning in the README — has landed; giving compose a `PORT_OFFSET`
  equivalent changes the compose contract and is not a call to make unilaterally.
- **The sixteen pinned literals** stay pinned. Several bound destructive
  operations. The discard is now audible rather than silent, which is the
  difference between a deliberate constraint and a command that quietly returns
  the wrong result.

---

## Operational notes

Three sandbox fleets were created and destroyed on distinct port blocks with
distinct volume prefixes. Production was verified at both ends: up throughout,
14 vessels, both volumes intact.

Two mutations of production were made and repaired. `vessel-ctl deregister` is
not read-only — running it dropped a vessel from discovery (14 → 13); the vessel
was restarted to re-register and the count confirmed back at 14. The second was
the same command used deliberately to test the three-outcome fix, with the
container's original script restored afterwards.
