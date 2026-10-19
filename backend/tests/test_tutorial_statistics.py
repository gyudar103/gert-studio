"""Independent numeric checkpoints printed in the learning guide; no new methods."""
from fractions import Fraction

import pytest

from app.reporting.uncertainty import mean_uncertainty, probability_uncertainty, quantile_interval


def test_tutorial_probability_examples_use_wilson_even_at_the_boundary():
    eighty = probability_uncertainty(80, 100)
    assert eighty['standard_error'] == '0.04'
    assert float(eighty['confidence_interval']['lower']) == pytest.approx(.711, abs=.0005)
    assert float(eighty['confidence_interval']['upper']) == pytest.approx(.867, abs=.0005)
    none = probability_uncertainty(0, 100)
    all_runs = probability_uncertainty(100, 100)
    assert none['standard_error'] == all_runs['standard_error'] == '0'
    assert none['confidence_interval']['lower'] == '0'
    assert float(none['confidence_interval']['upper']) == pytest.approx(.0370, abs=.00005)
    assert float(all_runs['confidence_interval']['lower']) == pytest.approx(.963, abs=.0005)
    assert all_runs['confidence_interval']['upper'] == '1'


def test_tutorial_two_times_distinguish_population_spread_from_mean_uncertainty():
    values = [Fraction(2), Fraction(7)]
    stats = mean_uncertainty(values)
    assert sum(values) / len(values) == Fraction(9, 2)
    assert stats['standard_deviation'] == '2.5'
    assert float(stats['sample_standard_deviation']) == pytest.approx(3.5355339059327378)
    assert stats['standard_error'] == '2.5'
    interval = stats['confidence_interval']
    assert interval['method'] == 'student_t'
    assert interval['degrees_of_freedom'] == 1
    assert interval['lower_clipped'] is True
    assert interval['lower'] == '0'
    assert float(interval['upper']) == pytest.approx(36.26551184043676)
    # A small-sample percentile point can exist without finite CI bounds.
    assert quantile_interval(values, Fraction(1, 20))['lower'] is None
    assert quantile_interval(values, Fraction(19, 20))['upper'] is None
