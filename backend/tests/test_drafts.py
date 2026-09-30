"""Draft persistence, readiness, and metadata must not weaken engine contracts."""
from copy import deepcopy
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.main import app
from app.schemas.model import DraftModel, Model
from app.validation import validate_model
from app.engine.service import InvalidModel, simulate
from app.engine.simulation import run_realization
from helpers import model_data, settings, outcome

client = TestClient(app)
NOTES = dict(comments="Review notes", assumptions="One request", certainty="Low / unverified",
             explanation="Pending a trial", rationale="Workshop estimate", references="Internal trial 2026")


@pytest.mark.parametrize("duration", [None, {"type": "fixed", "value": None},
    {"type": "uniform", "min": "0", "max": None},
    {"type": "triangular", "min": None, "mode": "2", "max": None},
    {"type": "beta-PERT", "min": None, "mode": None, "max": None, "lambda": None}])
def test_drafts_round_trip_and_reject_simulation_with_object_paths(duration):
    data = model_data()
    data["nodes"][0]["documentation"] = NOTES
    a = data["activities"][0]
    a["duration"] = duration
    a["duration_documentation"] = NOTES
    a["outcomes"][0].update(probability=None, documentation=NOTES)
    draft = DraftModel.model_validate(data)
    assert DraftModel.model_validate_json(draft.model_dump_json()) == draft
    serialized = draft.model_dump(mode="json", by_alias=True)
    assert serialized["activities"][0]["duration"] == duration
    assert serialized["activities"][0]["outcomes"][0]["probability"] is None
    assert serialized["activities"][0]["duration_documentation"] == NOTES
    report = client.post("/api/models/validate", json=data).json()
    assert report["valid"] and report["draft_valid"] and not report["simulation_ready"]
    missing = [d for d in report["diagnostics"] if d["code"] == "missing_input"]
    assert len(missing) >= 2
    assert all(d["element_id"] == "a" and d["path"][:2] == ["activities", 0] for d in missing)
    assert any("done" in d["message"] and d["path"][-1] == "probability" for d in missing)
    response = client.post("/api/simulate", json={"model": data, "settings": settings().model_dump(mode="json")})
    assert response.status_code == 422
    assert not response.json()["valid"] and response.json()["draft_valid"]
    assert all(d["severity"] == "error" for d in response.json()["diagnostics"] if d["code"] == "missing_input")
    with pytest.raises(InvalidModel):
        simulate(draft, settings())
    with pytest.raises(ValueError):
        run_realization(draft, settings(), 42, 0)
    with pytest.raises(ValidationError):
        Model.model_validate(data)


@pytest.mark.parametrize("duration", [
    {"type": "fixed", "value": "-1"}, {"type": "fixed", "value": ""},
    {"type": "uniform", "min": "3", "max": "2"},
    {"type": "triangular", "min": "3", "mode": None, "max": "2"},
    {"type": "triangular", "min": None, "mode": "3", "max": "2"},
    {"type": "beta-PERT", "min": None, "mode": None, "max": None, "lambda": "0"},
    {"type": "fixed", "value": "Infinity"}, {"type": "fixed", "value": True},
    {"type": "fixed"}, {"type": None}, {"type": "other"}])
def test_draft_invalid_supplied_duration_values_and_absent_fields_rejected(duration):
    data = model_data()
    data["activities"][0]["duration"] = duration
    data["activities"][0]["outcomes"][0]["probability"] = None
    assert client.post("/api/models/validate", json=data).status_code == 422


@pytest.mark.parametrize("probability", ["-0.1", "1.1", "NaN", "", True])
def test_draft_invalid_probability_rejected(probability):
    data = model_data()
    data["activities"][0].update(duration=None, outcomes=[outcome(probability=probability), outcome("unknown", probability=None)])
    assert client.post("/api/models/validate", json=data).status_code == 422


@pytest.mark.parametrize("mutation,code", [
    (lambda d: d["activities"][0].update(source_node="missing"), "source_reference"),
    (lambda d: d["activities"][0]["outcomes"][0].update(target_node="missing"), "target_reference"),
    (lambda d: d["activities"][0].update(requirements={"unknown": "1"}), "item_reference"),
    (lambda d: d["nodes"].append(deepcopy(d["nodes"][1])), "duplicate_id"),
    (lambda d: d["activities"][0].update(requirements={"token": "0"}), "positive_requirement")])
def test_draft_structural_errors_not_hidden_by_missing_inputs(mutation, code):
    data = model_data()
    data["activities"][0]["duration"] = None
    mutation(data)
    report = client.post("/api/models/validate", json=data).json()
    assert not report["valid"] and not report["draft_valid"]
    assert code in {d["code"] for d in report["diagnostics"]}


def test_partial_probability_sums_and_completion_preserve_tolerance():
    data = model_data()
    a = data["activities"][0]
    a["outcomes"] = [outcome("a", probability="0.7"), outcome("b", probability=None)]
    assert validate_model(DraftModel.model_validate(data), require_complete=False).valid
    a["outcomes"][1]["probability"] = "0.2"
    assert not validate_model(DraftModel.model_validate(data), require_complete=False).valid
    a["outcomes"][1]["probability"] = "0.30000000000001"
    assert validate_model(DraftModel.model_validate(data)).simulation_ready
    a["outcomes"][1]["probability"] = "0.300000000000011"
    assert not validate_model(DraftModel.model_validate(data)).valid
    a["outcomes"] = [outcome("a", probability="0.7"), outcome("b", probability="0.4"), outcome("c", probability=None)]
    report = validate_model(DraftModel.model_validate(data), require_complete=False)
    assert not report.draft_valid
    assert {d.code for d in report.diagnostics} >= {"missing_input", "probability_sum", "probability_interval"}


def test_metadata_does_not_change_seeded_realizations_or_aggregates():
    data = model_data()
    a = data["activities"][0]
    a["duration"] = {"type": "beta-PERT", "min": "0", "mode": "2", "max": "8", "lambda": "4"}
    a["outcomes"] = [outcome("a", probability="0.7"), outcome("b", probability="0.3")]
    before = simulate(Model.model_validate(data), settings(realizations=30))
    for n in data["nodes"]:
        n["documentation"] = NOTES
    a["duration_documentation"] = NOTES
    for o in a["outcomes"]:
        o["documentation"] = NOTES
    after = simulate(DraftModel.model_validate(data), settings(realizations=30), workers=3)
    assert after == before


def test_zero_is_complete_and_legacy_models_need_no_documentation():
    data = model_data()
    data["activities"][0]["duration"]["value"] = "0"
    draft = DraftModel.model_validate(data)
    assert draft.nodes[0].documentation is None
    assert validate_model(draft).simulation_ready
    assert simulate(draft, settings())["runs"][0]["status"] == "terminal"
