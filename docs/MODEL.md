# GERT Studio — Mathematical Model Specification

## 1. Purpose

This document defines the mathematical semantics of the GERT Studio simulation engine.

It is authoritative for:

- model representation,
- activity execution,
- item/resource flow,
- quantities,
- parallelism,
- synchronization,
- stochastic outcomes,
- simulation,
- validation.

The frontend must represent this model rather than inventing separate execution semantics.

---

# 2. Core Model

Version 0.1 is a **stochastic quantified resource-flow network with concurrent activities**.

A project consists of:

\[
M=(V,A,R)
\]

where:

- \(V\) is the set of nodes,
- \(A\) is the set of activities,
- \(R\) is the set of defined item/resource types.

The simulation does not occupy one current node.

At time \(t\), project state is:

\[
S(t)=\left(I(t),X(t),Q(t)\right)
\]

where:

- \(I(t)\) is the inventory of named items and quantities at every node,
- \(X(t)\) is the set of activity instances currently running,
- \(Q(t)\) is the future-event queue.

This allows multiple activities to execute simultaneously.

---

# 3. Nodes

A node represents:

- a project state,
- an item/resource buffer,
- a synchronization point,
- an assembly/integration point,
- or a terminal project outcome.

Each node contains:

```text
id
name
type
```

Version 0.1 node types are:

```text
start
state
terminal
```

A state node may simultaneously contain multiple item types and quantities.

Example:

```text
NODE: Integration Ready

Inventory:
Mechanical Module       1 unit
Electronics Module      1 unit
Fasteners              24 units
Coolant                 8.5 liters
Cable                   12 meters
```

---

# 4. Start Node

Exactly one Start node exists.

The Start node contains the initial project inventory at:

\[
t=0.
\]

Example:

```text
START

Steel                    500 kg
Electronic Components     20 units
Development Request        1 unit
Software Specification     1 unit
```

Initial inventory may contain any number of item types.

These items may enable multiple activities simultaneously.

Incoming activity outcomes into Start are prohibited in Version 0.1.

---

# 5. State Nodes

A State node may accumulate several item types from different incoming activities and at different times.

Example:

```text
Node: System Integration

Current inventory:

Mechanical Assembly       1 unit
Electronics Assembly      1 unit
Software Build            1 unit
Fasteners                 38 units
```

An activity associated with this node may require any combination of these items and quantities.

---

# 6. Terminal Nodes

A Terminal node represents a completed project outcome.

It contains:

```text
outcome_code
outcome_name
outcome_category
```

Recommended categories:

```text
success
failure
neutral
custom
```

Example:

```json
{
  "id": "approved",
  "type": "terminal",
  "name": "System Accepted",
  "outcome_code": "accepted",
  "outcome_category": "success"
}
```

When a simulation reaches a Terminal node, that realization ends.

Activities still running are cancelled for that realization.

---

# 7. Item Types

An item type represents something that exists within the project and may be:

- present at a node,
- required by an activity,
- consumed by an activity,
- produced by an activity,
- accumulated with quantities of the same type.

Examples include:

```text
Steel
Aluminum
Fuel
Mechanical Module
Prototype
Test Samples
Approved Drawing
Software Build
Completed Subassembly
Cable
Documentation Package
```

Every item type has a stable machine identifier and a human-readable name.

Conceptually:

```json
{
  "id": "aluminum_plate",
  "name": "Aluminum Plate",
  "unit": "kg"
}
```

The `id` is used internally.

The `name` is displayed to the user.

---

# 8. Item Definition

Version 0.1 item definitions should contain:

```text
id
name
unit
quantity_type
description        optional
```

Example:

```json
{
  "id": "fastener_m8",
  "name": "M8 Fastener",
  "unit": "units",
  "quantity_type": "integer"
}
```

Another example:

```json
{
  "id": "aluminum",
  "name": "Aluminum",
  "unit": "kg",
  "quantity_type": "continuous"
}
```

---

# 9. Item Names

Names are human-readable labels.

Examples:

```text
Mechanical Assembly
Fuel
Engineering Drawing
Prototype
Approved Design
Test Sample
```

Names need not be unique.

Internal item IDs must be unique.

For example:

```text
ID:   battery_pack_v2
Name: Battery Pack
```

This allows item names to be changed without breaking saved project references.

---

# 10. Item Units

Every quantified item may have an optional unit.

Examples:

