# Substrate Self-Observation Report

**Version identifier:** `2026-06-01T10-59-19Z-substrate-self-observation-report-development-vessel`

**Report generated:** 2026-06-01T10:59:23.180Z

**Detectors dispatched:** 5

---

## phantom_trace_scan

The phantom trace detector scanned **25** execution traces and located **1** phantom entry (success-status execution with **0** task count). Of the **25** scanned, **12** succeeded as traces. The detector identified **11** list candidates that were rejected after confirmation, with **0** confirm errors observed. The confirm cache holds **11** entries.

The single phantom detected—execution ID `ias-test-1780305144204` with template `activity:⟨ias-executor-ts-canary-test⟩`—completed in **1** millisecond with status `success` but no tasks. This entry was **not posted** (dry_run mode active). The phantom is tagged with gap ID `phantom-success-ias-test-1780305144204`.

**Finding:** Phantoms are rare in this scan window (1 of 25 = 4%), and the single instance is associated with a canary test template, suggesting it may be a test artifact rather than production degradation.

---

## precondition_rejection_scan

This detector scanned **200** execution instances and identified **31** rejections distributed across **8** affected templates. The rejections represent a **15.5%** failure rate by instance count.

Affected templates and rejection volumes:

- `activity:⟨development-vessel:harness-check-scenario⟩`: **7** instances, duration range **2–6** ms
- `activity:⟨development-vessel:ingest-doc-as-concepts⟩`: **6** instances, duration range **1–6** ms
- `activity:⟨development-vessel:draft-gap-closing-activity⟩`: **5** instances, duration range **6–377** ms
- Four additional templates with rejection counts (output truncated)

All identified rejections were **not posted** (dry_run mode). The duration ranges are notably short across most templates (milliseconds), with the exception of `draft-gap-closing-activity` which shows a **377** ms maximum, indicating variable execution paths or resource contention.

**Finding:** A sustained precondition rejection rate of 15.5% across the development vessel indicates either systematic precondition misconfiguration, environment constraints, or upstream dependency unavailability. The concentration in `harness-check-scenario` and `ingest-doc-as-concepts` templates warrants investigation into their precondition specifications.

---

## service_oom_cascade_scan

The memory cascade detector scanned **10** services with **0** probe failures and identified **0** services with concerning memory profiles. **0** findings were emitted. The detector operates under thresholds:

- Restart threshold: **3** cascades
- Memory absolute: **4,294,967,296** bytes (4 GiB)
- Memory delta: **524,288,000** bytes (~500 MiB)

No out-of-memory cascades or memory pressure anomalies were detected.

**Finding:** Memory subsystem health is nominal; no action implied from this detector.

---

## dispatch_target_drift_scan

This detector scanned **200** executions and found **50** dispatch target drifts (**25%** of scanned executions). Critically, all **50** drifts were **posted** with HTTP status **200**, indicating successful external notification.

The drift pattern is systematic: requested targets lacking the `activity:⟨...⟩` wrapper template prefix are being resolved to wrapped variants. Examples:

- Requested: `gap-closing:fp-11-1780132248562` → Selected: `activity:⟨gap-closing:fp-11-1780132248562⟩`
- Requested: `development-vessel:draft-gap-closing-activity` → Selected: `activity:⟨development-vessel:draft-gap-closing-activity⟩`
- Requested: `development-vessel:probe-untraversed-edge` → Selected: `activity:⟨development-vessel:probe-untraversed-edge⟩`

**Meta-observation:** The detector did **not** emit an `instrumentation_gap` signal (`instrumentation_gap_emitted: false`, `instrumentation_gap_posted: false`). This indicates the detector's instrumentation is functioning at expected sensitivity. The **field_name** is consistently reported as `dispatch_target_template_id`.

**Finding:** Dispatch target resolution is uniformly normalizing bare identifiers to templated form. This is a pattern rather than an anomaly—25% of executions experience this transformation, all are successfully logged, and all posts succeeded. The consistency suggests either a deliberate normalization pipeline or a systematic gap in caller-side template wrapping.

---

## system_load_report

System resource state is healthy:

- **Load average (1m/5m/15m):** 6.49 / 5.99 / 6.22 (against **28** threshold)
- **CPU cores:** 14; utilization well below saturation
- **Memory used:** **14.3%** of total (**32,863,620** KB available); cgroup current allocation **2,481,233,920** bytes
- **CPU cumulative:** 14,273,495,393 µs total (7,020,426,766 µs user + 7,253,068,627 µs system)
- **Anomaly flags:** `load_anomaly: false`, `memory_anomaly: false`, `anomaly_count: 0`

**Finding:** No resource pressure detected. System has substantial headroom for additional load.

---

## Cross-Detector Pattern Analysis

**Execution failure regime:** The detector ensemble reveals a **precondition-driven failure mode**, not a resource or phantom-trace mode:

- Precondition rejections: **31** instances (15.5%)
- Phantom traces: **1** instance (4%)
- OOM cascades: **0**
- System load anomalies: **0**

This pattern indicates that executions are failing at the precondition validation gate rather than during execution, timeout, or resource exhaustion. Combined with the dispatch target drift findings (**25%** of executions experiencing template wrapping normalization), the substrate appears to be operating in a **development/transition regime** where template format conventions are being enforced downstream but not uniformly supplied upstream.

**No meta-instrumentation gaps detected.** All five detectors reported their expected output shapes and completion states.

---

## What This Enables

Publishing this self-observation report to git as a timestamped artifact creates a queryable, version-controlled log of the substrate's internal state at 2026-06-01T10:59:19Z. By accumulating these reports across time, operators can construct temporal baselines for precondition rejection rates, dispatch target drift frequencies, and system resource profiles. Deviations from trend (e.g., precondition rejections rising from 15.5% to 40%, or phantom traces increasing from 4% to 12%) become detectable without manual instrumentation changes. The reports themselves form a composition output that can be integrated into dashboards, alerting rules, or trend analysis pipelines, making the substrate's internal self-model transparent and auditable to the operator—transforming private instrumentation into observable, actionable operational telemetry.