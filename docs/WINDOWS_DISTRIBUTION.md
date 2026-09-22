# Windows portable distribution

GERT Studio has two distribution targets from the same source: Docker and a
portable Windows x64 folder. Docker's existing `docker compose up --build -d`
workflow is unchanged. The Windows build does not use Docker.

**Release status:** packaging is under review. Exact Windows/Linux reproducibility
is blocked by a pre-existing Beta-PERT platform difference documented in
[WINDOWS_VERIFICATION.md](WINDOWS_VERIFICATION.md). Do not describe this build as
having passed the clean-machine or cross-distribution acceptance gates.

## End users

1. Extract the whole `GERT-Studio-Windows.zip`.
2. Double-click **GERT Studio.exe**.
3. Work in the browser that opens automatically.

Keep the control window open. Export JSON to save your model before refreshing,
closing the browser, or choosing **Exit GERT Studio**. The browser editor remains
in memory, as in the Docker edition. Closing a browser tab does not stop the server.
Repeat launches open the existing server; each browser tab has independent editor
state. Do not delete `_internal` or run the application from inside the ZIP.

Users need a browser and supported Windows, with no administrator privileges or
development runtimes required by the package. Windows 10/11 x64 is the intended
target; validation on a clean machine is a separate release gate. Windows ARM64
and 32-bit Windows have not been validated. There is no cloud dependency.

## Build on Windows

Developer prerequisites: Windows x64, Python 3.12 with pip and Tcl/Tk, and Node.js
22 with npm. Python 3.12 is required by the existing reproducibility version.
The tested Python patch version is 3.12.14. Git is optional for building but
required to record a verified source revision. Dependency installation requires
network access; the completed application does not.

From the repository root:

```powershell
.\build-windows.ps1 -Python 'C:\Path\To\Python312\python.exe'
```

`-Npm 'C:\Path\To\node\npm.cmd'` supports a portable Node distribution; its
directory must also be on the build process's PATH. `-Npm` additionally accepts
`npm-cli.js`. These are developer tools, never end-user prerequisites. On hosts
that restrict PowerShell scripts, invoke the Python entry point directly:

```powershell
C:\Path\To\Python312\python.exe packaging/windows/build.py --npm npm.cmd
```

The script creates `.venv-windows`, installs shared backend requirements with
Windows build constraints, runs backend and packaging tests, runs `npm ci`,
frontend tests and the production build, freezes the application, gathers license
texts and a build manifest, then exercises the actual EXE. Outputs:

```text
dist/GERT-Studio-Windows/GERT Studio.exe
dist/GERT-Studio-Windows/README.txt
dist/GERT-Studio-Windows/LICENSES/
dist/GERT-Studio-Windows/build-manifest.json
dist/GERT-Studio-Windows/_internal/
dist/GERT-Studio-Windows.zip
dist/GERT-Studio-Windows.zip.sha256
dist/windows-verification.json
dist/windows-verification.log
```

The build overwrites its generated output. Close any running copy first. Output,
build tools and virtual environments are ignored by Git. For a release, build
from a clean committed checkout and inspect `source_commit` and `source_dirty`
in the manifest. The ZIP hash checks file integrity, not publisher identity.
Builds currently are unsigned; code signing is a separate release decision.

## Architecture

