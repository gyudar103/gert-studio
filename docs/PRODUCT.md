# GERT Studio — Product Specification

Revision: 2026-09-14 — synchronized specification for Version 0.1.

2026-10-02 extension: release 0.2.0 adds resizable panels and statistical uncertainty
and makes portable Windows the primary distribution; the Version 0.1 model remains.

Version 0.1 uses the concurrent resource-flow model defined in MODEL.md. Costs and capacity scheduling remain future features.

## 1. Product Name

**Working name: GERT Studio.** A standalone application for visually modeling, simulating, and analyzing stochastic project and process networks using GERT concepts. It supports uncertain durations, alternative outcomes, parallel work, synchronization, quantified named flow items, repeated activities, feedback and rework loops, and terminal project outcomes. Analytical methods and cost analysis may be added later.

## 2. Product Vision

Draw a project as it actually behaves—including uncertainty, parallel work, integration, failure, and rework—and understand what can happen, its probability, its duration, and the sources of risk. Cost analysis is a future extension of this vision.

Examples include prototype/test/redesign loops, rejected approvals and resubmission, alternative suppliers, recovery procedures, and integration of separately developed components. Loops are first-class constructs.

## 3. Primary Product Goals

Users should be able to:

1. Visually construct stochastic project networks.
2. Define named items and quantities held at nodes.
3. Define activities with consumable input requirements and uncertain durations.
4. Assign probabilities to alternative **outcomes of each activity**.
5. Model concurrent execution, integration, repeated execution, and cycles.
6. Define multiple terminal outcomes.
7. Validate models and run reproducible Monte Carlo simulations.
8. Estimate terminal probabilities, completion-time distributions, and activity execution counts.
9. Inspect modeled outcomes separately from deadlocks, ambiguities, and cutoffs.
10. Save, load, export, and reuse complete models and structurally valid incomplete drafts.
11. Eventually compare scenarios, identify sensitivities, and analyze costs.

## 4. Non-Goals for Initial Versions

Version 0.1 does not require costs, employee or machine capacity scheduling, resource leveling, calendars, procurement, collaboration, permissions, enterprise authentication, ERP integration, portfolio optimization, or live multi-user editing. It is not initially a replacement for Microsoft Project, Primavera, Jira, accounting software, or a general-purpose simulation platform.

Named consumable flow items **are required** in Version 0.1; they must not be confused with deferred reusable capacity resources.

## 5. Target Users

Project managers, engineers, R&D and product teams, researchers, systems engineers, risk analysts, infrastructure and aerospace planners, pharmaceutical development teams, operations researchers, and educators. Normal use must not require knowledge of Markov chains or Petri nets. Advanced users should be able to inspect assumptions.

## 6. Core User Experience

### 6.1 Network Canvas

An interactive graph supports creating, moving, connecting, inspecting, and deleting nodes and activities; zooming and panning; and displaying outcome branches and loops. Activities visually live on edge-like connections. A multi-outcome activity remains one activity with several outcome connections, not several independent executions.

Nodes hold items. Activities consume requirements at a source node and produce items at an outcome target. Several activities may run simultaneously. The graph must never be assumed to be a DAG.

### 6.2 Properties Panel

- Node: ID, label, type, initial inventory for Start, and terminal metadata where applicable.
- Item type: ID and readable name.
- Activity: ID, label, source, named input quantities, duration distribution and parameters.
- Outcome: ID, label, probability, target, produced item quantities.

Selecting a node exposes its data and collapsible documentation (comments, assumptions,
user-entered certainty, and explanation). It also lists associated outgoing activities
and incoming outcomes with links to their details. Selecting an activity card or an
outcome connection opens the activity panel and focuses the relevant outcome where
applicable. Duration and outcome sections have collapsible rationale, assumptions,
sources/references, and certainty fields. Full notes and parameter forms stay off the
canvas. Certainty is descriptive and never affects simulation.

New activities start with no selected duration distribution and unknown probabilities.
The duration selector includes “Unknown — choose later”; blank duration parameters and
probabilities are stored as explicit JSON nulls. Entering zero is distinct from leaving
an input unknown. Changing distributions clears parameters to null and preserves notes.
The canvas uses a compact Incomplete indicator on activities and `p=?` on unknown
outcome connections. The analysis panel lists clickable missing-field explanations,
and Run Simulation is unavailable until those fields are supplied. Backend validation
remains authoritative for supplied values, references, totals, and simulation settings.

