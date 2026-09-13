"""Canonical schemas. Decimal strings and JSON decimal tokens preserve precision."""
from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator


def exact_decimal(value):
    if isinstance(value, (bool, float)):
        raise ValueError("Use a decimal string or a losslessly parsed JSON number, not a binary float")
    if not isinstance(value, (str, int, Decimal)):
        raise ValueError("Expected a decimal number")
    try:
        result = Decimal(value)
    except Exception as exc:
        raise ValueError("Invalid decimal number") from exc
    if not result.is_finite():
        raise ValueError("Number must be finite")
    return result


Number = Annotated[Decimal, BeforeValidator(exact_decimal)]
Quantity = Annotated[Number, Field(ge=0)]
Identifier = Annotated[str, Field(min_length=1)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Fixed(Contract):
    type: Literal["fixed"]
    value: Quantity


class Uniform(Contract):
    type: Literal["uniform"]
    min: Quantity
    max: Quantity

    @model_validator(mode="after")
    def ordered(self):
        if self.min > self.max:
            raise ValueError("Require min <= max")
        return self


class Triangular(Contract):
    type: Literal["triangular"]
    min: Quantity
    mode: Quantity
    max: Quantity

    @model_validator(mode="after")
    def ordered(self):
        if not self.min <= self.mode <= self.max:
            raise ValueError("Require min <= mode <= max")
        return self


class BetaPERT(Triangular):
    type: Literal["beta-PERT"]
    shape: Annotated[Number, Field(gt=0, alias="lambda")]


Duration = Annotated[Fixed | Uniform | Triangular | BetaPERT, Field(discriminator="type")]


class Project(Contract):
    id: Identifier
    name: str


class ItemType(Contract):
    id: Identifier
    label: str


class NodeBase(Contract):
    id: Identifier
    label: str


class Start(NodeBase):
    type: Literal["start"]
    initial_inventory: dict[Identifier, Quantity]


class State(NodeBase):
    type: Literal["state"]


class Terminal(NodeBase):
    type: Literal["terminal"]
    outcome_code: Identifier
    outcome_label: str
    outcome_category: str


Node = Annotated[Start | State | Terminal, Field(discriminator="type")]


class Outcome(Contract):
    id: Identifier
    label: str
    probability: Annotated[Number, Field(ge=0, le=1)]
    target_node: Identifier
    produced_items: dict[Identifier, Quantity]


class Activity(Contract):
    id: Identifier
    label: str
    source_node: Identifier
    requirements: dict[Identifier, Quantity]
    duration: Duration
    outcomes: list[Outcome] = Field(min_length=1)


class Model(Contract):
    schema_version: Literal["0.1"]
    project: Project
    item_types: list[ItemType]
    nodes: list[Node]
    activities: list[Activity]
    ui_metadata: dict | None = None


class Settings(Contract):
    realizations: Annotated[int, Field(strict=True, gt=0)]
    max_activity_completions: Annotated[int, Field(strict=True, ge=0)]
    max_activity_instances: Annotated[int, Field(strict=True, ge=0)]
    max_simulation_time: Quantity
    seed: Annotated[int, Field(strict=True)] | None = None


class SimulationRequest(Contract):
    model: Model
    settings: Settings

