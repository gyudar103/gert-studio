# GERT Studio — Product Specification

## 1. Product Name

**Working name:** GERT Studio

GERT Studio is a standalone application for visually modeling, simulating, and analyzing stochastic projects and processes containing:

- parallel activities,
- uncertain activity durations,
- probabilistic outcomes,
- multiple possible project outcomes,
- synchronization and integration,
- materials, items, and intermediate deliverables,
- and eventually rework loops and repeated activities.

The application extends PERT/GERT concepts into a practical visual stochastic workflow environment.

---

# 2. Product Vision

The central product idea is:

> Draw a project as a network of activities that consume and produce project items, allow activities to execute in parallel, represent uncertain outcomes explicitly, and immediately understand the probability and timing of the possible project results.

Traditional PERT and CPM primarily model precedence:

```text
Activity A
    ↓
Activity B
    ↓
Activity C
```

Real projects frequently behave more like:

```text
                    ┌──► Mechanical Design ──┐
START ──────────────┤                        ├──► Integration
                    └──► Electronics Design ─┘
```

while also containing uncertainty:

```text
Integration
     │
     ▼
    Test
   /    \
 80%    20%
 /        \
PASS     REWORK
```

GERT Studio should model both aspects in the same system.

---

# 3. Core Modeling Concept

The model has three primary concepts:

1. **Nodes**
2. **Activities**
3. **Items / resources**

## 3.1 Nodes represent project states and resource locations

A node can contain one or more items produced by completed activities.

For example:

```text
INTEGRATION READY

Mechanical Assembly       ✓
Electronics Assembly      ✓
Control Software          ✓
```

The next activity can require all three.

This makes nodes useful as:

- synchronization points,
- inventories of completed items,
- project states,
- integration points,
- readiness states.

## 3.2 Activities live on edges

Activities transform project state.

An activity:

- requires one or more input items,
- takes time,
- may have uncertain duration,
- produces one or more output items,
- may have several probabilistic outcomes.

Activities are visually represented as edges or edge-like objects between nodes.

## 3.3 Items flow through the project

Items can represent:

- materials,
- components,
- documents,
- approvals,
- completed designs,
- prototypes,
- test results,
- software modules,
- intermediate products,
- activation tokens.

For Version 0.1, these are **flow resources**.

Capacity resources such as:

- engineers,
- machines,
- laboratories,
- production lines,

are a future feature.

---

# 4. Example: Parallel Development and Integration

A project might contain:

```text
                         ┌── Mechanical Activity ──┐
                         │                         │
START / INPUT ITEMS ─────┤                         ▼
                         │                  INTEGRATION NODE
                         │                         ▲
                         └── Electronics Activity ┘
```

The Mechanical Activity produces:

```text
mechanical_module
```

The Electronics Activity produces:

```text
electronics_module
```

Both items arrive at the Integration node.

The Integration activity requires:

```text
mechanical_module
electronics_module
```

It cannot begin until both are available.

This synchronization mechanism is a fundamental Version 0.1 feature.

---

# 5. Primary Product Goals

GERT Studio should allow the user to:

1. Visually construct a project/process network.
2. Place activities between project states.
3. Define items required by activities.
4. Define items produced by activities.
5. Execute independent activities in parallel.
6. Synchronize several parallel branches.
7. Define uncertain activity durations.
8. Define several possible outcomes of an activity.
9. Assign probabilities to those outcomes.
10. Define multiple terminal project outcomes.
11. Run Monte Carlo simulations.
12. Analyze project completion-time distributions.
13. Analyze terminal-outcome probabilities.
14. Understand which activities and outcomes drive schedule risk.
15. Save, reload, and export complete models.

---

# 6. Version 0.1 Scope

Version 0.1 should support:

## Nodes

- Start
- State / Resource
- Terminal Outcome

## Items

Nodes may contain several named items.

Example:

```text
Node: Integration

Items:
- mechanical_design
- electronics_design
- firmware
```

Activities can require combinations of these items.

## Activities

An activity contains:

- name,
- source node,
- required input items,
- duration distribution,
- one or more possible outcomes.

Each outcome contains:

- probability,
- target node,
- produced items.

## Duration Distributions

Initially:

- fixed,
- uniform,
- triangular,
- PERT-beta.

## Parallel execution

Several activities may be running simultaneously.

## Synchronization

An activity may require several items before it can begin.

## Probabilistic outcomes

Every activity has one or more possible outcomes.

The probabilities of the outcomes of a particular activity must satisfy:

\[
\sum_{k=1}^{n}p_k=1
\]

within numerical tolerance.

## Monte Carlo analysis

Users should be able to execute:

- 1,000 simulations,
- 10,000 simulations,
- 100,000 simulations,
- or a custom number.

A random seed should be supported for reproducibility.

---

# 7. Important Probability Rule

Parallel execution means that probabilities cannot simply be assigned to every activity leaving a node and globally required to sum to 1.

For example:

```text
                   Mechanical Design
                  /
START / ITEMS ───<
                  \
                   Electronics Design
```

Both activities may execute.

They are not alternatives.

Therefore there is no probability such as:

```text
Mechanical = 50%
Electronics = 50%
```

Both happen.

Probability instead belongs to an activity's **outcomes**.

Example:

```text
                 ┌── PASS   0.80
TEST ACTIVITY ───┤
                 └── FAIL   0.20
```

and:

\[
0.80+0.20=1.
\]

A deterministic activity has one outcome:

\[
p=1.
\]

This rule preserves the requirement that alternative probabilities always sum to 1 while still allowing parallel activities.

---

# 8. Stochastic Choice Between Procedures

Sometimes the project itself must choose one of several alternative procedures.

Example:

```text
                ┌── Procedure A   0.60
READY ──────────┤
                └── Procedure B   0.40
```

This can initially be modeled as a zero-duration routing activity with two outcomes.

Future versions may introduce an explicit graphical **Chance Gateway** for this purpose.

---

# 9. Parallel Execution

Version 0.1 must not assume that only one activity is active.

For example:

```text
t = 0

Mechanical Design      running
Electronics Design     running
Software Development   running
```

Activities finish according to their independently sampled durations.

An integration activity may then wait for all required outputs.

Example:

```text
Mechanical finished      t = 4.2
Software finished        t = 5.7
Electronics finished     t = 8.1

Integration starts       t = 8.1
```

This is one of the defining features of the product.

---

# 10. Integration and Synchronization

Nodes should naturally support accumulation.

Example:

```text
                 Mechanical Module
                        │
                        ▼
                 ┌──────────────┐
Software ───────►│ INTEGRATION  │◄──── Electronics
                 │              │
                 └──────┬───────┘
                        │
                 requires all 3
                        ▼
                  SYSTEM ASSEMBLY
```

The Integration node may receive its required items at different times.

The next activity starts only when its complete input requirement is satisfied.

---

# 11. Resources in Version 0.1

Version 0.1 distinguishes between:

## Flow resources

Supported.

Examples:

- material,
- component,
- design,
- completed module,
- approval,
- test result.

These move through the network.

## Capacity resources

Not yet supported.

Examples:

- five engineers,
- one test facility,
- two machines,
- limited supplier capacity.

Capacity-resource scheduling is planned for a later version.

This distinction keeps the first simulation engine manageable while still supporting integration and parallel development.

---

# 12. Costs

Cost modeling is useful but is **not required for Version 0.1**.

The architecture should allow cost to be added later without changing the underlying network semantics.

Future activity cost support may include:

- fixed cost,
- uncertain cost,
- cost per execution,
- resource-related cost,
- project cost distributions.

Version 0.1 should focus on getting the stochastic workflow and timing model correct first.

---

# 13. Cycles and Rework

The architecture must allow cycles.

Example:

```text
                    PASS
TEST ─────────────────────────► NEXT STAGE
 │
 │ FAIL
 ▼
REWORK
 │
 └────────────────────────────► TEST
```

Basic cycle execution should preferably be supported in Version 0.1.

However, advanced cycle analysis is not required for Version 0.1.

The minimum requirement is:

> The data model and simulation architecture must never make future cycle support impossible.

Recommended Version 0.1 target:

- cycles accepted by the model,
- cycles executable by Monte Carlo simulation,
- simulation safety limits included,
- advanced analytical loop calculations deferred.

---

# 14. Core User Interface

The main screen should contain:

## Network Canvas

Interactive graph containing nodes and activities.

## Model Explorer / Properties

Selecting a node displays:

- node name,
- items currently defined at that node,
- terminal properties where applicable.

Selecting an activity displays:

- activity name,
- required items,
- duration distribution,
- outcomes,
- probability of each outcome,
- items produced by each outcome.

## Analysis Panel

Initially:

- probability of each project outcome,
- expected completion time,
- median completion time,
- P80,
- P90,
- P95,
- activity execution probability,
- expected activity execution count,
- node/item arrival information.

---

# 15. Simulation Visualization

Eventually the graph itself should display simulation information.

Example:

```text
Mechanical Design
P(executed) = 100%
Mean finish = 4.2 months

Electronics Design
P(executed) = 100%
Mean finish = 6.8 months

Rework
P(executed) = 27%
Expected executions = 0.39
```

Edges may vary visually according to execution probability or expected number of executions.

---

# 16. Version 0.1 Output Metrics

At minimum:

## Outcome metrics

- probability of each terminal outcome,
- probability of successful termination,
- probability of deadlock,
- probability of simulation cutoff.

## Time metrics

- expected project completion time,
- median,
- P50,
- P80,
- P90,
- P95.

Metrics should also eventually be available conditional on outcome:

\[
E[T\mid \text{Success}]
\]

and:

\[
E[T\mid \text{Failure}].
\]

## Activity metrics

For each activity:

- probability activity executes,
- expected number of executions,
- mean start time when executed,
- mean finish time when executed.

