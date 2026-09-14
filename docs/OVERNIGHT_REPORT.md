# GERT Studio v0.1 Overnight Backend Report

Final backend pre-merge review, 2026-09-14.

Recommendation: merge `codex/overnight-backend-v0.1` into `main` as the Phase 1
backend milestone. Docker verification and backend acceptance checks passed.
This is not a claim that the complete graphical Version 0.1 product is finished.
No push or merge was performed, and no frontend work was started.

## Implementation completed

The backend now includes:

- Versioned Pydantic model contracts for projects, item types, Start/state/terminal nodes, activities, outcomes, distributions, and simulation settings.
- Exact decimal input handling and Fraction-based exact inventory/time arithmetic.
- Structural validation with structured severity, paths, and element IDs.
- Fixed, uniform, triangular, and beta-PERT duration sampling.
- Independently keyed duration and outcome random streams with reproducibility metadata.
- Discrete-event simulation with parallel activities, synchronization, repeated executions, cycles, zero-duration batches, terminal behavior, deadlock, ambiguity, safety cutoffs, and lifecycle accounting.
- Reporting for all statuses, terminal outcomes, conditional terminal durations, activity starts and lifecycle counters.
- FastAPI endpoints: GET /api/health, POST /api/models/validate, and POST /api/simulate.
- Architecture documentation in docs/ARCHITECTURE.md.

The graphical frontend, persistent project storage, scenario comparison, and deferred cost/capacity features are not implemented.

## Repository architecture

- backend/app/schemas/model.py — canonical Pydantic contracts.
- backend/app/validation/ — schema and semantic diagnostics.
- backend/app/engine/ — exact arithmetic, keyed randomness, realization engine, and Monte Carlo orchestration.
- backend/app/reporting/ — deterministic summary and run payloads.
- backend/app/api/routes.py — thin JSON/HTTP adapters.
- backend/tests/ — specification-derived unit, statistical, engine, reproducibility, and API tests.
- docs/ARCHITECTURE.md — implementation choices and reproducibility contract.

## Git checkpoints

- a4d0d85 — docs: checkpoint approved GERT v0.1 specifications
- fdb636f — feat: implement validated GERT backend core and acceptance tests
- acb927f — docs: record overnight backend implementation status
- b17970f — fix: close backend pre-merge schema and numerical gaps
- Final report commit — `docs: record Docker verification and backend merge review`;
  its hash is available as HEAD after committing this report.

Current branch: codex/overnight-backend-v0.1.
The branch and clean worktree were confirmed before review. The two new local
commits contain the review fixes/architecture notes and this report, respectively.
PRODUCT.md and MODEL.md remain identical to approved checkpoint a4d0d85.

## Tests

The original implementation had 73 passing tests. Review added 14 cases in
`backend/tests/test_premerge.py`; all existing tests remain present. Defect-specific
regressions were observed failing before their corresponding fixes.

Final full-suite command, after the last application-code changes and image rebuild:

`docker compose exec -T backend python -m pytest tests -q -p no:cacheprovider`

Exact result: **87 passed, 2 warnings in 2.06s**. Exit code 0. Container Python:
3.12.14. The earlier container run passed 84 tests before the three final
sampler/warning regression cases were added.

The two warnings are upstream test-client deprecations: Starlette's use of httpx
and AnyIO's BlockingPortal alias. They are not failed tests. The local Python 3.12
fallback also passed its full 84-test intermediate suite and all 14 final review
cases; the authoritative final full run above was inside Docker.

Coverage includes deterministic and parallel workflows, synchronization, multiplicity, competition, all supported duration distributions, beta-PERT validation, probability tolerance and residual sampling, exact decimal quantities/timestamps, batching, terminals, ambiguity, cancellation, lifecycle invariants, deadlock, cycles, zero-duration chains, safety boundaries, keyed reproducibility, ordering invariance, prefix preservation, reporting, and both API endpoints.

## Docker verification

Docker repair succeeded within the explicitly authorized paths. Docker Desktop
and backend processes were stopped and WSL was shut down. Stale socket/reparse
artifacts were inspected; native Windows access/rename errors prevented startup.
WSL unlink removed confirmed stale artifacts under the authorized Docker `run`
directory: `dockerInference`, `dockerEthernetVfkit`, `sailor-ingest.sock`, and
`userAnalyticsOtlpHttp.sock`. Failed startup attempts recreated some sockets, so
the stale `dockerInference` and `sailor-ingest.sock` artifacts were cleared again
with Docker stopped before the successful restart.

