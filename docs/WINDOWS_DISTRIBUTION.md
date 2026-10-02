# Portable Windows distribution

The Windows portable folder is the primary distribution. Optional Docker runs the
same GERT Studio application and is not required for normal release acceptance.
The Windows launcher bundles Python, the backend and production frontend; ordinary
users need no Python, Node, npm, Git, Docker, build tools or administrator access.
There is no cloud dependency. See [verification status](WINDOWS_VERIFICATION.md)
for recorded evidence. Fresh-machine verification is reported separately for each
artifact; developer-host checks do not establish it.

## Use

1. Extract the entire `GERT-Studio-Windows.zip`.
2. Double-click **GERT Studio.exe**.
3. GERT Studio opens in your browser.

Keep the small control window open. Use Export JSON to save a model or incomplete
draft, including notes. Import JSON restores it. Supply all missing simulation
inputs before running. Export before refreshing or closing the editor. Use
**Exit GERT Studio** in the control window to stop the backend. Closing a browser
tab does not stop it. Repeat launches reuse the server; separate browser tabs
have independent in-memory editor state. Keep `_internal` alongside the EXE.

Windows 10/11 x64 with a browser is the intended target. The tested developer host
is Windows 11 x64; other OS versions and a fresh standard-user account require
release validation. The build is unsigned; follow your organization's normal
software policy. Do not run directly from inside the ZIP.

## Build

Build-time prerequisites: Windows x64, Python 3.12 with pip and Tcl/Tk, Node 22 with
npm on PATH. Git records the source revision but is not needed by the EXE.
The tested build tools are Python 3.12.14, Node 22.19.0 and PyInstaller 6.22.3.
Network access is needed to install dependencies, not to run the finished app.

From the repository root:

```powershell
.\build-windows.ps1 -Python 'C:\Path\To\Python312\python.exe'
```

Optional `-Npm 'C:\Path\To\node\npm.cmd'` supports a portable build-time Node
installation; put its directory on PATH too. If PowerShell scripts are restricted:

```powershell
C:\Path\To\Python312\python.exe packaging/windows/build.py --npm npm.cmd
```

The script creates `.venv-windows`, installs shared backend requirements with the
Windows constraints, removes its owned generated outputs, runs all backend and
packaging tests, runs `npm ci`, frontend unit tests and a fresh production build,
then builds the PyInstaller folder. It includes license texts and a manifest,
runs actual EXE lifecycle/simulation checks and creates the ZIP and SHA256.
No Docker command is used by this build.

Only `frontend/dist`, `build/gert-studio`, `dist/GERT-Studio-Windows`, its ZIP and
checksum are cleared. Resolved paths are checked before deletion. Other build
directories, downloaded tools and unrelated workstreams are preserved. Close
running copies before rebuilding. A failed build must not be replaced by a stale ZIP.

Outputs:

```text
dist/GERT-Studio-Windows/GERT Studio.exe
dist/GERT-Studio-Windows/_internal/
dist/GERT-Studio-Windows/README.txt
dist/GERT-Studio-Windows/LICENSES/
dist/GERT-Studio-Windows/build-manifest.json
dist/GERT-Studio-Windows.zip
dist/GERT-Studio-Windows.zip.sha256
```

For release, build from a clean committed checkout. The manifest records source
commit/dirty status, Python/tool/dependency versions, engine/reproducibility versions,
backend source hashes and bundled file hashes. The checksum detects file changes;
it is not a publisher signature. Generated binaries and ZIPs stay out of normal Git.

## Architecture and compatibility

PyInstaller one-folder/windowed mode bundles CPython and imported dependencies,
Tcl/Tk and Vite's production output. It avoids repeated runtime extraction and
keeps diagnostics accessible. The launcher imports the shared FastAPI app unchanged,
dispatches existing API/OpenAPI/docs routes, and serves static assets on the same
origin. No frontend, schema, engine or Docker rewrite is involved.

Uvicorn runs in a thread in the same process as the control window. An exclusively
reserved OS-assigned port binds only to `127.0.0.1`. An OS-owned per-user lock prevents
duplicate servers, including concurrent launches. Local authenticated launcher
endpoints support readiness and graceful stop. Readiness state is written atomically
in `%LOCALAPPDATA%\GERT Studio`; a new lock owner removes stale crash state.

Panel sizes alone persist in `panel-layout.json` in that per-user directory through
the portable host's `/api/ui-preferences/panel-layout` bridge, so a new loopback
port on restart does not lose the preference. The bridge accepts only bounded,
versioned numeric panel sizes, validates same-origin writes, and replaces the file
atomically. Browser-only deployments use localStorage. Model data, canvas positions,
simulation settings/results, and Undo history are not persisted by this bridge.