While any outcome probability is unknown, an edit changes only that outcome, including
the edit that fills the last unknown. Known siblings and unknowns are never filled or
normalized implicitly. Once the set is complete, subsequent valid probability edits
use the established proportional adjustment of valid siblings (or equal allocation
when all sibling weights are zero); a single known outcome stays at one. Clearing a
probability makes it unknown. Invalid text remains visible for correction. The panel
explains this rule and displays the total; validation never performs this adjustment.
Documentation and placeholder edits use the existing undo history, including atomic
undo of probability adjustments. Import/model replacement still resets history.

Probabilities belong to outcomes within an activity, not to the set of activities leaving a node. Cost, capacity-resource, conditional, and correlation controls are future features.

### 6.3 Analysis Panel

Show outcome probabilities; deadlock, ambiguity, and cutoff frequencies; terminal completion-time distributions; and activity execution statistics. Show sample sizes and conditioning explicitly. Never label a cutoff as proven nontermination or a simulated deadlock as a modeled failure terminal.

### 6.4 Resizable Studio workspace

On desktop, draggable vertical separators resize Model, Canvas, and Properties;
a horizontal separator resizes the modeling workspace and Validation/Results.
Keep usable minimum panel dimensions and clamp sizes when the window shrinks.
Separators support keyboard arrows, focus indication, and accessible orientation
and current/minimum/maximum values. Narrow layouts may hide desktop separators.
Provide Reset layout. Persist versioned panel sizes locally, safely ignoring malformed
data and clamping obsolete sizes. These preferences are UI-only: they never enter
model JSON, simulation requests/results, RNG behavior, or model Undo history.

## 7. Core Modeling Philosophy and Authority

The serializable mathematical model is independent of the engine and interface. The engine validates and simulates it; the UI constructs and displays it.

`MODEL.md` is authoritative for mathematical and simulation semantics. `PRODUCT.md` is authoritative for product goals, UX, and scope. Report contradictions before implementing affected behavior; do not silently resolve them. Do not modify either specification merely to make code or tests pass. Semantic changes require explicit user approval.

## 8. Version 0.1 Scope

### 8.1 Nodes and Items

Exactly one Start; State nodes; Terminal nodes with success, failure, neutral, or custom metadata. Nodes hold multiple named flow items with nonnegative numeric quantities. No sophisticated unit conversion.

### 8.2 Activities and Outcomes

An activity has a single source, consumable requirements, duration, and one or more probabilistic outcomes. Each outcome has a target and produced items. Requirements implement synchronization. Repeated executions are distinct activity instances.

### 8.3 Duration Distributions

Fixed, uniform, triangular, and beta-PERT. Parameter definitions and validity are in MODEL.md.

### 8.4 Costs

Not required for Version 0.1. No Version 0.1 behavior or acceptance gate depends on cost fields, distributions, or metrics.

### 8.5 Structural Features

Linear workflows, parallel work, synchronization, probabilistic outcomes, multiple terminals, and basic rework cycles. The canonical representation and architecture must support cycles. Any staged implementation limitation must be stated explicitly, not implemented by silently converting the graph to a DAG.

### 8.6 Simulation

Discrete-event Monte Carlo with configurable realization count (for example 1,000, 10,000, or 100,000), reproducible seeds, and safety limits. These counts are user options, not performance guarantees.

### 8.7 Initial Metrics

- Counts and probabilities of each terminal outcome, deadlocks, ambiguities, and cutoffs, using all requested realizations N as the denominator.
- Mean, descriptive population SD, P5, P10, P20, P30, median/P50, P70, P80, P90, P95, and observed minimum/maximum duration among terminal runs, labeled as conditional on reaching a terminal within the run limits. Percentile point estimates retain Hyndman–Fan Type 7: linear interpolation at `(n - 1) * p`.
- Mean activity execution count and probability of at least one execution, with the precise counting convention resolved in MODEL.md.
- Sample sizes and cutoff information alongside statistics; no misleading unconditional completion-time claim.

Descriptive SD uses population variance (`ddof=0`): no observations gives null and
one observation gives zero. Activity `standard_deviation_starts` uses start counts
from all requested realizations, including zeros and every run status. Duration
`standard_deviation` and all duration statistics use only terminal runs; their
`sample_size` excludes cutoffs, deadlocks, ambiguities, and invalid-runtime runs.

Report statistical uncertainty at 95% confidence, separately from descriptive SD:

- Each terminal/status probability and activity probability of at least one start
  uses exact integer successes `k` and all requested realizations `N`: estimate
  `k/N`, Monte Carlo SE `sqrt(p_hat * (1-p_hat) / N)`, and a 95% Wilson score CI
  bounded by [0,1], including at zero/all successes. Use a documented fixed
  two-sided normal critical constant; do not substitute a Wald interval.
