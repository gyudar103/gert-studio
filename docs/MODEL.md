# GERT Studio — Mathematical Model Specification

Revision: 2026-09-14 — approved semantic decisions D1–D8 for Version 0.1.

The approved decisions D1–D8 and their clarifications are normative and incorporated below.

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

Terminal metadata includes `outcome_code`, `outcome_label`, and `outcome_category`. Recommended categories are `success`, `failure`, `neutral`, and `custom`. Terminal node IDs are authoritative. Terminal `outcome_code` values must be unique across terminal nodes; labels and categories need not be unique. Reaching a terminal ends the realization subject to the complete simultaneous-event batch rule in Sections 25, 32, and 33. Remaining running instances are cancelled when one modeled terminal ends the realization; an ambiguous-terminal result instead follows nonterminal lifecycle accounting in Section 28.

## 7. Item Types

Items can be available, required, consumed, or produced. Examples: prototype, approval_document, test_sample, software_build. They are **flow resources**, not reusable capacity resources such as engineers or machines. Each item type has an ID and readable label.

## 8. Item Quantity

For node v and item r:

$$I_v(r,t)\geq0.$$

Quantities may be nonnegative numeric values, not just Boolean presence. Examples: steel=50, prototype=1, approval_document=1. No sophisticated unit conversion is required. All referenced item types must be declared. Inventories, requirements, production, and consumption use exact decimal arithmetic. Enablement comparisons are exact. Do not use a generic quantity epsilon, silently round inventory arithmetic, or clamp tiny negative quantities. Integer-only item classes and inventory caps are not defined here.

## 9. Activity

An activity definition contains `id`, `label`, `source_node`, `requirements`, `duration`, and `outcomes`. It visually lives on an edge or edge-like connection. It consumes input at one source node and, upon completion, routes production to one selected outcome target.

## 10. Activity Input Requirements

Each activity has requirements $R_a(r)\geq0$ and must contain at least one strictly positive consumable input requirement. Empty or all-zero requirements are validation errors. It is individually enabled when:

$$I_{source(a)}(r,t)\geq R_a(r)\quad\text{for every required }r.$$

An Integration activity requiring one mechanical module, one electronics module, and one software build cannot start until all are available at its source node. Inputs do not pool across distinct nodes.

## 11. Input Consumption

Inputs are consumed atomically when an instance starts:

$$I_{source(a)}(r,t)\leftarrow I_{source(a)}(r,t)-R_a(r).$$

The same quantity cannot serve two instances. Read-only inputs, reusable tools, and capacity reservation/release are deferred.

## 12. Parallel Activities

Distinct activities can start at the same time when their combined requirements can be satisfied. Three Start items can independently enable Mechanical Design, Electronics Design, and Software Development at t=0. At each global enablement evaluation, each definition launches the maximum nonnegative integer number of concurrent instances permitted by its currently available consumable requirements, subject to the aggregate competition check and safety limits. The same definition may overlap itself. Each instance consumes its own requirements atomically and receives fresh independent duration and outcome samples at the lifecycle points specified below.

## 13. Resource Conflicts

If individually enabled activities cannot all start together because their combined requirements exceed available consumable inventory, do not choose a winner by ID, dictionary order, queue order, or randomness.

Report runtime status `ambiguous_resource_competition`. Static analysis may conservatively warn, but must not reject a model merely because competition is theoretically possible. Conflict detection must consider aggregate demand, not just pairwise conflicts. Requirements are node-local; enablement is evaluated globally.

An explicit probabilistic routing activity can express a modeled choice. Priorities, queues, allocation policies, and decisions are future features. Aggregate demand includes the maximum launch multiplicities computed under Section 26. If those launch sets compete for insufficient shared inventory, report `ambiguous_resource_competition`; do not reduce one definition's multiplicity to choose an allocation implicitly. A genuine model ambiguity already observed before a prospective launch cutoff takes precedence over that cutoff.

## 14. Activity Duration

Each activity has a nonnegative duration random variable $D_a$. On instance start, sample once:

$$d\sim D_a,\qquad t_{finish}=t_{start}+d.$$

