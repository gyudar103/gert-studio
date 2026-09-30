# Documentation and incomplete drafts: independent review handoff

Report date: 2026-10-01 (Asia/Jerusalem). This report describes local work only.
Nothing was pushed to GitHub. The implementation is committed on
`codex/model-documentation-and-placeholders`, separate from `main`.

## 1. Requested scope and final repository state

The original request was to consolidate existing features, then implement the attached
documentation/incomplete-model specification across backend, editor, persistence, undo,
and tests. The subsequent correction explicitly required removing only Windows
standalone packaging from `main`, retaining Beta-PERT reproducibility, Docker support,
and unrelated work. Native verification was authorized because Docker is unavailable.
Push remains conditional on the user's later approval.

| Reference | Commit | Meaning |
| --- | --- | --- |
| Remote `origin/main` at the initial fetch | `07e0744e7079e7b3ae5ecee85219efeaba60b4b2` | Existing model undo, probability editing, expandable results |
| Preserved Beta-PERT fix | `2dec8e79897f6348b836fd4d8663c8a2e6dc1871` | Cross-platform reproducibility implementation |
| Original feature-branch starting point | `c16e477029d51877e8eed84e11306d52022b05a5` | Consolidation merge, initially including packaging |
| Local `main`, packaging correction | `758fbe723b48b76764da87b1e7ede84165caa897` | Targeted revert of Windows packaging commit `e148ec3` |
| Tested implementation | `1f5f53009a80a40dc95c53a8a532682da780b815` | Documentation and explicit incomplete drafts, including tests/spec updates |

This report is committed separately after the implementation so it can name the exact
implementation hash. Its own commit is discoverable with
`git log -1 -- docs/DOCUMENTATION_DRAFTS_REVIEW.md`.

The packaging correction uses `git revert`, not a reset or history rewrite. It removes
the packaging launcher/build/verification/license files, the two Windows distribution
documents, the Windows README section, and the packaging-specific ignore addition.
The old packaging commit remains in history; its content is reverted on `main`.
The historical Windows feature branch is preserved.

Evidence that unrelated content was preserved:

```text
git rev-parse 'main^{tree}'
92de10b0f064a3cef3544f93f68ea44adcf61e8f
git rev-parse '2dec8e7^{tree}'
92de10b0f064a3cef3544f93f68ea44adcf61e8f
git diff 2dec8e7 main --stat
(empty)
git ls-tree -r --name-only main packaging
(empty)
```

The feature branch was fast-forwarded to the corrected `main` before committing the
implementation. The implementation has **not** been merged into `main`. All feature
changes from the interrupted work were retained. The working tree was initially clean;
no unrelated edits were staged or discarded. Git's local `.git/info/exclude` ignores
the pre-existing `.venv-windows/` runtime so it is not accidentally committed after
removal of the packaging ignore rule. This is local test tooling, not shipped packaging.

## 2. Implemented user behavior

- Selecting a node opens its existing data and a collapsible documentation section:
  comments, assumptions, descriptive certainty, and explanation.
- Node properties provide links to outgoing activities and incoming outcomes. Activity
  cards and outcome connections continue to select the corresponding details; outcome
  selection focuses its fieldset.
- Duration and outcome documentation sections expose rationale, assumptions,
  sources/references, and certainty. These are ordinary text fields, not interpreted
  probabilities, estimates, distributions, or executable content.
- The canvas retains compact graph representations. Long notes and parameter forms
  stay in properties. Activities with unknown simulation inputs show `Incomplete`;
  unknown outcome labels show `p=?`.
- New activities have an unselected duration and unknown probability. Users can select
  a distribution while leaving some/all parameters unknown, clear a parameter, or
  return to the unselected distribution. Selecting a new distribution clears its
  parameters and preserves duration documentation.
- Explicit zero remains a known value. Blank supported parameter/probability inputs
  become null. Invalid nonblank text remains available for correction and is rejected
  by backend validation.
- Missing inputs are listed with object-specific clickable explanations. Run Simulation
  is disabled while explicit unknowns exist. Backend validation remains authoritative
  for all supplied values, structural constraints, and settings.
- Documentation and placeholder edits participate in the existing snapshot undo.
  Probability adjustment remains one undoable model change. Import/model replacement
  retains the previous behavior of resetting history.

## 3. Schema and persistence decisions

The reader remains `schema_version: "0.1"` with an additive extension. Existing complete
JSON models require no migration and retain their mathematical meaning. Older versions
of GERT Studio cannot read the newly allowed fields/null drafts; forward compatibility
with old readers is not claimed.

New optional fields:

