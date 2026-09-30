# Independent review: documentation and incomplete drafts

Review date: 2026-10-01 (Asia/Jerusalem).

**Recommendation: ready for me to review for approval.** No feature correctness
defect was found in the inspected implementation or verification runs. This is a
recommendation for the user's review, not authorization to integrate. Nothing was
pushed or merged. No application code, dependency, model semantics, or main-branch
content was changed during this review. The review adds this report and a link from
the historical handoff report, committed locally on the existing feature branch.

## Repository state and verified history

Repository: `C:\Users\guy drori\gert-studio`.
Branch throughout: `codex/model-documentation-and-placeholders`.
The working tree was clean before tests and edits. No branch switch occurred.
No applicable `AGENTS.md` was found in the repository or its ancestor directories.
`docs/MODEL.md` and `docs/PRODUCT.md` were used as the authoritative specifications.

| Reference | Verified commit |
| --- | --- |
| Baseline; local tracking `origin/main`; live GitHub `main` | `07e0744e7079e7b3ae5ecee85219efeaba60b4b2` |
| Beta-PERT reproducibility fix | `2dec8e79897f6348b836fd4d8663c8a2e6dc1871` |
| Original Windows packaging contribution | `e148ec3a4673d9ecabf5a3ebb148bfbb169e1241` |
| Consolidation merge | `c16e477029d51877e8eed84e11306d52022b05a5` |
| Packaging correction; local `main` | `758fbe723b48b76764da87b1e7ede84165caa897` |
| Feature implementation | `1f5f53009a80a40dc95c53a8a532682da780b815` |
| Historical handoff report; initial review HEAD | `30012413b939fbd724b78f2aece1852148830a7a` |

Commit contents, history, and report provenance were inspected rather than inferred
from their labels. Initially `origin/main...main` had 0/4 exclusive commits, and
`main...HEAD` had 0/2. The report commit follows the implementation commit, which
follows the local-main correction. The final review commit adds documentation only;
its exact hash is available with `git log -1 --format=%H -- docs/INDEPENDENT_REVIEW.md`
and in the delivery message. It cannot contain its own hash in its committed text.

Other local refs were recorded: `codex/frontend-editing` at baseline,
`codex/frontend-m1` at `264cc025fdc4428baed93b6c88d7fcf187358023`, and
`codex/overnight-backend-v0.1` at `bd45d73d40f6da8c95c3aff3ff2ec164d63596b7`.
Local Beta-PERT and Windows branches remain at the corresponding commits above.
Remote-tracking refs include `origin/main`, `origin/codex/beta-pert-reproducibility`,
and `origin/codex/windows-standalone`; `origin/HEAD` points to `origin/main`.
A read-only live query returned those same main/Beta-PERT/Windows heads and no remote
documentation feature branch. GitHub main has not advanced since the handoff's
initial fetch. No discrepancy required stopping the review.

### Packaging and preservation evidence

Local main's entire tree is identical to the Beta-PERT fix tree:
`92de10b0f064a3cef3544f93f68ea44adcf61e8f`.
`git diff --exit-code 2dec8e7 main` returned 0 with no diff. This verifies that the
packaging revert preserved all content of the pre-packaging Beta-PERT state, not just
selected files. Packaging remains in history and its old branch, not in the intended
main tree. Neither main nor feature HEAD contains tracked files under `packaging/`.
The feature changes were inspected for reintroduced Windows distribution content.
None was found.

