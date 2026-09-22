# GERT Studio backend architecture

This implementation conforms to the approved PRODUCT.md and MODEL.md checkpoint a4d0d85.
Those specifications remain unchanged. The engine has no FastAPI dependency.

## Components

- app/schemas/model.py: Pydantic 2 contracts, discriminated nodes/durations, exact numeric ingestion.
- app/validation/: structured errors and conservative graph/item warnings.
- app/engine/numbers.py: exact terminating-decimal serialization and aggregate ratio formatting.
- app/engine/randomness.py: independently keyed random streams and distribution sampling.
- app/engine/beta.py: versioned gamma-ratio Beta sampler for PERT shapes.
- app/engine/binary64.py: platform-independent, correctly rounded log/exp/sqrt primitives.
- app/engine/simulation.py: one realization, inventories, lifecycle records and event queue.
- app/engine/service.py: validation, seed generation and ordered Monte Carlo orchestration.
- app/reporting/: status/outcome counts, conditional duration statistics, lifecycle aggregation.
- app/api/routes.py: lossless JSON parsing and thin HTTP adapters.
- app/api/openapi.py: request and validation-response schemas for the lossless adapters.
- tests/: specification-derived unit, statistical, engine, reproducibility and API tests.

## Canonical model and transport

schema_version is "0.1". Project, item_types, nodes and activities are explicit.
Node types are start/state/terminal. Only Start has initial_inventory; all other
inventories start empty. Terminal metadata is required. Requirements, produced_items,
and outcome lists are explicit. Outcome identity is activity-local; no global outcome
ID restriction is imposed. Numeric distribution parameters have no defaults.
The beta-PERT discriminator is "beta-PERT"; lambda is the required external shape
parameter name on both input and default serialization. The internal Python attribute
shape is not accepted as an alternative input field.

SimulationRequest has model and settings. Settings require realizations and all three
safety limits; seed is optional and generated/returned when absent. A worker count is
an orchestration argument, not a mathematical model parameter. UI metadata is optional
and ignored by simulation. Unknown contract fields are rejected, not silently dropped.

The API parses raw JSON with decimal.Decimal for numeric decimal tokens before
Pydantic validation. Duplicate JSON keys and nonfinite constants are rejected.
Python callers supply Decimal, decimal strings or integers; binary float input is
rejected to prevent irreversible loss of the original decimal value. Decimal fields
serialize as JSON strings, including parameters and quantities, enabling exact
round trips even through JavaScript clients.

## Exact quantities and canonical time

Pydantic holds finite Decimal values without doing inventory arithmetic. The engine
converts them to fractions.Fraction. Finite decimal inputs have denominators containing
only factors 2 and 5. Exact addition, subtraction, multiplication and comparison on
these rationals preserve decimal semantics without Decimal context rounding.
Multiplicity uses exact rational integer floor division. There is no epsilon,
clamping, inventory rounding, or concurrency cap.

Canonical times and sampled durations use the same rational representation. In
particular, a fixed 0.1 then 0.2 equals fixed 0.3 exactly. All time comparisons,
including horizon checks and heap batch equality, are exact. Output uses a direct
integer-based terminating-decimal formatter, not a bounded-precision division.

## Reproducibility and distributions

Engine version: 0.1.1.
Reproducibility version: gert-v2-py312-sha256-mt19937-crmath1.

For each draw purpose, UTF-8-compatible ASCII JSON encoding (ensure_ascii=True,
compact separators) of this typed list is hashed with SHA-256:

[reproducibility_version, str(root_seed), realization_index, activity_id,
 activity_instance_ordinal, purpose]

The digest interpreted as an unsigned big-endian integer seeds an independent
Python 3.12 random.Random (MT19937). The purposes are "duration" and "outcome".
Ordinals begin at zero and increase monotonically per realization/activity.
Python hash() is never used. Realization count, worker count, labels and UI metadata
do not enter the key. IDs are ordered by Python string code-point ordering without
Unicode normalization. Changing a mathematical ID may change draws.

- Fixed and all valid equal-endpoint distributions return the exact input duration.
- Uniform: exact rational scaling of the dyadic value returned by random().
- Triangular: inverse CDF on normalized [0,1], controlled binary64 sqrt, then Decimal(repr(value))
  converted to Fraction and scaled by the exact input range.
- Beta-PERT: alpha/beta are calculated from exact input fractions, converted to
  binary64 for GERT's gamma-ratio sampler. It preserves Python 3.12's Cheng gamma
  rejection equations, operation order, proposal bounds and shape-one exponential
  case, replacing native log/exp/sqrt with the controlled binary64 primitives.
  The normalized sample is deterministically converted via Decimal(repr(value))
  before exact range scaling and scheduling.
- Outcomes: canonical outcome-ID order, exact cumulative declared intervals,
  final residual closing to one after validation. No normalization or mutation.

The controlled primitives convert each binary64 argument exactly to Decimal.
A fresh, explicit ROUND_HALF_EVEN context starts at 40 significant digits and
evaluates correctly rounded ln, exp or sqrt. An exact answer converts directly.
Otherwise its adjacent decimal numbers enclose the real answer. The primitive
returns a binary64 value only if both bounds convert to that same value; if not,
it doubles working precision and repeats. This establishes nearest-even binary64
rounding without relying on native libm or a fixed guard-digit assumption. Caller
Decimal contexts, flags and traps do not enter the calculation. No output rounding,
timestamp coalescing or formatting change is involved.

The supported numerical contract is CPython 3.12 on IEEE-754 binary64 Windows x64
and Linux x86-64, with nearest-even basic float arithmetic/conversion and conforming
Decimal correctly rounded ln/exp/sqrt. The primitives use only the finite domains
needed by the samplers. Their context explicitly sets precision, rounding, exponent
bounds (-999999 to 999999), flags, traps, capitals and clamp. These are numerical
algorithm settings, not model parameters or hidden distribution defaults.

