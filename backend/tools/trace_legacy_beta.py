"""Diagnostic only: trace CPython's original Beta sampler without packaging.

Run with Python 3.12 on each platform; compare samples/events in the JSON output.
This never selects a legacy sampler in the application or changes engine state.
"""
import decimal
import hashlib
import inspect
import json
import math
import platform
import random
import sys
from fractions import Fraction
from importlib import metadata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.engine.numbers import decimal_text


def environment():
    return {"python": sys.version, "implementation": platform.python_implementation(),
            "platform": platform.platform(), "machine": platform.machine(),
            "compiler": platform.python_compiler(), "libc": platform.libc_ver(),
            "decimal": str(decimal.getcontext()), "libmpdec": decimal.__libmpdec_version__,
            "dependencies": {name: metadata.version(name) for name in
                             ("pydantic", "fastapi", "numpy", "scipy")},
            "numpy_scipy_used_by_sampler": False}


def legacy_distribution_samples():
    """Original v1 formulas, retained here only to diagnose native math."""
    samples = {name: [] for name in ("fixed", "uniform", "triangular", "beta-PERT")}
    low, width, mode = Fraction("0.1"), Fraction("3.6"), Fraction(11, 36)
    for index in range(1024):
        key = json.dumps(["gert-v1-py312-sha256-mt19937", "20260914", index,
                          "probe", index % 3, "duration"], separators=(",", ":"))
        seed = int.from_bytes(hashlib.sha256(key.encode("ascii")).digest(), "big")
        u = Fraction(random.Random(seed).random())
        triangle = (math.sqrt(float(u * mode)) if u <= mode else
                    1 - math.sqrt(float((1 - u) * (1 - mode))))
        beta = random.Random(seed).betavariate(float(1 + 4 * mode), float(1 + 4 * (1 - mode)))
        samples["fixed"].append("0.100000000000000000001")
        samples["uniform"].append(decimal_text(low + width * u))
        samples["triangular"].append(decimal_text(low + width * Fraction(decimal.Decimal(repr(triangle)))))
        samples["beta-PERT"].append(decimal_text(low + width * Fraction(decimal.Decimal(repr(beta)))))
    return samples


def legacy_trace():
    samples = []
    events = []

    class Traced(random.Random):
        def random(self):
            result = super().random()
            events.append(["random", result.hex()])
            return result

    originals = {name: getattr(random, name) for name in ("_log", "_exp", "_sqrt")}

    def wrapped(name):
        def call(value):
            result = originals[name](value)
            events.append([name, value.hex(), result.hex()])
            return result
        return call

    def trace(frame, event, arg):
        if frame.f_code.co_name in ("gammavariate", "betavariate") and event in ("line", "return"):
            events.append([frame.f_code.co_name, event, frame.f_lineno,
                           {k: v.hex() for k, v in frame.f_locals.items() if isinstance(v, float)}])
        return trace

    for index, ordinal in ((30, 0), (44, 2), (48, 0)):
        events.clear()
        key = json.dumps(["gert-v1-py312-sha256-mt19937", "20260914", index,
                          "test", ordinal, "duration"], ensure_ascii=True, separators=(",", ":"))
        digest = hashlib.sha256(key.encode("ascii")).hexdigest()
        rng = Traced(int(digest, 16))
        alpha, beta = float(Fraction(7, 3)), float(Fraction(11, 3))
        previous_trace = sys.gettrace()
        try:
            for name in originals:
                setattr(random, name, wrapped(name))
            sys.settrace(trace)
            normalized = rng.betavariate(alpha, beta)
        finally:
            sys.settrace(previous_trace)
            for name, fn in originals.items():
                setattr(random, name, fn)
        converted = decimal.Decimal(repr(normalized))
        duration = 1 + 3 * Fraction(converted)
        samples.append({"index": index, "ordinal": ordinal, "key": key, "sha256": digest,
                        "alpha": alpha.hex(), "beta": beta.hex(), "events": events.copy(),
                        "normalized": normalized.hex(), "decimal_conversion": str(converted),
                        "duration_fraction": str(duration), "duration": decimal_text(duration)})
    return {"environment": environment(), "samples": samples,
            "distribution_samples": legacy_distribution_samples(),
            "stdlib_source_sha256": hashlib.sha256((inspect.getsource(random.Random.gammavariate)
                + inspect.getsource(random.Random.betavariate)).encode()).hexdigest(),
            "constants": {name: getattr(random, name).hex() for name in ("LOG4", "SG_MAGICCONST")}}


if __name__ == "__main__":
    print(json.dumps(legacy_trace(), indent=2))