Startup then exposed the separate stale
`C:\Users\guy drori\AppData\Local\docker-secrets-engine\engine.sock` failure.
Repair paused for explicit additional authorization. The directory was inspected,
and only the stale `engine.sock` was unlinked; `engine.sock.stale` was absent.
No factory reset, image/volume deletion, distro removal, registry edit, or reinstall
was performed. Normal Compose startup recreated its backend service container.

Verification results:

- `docker version`: exit 0; client/server 29.7.2, API 1.55; Docker Desktop 4.90.0
  (238679); server linux/amd64, context desktop-linux.
- `docker info`: exit 0; Linux engine on WSL2 kernel
  6.18.33.2-microsoft-standard-WSL2; 8 CPUs, 7.535 GiB memory.
- `docker compose up --build -d backend`: exit 0. Built image
  `gert-studio-backend:latest` and started `gert-studio-backend-1` on port 8000.
- Final image manifest list:
  `sha256:4fa0a0521a481491553cc1296a8d4b2fb8178be2baa42043dc1d1b4bdf090837`.
- The existing requirements-install layer was cached. This verifies the repository
  image build and running environment, not a fresh dependency resolution from scratch.
- Compose uses its existing backend bind mount and development reload command.
  The image was rebuilt after all code fixes; no Compose or Dockerfile changes
  were needed. The backend container was left running.

## Live HTTP smoke tests

Requests went from the Windows host to the container at `http://127.0.0.1:8000`.
All checks below were repeated after the final image rebuild:

| Check | Result |
| --- | --- |
| GET /api/health | HTTP 200, `{"status":"ok"}` |
| POST /api/models/validate, valid model | HTTP 200, valid=true |
| POST /api/models/validate, probability total 0.7 | HTTP 200, valid=false, probability_sum error |
| POST /api/simulate, deterministic model | HTTP 200; all 3 runs terminal at exact time 0.3; mean 0.3 |
| Repeat identical simulation, seed 20260914 | Entire response bytes identical |
| POST /api/simulate, invalid model | HTTP 422, structured validation diagnostics |
| GET /openapi.json | HTTP 200; required simulation request body documented |
| Extremely large finite Beta-PERT lambda 3e308 | HTTP 200; all 3 runs invalid_runtime_state, request terminates |

The deterministic fixture has one token at Start, one activity consuming it,
fixed duration 0.3, and one probability-1 outcome to terminal `end`. Settings:
realizations=3, seed=20260914, max_activity_completions=100,
max_activity_instances=100, max_simulation_time=100.
Both deterministic responses had SHA-256:
`a947d20321f57f689decc45112ff1fbe2462d8b0402becd2442bb22ef73493e7`.

Additional cross-platform checks compared complete Linux HTTP responses against
Windows Python 3.12 results using three orchestration threads. Eight realizations
each of uniform [0,2], triangular [0,1,2], and Beta-PERT [0,1,2,lambda=4], with
seed 20260914, matched exactly. These are compatibility checks for the tested
environments and fixtures, not a guarantee for every future Python/math build.

## Bugs found and fixed

1. Aggregate decimal formatting inherited the caller's rounding mode, so identical
   rational results could serialize differently. It now uses a fresh 34-digit
   ROUND_HALF_EVEN context, independent of the caller.
2. Beta-PERT accepted the internal Python name `shape` instead of requiring
   canonical `lambda`. Input now requires `lambda`.
3. Default Beta-PERT serialization emitted `shape`, breaking canonical export and
   reload. Default serialization now uses aliases and round-trips `lambda`.
4. Raw-request HTTP adapters omitted request-body schemas from OpenAPI. OpenAPI now
   exposes the actual Pydantic input and validation/error contracts while retaining
   lossless decimal JSON parsing.
5. Static reachability and producer warnings used the declared final probability,
   ignoring its accepted effective residual. They now use the same validated
   interval convention as sampling without rewriting model probabilities.
6. An activity requiring more than Start's nonreplenishable inventory received no
   impossible-enablement warning. It now gets a warning while remaining valid and
   producing the correct runtime deadlock.
