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
    model_config = ConfigDict(extra="forbid", serialize_by_alias=True)


class Documentation(Contract):
    """Descriptive, user-entered metadata; never an input to sampling."""
    comments: str | None = None
    assumptions: str | None = None
    certainty: str | None = None
    explanation: str | None = None
    rationale: str | None = None
    references: str | None = None


class Fixed(Contract):
    type: Literal["fixed"]
    value: Quantity


class Uniform(Contract):
    type: Literal["uniform"]
    min: Quantity
    max: Quantity

    @model_validator(mode="after")
    def ordered(self):
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("Require min <= max")
        return self


class Triangular(Contract):
    type: Literal["triangular"]
    min: Quantity
    mode: Quantity
    max: Quantity

    @model_validator(mode="after")
    def ordered(self):
        supplied = [v for v in (self.min, self.mode, self.max) if v is not None]
        if supplied != sorted(supplied):
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
    documentation: Documentation | None = None


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
    documentation: Documentation | None = None


class Activity(Contract):
    id: Identifier
    label: str
    source_node: Identifier
    requirements: dict[Identifier, Quantity]
    duration: Duration
    outcomes: list[Outcome] = Field(min_length=1)
    duration_documentation: Documentation | None = None


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


class DraftFixed(Fixed):
    value: Quantity | None


class DraftUniform(Uniform):
    min: Quantity | None
    max: Quantity | None


class DraftTriangular(Triangular):
    min: Quantity | None
    mode: Quantity | None
    max: Quantity | None


class DraftBetaPERT(DraftTriangular):
    type: Literal["beta-PERT"]
    shape: Annotated[Number, Field(gt=0)] | None = Field(alias="lambda")


DraftDuration = Annotated[DraftFixed | DraftUniform | DraftTriangular | DraftBetaPERT,
                          Field(discriminator="type")]


class DraftOutcome(Outcome):
    probability: Annotated[Number, Field(ge=0, le=1)] | None


class DraftActivity(Activity):
    duration: DraftDuration | None
    outcomes: list[DraftOutcome] = Field(min_length=1)


class DraftModel(Model):
    activities: list[DraftActivity]


class SimulationRequest(Contract):
    model: DraftModel
    settings: Settings