```text
kg
g
liter
meter
m²
units
sets
documents
samples
```

Version 0.1 does not automatically convert units.

Therefore:

```text
10 kg
```

and:

```text
10000 g
```

are not automatically recognized as equivalent.

Activities using a particular item type operate using that item's defined unit.

Automatic unit conversion may be introduced later.

---

# 11. Quantity Types

Version 0.1 supports two quantity modes.

## Integer quantities

For countable objects:

```text
Motors              3 units
Documents           5 units
Prototype           1 unit
Test Samples       12 units
```

Mathematically:

\[
q\in\mathbb{Z}_{\ge0}.
\]

## Continuous quantities

For divisible materials:

```text
Steel             52.4 kg
Fuel              18.7 liters
Cable             31.2 meters
```

Mathematically:

\[
q\in\mathbb{R}_{\ge0}.
\]

The item definition determines which quantity type applies.

---

# 12. Inventory

For node \(v\), item type \(r\), and time \(t\), define:

\[
I_v(r,t)\ge0
\]

as the available quantity of item \(r\) at node \(v\).

Example:

\[
I_{\text{integration}}(\text{fasteners},t)=32.
\]

A node can simultaneously contain:

\[
I_v(r_1,t), I_v(r_2,t), \ldots, I_v(r_n,t).
\]

---

# 13. Quantity Aggregation

Quantities of the same item type arriving at the same node are additive.

If:

\[
I_v(r,t^-)=30
\]

and an activity produces:

\[
20
\]

additional units, then:

\[
I_v(r,t)=50.
\]

Example:

```text
Existing steel:        30 kg
New steel delivered:   20 kg

Inventory after event: 50 kg
```

---

# 14. Fungibility Assumption

Version 0.1 treats quantities belonging to the same item type as **fungible**.

For example:

```text
Bolt = 10 units
```

means ten interchangeable units of the defined Bolt item.

The engine does not distinguish:

```text
Bolt #1
Bolt #2
Bolt #3
```

as separate objects.

Likewise:

```text
Aluminum = 50 kg
```

is represented as one quantity.

Explicit serial-numbered or individually tracked objects may be introduced in a later model version.

---

# 15. Activities

Activities are the primary executable elements.

An activity \(a\) contains:

```text
id
name
source_node
requirements
duration
outcomes
```

Activities live conceptually on edges.

They transform items available at one project state into items available at later project states.

Example:

```text
ASSEMBLY READY
      │
      │ Assemble Pump
      │
      ▼
PUMP COMPLETE
```

---

# 16. Activity Input Requirements

Each activity defines the quantities of each item required.

Let:

\[
R_a(r)\ge0
\]

be the required quantity of resource \(r\).

Example:

```text
Activity: Assemble Pump

Requires:

Pump Housing          1 unit
Impeller              1 unit
Bearing               2 units
Fasteners            12 units
Lubricant            0.25 liters
```

The activity is enabled only if all requirements are satisfied.

Mathematically:

\[
I_{source(a)}(r,t)\ge R_a(r)
\]

for every required item \(r\).

---

# 17. Integration Through Quantities

Integration is modeled directly through multiple simultaneous requirements.

Example:

```text
Activity: Final System Integration

Requires:

Mechanical Assembly       1 unit
Electronic Assembly       1 unit
Control Software          1 unit
Cable                     8 meters
Fasteners                 16 units
```

The activity remains disabled until every requirement is available.

Thus:

\[
I_v(\text{Mechanical Assembly})\ge1,
\]

\[
I_v(\text{Electronic Assembly})\ge1,
\]

\[
I_v(\text{Control Software})\ge1,
\]

\[
I_v(\text{Cable})\ge8,
\]

and:

\[
I_v(\text{Fasteners})\ge16.
\]

This provides AND-type synchronization naturally.

---

# 18. Input Consumption

Version 0.1 uses consumable-flow semantics.

When activity \(a\) starts:

\[
I_{source(a)}(r,t)
\leftarrow
I_{source(a)}(r,t)-R_a(r).
\]

Example:

Before:

```text
Steel = 100 kg
```

Activity requires:

```text
Steel = 30 kg
```

After activity begins:

```text
Steel = 70 kg
```

Consumption occurs when the activity starts rather than when it finishes.

This ensures another activity cannot simultaneously consume the same quantity.

---

# 19. Quantity Numerical Tolerance

