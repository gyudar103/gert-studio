The interactive tutorial is prepared on `docs/interactive-gert-tutorial`.
Final review found no blocking code findings after the fixes and checks below.
The approved delivery scope is a branch commit/push and pull request; main merge,
website publication, and Windows release creation remain outside this change.

The attached 19 October 2026 tutorial supplied the lesson text and standalone
HTML design reference. Remote main was rechecked before implementation and still
resolved to `52fcd732787d5829d923bf2178594de21704b2dc`; this is also local HEAD.
The remote annotated tag `v0.2.0` is
`d13e15fa03058e0bd7be182ae83ee035fe04e716`, peeling to application source
`e4d0b26b281803a520c0525fa8f62011b55219f2`, matching the attachment.
The reviewed implementation is the dedicated tutorial branch diff against that main commit.

**What changed**

- Learn / Tutorial opens 22 lessons with reading progress, Previous/Next navigation,
  keyboard navigation (arrows, Home, End), focus management and a responsive layout.
  Reading text opens immediately for reading-only lessons; practical lessons show
  their steps first and offer the full reference text.
- The existing editor is extracted to `Editor.tsx`. The user's editor remains mounted
  while an isolated instance handles practice. Hidden workspaces are inert and ignore
  global undo shortcuts. Returning restores the user's model, settings, selected
  element, undo history and results. Loading another exercise confirms replacement
  of practice alone. Lesson navigation preserves practice work.
- Stable `data-control` identifiers drive guidance to actual editor controls.
  Documentation guidance selects a real element and opens its existing Properties
  section. Both editors have distinct panel, outcome, datalist, SVG marker and
  React Flow accessibility IDs.
- Exercises use canonical GERT models, the existing import/export pipeline and real
  API validation/simulation responses. The standalone practice format and simulator
  are not embedded. A reading checkbox cannot bypass a practical checkpoint.
  Replay checks compare full returned reports; theory is distinct from sampled
  estimates. The cutoff variant is available in the rework lesson.
- Only completed lesson IDs are stored under `gert-studio:tutorial-progress:v1`.
  They record past accomplishments, not correctness of later edits. Model data and
  results remain in memory and require Export JSON. Storage failures leave session
  progress usable. Progress is scoped to the browser origin; another browser or a
  new portable-host port may have different progress. Existing panel preferences
  keep their independent storage path.
- The full [tutorial](TUTORIAL.md), README entry point and real application captures
  are included. Static lesson content is compiled into semantic React data in
  `frontend/src/tutorial/lessons.ts`; arbitrary HTML/scripts never execute. The guide
  loads in a separate JS/CSS chunk when opened. No dependency changes were needed.

The backend application, mathematical/product specifications, RNG, reporting
methods, package manifests/lockfile, Windows packaging code/configuration and release workflow remain
unchanged. A future Windows package includes the changed frontend assets, including
the new lazily loaded tutorial JavaScript and CSS, so its bundled bytes will change. Tutorial tests use the existing methods rather than implementing new
statistics. The rework, synchronization, consumables and limit examples retain the
current engine's positive-input and inclusive atomic-limit semantics.

**Validation**

Current host: Linux, Python 3.12.14, Node 22.19.0, Playwright 1.63.0, system
Chromium 151.0.7922.173. Both API and Vite services ran locally. Browser tests used
system Chromium through the existing cloud override at
`/workspace/.gert-setup/playwright.config.ts`, which inherits the repository's test
settings and changes only the executable and absolute output/test directories.

| Check | Result |
| --- | --- |
| `PYTHONPATH=backend:packaging/windows .venv/bin/python -m pytest backend/tests packaging/windows/tests -q -p no:cacheprovider` (repository root) | 207 passed, 2 Windows-only skipped |
| `npm test` (frontend) | 143 passed in 9 files |
| `E2E_BASE_URL=http://127.0.0.1:8010 npm run test:e2e -- --config=/workspace/.gert-setup/playwright.config.ts` (frontend) | 20 passed against production assets and the portable app host, one worker |
| `npm run build` (frontend) | TypeScript and Vite production build passed |
| `git diff --check` | Passed |

