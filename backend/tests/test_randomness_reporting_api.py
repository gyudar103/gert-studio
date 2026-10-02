from copy import deepcopy
from fractions import Fraction as F
import math
import statistics
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.engine.randomness import sample_duration, select_outcome, stream
from app.engine.service import simulate
from app.schemas.model import Model
from helpers import activity, model, model_data, node, outcome, settings


@pytest.mark.parametrize("distribution,mean,variance", [
    ({"type": "uniform", "min": "0", "max": "1"}, 0.5, 1/12),
    ({"type": "triangular", "min": "0", "mode": "0.5", "max": "1"}, 0.5, 1/24),
    ({"type": "beta-PERT", "min": "0", "mode": "0.5", "max": "1", "lambda": "4"}, 0.5, 1/28),
])
def test_distribution_moments(distribution, mean, variance):
    duration = model(activities=[activity(duration=distribution)]).activities[0].duration
    n = 6000
    samples = [float(sample_duration(duration, stream(24, i, "a", 0, "duration"))) for i in range(n)]
    assert all(0 <= x <= 1 for x in samples)
    # Six standard errors for sample mean; bounded-distribution variance estimate tolerance.
    assert abs(statistics.mean(samples) - mean) < 6 * math.sqrt(variance / n)
    assert abs(statistics.variance(samples) - variance) < 0.01


@pytest.mark.parametrize("distribution", [
    {"type": "fixed", "value": "0.3"},
    {"type": "uniform", "min": "0.3", "max": "0.3"},
    {"type": "triangular", "min": "0.3", "mode": "0.3", "max": "0.3"},
    {"type": "beta-PERT", "min": "0.3", "mode": "0.3", "max": "0.3", "lambda": "4"},
])
def test_degenerate(distribution):
    d = model(activities=[activity(duration=distribution)]).activities[0].duration
    assert sample_duration(d, stream(1, 0, "a", 0, "duration")) == F("0.3")


def stochastic_model():
    return model(activities=[activity(duration={"type": "uniform", "min": "0", "max": "2"},
                  outcomes=[outcome("pass", "end", "0.8"), outcome("fail", "failure", "0.2")])],
                 nodes=[node("start", "start"), node("end", "terminal"), node("failure", "terminal")])


def test_outcome_frequency_and_reporting():
    n = 4000
    result = simulate(stochastic_model(), settings(realizations=n))
    count = result["summary"]["terminal_outcomes"]["end"]["count"]
    assert abs(count - n * .8) < 6 * math.sqrt(n * .8 * .2)
    assert result["summary"]["terminal_duration"]["sample_size"] == n
    assert sum(s["count"] for s in result["summary"]["statuses"].values()) == n


def test_reproducibility_parallelism_order_labels_prefix():
    m = stochastic_model()
    cfg = settings(realizations=25)
    first = simulate(m, cfg)
    assert first == simulate(m, cfg, workers=4)
    data = m.model_dump(mode="json", by_alias=True)
    for field in ("activities", "nodes", "item_types"):
        data[field].reverse()
        for element in data[field]:
            element["label"] = "renamed"
    data["activities"][0]["outcomes"].reverse()
    for o in data["activities"][0]["outcomes"]:
        o["label"] = "renamed"
    data["ui_metadata"] = {"zoom": 7}
    assert first == simulate(Model.model_validate(data), cfg)
    longer = simulate(m, settings(realizations=40))
    assert first["runs"] == longer["runs"][:25]
    assert stream(1, 0, "a", 0, "duration").random() != stream(1, 0, "a", 0, "outcome").random()


def test_seed_generated_and_replayable():
    m = stochastic_model()
    result = simulate(m, settings(seed=None))
    assert result == simulate(m, settings(seed=result["root_seed"]))


@pytest.mark.parametrize("last", ["0.299999999999999", "0.300000000000001"])
def test_final_interval_preserves_declared_values(last):
    m = model(activities=[activity(outcomes=[outcome("a", probability="0.7"), outcome("z", probability=last)])])
    stored = m.model_dump_json()
    class Draw:
        def random(self):
            return .9999999999999999
    assert select_outcome(m.activities[0].outcomes, Draw()).id == "z"
    assert m.model_dump_json() == stored


def test_zero_terminal_stats_and_status_denominator():
    result = simulate(model(activities=[activity(requirements={"token": "2"})]), settings(realizations=3))
    summary = result["summary"]
    assert {key: summary["statuses"]["deadlock"][key] for key in ("count", "denominator", "probability")} == {
        "count": 3, "denominator": 3, "probability": "1"}
    assert summary["statuses"]["deadlock"]["standard_error"] == "0"
    assert summary["statuses"]["deadlock"]["confidence_interval"]["upper"] == "1"
    assert summary["terminal_duration"]["mean"] is None
    assert summary["terminal_duration"]["sample_size"] == 0
    assert summary["terminal_outcomes"]["end"]["denominator"] == 3


def test_rework_cycle_repeats_and_reports_starts():
    m = model(nodes=[node("start", "start"), node("work"), node("rework"), node("end", "terminal")],
        activities=[activity("supply", outcomes=[outcome(target="work", produced={"token": "1"})]),
                    activity("test", "work", outcomes=[outcome("pass", "end", "0.8"),
                           outcome("fail", "rework", "0.2", {"token": "1"})]),
                    activity("repair", "rework", outcomes=[outcome(target="work", produced={"token": "1"})])])
    result = simulate(m, settings(realizations=200))
    assert any(r["activities"]["test"]["started"] >= 2 for r in result["runs"])
    assert all(r["status"] == "terminal" for r in result["runs"])
    assert F(result["summary"]["activities"]["test"]["mean_starts"]) > 1


client = TestClient(app)


def test_endpoints():
    data = model_data()
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.post("/api/models/validate", json=data).json()["valid"]
    response = client.post("/api/simulate", json={"model": data, "settings": settings().model_dump(mode="json")})
    assert response.status_code == 200
    assert response.json()["summary"]["terminal_duration"]["mean"] == "1"


def test_api_exact_json_decimal_parsing():
    import json
    data = model_data(nodes=[node("start", "start", {"token": "0.3000000000000000000000001"}),
                            node("end", "terminal")],
                      activities=[activity(requirements={"token": "0.1"})])
    body = json.dumps({"model": data, "settings": settings().model_dump(mode="json")})
    body = body.replace('"0.3000000000000000000000001"', '0.3000000000000000000000001')
    response = client.post("/api/simulate", content=body, headers={"content-type": "application/json"})
    assert response.status_code == 200
    assert response.json()["runs"][0]["inventory"]["start"]["token"] == "0.0000000000000000000000001"


@pytest.mark.parametrize("body", ['{"x": NaN}', '{"x": 1, "x": 2}', '{', 'null'])
def test_bad_json_or_schema(body):
    response = client.post("/api/models/validate", content=body)
    assert response.status_code == 422
    assert response.json()["diagnostics"][0]["severity"] == "error"


def test_invalid_model_api():
    data = model_data(activities=[activity(requirements={})])
    response = client.post("/api/models/validate", json=data)
    assert response.status_code == 200 and not response.json()["valid"]
    assert client.post("/api/simulate", json={"model": data, "settings": settings().model_dump(mode="json")}).status_code == 422