The following are unchanged between the Beta-PERT fix and feature HEAD:
`backend/app/engine/randomness.py`, `beta.py`, `binary64.py`, `simulation.py`,
`docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, and
`frontend/package-lock.json`. The dependency manifest is also unchanged by this
feature. Docker distribution is present and was actually built and exercised below.
Local main contains the Beta-PERT fix and targeted packaging correction; the
documentation/draft implementation and both review reports remain feature-only.

## Independent implementation inspection

Inspected actual source in `backend/app/schemas/model.py`,
`backend/app/validation/__init__.py`, `backend/app/api/routes.py`, `openapi.py`,
`backend/app/engine/service.py`, `randomness.py`, and the realization entry point.
Reviewed `backend/tests/test_drafts.py`, cross-platform randomness tests, and relevant
premerge/API contracts. On the frontend, inspected `src/api.ts`, `files.ts`,
`model.ts`, `probabilities.ts`, `types.ts`, `App.tsx`, `graph.ts`,
`useWorkspaceHistory.ts`, and the Properties, DocumentationEditor, Canvas, and
Analysis components; reviewed all five unit/component test files and both browser
specifications. Searched production callers of validation and execution contracts.

| Area | Review conclusion and evidence |
| --- | --- |
| Documentation semantics | Optional descriptive fields are persisted separately from numerical inputs. Notes, certainty, explanations, and references do not feed scheduling, probabilities, duration sampling, or RNG identity keys. Duration documentation survives an absent duration or distribution change. Metadata-only seeded-result equality is covered. |
| Draft versus strict schemas | Draft duration/distribution parameters and outcome probabilities accept the intended explicit nulls. Complete schemas remain strict. Distribution parameter keys remain required even when their values may be null. Numeric validators reject floats, booleans, and nonfinite values where exact input is required; supplied invalid values remain errors. |
| Diagnostics | Missing values produce field/object-specific missing-input diagnostics; invalid supplied values are not recategorized as missing. Partial ordered bounds are checked between known values. |
| API consumers | Draft import uses draft acceptance. No inspected consumer treats draft `valid` as execution permission. Readiness is exposed separately. The UI blocks missing inputs and offers navigable explanations; the backend remains authoritative for all invalid input. |
| Execution boundary | Simulation validates completeness before generating an omitted seed or calling a realization. It then constructs a strict complete Model. Direct realization calls validate by default. The internal trusted `validated` option is not request-controlled; extra request fields are forbidden. |
| Exact JSON and compatibility | Decimal tokens are lexically preserved for frontend transport; identifiers and numeric strings retain their meaning. Documentation and nulls survive import/export. Legacy complete models remain accepted. Optional omitted documentation has the same descriptive meaning as null. |
| Partial probabilities | Null values persist. While a set is partial, editing a probability changes only the selected item, including the final unknown. It does not fill unknowns or redistribute known siblings. Subsequent edits to a complete set retain proportional adjustment, with equal allocation when sibling weights are zero. |
| Probability validity | Known totals use the approved `1e-14` tolerance and canonical residual-prefix constraints. Completing the last unknown cannot bypass full-set total/final closure validation. Unknown branches may remain possible for static analysis without receiving implied numerical values. |
| Details and canvas | Node/card/outcome click targets select the appropriate object. Documentation textareas and long parameter forms live in the details area. Placeholder badges and unknown probability labels are visible. |
| Persistence and undo | Full model history snapshots include descriptive fields and placeholder changes. Unit/component and browser coverage verifies document editing, null handling, export/import, and undo behavior. |
| Existing mathematics | Protected sampler/scheduler files are unchanged. The reproducibility assertion excludes only new descriptive validation flags from its legacy result hash; it does not weaken sampling comparisons. The complete cross-platform corpus also matches below. |

Browser tests use actual canvas cards, nodes, outcome label backgrounds, and detail
controls, without forced clicks. The draft scenario exercises documentation,
incomplete values, blocked simulation, export/import, and completion before running.
These are real Chromium interactions against the Linux frontend and backend, not
only component mocks.

## Reproducible verification

Unlike the historical handoff run, Docker was available during this review. Safe
`docker info` succeeded: Docker 29.8.0, Linux x86_64 under Docker Desktop/WSL2,
kernel `6.18.40.1-microsoft-standard-WSL2`. No reset, daemon reconfiguration, data
deletion, or broad cleanup was performed. An isolated `gert-review` Compose project
was used. Its two services were stopped after verification; images/data were retained.

Fresh image builds used the repository Dockerfiles and declared requirements/lockfile,
with `--no-cache`: fresh pip dependency installation, `npm ci`, and Playwright's
Chromium installation. The backend source bind mount was the initially clean reviewed
checkout. This is clean dependency/container verification, not a separate Git clone.

Runtime: CPython 3.12.14, GCC 12.2.0, glibc 2.36, Node 22.23.2;
FastAPI 0.141.1, Pydantic 2.13.5, NumPy 2.5.3, SciPy 1.18.1,
NetworkX 3.6.1, pytest 9.1.1, uvicorn 0.52.4, httpx 0.28.1;
Playwright 1.63.0, Chromium 153.0.8010.12 (revision 1243),
Vitest 3.2.7, Vite 7.3.6, TypeScript 5.9.3.

All commands below run from the repository root:

```powershell
docker info
docker compose -p gert-review config --quiet
docker compose -p gert-review build --no-cache backend frontend frontend-tests
docker compose -p gert-review up -d backend frontend
docker compose -p gert-review exec -T backend python -m pytest tests -q -p no:cacheprovider
docker compose -p gert-review exec -T frontend npm test
docker compose -p gert-review exec -T frontend npm run build
docker compose -p gert-review --profile test run --rm --no-deps frontend-tests
docker compose -p gert-review exec -T frontend npm audit --json
docker compose -p gert-review exec -T frontend npm audit --omit=dev --json
docker compose -p gert-review stop backend frontend
```

| Check | Actual independent result | Comparison to handoff |
| --- | --- | --- |
| Compose configuration/fresh image builds | Passed, all three images | Newly verified Linux/Docker |
| Backend pytest | 147 passed, 1 warning, 8.92 seconds | Same pass count as claimed |
| Frontend Vitest | 73 passed across 5 files, 4.71 seconds | Same pass count as claimed |
| Type check and production build | `tsc -b && vite build` passed; 212 modules | Claim independently reproduced |
| Chromium browser tests | 6 passed, 13.2 seconds | Same pass count as claimed |
| Full dependency audit | Exit 1: 2 moderate development dependency entries | Existing maintenance finding below |
| Production dependency audit | Exit 0: no reported vulnerabilities | Additional evidence, not a security guarantee |

Backend warning: Starlette's httpx deprecation warning. It did not fail tests.
Build outputs include `index-DUh40o9I.css` and `index-DnkS3g9u.js`, matching the
historical native build's asset names. Full native unit/browser suites were not
rerun in this independent pass; the counts above are actual Linux results.

The first live remote query was blocked by sandbox proxy/network restrictions; its
exact read-only command succeeded after escalation. The initial image build was
blocked accessing Docker's buildx lock in the sandbox and likewise succeeded after
exact-command approval. No application change was made to bypass either restriction.
There are no outstanding blocked checks among the requested suites.

### Independent boundary probes

A temporary ignored helper, `build/independent-review/boundaries.py`, ran against
both native Windows and the Linux container. It independently enumerated 31 duration
combinations, 10 omitted required parameter keys, and 512 three-outcome probability
sets, including tolerance boundaries and reversed serialized ordering. Its exact
Fraction oracle checked draft acceptance/readiness and residual constraints.
Patching seed generation and realization to fail if reached confirmed 28 incomplete
or invalid simulation requests were rejected before either operation. A supplied
top-level `validated` bypass field was rejected. Both environments returned:

```json
{"duration_cases":31,"omitted_parameter_keys":10,"passed":true,"probability_sets":512,"rejected_before_seed_or_run":28}
```

Commands:

```powershell
& .venv-windows/Scripts/python.exe build/independent-review/boundaries.py backend
Get-Content -Raw build/independent-review/boundaries.py | docker compose -p gert-review exec -T backend python - /app
```

This helper is local supplemental review evidence, not a committed regression suite.
The committed draft tests and full suites above provide the reproducible baseline.
No application defect was found requiring a new regression test or fix commit.

### Cross-platform reproducibility

The existing committed `backend/tools/reproducibility_probe.py` ran on both Windows
CPython 3.12.14 (MSC) and Linux CPython 3.12.14 (GCC), with libmpdec 2.5.1. Its full
result objects and hashes were compared, not just selected summary statistics.

```powershell
& .venv-windows/Scripts/python.exe backend/tools/reproducibility_probe.py | Set-Content -Encoding utf8 build/independent-review/windows-corpus.json
docker compose -p gert-review exec -T backend python tools/reproducibility_probe.py | Set-Content -Encoding utf8 build/independent-review/linux-corpus.json
```

Both produced corpus SHA-256
`4b8382154157f67fa6c945c0be5d322890e5e435b6fd845fdad0528dcc47dc10`.
The corpus covers 9,216 duration samples and a 100-realization demo. Probe checks for
worker-count invariance (1 versus 4), ordering/labels/UI changes, and the shared
100-realization prefix of a 125-realization run passed in both environments.
Thus Windows/Linux reproducibility is verified for this corpus and these runtimes;
it is not a claim about every possible platform or dependency version.

## Findings, remaining risks, and integration recommendation

1. **No blocking implementation finding.** The inspected contracts, UI behavior,
   probability boundaries, and all requested suites passed. No feature code changes
   or local code-fix commits were necessary.
2. **Moderate, pre-existing development dependency advisory; not fixed in this scope.**
   `npm audit` reports Vitest and `@vitest/mocker` against
   [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9),
   described by the audit as path traversal/arbitrary file read in the mocker.
   These are two affected package entries associated with the same advisory.
   The reported available Vitest update is 5.0.3, a major version change.
   Manifest/lockfile versions predate this feature; changing them would be unrelated
   maintenance. No production dependency advisory was reported. This should be
   tracked separately; the review does not certify the project vulnerability-free.
3. **Historical verification gap resolved.** The original report accurately marks
   its own Docker run as not performed. This review now supplies fresh Linux Docker
   suite results and a direct Windows/Linux corpus comparison. Historical results
   were not relabeled as container results.
4. **Scope limits.** Browser verification covers Chromium, not Firefox/WebKit.
   ARM, macOS, other Python versions, and future dependency resolutions were not
   tested. Some backend requirements and base image tags are ranges/mutable tags;
   the observed runtime versions above matter when reproducing this run.

The proposed feature tree excludes Windows standalone packaging and preserves
Beta-PERT reproducibility and Docker distribution. Local main and GitHub main remain
at their verified, distinct commits. The implementation is ready for the user's
approval review, with the existing development advisory disclosed. Any push or merge
requires the user's later decision; neither was performed by this review.