The browser suite includes all nine pre-existing scenarios plus eleven tutorial/API
scenarios. Earlier Vite validation passed all 19 then-existing scenarios; final
validation exercises the production build and portable host instead. The tests exercise:

- Original project preservation including exact large seeds, unchanged exported
  model/result snapshot, selection, settings and original undo history. Practice
  replacement can be declined. Both canvas DOMs have unique IDs.
- Actual node/duration/outcome documentation controls and association navigation;
  notes remain off the canvas. Canonical note export/import and documentation-only
  seeded full-report invariance pass.
- Unknown distribution and probabilities, valid non-executable drafts, partial
  parameters, explicit zero, malformed known values, and independent edits while
  probabilities are unknown (including filling the last unknown). Simulation is
  unavailable until complete; backend incomplete requests return 422.
- Model-only and versioned result-snapshot exports; imported results restore without
  a simulation request. Validate, settings/model edits and Undo clear results;
  resizing panels preserves the snapshot. Consistency validation is not report
  authentication or recomputation.
- Actual completion of documentation, draft, snapshot, uncertainty, replay, rework
  and cutoff checkpoints. An uncertainty checkpoint requires observing the one-run
  case before the ten-run case. A first seeded run alone cannot pass replay.
- Keyboard navigation/focus, progress after refresh, no practice-model restoration
  after refresh, 390px width without document overflow, and control guidance on
  narrow layouts.

| Numerical checkpoint | Verified behavior |
| --- | --- |
| Deterministic inspection | Every terminal time is 2; at n=1 population SD is 0 and sample SD/SE/mean CI are unavailable; at n=10 both SDs and SE are 0 and Student-t CI is [2,2] |
| Rework, p=0.8, inspection 2, repair 3 | Every sampled terminal path satisfies T=2+5K, Inspection starts K+1, Rework starts K; 1000-run estimates agree with unlimited theoretical means 3.25, 1.25 and 0.25 under the stated tolerances |
| Horizon 7 | Terminals occur at 2 or exactly 7; the remaining observed status is time cutoff. Acceptance is within five binomial SEs of theoretical 0.96; durations condition on terminal samples |
| Inclusive count/time budgets | Exact time 2 and count 2 permit completion; lower budgets produce their specific cutoff status; over-budget three-instance launch admits none |
| Consumable quantities | Bolt 9, Plate 3 with requirements 2 and 1 starts 3 instances, leaving Bolt 3, Plate 0 |
| Same-definition concurrency | Three Components start/complete three Inspections, then Deadlock without terminal duration data |
| Parallel synchronization | Durations 3 and 5 followed by Integration 1 finish at 6; shared single-request competition selects no winner |
| Beta-PERT (1,2,4,lambda=4) | The sampled 1000-run mean is within 0.1 of theoretical 13/6 |
| Uncertainty examples | 80/100 gives SE 0.04 and Wilson bounds about 0.711–0.867; zero/all successes retain nontrivial Wilson bounds. Times 2 and 7 give population SD 2.5, sample SD about 3.54, mean SE 2.5, and a labeled support-clipped Student-t interval about [0,36.3]; small-sample extreme quantile bounds are unavailable |

**Application captures**

- [Desktop tutorial and results](tutorial-screenshots/tutorial-desktop.png)
- [Selected Inspection documentation](tutorial-screenshots/tutorial-documentation.png)
- [Narrow tutorial and actual practice editor](tutorial-screenshots/tutorial-narrow.png)

These are full-page screenshots captured by the real Chromium tests, using desktop
1440×1000 and narrow 390×844 viewports. They were visually inspected again during final review. Normal test runs now save
screenshots under ignored test output without rewriting tracked documentation. To
refresh these captures explicitly, set `TUTORIAL_SCREENSHOT_DIR=../docs/tutorial-screenshots`
when running from `frontend`. Screenshot hashes were checked before and after the
final normal browser run to confirm the tracked captures stayed unchanged.

**Final review and production hosting**

