"""Event-driven resource-flow simulation with atomic batches and launch sets."""
from collections import defaultdict
from dataclasses import dataclass
from fractions import Fraction
import heapq

from app.engine.randomness import SamplingError, sample_duration, select_outcome, stream
from app.validation import validate_model

STATUSES = ("terminal", "deadlock", "ambiguous_resource_competition", "ambiguous_terminal",
            "cutoff_time", "cutoff_activity_count", "cutoff_instance_count", "invalid_runtime_state")


@dataclass
class Instance:
    activity_id: str
    ordinal: int
    start: Fraction
    scheduled_finish: Fraction
    duration: Fraction
    state: str = "running"
    outcome_id: str | None = None
    unfinished_reason: str | None = None


@dataclass
class Run:
    realization_index: int
    status: str
    time: Fraction
    terminal_node_id: str | None
    instances: list[Instance]
    inventory: dict[str, dict[str, Fraction]]
    error: str | None = None

    def counts(self, activity_id):
        instances = [i for i in self.instances if i.activity_id == activity_id]
        result = {"started": len(instances), "completed": 0, "cancelled": 0,
                  "unfinished_at_run_end": 0, "unfinished_at_cutoff": 0,
                  "unfinished_at_ambiguity": 0, "unfinished_at_invalid_runtime": 0}
        for instance in instances:
            result[instance.state] += 1
            if instance.unfinished_reason:
                result["unfinished_at_" + instance.unfinished_reason] += 1
        assert result["started"] == result["completed"] + result["cancelled"] + result["unfinished_at_run_end"]
        return result


def run_realization(model, settings, root_seed, realization_index, *, validated=False):
    if not validated:
        report = validate_model(model)
        if not report.valid:
            raise ValueError(report.model_dump())
    inventory = {n.id: {r: Fraction(q) for r, q in getattr(n, "initial_inventory", {}).items()}
                 for n in model.nodes}
    activities = sorted(model.activities, key=lambda a: a.id)
    by_id = {a.id: a for a in activities}
    nodes = {n.id: n for n in model.nodes}
    instances = []
    queue = []
    ordinals = defaultdict(int)
    time = Fraction()
    completed = 0

    def finish(status, terminal=None, error=None):
        reason = ("cutoff" if status.startswith("cutoff") else
                  "ambiguity" if status.startswith("ambiguous") else "invalid_runtime")
        for instance in instances:
            if instance.state == "running":
                instance.state = "cancelled" if status == "terminal" else "unfinished_at_run_end"
                instance.unfinished_reason = None if status == "terminal" else reason
        return Run(realization_index, status, time, terminal, instances, inventory, error)

    while True:
        launch = []
        demand = defaultdict(Fraction)
        for activity in activities:
            quantities = inventory[activity.source_node]
            multiplicity = min(quantities.get(r, Fraction()) // Fraction(q)
                               for r, q in activity.requirements.items() if q > 0)
            if multiplicity:
                launch.append((activity, multiplicity))
                for r, q in activity.requirements.items():
                    demand[activity.source_node, r] += multiplicity * Fraction(q)
        if any(q > inventory[node].get(r, Fraction()) for (node, r), q in demand.items()):
            return finish("ambiguous_resource_competition")
        if len(instances) + sum(k for _, k in launch) > settings.max_activity_instances:
            return finish("cutoff_instance_count")
        # Prepare numerical samples before committing consumption. On numerical failure,
        # existing running instances retain their lifecycle and no partial launch is admitted.
        prepared = []
        try:
            for activity, multiplicity in launch:
                for offset in range(multiplicity):
                    ordinal = ordinals[activity.id] + offset
                    duration = sample_duration(activity.duration, stream(
                        root_seed, realization_index, activity.id, ordinal, "duration"))
                    if duration < 0:
                        raise SamplingError("Negative sampled duration")
                    prepared.append(Instance(activity.id, ordinal, time, time + duration, duration))
        except (ArithmeticError, ValueError) as exc:
            return finish("invalid_runtime_state", error=str(exc))
        for instance in prepared:
            activity = by_id[instance.activity_id]
            quantities = inventory[activity.source_node]
            for r, q in activity.requirements.items():
                quantities[r] = quantities.get(r, Fraction()) - Fraction(q)
            ordinals[activity.id] += 1
            instances.append(instance)
            heapq.heappush(queue, (instance.scheduled_finish, instance.activity_id,
                                  instance.ordinal, len(instances) - 1))
        if not queue:
            return finish("deadlock")
        next_time = queue[0][0]
        if next_time > Fraction(settings.max_simulation_time):
            return finish("cutoff_time")
        batch = []
        while queue and queue[0][0] == next_time:
            batch.append(heapq.heappop(queue))
        if completed + len(batch) > settings.max_activity_completions:
            return finish("cutoff_activity_count")
        selected = []
        try:
            for _, activity_id, ordinal, index in batch:
                outcome = select_outcome(by_id[activity_id].outcomes, stream(
                    root_seed, realization_index, activity_id, ordinal, "outcome"))
                selected.append((instances[index], outcome))
        except (ArithmeticError, ValueError) as exc:
            return finish("invalid_runtime_state", error=str(exc))
        time = next_time
        terminals = set()
        for instance, outcome in selected:
            for r, q in outcome.produced_items.items():
                target = inventory[outcome.target_node]
                target[r] = target.get(r, Fraction()) + Fraction(q)
            instance.state = "completed"
            instance.outcome_id = outcome.id
            completed += 1
            if nodes[outcome.target_node].type == "terminal":
                terminals.add(outcome.target_node)
        if len(terminals) > 1:
            return finish("ambiguous_terminal")
        if terminals:
            return finish("terminal", next(iter(terminals)))