Each new execution receives a fresh duration sample. User-entered duration parameters use exact decimal semantics. Simulation timestamps and scheduled finish times use an exact decimal-compatible representation, so mathematically equal timestamps are not separated by binary floating-point artifacts. The stochastic sampler may use an approved deterministic RNG internally, but sampled durations must be converted deterministically into the engine's canonical time representation before scheduling. The concrete implementation type and encoding may be chosen during architecture review, but must preserve these semantics and reproducibility.

## 15. Supported Duration Distributions

Every duration uses an explicit `type` discriminator. Every required numeric parameter must be explicitly supplied; there are no hidden or default numeric distribution parameters. Canonical parameter names are `value` for fixed; `min`, `max` for uniform; `min`, `mode`, `max` for triangular; and `min`, `mode`, `max`, `lambda` for beta-PERT. The UI must clearly expose every required parameter.

### Fixed

$$D=c,\qquad c\geq0.$$

### Uniform

$$D\sim U(a,b),\qquad0\leq a\leq b.$$

### Triangular

$$D\sim\operatorname{Triangular}(a,m,b),\qquad0\leq a\leq m\leq b.$$

### Beta-PERT

Beta-PERT requires explicit user-supplied `min` (a), `mode` (m), `max` (b), and `lambda` ($\lambda$). All parameters must be finite real numbers, with $0\leq a\leq m\leq b$ and $\lambda>0$. There is no numeric default for `lambda`. Incomplete or invalid parameters are validation errors. When $a<b$:

$$\alpha=1+\lambda\frac{m-a}{b-a},\qquad\beta=1+\lambda\frac{b-m}{b-a},$$

$$Y\sim\operatorname{Beta}(\alpha,\beta),\qquad D=a+(b-a)Y.$$

When $a=b$, return a deterministically. Degenerate uniform and triangular distributions with equal endpoints are also deterministic; do not pass invalid degenerate parameters to a numerical sampler. Explicit parameter requirements still apply to degenerate distributions.

## 16. Activity Outcomes

Each activity has a nonempty set $O_a=\{o_1,\ldots,o_n\}$. An outcome contains `id`, `label`, `probability`, `target_node`, and `produced_items`. Exactly one outcome is selected per completed instance. Example: Test has PASS with probability 0.8 producing accepted_prototype, and FAIL with probability 0.2 producing failed_prototype at Rework Ready.

## 17. Outcome Probability Rule

$$0\leq p(o)\leq1,\qquad\left|\sum_{o\in O_a}p(o)-1\right|\leq\epsilon,$$

with `probability_epsilon = 1e-14`, so $\epsilon=10^{-14}$. Each probability must individually be finite and within [0,1]. The declared probabilities must pass these individual requirements and the inclusive sum tolerance before the sampling convention below applies; the resulting final effective interval must also be valid. PASS=0.70 and FAIL=0.20 is invalid.

Stored declared probabilities are never rewritten, and proportional normalization is prohibited. Use canonical outcome-ID order. For all outcomes except the canonical final outcome, use their declared probabilities as sampling intervals, arranged cumulatively in that order. Define the final outcome's effective interval as:

$$p_{last,effective}=1-\sum_{i\text{ preceding last}}p_i.$$

This interval must be valid, $0\leq p_{last,effective}\leq1$; do not use this convention if it is invalid. After the original declared total passes the inclusive 1e-14 tolerance, the final outcome absorbs only the tiny accepted residual, whether the declared total is slightly below or slightly above 1. This closes the sampling intervals exactly to 1 and is a sampling convention only; it does not modify stored model probabilities.

## 18. Deterministic Activities

A single-outcome activity selects its sole outcome with certainty; its declared probability must satisfy Section 17, including the tolerance around 1. A deterministic outcome does not imply deterministic duration; these are distinct properties.

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

Maintain a priority queue of completion events. Time jumps to the next completion timestamp; no fixed time stepping is needed. Initialize inventory at t=0 and evaluate starts. After every full permitted event batch, classify terminal results and otherwise reevaluate enablement globally. Apply the launch multiplicity rules in Section 26 and inclusive atomic safety limits in Section 30.

## 25. Simultaneous Events

All events sharing the same canonical simulation timestamp form one batch. Compare canonical times exactly using the representation in Section 14. Sample their outcomes and deposit all outputs before starting new activities. Never return immediately after the first terminal event in a batch.