Continuous quantities introduce floating-point numerical issues.

The engine must therefore use a quantity-comparison tolerance.

For example, an activity requiring:

\[
10
\]

kg should not fail because internal arithmetic produced:

\[
9.999999999999998.
\]

A configurable numerical tolerance should be used.

This tolerance must not be used to silently create materially missing resources.

---

# 20. Parallel Activities

Multiple activities execute simultaneously whenever their requirements can be satisfied without double-consuming available quantities.

Example:

```text
START inventory:

mechanical_request    1
electronics_request   1
software_request      1
```

Activities:

```text
Mechanical Design
Electronics Design
Software Development
```

All three may start at:

\[
t=0.
\]

Their durations are sampled independently.

---

# 21. Shared Inventory and Competition

Suppose:

```text
Steel available = 100 kg
```

Activity A requires:

```text
Steel = 60 kg
```

and Activity B requires:

```text
Steel = 60 kg.
```

Individually, both appear enabled.

Together they require:

\[
120>100.
\]

Therefore they cannot both start.

Version 0.1 must never resolve this accidentally according to internal iteration order.

Such conflicts require an explicit selection rule.

Initially, unresolved resource competition may be classified as an ambiguous model configuration.

Future versions may provide:

- priority,
- user decisions,
- stochastic selection,
- optimization,
- resource-allocation policies.

---

# 22. Activity Duration

Each activity has a nonnegative random duration:

\[
D_a\ge0.
\]

When an activity instance starts at time \(t_s\), sample:

\[
d\sim D_a.
\]

Its finish time is:

\[
t_f=t_s+d.
\]

Each activity execution receives a fresh duration sample.

---

# 23. Duration Distributions

Version 0.1 supports:

### Fixed

\[
D=c,\qquad c\ge0.
\]

### Uniform

\[
D\sim U(a,b),
\qquad 0\le a\le b.
\]

### Triangular

\[
D\sim Triangular(a,m,b),
\qquad0\le a\le m\le b.
\]

### Beta-PERT

Parameters:

\[
a=\text{minimum},
\]

\[
m=\text{most likely},
\]

\[
b=\text{maximum}.
\]

With default:

\[
\lambda=4.
\]

Define:

\[
\alpha=
1+\lambda\frac{m-a}{b-a},
\]

\[
\beta=
1+\lambda\frac{b-m}{b-a}.
\]

Sample:

\[
Y\sim Beta(\alpha,\beta)
\]

and transform:

\[
D=a+(b-a)Y.
\]

When \(a=b\), the duration is deterministic.

---

# 24. Activity Outcomes

An activity contains one or more possible outcomes:

\[
O_a=\{o_1,\ldots,o_n\}.
\]

Each outcome contains:

```text
id
name
probability
target_node
produced_items
```

An outcome may produce multiple named items with different quantities.

Example:

```text
Activity: Manufacture Assembly

Outcome: SUCCESS
Probability: 0.90

Produces:
Assembly             1 unit
Scrap Metal          2.4 kg
Inspection Report    1 unit
```

---

# 25. Probabilistic Failure Example

Activity:

```text
Prototype Test
```

requires:

```text
Prototype          1 unit
Test Sample        3 units
```

Possible outcomes:

```text
PASS
p = 0.80

Produces:
Validated Prototype    1 unit
Test Report            1 unit
```

or:

```text
FAIL
p = 0.20

Produces:
Failed Prototype       1 unit
Failure Report         1 unit
```

The probabilities satisfy:

\[
0.80+0.20=1.
\]

---

# 26. Outcome Probability Rule

For every activity:

\[
0\le p(o)\le1
\]

and:

\[
\sum_{o\in O_a}p(o)=1.
\]

Floating-point numerical tolerance is allowed.

Probabilities must not be silently normalized.

For example:

```text
PASS = 0.7
FAIL = 0.2
```

is invalid.

---

# 27. Deterministic Activities

A deterministic activity has exactly one outcome with:

\[
p=1.
\]

This is expected to be common.

Example:

```text
Machine Component

100% → Machined Component
```

---

# 28. Probability and Parallelism

Probabilities describe **alternative outcomes of one activity**.

They do not describe whether otherwise independent parallel activities execute.

For example:

```text
START
 ├── Mechanical Design
 ├── Electronics Design
 └── Software Development
```

all three may execute concurrently.

There is no requirement that their execution probabilities sum to 1.

