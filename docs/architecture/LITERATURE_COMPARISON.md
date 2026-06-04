# Substrate framing vs. the LLM literature

> Companion to [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md). That document
> derived the substrate's behavior as factored Bayesian Q-learning on an
> open-world MDP, with four orthogonal axes and a five-step pattern
> recursing across trajectory / vessel / federation scales. This document
> situates that framing against published LLM and agent research:
> where it aligns with established results, where it diverges, and what
> falsifiable predictions it makes that the literature has not yet tested.
>
> Survey conducted 2026-06-04 against arXiv, USENIX, NeurIPS proceedings,
> and primary blog/repo sources. Citations are by arXiv id and venue
> where possible.

## Summary

The substrate's framing is **ahead of deployed practice** in three areas:
per-cell Bayesian decision-making over LLM-mediated action spaces; the
three-scale recursive composition pattern; and the granularity of its
measurement suite. It is **vulnerable** in two: the strong
factorization-invariance claim under shared backbones, and the
undercounting of federated sample-size benefit on shared cells. It makes
**five falsifiable predictions** the published literature has not yet
operationalized — most pointedly, the prediction that mature federation
equilibrium is *mutual push-away with cited evidence* rather than
consensus, which contradicts the default failure mode in multi-agent
debate work.

## 1. Modular and factored architectures

The LLM literature has converged on factorized capability composition as
both empirically powerful and stubbornly interference-prone.

**Empirical successes.** LoRAHub (Huang et al., arXiv:2307.13269)
combines adapter modules trained on diverse tasks via gradient-free
optimization from few exemplars. Polytropon and Multi-Head Adapter
Routing (Ponti et al., arXiv:2211.03831) jointly learn an inventory of
LoRA modules with a routing vector selecting a variable-size subset per
task — explicitly framing tasks as compositions of reusable "skills."
Model merging — TIES-Merging (Yadav et al., arXiv:2306.01708), Task
Arithmetic (Ilharco et al., arXiv:2212.04089), DARE (Yu et al.,
arXiv:2311.03099) — combines full fine-tuned checkpoints.

**Interference modes.** TIES isolates two dominant failure sources:
redundant magnitudes and sign disagreement across task vectors. MoE
routing exhibits expert collapse under naive load-balancing; DeepSeek's
loss-free balancing (Wang et al., arXiv:2408.15664) shows the
auxiliary load-balancing losses themselves inject "non-negligible
interference gradients" that impair learned routing. Gradient-similarity
analyses (arXiv:2601.21577) find 50–75% of neurons under continual
fine-tuning are "conflicting" (negative gradient similarity) — the
mechanistic basis of catastrophic forgetting.

**Substrate alignment.** The substrate's per-(signature, template)
Beta-Bernoulli posteriors are structurally similar to MoE's per-expert
independence and LoRAHub's per-adapter independence assumptions. The
substrate avoids the TIES sign-conflict failure mode because its
posteriors are over discrete cells rather than shared continuous
parameters.

**Substrate divergence.** The claim that "existing posteriors are
untouched when adding a vessel" (§8.2 of SUBSTRATE_AS_MDP) is the same
orthogonality bet that LoRAHub and Polytropon make. The literature
predicts soft violations: shared resolvers and shared LLM backbones
entangle "independent" cells through correlated noise. The substrate
framing does not currently model this entanglement explicitly — testable
but not tested.

## 2. Federated LLM training

Federated learning for LLMs is active but immature.