Newly started zero-duration activities create **successive batches at the same timestamp**, not additions to the batch currently being processed. Safety limits must prevent infinite zero-time cycles. Do not use an arbitrary timestamp epsilon or approximate timestamp coalescing.

## 26. Starting Enabled Activities

Evaluate enablement globally and check combined consumable requirements before starting a conflict-free set. Consume input atomically at start. Never partially start a competing group just because one definition is processed first. Available inventory can enable distinct activities concurrently.

For each definition a, compute its maximum launch count from the same current inventory before any proposed launch consumes inputs:

$$k_a=\min_{r:R_a(r)>0}\left\lfloor\frac{I_{source(a)}(r,t)}{R_a(r)}\right\rfloor.$$

Compute this integer bound exactly from decimal quantities. At least one positive requirement is mandatory, so the minimum is defined. Existing running instances do not impose a same-definition concurrency cap. Check the combined demand of all proposed instances across definitions before consumption; insufficient shared inventory is `ambiguous_resource_competition`, not permission to choose a subset. Check the whole conflict-free launch set against the instance limit before admitting it. Each admitted instance consumes its own inputs atomically and becomes started. Reevaluate using current inventory after each permitted completion batch, including leftover inventory and newly produced items. No `max_concurrent_instances` policy field is introduced.

## 27. Repeated Execution

A definition may execute again when new input arrives, such as Test → failed item → Rework → fresh test request → Test. Every execution is a separate instance with fresh independent stochastic samples. Concurrent instances of the same definition follow the maximum-multiplicity rule in Section 26.

## 28. Activity Definition vs Activity Instance

A definition describes an activity. An instance is one execution and records its start, scheduled finish, sampled duration, and selected outcome when completed. It becomes `started` when its requirements are consumed, and `completed` only when its completion event is processed and an outcome is sampled. A running instance terminated because a modeled terminal ended the realization is `cancelled`.

A running instance still active when the realization ends for a nonterminal reason is `unfinished_at_run_end`. Track its reason, including at least cutoff, ambiguity, and invalid runtime state. Reporting may expose `unfinished_at_cutoff`, `unfinished_at_ambiguity`, and `unfinished_at_invalid_runtime` as reason-specific counters. Do not classify ambiguity- or cutoff-interrupted work as cancelled. Neither cancelled nor unfinished instances receive retrospective completion outcomes.

At realization end, maintain the lifecycle invariant:

`started = completed + cancelled + unfinished_at_run_end`

Track these counts separately as specified in Section 38. The public instance schema must preserve these lifecycle rules.

## 29. Cycles

Cycles and feedback are legal. Basic test/rework cycles are a Version 0.1 acceptance requirement. Execute them using repeated instances, not by unrolling to a fixed DAG or requiring exact analytical cycle formulas.

## 30. Simulation Safety Limits

Simulation-request safety settings are inclusive maxima:

- `max_activity_completions`
- `max_simulation_time`
- `max_activity_instances`

Run statuses include `terminal`, `deadlock`, `cutoff_activity_count`, `cutoff_instance_count`, `cutoff_time`, `invalid_runtime_state`, `ambiguous_resource_competition`, and `ambiguous_terminal`.

Reaching a configured maximum exactly is permitted; it does not by itself end the run.

For each prospective completion batch, apply this deterministic precedence:

1. Inspect the next batch timestamp, $t_{next}$.
2. If $t_{next}>\texttt{max_simulation_time}$, return `cutoff_time`.
3. Otherwise, if processing the complete batch would exceed `max_activity_completions`, return `cutoff_activity_count`.
4. Otherwise process the complete batch atomically.

Thus the time horizon is checked before the completion-count budget for the same prospective batch. Do not inspect or sample outcomes from a batch blocked by either cutoff.