| Object | Field | Storage |
| --- | --- | --- |
| Node | `documentation` | Nullable `Documentation` object |
| Activity | `duration_documentation` | Nullable `Documentation` object |
| Outcome | `documentation` | Nullable `Documentation` object |

`Documentation` uses optional nullable strings: `comments`, `assumptions`, `certainty`,
`explanation`, `rationale`, and `references`. One simple shared schema is used; the UI
exposes the relevant subset for each object. Unknown metadata keys remain rejected.
Absent documentation, null documentation, and an empty object all mean no notes.
Empty text is accepted. Frontend import/export preserves the supplied fields; backend
schema serialization may materialize absent optional fields as null. These are
semantically equivalent. Full supplied documentation and explicit input nulls survive
round trips.

Duration notes are on the activity rather than inside the distribution object so notes
survive `duration: null` and distribution changes.

Supported explicit unknowns:

```json
{
  "duration": null,
  "duration_documentation": {
    "rationale": "Awaiting a timed trial",
    "certainty": "Unverified"
  }
}
```

```json
{"type":"beta-PERT","min":"0","mode":null,"max":"8","lambda":null}
```

```json
{"probability":null}
```

These are field fragments, not standalone runnable models. Required parameter names
must still be present for a selected distribution. Omission is not silently interpreted
as null. No default duration distribution or numeric estimate is inserted.

Decimal transport is unchanged: original JSON numeric tokens are validated losslessly
by the backend and represented as editable decimal strings in the frontend. Decimal
strings, long precision, trailing zeros/exponents on frontend round trips, identifiers,
documentation, and nulls are retained. UI layout is regenerated on import as before;
simulation settings stay separate and there is no autosave/database.

## 4. Validation boundary and simulation preservation

`Model` retains strict complete-input duration/outcome schemas. `DraftModel` and its
activity/duration/outcome variants permit only the requested explicit unknowns.
Constraints and documentation are shared. Supplied values still obey finite/nonnegative
duration rules and `[0,1]` probability bounds. Ordered known duration values are compared
even across an unknown field, so min=3, mode=null, max=2 is rejected.

Both HTTP routes parse the draft-capable request shape. Their acceptance differs:

| Operation/input | `valid` | `draft_valid` | `simulation_ready` |
| --- | --- | --- | --- |
| Validate complete valid model | true | true | true |
| Validate structurally valid incomplete draft | true | true | false |
| Simulate structurally valid incomplete draft (HTTP 422) | false | true | false |
| Invalid supplied value or structure | false | false | false |

For schema/JSON failures the HTTP status is 422. Semantic validation failures on the
validation endpoint retain its existing HTTP 200/report pattern. Missing explicit inputs
produce `missing_input` diagnostics, informational for draft validation and errors for
simulation. Paths identify activities, distribution fields, and activity-local outcomes;
messages include activity IDs and outcome IDs where relevant.

`validate_model` defaults to `require_complete=True`; the import/validation route opts
into `False`. `simulate` validates completeness before generating a seed, then rebuilds
a strict `Model` before executing the unchanged realization engine. Direct unvalidated
`run_realization` calls also reject incomplete drafts through the existing validation
gate. Internal `validated=True` is still a trusted caller contract, not an import API.

Malformed references, duplicate IDs, invalid Start/Terminal connectivity, undeclared
items, empty/all-zero requirements, malformed numeric text, booleans, nonfinite values,
invalid ordering, and out-of-range probabilities remain invalid. Unknown graph branches
are treated as possible only for conservative static warnings. No execution or numeric
probability is assigned to unknowns.

Engine version, RNG keys, stochastic algorithms, inventories, scheduling, safety limits,
canonical outcome ordering, and lifecycle accounting are unchanged. Duration/outcome
documentation and certainty never enter the engine's mathematical calculations.

## 5. Probability editing and partial validation

If the **pre-edit** activity has any null probability, the edit changes only the selected
outcome. This includes filling the final unknown. For example:

```text
[0.7, null, null] --set second to 0.2--> [0.7, 0.2, null]
[0.7, 0.2, null] --set third to 0.3--> [0.7, 0.2, 0.3]
```

The resulting invalid total remains visible for explicit correction/validation. Once
complete, subsequent valid edits use the established proportional sibling adjustment,
including equal allocation among zero-weight siblings and exact residual closure.
Clearing a value stores null without rewriting siblings. For a previously unknown
single outcome, the entered value is retained for validation; subsequent complete-set
editing follows the established single-outcome-at-one rule.

Backend validation/import never normalize values. Partial sets validate each supplied
probability and reject impossible known sums: total above `1 + 1e-14`, or known
probabilities before the canonical final outcome summing above one. Full-set total and
final effective interval checks are deferred until completion. The existing inclusive
`1e-14` tolerance and final-residual sampling convention are unchanged.

