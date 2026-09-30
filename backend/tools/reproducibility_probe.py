"""Export exact sampler values and complete results for cross-platform comparison.

Run this file on native Windows and inside Docker; compare the `results` objects
exactly. Environment metadata is intentionally separate. No approximate equality.
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.engine.numbers import decimal_text
from app.engine.randomness import REPRODUCIBILITY_VERSION, sample_duration, stream
from app.engine.service import simulate
from app.schemas.model import Model, SimulationRequest
from trace_legacy_beta import environment

FIXTURE = Path(__file__).resolve().parents[1] / "tests/fixtures/reproducibility-demo.json"


def corpus():
    request = SimulationRequest.model_validate_json(FIXTURE.read_text(encoding="utf-8-sig"))
    samples = {}
    definitions = [
        {"type": "fixed", "value": "0.100000000000000000001"},
        {"type": "uniform", "min": "0.1", "max": "3.7"},
        {"type": "triangular", "min": "0.1", "mode": "1.2", "max": "3.7"},
        *[{"type": "beta-PERT", "min": "0.1", "mode": mode, "max": "3.7", "lambda": shape}
          for mode, shape in (("1.2", "4"), ("0.1", "4"), ("3.7", "4"),
                              ("1.9", "0.125"), ("1.9", "20"), ("1.2", "1e-30"))],
    ]
    for definition in definitions:
        data = request.model.model_dump(mode="json", by_alias=True)
        data["activities"][0]["duration"] = definition
        distribution = Model.model_validate(data).activities[0].duration
        key = json.dumps(definition, sort_keys=True)
        samples[key] = [decimal_text(sample_duration(distribution,
                           stream(20260914, index, "probe", index % 3, "duration")))
                        for index in range(1024)]

    result = simulate(request.model, request.settings)
    assert result == simulate(request.model, request.settings, workers=4)
    reordered = request.model.model_dump(mode="json", by_alias=True)
    for field in ("nodes", "activities", "item_types"):
        reordered[field].reverse()
        for entry in reordered[field]:
            entry["label"] = "display-only rename"
    for activity in reordered["activities"]:
        activity["outcomes"].reverse()
    reordered["ui_metadata"] = {"zoom": 2, "positions": {"start": {"x": 100, "y": 200}}}
    assert result == simulate(Model.model_validate(reordered), request.settings, workers=3)
    longer = simulate(request.model, request.settings.model_copy(update={"realizations": 125}), workers=2)
    assert result["runs"] == longer["runs"][:100]
    return {"version": REPRODUCIBILITY_VERSION, "samples": samples, "demo": result,
            "invariance": {"workers_1_vs_4": True, "order_labels_ui_workers_3": True,
                           "prefix_100_of_125_workers_2": True}}


if __name__ == "__main__":
    results = corpus()
    encoded = json.dumps(results, sort_keys=True, separators=(",", ":"))
    print(json.dumps({"environment": environment(), "results": results,
                      "results_sha256": hashlib.sha256(encoded.encode()).hexdigest()}, indent=2))
