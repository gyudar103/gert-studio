"""Versioned keyed streams and duration/outcome sampling."""
import hashlib
import json
import math
import random
from decimal import Decimal
from fractions import Fraction

ENGINE_VERSION = "0.1.0"
REPRODUCIBILITY_VERSION = "gert-v1-py312-sha256-mt19937"


class SamplingError(ArithmeticError):
    """A numerical sampler could not produce a valid canonical sample."""


def stream(seed: int, realization: int, activity_id: str, ordinal: int, purpose: str):
    key = json.dumps([REPRODUCIBILITY_VERSION, str(seed), realization, activity_id, ordinal, purpose],
                     ensure_ascii=True, separators=(",", ":")).encode("ascii")
    return random.Random(int.from_bytes(hashlib.sha256(key).digest(), "big"))


def sample_duration(distribution, rng) -> Fraction:
    if distribution.type == "fixed":
        return Fraction(distribution.value)
    low, high = Fraction(distribution.min), Fraction(distribution.max)
    if low == high:
        return low
    width = high - low
    if distribution.type == "uniform":
        # random() is a reproducible dyadic rational; scaling is exact.
        return low + width * Fraction(rng.random())
    mode = (Fraction(distribution.mode) - low) / width
    if distribution.type == "triangular":
        u = Fraction(rng.random())
        if u <= mode:
            normalized = math.sqrt(float(u * mode))
        else:
            normalized = 1 - math.sqrt(float((1 - u) * (1 - mode)))
    else:
        shape = Fraction(distribution.shape)
        try:
            alpha = float(1 + shape * mode)
            beta = float(1 + shape * (1 - mode))
        except OverflowError as exc:
            raise SamplingError("Beta-PERT shape exceeds sampler numerical range") from exc
        if not all(math.isfinite(x) and x > 0 for x in (alpha, beta)):
            raise SamplingError("Invalid numerical beta shape")
        # Python 3.12's gamma rejection sampler computes sqrt(2 * shape - 1).
        # Overflow makes its acceptance expression NaN and the loop never exits.
        if not all(math.isfinite(2 * x) for x in (alpha, beta)):
            raise SamplingError("Beta-PERT shape exceeds gamma sampler numerical range")
        normalized = rng.betavariate(alpha, beta)
    if not math.isfinite(normalized) or not 0 <= normalized <= 1:
        raise SamplingError("Sampler produced an invalid duration fraction")
    return low + width * Fraction(Decimal(repr(normalized)))


def select_outcome(outcomes, rng):
    ordered = sorted(outcomes, key=lambda o: o.id)
    draw = Fraction(rng.random())
    cumulative = Fraction()
    for outcome in ordered[:-1]:
        cumulative += Fraction(outcome.probability)
        if draw < cumulative:
            return outcome
    return ordered[-1]
