"""Exact arithmetic and lossless decimal output, independent of Decimal context."""
from fractions import Fraction


def decimal_text(value: Fraction) -> str:
    """Render a terminating rational as a decimal without contextual rounding."""
    value = Fraction(value)
    denominator = value.denominator
    twos = fives = 0
    while denominator % 2 == 0:
        twos += 1
        denominator //= 2
    while denominator % 5 == 0:
        fives += 1
        denominator //= 5
    if denominator != 1:
        raise ValueError("Value is not a terminating decimal")
    places = max(twos, fives)
    integer = abs(value.numerator) * 2 ** (places - twos) * 5 ** (places - fives)
    digits = str(integer).zfill(places + 1)
    text = digits if not places else (digits[:-places] + "." + digits[-places:]).rstrip("0").rstrip(".")
    return ("-" if value < 0 else "") + text


def ratio_text(value: Fraction) -> str:
    """Aggregate ratios can recur: report 34 significant decimal digits."""
    from decimal import Decimal, localcontext
    with localcontext() as context:
        context.prec = 34
        return str(Decimal(value.numerator) / Decimal(value.denominator))