If `Mechanical Design` itself has outcomes:

```text
SUCCESS = 0.9
FAILURE = 0.1
```

then:

\[
0.9+0.1=1.
\]

---

# 29. Probabilistic Routing

Alternative procedures may initially be represented using a routing activity.

Example:

```text
Select Supplier
Duration = 0

Supplier A    p = 0.60
Supplier B    p = 0.30
Supplier C    p = 0.10
```

with:

\[
0.60+0.30+0.10=1.
\]

A dedicated graphical Chance Gateway may be introduced later.

---

# 30. Activity Completion

When activity \(a\) completes:

1. exactly one outcome is sampled;
2. that outcome's probability determines selection;
3. all quantities produced by that outcome are deposited at its target node;
4. the activity instance becomes complete;
5. all newly enabled activities are reevaluated.

---

# 31. Outcome Production

Let:

\[
q_o(r)\ge0
\]

be the quantity of item \(r\) produced by outcome \(o\).

Then:

\[
I_{target(o)}(r,t)
\leftarrow
I_{target(o)}(r,t)+q_o(r).
\]

Example:

```text
Produces:

Finished Assembly     3 units
Waste                  4.7 kg
Documentation          1 unit
```

Each produced quantity must conform to the item's quantity type.

---

# 32. Production Yield

Quantity-based outputs make production yield naturally representable.

For example:

```text
Activity: Produce Components

Input:
Raw Material = 100 kg

Outcome GOOD YIELD
p = 0.85
Produces:
Component = 95 units

Outcome LOW YIELD
p = 0.15
Produces:
Component = 70 units
```

This provides a simple Version 0.1 method for modeling uncertain yield.

A future version may allow the produced quantity itself to be a random variable.

---

# 33. Synchronization

Synchronization occurs through item requirements.

For example:

```text
Mechanical Module ─────┐
                       │
Electronics Module ─────┼──► Integration Activity
                       │
Software Build ─────────┘
```

Integration begins only when the required quantities of all three are present.

No separate AND-join object is mathematically necessary.

---

# 34. Event-Driven Simulation

Version 0.1 uses discrete-event simulation.

The engine maintains a priority queue of future activity-completion events.

Simulation time jumps directly between events.

Example:

```text
t=0
Mechanical starts
Electronics starts
Software starts

t=4.1
Mechanical finishes
Mechanical Module += 1

t=5.8
Software finishes
Software Build += 1

t=7.3
Electronics finishes
Electronics Module += 1

Integration requirements now satisfied.
Integration starts at t=7.3.
```

---

# 35. Simultaneous Events

All activity completions with the same simulation timestamp are processed as one batch.

Their produced quantities are deposited before new activities are enabled.

This ensures behavior is not determined by arbitrary queue ordering.

---

# 36. Starting Enabled Activities

After every event batch:

1. inventories are updated,
2. activity requirements are evaluated,
3. mutually compatible enabled activities may start,
4. their input quantities are consumed/reserved,
5. duration samples are drawn,
6. completion events are scheduled.

The same physical quantity must never be allocated to two simultaneous activity instances.

---

# 37. Activity Definition and Activity Instance

An activity definition is part of the model.

An activity instance is one execution of that definition.

Example:

```text
Prototype Test
    execution #1

Prototype Test
    execution #2

Prototype Test
    execution #3
```

Each instance records:

```text
instance_id
activity_id
start_time
finish_time
sampled_duration
consumed_items
selected_outcome
produced_items
status
```

This distinction is essential for cycles and repeated batch production.

---

# 38. Multiple Activity Instances

An activity may potentially execute multiple times when sufficient new inputs are available.

For example:

```text
Raw Material = 300 kg
```

If:

```text
Manufacturing Activity
requires 100 kg
```

the model may support three executions.

Whether multiple instances of the **same activity definition** may run concurrently must be explicitly configured.

Recommended Version 0.1 field:

```text
max_concurrent_instances
```

Default:

```text
1
```

This prevents accidental unlimited parallel execution.

---

# 39. Cycles

Cycles are allowed by the canonical model.

Example:

```text
TEST
 │
 ├── PASS ─────► SUCCESS
 │
 └── FAIL ─────► REWORK
                    │
                    ▼
                TEST READY
                    │
                    └────► TEST
```

Fresh items generated by Rework can enable a new Test activity instance.

Monte Carlo simulation should support this.