## Node/item metrics

Where useful:

- probability an item reaches a node,
- mean arrival time,
- percentile arrival times.

---

# 17. Project Completion

Projects should finish through explicit Terminal Outcome nodes.

Examples:

```text
SUCCESS
TECHNICAL FAILURE
CANCELLED
REJECTED
PARTIAL SUCCESS
```

Terminal outcome nodes may be classified as:

- success,
- failure,
- neutral,
- custom.

Reaching a terminal outcome terminates that simulation realization.

Remaining running activities are cancelled for that realization.

---

# 18. Deadlock Detection

A project can reach a state where:

- no activities are running,
- no activity is enabled,
- no terminal outcome has been reached.

This is a **deadlock**.

Example:

```text
Integration requires:

A
B
C

but C can never arrive.
```

The simulator must report deadlock explicitly.

It must not silently classify deadlock as project failure.

---

# 19. Validation

Validation should detect:

## Errors

- no Start node,
- invalid references,
- negative duration parameters,
- activity with no outcome,
- outcome probability outside \([0,1]\),
- outcome probabilities not summing to 1,
- missing item definitions,
- impossible activity requirements where statically provable.

## Warnings

- unreachable node,
- unreachable terminal outcome,
- possible deadlock,
- possible infinite cycle,
- item produced but never used,
- item required but apparently never produced,
- integration waiting on a low-probability branch,
- simulation safety cutoff may be required.

The application must not silently normalize probabilities.

---

# 20. Monte Carlo First

Because the model contains:

- parallel activities,
- synchronization,
- resource accumulation,
- and potentially cycles,

Monte Carlo simulation will be the primary Version 0.1 analysis method.

Exact mathematical solvers may later be implemented for restricted classes of models.

The product should never imply that Monte Carlo estimates are exact values.

---

# 21. Data Architecture

The canonical model must remain independent of the UI.

Conceptually:

```json
{
  "schema_version": "0.1",
  "project": {},
  "item_types": [],
  "nodes": [],
  "activities": [],
  "settings": {}
}
```

Activities should be stored separately from graphical React Flow edges.

This makes it possible to change how activities are drawn without changing their mathematical meaning.

---

# 22. Deployment

GERT Studio must be a standalone self-hosted application.

Primary target:

```text
Docker
```

Eventually:

```bash
docker run -p 8080:8080 gert-studio
```

should start the complete application.

The runtime application must not require:

- Antigravity,
- ChatGPT,
- a cloud AI provider.

AI-assisted modeling may be added later as an optional feature.

---

# 23. Initial Technology Stack

## Frontend

- React
- TypeScript
- React Flow

## Backend / Engine

- Python
- FastAPI
- Pydantic
- NumPy
- SciPy

## Simulation

Custom event-driven discrete-event simulation engine.

NetworkX may be used for:

- reachability,
- graph validation,
- cycle analysis,
- structural inspection.

## Storage

Initially:

- JSON
- optionally SQLite for project management.

## Testing

- pytest
- frontend unit tests
- Playwright

## Deployment

- Docker
- Docker Compose during development.

---

# 24. Product Principles

### 24.1 Activities belong to the workflow, not the UI

The graphical representation must never define mathematical semantics.

### 24.2 Nodes accumulate project items

Nodes are meaningful project states and synchronization points.

### 24.3 Activities transform project state

Activities consume required items and produce new items.

### 24.4 Parallel execution is fundamental

The system must never assume only one activity is active.

### 24.5 Alternative probabilities always sum to 1

Within each activity outcome set:

\[
\sum p_i=1.
\]

### 24.6 Never silently correct probabilities

Incorrect probabilities are model errors.

### 24.7 Monte Carlo results are distributions

Do not reduce uncertainty to a single average.

### 24.8 Reproducibility matters

Random seeds must be supported.

### 24.9 Cycles must remain structurally possible

Even if some advanced cycle features are deferred.

### 24.10 Mathematical correctness has priority over visual polish

---

# 25. Definition of Successful Version 0.1

Version 0.1 is successful if a user can model:

```text
START
  │
  ├────────► Mechanical Design ─────┐
  │                                 │
  ├────────► Electronics Design ────┼──► INTEGRATION
  │                                 │
  └────────► Software Development ──┘
                                         │
                                         ▼
                                       TEST
                                      /    \
                                   PASS    FAIL
                                   80%      20%
                                    │        │
                                    ▼        ▼
                                 SUCCESS   REWORK
```

where:

- the three development activities execute in parallel,
- the Integration activity waits until all required outputs exist,
- activity durations are stochastic,
- Test has probabilistic outcomes that sum to 1,
- Monte Carlo calculates the completion-time distribution,
- output probabilities are calculated,
- the project model can be saved and loaded.

Basic rework-cycle simulation is desirable and should be supported if practical.

Cost modeling is explicitly not required for Version 0.1.

That constitutes the minimum useful GERT Studio product.