# Beta-PERT cross-platform reproducibility investigation

Date: 2026-09-23. Review branch: `codex/beta-pert-reproducibility`.
Base: `07e0744e7079e7b3ae5ecee85219efeaba60b4b2` on `main`.
Packaging remains separately at `e148ec3a4673d9ecabf5a3ebb148bfbb169e1241`
on `codex/windows-standalone`. Neither branch was merged or rewritten.

## Reproduction before implementation changes

The unmodified backend reproduced all three reported differences independently of
PyInstaller. The fixture is `backend/tests/fixtures/reproducibility-demo.json`,
copied from the packaging verification input. It models parallel mechanical and
software work, integration, testing, success/failure and a rework cycle. Settings:
100 realizations, seed 20260914, time horizon 100, instance/completion limits 1000.

The failing activity is `test`, with Beta-PERT min=1, mode=2, max=4, lambda=4.
Indices and ordinals below are zero-based. The exact shape formulas give alpha=7/3
and beta=11/3; the original binary64 inputs are `0x1.2aaaaaaaaaaabp+1` and
`0x1.d555555555555p+1` on both platforms.

| Realization / ordinal | Original Windows duration | Original Linux duration |
|---|---|---|
| 30 / 0 | 1.40247878168246881 | 1.40247878168246872 |
| 44 / 2 | 1.16279798470297099 | 1.16279798470297096 |
| 48 / 0 | 1.9992607505708026 | 1.99926075057080245 |

Original terminal-duration means were respectively
`8.286949813697755340440365673796623` and
`8.286949813697755337740365673796623`. Outcome totals and lifecycle counters
matched in this fixture; differences propagated into scheduled times and aggregate
durations. This does not establish that a timing discrepancy is harmless in other
models with terminal races or time limits.

## First divergent operation: experimentally established

The diagnostic traced raw draws, every gamma/beta algorithm line's float locals,
native sqrt/log/exp inputs and outputs, and the final conversion/scaling pipeline.
For every failing instance, keys, SHA-256 hashes, raw random draws, shape parameters,
sampler source, module constants and all preceding intermediates matched exactly.
The first difference was native `exp(v)` inside `random.Random.gammavariate`:

| Instance | Identical exp input | Windows exp result | Linux exp result |
|---|---|---|---|
| 30 / 0 | `0x1.6032eaf638ba6p-3` | `0x1.30097bfadd80ap+0` | `0x1.30097bfadd80bp+0` |
| 44 / 2 | `0x1.496f64590e281p-3` | `0x1.2cad255018e54p+0` | `0x1.2cad255018e55p+0` |
| 48 / 0 | `-0x1.1fd44faec8190p-3` | `0x1.bcded11a5c728p-1` | `0x1.bcded11a5c727p-1` |

Each difference is one binary64 ULP. For example, the first key is exactly:

```json
["gert-v1-py312-sha256-mt19937","20260914",30,"test",0,"duration"]
```

Its SHA-256 is
`90f1f280858a5b3dd56bdec2752196f54dd6974aed9c721c37b7fd096a09799e`.
The evidence fixture `backend/tests/fixtures/beta-legacy-evidence.json` records
all three keys/hashes, every consumed raw draw as hexadecimal binary64, shapes,
first divergent operation, original durations and corrected reference results.
The sampler source hash was identical on Windows and Linux:
`31285194f36a139a6dcc66afa93153e0861f2db17e47511c5f8774ae122cfcd6`.