Exact analytical cycle analysis is not required in Version 0.1.

---

# 40. Simulation Safety Limits

Because quantities and cycles can potentially create unlimited execution, the simulation engine must support:

```text
max_activity_completions
max_activity_instances
max_simulation_time
max_inventory_quantity
```

Possible run statuses include:

```text
terminal
deadlock
cutoff_activity_count
cutoff_time
cutoff_inventory
invalid_runtime_state
ambiguous_terminal
```

---

# 41. Deadlock

A deadlock occurs when:

- no Terminal node has been reached,
- no activity is running,
- no activity is enabled.

For example:

```text
Integration requires:

Module A = 1
Module B = 1

Module A available = 1
Module B available = 0

No remaining activity can produce Module B.
```

This is a deadlock.

It must be reported separately from a modeled failure outcome.

---

# 42. Project Termination

A realization terminates when an activity outcome targets a Terminal node.

At that time:

\[
T_{\text{project}}=t.
\]

Remaining running activities are cancelled.

The terminal node determines the project outcome.

---

# 43. Monte Carlo Simulation

For \(N\) realizations:

\[
R=\{r_1,\ldots,r_N\},
\]

each realization starts with the same model-defined initial inventory.

Random variables include:

- activity duration,
- activity outcome.

Future versions may also support:

- stochastic production quantity,
- stochastic consumption quantity,
- stochastic initial inventory.

---

# 44. Reproducibility

Every simulation accepts a random seed.

Given the same:

- model,
- engine version,
- settings,
- seed,

the result should be reproducible to the degree supported by the numerical libraries.

The seed must be included with saved simulation results.

---

# 45. Completion-Time Statistics

At minimum:

\[
E[T],
\]

median,

\[
P50,
\]

\[
P80,
\]

\[
P90,
\]

\[
P95.
\]

These should eventually also be calculated conditional on terminal outcome.

---

# 46. Outcome Statistics

For terminal outcome \(k\):

\[
\hat P_k=
\frac{\text{runs terminating at }k}{N}.
\]

The report must separately include probabilities of:

- modeled terminal outcomes,
- deadlock,
- safety cutoff,
- ambiguous runtime conditions.

---

# 47. Activity Statistics

For activity \(a\), calculate:

- probability executed at least once,
- expected number of executions,
- probability of repeated execution,
- mean first start time,
- mean first finish time,
- start-time quantiles,
- finish-time quantiles.

---

# 48. Inventory and Item Statistics

Quantity-based modeling enables additional useful metrics.

For each node/item pair, the engine may calculate:

- probability item ever arrives,
- first-arrival time,
- maximum inventory observed,
- quantity at project termination,
- expected quantity at selected milestones.

For example:

```text
Integration Node
Mechanical Modules

P(arrives)          96.8%
Mean first arrival   5.4 days
Mean final quantity  1.13
```

---

# 49. Costs

Cost is explicitly optional and not required for Version 0.1.

The architecture should allow a future activity-instance cost variable:

\[
C_a.
\]

Costs must not complicate the first implementation of quantified resource flow.

---

# 50. Capacity Resources

Version 0.1 item quantities describe **flow resources**, not capacity resources.

For example:

```text
Steel = 100 kg
Motor = 3 units
Prototype = 1 unit
```

are Version 0.1 items.

By contrast:

```text
Engineers = 5
CNC machines = 2
Laboratory capacity = 1
```

represent reusable capacity resources and are deferred.

Capacity resources will eventually be reserved during activity execution and returned afterward.

---

# 51. Exact Analysis

Because Version 0.1 supports:

- parallel execution,
- synchronization,
- quantified inventories,
- stochastic durations,
- probabilistic outcomes,
- and potentially cycles,

the general model is not reducible to a simple Markov chain over visible graph nodes.

The full state is:

\[
S(t)=
(\text{inventories},
\text{running activities},
\text{event queue}).
\]

Monte Carlo simulation is therefore the primary Version 0.1 solution method.

Exact analytical solvers may later support restricted subclasses.

---

# 52. Relationship to Petri Nets

The model has similarities to stochastic Petri nets and stochastic activity networks:

- nodes hold quantities/tokens,
- activities consume inputs,
- activities produce outputs,
- activities can execute concurrently,
- multiple outputs can synchronize later.

GERT Studio should not require users to understand Petri-net terminology.

These concepts are primarily useful for designing a mathematically robust engine.

---

