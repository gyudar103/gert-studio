# GERT Studio Frontend Milestone 1 report

## Version 0.1 release verification — 2026-09-20

The current prototype includes the original frontend below plus lossless model
JSON import/export and automated Chromium integration tests. This section
supersedes the original limitations and test counts in the historical report.
PRODUCT.md and MODEL.md remain identical to approved checkpoint `a4d0d85`.

### Failed test diagnosis

The construction E2E test was reproduced before editing. Its captured browser
accessibility tree contained an editable `Quantity 1 *` textbox inside the
`Initial inventory` group. The old exact `Quantity 1` locator omitted the required
marker and timed out. The application conforms to PRODUCT.md sections 6.2 and 8.1:
Start inventory and activity requirements have explicitly editable quantities.

Only `frontend/e2e/workspace.spec.ts` needed correction for this failure. It now
uses textbox roles scoped to the named inventory/requirements groups, permits the
required marker, verifies blank required input and retained `0.1`, and uses the
existing Fit View control before dragging a connection. The corrected test creates
a model from scratch, validates it, and simulates three terminal runs at time 0.3.
No application behavior or specification was changed to accommodate the test.

### Pending-file review and disposition

Every file pending at the start of release preparation was inspected:

| Files | Classification and disposition |
| --- | --- |
| `.gitignore` | Intended release hygiene; ignores local environments, secrets, caches, IDE files, build output and browser artifacts; example environment templates remain eligible for tracking |
| `docker-compose.yml`, `frontend/Dockerfile` | Intended optional browser-test service and separate development/test build targets |
| `docs/FRONTEND_ARCHITECTURE.md` | Intended file-format and test-workflow documentation |
| `frontend/package.json` | Harmless readable formatting; dependencies and scripts unchanged |
| `frontend/src/App.tsx`, `frontend/src/files.ts` | Intended JSON file workflow, validation before replacement and clearly separated rejected-import diagnostics |
| `frontend/src/api.ts` | Intended raw validation adapter and preservation of legal special IDs in null-prototype response dictionaries |
| `frontend/vite.config.ts` | Intended explicit allowance of the internal Compose frontend hostname |
| `frontend/e2e/workspace.spec.ts`, `frontend/playwright.config.ts`, `frontend/src/files.test.ts` | Intended browser and exact-file regression tests, including the corrected quantity locator |

No accidental/unwanted source change was found or discarded. `.venv`, Python and
pytest caches, frontend `node_modules`, TypeScript build metadata, screenshots and
Playwright traces are local/generated artifacts and remain ignored. No ignored
artifact is tracked. Credential-pattern scans of candidate files and reachable
history found no matches; this is a targeted check, not a claim of exhaustive
secret detection.

### Verification before merge

All commands ran in Docker against the current prototype:

| Gate | Result |
| --- | --- |
| Frontend Vitest | **31 passed (31)** in 3 test files; duration 6.29s |
| Frontend TypeScript/Vite build | Passed; 208 modules; built in 3.21s |
| Complete Chromium E2E suite | **3 passed (7.3s)** |
| Complete backend pytest suite | **87 passed, 2 warnings in 6.55s** |
| Frontend page | HTTP 200 at port 5173 |
| GET /api/health | HTTP 200, `{"status":"ok"}`, directly and through the frontend proxy |
| Browser validation/simulation | Passed for built-in demo and newly constructed deterministic model |
| JSON export/import reproducibility | Entire seeded demo response identical after reload |
| Invalid file and decimal-token import | Passed; current state preserved on rejection; decimal strings retained |
| Git whitespace/specification checks | Passed; frozen specifications unchanged |

The two backend warnings remain upstream Starlette/httpx and AnyIO deprecations.
The demo has parallel activities, synchronization, stochastic distributions,
multiple terminals and a cycle. Its results show 98 approved and 2 stopped runs
for the explicit 100-run demo settings. The UI retains separate terminal/status
tables, conditional completion statistics and activity lifecycle counts.

### Commits and release decision

- Existing frontend implementation: `92b8da8`; original report: `255060d`.
- Existing backend re-verification report: `437a00c`.
- `0cf9623` — `feat: complete v0.1 JSON workflow and browser verification`.
- Release documentation commit: `docs: document verified v0.1 prototype release`.

The frontend branch is suitable for a fast-forward merge into main and publication
as the annotated `v0.1.0` prototype tag after final main verification. The configured
target is `https://github.com/gyudar103/gert-studio.git`; a dry-run push confirmed
write authentication without changing remote refs. Actual push results and final
commit/tag hashes are reported in the release completion message.

Remaining limits: workspace state is in memory between file saves; JSON does not
preserve layout or run settings; imports require a running backend and a valid
model; advanced charts, mobile polish, database persistence, generated API clients,
and production hardening remain future work. The existing dependency audit reports
two moderate development-tool advisories. This release does not change dependencies
or claim production hardening.

## Original milestone report — historical record, 2026-09-14

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
has not been pushed or merged. Implementation commit: `92b8da8` (`feat: add GERT Studio
frontend milestone one`). Recommendation: merge into `main` after review of the
in-memory UX and the explicit limitations above; do not treat this milestone as the
complete saved/exportable Version 0.1 product.
