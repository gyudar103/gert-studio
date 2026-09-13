# GERT Studio v0.1 Overnight Backend Report

Status as of 2026-09-14.

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

Current branch: codex/overnight-backend-v0.1.

## Tests

The repository-local Python 3.12 environment ran:

`PYTHONPATH=backend .venv\\Scripts\\python.exe -m pytest backend/tests -q -p no:cacheprovider`

Result: 73 passed, 2 deprecation warnings.

Coverage includes deterministic and parallel workflows, synchronization, multiplicity, competition, all supported duration distributions, beta-PERT validation, probability tolerance and residual sampling, exact decimal quantities/timestamps, batching, terminals, ambiguity, cancellation, lifecycle invariants, deadlock, cycles, zero-duration chains, safety boundaries, keyed reproducibility, ordering invariance, prefix preservation, reporting, and both API endpoints.

## Docker verification

Docker CLI version: 29.7.2.

Docker Desktop is not currently exposing the Linux engine. Startup initially failed on the authorized stale `sailor-ingest.sock`; WSL shutdown and an authorized unlink removed that socket. Startup then failed on a separate stale `dockerInference` reparse point. That path is outside the currently authorized repair scope, so no deletion or broader reset was performed.

Required Docker build/start, in-container test execution, and live endpoint checks remain outstanding for this reason.

## Specification requirements

Implemented backend requirements include canonical schemas, validation, exact quantities and times, all four duration distributions, keyed reproducibility, concurrent event execution, synchronization, cycles, terminal and ambiguity statuses, safety cutoff semantics, lifecycle counts, Monte Carlo reporting, and Phase 1 API routes.

Remaining product-level requirements include the visual editor, frontend analysis views, model save/load UI, export UX, and future scenario/cost/capacity work. Docker verification is blocked by the host runtime issue above.

## Known limitations

- Concrete schemas are implemented but are not yet a separately versioned public schema package beyond `schema_version: "0.1"`.
- Report payloads retain every instance and final inventory, which may use substantial memory for large realization counts.
- Stochastic triangular and beta-PERT samples use Python's deterministic binary64 math internally, then deterministic conversion to canonical exact time.
- The requested architecture review decisions for stable key encoding and sampler algorithms are documented; changing them requires a reproducibility-version change.
- No frontend has been built.

## Next recommended milestone

Resolve the Docker Desktop runtime socket issue within the authorized scope, then run the complete suite in the container and verify health, validation, and a deterministic simulation over HTTP. After that, perform an API/schema review and add any missing acceptance cases before expanding the backend or starting frontend work.