# 53. Validation

A model is structurally valid only if:

1. node IDs are unique;
2. activity IDs are unique;
3. item IDs are unique;
4. exactly one Start node exists;
5. initial quantities are valid;
6. all referenced item types exist;
7. source and target nodes exist;
8. every activity has at least one outcome;
9. every outcome probability is in \([0,1]\);
10. each activity's outcome probabilities sum to 1 within tolerance;
11. all duration distributions are valid;
12. all required quantities are nonnegative;
13. all produced quantities are nonnegative;
14. integer items use integer quantities;
15. continuous items use valid finite numeric quantities;
16. terminal nodes have no outgoing activities;
17. incoming outcomes into Start are prohibited.

---

# 54. Validation Warnings

The engine should attempt to detect:

- unreachable nodes,
- unreachable terminal outcomes,
- undefined items,
- items that can apparently never be produced,
- items produced but never consumed,
- activities that can apparently never execute,
- competing consumption,
- possible deadlocks,
- cycles,
- possible unlimited item generation,
- possible unlimited activity execution,
- ambiguous terminal behavior.

Warnings may be conservative.

---

# 55. Canonical Item JSON

Example countable item:

```json
{
  "id": "motor",
  "name": "Electric Motor",
  "unit": "units",
  "quantity_type": "integer"
}
```

Example continuous item:

```json
{
  "id": "steel",
  "name": "Structural Steel",
  "unit": "kg",
  "quantity_type": "continuous"
}
```

---

# 56. Canonical Start Inventory

```json
{
  "initial_inventory": {
    "steel": 500.0,
    "motor": 3,
    "development_request": 1
  }
}
```

---

# 57. Canonical Activity Example

```json
{
  "id": "build_frame",
  "name": "Build Frame",
  "source_node": "fabrication_ready",

  "requirements": {
    "steel": 80.0,
    "fastener": 24
  },

  "duration": {
    "type": "triangular",
    "min": 2,
    "mode": 4,
    "max": 7
  },

  "max_concurrent_instances": 1,

  "outcomes": [
    {
      "id": "complete",
      "name": "Complete",
      "probability": 1.0,
      "target_node": "assembly",
      "produced_items": {
        "frame": 1
      }
    }
  ]
}
```

---

# 58. Version 0.1 Acceptance Test — Quantities

Initial inventory:

```text
Steel = 100 kg
Fasteners = 20 units
```

Activity A requires:

```text
Steel = 30 kg
Fasteners = 4 units
```

After Activity A starts, inventory must equal:

```text
Steel = 70 kg
Fasteners = 16 units
```

If Activity A produces:

```text
Assembly = 2 units
Scrap = 3.5 kg
```

those quantities must appear exactly at its target node when the activity finishes.

---

# 59. Version 0.1 Acceptance Test — Aggregation

Two parallel activities both produce material at the same node.

Activity A produces:

```text
Material X = 25 kg
```

Activity B produces:

```text
Material X = 40 kg
```

After both complete:

\[
I(Material X)=65\text{ kg}.
\]

---

# 60. Version 0.1 Acceptance Test — Quantity Synchronization

Integration requires:

```text
Component A = 2 units
Component B = 3 units
Material C = 10 kg
```

Inventory initially contains:

```text
Component A = 2
Component B = 2
Material C = 15 kg
```

Integration must remain disabled.

When one additional Component B arrives:

```text
Component B = 3
```

Integration becomes enabled.

---

# 61. Fundamental Version 0.1 Principles

\[
\boxed{\text{Activities execute; nodes hold named items and quantities.}}
\]

\[
\boxed{\text{Item quantities may be integer or continuous.}}
\]

\[
\boxed{\text{Same-type quantities at a node are additive and fungible.}}
\]

\[
\boxed{\text{Several activities may execute simultaneously.}}
\]

\[
\boxed{\text{Activities start only when all required quantities exist.}}
\]

\[
\boxed{\text{Consumed quantities are removed when an activity starts.}}
\]

\[
\boxed{\text{Activity outcomes produce named items and quantities.}}
\]

\[
\boxed{\sum_{\text{outcomes of activity}}p_i=1.}
\]

\[
\boxed{\text{Monte Carlo is the general Version 0.1 solver.}}
\]

\[
\boxed{\text{The architecture supports cycles and repeated activity instances.}}
\]

These semantics must not be changed implicitly by the frontend or implementation.