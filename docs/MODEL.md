# GERT Studio — Mathematical Model Specification

Revision: 2026-09-11 — synchronized review edition for Version 0.1.

Based on the user-edited 53-section specification supplied in this conversation. Broken equation formatting is repaired. The explicit runtime clarifications from the latest review are incorporated and identified below. Open execution questions are collected after Section 53; this document does not silently choose answers to them. Ready for architecture review, not unrestricted engine implementation.

## 1. Purpose

This document is authoritative for representation, activity execution, flow items, concurrency, synchronization, stochastic outcomes, simulation, and validation. The frontend must represent these semantics. PRODUCT.md defines product goals and UX. Report contradictions before implementing affected behavior. Do not change either specification merely to make code or tests pass; semantic changes require explicit user approval.

## 2. Core Model

Version 0.1 is a **stochastic resource-flow network with concurrent activities**:

$$M=(V,A,R),$$

where V is the set of nodes, A the activity definitions, and R the named item types. The simulation does not occupy a single current node. Its state includes:

$$S(t)=(I(t),X(t),Q(t)),$$

where I is node inventory, X the running activity instances, and Q the scheduled completion events. Multiple activities may execute simultaneously.

## 3. Nodes

Each node has `id`, `label`, and `type`. Types are `start`, `state`, and `terminal`. Nodes represent project states, item buffers, synchronization locations, or terminal project outcomes.

## 4. Start Node

Exactly one Start exists. It contains the initial project inventory at t=0, for example one each of mechanical_request, electronics_request, and software_request. These can enable three independent activities. Incoming activity outcomes into Start are prohibited in Version 0.1.

## 5. State Node

A State node may accumulate multiple different items from different activities at different times. For example Integration can hold mechanical_module, electronics_module, and software_build. An activity sourced there can require all three.

## 6. Terminal Node

Terminal metadata includes `outcome_code`, `outcome_label`, and `outcome_category`. Recommended categories are `success`, `failure`, `neutral`, and `custom`. Reaching a terminal ends the realization subject to the complete simultaneous-event batch rule in Sections 25, 32, and 33. Remaining running instances are cancelled.

## 7. Item Types

Items can be available, required, consumed, or produced. Examples: prototype, approval_document, test_sample, software_build. They are **flow resources**, not reusable capacity resources such as engineers or machines. Each item type has an ID and readable label.

## 8. Item Quantity

For node v and item r:

$$I_v(r,t)\geq0.$$

Quantities may be nonnegative numeric values, not just Boolean presence. Examples: steel=50, prototype=1, approval_document=1. No sophisticated unit conversion is required. All referenced item types must be declared. Integer-only item classes, inventory caps, and numerical inventory tolerances are not defined here; see the open questions.

## 9. Activity

An activity definition contains `id`, `label`, `source_node`, `requirements`, `duration`, and `outcomes`. It visually lives on an edge or edge-like connection. It consumes input at one source node and, upon completion, routes production to one selected outcome target.

## 10. Activity Input Requirements

Each activity has requirements $R_a(r)\geq0$. It is individually enabled when:

$$I_{source(a)}(r,t)\geq R_a(r)\quad\text{for every required }r.$$

An Integration activity requiring one mechanical module, one electronics module, and one software build cannot start until all are available at its source node. Inputs do not pool across distinct nodes.

## 11. Input Consumption

Inputs are consumed atomically when an instance starts:

$$I_{source(a)}(r,t)\leftarrow I_{source(a)}(r,t)-R_a(r).$$

The same quantity cannot serve two instances. Read-only inputs, reusable tools, and capacity reservation/release are deferred.

## 12. Parallel Activities

Distinct activities can start at the same time when their combined requirements can be satisfied. Three Start items can independently enable Mechanical Design, Electronics Design, and Software Development at t=0. Their durations are sampled independently. Concurrent multiplicity of the **same activity definition** remains unresolved; parallelism of distinct definitions is required.

## 13. Resource Conflicts

If individually enabled activities cannot all start together because their combined requirements exceed available consumable inventory, do not choose a winner by ID, dictionary order, queue order, or randomness.

Latest review clarification: report runtime status `ambiguous_resource_competition`. Static analysis may conservatively warn, but must not reject a model merely because competition is theoretically possible. Conflict detection must consider aggregate demand, not just pairwise conflicts. Requirements are node-local; enablement is evaluated globally.

An explicit probabilistic routing activity can express a modeled choice. Priorities, queues, allocation policies, and decisions are future features. Handling competition among repeated instances depends on the unresolved multiplicity rule.