- Mean duration and mean starts use their respective samples above. For `n>=2`,
  report inferential sample SD (`ddof=1`) separately from descriptive population
  SD. Monte Carlo SE is `sqrt(sample_variance/n)`; the 95% Student-t CI
  is `mean ± t_(0.975,n-1) * SE`. For `n=0` the mean/SE/CI are unavailable;
  for `n=1` the mean exists but inferential sample SD/SE/CI are unavailable. Clip negative lower endpoints
  to zero for these nonnegative quantities and explicitly identify support clipping.
- Each completion-time percentile has a separate 95% nonparametric binomial/order-
  statistic CI using equal-tailed binomial rank bounds and observed sorted values.
  Keep Type-7 point estimates unchanged. Missing finite bounds are null, with a
  small-sample explanation, particularly for P5/P95. Do not bootstrap or derive
  quantile uncertainty from duration SD.

SD describes observed spread; SE describes Monte Carlo uncertainty of an estimate;
CI gives a method-specific confidence interval. Label Wilson, Student-t, and
nonparametric quantile methods distinctly. Do not assign generic CIs to min, max,
descriptive SD, or exact lifecycle totals. Expose uncertainty through compact,
accessible details without excessively wide tables. Numeric estimates and CI
endpoints use the existing three-significant-digit/full-precision toggle; unavailable
values display as unavailable, never zero.

Reporting must be deterministic and consume no RNG. Precisely document numerical
precision, rounding/serialization, Student-t evaluation and supported degrees of
freedom, and quantile rank inequalities/indexing (including equality and missing
bounds). New fields are additive; simulation semantics, existing estimates, and
reproducibility streams remain unchanged.

Per-terminal conditional duration statistics are an important extension, followed by activity timing and item-arrival metrics. No Phase 1 cost metrics are required.

## 9. Graph Validation

Messages have error, warning, or informational severity and explain the problem in ordinary language, identifying affected elements.

Errors include duplicate IDs, invalid references, missing/multiple Start nodes, invalid distributions or quantities, prohibited Start/Terminal connections, missing activity outcomes, and invalid probabilities or sums. Probabilities are never silently normalized.

Explicitly unknown duration distributions, required duration parameters, and outcome
probabilities are incomplete information, not invalid supplied values. Structurally
valid drafts can be imported and exported. Validation identifies missing fields and
distinguishes “Draft valid” from simulation-ready models. Invalid supplied numbers or
malformed structure still block import. Simulation rejects incomplete models before
execution with object-specific explanations.

Warnings include apparently unreachable elements, possible deadlocks, possible nonterminating cycles, unused or unavailable items, competing consumption, and possible simultaneous terminal outcomes. Conservative structural warnings must not be treated as proof of an actual runtime conflict.

## 10. Analysis Philosophy

Expose distributions, not just averages. Distinguish $P(O=k)$, $E[T\mid O=k]$, and completion-time distributions conditional on observed terminal runs. A project that fails early can have a misleadingly small mean duration. Cutoff observations are not completed durations and do not prove nontermination.

Future filters include terminal outcome, activity executed, item arrival, repetition count, and duration threshold. Cost filters follow cost modeling.

## 11. Visual Analysis

Planned views: duration histograms and cumulative distributions, outcome probability charts, activity execution heat maps, loop frequencies, sensitivity charts, and scenario comparisons. Cost charts follow the cost extension.

## 12. Scenario Analysis

After the simulator is stable, duplicate models into named scenarios such as Baseline, Aggressive Schedule, Risk Reduction, and Alternative Supplier. Compare probabilities and duration metrics with consistent conditioning and limits. Low Cost scenarios and cost comparisons require the future cost model.

## 13. Loop and Rework Analysis

Loops are central. Activity repetition counts support basic rework inspection. Future analysis includes probability of entering a loop, expected iterations, probability of at least N repetitions, schedule tail impact, and eventually cost impact. Do not claim exact nontermination probabilities from finite simulation cutoffs.

## 14. Future: Conditional and Stateful GERT

Later versions may add variables such as attempt_count, budget_remaining, quality_score, and supplier_status; history-dependent probabilities; learning; degradation; and adaptive strategies. These are not implied by Version 0.1 flow-item semantics.

## 15. Future: Decision Nodes

Distinguish stochastic outcomes from user-controlled decisions. Eventually compare strategies using success probability, duration, cost, utility, and risk. Do not silently use an implicit decision policy to allocate conflicting Version 0.1 inventory.