This isolates the source below the RNG and above exact-time conversion. A different
native exp result changes a gamma variate, then the gamma ratio, then the decimal
representation of that ratio. Exact range scaling and serialization faithfully
retain that difference; neither introduces it. The source of Python's math
functions is the platform C math library, as documented by
[Python's math documentation](https://docs.python.org/3.12/library/math.html).
We did not identify a particular DLL instruction or CPU dispatch routine; the
call boundary and differing input/output bits establish the actionable cause.

## Environments

| Property | Native Windows | Docker/Linux |
|---|---|---|
| Python | CPython 3.12.14, Aug 25 2026 build | CPython 3.12.14, Sep 19 2026 build |
| OS | Windows 11, build 26200 | Linux 6.18.33.2-microsoft-standard-WSL2 |
| Architecture | AMD64, 64 bit | x86_64, 64 bit |
| Compiler | MSC v.1944 | GCC 12.2.0 |
| Native math | Windows C runtime via Python math | glibc 2.36 via Python math |
| libmpdec | 2.5.1 | 2.5.1 |
| Pydantic / FastAPI | 2.13.5 / 0.141.1 | 2.13.5 / 0.141.1 |
| NumPy / SciPy installed | 2.5.3 / 1.18.1 | 2.5.3 / 1.18.1 |

NumPy/SciPy are not used by duration sampling. No dependency versions were changed.
The old sampler was Python 3.12's standard-library gamma-ratio Beta implementation.
Both ambient Decimal contexts had precision 28, ROUND_HALF_EVEN,
Emin=-999999, Emax=999999, clamp=0, and the usual InvalidOperation,
DivisionByZero and Overflow traps. Decimal(repr(float)) was an exact construction,
so changing that context would not repair the native exp difference.

## Fix and mathematical justification

Runtime changes are confined to `app/engine/randomness.py` and the new
`app/engine/beta.py` and `app/engine/binary64.py` modules.
The adapted algorithm's Python license is retained in
`backend/app/engine/CPYTHON-LICENSE.txt`.

PERT parameters remain required, finite and explicit; lambda has no default and
must be positive. Alpha/beta are still derived from exact input fractions using
MODEL Section 15's formulas before the existing binary64 conversion. Degenerate
durations and the existing large-shape runtime guards are unchanged.

The Beta sampler retains the original Cheng rejection equations, evaluation order,
proposal exclusions, acceptance tests and shape-one exponential branch from
[CPython 3.12 random.py](https://github.com/python/cpython/blob/v3.12.14/Lib/random.py).
Only shapes >=1 are needed by PERT. Given independent unit-scale gamma variates
X and Z of shapes alpha and beta, X/(X+Z) has the intended Beta law: substituting
X=YT and Z=(1-Y)T in their joint density and integrating T leaves the Beta density.
The finite-precision implementation of that same construction is retained.
This is not a different distribution chosen because its samples happened to match.

Native log/exp/sqrt are replaced with controlled nearest-even binary64 primitives:

1. Convert the binary64 argument to Decimal exactly.
2. Evaluate the operation in a fresh explicit context, initially precision 40.
3. If exact, convert directly. Otherwise enclose the real result with the adjacent
   decimal values surrounding the correctly rounded result.
4. Convert both bounds to binary64. Return only when they agree; otherwise double
   the working precision and repeat.

Python documents correctly rounded decimal operations and exact float-to-Decimal
construction in its [Decimal reference](https://docs.python.org/3.12/library/decimal.html).
The enclosure argument determines the correctly rounded primitive result; it does
not assume that 40 digits always suffice. Exact cases are handled separately.
For the finite domains used here, increasing precision resolves rounding except
an exact midpoint; exp/log have no nontrivial rational midpoint values and exact
dyadic sqrt results become exactly representable in Decimal. No arbitrary epsilon,
output precision reduction, quantization or approximate comparison is introduced.

The same controlled sqrt is used by triangular sampling. Fixed/uniform formulas,
outcome sampling, `Decimal(repr(normalized))`, exact Fraction range scaling,
scheduling, inventories and report serialization are unchanged. The old triangular
sqrt showed no discrepancy in the tested corpus; controlling it removes the same
unnecessary native-math dependency from the supported stochastic numerical path.

## Compatibility and versioning

Engine version changes from `0.1.0` to `0.1.1`.
Reproducibility version changes from `gert-v1-py312-sha256-mt19937` to
`gert-v2-py312-sha256-mt19937-crmath1`.

This was explained before finalizing the fix: the old version already produces
two answers for the same input, so preserving both is impossible. All three
original failing streams now give their Linux baseline duration on both platforms
when explicitly replaying those original raw streams in diagnostic tests.
That does not promise preservation of every old Linux sample.

The existing key includes the reproducibility version. Its structure, SHA-256
derivation, root seed, MT19937 source, IDs, ordinals and purpose separation are
unchanged; replacing the version value deliberately changes all stochastic
streams, including outcomes and other distributions. Responses record v2.
Historical v1 replay needs the original engine/environment; the API did not and
does not provide a legacy-version selector. Input model/schema compatibility is
preserved. No conflict requiring a new mathematical decision was found.
`PRODUCT.md` and `MODEL.md` remain byte-for-byte unchanged from the base commit.

## Verification

Before the fix, an additional legacy corpus of 1,024 samples per distribution
had 0 differing fixed, uniform or triangular durations and 6 differing Beta-PERT
durations. This is experimental evidence of isolation in that corpus, not a proof
that every native libm operation agrees for every input.

After the fix, the exact Windows/Linux comparison covers 9,216 durations:
1,024 each for fixed, uniform, triangular and six Beta-PERT parameter sets.
The latter include interior and both endpoint modes, lambda 0.125, 4, 20 and 1e-30,
plus varied realization indices and instance ordinals. It also compares the entire
100-run demo response, including every instance, duration, timestamp, outcome,
inventory, lifecycle count, diagnostic and aggregate. All results match exactly.

The canonical JSON SHA-256 for the full probe `results` object is:
`f234cf0239abedc55aa24633253176be2d00a29683a86848decd5dc047aff406`.
For the complete demo response alone it is:
`0990d8f3a875d902e3b7bcd96a2d5789d890f95bac4606f1cb35ac0802edae5e`.

Both platforms additionally pass exact checks for workers 1 vs 4; reordered
activities/nodes/items/outcomes, labels and UI metadata with 3 workers; and the
100-realization prefix of a 125-realization run with 2 workers.

31 new regression cases cover primitive hex vectors, adaptive refinement, original
failing raw streams, canonical durations, v2 vectors for all distributions, hostile
ambient Decimal context, absence of native math/stdlib beta calls, rejection and
shape-one endpoints, asymmetric/endpoint distribution moments and a complete
versioned simulation reference with worker/order/prefix checks. Existing statistical
tests still verify moments for all stochastic distributions. The pre-existing
overflow test now intercepts the actual new sampler entry point.

Commands and recorded results:

| Check | Result |
|---|---|
| Existing Windows baseline after fix, before adding new tests | 87 passed, 2 warnings in 13.27s |
| Focused Windows reproducibility and pre-merge tests | 45 passed, 2 warnings in 8.47s |
| Full native Windows backend suite | 118 passed, 2 warnings in 19.21s |
| `docker compose exec -T backend python -m pytest tests -q -p no:cacheprovider` | 118 passed, 2 warnings in 10.82s |
| Exact Windows/Linux probe comparison | passed, 9,216 durations and full 100-run response |
| Running Docker HTTP service | health 200/ok; full demo response exactly matches native probe and reports v2 |
| `git diff --check` | passed |

Both warnings are existing Starlette test-client deprecations (httpx and AnyIO
BlockingPortal). An initial native pytest invocation from the repository root
failed collection because `app` was not on the import path; running the repository
command from `backend` corrected the invocation without changing application code.

Repeat from the repository root (the native interpreter path can be replaced with
another configured Python 3.12 environment):

```powershell
New-Item -ItemType Directory -Force build/reproducibility | Out-Null
.venv-windows/Scripts/python.exe backend/tools/trace_legacy_beta.py > build/reproducibility/windows-legacy.json
docker compose exec -T backend python tools/trace_legacy_beta.py > build/reproducibility/linux-legacy.json
.venv-windows/Scripts/python.exe backend/tools/reproducibility_probe.py > build/reproducibility/windows.json
docker compose exec -T backend python tools/reproducibility_probe.py > build/reproducibility/linux.json
```

Compare the two probe `results` objects exactly (environment metadata is expected
to differ); their recorded hashes must also match. The legacy trace deliberately
continues to demonstrate the old native-math problem and never selects a legacy
engine in the application. For native tests, from `backend`, run:
`../.venv-windows/Scripts/python.exe -m pytest tests -q -p no:cacheprovider`.

## Guarantees, evidence and limits

- **Demonstrated:** the original first divergent exp call, identical raw draws,
  exact corrected Windows/Linux corpus equality, statistical regressions and all
  worker/order/prefix checks above. No packaging executable was needed.
- **Guaranteed by construction under the documented runtime contract:** native
  libm cannot influence the new sampler; interval agreement fixes each primitive's
  nearest-even binary64 result. Stable keyed draws, deterministic operation order
  and exact engine arithmetic then give the same realizations on supported
  conforming Windows/Linux CPython 3.12 binary64 runtimes. This reasoning goes
  beyond observing equality on two machines.
- **Inferred, not separately verified here:** rebuilding the packaged application
  with this corrected backend should remove this numerical discrepancy. Packaging
  must be updated and retested separately as requested.
- **Limits:** this is finite-precision stochastic sampling, not an exact continuous
  random variable. Existing binary64 shape-range limits remain. Unsupported Python
  versions, architectures, altered hardware rounding modes, nonconforming Decimal
  implementations and native-runtime bugs are outside the guarantee. The test
  corpus does not enumerate all seeds. Controlled transcendental evaluation has
  additional CPU cost; no throughput improvement is claimed.

The branch is intended for review before merging. No packaging code, dependency
file, frontend, frozen specification, seed input, output formatting or API/schema
was changed. Commit identity and final clean Git status are provided with the
completion report, avoiding a self-referential commit hash in this document.