## 14. Activity Duration

Each activity has a nonnegative duration random variable $D_a$. On instance start, sample once:

$$d\sim D_a,\qquad t_{finish}=t_{start}+d.$$

Each new execution receives a fresh duration sample.

## 15. Supported Duration Distributions

### Fixed

$$D=c,\qquad c\geq0.$$

### Uniform

$$D\sim U(a,b),\qquad0\leq a\leq b.$$

### Triangular

$$D\sim\operatorname{Triangular}(a,m,b),\qquad0\leq a\leq m\leq b.$$

### Beta-PERT

Minimum a, mode m, maximum b with $0\leq a\leq m\leq b$ and default shape parameter $\lambda=4$. When $a<b$:

$$\alpha=1+\lambda\frac{m-a}{b-a},\qquad\beta=1+\lambda\frac{b-m}{b-a},$$

$$Y\sim\operatorname{Beta}(\alpha,\beta),\qquad D=a+(b-a)Y.$$

When $a=b$, return a deterministically. Degenerate uniform and triangular distributions with equal endpoints are also deterministic; do not pass invalid degenerate parameters to a numerical sampler. Whether lambda is exposed as a configurable model field remains an implementation proposal for review, not a requirement.

## 16. Activity Outcomes

Each activity has a nonempty set $O_a=\{o_1,\ldots,o_n\}$. An outcome contains `id`, `label`, `probability`, `target_node`, and `produced_items`. Exactly one outcome is selected per completed instance. Example: Test has PASS with probability 0.8 producing accepted_prototype, and FAIL with probability 0.2 producing failed_prototype at Rework Ready.

## 17. Outcome Probability Rule

$$0\leq p(o)\leq1,\qquad\left|\sum_{o\in O_a}p(o)-1\right|\leq\epsilon,$$

with recommended/default tolerance $\epsilon=10^{-9}$ from the latest review. Never silently normalize probabilities. PASS=0.70 and FAIL=0.20 is invalid. The numerical sampling convention for a sum accepted within tolerance must be documented and reviewed; validation tolerance is not permission to rewrite stored probabilities.

## 18. Deterministic Activities

A single-outcome activity has probability 1. A deterministic outcome does not imply deterministic duration; these are distinct properties.

## 19. Why Probability Belongs to Outcomes

Mechanical Design and Electronics Design can both execute. Their probabilities do not sum to 1. It is the alternative outcomes **within each activity** whose probabilities sum to 1. Enablement determines which activities can execute.

## 20. Probabilistic Routing

A zero-duration routing activity can consume a choice token and produce a procedure-request item at one selected target, for example A with probability 0.6 or B with probability 0.4. A dedicated Chance Gateway may be a future UI feature. Zero duration does not imply zero input requirements.

## 21. Activity Completion

For each completing instance: sample exactly one outcome, deposit its produced items at its target, and mark the instance complete. Complete the entire timestamp batch before checking terminals or enabling new starts. Terminal production occurs before classification. Duration and outcome distributions are separate; no user-defined correlation model is provided in Version 0.1.

## 22. Outcome Production

For each produced item:

$$I_{target(o)}(r,t)\leftarrow I_{target(o)}(r,t)+q_o(r).$$

One outcome can produce several item types at its single target. Example: integrated_system=1, test_request=1, documentation=1.

## 23. Synchronization

Integration is enabled only when all required items have arrived at its source. For mechanical and electronics modules:

$$I_v(mechanical,t)\geq1\quad\text{and}\quad I_v(electronics,t)\geq1.$$

This provides AND-join behavior without a separate gateway construct. It does not introduce multi-source input consumption.

## 24. Event-Driven Simulation

Maintain a priority queue of completion events. Time jumps to the next completion timestamp; no fixed time stepping is needed. Initialize inventory at t=0 and evaluate starts. After every full event batch, classify terminal results and otherwise reevaluate enablement globally. Do not implement this scheduling loop until the start-multiplicity and safety-boundary questions below have been resolved.

## 25. Simultaneous Events

All events sharing the same timestamp form one batch. Sample their outcomes and deposit all outputs before starting new activities. Never return immediately after the first terminal event in a batch.

Latest review clarification: newly started zero-duration activities create **successive batches at the same timestamp**, not additions to the batch currently being processed. Safety limits must prevent infinite zero-time cycles. Approximate timestamp coalescing is not authorized; any proposed time tolerance must be reviewed.

## 26. Starting Enabled Activities

Evaluate enablement globally and check combined consumable requirements before starting a conflict-free set. Consume input atomically at start. Never partially start a competing group just because one definition is processed first. Available inventory can enable distinct activities concurrently.