- Process events only at $t\leq\texttt{max_simulation_time}$. An event beyond the horizon cannot be processed and causes `cutoff_time` when progression would require it.
- A same-timestamp completion batch is atomic with respect to `max_activity_completions`. If processing the entire batch would exceed that maximum, process none of it and return `cutoff_activity_count`. Do not sample its outcomes or deposit its production.
- All launches from one global enablement evaluation are atomic with respect to `max_activity_instances`, the cumulative started-instance limit. If the full launch set would exceed it, admit none of the set and return `cutoff_instance_count`; do not partially consume its inputs.
- A permitted full batch reaching one terminal returns `terminal`; a permitted batch reaching multiple distinct terminals returns `ambiguous_terminal`. Both take precedence over merely reaching a count maximum exactly.
- Never process an over-limit batch to discover whether it would reach a terminal.
- Zero-duration chains at exactly the time horizon remain eligible as successive same-time batches, subject to finite instance/completion limits.
- Report a genuine model ambiguity already observed before a prospective launch cutoff rather than hiding it behind that cutoff.

Report cutoffs separately from modeled outcomes. A cutoff is not proof of nontermination. Running instances at a safety cutoff are `unfinished_at_run_end` with reason cutoff, reportable as `unfinished_at_cutoff`, and are not cancelled.

## 31. Deadlock

A run deadlocks when no terminal has been reached, no activity is running, and no activity is enabled. For example Integration waits for B, but only A exists and nothing can produce B. Deadlock is not automatically a modeled failure terminal. Enabled conflicting activities instead produce the ambiguity status in Section 13.

## 32. Project Termination

When exactly one distinct Terminal node is reached in a fully processed batch at time t:

$$T_{project}=t.$$

Apply all batch production first, then terminate and cancel remaining running instances. Do not start downstream activities after this terminal decision. Multiple arrivals at the same terminal identify one terminal result.

## 33. Simultaneous Terminal Outcomes

If a batch reaches more than one distinct Terminal node, classify `ambiguous_terminal` after processing the complete batch. Do not pick one by ordering, probability, category, or label. Distinct nodes remain distinct even if their category is the same. Instances completed in the batch remain completed; any still-running instances are `unfinished_at_run_end` with reason ambiguity, not cancelled.

## 34. Monte Carlo Simulation

For N realizations, initialize each with the same model inventory. Sample activity durations and completion outcomes. Use independent pseudorandom streams reproducibly derived from the request seed. A simulated run and a mathematical infinite trajectory are not the same thing when safety limits intervene.

## 35. Reproducibility

Use deterministic independently keyed random streams, not one traversal-dependent global RNG stream. Derive streams from the root seed, realization index, activity ID, activity-instance ordinal, and draw purpose. Duration and outcome sampling use separate streams. Assign deterministic monotonically increasing instance ordinals within each (realization, activity_id). Sample durations at start and outcomes only at completion.

Semantically irrelevant ordering of serialized nodes, activities, items, and outcomes must not change results. Use canonical ID-based ordering when ordering is needed, including cumulative outcome sampling. Canonical ordering must never resolve resource competition. UI-only metadata and labels do not affect RNG streams; changing canonical mathematical IDs may change them.

The same mathematical model, simulation settings, root seed, and reproducibility version must produce identical realizations and aggregate results regardless of execution parallelism. Increasing the realization count must preserve the earlier realization prefix. Aggregation must also honor the parallelism-independent result guarantee.

Results must record the root seed, engine version, and reproducibility version. If no seed is supplied, generate one and return it. Do not use Python's built-in `hash()` for the reproducibility contract. The architecture must document the concrete stable key encoding, stream derivation, sampling algorithms, and reproducibility version in conformance with this contract.

## 36. Project Completion-Time Statistics

For n terminal runs with durations $T_1,\ldots,T_n$, report sample mean, median/P50, P80, P90, P95, and observed minimum/maximum. The mean is:

$$\overline T=\frac1n\sum_{i=1}^{n}T_i.$$

Label these as statistics among terminal runs observed within the limits, not unconditional project completion-time estimates. If n=0, results are unavailable, not zero. Eventually provide per-terminal results such as $E[T\mid O=k]$. Exclude cutoff, deadlock, and ambiguous run times from terminal duration samples; show their frequencies separately.

## 37. Outcome Probability