Exit waits for active requests to finish; a long simulation can delay shutdown.
No browser-tab or idle timeout discards active work. Unsaved editor state is not
persisted by the launcher. If the frontend cannot reach the backend, check that
GERT Studio is running; relaunch the EXE if necessary.

The engine/reproducibility version is read from current source at build time and
checked against the actual packaged HTTP response. The 2026-10-01 baseline uses
engine `0.1.1` and `gert-v2-py312-sha256-mt19937-crmath1`. The deterministic numerical
implementation and its CPython license are included. Historical v1 replay still
requires its original engine/environment. No packaging-specific rounding is used.

NumPy/SciPy remain shared development dependencies, but the current engine imports
neither. Unused NetworkX accelerators and pytest are excluded from the bundle;
packaged tests exercise this configuration. Required native extensions are bundled.

## Verify

With the build environment installed, run source suites independently:

```powershell
$env:PYTHONPATH = "$PWD\backend;$PWD\packaging\windows"
.venv-windows\Scripts\python.exe -m pytest backend/tests packaging/windows/tests -q -p no:cacheprovider
```

Actual EXE tests, with runtime paths scrubbed, Unicode state directory, duplicate
launches, seeded simulation, graceful stop and crash recovery:

```powershell
.venv-windows\Scripts\python.exe packaging/windows/verify.py --gui
```

Exact packaged/native Windows HTTP comparisons, including all duration families,
outcome draws, full simulations, engine versions, frontend assets, draft validation
and missing-input rejection:

```powershell
.venv-windows\Scripts\python.exe packaging/windows/verify-parity.py
```

Optionally add Docker/Linux as a third participant; this is non-blocking unless
Docker behavior changes:

```powershell
docker compose up --build -d
.venv-windows\Scripts\python.exe packaging/windows/verify-parity.py --docker-url http://127.0.0.1:8000
```

Comparison uses full JSON equality, including every realization and aggregate.
On a mismatch it records the first differing path in `dist/windows-parity.json`
and fails. Never resolve discrepancies with rounding, tolerances or semantic edits.
The backend's broader sampler probe is described in REPRODUCIBILITY_REPORT.md.

Install Chromium once (`cd frontend; npx playwright install chromium`), then run
all current browser tests against the actual package plus an external-network-blocked
demo check:

```powershell
.\packaging\windows\verify-browser.ps1
```

`-Node` and `-BrowserPath` accept local test-tool locations. Add
`-NativePython "$PWD\.venv-windows\Scripts\python.exe"` to run the identical browser
suite against the unpackaged Windows host. Each invocation starts/stops its own
isolated application. The suite includes documented drafts, placeholders and undo,
as well as model creation, import/export, probability adjustment and result toggles.

Docker remains separately supported with the unchanged README workflow and tests.

## Release identity and publication

The next feature release uses tag `v0.2.0`, following the existing `v0.1.0` convention,
and is published as a Windows preview (GitHub pre-release). Product/file version
0.2.0 is separate from engine 0.1.1 and the unchanged reproducibility version.
Build from an immutable clean candidate, verify the actual package and exact
source/package results, and independently review that candidate plus ZIP SHA-256.
Publish that same reviewed ZIP and its checksum as GitHub Release assets; do not
commit generated binaries. Any changed build input requires a new candidate/build
and renewed review before publication. A fresh-machine result applies only to the
artifact actually tested, not automatically to later builds.

## Fresh-machine verification

Use a fresh Windows 10/11 x64 VM/Sandbox with a browser and without Python, Node/npm,
Git or Docker. Copy only the release ZIP. Record Windows build, architecture,
browser, artifact SHA256 and runtime inventory. As a standard user, extract it,
double-click the EXE, observe automatic browser opening, create/import a documented
draft, complete it, simulate, inspect results and save/reload JSON. Export and exit
using the control window; confirm the process/listener disappear. Relaunch and repeat
offline. Include spaces/non-ASCII in the extraction path and a read-only application
folder with a writable normal profile. Record UAC and security-software behavior.

PATH isolation and blocked external browser requests on a developer host do not
prove this gate: system DLLs and installed components can differ on a fresh OS.

## Troubleshooting

Keep the full extracted directory together. If startup fails, inspect the error
dialog and `%LOCALAPPDATA%\GERT Studio\launcher.log` (2 MB, two rotated backups).
Use **Open GERT Studio** or copy the displayed local address if no browser opens.
For an unresponsive instance, inspect logs before using Task Manager; unsaved work
can be lost. Developers may use `--headless --no-browser --state-dir PATH` and
`--headless --stop --state-dir PATH`; ordinary users need no commands.