The previous phrase “any set” must not authorize arbitrary subset selection. Repeated-instance launch counts, retriggering with leftover inventory, and empty requirements remain open questions. Do not invent `max_concurrent_instances` or another policy field to resolve them.

## 27. Repeated Execution

A definition may execute again when new input arrives, such as Test → failed item → Rework → fresh test request → Test. Every execution is a separate instance with fresh stochastic samples. This does not by itself settle concurrent instances of the same definition.

## 28. Activity Definition vs Activity Instance

A definition describes an activity. An instance is one execution and records its start, scheduled finish, sampled duration, and selected outcome when completed. Cancelled instances have not completed and must not be assigned a sampled completion outcome retrospectively. Define the exact public instance schema during architecture review.

## 29. Cycles

Cycles and feedback are legal. Basic test/rework cycles are a Version 0.1 acceptance requirement. Execute them using repeated instances, not by unrolling to a fixed DAG or requiring exact analytical cycle formulas.

## 30. Simulation Safety Limits

Recommended explicit settings:

- `max_activity_completions`
- `max_simulation_time`
- `max_activity_instances`

Run statuses include `terminal`, `deadlock`, `cutoff_activity_count`, `cutoff_time`, `invalid_runtime_state`, `ambiguous_resource_competition`, and `ambiguous_terminal`.

Report cutoffs separately from modeled outcomes. A cutoff is not proof of nontermination. Exact boundary behavior, precedence, and the status for an instance-count cutoff require review; do not silently overload a status or truncate a simultaneous batch.

## 31. Deadlock

A run deadlocks when no terminal has been reached, no activity is running, and no activity is enabled. For example Integration waits for B, but only A exists and nothing can produce B. Deadlock is not automatically a modeled failure terminal. Enabled conflicting activities instead produce the ambiguity status in Section 13.

## 32. Project Termination

When exactly one distinct Terminal node is reached in a fully processed batch at time t:

$$T_{project}=t.$$

Apply all batch production first, then terminate and cancel remaining running instances. Do not start downstream activities after this terminal decision. Multiple arrivals at the same terminal identify one terminal result.

## 33. Simultaneous Terminal Outcomes

If a batch reaches more than one distinct Terminal node, classify `ambiguous_terminal` after processing the complete batch. Do not pick one by ordering, probability, category, or label. Distinct nodes remain distinct even if their category is the same.

## 34. Monte Carlo Simulation

For N realizations, initialize each with the same model inventory. Sample activity durations and completion outcomes. Use independent pseudorandom streams reproducibly derived from the request seed. A simulated run and a mathematical infinite trajectory are not the same thing when safety limits intervene.

## 35. Reproducibility

Accept a seed and return the seed used. Reproduce results for the same model, engine version, settings, and seed to the degree supported by numerical libraries. Record versions needed to interpret this guarantee. Deterministic random-number assignment must not become an implicit resource-allocation policy. Proposed event ordering and stream derivation should be documented during review.

## 36. Project Completion-Time Statistics

For n terminal runs with durations $T_1,\ldots,T_n$, report sample mean, median/P50, P80, P90, P95, and observed minimum/maximum. The mean is:

$$\overline T=\frac1n\sum_{i=1}^{n}T_i.$$

Label these as statistics among terminal runs observed within the limits, not unconditional project completion-time estimates. If n=0, results are unavailable, not zero. Eventually provide per-terminal results such as $E[T\mid O=k]$. Exclude cutoff, deadlock, and ambiguous run times from terminal duration samples; show their frequencies separately.

## 37. Outcome Probability

