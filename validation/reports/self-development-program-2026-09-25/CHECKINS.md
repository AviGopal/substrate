# Program check-ins

One row per hourly check. Reach (adj) excludes pre-admission pinned refusals and empty declarative runs.

| UTC | CPU / mem (container) | trace store | retention fails/h | dispatches/h, reach (adj) | gaps opened/closed per h, open | landings/h dev·gh | surface probe | audited gaps |
|---|---|---|---|---|---|---|---|---|
| 02:45 | ~5 cores / 23.8 GB | 42 GB | ~42 | —, 14% raw over 24h | 469/36 per 24h, 1766 | — | R2 fail (43 vs 178) | filed |
| 04:30 | ~5 cores / 21.6 GB | 43 GB (+1 GB in ~2h) | 52 | 100, 20% (34 pinned refusals, 15 empty) | 62/6, 1678 | 3·3 | R1 pass after probe fix; R2 fail; runs visible 3.7% | 4 substrate attempts: 3 lane BUSY, 1 inferred shellResult |
