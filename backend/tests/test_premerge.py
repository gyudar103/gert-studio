"""Pre-merge regressions and acceptance gaps identified by specification review."""
from decimal import localcontext, ROUND_DOWN, ROUND_UP
from fractions import Fraction as F
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.main import app
from app.engine.numbers import ratio_text
from app.engine.simulation import Run, run_realization
from app.engine.service import simulate
from app.schemas.model import Model
from app.validation import validate_model
from app.reporting import summarize
from helpers import activity, model, model_data, node, outcome, settings


def test_aggregate_formatting_does_not_inherit_callers_decimal_context():
    with localcontext() as context:
        context.rounding = ROUND_DOWN
        down = ratio_text(F(1, 3))
    with localcontext() as context:
        context.rounding = ROUND_UP
        up = ratio_text(F(1, 3))
    assert down == up == "0." + "3" * 34


def test_openapi_describes_decimal_request_contracts_and_errors():
    document = TestClient(app).get("/openapi.json").json()
    for path, name in (("/api/models/validate", "Model"), ("/api/simulate", "SimulationRequest")):
        operation = document["paths"][path]["post"]
        assert operation["requestBody"]["required"]
        assert operation["requestBody"]["content"]["application/json"]["schema"]["$ref"] == (
            "#/components/schemas/" + name)
        assert operation["responses"]["422"]["content"]["application/json"]["schema"]["$ref"] == (
            "#/components/schemas/ValidationReport")
    schema = document["components"]["schemas"]
    assert set(schema["BetaPERT"]["required"]) == {"type", "min", "mode", "max", "lambda"}
    assert "default" not in schema["BetaPERT"]["properties"]["lambda"]
    assert "settings" not in schema["Model"]["properties"]


def test_beta_pert_requires_canonical_lambda_not_internal_shape_alias():
    data = model_data(activities=[activity(duration={
        "type": "beta-PERT", "min": "0", "mode": "1", "max": "2", "shape": "4"})])
    with pytest.raises(ValidationError):
        Model.model_validate(data)


def test_beta_pert_default_serialization_round_trips_canonical_lambda():
    m = model(activities=[activity(duration={
        "type": "beta-PERT", "min": "0", "mode": "1", "max": "2", "lambda": "4"})])
    serialized = m.model_dump_json()
    assert '"lambda":"4"' in serialized
    assert '"shape"' not in serialized
    assert Model.model_validate_json(serialized) == m


@pytest.mark.parametrize("mode,shape", [("1", "3e308"), ("2", "1e308")])
def test_beta_pert_rejects_gamma_intermediate_overflow_before_sampling(mode, shape, monkeypatch):
    import random
    def must_not_sample(*args):
        pytest.fail("Overflowing gamma intermediates must be caught before entering the rejection loop")
    monkeypatch.setattr(random.Random, "betavariate", must_not_sample)
    m = model(activities=[activity(duration={
        "type": "beta-PERT", "min": "0", "mode": mode, "max": "2", "lambda": shape})])
    assert validate_model(m).valid  # Mathematically valid; numerical runtime failure only.
    result = simulate(m, settings())
    run = result["runs"][0]
    assert run["status"] == "invalid_runtime_state"
    assert "numerical range" in run["error"]
    assert run["activities"]["a"]["started"] == 0
    assert run["inventory"]["start"]["token"] == "1"


def test_insufficient_nonreplenishable_start_inventory_warns_without_rejecting():
    m = model(activities=[activity(requirements={"token": "2"})])
    report = validate_model(m)
    assert report.valid
    warning = next(d for d in report.diagnostics if d.code == "impossible_enablement")
    assert warning.severity == "warning" and warning.element_id == "a"
    assert simulate(m, settings())["runs"][0]["status"] == "deadlock"


def test_reachability_uses_final_effective_probability_without_mutation():
    # Final declared zero still has a tiny valid effective residual.
    data = model_data(nodes=[node("start", "start"), node("sink"), node("end", "terminal")],
                      activities=[activity(outcomes=[
                          outcome("a", "sink", "0.999999999999999"),
                          outcome("z", "end", "0")])])
    m = Model.model_validate(data)
    original = m.model_dump_json()
    report = validate_model(m)
    assert report.valid
    assert not any(d.code == "unreachable" and d.element_id == "end" for d in report.diagnostics)
    assert m.model_dump_json() == original


