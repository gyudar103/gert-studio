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
`bignumber.js` for feedback only; it never writes a normalized or rounded value back
to an outcome. The API adapter uses `json-bigint` with native `BigInt` so large
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

## Demonstration model and tests

`demo.ts` supplies a real backend-valid workflow: parallel mechanical and software
work, integration synchronization, a Beta-PERT test with success/retry/reject
outcomes, and a repair cycle. Its settings are explicit and easy to edit. The app
starts blank so a user can construct an invalid intermediate state and use backend
validation to understand it; loading the demo is the first manual end-to-end path.

Vitest tests cover rendering, node and item creation, editing, distribution switching,
required lambda, probability display without normalization, exact request serialization,
diagnostic navigation, duplicate-request locking, cycles, model/UI separation, and
conditioned status/lifecycle result rendering. Browser verification exercises the
real canvas and backend: load demo, validate, run 100 realizations, and inspect
terminal probabilities, status frequencies, terminal-only duration metrics, and
activity lifecycle tables.

## Deliberate milestone limits

This milestone keeps edits in memory. Persistent save/load, export/import controls,
advanced charts, scenario comparison, sensitivity analysis, authentication,
collaboration, and capacity resources remain outside the milestone. The successful
simulation response is rendered from the backend payload but is not represented by a
generated OpenAPI TypeScript package; the small hand-written result types are kept
close to the UI until a public schema-generation decision is made.