These algorithms and conversions are part of the reproducibility version. V1 used
native math and experimentally differed between Windows and Linux. V2 cannot
preserve both conflicting results. Because the version already occupies the first
RNG key field, this version bump changes all stochastic streams (including outcome,
uniform and triangular streams), not just Beta-PERT. Key structure, root seed and
stream independence are unchanged. Responses identify the new versions. The API
does not select legacy engines; historical v1 replay requires the original engine
and environment. Do not relabel old results as v2. Future Python/runtime changes
require compatibility verification against the exact reference vectors and complete
cross-platform corpus; changed numerical behavior needs a new version.

Very large finite beta shape inputs can exceed the numerical sampler's range; this is reported as
invalid_runtime_state rather than silently changing parameters. The guard also checks
the gamma algorithm's intermediate 2 * shape for finite binary64 representation before
entering its rejection loop, where overflow would otherwise prevent termination.
Mathematically valid inputs remain schema-valid; this is a numerical runtime limitation.
No numeric default
is inserted. There is no claim of infinite numerical precision in stochastic draws.

One or multiple orchestration threads execute independently keyed realizations.
Results are collected in realization-index order and exact rational aggregates
are calculated afterward. Parallelism therefore cannot reorder reduction arithmetic.
Increasing N preserves the earlier realization prefix. Threads establish the
correctness contract; CPU speedup is not promised.

## Validation

Errors identify a field path and, for semantic checks, an element ID. Invalid schema
diagnostics retain Pydantic locations and omit potentially nonserializable error context.
The validator checks ID scopes, Start/Terminal connections, declared references,
positive requirements, distributions, probability tolerance and final interval legality.
It does not repair values.

NetworkX is used only for conservative static reachability/SCC warnings, never as a
simulation scheduler. Warnings include unreachable nodes, absent local item supply,
unused local items, potential competition, cycles/unbounded generation, possible
deadlocks, and multiple reachable terminals. They do not establish exact stochastic
reachability or prove conflict/nontermination. Cycles are accepted.
Graph edges and item-producer warnings use the validated effective final sampling
interval, including an accepted residual on a declared-zero final outcome. Start
requirements exceeding its nonreplenishable initial inventory produce an
impossible-enablement warning, not a validation error.

## Event loop and lifecycle

Each global evaluation calculates all definitions' maximum multiplicities from the
same inventory snapshot, then checks aggregate node-local demand. Any conflict ends
the realization as ambiguous_resource_competition without allocation. Only afterward
is the complete launch group checked against the cumulative instance budget.

Numerical duration preparation precedes committing a launch set, so sampler failure
does not leave partially consumed inputs. Admitted instances consume their inputs,
receive ordinals, and enter a heap keyed by (exact finish time, activity ID, ordinal).
Canonical ordering assigns identity and draws only; it never chooses a competition winner.

Before a completion batch: check its timestamp against the inclusive horizon, then
check the complete batch size against the completion budget. Blocked batches have
no outcome draws or production. Permitted outcomes are prepared, then all batch
production and completions are applied before terminal classification and new starts.
Zero-duration launches form successive batches at the same time.

One distinct terminal ends the realization and cancels running instances. Multiple
distinct terminals produce ambiguous_terminal. Cutoff, ambiguity and numerical invalid
runtime endings leave running instances unfinished with a reason. No retrospective
outcomes are assigned. At end, started = completed + cancelled + unfinished_at_run_end.

A numerical sample failure returns invalid_runtime_state with an explanatory message.
Unexpected programming exceptions are not broadly swallowed. last_processed_time is
the last committed engine timestamp, not a synthetic terminal duration or time-horizon
estimate. Terminal duration statistics use only terminal realizations.

## Reporting

Every required status and terminal node appears, including zero counts, with N as
denominator. Terminal statistics include sample size, conditioning, mean, median/P50,
P80/P90/P95, min and max; unavailable values are null. Quantiles use linear interpolation
at (n-1)p (type 7). Means and probabilities that have recurring decimal expansions
are formatted at 34 significant decimal digits using a fresh ROUND_HALF_EVEN context
independent of the caller's Decimal context; engine state
and exact ordering are never rounded by reporting. Quantiles/min/max retain exact
terminating-decimal output.

Per-activity totals and per-realization counters distinguish starts, completions,
cancellations, unfinished work and its reasons. Frequency metrics use starts. Truncated
observations are labeled. Responses currently retain every instance and final inventory;
large requests can use substantial memory. Streaming and compact result modes are
future engineering work, not implemented performance promises.

## HTTP and verification

GET /api/health is preserved. POST /api/models/validate accepts the model directly;
valid schemas return HTTP 200 with valid and diagnostics, including semantic errors.
Malformed JSON/schema receives HTTP 422. POST /api/simulate accepts model/settings,
returns HTTP 422 for invalid models, and otherwise returns versioned results.
Simulation runs off the async event loop in a threadpool.
OpenAPI exposes the same Pydantic input contracts, required fields, and structured
validation/error responses while keeping lossless JSON parsing in the adapters.
The successful simulation payload is currently documented by this architecture and
the reporting tests; it does not yet have a fully typed OpenAPI response model.

Run the suite in Docker:
docker compose exec -T backend python -m pytest tests -q -p no:cacheprovider

The repository-local Python 3.12 environment is only a development fallback while
Docker is unavailable; Docker verification is separately recorded in OVERNIGHT_REPORT.md.
Neither host installation nor system-wide Python configuration is required.