**Current state.** Yao et al. (arXiv:2409.15723, "Federated Large Language
Models: Current Progress and Future Directions") catalogs FedAvg /
FedProx / SCAFFOLD adaptations (FedLLM, FwdLLM, SPRY, FDLoRA, FedPipe)
and identifies client drift under non-IID data as the dominant obstacle.
A multilingual study (arXiv:2603.24242) found increasing per-client
diversity *reduces* client drift because local objectives become closer
approximations of the global.

**Poisoning is cheap.** Byzantine-robust FL has a maturing
attack/defense literature. Fang et al. (USENIX Security 2020, "Local
Model Poisoning Attacks to Byzantine-Robust Federated Learning") showed
Krum and trimmed-mean defenses are far more vulnerable than originally
claimed. BadSampler (arXiv:2406.12222) demonstrates clean-label
poisoning that bypasses robust aggregation. Critically for the
substrate, **Bayesian-Optimization Federated Poisoning** (BO-FLPA,
arXiv:2501.08002) explicitly targets *posterior* manipulation: attackers
can steer global Bayesian posteriors toward a target distribution by
strategic replication/deletion of true observations, achieving
"surgical poisoning where only targeted inferences are corrupted."

**Substrate alignment.** The H1–H4 cryptographic hardening stack
(two-sided traces, pubkey identity, signed scope attestations, quorum
ratification) is in the spirit of current FL defense literature but more
ambitious. The Bayesian incentive mechanism in arXiv:2507.12439 — each
round as a Bayesian game with reputation-weighted payments — is the
closest analog but lacks cryptographic identity.

**Substrate divergence.** The federated multilingual result
(arXiv:2603.24242) runs counter to the substrate's "specialization-via-
vessel" assumption: diverse clients converge rather than diverge. The
substrate's claim of O(1/ε²) per-cell convergence floor *independent of
federation size* aligns with classical bandit theory but contradicts
federated-LLM findings that effective sample size scales with honest
peer count — substrate framing undercounts the variance-reduction
benefit honest peers provide on shared cells.

## 3. Multi-agent frameworks

The dominant frameworks — AutoGen (Wu et al., arXiv:2308.08155), MetaGPT
(Hong et al., arXiv:2308.00352), ChatDev, LangGraph, CrewAI, DSPy — are
almost universally **not** formalized as MDPs. They use
conversational-orchestration metaphors without explicit state / action /
reward decomposition.

**Emerging formalization.** Agent-R1 (arXiv:2511.14460) "extends the
MDP formulation to richly interactive LLM agents." A-LAMP
(arXiv:2512.11270) generates an MDP and executable RL environment from
free-form natural language. Agent² (arXiv:2509.13368) performs explicit
"MDP modeling — including state space, action space, and reward function
design — followed by algorithmic optimization."

**Debate failure modes.** "Talk Isn't Always Cheap" (arXiv:2509.05396)
and "Value of Variance: Mitigating Debate Collapse" (arXiv:2602.07186)
document sycophancy-driven convergence, rubber-stamp collapse, and
collusion where "a significant portion of correct answers become
corrupted during debate." The Galileo taxonomy enumerates ≥30 distinct
multi-agent production failure modes.

**Substrate alignment.** The recursive ΔS/ΔA/ΔR pattern aligns with
Agent-R1's structured-state extension and A-LAMP's auto-MDP generation.

**Substrate divergence.** No paper formalizes "agent-team composition as
MDP action-space expansion with invariance guarantees." The substrate
claims existing posteriors are factorization-protected against new
vessels; multi-agent literature finds adding agents systematically
perturbs the group's effective policy. This is detectable by
behavioral-continuation replay-success but not yet operationalized
anywhere.

## 4. Bayesian / probabilistic methods with LLMs

Bayesian decision-making for LLM-mediated action selection is much less
established than Bayesian fine-tuning suggests.

**Bayesian fine-tuning.** BLoB (NeurIPS 2024), Laplace-LoRA / IVON-LoRA
(arXiv:2402.12264, arXiv:2502.12122) place posteriors over adapter
parameters and reliably reduce ECE and NLL with minimal accuracy cost
— a *calibration* gain, not an *exploration* gain.

**Thompson sampling for action selection.** Genuinely emerging:
Dwaracherla et al. (arXiv:2404.02649) benchmark Laplace, dropout, and
epinets for epistemic-uncertainty estimation feeding Thompson sampling,
finding "Thompson Sampling policies significantly and consistently
outperform the greedy baseline on a real-world bandit benchmark in terms
of final regret." TS-LLM (arXiv:2502.01118) uses the LLM itself to
sample reward values under temperature control. SEA (arXiv:2411.01493,
"Sample-Efficient Alignment for LLMs") formulates RLHF as contextual
dueling bandits with TS.

**Theoretical grounding.** Posterior-sampling RL theory
(arXiv:2402.10228 HyperAgent, arXiv:2403.11175) provides regret bounds
depending on posterior concentration rates, validating that O(1/ε²) per
cell is the right order of magnitude for Beta-Bernoulli bandits.

**Substrate alignment.** The substrate is **ahead** here. Beta-Bernoulli
TS over (signature × template) cells is exactly what arXiv:2404.02649
advocates as the right epistemic-uncertainty-driven action-selection
regime for LLM-mediated decisions, but almost no production system
implements per-cell posterior maintenance — the field still uses RLHF
point estimates.

**Substrate divergence.** Published TS-for-LLM work uses a handful of
arms (prompts, tools), not the Cartesian product of typed shapes ×
templates. Whether per-cell counts ever accumulate enough to be
informative at substrate scale is precisely the Heaps'-saturation
question.

## 5. Scaling laws and capability emergence

**Loss scaling.** Chinchilla (Hoffmann et al., arXiv:2203.15556)
establishes N_optimal ∝ C^0.50 compute-optimal scaling, refining
Kaplan's earlier N ∝ C^0.73 — the discrepancy largely attributable to
embedding-parameter counting (arXiv:2406.12907 "Reconciling Kaplan and
Chinchilla"). These are training-loss scaling laws, *not* action-space
capability scaling.

**Emergence is a measurement artifact.** Schaeffer, Miranda, Koyejo
("Emergent Abilities a Mirage," arXiv:2304.15004, NeurIPS 2023) show
apparent capability emergence is largely a metric artifact —
nonlinear/discontinuous evaluation produces phase-transition curves
where the underlying loss is smooth. **This is a critical constraint on
any "capability emergence" claim:** if measured as continuous per-cell
success probability, capability should scale smoothly with training
tokens; phase transitions are likely measurement artifacts.

**Heaps' Law.** β ∈ [0.4, 0.6] for English; confirmed for GPT-Neo
generations within a narrow temperature range (arXiv:2311.06377);
explicitly connected to neural scaling laws in arXiv:2512.13491
("From Zipf's Law to Neural Scaling through Heaps' Law").

**METR's task-length doubling.** metr.org/blog/2025-03-19 and
metr.org/blog/2026-1-29 measure the closest thing to substrate
"coverage progress": the length of tasks generalist agents complete
with 50% reliability has doubled every ~7 months over 6 years, with
recent acceleration to ~4 months in 2024–2025.

**Substrate alignment.** Heaps' β < 1 corroborates the prediction that
template-vocabulary growth saturates sub-linearly. The Mirage result
strongly suggests substrate metrics (per-cell variance, replay-success,
push-away rate) are better-behaved than outcome benchmarks because they
are continuous and per-cell.

**Substrate divergence.** The substrate's joint prediction —
*per-cell O(1/ε²) convergence floor combined with sub-linear cell
growth produces total information yield growing as ε²·n^β rather than
linearly in n* — is testable but not tested.

## 6. Active model-based RL with LLMs

This is the substrate's clearest lineage.

**Voyager.** Wang et al. (arXiv:2305.16291) — LLM agent in Minecraft
that builds an "ever-growing skill library of executable code," with
automatic curriculum maximizing exploration and iterative prompting with
self-verification. "3.3× more unique items, 2.3× longer distances, key
tech-tree milestones up to 15.3× faster" than prior SOTA. Crucially:
"Voyager is able to utilize the learned skill library in a new Minecraft
world to solve novel tasks from scratch" — the closest empirical
demonstration of behavioral-continuation transferring across substrate
boundaries.

**Auto-curriculum.** OMNI (Zhang et al., arXiv:2306.01711) and OMNI-EPIC
(arXiv:2405.15568) use LLMs as "models of human notions of
interestingness" for "AI selecting its own next task to learn." ELLM
(Du et al., arXiv:2302.06692) rewards agents for achieving LLM-proposed
goals. i-MENTOR / IMAGINE / MERCI (arXiv:2505.17621, arXiv:2510.16614)
extend this to count-based and trajectory-aware intrinsic motivation.

**Task / world generation.** GenSim (arXiv:2310.01361, ICLR 2024) and
GenSim2 (arXiv:2410.03645) auto-generate robotic simulation tasks via
LLM coding. Generative Agents (Park et al., arXiv:2304.03442)
demonstrate emergent social coordination from minimal seed specs.

**Substrate alignment.** The substrate's "system authors new
tools/skills/agents based on detected capability gaps" is exactly
Voyager's skill library + OMNI's interestingness filter + GenSim's
auto-task-generation.

**Substrate divergence.** The recursive three-scales claim
(trajectory / vessel / federation) goes beyond what any of these systems
implements. Voyager is single-agent; OMNI is single-substrate; no
published system demonstrates skill-library transfer across federation
peers with cryptographic provenance. Behavioral-continuation
replay-success on imported templates corresponds directly to Voyager's
cross-world skill reuse but is not benchmarked at federation scale.

## 7. Limits and known anti-patterns

The substrate's identified limits map cleanly onto established results.

**Multi-agent coordination overhead.** "Talk Isn't Always Cheap"
(arXiv:2509.05396), "Value of Variance" (arXiv:2602.07186), and
sycophancy work (arXiv:2509.23055) document debate collapse,
sycophancy amplification, groupthink, and the empirical finding that
multi-agent debate can yield *lower* accuracy than single-agent
baselines.

**Embedding-drift / RAG poisoning.** PoisonedRAG (arXiv:2402.07867,
USENIX Security 2025) demonstrates a small number of malicious
documents reliably corrupts retrieval. MemoryGraft (arXiv:2512.16962)
shows persistent compromise via poisoned experience retrieval —
"benign artifacts that semantically match future tasks reliably surface
through retrieval and lead to persistent behavioral drift across
sessions." Black-Hole Attack (arXiv:2604.05480) injects malicious
vectors constituting a negligible fraction of millions of embeddings
yet steering overall behavior.

**Negative transfer in modular composition.** Documented in LoRAHub /
SCALE work and gradient-similarity analysis (arXiv:2601.21577) showing
50–75% conflicting-neuron rates during continual fine-tuning.
Catastrophic forgetting mechanistically traced (arXiv:2601.18699,
arXiv:2504.01241) to attention disruption + representational drift +
loss-landscape flattening.

**Substrate alignment.** Heaps' saturation (β < 1, classical),
coordination overhead (Galileo's 30 failure modes), posterior poisoning
(BO-FLPA), RAG-style embedding drift (PoisonedRAG / MemoryGraft),
negative transfer (TIES interference) — all corroborated.

**Substrate divergence (contrarian prediction).** The substrate claims
mature federation = mutual push-away with cited evidence, not consensus.
Multi-agent literature finds the *opposite* default: sycophancy-driven
convergence and mode collapse when push-away mechanisms are absent.
This is coherent (push-away requires explicit refusal mechanisms) but
not yet validated anywhere.

## 8. Measurement frameworks

Dominant benchmarks — GAIA (Mialon et al., arXiv:2311.12983),
SWE-bench (Jimenez et al., arXiv:2310.06770), AgentBench (Liu et al.,
arXiv:2308.03688), ARC-AGI (Chollet et al., arXiv:1911.01547,
arXiv:2603.24621 for ARC-AGI-3) — are almost exclusively **end-to-end
outcome metrics** (resolve rate, pass@1, %solved). The Berkeley RDI
critique documents how outcome-only benchmarks are gameable.

**First step toward process-level metrics.** AgentProcessBench
(arXiv:2603.14465) — "the first benchmark dedicated to evaluating
step-level effectiveness in realistic, tool-augmented trajectories,
comprising 1,000 diverse trajectories and 8,509 human-labeled step
annotations" — explicitly framed against the limitation that
"GAIA and τ²-Bench only report end-to-end task success."

**Continuous capability progress.** METR's time-horizon metric is the
only published continuous capability-progress measurement.

**Posterior-variance tracking is absent in evaluation.** Present only
in classical Bayesian RL theory (Castro et al., PLOS One 2016;
arXiv:2302.12526 "Model-Based Uncertainty in Value Functions";
HyperAgent arXiv:2402.10228). DeepSea-style exploration benchmarks
measure "first episode where sparse reward is found in ≥10% of
episodes" — a posterior-concentration proxy — but no agent benchmark
currently reports per-cell or per-skill posterior variance over time.

**Substrate alignment.** Direction-of-travel aligned with field's move
toward process-level + continuous metrics.

**Substrate divergence.** The substrate's measurement suite (per-cell
posterior variance, per-vessel saturation fraction, coverage progress,
replay-success, push-away rate, topology spectral stability, vocabulary
growth rate, autonomous-detection coverage fraction) is *more granular*
than anything in published agent evaluation. AgentProcessBench operates
on hand-labeled step quality, not posterior variance. The substrate's
framing is ahead of operationalized work.

## 9. Five falsifiable predictions

These are claims the substrate's framing makes that the literature has
not yet operationalized. Each is testable via substrate-internal
observables.

### 9.1 Joint scaling law

**Prediction:** Federation information yield = n^β × variance-decay
(Heaps × Bayesian-bandit), **not linear** in peer count.

**Test:** Track per-cell (α, β) trajectories across peer-count regimes;
fit yield curve as a function of n.

**Status:** No published federated-LLM study measures per-cell
variance trajectories across peer-count regimes.

### 9.2 Vessel-vs-debate asymmetry

**Prediction:** Tool-style vessel addition is factorization-preserving;
agent-style debater addition perturbs the group's effective policy
through coordination overhead.

**Test:** Controlled experiment comparing posterior stability when
adding a tool-vessel vs. when adding a debate-agent at fixed action
budget.

**Status:** Multi-agent literature documents debate-addition
perturbation but does not contrast against tool-addition as a control.

### 9.3 Push-away ↔ replay-success correlation

**Prediction:** Higher mutual intervention-refusal rates correlate with
*higher* behavioral-continuation replay-success on imported templates.
Inverse of current MAD findings (where consensus correlates with
quality).

**Test:** Federation replay-experiment where intervention-refusal
counts and replay-success rates are tracked over windows; measure
correlation.

**Status:** No benchmark measures intervention-refusal-with-cited-
evidence as a primary metric.

### 9.4 Spectral poisoning detection

**Prediction:** Posterior poisoning is detectable by spectral
anomalies in the co-firing cell topology, not by direct posterior
comparison.

**Test:** Inject BO-FLPA-style poisoning into a controlled federation;
compare detection rate of spectral-topology monitor vs. direct
posterior comparison.

**Status:** BO-FLPA (arXiv:2501.08002) shows poisoning is cheap and
surgical; no FL-poisoning study uses spectral topology metrics on the
posterior dependency graph.

### 9.5 Embedding-distance phase transition

**Prediction:** Behavioral-continuation replay-success decays
sub-linearly with embedding-distance between source and target
substrates, with a measurable d* beyond which transfer is worse than
scratch.

**Test:** Voyager-style cross-substrate skill reuse experiment
parametrized by embedding-distance; locate phase transition.

**Status:** Voyager demonstrates cross-world skill reuse anecdotally
but does not measure d*. No measurement of d* exists.

## 10. Confidence calibration

Claims about LoRAHub, Voyager, OMNI, Chinchilla, METR, TIES, BO-FLPA,
AgentProcessBench, and the Mirage paper are **established results**
with multiple independent sources.

Claims about the substrate's specific predictions (push-away inversion,
spectral poisoning detection, d* transition) are **speculative**. The
substrate's framing is internally consistent and lineage-aligned with
active research, but the falsifiable predictions in §9 are not yet
operationalized in any published benchmark.

The actionable consequence: predictions 9.1, 9.3, and 9.4 can be
operationalized substrate-internally via metrics already adjacent to
existing observables (per-cell variance export, `interventionRefused`
impulse counters, spectral analyzer over the co-firing graph).
Predictions 9.2 and 9.5 are federation-dependent and gate on H1–H4
hardening; they become runnable experiments once federation is wired.

## Primary sources

arXiv:2307.13269, 2211.03831, 2306.01708, 2212.04089, 2311.03099,
2408.15664, 2601.21577, 2409.15723, 2603.24242, 2501.08002,
2507.12439, 2406.12222, 2308.08155, 2308.00352, 2511.14460,
2512.11270, 2509.13368, 2509.05396, 2509.23055, 2602.07186,
2404.02649, 2411.01493, 2502.01118, 2402.10228, 2403.11175,
2402.12264, 2502.12122, 2203.15556, 2406.12907, 2304.15004,
2311.06377, 2512.13491, 2305.16291, 2306.01711, 2405.15568,
2302.06692, 2310.01361, 2410.03645, 2304.03442, 2402.07867,
2512.16962, 2604.05480, 2601.18699, 2504.01241, 2603.14465,
1911.01547, 2603.24621, 2311.12983, 2310.06770, 2308.03688,
2302.12526, 2505.17621, 2510.16614.

Plus: METR blog (metr.org/blog/2025-03-19, 2026-1-29); USENIX Security
2020 (Fang et al.); NeurIPS 2024 (BLoB); the Galileo failure-mode
catalog (galileo.ai/blog/multi-agent-llm-systems-fail).
