# GERT Studio Frontend Milestone 1 report

Date: 2026-09-14

Frontend Milestone 1 delivers the first usable graphical modeling → validation →
simulation loop on branch `codex/frontend-m1`. `PRODUCT.md` and `MODEL.md` remain
unchanged and authoritative. No backend mathematical or simulation semantics were
modified.

## Implemented

- React 19 + TypeScript + Vite frontend in `frontend/`.
- Desktop workspace with Model/Items, React Flow canvas, Properties, Validation,
  and Simulation Results panels.
- Start, State, Terminal, and activity cards with distinct styling, pan, zoom,
  selection, dragging, free node-to-node activity creation, and property deletion.
- Canonical item, node, activity, duration, requirement, outcome, and produced-item
  editors. Alternative outcome edges stay attached to one activity definition.
- Exact-decimal-safe string editing and `json-bigint` request serialization, including
  seeds beyond JavaScript's safe integer range. No probability normalization or hidden
  numeric defaults.
- Backend validation and simulation adapters with loading state, request locking,
  network/HTTP diagnostics, severity grouping, and diagnostic focus navigation.
- Results for terminal outcomes, every backend run status, conditional terminal-only
  duration statistics, activity starts, completion/cancellation/unfinished counters,
  and unfinished reasons.
- Explicit prototype demo with parallel work, synchronization, stochastic duration,
  three outcomes, success/failure terminals, and a rework cycle.
- Docker Compose frontend service on port 5173, preserving the verified backend on
  port 8000.
- Architecture notes in `docs/FRONTEND_ARCHITECTURE.md`.

## Verification

Frontend behavior tests run in the Node 22 Docker environment:

```text
2 test files passed
19 tests passed
```

The frontend production build runs in Docker with Vite 7 and TypeScript:

```text
207 modules transformed
dist/index.html 0.40 kB
dist/assets/index-DZ0q-ZSy.js 480.10 kB (155.91 kB gzip)
✓ built
```

Both services build and start with:

```text
docker compose up --build -d
```

The backend suite was rerun in the combined Compose environment:

```text
87 passed, 2 warnings in 2.49s
```

The warnings are the existing Starlette/httpx and AnyIO deprecations. They are not
test failures.

## End-to-end demo

In a real browser at `http://localhost:5173`, the demo was loaded, validated, and
simulated through the UI against `http://localhost:8000`.

- Validation returned `Model valid`, with the expected conservative cycle and
  multiple-terminal warnings visible.
- Simulation ran 100 realizations with seed `20260914`.
- The results view showed 98 approved and 2 stopped terminal outcomes, all 100 runs
  reaching a terminal, conditional terminal-only completion metrics, and lifecycle
  rows for all five activities.
- The graph visibly showed the parallel build branches, synchronization, one test
  activity with three outcome branches, and the repair cycle.
- Decimal request handling was covered by tests for values such as
  `0.1000000000000000000001`, `0.30000000000000000001`, and a 128-bit seed.

## Known limitations and remaining frontend work

The workspace is intentionally in-memory; refresh loses edits. Persistent project
save/load, JSON export/import UX, richer graph editing and branch controls, advanced
charts, responsive mobile polish, generated API clients, and production deployment
hardening remain future work. The browser test uses the real canvas manually; a
dedicated Playwright test suite is a sensible follow-up once persistence and stable
selectors are added. Dependency installation reports two moderate development-only
Vitest advisories; upgrading across the major-version boundary should be a separate
tooling decision.

## Commit and recommendation

The implementation and tests are ready as a frontend milestone for review. The branch
has not been pushed or merged. After the final clean-worktree check, the local commits
will be recorded here by hash. Recommendation: merge into `main` after review of the
in-memory UX and the explicit limitations above; do not treat this milestone as the
complete saved/exportable Version 0.1 product.