7. Very large, finite Beta-PERT parameters could overflow Python's internal gamma
   calculation `2 * shape`, creating NaN acceptance expressions and an endless
   rejection loop. Numerical-range checks now fail before sampling and return
   invalid_runtime_state without consuming inputs. Mathematically valid parameters
   are not rejected as schema errors or silently changed.

Additional acceptance cases cover mixed-status denominators/conditional quantiles,
unfinished work at ambiguity and runtime failure, multiple input bounds, terminal
ambiguity at exact limits, and ordering/parallelism independence with overlapping
stochastic instances. No new allocation or timing semantics were introduced.

## Specification requirements

Implemented backend requirements include canonical schemas, validation, exact quantities and times, all four duration distributions, keyed reproducibility, concurrent event execution, synchronization, cycles, terminal and ambiguity statuses, safety cutoff semantics, lifecycle counts, Monte Carlo reporting, and Phase 1 API routes.

The review checked PRODUCT.md, MODEL.md (including D1-D8 and all Section 52
acceptance categories), ARCHITECTURE.md, all backend modules and existing tests.

| Review concern | Finding after fixes |
| --- | --- |
| Missing required backend behavior/tests | No remaining blocker identified in Phase 1; review regressions close the concrete gaps above |
| Behavior without specification support | No hidden allocation policy, concurrency cap, DAG restriction, cost/capacity behavior, or numeric model default found |
| Inventories and timestamps | Fraction arithmetic and exact comparisons; no float-based inventory/time comparison or epsilon coalescing |
| Probability semantics | Inclusive 1e-14 tolerance, canonical intervals, valid final residual, no normalization or mutation |
| Competition and multiplicity | Maximum per-definition multiplicity, aggregate node-local demand, ambiguity before launch cutoff, no silent allocation |
| Terminal/cutoff precedence | Whole batches; horizon before completion count; blocked outcomes unsampled; terminal/ambiguity before new starts |
| Lifecycle | Starts partition into completed/cancelled/unfinished; nonterminal endings carry unfinished reasons |
| Reproducibility | Separate SHA-256 keyed streams, stable ordinals/ID order, ordered aggregation, prefix preservation and returned versions/seeds |
| API/schema | Lossless numbers, explicit parameters/settings, canonical lambda round trip, structured invalid responses and OpenAPI inputs |

Architecture choices such as stable key encoding, sampler algorithms, type-7
quantiles and report formatting are documented engineering choices, not new
mathematical model fields. Existing successful sampler behavior and key encoding
are unchanged; the guard fixes a path that previously stalled. No change was made
to the reproducibility-version identifier.

Remaining product-level requirements include the visual editor, frontend analysis
views and JSON save/load/export UX. Project persistence endpoints are outside
Phase 1. Scenario comparison, costs, capacity scheduling and other explicitly
deferred features remain future work. No frontend implementation was started.

## Known limitations

- Concrete schemas are implemented but are not yet a separately versioned public schema package beyond `schema_version: "0.1"`.
- Report payloads retain every instance and final inventory, which may use substantial memory for large realization counts.
- Stochastic triangular and beta-PERT samples use Python's deterministic binary64 math internally, then deterministic conversion to canonical exact time.
- The requested architecture review decisions for stable key encoding and sampler algorithms are documented; changing them requires a reproducibility-version change.
- No frontend has been built.
- The successful simulation response has no complete typed OpenAPI response schema;
  its fields are documented in architecture and exercised by reporting/API tests.
- Static warnings are conservative, not a complete item-reachability or termination
  proof. No large-request load/memory benchmark or production deployment hardening
  was performed; per-instance result retention remains the primary scaling risk.
- Extreme finite stochastic parameters remain limited by the documented numerical
  sampler range. They may return invalid_runtime_state; arbitrary precision in
  stochastic sampling is not claimed.
- Dependency ranges and transitive packages are not fully locked. Reproducing
  future environments still requires compatibility verification as documented.

## Final repository status and merge decision

`git diff --check` passed. The approved PRODUCT.md and MODEL.md were checked
against a4d0d85 and are unchanged. The final report commit completes the worktree;
the post-commit status is checked before returning the completion report:

```text
On branch codex/overnight-backend-v0.1
nothing to commit, working tree clean
```

Recommend merging this backend branch into main. The Docker, full-suite, HTTP and
review gates passed; the limitations above are explicit follow-up engineering work,
not an assertion of complete frontend/product delivery. No push or merge was made.
Wait for the user's next milestone instruction before expanding scope.
