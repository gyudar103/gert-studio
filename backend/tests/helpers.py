from app.schemas.model import Model, Settings


def node(identity, kind="state", inventory=None):
    value = {"id": identity, "label": identity, "type": kind}
    if kind == "start":
        value["initial_inventory"] = inventory or {"token": "1"}
    if kind == "terminal":
        value.update(outcome_code=identity, outcome_label=identity, outcome_category="success")
    return value


def outcome(identity="done", target="end", probability="1", produced=None):
    return {"id": identity, "label": identity, "probability": probability,
            "target_node": target, "produced_items": produced or {}}


def activity(identity="a", source="start", requirements=None, duration="1", outcomes=None):
    return {"id": identity, "label": identity, "source_node": source,
            "requirements": requirements if requirements is not None else {"token": "1"},
            "duration": duration if isinstance(duration, dict) else {"type": "fixed", "value": duration},
            "outcomes": outcomes if outcomes is not None else [outcome()]}


def model_data(activities=None, nodes=None, items=None):
    return {"schema_version": "0.1", "project": {"id": "test", "name": "Test"},
            "item_types": [{"id": i, "label": i} for i in (items or ["token"])],
            "nodes": nodes or [node("start", "start"), node("end", "terminal")],
            "activities": activities if activities is not None else [activity()]}


def settings(**overrides):
    return Settings.model_validate({"realizations": 1, "seed": 42, "max_activity_completions": 100,
                                    "max_activity_instances": 100, "max_simulation_time": "100",
                                    **overrides})


def model(**kwargs):
    return Model.model_validate(model_data(**kwargs))

