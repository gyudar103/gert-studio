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
| Normal GUI launch and automatic default-browser handoff | Passed on development host; Chrome loaded the packaged loopback URL |
| Normal launcher process elevation | Not elevated; checked the running process token |

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

### Desktop acceptance follow-up

The unchanged final ZIP was checked again: 22,245,849 bytes, SHA256
`cf8a85d022ea4354de780fff4ade0644b4cb5a368f1024f524cd71609773ac8d`.
Its clean build source remains `f2037d5c0fc61901bf02b8cb669dfa7fcf6006ab`;
this follow-up changes only the verification documentation.

The extracted EXE was launched normally, with no diagnostic flags. Its control
window appeared and Chrome automatically opened the matching loopback URL. The
browser accessibility tree confirmed the GERT Studio workspace loaded. Inspection
of the running process token confirmed it was not elevated. The representative
simulation response matched the previously verified result exactly. Programmatic
shutdown removed the instance state and closed the listener.

Desktop automation could read the browser but could not deliver the attempted
Load demo click: it reported `coordinate input geometry is unavailable`. Explorer
activation also failed. Therefore these observations do not establish double-click
launch, interactive Exit confirmation or a complete manual acceptance run. No
application failure was inferred from the desktop tool failure. Evidence is in
`dist/windows-interactive-followup.json`.

## Verified on clean Windows Sandbox

Windows Sandbox was enabled with administrator consent and the required host restart
was completed manually. The guest is Windows 11 Enterprise x64, build 26100.9550;
the host Sandbox client is version 0.8.107.0. The older ProductName registry value
says Windows 10, but the guest operating-system caption and build identify Windows 11.

The existing release ZIP above was copied into the guest and extracted into a
profile directory containing spaces and Hebrew characters. No Python, Node/npm,
Git, Docker or development tools were installed in the guest. Runtime command
inventory was empty. Networking was disabled in the Sandbox configuration and
the guest had no network adapters. Only the release ZIP, OS-only verification scripts,
expected JSON responses and an evidence directory were shared; no host runtime or
repository dependency directories were mapped.

The checks passed both under Sandbox's default elevated account and under the new
standard local account `GertAcceptance`, whose test process was not elevated:

- ZIP checksum, extraction and every bundled-file hash.
- Actual packaged GUI-process startup, backend health and production asset hashes.
- Exact complete responses for all 11 simulation scenarios (1,352 realizations),
  including fixed, uniform, triangular and six Beta-PERT variants, outcome draws,
  parallel/rework and documented models. Expected responses were independently
  matched to the previous native/packaged/Docker comparison.
- Exact draft-validation and missing-input rejection responses (13 API cases total).
- Duplicate launch reuses the original process.
- Graceful programmatic shutdown removes state, exits the process and closes its
  listener; offline relaunch and a second shutdown also pass.
- Logs are created in the user's `AppData/Local/GERT Studio` directory and the
  successful runs contain no unexpected dependency or runtime errors.

The artifact build commit is `f2037d5c0fc61901bf02b8cb669dfa7fcf6006ab`; the packaging
branch at testing was `25e7699f4283b47d55be656d83182398e9c1aa86`, incorporating main
`d8393058022b8a2c77a4b5e0c331a5719f8b906a`. Engine `0.1.1` and reproducibility
`gert-v2-py312-sha256-mt19937-crmath1` match the verified responses.

An initial guest test stopped the second process after health answered but before
the launcher's own readiness check finished. This produced an exit-code-1 timeout.
The harness was corrected to wait for that process/port's Ready log entry before
requesting shutdown. Repeated elevated and standard-user runs passed without any
application or release-artifact change. The initial failure evidence is retained.

Local evidence is under `build/clean-windows/evidence`: `guest-result.json` and
`launcher.log` contain the successful standard-user run; `admin-guest-result.json`
and `admin-launcher.log` preserve the elevated run; `initial-guest-result.json` and
`initial-launcher.log` preserve the harness timing failure. These are generated,
ignored files, not source-controlled release artifacts.

## Not yet verified / remaining release gates

Interactive acceptance inside the clean guest remains pending: double-click launch,
automatic default-browser handoff, complete browser rendering, UI model creation or
import, current editing features, result presentation/export, and the Exit confirmation.
The equivalent developer-host browser suite passed, but that does not replace these
guest observations. Desktop automation currently reports `failed to activate captured
window` after refreshing and retrying the Sandbox window; the guest remains running.

Other Windows versions, read-only extraction folders and clean-machine security
software/signing behavior are not yet verified. No application change has been made
during this Sandbox validation. The ZIP remains byte-identical to the tested release.

No application or numerical change is outstanding. Main remains unchanged; this
branch is for review and clean-machine validation, not an automatic merge/release.

NOT READY — BLOCKERS REMAIN
