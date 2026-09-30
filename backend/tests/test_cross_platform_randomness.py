"""Exact reference vectors; never round results to make platforms agree."""
from copy import deepcopy
from decimal import Inexact, ROUND_UP, localcontext
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import random
import statistics

import pytest

from app.engine import binary64
from app.engine.beta import beta_variate
from app.engine.numbers import decimal_text
from app.engine.randomness import REPRODUCIBILITY_VERSION, sample_duration, stream
from app.engine.service import simulate
from app.schemas.model import BetaPERT, Model, SimulationRequest
from helpers import activity, model

FIXTURES = Path(__file__).parent / "fixtures"
LEGACY = json.loads((FIXTURES / "beta-legacy-evidence.json").read_text())
VECTORS = json.loads((FIXTURES / "duration-v2-vectors.json").read_text())


@pytest.mark.parametrize("operation,argument,expected", [
    ("exp", "0x1.6032eaf638ba6p-3", "0x1.30097bfadd80bp+0"),
    ("exp", "0x1.496f64590e281p-3", "0x1.2cad255018e55p+0"),
    ("exp", "-0x1.1fd44faec8190p-3", "0x1.bcded11a5c727p-1"),
    ("exp", "0x0.0p+0", "0x1.0000000000000p+0"),
    ("log", "0x1.0000000000000p+0", "0x0.0p+0"),
    ("log", "0x1.0000000000000p+1", "0x1.62e42fefa39efp-1"),
    ("sqrt", "0x1.0000000000000p+1", "0x1.6a09e667f3bcdp+0"),
    ("sqrt", "0x1.0000000000000p+2", "0x1.0000000000000p+1"),
    ("sqrt", "0x0.0p+0", "0x0.0p+0"),
])
def test_correctly_rounded_primitive_vectors(operation, argument, expected):
    assert getattr(binary64, operation)(float.fromhex(argument)).hex() == expected


def test_primitive_refines_until_binary64_rounding_is_decided(monkeypatch):
    factory = binary64.Context
    precisions = []

    def deliberately_small_first_context(**kwargs):
        precisions.append(kwargs["prec"])
        if len(precisions) == 1:
            kwargs["prec"] = 5
        return factory(**kwargs)

    monkeypatch.setattr(binary64, "Context", deliberately_small_first_context)
    assert binary64.exp(float.fromhex("0x1.6032eaf638ba6p-3")).hex() == "0x1.30097bfadd80bp+0"
    assert len(precisions) >= 2
    assert precisions[-1] > precisions[0]


@pytest.mark.parametrize("vector", LEGACY["vectors"])
def test_original_failing_stream_raw_draws_and_beta_helper(vector):
    # Fix the original stream explicitly: changing the version cannot hide the bug.
    assert hashlib.sha256(vector["key"].encode("ascii")).hexdigest() == vector["sha256"]
    draws = []

    class Recorded(random.Random):
        def random(self):
            value = super().random()
            draws.append(value.hex())
            return value

    rng = Recorded(int(vector["sha256"], 16))
    result = beta_variate(float.fromhex(LEGACY["alpha_hex"]), float.fromhex(LEGACY["beta_hex"]), rng)
    assert draws == vector["raw_draws"]
    assert result.hex() == vector["corrected_normalized_hex"]


@pytest.mark.parametrize("vector", LEGACY["vectors"])
def test_original_failing_stream_exact_canonical_duration(vector):
    duration = BetaPERT.model_validate(LEGACY["parameters"])
    rng = random.Random(int(vector["sha256"], 16))
    assert decimal_text(sample_duration(duration, rng)) == vector["corrected_duration"]


@pytest.mark.parametrize("case", VECTORS["vectors"])
def test_versioned_duration_vectors(case):
    assert REPRODUCIBILITY_VERSION == VECTORS["version"]
    distribution = model(activities=[activity(duration=case["parameters"])]).activities[0].duration
    for sample in case["samples"]:
        rng = stream(VECTORS["seed"], sample["realization"], VECTORS["activity_id"],
                     sample["ordinal"], VECTORS["purpose"])
        assert decimal_text(sample_duration(distribution, rng)) == sample["duration"]


def test_sampler_does_not_inherit_decimal_context_or_call_native_math(monkeypatch):
    def forbidden(*args):
        raise AssertionError("Sampler called a platform-dependent math function")

    for name in ("log", "exp", "sqrt"):
        monkeypatch.setattr(math, name, forbidden)
        monkeypatch.setattr(random, "_" + name, forbidden)
    monkeypatch.setattr(random.Random, "betavariate", forbidden)
    for case in VECTORS["vectors"]:
        with localcontext() as context:
            context.prec = 3
            context.rounding = ROUND_UP
            context.Emin, context.Emax = -9, 9
            context.traps[Inexact] = True
            test_versioned_duration_vectors(case)


def test_beta_rejection_and_shape_one_endpoints():
    class Draws:
        def __init__(self, values):
            self.values = iter(values)
            self.calls = 0

        def random(self):
            self.calls += 1
            return next(self.values)

    rng = Draws([0.0, 1.0, 0.5, 0.5, 0.5, 0.5])
    assert beta_variate(2.0, 2.0, rng) == 0.5
    assert rng.calls == 6  # Both excluded proposal endpoints were retried.
    assert beta_variate(1.0, 1.0, Draws([0.5, 0.5])) == 0.5
    assert beta_variate(1.0, 1.0, Draws([0.0])) == 0.0


@pytest.mark.parametrize("mode,shape", [("0", "4"), ("0.2", "8"), ("1", "2")])
def test_asymmetric_and_endpoint_beta_moments(mode, shape):
    distribution = BetaPERT.model_validate({"type": "beta-PERT", "min": "0", "mode": mode,
                                             "max": "1", "lambda": shape})
    alpha = 1 + Fraction(shape) * Fraction(mode)
    beta = 1 + Fraction(shape) * (1 - Fraction(mode))
    mean = float(alpha / (alpha + beta))
    variance = float(alpha * beta / ((alpha + beta) ** 2 * (alpha + beta + 1)))
    n = 2000
    samples = [float(sample_duration(distribution, stream(134, i, "test", 0, "duration"))) for i in range(n)]
    assert all(0 <= x <= 1 for x in samples)
    assert abs(statistics.mean(samples) - mean) < 6 * math.sqrt(variance / n)
    assert abs(statistics.variance(samples) - variance) < 0.01


def test_complete_demo_reference_and_invariance():
    request = SimulationRequest.model_validate_json(
        (FIXTURES / "reproducibility-demo.json").read_text(encoding="utf-8-sig"))
    result = simulate(request.model, request.settings)
    canonical_json = json.dumps(result, sort_keys=True, separators=(",", ":")).encode()
    # Pins every duration, instance, timestamp, outcome, inventory and aggregate.
    assert hashlib.sha256(canonical_json).hexdigest() == "0990d8f3a875d902e3b7bcd96a2d5789d890f95bac4606f1cb35ac0802edae5e"
    assert result == simulate(request.model, request.settings, workers=4)
    data = deepcopy(request.model.model_dump(mode="json", by_alias=True))
    for field in ("nodes", "activities", "item_types"):
        data[field].reverse()
        for element in data[field]:
            element["label"] = "renamed"
    for activity_data in data["activities"]:
        activity_data["outcomes"].reverse()
    data["ui_metadata"] = {"zoom": 5}
    assert result == simulate(Model.model_validate(data), request.settings, workers=3)
    longer = simulate(request.model, request.settings.model_copy(update={"realizations": 125}), workers=2)
    assert result["runs"] == longer["runs"][:100]
