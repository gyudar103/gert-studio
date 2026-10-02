from decimal import Decimal, Inexact, ROUND_DOWN, localcontext
from fractions import Fraction as F
from math import comb
from types import SimpleNamespace

import pytest
from scipy.stats import binom, t

from app.reporting import PERCENTILES, summarize
from app.reporting.uncertainty import (
    NORMAL_975, mean_uncertainty, probability_uncertainty, quantile_interval,
    quantile_ranks, student_t_critical,
)
from helpers import model


@pytest.mark.parametrize("df,reference", [
    (1, "12.70620473617470464602167997884208746767"),
    (2, "4.302652729749463852320943892621175008188"),
    (3, "3.182446305283709592723225425779868376269"),
    (10, "2.228138851986274748395490663201806717856"),
    (30, "2.042272456301238309958042232033889101690"),
    (100, "1.983971518523552286595184867990339164772"),
    (1000, "1.962339080826408484998580436704792596164"),
    (1000000, "1.959966356814107035258960556754539595519"),
])
def test_student_t_vectors_and_independent_scipy_cdf(df, reference):
    # Serialized regression vectors plus an independent implementation's CDF.
    critical = student_t_critical(df)
    assert abs(critical - Decimal(reference)) < Decimal("1e-37")
    assert t.cdf(float(critical), df) == pytest.approx(.975, abs=2e-14)


def test_student_t_analytic_small_df():
    with localcontext() as ctx:
        ctx.prec = 75
        # df=1 is Cauchy: cot(pi/40), evaluated independently by Taylor sin/cos.
        pi = Decimal("3.141592653589793238462643383279502884197169399375105820974944592307816406286")
        x = pi / 40
        sin, cos, sin_term, cos_term = x, Decimal(1), x, Decimal(1)
        for k in range(1, 45):
            sin_term *= -x * x / (2 * k * (2 * k + 1))
            cos_term *= -x * x / ((2 * k - 1) * 2 * k)
            sin += sin_term
            cos += cos_term
        assert abs(student_t_critical(1) - cos / sin) < Decimal("1e-57")
        # df=2 CDF = (1+t/sqrt(t²+2))/2, giving t²=722/39.
        assert abs(student_t_critical(2) - (Decimal(722) / 39).sqrt()) < Decimal("1e-58")


def test_student_t_gamma_shift_boundary_and_large_df():
    values = [student_t_critical(df) for df in (254, 255, 256, 257, 10**12)]
    assert all(a > b for a, b in zip(values, values[1:]))
    assert values[-1] > NORMAL_975
    for df, value in zip((254, 255, 256, 257, 10**12), values):
        assert t.cdf(float(value), df) == pytest.approx(.975, abs=2e-14)


@pytest.mark.parametrize("count,size", [(0,1), (1,1), (0,100), (100,100), (1,2), (23,100)])
def test_probability_wilson_independent_score_equation(count, size):
    uncertainty = probability_uncertainty(count, size)
    ci = uncertainty["confidence_interval"]
    lower, upper = F(ci["lower"]), F(ci["upper"])
    assert 0 <= lower <= F(count, size) <= upper <= 1
    se = F(uncertainty["standard_error"])
    assert float(se * se) == pytest.approx(count * (size-count) / size**3, abs=1e-30)
    z2 = NORMAL_975 * NORMAL_975
    for endpoint in (lower, upper):
        if endpoint not in (0,1):
            # Wilson endpoints solve the score-test equation, independently of
            # the center/radius expression used by the implementation.
            score = size * (F(count,size) - endpoint)**2 / (endpoint*(1-endpoint))
            assert float(score) == pytest.approx(float(z2), abs=1e-13)
    if count == 0:
        assert lower == 0 and upper > 0
    if count == size:
        assert upper == 1 and lower < 1


def test_population_spread_and_sample_mean_uncertainty_are_distinct():
    result = mean_uncertainty([F(1), F(3)])
    assert result["standard_deviation"] == result["standard_error"] == "1"
    assert result["sample_standard_deviation"] == "1.414213562373095048801688724209698"
    ci = result["confidence_interval"]
    assert ci["lower"] == "0" and ci["lower_clipped"] is True
    assert ci["upper"] == "14.70620473617470464602167997884209"
    result = mean_uncertainty([F(1),F(2),F(3),F(4)])
    assert float(result["standard_deviation"]) == pytest.approx((5/4)**.5)
    assert float(result["standard_error"]) == pytest.approx((5/12)**.5)
    assert float(result["sample_standard_deviation"]) == pytest.approx((5/3)**.5)
    assert result["confidence_interval"]["lower_clipped"] is False


def test_empty_singleton_and_constant_samples():
    assert mean_uncertainty([]) == {"standard_deviation":None,"sample_standard_deviation":None,"standard_error":None,"confidence_interval":None}
    assert mean_uncertainty([F(9)]) == {"standard_deviation":"0","sample_standard_deviation":None,"standard_error":None,"confidence_interval":None}
    constant = mean_uncertainty([F(7)]*3)
    assert constant["standard_deviation"] == constant["standard_error"] == "0"
    assert constant["sample_standard_deviation"] == "0"
    assert constant["confidence_interval"]["lower"] == constant["confidence_interval"]["upper"] == "7"
    assert constant["confidence_interval"]["lower_clipped"] is False