$$\widehat P_k=\frac{\#\{\text{runs terminating at }k\}}{N}.$$

Report terminal outcomes, deadlocks, safety cutoffs, ambiguous results, and invalid runtime states separately with counts and denominators. Do not renormalize terminal outcomes after dropping other statuses. These estimates describe observed terminal outcomes under configured limits.

## 38. Activity Execution Statistics

If $X_i(a)$ is the execution count for activity a in realization i:

$$\widehat E[X(a)]=\frac1N\sum_{i=1}^{N}X_i(a),$$

$$\widehat P(X(a)\geq1)=\frac1N\sum_{i=1}^{N}\mathbf1\{X_i(a)\geq1\}.$$

Probability of at least two executions is useful for loops. Started versus completed counting and treatment of cancellation must be settled explicitly before exposing a single field called “executions.” Counts from cutoff runs are truncated observations; label them accordingly.

## 39. Activity Timing Statistics

Future aggregates include first-start and first-finish means and percentiles, with sample counts and conditioning on occurrence. These help identify synchronization bottlenecks.

## 40. Item Arrival Statistics

Optionally record the first time $A_{v,r}$ an item becomes available at a node. Future metrics include arrival probability and conditional mean, median, P80, and P90 arrival times. The precise handling of initial inventory and immediate consumption should be documented before these metrics are implemented.

## 41. Costs

Costs are not required in Version 0.1. Future activity-instance costs may be accumulated into project cost. No Version 0.1 behavior depends on cost fields, distributions, or statistics.

## 42. Capacity Resources

Engineers, machines, laboratories, and limited-capacity facilities are outside Version 0.1. Future resources reserved during execution and released at completion differ from the consumable items defined here.

## 43. Exact Mathematical Analysis

Concurrency, synchronization, inventories, running instances, arbitrary duration distributions, and cycles make a simple absorbing Markov chain over graph nodes invalid for the general model. The stochastic state must represent the full execution state. Monte Carlo is the primary general-purpose solver; restricted exact or semi-exact solvers may be added later.

## 44. Relationship to Petri Nets

Nodes holding items, activities consuming and producing them, concurrency, and input-based synchronization resemble Petri nets and stochastic activity networks. This observation does not import additional firing policies or semantics. Ordinary users need not see this terminology.

## 45. Model Validation

Require unique node, activity, and item-type IDs; exactly one Start; valid initial items; existing sources and targets; declared item references; at least one outcome per activity; finite probabilities in [0,1] summing to 1 within tolerance; valid finite duration parameters; finite nonnegative quantities; no outgoing Terminal activities; and no incoming outcomes into Start. Reject NaN and infinities, which cannot represent valid finite inventory or scheduled durations in this model.

Outcome-ID uniqueness scope and terminal-code uniqueness are schema questions to resolve during review. Zero requirements are currently allowed by the inequalities, but their execution consequences are unresolved; do not silently introduce a nonempty-requirement constraint.

## 46. Additional Validation Warnings

Warn conservatively about unreachable nodes/terminals, apparently unavailable or unused items, apparently impossible enablement, possible deadlocks, cycles, unlimited item generation, competing consumption, and ambiguous terminal configurations. A graph path alone does not prove item-level reachability. A possible conflict is not automatically a structural error.

## 47. Canonical JSON Structure

The following is an illustrative structure, not a runnable acceptance fixture. All referenced items are declared, correcting the incomplete earlier example. Activity and duration examples below use the same vocabulary.

```json
{
  "schema_version": "0.1",
  "project": {"id": "example", "name": "Example Project"},
  "item_types": [
    {"id": "mechanical_request", "label": "Mechanical Request"},
    {"id": "mechanical_module", "label": "Mechanical Module"}
  ],
  "nodes": [
    {"id": "start", "type": "start", "label": "Start", "initial_inventory": {"mechanical_request": 1}},
    {"id": "integration", "type": "state", "label": "Integration"},
    {"id": "success", "type": "terminal", "label": "Success", "outcome_code": "success", "outcome_label": "Success", "outcome_category": "success"}
  ],
  "activities": []
}
```

The exact versioned schema and location of simulation-request settings should be proposed during architecture review; do not add semantic fields without a supporting rule.

## 48. Example Activity

```json
{
  "id": "mechanical_design",
  "label": "Mechanical Design",
  "source_node": "start",
  "requirements": {"mechanical_request": 1},
  "duration": {"type": "triangular", "min": 2, "mode": 4, "max": 7},
  "outcomes": [
    {
      "id": "complete",
      "label": "Complete",
      "probability": 1.0,
      "target_node": "integration",
      "produced_items": {"mechanical_module": 1}
    }
  ]
}
```

This is an activity fragment. Inserting it in Section 47 still does not provide a complete workflow to Success.

## 49. Example Parallel Integration Model

Start holds one request each for Mechanical Design, Electronics Design, and Software Development. All three start at t=0 and deliver mechanical_module, electronics_module, and software_build to Integration. Integration requires one of each. With no other constraints:

$$t_{integration,start}=\max(t_M,t_E,t_S).$$

For deterministic durations 3, 5, and 8, Integration starts at t=8. With integration duration d and a terminal outcome, the project finishes at 8+d. This is a mandatory regression test.

## 50. Example Probabilistic Activity

Test consumes one prototype, has triangular duration with minimum 1, mode 2, maximum 4, and PASS/FAIL probabilities 0.8/0.2. Their sum must validate as 1. Empirical frequencies should agree with the configured probabilities within statistically justified Monte Carlo uncertainty.

## 51. Example Rework Cycle

A Test at Test Ready consumes a prototype. PASS (0.8) reaches Success; FAIL (0.2) deposits failed_prototype at Rework Ready. Rework consumes that item and returns a fresh prototype to Test Ready. An initial activity from Start supplies the first prototype, because routing back into Start is prohibited. Repeated tests use fresh samples. Safety limits bound pathological runs.

## 52. Version 0.1 Acceptance Tests

1. Deterministic linear workflow: known finish time is exact.
2. Parallel workflow: durations 3, 5, and 8 enable Integration exactly at t=8.
3. Stochastic duration: sampled statistics match each supported distribution with justified tolerances; include degenerate cases.
4. Probabilistic outcomes: empirical 0.8/0.2 frequencies are statistically consistent.
5. Invalid probabilities: 0.7/0.2 is rejected; test boundaries and tolerance without normalization.
6. Synchronization: an activity requiring A, B, and C remains disabled until all exist.
7. Simultaneous completion: all batch production precedes new starts.
8. Deadlock: an unsatisfiable workflow with no running/enabled activity reports deadlock.
9. Seed reproducibility: identical model, version, settings, and seed reproduce results.
10. Basic cycle: Test/Rework/Test repeats correctly and respects limits.
11. Competition: actual aggregate inventory conflict reports `ambiguous_resource_competition`; theoretical competition alone is a warning.
12. Terminals: two distinct terminals in one batch report `ambiguous_terminal`; repeated arrivals at one terminal do not.
13. Terminal production: apply output before terminal classification; cancel remaining running instances without marking them completed.
14. Zero-duration chains: successive same-time batches work, and zero-time cycles meet safety limits.
15. Quantities: input consumption and output accumulation are correct and never double-spend inventory.
16. Reporting: statuses account for all realizations; nonterminal times are not included in terminal duration statistics; zero terminal samples produce unavailable metrics.

Add multiplicity, cutoff-boundary, and count-convention tests after the associated semantic decisions are approved. These tests must verify the specification, not freeze an arbitrary implementation assumption.

## 53. Fundamental Version 0.1 Principles

- Activities execute; nodes hold items and state.
- Distinct activities may execute simultaneously.
- Activities start only when their required quantities exist.
- Inputs are consumed at start; selected outcomes produce outputs at completion.
- Probabilities sum to 1 within each activity's outcomes and are never silently normalized.
- Synchronization follows from input requirements.
- Process full simultaneous-event batches before enabling activities or choosing a terminal result.
- Report unresolved resource competition and simultaneous distinct terminals explicitly.
- Monte Carlo is the general Version 0.1 solver.
- Cycles are legal and basic cycle execution is required.
- Costs and capacity scheduling are deferred.

## Open Questions — Review Before Affected Implementation

These are unresolved semantics, not an invitation to invent defaults:

1. **Same-definition concurrency and multiplicity:** If inventory supports several executions, how many start now? Can one definition overlap itself? What retriggers it when leftover inventory remains? No `max_concurrent_instances` field is approved.
2. **Empty/all-zero requirements:** Such an activity is always enabled under the current inequalities. Is it prohibited, one-shot, externally triggered, or governed by another explicit rule? Safety limits alone do not define the intended firing policy.
3. **Quantity arithmetic:** Numeric quantities are allowed. Choose and approve exact/decimal/floating representation and any comparison tolerance or tiny-negative handling; do not silently round quantities or invent integer/continuous item types.
4. **Safety boundaries and precedence:** Define inclusive/exclusive time horizons, completion/instance limits at simultaneous batches, precedence when a terminal coincides with a limit, and the instance-limit status. Preserve complete-batch terminal semantics.
5. **Probability tolerance sampling:** Specify how accepted sums differing from 1 by at most epsilon are sampled without silently modifying or normalizing the model.
6. **Execution counters:** Define started, completed, and cancelled counts and which feeds the displayed execution metric, including cutoff runs.
7. **Schema identity rules:** Decide outcome-ID uniqueness scope, terminal-code uniqueness, duration field names, and simulation settings placement. These choices must support the stated semantics.
8. **Random stream assignment:** Document how draws are assigned to instances and batch events reproducibly, including behavior under reordered serialized elements. No random policy may resolve a resource conflict.

Current next step: Antigravity reads both files and returns its interpretation, architecture (including examples and architecture/roadmap documents), contradictions, unresolved questions, and correctness test plan. It must not implement the mathematical engine or modify these specifications during this review-only step.
