"""Versioned Beta sampler for PERT shapes (alpha and beta >= 1).

Uses Cheng's gamma rejection method and the ratio of independent unit-scale
gamma variates, following CPython 3.12's random.py algorithm and operation order.
Adapted under the Python license in CPYTHON-LICENSE.txt. Changes: limit the helper
to PERT shapes >= 1, use a supplied keyed RNG, and replace native math primitives.
Transcendentals use GERT's correctly rounded binary64 primitives, not native
libm. See docs/REPRODUCIBILITY_REPORT.md for the derivation and compatibility.
"""
from app.engine.binary64 import exp, log, sqrt

_LOG4 = log(4.0)
_ACCEPTANCE_CONSTANT = 1.0 + log(4.5)


def _gamma(shape: float, rng) -> float:
    if shape == 1.0:
        return -log(1.0 - rng.random())

    scale = sqrt(2.0 * shape - 1.0)
    offset = shape - _LOG4
    coefficient = shape + scale
    while True:
        first = rng.random()
        if not 1e-7 < first < 0.9999999:
            continue
        second = 1.0 - rng.random()
        transformed = log(first / (1.0 - first)) / scale
        candidate = shape * exp(transformed)
        product = first * first * second
        score = offset + coefficient * transformed - candidate
        if (score + _ACCEPTANCE_CONSTANT - 4.5 * product >= 0.0
                or score >= log(product)):
            return candidate


def beta_variate(alpha: float, beta: float, rng) -> float:
    """Inputs are finite PERT shapes, range-checked by sample_duration."""
    first = _gamma(alpha, rng)
    if first:
        return first / (first + _gamma(beta, rng))
    return 0.0
