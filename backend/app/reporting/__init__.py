"""Deterministic reporting over all requested realizations."""
from fractions import Fraction
from app.engine.numbers import decimal_text, ratio_text
from app.engine.simulation import STATUSES
from app.reporting.uncertainty import mean_uncertainty, probability_uncertainty, quantile_interval

PERCENTILES = {f"p{percent}": Fraction(percent, 100) for percent in (5, 10, 20, 30, 50, 70, 80, 90, 95)}


def quantile(sorted_values, probability):
    """Linear interpolation at index (n - 1) p (Hyndman-Fan type 7)."""
    position = (len(sorted_values) - 1) * probability
    lower = position.numerator // position.denominator
    upper = min(lower + 1, len(sorted_values) - 1)
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * (position - lower)


def summarize(model, runs):
    n = len(runs)
    statuses = {status: {"count": sum(r.status == status for r in runs), "denominator": n}
                for status in STATUSES}
    for entry in statuses.values():
        entry["probability"] = ratio_text(Fraction(entry["count"], n))
        entry.update(probability_uncertainty(entry["count"], n))
    terminals = {}
    for node in sorted(model.nodes, key=lambda x: x.id):
        if node.type == "terminal":
            count = sum(r.terminal_node_id == node.id for r in runs)
            terminals[node.id] = {"outcome_code": node.outcome_code, "count": count,
                                  "denominator": n, "probability": ratio_text(Fraction(count, n)),
                                  **probability_uncertainty(count, n)}
    times = sorted(r.time for r in runs if r.status == "terminal")
    duration = {"sample_size": len(times),
                "conditioning": "terminal runs observed within configured limits",
                "mean": None, "median": None, "p50": None, "p80": None, "p90": None,
                "p95": None, "min": None, "max": None}
    duration.update({key: None for key in PERCENTILES})
    uncertainty = mean_uncertainty(times)
    duration.update(standard_deviation=uncertainty["standard_deviation"],
                    sample_standard_deviation=uncertainty["sample_standard_deviation"],
                    mean_standard_error=uncertainty["standard_error"],
                    mean_confidence_interval=uncertainty["confidence_interval"],
                    quantile_confidence_intervals={key: quantile_interval(times, p)
                                                   for key, p in PERCENTILES.items()})
    if times:
        duration.update(mean=ratio_text(sum(times, Fraction()) / len(times)),
                        min=decimal_text(times[0]), max=decimal_text(times[-1]))
        for key, p in {"median": Fraction(1, 2), **PERCENTILES}.items():
            duration[key] = decimal_text(quantile(times, p))
    activities = {}
    for activity in sorted(model.activities, key=lambda x: x.id):
        counts = [r.counts(activity.id) for r in runs]
        totals = {key: sum(c[key] for c in counts) for key in counts[0]}
        totals.update(denominator=n, mean_starts=ratio_text(Fraction(totals["started"], n)),
                      probability_at_least_one_start=ratio_text(Fraction(sum(c["started"] > 0 for c in counts), n)))
        starts_uncertainty = mean_uncertainty([Fraction(c["started"]) for c in counts])
        started_uncertainty = probability_uncertainty(sum(c["started"] > 0 for c in counts), n)
        totals.update(standard_deviation_starts=starts_uncertainty["standard_deviation"],
                      sample_standard_deviation_starts=starts_uncertainty["sample_standard_deviation"],
                      mean_starts_standard_error=starts_uncertainty["standard_error"],
                      mean_starts_confidence_interval=starts_uncertainty["confidence_interval"],
                      probability_at_least_one_start_standard_error=started_uncertainty["standard_error"],
                      probability_at_least_one_start_confidence_interval=started_uncertainty["confidence_interval"])
        activities[activity.id] = totals
    return {"realizations": n, "statuses": statuses, "terminal_outcomes": terminals,
            "terminal_duration": duration, "activities": activities,
            "cutoff_observations_are_truncated": True}


def run_payload(run, model):
    return {"realization_index": run.realization_index, "status": run.status,
            "last_processed_time": decimal_text(run.time), "terminal_node_id": run.terminal_node_id,
            "error": run.error,
            "inventory": {node: {r: decimal_text(q) for r, q in sorted(items.items())}
                          for node, items in sorted(run.inventory.items())},
            "activities": {a.id: run.counts(a.id) for a in sorted(model.activities, key=lambda x: x.id)},
            "instances": [{"activity_id": i.activity_id, "ordinal": i.ordinal,
                           "start": decimal_text(i.start), "scheduled_finish": decimal_text(i.scheduled_finish),
                           "duration": decimal_text(i.duration), "state": i.state,
                           "outcome_id": i.outcome_id, "unfinished_reason": i.unfinished_reason}
                          for i in run.instances]}

