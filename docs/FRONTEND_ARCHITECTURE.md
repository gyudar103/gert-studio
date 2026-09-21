# GERT Studio frontend architecture

Frontend Milestone 1 is a React 19 and TypeScript workspace built with Vite and
`@xyflow/react`. It runs as the `frontend` service in Docker Compose on port 5173;
the existing FastAPI backend remains on port 8000. Vite proxies `/api` requests to
the backend service during local development.

## State model

`Workspace` is the single editable state object. Its `model` contains only the
serializable mathematical concepts from the backend contract: project, item types,
nodes, and activities. `layout` stores canvas positions separately. Selection,
validation diagnostics, simulation results, busy state, and the simulation settings
form are UI state in `App`; they are never included in `apiModel`.

The graph is a projection of the model. Node cards represent Start, State, and
Terminal nodes. Each activity is one card with one source edge and one edge for every
outcome. Alternative outcomes therefore remain branches of a single activity
definition. The editor updates the canonical activity outcome list rather than
creating independent outgoing activities. `@xyflow/react` is configured for free
connections and does not apply a DAG or cycle-prevention policy.

## Exact decimal handling

Quantity, probability, duration, and simulation-time text inputs remain strings from
editing through request construction. The UI displays a probability total with
`bignumber.js`. Manual probability edits use the explicitly requested sibling
adjustment described below; displaying totals does not modify outcomes. The API adapter uses `json-bigint` with native `BigInt` so large
integer seeds and limits are not coerced through JavaScript `Number`. Empty required
numeric fields remain empty and are rejected by the backend; there are no frontend
numeric defaults. `simulationBody` emits decimal strings and integer JSON tokens while
omitting an optional seed when the user leaves it blank.

The backend is the only authority for exact decimal validation, probability tolerance,
sampling, inventory arithmetic, event ordering, multiplicity, resource competition,
cutoff precedence, and lifecycle classification. The frontend does not duplicate
those algorithms.

## Editing and API integration

The left Model panel manages project identity, declared item types, network outline,
and separate simulation settings. The center canvas supports pan, zoom, selection,
dragging, node creation, free node-to-node activity creation, and graph deletion via
the property panel. The right Properties panel edits all node, item, activity,
duration, requirement, outcome, and produced-item fields. It makes every selected
distribution's required fields visible; Beta-PERT always shows an empty required
`lambda` field until the user supplies it.

`api.ts` centralizes lossless requests to `POST /api/models/validate` and
`POST /api/simulate`. It converts network failures, malformed responses, HTTP 422
diagnostics, and successful JSON responses into UI state. Validation diagnostics are
grouped by severity and can focus the affected node, activity, outcome, or item.
Simulation results preserve the backend's status denominator, terminal-only duration
conditioning, lifecycle counters, and returned seed. A submission lock prevents
duplicate requests while either operation is running.

## JSON files

`files.ts` exports only the mathematical model, with decimal fields stored as
strings. Export is also available for incomplete drafts; a draft must be corrected
before it can pass import validation. A lexical pass quotes number tokens while
leaving complete JSON string tokens untouched. The existing strict `json-bigint`
parser therefore reads numeric lexemes as strings without a JavaScript Number
conversion. The original, unmodified file is sent to backend validation, preserving
its JSON types as well as numeric tokens. The prepared workspace is installed only
after schema and semantic validation succeed. This is transport handling, not a
second mathematical validator; it cannot silently turn an invalid numeric ID into
a valid string ID. No additional parsing dependency is needed.
Duplicate keys and malformed JSON are rejected; no value is repaired or normalized.

An invalid file never replaces the current model. Its diagnostics are explicitly
labeled as file diagnostics and do not navigate the unrelated current graph.
Valid imports ask before replacing an existing network and retain backend warnings.
Canvas positions are regenerated; optional imported `ui_metadata` is deliberately
excluded from the mathematical workspace. Existing run settings stay separate and
unchanged. Exported files do not contain layout or run settings.

The response parser uses null-prototype dictionaries and preserves all legal IDs,
including `constructor` and `__proto__`, rather than rejecting them as object keys.

## Automated browser verification

`frontend/e2e/workspace.spec.ts` uses Playwright Chromium against the real frontend
and backend. It covers demo load/validate/simulate/results, JSON download and reload,
identical seeded responses after reload, exact numeric-token import, rejected-file
state preservation, and creating a deterministic network using forms and a canvas
handle connection. These tests complement the fast Vitest component/transport tests.

The optional Compose `test` profile builds a separate `browser-tests` Docker target
with Chromium and its dependencies. Normal startup uses only the `development`
target and does not install a browser. No host Node installation is required:

```text
docker compose up --build -d
docker compose exec -T frontend npm test
docker compose exec -T frontend npm run build
docker compose --profile test run --build --rm frontend-tests
docker compose exec -T backend python -m pytest tests -q -p no:cacheprovider
```

## Demonstration workflow

`demo.ts` supplies a real backend-valid workflow: parallel mechanical and software
work, integration synchronization, a Beta-PERT test with success/retry/reject
outcomes, and a repair cycle. Its settings are explicit and easy to edit. The app
starts blank so a user can construct an invalid intermediate state and use backend
validation to understand it; loading the demo is the first manual end-to-end path.

Vitest tests cover rendering, node and item creation, editing, distribution switching,
required lambda, probability adjustment during manual editing, exact request serialization,
diagnostic navigation, duplicate-request locking, cycles, model/UI separation, and
conditioned status/lifecycle result rendering. Browser verification exercises the
real canvas and backend: load demo, validate, run 100 realizations, and inspect
terminal probabilities, status frequencies, terminal-only duration metrics, and
activity lifecycle tables.

## Deliberate milestone limits

The live workspace is in memory; JSON import/export provides file save/load.
Database persistence, layout/run-settings file storage, advanced charts,
scenario comparison, sensitivity analysis, authentication,
collaboration, and capacity resources remain outside the milestone. The successful
simulation response is rendered from the backend payload but is not represented by a
generated OpenAPI TypeScript package; the small hand-written result types are kept
close to the UI until a public schema-generation decision is made.


## Editing and result presentation

`useWorkspaceHistory.ts` retains immutable model/layout snapshots around existing
React state updates. Adding/deleting elements includes their layout changes in one
entry; a canvas drag is a transaction. Undo restores the preceding snapshot and
clears selection and stale analysis. Ctrl+Z and Cmd+Z apply when history exists and
the editor is not busy; simulation settings keep native text undo. New, demo, and
successful import start a fresh history. Intermediate form drafts remain editable
and can be restored by undo; history does not claim backend validity for unfinished
models. Field change events are individual history entries.

As explicitly requested for frontend editing, `adjustProbability` redistributes
only sibling outcomes in the same activity when a probability is edited. It uses
decimal arithmetic, proportional weights, equal allocation for all-zero siblings,
and final residual closure so stored decimal strings total exactly one. A lone
valid outcome becomes one. Invalid/incomplete edited or sibling values remain for
correction and backend validation. Import and validation never normalize values;
backend sampling and probability semantics are unchanged. This editing convenience
is disclosed next to the probability total.

`ResultNumber` uses decimal half-up rounding to three significant digits and local
presentation state to toggle the exact received string/integer. All aggregate
metrics and counts use it; seed and version identifiers stay exact. It never mutates
results or sends a request. Unit tests cover formatting, independent repeated
toggling, probability closure and edge cases, and workspace history; browser tests
cover actual drag and keyboard undo.
