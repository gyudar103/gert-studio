# Windows refresh verification — 2026-10-01

Source-of-truth main: `d8393058022b8a2c77a4b5e0c331a5719f8b906a`.
Previous packaging branch/build: `e148ec3a4673d9ecabf5a3ebb148bfbb169e1241`.

After fetching, local main and origin/main matched. The working tree was clean;
packaging was zero commits ahead and six behind. Integration fast-forwarded
`codex/windows-standalone` to origin/main, then restored only the packaging layer
removed by main's earlier revert. No merge conflicts or history rewriting occurred.
Main's application, specifications, dependencies and Docker files are preserved.

Incorporated commits:

- `2dec8e7`: deterministic Beta-PERT and triangular numerical primitives, v2 RNG metadata.
- `c16e477`: merge of the reproducibility fix.
- `758fbe7`: revert of the original packaging files (restored on this branch).
- `1f5f530`: documented models and explicit incomplete drafts.
- `3001241`: detailed draft-model review report.
- `d839305`: independent implementation verification.

New main behavior includes node comments/assumptions/certainty/explanations;
duration and outcome rationale/references/notes; association navigation; explicit
unknown durations, parameters and probabilities; compact incomplete indicators;
draft import/export and readiness diagnostics; simulation rejection for missing
inputs; and probability editing that preserves unknown siblings. Notes remain
outside simulation semantics. Existing undo and precision presentation are retained.
API paths are unchanged, while validation/OpenAPI now expose DraftModel and readiness.
Runtime dependency files and Docker configuration have no changes since the old build.

The existing PyInstaller folder, same-process Python server, loopback port, browser
opening, per-user lock, logs, exit and recovery architecture remain unchanged.
Packaging updates add scoped output cleanup, current engine/source provenance,
the adapted sampler license, a shared backend fixture and exact three-way HTTP
verification. The original browser suite can now also target native Windows.

## Verified

Host: Windows 11 build 26200, x64; CPython 3.12.14 (MSC v.1944), Node 22.19.0,
PyInstaller 6.22.3. Docker: Linux x86_64/glibc 2.36, CPython 3.12.14 (GCC 12.2).
Application metadata: engine `0.1.1`, reproducibility
`gert-v2-py312-sha256-mt19937-crmath1` on all three execution paths.

| Check | Result |
| --- | --- |
| Complete backend suite, native Windows | 147 passed |
| Complete backend suite, Docker | 147 passed |
| Windows packaging suite | 10 passed |
| Complete frontend unit suite, native Windows | 73 passed |
| Complete frontend unit suite, Docker | 73 passed |
| All browser/E2E tests against packaged EXE | 6 passed |
| Same browser/E2E tests against native Windows | 6 passed |
| Browser/E2E suite in Docker | 6 passed |
| Fresh Windows and Docker production frontend builds | Passed; matching assets |
| PyInstaller folder and ZIP | Built; actual EXE smoke checks passed |
| Docker rebuild/startup | Passed; backend and frontend running, health OK |
| Packaged/native/Docker HTTP parity | Exact in all 11 scenarios, 1,352 realizations per environment |
| Native Windows/Linux sampler probe | Exact: 9,216 durations, full demo and invariance checks |
| Graphical launcher startup/lifecycle | Passed with browser auto-opening suppressed |
| Offline browser demo, packaged and native | Passed with non-local requests blocked |
| Runtime-path isolation | Passed |

The HTTP scenarios include fixed, uniform, triangular and six Beta-PERT cases
(interior/endpoint modes and small/large shape values), probabilistic outcome
draws, complete parallel/rework and documented parallel/rework simulations.
Every response is compared without tolerance: realizations, timestamps, outcomes,
inventory, counters, aggregates, diagnostics and metadata. Health and OpenAPI
responses match too. Both Windows hosts serve byte-identical production assets.
Incomplete drafts validate equally and receive identical 422 simulation rejection.
There was no first divergent value: all comparisons passed.