def test_mixed_status_reporting_uses_all_runs_and_only_terminal_durations():
    m = model()
    runs = [Run(i, status, F(time), "end" if status == "terminal" else None, [], {})
            for i, (status, time) in enumerate([
                ("terminal", 1), ("terminal", 3), ("cutoff_time", 100),
                ("deadlock", 0), ("ambiguous_terminal", 50), ("invalid_runtime_state", 99)])]
    report = summarize(m, runs)
    assert report["terminal_outcomes"]["end"]["count"] == 2
    assert report["terminal_outcomes"]["end"]["denominator"] == 6
    assert report["terminal_duration"] == {
        "sample_size": 2, "conditioning": "terminal runs observed within configured limits",
        "mean": "2", "median": "2", "p50": "2", "p80": "2.6",
        "p90": "2.8", "p95": "2.9", "min": "1", "max": "3"}
    assert sum(v["count"] for v in report["statuses"].values()) == 6


@pytest.mark.parametrize("ending", ["ambiguity", "invalid_runtime"])
def test_nonterminal_ending_accounts_for_preexisting_running_work(ending, monkeypatch):
    m = model(items=["token", "background"],
              nodes=[node("start", "start", {"token": "1", "background": "1"}),
                     node("ready"), node("end", "terminal")],
              activities=[
                  activity("supply", duration="1", outcomes=[outcome(target="ready", produced={"token": "1"})]),
                  activity("background", requirements={"background": "1"}, duration="10"),
                  activity("next", "ready", duration="2"),
                  *([activity("competitor", "ready", duration="2")] if ending == "ambiguity" else [])])
    if ending == "invalid_runtime":
        import app.engine.simulation as implementation
        from app.engine.randomness import SamplingError
        original = implementation.sample_duration
        def fail_on_next(duration, rng):
            if duration.value == 2:
                raise SamplingError("injected failure after a completed batch")
            return original(duration, rng)
        monkeypatch.setattr(implementation, "sample_duration", fail_on_next)
    r = run_realization(m, settings(), 42, 0)
    assert r.status == ("ambiguous_resource_competition" if ending == "ambiguity" else "invalid_runtime_state")
    counts = r.counts("background")
    assert counts["started"] == counts["unfinished_at_run_end"] == 1
    assert counts["cancelled"] == counts["completed"] == 0
    assert counts["unfinished_at_" + ending] == 1
    assert r.counts("supply")["completed"] == 1
    assert r.counts("next")["started"] == 0


def test_multiple_consumable_requirements_bound_maximum_multiplicity():
    m = model(items=["a", "b"], nodes=[
        node("start", "start", {"a": "0.7", "b": "0.5"}), node("end", "terminal")],
        activities=[activity(requirements={"a": "0.2", "b": "0.2"})])
    result = simulate(m, settings())
    r = result["runs"][0]
    assert r["activities"]["a"]["started"] == 2
    assert r["inventory"]["start"] == {"a": "0.3", "b": "0.1"}


def test_ambiguous_terminal_beats_exact_limits():
    m = model(items=["a", "b"], nodes=[
        node("start", "start", {"a": "1", "b": "1"}), node("end", "terminal"), node("other", "terminal")],
        activities=[activity("a", requirements={"a": "1"}),
                    activity("b", requirements={"b": "1"}, outcomes=[outcome(target="other")])])
    r = run_realization(m, settings(max_activity_completions=2, max_activity_instances=2,
                                   max_simulation_time="1"), 42, 0)
    assert r.status == "ambiguous_terminal"
    assert all(i.state == "completed" for i in r.instances)


def test_keyed_multiple_activity_reordering_and_immutability():
    data = model_data(items=["a", "b"], nodes=[
        node("start", "start", {"a": "2", "b": "2"}), node("end", "terminal")],
        activities=[activity(name, requirements={name: "1"}, duration={
            "type": "triangular", "min": "0", "mode": "1", "max": "3"}) for name in ("a", "b")])
    m = Model.model_validate(data)
    before = m.model_dump_json()
    baseline = simulate(m, settings(realizations=8))
    for field in ("nodes", "item_types", "activities"):
        data[field].reverse()
    reordered = simulate(Model.model_validate(data), settings(realizations=8), workers=3)
    assert baseline["runs"] == reordered["runs"]
    assert baseline["summary"] == reordered["summary"]
    assert before == m.model_dump_json()
