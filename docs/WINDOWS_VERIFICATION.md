# Windows distribution verification — 2026-09-22

## Status

The Windows portable build works on the development host and is ready for code
review. It is **not ready for release/merge against all requested acceptance
criteria**. Exact cross-distribution Beta-PERT results differ, and a genuinely
clean Windows machine has not been tested. No engine or specification change was
made to hide either limitation.

## Verified main baseline

`main` and GitHub `origin/main` both point to
`07e0744e7079e7b3ae5ecee85219efeaba60b4b2`.
The working tree was clean before packaging. A fresh fetch, branch ancestry,
actual code and tests confirmed every local feature branch was already included;
no merge or extra main commit was necessary. `git push origin main` reported
everything up to date; `git ls-remote` confirmed the same remote hash.

Confirmed undo (Ctrl+Z and Cmd+Z), atomic drag/probability undo, sibling probability
adjustment, three-significant-digit results and independent full-precision toggles.
The backend directory is identical to the completed backend baseline `bd45d73`.
Baseline tests ran on main before the push:

| Check | Result |
| --- | --- |
| Docker backend | 87 passed |
| Docker frontend | 68 passed |
| Docker browser suite | 5 passed |
| Production frontend | Build passed |
| Docker build/start | Both services running |

Packaging development is isolated on `codex/windows-standalone`; it has not been
merged into main. Application source, Docker configuration, MODEL.md and PRODUCT.md
are unchanged relative to the verified baseline.

## Architecture and files

PyInstaller 6.22.3 one-folder/windowed distribution bundles Python 3.12.14, imported
backend dependencies, Tcl/Tk and the production frontend. The same-process server
binds to an OS-selected loopback port. The small control window opens the browser
and provides an explicit exit. An OS-owned lock prevents duplicate servers; logs
and readiness state are stored in the user's LocalAppData directory.

- `build-windows.ps1`: developer entry point.
- `packaging/windows/build.py`, requirements and constraints: isolated build,
  locked dependencies, tests, manifest, license collection and ZIP checksum.
- `launcher.py`, PyInstaller spec and version resources: portable runtime host.
- `tests/test_host.py`: static/API dispatch, failure handling and lock tests.
- `verify.py` and `verification-project.json`: actual EXE lifecycle/simulation
  verification and strict optional Docker comparison.
- `verify-browser.ps1`, `verify-offline.cjs`: existing browser suite plus a check
  with external browser HTTP requests blocked.
- End-user README, third-party notices/licenses and developer instructions.
- Repository README links and an ignored build virtual environment.

## Directly verified on Windows

Host: Windows 11 build 26200, x64. Python 3.12.14; Node 22.19.0; PyInstaller 6.22.3.
Build artifacts are generated under `dist/GERT-Studio-Windows/` and
`dist/GERT-Studio-Windows.zip`, with a `.sha256` file and build manifest.

| Check | Result |
| --- | --- |
| Original backend tests on Windows | 87 passed |
| Packaging tests | 8 passed |
| Frontend tests on Windows | 68 passed |
| Production frontend build | Passed; same asset filenames/content as Docker build |
| Frozen Windows package | Built successfully |
| Real EXE API health and production assets | Passed |
| Graphical control-window startup and programmatic graceful stop | Passed |
| Three simultaneous additional launches | Reused original PID/port |
| Repeated seeded project simulation | Exact equality within Windows |
| Frozen versus unfrozen Windows engine result | Exact full JSON equality |
| Existing Playwright suite against packaged production frontend | 5 passed |
| Browser demo with all non-local requests blocked | Passed |
| Graceful exit | Process exits; state removed; listener closed |
| Recovery after forced process crash | Passed |
| Final Docker rebuild/start and backend suite | Passed; 87 tests, both services running |
| Exact packaged Windows/Docker comparison | **FAILED: Beta-PERT numerical differences** |

The EXE checks use a working directory unrelated to the application, a state
directory containing spaces and Hebrew characters, PATH reduced to Windows
System32, and no inherited Python/Node environment overrides. The artifact includes
`python312.dll`, Pydantic's native extension, Tcl/Tk DLLs and libraries, the MSVC
runtime and UCRT DLLs. No external Python, Node, Git or Docker process is needed
by the launcher. The application source never invokes such processes.

Generated local evidence: `dist/windows-verification.json`,
`dist/windows-verification.log`, `dist/windows-browser.png`, and the two full result
files written by the failing cross-distribution comparison. These are build output,
not committed fixtures. Build manifests record the actual source revision and
whether the checkout was dirty.

## Reproducibility blocker

With the committed fixture, 100 realizations, seed 20260914, engine 0.1.0 and
`gert-v1-py312-sha256-mt19937`, the unchanged Windows engine differs from Linux
Docker in three Beta-PERT sampled durations:

| Realization (zero-based) | Activity | Windows duration | Docker duration |
| --- | --- | --- | --- |
| 30 | test | 1.40247878168246881 | 1.40247878168246872 |
| 44 | test | 1.16279798470297099 | 1.16279798470297096 |
| 48 | test | 1.9992607505708026 | 1.99926075057080245 |

Windows terminal mean: `8.286949813697755340440365673796623`.
Docker terminal mean: `8.286949813697755337740365673796623`.
Status totals, terminal counts and activity counters are equal for this fixture.
This is not proof that last-bit differences can never affect ordering or terminal
classification for other models. The exact-time engine intentionally preserves
these differences instead of rounding them away.

Both environments use Python 3.12.14. The difference also appears when calling the
unfrozen Windows engine directly, and the frozen result exactly matches that
unfrozen result. This isolates the issue from PyInstaller and the new HTTP host.
Platform-specific numerical behavior in Python's Beta-PERT sampling path is the
suspected cause; identifying the exact native math operation requires further
investigation. No sampler replacement, changed reproducibility version, tolerance,
or reduced assertion was introduced.

Reproduce using the strict command in WINDOWS_DISTRIBUTION.md. Under the user's
instruction to report any needed simulation/reproducibility change before
implementing it, resolving this blocker requires a separate explicit decision
about cross-platform numerical compatibility. The packaging implementation can
be reviewed independently; the release gate remains failed.

## Not yet established

- A clean Windows VM/Sandbox without developer tools was not available or used.
  Windows Sandbox is not present on this host. A scrubbed environment is not a
  substitute for a fresh OS test.
- Default-browser auto-opening and the user's manual Exit confirmation were
  implemented but not manually observed; automated runs suppress browser opening
  and exercise the same graceful-stop path programmatically.
- Windows 10, other Windows builds, non-admin fresh accounts, read-only extraction
  folders, antivirus/SmartScreen behavior and publisher signing remain unverified.
- The offline test blocks external browser requests; it is not a disconnected-VM
  test of the entire OS. No remote app assets or services were requested.

The clean-machine procedure is in WINDOWS_DISTRIBUTION.md. The package must pass
that procedure and receive a resolution to exact cross-distribution sampling
before claiming the full requested acceptance criterion.
