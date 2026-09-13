"""Model diagnostics independent of HTTP."""
from collections import Counter, defaultdict
from fractions import Fraction
from typing import Literal
import networkx as nx
from pydantic import BaseModel, ValidationError
from app.schemas.model import Model

PROBABILITY_EPSILON = Fraction(1, 10**14)


class Diagnostic(BaseModel):
    severity: Literal["error", "warning", "info"]
    code: str
    message: str
    path: list[str | int]
    element_id: str | None = None


class ValidationReport(BaseModel):
    valid: bool
    diagnostics: list[Diagnostic]


def schema_diagnostics(exc: ValidationError) -> list[Diagnostic]:
    return [Diagnostic(severity="error", code="schema", message=e["msg"],
                       path=list(e["loc"])) for e in exc.errors(include_url=False)]


def validate_model(model: Model) -> ValidationReport:
    diagnostics = []

    def emit(code, message, path, element=None, severity="error"):
        diagnostics.append(Diagnostic(severity=severity, code=code, message=message,
                                      path=path, element_id=element))

    for field in ("nodes", "activities", "item_types"):
        seen = set()
        for i, entry in enumerate(getattr(model, field)):
            if entry.id in seen:
                emit("duplicate_id", "ID must be unique in this collection", [field, i, "id"], entry.id)
            seen.add(entry.id)
    nodes = {n.id: n for n in model.nodes}
    items = {r.id for r in model.item_types}
    starts = [n for n in model.nodes if n.type == "start"]
    if len(starts) != 1:
        emit("start_count", "Exactly one Start node is required", ["nodes"])
    codes = Counter(n.outcome_code for n in model.nodes if n.type == "terminal")
    for i, n in enumerate(model.nodes):
        if n.type == "terminal" and codes[n.outcome_code] > 1:
            emit("terminal_code", "Terminal outcome_code must be unique", ["nodes", i, "outcome_code"], n.id)
        if n.type == "start":
            for r in n.initial_inventory:
                if r not in items:
                    emit("item_reference", "Initial item is not declared", ["nodes", i, "initial_inventory", r], n.id)

    graph = nx.DiGraph()
    graph.add_nodes_from(nodes)
    consumers = defaultdict(set)
    producers = defaultdict(set)
    supplies = set()
    for n in starts:
        supplies.update((n.id, r) for r, q in n.initial_inventory.items() if q > 0)

    for i, a in enumerate(model.activities):
        path = ["activities", i]
        source = nodes.get(a.source_node)
        if source is None:
            emit("source_reference", "Source node does not exist", path + ["source_node"], a.id)
        elif source.type == "terminal":
            emit("terminal_source", "Terminal nodes cannot have outgoing activities", path + ["source_node"], a.id)
        if not any(q > 0 for q in a.requirements.values()):
            emit("positive_requirement", "At least one positive consumable requirement is required", path + ["requirements"], a.id)
        for r, q in a.requirements.items():
            if r not in items:
                emit("item_reference", "Required item is not declared", path + ["requirements", r], a.id)
            if q > 0:
                consumers[a.source_node, r].add(a.id)
        outcome_ids = set()
        for j, o in enumerate(a.outcomes):
            op = path + ["outcomes", j]
            if o.id in outcome_ids:
                emit("outcome_id", "Outcome ID must be unique within its activity", op + ["id"], a.id)
            outcome_ids.add(o.id)
            target = nodes.get(o.target_node)
            if target is None:
                emit("target_reference", "Target node does not exist", op + ["target_node"], a.id)
            elif target.type == "start":
                emit("start_target", "Outcomes cannot target Start", op + ["target_node"], a.id)
            if source is not None and target is not None and o.probability > 0:
                graph.add_edge(source.id, target.id)
            for r, q in o.produced_items.items():
                if r not in items:
                    emit("item_reference", "Produced item is not declared", op + ["produced_items", r], a.id)
                if q > 0 and o.probability > 0:
                    producers[o.target_node, r].add(a.id)
        ordered = sorted(a.outcomes, key=lambda o: o.id)
        total = sum((Fraction(o.probability) for o in ordered), Fraction())
        if abs(total - 1) > PROBABILITY_EPSILON:
            emit("probability_sum", "Outcome total must be within 1e-14 of one; values are not normalized", path + ["outcomes"], a.id)
        final = 1 - sum((Fraction(o.probability) for o in ordered[:-1]), Fraction())
        if not 0 <= final <= 1:
            emit("probability_interval", "Final effective sampling interval must lie in [0,1]", path + ["outcomes"], a.id)

    if any(d.severity == "error" for d in diagnostics):
        return ValidationReport(valid=False, diagnostics=diagnostics)

    reachable = {starts[0].id} | nx.descendants(graph, starts[0].id)
    for i, n in enumerate(model.nodes):
        if n.id not in reachable:
            emit("unreachable", "No positive-probability graph path from Start; item reachability may be more restrictive",
                 ["nodes", i], n.id, "warning")
    for (node, item), group in sorted(consumers.items()):
        if len(group) > 1:
            emit("possible_competition", f"Activities may compete for {item}; runtime aggregate demand decides",
                 ["nodes"], node, "warning")
        if (node, item) not in supplies and (node, item) not in producers:
            emit("unavailable_item", f"Required item {item} has no apparent supply here; possible deadlock",
                 ["nodes"], node, "warning")
    for node, item in sorted(set(producers) | supplies):
        if (node, item) not in consumers and nodes[node].type != "terminal":
            emit("unused_item", f"Item {item} has no consumer at this node", ["nodes"], node, "warning")
    cyclic = [c for c in nx.strongly_connected_components(graph)
              if len(c) > 1 or any(graph.has_edge(v, v) for v in c)]
    for component in sorted(cyclic, key=lambda c: sorted(c)):
        emit("possible_cycle", "Cycle may repeat indefinitely or generate unbounded inventory; safety limits apply",
             ["nodes"], sorted(component)[0], "warning")
    terminals = [n.id for n in model.nodes if n.type == "terminal"]
    if len(set(terminals) & reachable) > 1:
        emit("possible_ambiguous_terminal", "Multiple reachable terminals may coincide; runtime batches decide",
             ["nodes"], severity="warning")
    if not set(terminals) & reachable:
        emit("possible_deadlock", "No terminal has an apparent path from Start", ["nodes"], severity="warning")
    return ValidationReport(valid=True, diagnostics=diagnostics)