## 6. Files changed in the implementation commit

| Area | Files | Purpose |
| --- | --- | --- |
| Backend contracts | `backend/app/schemas/model.py` | Metadata, draft variants, strict complete schemas retained |
| Backend validation | `backend/app/validation/__init__.py` | Readiness, missing fields, partial probability checks |
| API | `backend/app/api/routes.py`, `backend/app/api/openapi.py` | Draft boundary and documented response contracts |
| Orchestration | `backend/app/engine/service.py` | Reject incomplete models and construct strict engine input |
| Backend tests | `backend/tests/test_drafts.py`, `backend/tests/test_premerge.py`, `backend/tests/test_cross_platform_randomness.py` | Draft acceptance/rejection, schema documentation, reproducibility |
| Frontend state | `frontend/src/types.ts`, `frontend/src/model.ts`, `frontend/src/probabilities.ts` | Nullable types, missing diagnostics, explicit probability editing |
| Properties | `frontend/src/components/Properties.tsx`, `frontend/src/components/DocumentationEditor.tsx` | Notes, placeholders, object navigation |
| Rendering | `frontend/src/App.tsx`, `frontend/src/components/Analysis.tsx`, `frontend/src/components/Canvas.tsx`, `frontend/src/graph.ts`, `frontend/src/styles.css` | Simulation blocking, draft status, compact indicators, note styling |
| Frontend unit tests | `frontend/src/drafts.test.tsx`, `frontend/src/editing.test.tsx`, `frontend/src/model.test.ts` | Round trips, notes, undo, null editing, numerical behavior |
| Browser tests | `frontend/e2e/drafts.spec.ts`, `frontend/e2e/workspace.spec.ts` | New draft workflow; existing form test explicitly selects its distribution |
| Specifications/docs | `docs/MODEL.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/FRONTEND_ARCHITECTURE.md`, `README.md` | Authoritative extension and implementation behavior |

The existing JSON transport and snapshot-history files required no changes. Dockerfiles,
Compose configuration, dependency manifests/lockfile, engine random sampling, and
simulation core were not modified. This report is the only subsequent documentation file.

## 7. Tests and actual results

These results are **native Windows verification**, not Docker verification.

| Check | Result |
| --- | --- |
| Full backend suite, `pytest backend/tests -q -p no:cacheprovider` | **147 passed**, 2 upstream deprecation warnings |
| Full frontend suite, `vitest run` | **73 passed**, 5 test files |
| TypeScript build/type checking | **Passed** |
| Production build, `npm --prefix frontend run build` | **Passed**, 212 modules; JS 488.85 kB / gzip 158.99 kB; CSS 26.56 kB / gzip 5.65 kB |
| Chromium browser suite, `playwright test` | **6 passed**, final full run 11.9 seconds |
| `git diff --check` and staged equivalent | **Passed** |
| Packaging removal/content preservation | **Passed**, identical main/Beta-PERT tree hashes above |
| Docker backend/frontend/build/browser verification | **NOT RUN — Docker daemon unavailable** |
| Fresh Linux execution / Windows-vs-Linux comparison | **NOT RUN**; native reference-vector and reproducibility tests passed |
| Windows standalone packaging tests/build | **Not applicable**, intentionally removed from main |

Environment: CPython 3.12.14, Pydantic 2.13.5, FastAPI 0.141.1, pytest 9.1.1,
NumPy 2.5.3, SciPy 1.18.1, NetworkX 3.6.1; Node 22.19.0, Vitest 3.2.7,
Vite 7.3.6, Playwright 1.63.0, local Chromium/headless-shell revision 1243
(153.0.8010.12). Pre-existing dependencies/runtimes were reused; none were added to Git.

New backend tests comprise 29 parameterized cases covering supported null forms,
object-specific simulation rejection, strict-schema rejection, invalid supplied values,
bad references/IDs/requirements, partial sums/tolerance, null/metadata serialization,
legacy complete models, zero duration, and metadata-only seeded output equality across
worker counts. Five new frontend tests cover partial probability edits, persistence,
canvas projection, notes/navigation/undo, and unknown-to-zero readiness transitions.

The new browser test creates a neutral request-processing graph through the editor,
clicks an actual canvas node, edits notes, confirms they stay off the canvas, exports
and imports an unselected-duration/null-probability draft, clicks an outcome label,
uses associated-activity navigation, repeats the round trip with partial uniform
parameters, completes inputs to exact zero duration, validates and simulates, then
checks undo of both a placeholder edit and documentation. The five previous browser
tests also passed, including seeded replay after export/import, invalid import safety,
exact numeric tokens, canvas connections, probability undo, and drag history.

