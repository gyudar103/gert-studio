from fractions import Fraction as F
import pytest
from app.engine.simulation import run_realization
from app.schemas.model import Model
from helpers import activity, model, model_data, node, outcome, settings


def run(m=None, **limits):
    return run_realization(m or model(), settings(**limits), 42, 0)


def parallel(durations=("3", "5", "8"), terminal_targets=False):
    items = ["m", "e", "s"]
    start = node("start", "start", {i: "1" for i in items})
    acts = [activity(i, requirements={i: "1"}, duration=d,
                     outcomes=[outcome(target="end" if terminal_targets else "join", produced={i: "1"})])
            for i, d in zip(items, durations)]
    if not terminal_targets:
        acts.append(activity("integration", "join", {i: "1" for i in items}, "2"))
    return model(nodes=[start, node("join"), node("end", "terminal")], activities=acts, items=items)


def test_linear():
    r = run()
    assert (r.status, r.time, r.terminal_node_id) == ("terminal", F(1), "end")
    assert r.counts("a")["completed"] == 1


def test_parallel_integration_and_synchronization():
    r = run(parallel())
    integration = next(i for i in r.instances if i.activity_id == "integration")
    assert integration.start == 8
    assert r.time == 10
    assert r.inventory["join"] == {"m": 0, "e": 0, "s": 0}


def test_all_same_time_production_before_start():
    r = run(parallel(("2", "2", "2")))
    assert r.status == "terminal"
    assert next(i for i in r.instances if i.activity_id == "integration").start == 2


def test_decimal_equal_timestamps_and_ambiguous_terminals():
    m = model(items=["a", "b"], nodes=[node("start", "start", {"a": "1", "b": "1"}),
                  node("mid"), node("end", "terminal"), node("end2", "terminal")],
              activities=[activity("a", requirements={"a": "1"}, duration="0.1",
                                   outcomes=[outcome(target="mid", produced={"a": "1"})]),
                          activity("b", requirements={"b": "1"}, duration="0.3"),
                          activity("c", "mid", {"a": "1"}, "0.2", [outcome(target="end2")])])
    r = run(m)
    assert r.status == "ambiguous_terminal"
    assert r.time == F("0.3")
    assert all(i.state == "completed" for i in r.instances)


def test_no_timestamp_epsilon():
    r = run(parallel(("0.3", "0.30000000000000000000001", "2"), True))
    assert r.status == "terminal"
    assert r.time == F("0.3")
    assert sum(i.state == "cancelled" for i in r.instances) == 2


def test_same_terminal_multiple_arrivals():
    r = run(parallel(("1", "1", "1"), True))
    assert r.status == "terminal"
    assert sum(i.state == "completed" for i in r.instances) == 3
    assert r.inventory["end"] == {"m": 1, "e": 1, "s": 1}


def test_multiplicity_and_exact_inventory():
    m = model(nodes=[node("start", "start", {"token": "0.3"}), node("end", "terminal")],
              activities=[activity(requirements={"token": "0.1"})])
    r = run(m)
    assert r.counts("a")["started"] == 3
    assert [i.ordinal for i in r.instances] == [0, 1, 2]
    assert r.inventory["start"]["token"] == 0


def test_multiplicity_while_definition_still_running():
    m = model(items=["token", "later"], nodes=[
        node("start", "start", {"token": "1", "later": "1"}), node("work"), node("end", "terminal")],
        activities=[activity("supply1", duration="0", outcomes=[outcome(target="work", produced={"token": "1"})]),
                    activity("supply2", requirements={"later": "1"}, duration="1",
                             outcomes=[outcome(target="work", produced={"token": "1"})]),
                    activity("worker", "work", duration="5")])
    r = run(m)
    workers = [i for i in r.instances if i.activity_id == "worker"]
    assert [i.start for i in workers] == [0, 1]
    assert [i.state for i in workers] == ["completed", "cancelled"]


def test_aggregate_competition_precedes_instance_cutoff():
    m = model(nodes=[node("start", "start", {"token": "2"}), node("end", "terminal")],
              activities=[activity("a"), activity("b"), activity("c")])
    r = run(m, max_activity_instances=0)
    assert r.status == "ambiguous_resource_competition"
    assert not r.instances
    assert r.inventory["start"]["token"] == 2


