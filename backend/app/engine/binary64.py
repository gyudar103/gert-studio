"""Correctly rounded binary64 primitives, independent of the platform libm.

Only the finite domains used by the duration samplers are supported. Decimal's
correctly rounded ln/exp/sqrt enclose the real answer between adjacent decimal
numbers. Convert both bounds to binary64; return only when they agree. Increasing
working precision resolves difficult cases without assuming that a fixed number
of guard digits is enough. This controls primitive arithmetic, not output/time
rounding. Requires CPython's nearest-even binary64 conversions and arithmetic.
"""
from decimal import (
    Context, Decimal, DivisionByZero, Inexact, InvalidOperation, Overflow,
    ROUND_HALF_EVEN,
)


def _rounded(operation: str, value: float) -> float:
    argument = Decimal.from_float(value)  # Exact, independent of caller context.
    precision = 40
    while True:
        context = Context(prec=precision, rounding=ROUND_HALF_EVEN,
                          Emin=-999999, Emax=999999, capitals=1, clamp=0,
                          flags=[], traps=[InvalidOperation, DivisionByZero, Overflow])
        result = getattr(context, operation)(argument)
        if not context.flags[Inexact]:
            return float(result)
        lower = float(context.next_minus(result))
        upper = float(context.next_plus(result))
        if lower == upper:
            return lower
        precision *= 2


def log(value: float) -> float:
    return _rounded("ln", value)


def exp(value: float) -> float:
    return _rounded("exp", value)


def sqrt(value: float) -> float:
    return _rounded("sqrt", value)