PyInstaller 6.22.3 in one-folder/windowed mode bundles CPython, imported backend
dependencies, the production frontend, Tcl/Tk, and native DLLs. One folder makes
startup and diagnostics simpler and avoids extracting the entire runtime on each
launch. See [PyInstaller's operating modes](https://pyinstaller.org/en/stable/operating-mode.html).
No installer, Node runtime, compiler, or external Python installation is needed
by the resulting EXE.

`packaging/windows/launcher.py` imports the shared FastAPI application unchanged.
A packaging-only ASGI wrapper dispatches the existing `/api/*`, documentation and
OpenAPI routes and serves Vite's static `dist` output. Relative frontend `/api`
requests stay on the same origin. No engine, schema, frontend, project format,
Dockerfile or Compose changes are required.

The EXE runs Uvicorn in one thread in the same process as a small Tk control window.
It binds an exclusively reserved OS-assigned port on `127.0.0.1`, never all network
interfaces. There is no fixed-port race and no separate backend child to orphan.
An OS-owned per-user file lock prevents duplicate servers, including during
concurrent startup. Crash leftovers are discarded only by the new lock owner.
Ready-state metadata is atomically written under `%LOCALAPPDATA%\GERT Studio`.
Authenticated local launcher endpoints support identity checks and graceful stop;
their token is separate from the unchanged application API.

Closing the control window asks the user to export work and confirm exit, stops
accepting new requests and lets in-flight simulations finish. No idle/browser-tab
timeout can discard a running simulation. Large simulations can therefore delay
exit. Windows termination or a process crash cannot preserve unsaved browser work.

The engine uses standard-library random/math/Fraction and NetworkX. Although the
shared development requirements include NumPy/SciPy, the current application does
not import them. Optional NetworkX scientific accelerators and pytest
are excluded from the bundle; their absence is exercised by packaged simulation
tests. Required native extensions (such as Pydantic) are bundled by PyInstaller.

## Verification

The build automatically runs the original backend/frontend tests and packaging
tests. Its frozen-process check removes Python/Node/Git/Docker paths from PATH,
removes Python environment overrides, uses an unrelated working directory and a
Unicode/space-containing state directory, and checks health, assets, simulation,
duplicate clicks, shutdown and recovery after a forced crash.

Run it separately, including the normal control window:

```powershell
.venv-windows\Scripts\python.exe packaging/windows/verify.py --gui
```

Compare the full seeded result with the running Docker backend:

```powershell
docker compose up --build -d
.venv-windows\Scripts\python.exe packaging/windows/verify.py --compare-url http://127.0.0.1:8000
```

The fixture includes parallel execution, synchronization, all four duration
distributions, probabilistic outcomes and rework. Exact comparison includes
individual instances and full-precision aggregates; it uses no rounding/tolerance.
A mismatch fails and writes both results into `dist` for diagnosis. Currently
this check fails on Beta-PERT last-digit differences; it is not an accepted waiver.

For browser tests, launch the EXE and use the URL displayed in its window:

```powershell
cd frontend
npx playwright install chromium
$env:E2E_BASE_URL = 'http://127.0.0.1:PORT'
npm run test:e2e
```

The original tests cover model creation, import/export, simulation, undo, probability
adjustment and precision toggling against this production frontend and real backend.
Run the Docker tests separately using the commands in the main README.

Alternatively, `packaging/windows/verify-browser.ps1` starts and stops the package,
runs that existing browser suite, and verifies the demo with non-local browser
requests blocked. Pass `-Node` and `-BrowserPath` for locally installed test tools.

## Clean-machine release gate

Use a fresh Windows 10/11 x64 VM or Windows Sandbox with a browser but no Python,
Node, npm, Git, Docker or build tools. Copy **only the ZIP**, extract it as a
standard user, disconnect networking, and double-click the EXE. Validate and
simulate the demo, create a model, save/reload JSON, exercise undo and result
precision, double-click the EXE again, then export and exit. Verify the process
and listener disappear. Restart after a forced close. Repeat with spaces and
non-ASCII characters in the extraction path and a read-only application folder
with a writable normal user profile. Record Windows version, architecture, artifact
SHA256, browser, installed runtime inventory and outcomes in the verification report.

A scrubbed PATH on a developer machine is useful evidence but does not establish
this gate: system DLLs, browser availability and installed components can differ.

## Troubleshooting

- Keep the full extracted folder together. Missing frontend/runtime files require
  a fresh extraction of the release ZIP.
- Use **Open GERT Studio** or copy the displayed local URL if automatic browser
  opening fails. A default browser must be configured.
- Inspect `%LOCALAPPDATA%\GERT Studio\launcher.log`. Logs rotate at 2 MB with two
  backups; user projects are not written there. Startup errors show a dialog.
- The shared frontend's connection-error text still mentions Docker. In the
  Windows edition, relaunch the EXE; Docker is not needed.
- A second launch waits up to 30 seconds for an existing instance to become ready.
  If it is unresponsive, inspect its log and close it in Task Manager if necessary.
- Developers can use `"GERT Studio.exe" --headless --no-browser --state-dir PATH`
  for an isolated diagnostic instance and the same command with `--stop` to exit.
  Ordinary users need none of these commands.
- Do not change the sampler or truncate results to resolve cross-platform
  differences. Such changes need an explicit reproducibility/semantic decision.