def test_launch_set_limit_atomic():
    r = run(parallel(), max_activity_instances=2)
    assert r.status == "cutoff_instance_count"
    assert not r.instances
    assert r.inventory["start"] == {"m": 1, "e": 1, "s": 1}


@pytest.mark.parametrize("limits,status,completed", [
    ({"max_activity_completions": 2}, "cutoff_activity_count", 0),
    ({"max_activity_completions": 3}, "terminal", 3),
    ({"max_simulation_time": "0", "max_activity_completions": 0}, "cutoff_time", 0),
    ({"max_simulation_time": "1", "max_activity_completions": 3}, "terminal", 3),
])
def test_atomic_batch_and_cutoff_precedence(limits, status, completed):
    r = run(parallel(("1", "1", "1"), True), **limits)
    assert r.status == status
    assert sum(i.state == "completed" for i in r.instances) == completed
    if not completed:
        assert not r.inventory["end"]
        assert all(i.outcome_id is None for i in r.instances)
        assert all(i.unfinished_reason == "cutoff" for i in r.instances)


def test_ambiguity_preserves_running_work():
    m = parallel(("1", "1", "5"), True)
    data = m.model_dump(mode="json", by_alias=True)
    data["nodes"].append(node("end2", "terminal"))
    data["activities"][1]["outcomes"][0]["target_node"] = "end2"
    r = run(Model.model_validate(data))
    assert r.status == "ambiguous_terminal"
    assert sum(i.unfinished_reason == "ambiguity" for i in r.instances) == 1
    for a in m.activities:
        r.counts(a.id)


def test_deadlock():
    m = model(activities=[activity(requirements={"token": "2"})])
    assert run(m).status == "deadlock"


def cycle(duration="0"):
    return model(nodes=[node("start", "start"), node("work"), node("end", "terminal")],
        activities=[activity("supply", duration="0", outcomes=[outcome(target="work", produced={"token": "1"})]),
                    activity("repeat", "work", duration=duration,
                             outcomes=[outcome(target="work", produced={"token": "1"})])])


def test_zero_time_cycle_and_exact_horizon():
    r = run(cycle(), max_simulation_time="0", max_activity_completions=5)
    assert r.status == "cutoff_activity_count"
    assert r.time == 0
    assert r.counts("repeat")["completed"] == 4
    assert r.counts("repeat")["unfinished_at_cutoff"] == 1


def test_instance_cutoff_at_exact_limit():
    r = run(cycle(), max_activity_instances=5)
    assert r.status == "cutoff_instance_count"
    assert len(r.instances) == 5
    assert all(i.state == "completed" for i in r.instances)


def test_zero_chain_terminal_at_horizon_and_exact_count_limits():
    m = model(nodes=[node("start", "start"), node("mid"), node("end", "terminal")],
              activities=[activity("a", duration="0", outcomes=[outcome(target="mid", produced={"token": "1"})]),
                          activity("b", "mid", duration="0")])
    assert run(m, max_simulation_time="0", max_activity_completions=2, max_activity_instances=2).status == "terminal"


def test_invalid_runtime_classification_preserves_invariant(monkeypatch):
    import app.engine.simulation as simulation
    from app.engine.randomness import SamplingError
    original = simulation.sample_duration
    def sample(d, rng):
        if d.value == 5:
            raise SamplingError("injected numerical fault")
        return original(d, rng)
    monkeypatch.setattr(simulation, "sample_duration", sample)
    r = run(parallel())
    assert r.status == "invalid_runtime_state"
    assert not r.instances
    assert r.inventory["start"] == {"m": 1, "e": 1, "s": 1}


def test_blocked_batch_does_not_sample_outcomes(monkeypatch):
    import app.engine.simulation as simulation
    def forbidden(*args):
        pytest.fail("Blocked batch outcome sampled")
    monkeypatch.setattr(simulation, "select_outcome", forbidden)
    assert run(max_activity_completions=0).status == "cutoff_activity_count"
    assert run(max_simulation_time="0").status == "cutoff_time"