$$\widehat P_k=\frac{\#\{\text{runs terminating at }k\}}{N}.$$

Report terminal outcomes, deadlocks, safety cutoffs, ambiguous results, and invalid runtime states separately with counts and denominators. Do not renormalize terminal outcomes after dropping other statuses. These estimates describe observed terminal outcomes under configured limits.

## 38. Activity Execution Statistics

Track separate counts for `started`, `completed`, `cancelled`, and `unfinished_at_run_end`, following Section 28 and its end-of-realization invariant. Track reasons for unfinished instances, including cutoff, ambiguity, and invalid runtime state; reason-specific counters may be exposed separately. Initial activity-frequency metrics use starts. If $X_i(a)$ is the started-instance count for activity a in realization i:

$$\widehat E[X(a)]=\frac1N\sum_{i=1}^{N}X_i(a),$$

$$\widehat P(X(a)\geq1)=\frac1N\sum_{i=1}^{N}\mathbf1\{X_i(a)\geq1\}.$$

Label these metrics as mean starts per realization and probability of at least one start. Probability of at least two starts is useful for loops. Completed, cancelled, and unfinished-at-run-end counts, with unfinished reasons, remain separately reportable. Counts from cutoff runs are truncated observations; label them accordingly. Do not conflate completion, cancellation, and unfinished work in a generic execution count.

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

Node IDs, activity IDs, and item-type IDs must each be unique within the model. Outcome IDs must be unique within their parent activity; canonical outcome identity is (activity_id, outcome_id). Terminal node IDs are authoritative and terminal `outcome_code` values must be unique across terminal nodes; labels and categories need not be unique.

Reject empty or all-zero requirements; every activity needs at least one strictly positive consumable input. Apply exact decimal quantity validation and comparisons. Validate probabilities with `probability_epsilon = 1e-14` and require a valid final effective sampling interval as specified in Section 17. Require the explicit duration discriminator and every required numeric parameter from Section 15; do not insert hidden numeric defaults. User-entered duration parameters have exact decimal semantics. Beta-PERT requires finite user-supplied `min`, `mode`, `max`, and `lambda`, with `0 <= min <= mode <= max` and `lambda > 0`; incomplete or invalid parameters are validation errors, including in degenerate cases.

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

Simulation settings belong to the simulation request, not inside the mathematical model. A future project/export container may store the model and preferred simulation settings as separate sections. The exact versioned schema must preserve the identity rules in Section 45, explicit duration parameters in Section 15, and exact decimal quantities. Do not add semantic fields without a supporting rule.

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
3. Stochastic duration: sampled statistics match each supported distribution with justified tolerances; include degenerate cases. Beta-PERT rejects missing parameters, nonfinite values, nonpositive lambda, and invalid min/mode/max ordering; no lambda default is inserted. Sampled durations are deterministically converted to canonical simulation time before scheduling.
4. Probabilistic outcomes: empirical 0.8/0.2 frequencies are statistically consistent.
5. Invalid probabilities: 0.7/0.2 is rejected; reject individually invalid/nonfinite probabilities. Test sums below and above 1 at, within, and outside the inclusive 1e-14 tolerance. In canonical outcome-ID order, all preceding intervals retain their declared values and the final effective interval equals 1 minus their sum. Verify residual closure for both accepted undersums and oversums, a valid final effective interval, and absence of proportional normalization or stored-value rewriting. An accepted near-one declared total with an invalid final effective interval must not be sampled using this convention.
6. Synchronization: an activity requiring A, B, and C remains disabled until all exist.
7. Simultaneous completion: all batch production precedes new starts. Canonical times compare exactly: fixed decimal durations 0.1 followed by 0.2 finish at the same timestamp as a parallel fixed duration 0.3. Distinct canonical timestamps must not be merged by an epsilon or approximate coalescing.
8. Deadlock: an unsatisfiable workflow with no running/enabled activity reports deadlock.
9. Seed reproducibility: identical mathematical model, settings, root seed, and reproducibility version reproduce identical realizations and aggregates across execution parallelism and irrelevant serialized ordering. Reordering outcomes preserves canonical cumulative sampling. Increasing realization count preserves the earlier prefix. Labels/UI metadata do not affect draws. Verify separate duration/outcome keys and monotonically assigned per-activity instance ordinals; results return root seed and both version fields, including generated seeds.
10. Basic cycle: Test/Rework/Test repeats correctly and respects limits.
11. Competition: actual aggregate inventory conflict reports `ambiguous_resource_competition`; theoretical competition alone is a warning.
12. Terminals: two distinct terminals in one batch report `ambiguous_terminal`; repeated arrivals at one terminal do not.
13. Terminal production: apply output before terminal classification; cancel remaining running instances without marking them completed.
14. Zero-duration chains: successive same-time batches work, and zero-time cycles meet safety limits.
15. Quantities: exact decimal consumption, accumulation, and comparisons never double-spend inventory. Include fractional quantities and exact enablement boundaries; no generic epsilon, rounding, or tiny-negative clamping is allowed.
16. Reporting: statuses account for all realizations; nonterminal times are not included in terminal duration statistics; zero terminal samples produce unavailable metrics.

17. Multiplicity: launch the maximum integer number of same-definition instances permitted by all positive requirements, including while earlier instances are running. Verify individual consumption, independent keyed samples, and reevaluation after production. Aggregate competition between definitions reports ambiguity without implicitly reducing a definition's launch count.
18. Positive requirements: empty and all-zero requirements are rejected; a requirement set with at least one positive quantity may include zero entries.
19. Safety boundaries: exact maxima are permitted. Check the prospective batch timestamp first: if beyond the horizon, return `cutoff_time` even if the completion budget would also block it. Otherwise an over-budget whole completion batch returns `cutoff_activity_count`; otherwise process it atomically. Over-budget launch sets are rejected in full with `cutoff_instance_count`. No blocked batch has its outcomes inspected or sampled or produces outputs; no rejected launch set consumes inputs. A permitted batch's terminal or ambiguous-terminal result wins over exact count-limit attainment. An observed model ambiguity wins over a prospective launch cutoff. Successive zero-duration batches at the horizon remain eligible within count limits.
20. Lifecycle counters: consumption increments starts; only processed completions with sampled outcomes increment completions. At realization end verify `started = completed + cancelled + unfinished_at_run_end`. Modeled-terminal interruption is cancelled; running instances interrupted by cutoff, ambiguity (including ambiguous terminals), or invalid runtime state are unfinished with the corresponding reason, not cancelled. Verify start-based means/frequencies across all realizations and separately report completed, cancelled, and unfinished observations with reasons.
21. Schema: enforce each model-wide ID namespace, activity-local outcome uniqueness, and terminal-code uniqueness while permitting repeated terminal labels/categories. Require duration discriminators and all numeric parameters, including beta-PERT shape, even in degenerate cases. Simulation settings are separate from the mathematical model.

These tests must verify the approved specification, not freeze an arbitrary implementation assumption.

## 53. Fundamental Version 0.1 Principles

- Activities execute; nodes hold items and state.
- Distinct activities and multiple instances of one definition may execute simultaneously, with maximum consumable-input multiplicity.
- Activities require at least one positive consumable input and start only when their exact decimal required quantities exist.
- Inputs are consumed at start; selected outcomes produce outputs at completion.
- Probabilities sum to 1 within the inclusive 1e-14 tolerance for each activity; declared cumulative sampling closes only the final residual interval and never proportionally normalizes.
- Synchronization follows from input requirements.
- Process full simultaneous-event batches before enabling activities or choosing a terminal result.
- Enforce inclusive safety maxima atomically for completion batches and launch sets.
- Use exact decimal duration-parameter semantics and exact canonical simulation-time comparisons, without timestamp epsilon or approximate coalescing.
- Keep starts, completions, cancellations, and unfinished-at-run-end counts separate, tracking unfinished reasons and preserving the lifecycle invariant; initial frequency metrics use starts.
- Independently keyed randomness preserves results across irrelevant ordering and execution parallelism.
- Report unresolved resource competition and simultaneous distinct terminals explicitly.
- Monte Carlo is the general Version 0.1 solver.
- Cycles are legal and basic cycle execution is required.
- Costs and capacity scheduling are deferred.

## Approved Decisions — D1–D8

The normative rules above implement these decisions: D1 multiplicity (Sections 12, 13, 26, 27); D2 positive requirements (10, 45); D3 exact decimal quantities (8, 26, 45); D4 inclusive atomic safety limits (30); D5 probability validation and residual sampling (17, 18); D6 lifecycle counters (28, 38); D7 schema identity, explicit parameters, and settings placement (6, 15, 45, 47); and D8 independently keyed reproducibility (35). Section 52 provides acceptance requirements for these decisions.

Architecture and public schemas must conform to these decisions without adding implicit allocation policies, numeric defaults, or other unapproved semantics.
