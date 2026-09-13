from copy import deepcopy
from decimal import Decimal
import pytest
from pydantic import ValidationError
from app.schemas.model import Model
from app.validation import validate_model
from helpers import activity, model_data, node, outcome


def codes(data):
    return {d.code for d in validate_model(Model.model_validate(data)).diagnostics if d.severity == "error"}


def test_valid_roundtrip_and_scoped_outcomes():
    data = model_data(activities=[activity("a"), activity("b")])
    m = Model.model_validate(data)
    assert validate_model(m).valid
    assert Model.model_validate_json(m.model_dump_json(by_alias=True)) == m
    assert "possible_competition" in {d.code for d in validate_model(m).diagnostics}


@pytest.mark.parametrize("field", ["nodes", "activities", "item_types"])
def test_duplicate_ids(field):
    data = model_data()
    data[field].append(deepcopy(data[field][0]))
    assert "duplicate_id" in codes(data)


@pytest.mark.parametrize("requirements", [{}, {"token": "0"}])
def test_empty_requirements(requirements):
    assert "positive_requirement" in codes(model_data(activities=[activity(requirements=requirements)]))


@pytest.mark.parametrize("duration", [
    {"type": "fixed"}, {"type": "fixed", "value": "-1"},
    {"type": "uniform", "min": "2", "max": "1"},
    {"type": "triangular", "min": "0", "mode": "3", "max": "2"},
    *[{"type": "beta-PERT", "min": "0", "mode": "1", "max": "2", "lambda": v}
      for v in ["0", "-1", "NaN", "Infinity"]],
    {"type": "beta-PERT", "min": "0", "mode": "1", "max": "2"},
    {"type": "beta-PERT", "min": "0", "mode": "1", "lambda": "4"},
])
def test_bad_durations(duration):
    with pytest.raises(ValidationError):
        Model.model_validate(model_data(activities=[activity(duration=duration)]))


@pytest.mark.parametrize("total,valid", [
    ("0.99999999999999", True), ("1.00000000000001", True),
    ("0.999999999999989", False), ("1.000000000000011", False), ("0.9", False),
])
def test_probability_tolerance(total, valid):
    from fractions import Fraction
    from app.engine.numbers import decimal_text
    second = decimal_text(Fraction(total) - Fraction("0.7"))
    data = model_data(activities=[activity(outcomes=[outcome("a", probability="0.7"),
                                                    outcome("b", probability=second)])])
    assert ("probability_sum" not in codes(data)) == valid


def test_illegal_final_effective_interval():
    data = model_data(activities=[activity(outcomes=[
        outcome("a", probability="0.6"), outcome("b", probability="0.400000000000001"),
        outcome("z", probability="0")])])
    assert "probability_interval" in codes(data)


@pytest.mark.parametrize("value", ["-1", "NaN", "Infinity", True, 0.1])
def test_invalid_quantities(value):
    with pytest.raises(ValidationError):
        Model.model_validate(model_data(activities=[activity(requirements={"token": value})]))


def test_connections_items_codes_and_outcome_ids():
    data = model_data(activities=[activity(source="end", requirements={"missing": "1"},
                         outcomes=[outcome("same", "start"), outcome("same", "absent", "0")])])
    assert {"terminal_source", "item_reference", "start_target", "target_reference", "outcome_id"} <= codes(data)
    data = model_data(nodes=[node("start", "start"), node("end", "terminal"), node("other", "terminal")])
    data["nodes"][2]["outcome_code"] = "end"
    assert "terminal_code" in codes(data)


def test_start_count_and_missing_outcomes():
    assert "start_count" in codes(model_data(nodes=[node("end", "terminal")]))
    with pytest.raises(ValidationError):
        Model.model_validate(model_data(activities=[activity(outcomes=[])]))


def test_cycle_is_warning_not_error():
    data = model_data(nodes=[node("start", "start"), node("loop"), node("end", "terminal")],
                     activities=[activity(outcomes=[outcome(target="loop", produced={"token": "1"})]),
                                 activity("loop", "loop", outcomes=[outcome(target="loop", produced={"token": "2"})])])
    report = validate_model(Model.model_validate(data))
    assert report.valid
    assert "possible_cycle" in {d.code for d in report.diagnostics}