def exact_rank_reference(n, p):
    # Deliberately direct rational sum, independent of integer recurrence and
    # reflection in production. Verify both inclusive tail inequalities.
    masses = [F(comb(n,k))*p**k*(1-p)**(n-k) for k in range(n+1)]
    lower = max(l for l in range(n+1) if sum(masses[:l],F()) <= F(1,40))
    upper = min(u for u in range(n+2) if sum(masses[u:],F()) <= F(1,40))
    return lower or None, upper if upper <= n else None


@pytest.mark.parametrize("n", [0,1,2,10,40,100])
def test_every_quantile_rank_against_exact_independent_binomial_sums(n):
    for p in PERCENTILES.values():
        assert quantile_ranks(n,p) == exact_rank_reference(n,p)


def test_exact_tail_equality_and_insufficient_extreme_samples():
    assert quantile_ranks(1,F(1,40)) == (None,1)
    assert quantile_ranks(1,F(39,40)) == (1,None)
    assert quantile_ranks(10,F(1,20)) == (None,3)
    assert quantile_ranks(10,F(19,20)) == (8,None)
    assert quantile_ranks(1,F(1,2)) == (None,None)


def test_large_quantile_ranks_independent_binomial_tails():
    n = 10000
    for p in PERCENTILES.values():
        lower, upper = quantile_ranks(n,p)
        assert binom.cdf(lower-1,n,float(p)) <= .025
        assert binom.cdf(lower,n,float(p)) > .025
        assert binom.sf(upper-1,n,float(p)) <= .025
        assert binom.sf(upper-2,n,float(p)) > .025


def test_order_statistic_endpoints_are_exact_with_ties_and_large_decimals():
    value = F("999999999999999999999999999999999999999999999999999999999.123456789123456789")
    values = [value]*100
    ci = quantile_interval(values,F(1,20))
    assert ci["lower_rank"] == 1 and ci["upper_rank"] == 11
    assert ci["lower"] == ci["upper"] == str(value.numerator//value.denominator)+".123456789123456789"


@pytest.mark.parametrize("values,expected", [
    ([9], ["9"] * 9),
    ([0, 10, 20], ["1", "2", "4", "6", "10", "14", "16", "18", "19"]),
    ([0, 10, 20, 30], ["1.5", "3", "6", "9", "15", "21", "24", "27", "28.5"]),
])
def test_type7_complete_percentile_family_singleton_odd_even(values, expected):
    runs = [SimpleNamespace(status="terminal", time=F(value), terminal_node_id="end",
                            counts=lambda _: {"started": 1, "completed": 1, "cancelled": 0, "unfinished": 0})
            for value in values]
    duration = summarize(model(), runs)["terminal_duration"]
    assert [duration[key] for key in PERCENTILES] == expected
    assert duration["median"] == duration["p50"] == expected[4]


def test_report_sample_populations_percentiles_and_lifecycle_preservation():
    statuses = ["terminal","terminal","deadlock","cutoff_time","ambiguous_resource_competition","ambiguous_terminal","invalid_runtime_state"]
    starts = [0,2,1,0,0,3,1]
    def counts(start):
        return {"started":start,"completed":0,"cancelled":0,"unfinished":start}
    runs = [SimpleNamespace(status=status,time=F(i*2+1),terminal_node_id="end" if status=="terminal" else None,
                            counts=lambda _, start=start: counts(start))
            for i,(status,start) in enumerate(zip(statuses,starts))]
    report = summarize(model(),runs)
    duration = report["terminal_duration"]
    assert duration["sample_size"] == 2 and duration["mean"] == "2"
    expected = {"p5":"1.1","p10":"1.2","p20":"1.4","p30":"1.6","p50":"2","p70":"2.4","p80":"2.6","p90":"2.8","p95":"2.9"}
    assert {key:duration[key] for key in expected} == expected
    assert duration["median"] == duration["p50"]
    activity = report["activities"]["a"]
    assert activity["denominator"] == 7 and activity["started"] == 7
    assert activity["mean_starts"] == "1"
    assert F(activity["probability_at_least_one_start"]) == F("0.5714285714285714285714285714285714")
    assert float(activity["standard_deviation_starts"]) == pytest.approx((8/7)**.5)
    assert float(activity["mean_starts_standard_error"]) == pytest.approx((8/42)**.5)
    assert float(activity["sample_standard_deviation_starts"]) == pytest.approx((8/6)**.5)
    assert report["terminal_outcomes"]["end"]["count"] == 2
    assert all(entry["denominator"]==7 for entry in report["statuses"].values())


def test_reporting_ignores_ambient_decimal_context_and_rounding():
    values = [F("0.0000000000000000000000000000001"),F("123456789012345678901234567890123456789")]
    expected = mean_uncertainty(values), probability_uncertainty(7,13), student_t_critical(17)
    student_t_critical.cache_clear()
    with localcontext() as ctx:
        ctx.prec = 6
        ctx.rounding = ROUND_DOWN
        ctx.Emin, ctx.Emax = -9, 9
        ctx.traps[Inexact] = True
        actual = mean_uncertainty(values), probability_uncertainty(7,13), student_t_critical(17)
    assert actual == expected


def test_reporting_never_calls_native_math_or_rng(monkeypatch):
    import math
    import random
    def forbidden(*args):
        raise AssertionError("Reporting called native math or RNG")
    for name in ("sqrt", "log", "exp", "lgamma"):
        monkeypatch.setattr(math, name, forbidden)
    monkeypatch.setattr(random.Random, "random", forbidden)
    student_t_critical.cache_clear()
    assert mean_uncertainty([F(1), F(3), F(4)])["standard_error"] is not None
    assert probability_uncertainty(2,3)["standard_error"] is not None
    assert quantile_ranks(100,F(1,20)) == (1,11)