Three defects found in review were fixed. Reference links now open separately with
`noopener noreferrer`, preserving the unsaved original project and practice network.
Unit and real-browser regressions cover the link attributes and retained project.
Screenshot tests previously rewrote tracked documentation images during normal
verification, potentially dirtying release-source checkouts; they now use test
output unless the explicit capture option is provided. A repeated production-host
run exposed a third test-isolation defect: the resize test assumed default sizes
even when the native host correctly restored prior preferences. It now explicitly
uses Reset layout before asserting exact resize values, so repeated runs exercise
the same behavior without deleting or bypassing saved preferences.

Final source review covered editor extraction against the original App, workspace
isolation and inactive shortcuts, actual-control selection, current-model validation
and result evidence, null preservation, replay, progress-only storage, all component
changes, complete lesson content, documentation and screenshots. No simulator,
statistical method, RNG or model schema was added or changed.

The production host was constructed from `packaging/windows/launcher.py:make_app`,
with real `frontend/dist` files, native panel-preference metadata and persistence,
and the shared API. This exercises the same static-asset routing used by the
portable Windows app without claiming to execute a Windows binary. A fresh browser
context blocked every non-loopback request before initial load, then opened the
lazy tutorial, completed an exercise through the real API and returned to the
unchanged project. No external requests or page errors occurred.

To reproduce the extra host check after `npm run build`, run from the repository
root in a separate terminal:

```sh
PYTHONPATH=backend:packaging/windows .venv/bin/python - <<'PYHOST'
from pathlib import Path
import uvicorn
from launcher import make_app
app = make_app(Path('frontend/dist').resolve(), 'local-review-control', lambda: None,
    preferences_path=Path('/tmp/gert-tutorial-review/panel-layout.json'),
    origin='http://127.0.0.1:8010')
uvicorn.run(app, host='127.0.0.1', port=8010)
PYHOST
```

Then run the browser command in the validation table. The cloud Playwright override
uses `/usr/bin/chromium`; other developer machines can use the repository config
and its installed Playwright Chromium instead.

**Windows scope and merge decision**

This change affects Windows package **contents**, because the release bundles the
production frontend, including the new tutorial chunks. It does not change the
launcher, PyInstaller specification, build scripts, dependencies, release workflow,
or OS-specific locking/socket logic. The existing specification recursively includes
`frontend/dist`; production-host/offline tests confirm the new chunks are served.

No additional Windows-specific check is required before merging this frontend-only
change on the evidence above. That is a source-merge judgment, not Windows artifact
certification. Before the next Windows release, rebuild the exact approved source,
run packaged lifecycle/API/parity/browser checks (including opening the tutorial
offline, returning to unsaved work and checking native panel preferences), and
complete the repository's clean-machine/standard-user Windows acceptance checklist.
Do not reuse a prior ZIP's acceptance result for these changed frontend bytes.

**Blocked or unperformed checks**

- Windows EXE/PyInstaller build, GUI lifecycle, OS-specific locking/socket tests,
  exact packaged/native Windows comparisons and clean-machine/standard-user checks:
  not performed because this host is Linux. The two platform-specific Python cases
  remain skipped. These are release gates, not new source-merge blockers here.
- Optional Docker image rebuild: not performed because Docker configuration and
  dependencies did not change; native development and production-host paths pass.
- GitHub API/PR creation and live release-note/asset verification: the egress proxy
  denies the CONNECT request to `api.github.com` with HTTP 403 before GitHub receives
  it, even when the command runs outside the filesystem sandbox. Existing Git HTTPS
  proxy access successfully verifies repository/main/tag refs. The missing
  `api.github.com` network addition was saved to the environment draft; saving does
  not activate it. Apply the network setting to unblock the API operation; no new
  token has been requested or copied. Branch push is attempted independently.
- Main merge, website publication, Windows release creation and release workflows:
  intentionally not performed under the user's delivery scope.

The existing Starlette/httpx deprecation and Vite's >500 kB chunk warning remain
nonblocking. The main production JS is approximately 510 kB (166 kB gzip); the
separate tutorial chunk is approximately 116 kB (33 kB gzip). No Windows release
or publication readiness is inferred from these Linux checks.