Failures found and resolved during verification:

1. Nullable beta-PERT `lambda` initially had its alias on one union member; Pydantic
   ignored it. Moving the alias to the full field fixed input, serialization, and OpenAPI.
2. The full-response reproducibility hash initially differed because validation adds
   two flags. The test now asserts those flags separately and excludes **only those two
   new fields** when checking the unchanged original hash
   `0990d8f3a875d902e3b7bcd96a2d5789d890f95bac4606f1cb35ac0802edae5e`.
   It does not replace the old expected simulation hash.
3. New browser coverage initially targeted non-interactive SVG text. The test now clicks
   React Flow's label background, the actual pointer target, without forced clicks.
4. Existing tests were updated only for intentional contract changes: null instead of
   empty placeholders, draft OpenAPI types, and explicit distribution selection for a
   newly created activity. Existing numerical/editing assertions remain in place.

The backend warnings concern upstream Starlette/httpx/AnyIO deprecations; browser output
also includes a terminal color-environment warning. No test failures remain.

## 8. Reproduction commands

Run from the repository root in PowerShell. The runtime paths below are the existing
local environment, not a newly introduced deployment requirement.

```powershell
$env:PYTHONPATH = "$PWD\backend"
& .venv-windows/Scripts/python.exe -m pytest backend/tests -q -p no:cacheprovider

$env:PATH = "$PWD\build\tooling\node-v22.19.0-win-x64;$env:PATH"
& build/tooling/node-v22.19.0-win-x64/npm.cmd --prefix frontend test
& build/tooling/node-v22.19.0-win-x64/npm.cmd --prefix frontend run build
```

For browser verification, run the backend and frontend in separate terminals:

```powershell
# Terminal 1, repository root
& .venv-windows/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000

# Terminal 2, repository root
Set-Location frontend
$env:API_TARGET = 'http://127.0.0.1:8000'
& '../build/tooling/node-v22.19.0-win-x64/node.exe' node_modules/vite/bin/vite.js --host 127.0.0.1

# Terminal 3, repository root
Set-Location frontend
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\..\build\playwright-browsers"
& '../build/tooling/node-v22.19.0-win-x64/node.exe' node_modules/@playwright/test/cli.js test
```

The actual frontend unit command used the same local Node with
`node_modules/vitest/vitest.mjs run` from `frontend`. Native child processes required
user-authorized execution outside the sandbox. Browser screenshots are local ignored
artifacts in `frontend/test-results/`, including `documented-draft-completed.png` and
`demo-results.png`; they are not required to review the committed tests.

When Docker is restored, use the existing Compose workflow to repeat checks in Linux:

```powershell
docker compose up --build -d backend frontend
docker compose exec -T backend python -m pytest tests -q -p no:cacheprovider
docker compose exec -T frontend npm test
docker compose exec -T frontend npm run build
docker compose --profile test run --build --rm frontend-tests
```

These Docker commands are recommendations for subsequent verification, **not commands
reported as successfully run here**. Docker's startup log identified an inaccessible
stale `sailor-ingest.sock`; targeted cleanup attempts failed. No Docker reset, factory
reset, data purge, or configuration change was performed.

## 9. Independent reviewer focus and remaining limits

Suggested review diff: `git diff 758fbe7..1f5f530`. Review the packaging reversal
separately with `git show 758fbe7`. Verify the main tree equality above and confirm
that no packaging content was reintroduced by the feature commit.

Focus on:

1. Nullable contract constraints and canonical `lambda` alias; missing keys must still
   fail while explicit null values are accepted only in supported locations.
2. `valid` on the validation route now means draft acceptance; consumers needing to
   execute must check `simulation_ready` or submit to the guarded simulation endpoint.
3. Known partial sums cannot bypass inclusive tolerance/final-interval constraints.
4. The final unknown probability edit must not normalize known siblings.
5. Strict engine reconstruction and absence of metadata from RNG keys and scheduling.
6. Exact JSON transport, stable IDs, notes surviving distribution changes, and undo.
7. Browser tests exercise real node/edge clicks and backend import validation; unit
   tests that mock Canvas are supplemented by those browser checks.

Remaining limitations are deliberate or environmental: Docker/Linux verification is
blocked; older readers cannot consume extended drafts; quantities, references and
structural requirements are not nullable; invalid nonblank form text can be exported
for safekeeping but cannot be imported until corrected. There is no automatic saving,
layout persistence, rich-text/reference resolution, or inference from certainty.
All model edits, including notes, clear displayed prior results through the existing
UI behavior; rerunning with the same mathematical model and seed yields unchanged
results. No unresolved mathematical/UX specification conflict was identified.

Do not push or merge the implementation into main until the user approves the review.