The native Windows/Docker probe also verifies worker counts 1/4, reordered IDs with
renamed labels/UI metadata, and the first 100 runs of 125. Its current canonical
results SHA256 is `4b8382154157f67fa6c945c0be5d322890e5e435b6fd845fdad0528dcc47dc10`.
This differs from the older report's hash because current validation payloads
include draft/readiness fields; Windows/Linux current responses are exactly equal.
The former v1 Beta-PERT blocker is resolved by main's v2 implementation.

Browser verification explicitly exercised:

- Node documentation fields; duration and outcome notes/references/certainty.
- Actual canvas selection, outcome focus and node/activity association links.
- Unknown distribution, partial parameters and probability nulls; Incomplete and
  draft-valid indicators; disabled simulation until completion; explicit zero.
- Export/import of notes and null drafts, partial drafts and complete networks;
  invalid-import rejection and exact numeric-token preservation.
- Documentation/placeholder undo, Ctrl+Z, Cmd+Z, atomic drag/probability undo.
- Sibling probability adjustment, three-significant-digit results and independent
  exact-precision toggles without rerunning simulation.
- Creating a network through forms/connections, demo simulation and seeded replay.

The packaged archive was inspected: `app.engine.beta`, `app.engine.binary64`,
`randomness`, current schemas and API adapters are present. The build manifest
records current backend source hashes and the engine versions verified over HTTP.
The PE subsystem is Windows GUI (2), not a console executable. Required Python,
Pydantic, Tcl/Tk and runtime DLLs and the new sampler license are included.

Isolated EXE tests used PATH containing only Windows System32, no inherited Python
environment overrides, an unrelated working directory and a Unicode/space-containing
state path. Three simultaneous extra launches reused the original process/port.
Stop closed the listener and removed state; forced-crash recovery succeeded.
Live process inspection found 67 loaded modules, no backend child processes and
one listener on `127.0.0.1`. Modules came from the package or Windows except one
Microsoft-signed Defender `MpOav.dll` under ProgramData. Its Authenticode signature
was verified as valid/Microsoft; it is host security software, not an external
Python/Node dependency. No Python, Node, Git or Docker child process was used.

An initial sandboxed pytest run could not access pytest's temporary directory;
the authorized rerun passed all 157 native tests unchanged. Initial DLL inspection
flagged the Defender module outside the Windows directory; it was explicitly
identified and signature-verified, not omitted from the evidence. Existing
Starlette test deprecation warnings and the previously reported development-only
Vitest advisory remain outside this packaging update; see INDEPENDENT_REVIEW.md.

## Artifact and evidence

The final clean-source build is `dist/GERT-Studio-Windows.zip`, containing
`GERT-Studio-Windows/GERT Studio.exe` and its required files. The neighboring
`.sha256` and internal `build-manifest.json` record the exact artifact checksum
and source commit. The completion report records the final size and pushed branch
hash. Generated binaries, reports and ZIPs are ignored, not tracked in Git.

Local generated evidence includes `dist/windows-verification.json`,
`dist/windows-parity.json`, `dist/windows-runtime-inspection.json`, launcher logs,
`dist/windows-draft.png`, and the native/Docker probe JSON files under `build/`.
The build clears its own frontend/PyInstaller/release outputs before recompiling;
no previous frontend asset or packaged backend is reused.

## Not yet verified / remaining release gates

A genuinely clean Windows machine was not available or used. Windows Sandbox is
absent on this host. PATH isolation, bundled-module inspection and blocked browser
network requests are development-host evidence, not proof on a fresh OS.

The remaining gate is to test the final ZIP on a clean supported Windows machine
without development runtimes, using a standard user: extract, double-click, observe
automatic default-browser opening and no UAC requirement, create/import a documented
model, simulate and inspect results, export, manually exit, confirm shutdown,
relaunch and repeat offline. Record OS version, architecture and artifact checksum.
Other Windows versions, read-only extraction folders and clean-machine security
software/signing behavior are not yet verified. Automated GUI runs suppress
automatic browser opening and invoke graceful stop programmatically; manual
default-browser handoff and Exit confirmation belong to that acceptance procedure.

No application or numerical change is outstanding. Main remains unchanged; this
branch is for review and clean-machine validation, not an automatic merge/release.

READY FOR CLEAN-MACHINE RELEASE VALIDATION