## 16. Parallel Workflows in Version 0.1

True concurrent activities and synchronization through required items are part of Version 0.1. Dedicated AND/OR/XOR gateways, races, branch cancellation policies beyond terminal termination, and more elaborate concurrency controls may be added later.

## 17. Future: Capacity Constraints

Limited engineers, machines, laboratories, shared facilities, queues, and calendars are deferred. Such capacities would be reserved and released, unlike the consumable flow items required now.

## 18. Future: Sensitivity and Criticality

Study schedule sensitivity, terminal-outcome sensitivity, rework impact, and stochastic criticality. The central question is which uncertainty is worth reducing, rather than only which deterministic path is longest.

## 19. Future: Value of Information

Explore the value of tests, research, prototypes, delayed commitments, and information acquisition through changes in expected decision utility. No decision-optimization solver is required now.

## 20. Future: Model Updating

Observed progress may eventually update duration distributions and outcome probabilities using empirical or Bayesian methods. Cost distributions follow the future cost model.

## 21. File and Data Philosophy

Use an explicitly versioned, human-readable structured format independent of the editor. Canonical top-level concepts are `schema_version`, `project`, `item_types`, `nodes`, and `activities`; simulation settings should be explicit. Outcome connections are stored under their parent activities rather than as an unrelated sequential edge model.

Export and reload must preserve model semantics. Support deterministic serialization where practical, and explicit migrations where compatibility cannot be preserved.

**Export JSON** retains the existing model-only format when no current simulation
result exists, including incomplete drafts. With a current result, it exports a
versioned `gert-studio-simulation-snapshot` envelope (`file_version: "0.1"`) containing
`model`, `simulation_settings`, and `simulation_result`. The settings are those used
for that run; the result preserves the actual root seed, engine/reproducibility
versions, and all returned statistics and uncertainty fields with exact numeric
precision. These reporting fields do not extend the mathematical Model schema.

**Import JSON** accepts legacy models and snapshots. A snapshot's contained model
uses the established model validation path. Valid saved settings and results are
restored together, without running a simulation, and Results identifies them as
imported saved results. Malformed snapshots leave the current workspace intact.
Model or settings edits that invalidate local results also invalidate imported
results. Results remain outside model Undo history; panel layout is never exported.

## 22. Deployment

The primary distribution is a portable Windows application: download the release
ZIP, extract it, and run GERT Studio. It bundles its runtime, backend, production
frontend, and required dependencies; end users need no Python, Node.js, npm, Git,
Docker, WSL, developer tooling, or coding assistant. Docker remains a secondary,
optional self-hosted path.

## 23. Technology and Delivery Sequence

The primary developer/release workflow uses native Python 3.12, Node/npm, frontend
and browser test tooling, then a committed release candidate and portable Windows
build. Backend dependencies include FastAPI, Pydantic, NumPy, SciPy, NetworkX, and
pytest. Verify the packaged app against native source behavior and independently
review the exact candidate/artifact pair before publication. Docker verification
is optional and non-blocking unless Docker behavior changes. This document does
not pin dependency versions.

Later frontend: React, TypeScript, React Flow, and Plotly or equivalent. JSON export/import is required for a usable Version 0.1; SQLite is a possible later storage choice, not a Phase 1 requirement.

Phase 1 API scope:

- `GET /api/health`
- `POST /api/models/validate`
- `POST /api/simulate`

Planned repository locations are `backend/app/`, `backend/tests/`, `examples/`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md`. Project CRUD/persistence endpoints are outside Phase 1 scope. The final usable Version 0.1 product includes visual editing and model save/load.

## 24. Product Principles

Cycles are legal. Mathematical correctness precedes polish. Seeds and assumptions are explicit. The UI does not define semantics. Monte Carlo is the primary general solver; exact methods are future options for suitable restricted classes. Show distributions, conditioning, and sample sizes. Explain invalid models rather than silently correcting them.

## 25. Definition of a Successful Version 0.1

A user can model parallel mechanical, electronics, and software development; synchronize their outputs at Integration; test the integrated prototype; and route failed tests through Rework to a fresh test request. The user can assign uncertain durations and probabilistic outcomes, simulate reproducibly, inspect terminal probabilities, duration distributions, test attempts and rework counts, and save/reload the model.

The engine correctly consumes and produces named quantities, batches simultaneous events, handles basic cycles and safety limits, and reports ambiguities and deadlocks separately. Costs and capacity scheduling are not acceptance requirements. Mathematical rules and acceptance requirements are in MODEL.md.
