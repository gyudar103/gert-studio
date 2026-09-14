"""Expose the same Pydantic contracts used by the lossless JSON adapters."""
from fastapi.openapi.utils import get_openapi
from app.schemas.model import Model, SimulationRequest
from app.validation import ValidationReport


def install_openapi(app):
    def openapi():
        if app.openapi_schema is not None:
            return app.openapi_schema
        document = get_openapi(title=app.title, version=app.version, routes=app.routes)
        components = document.setdefault("components", {}).setdefault("schemas", {})
        for contract in (Model, SimulationRequest, ValidationReport):
            schema = contract.model_json_schema(ref_template="#/components/schemas/{model}")
            components.update(schema.pop("$defs", {}))
            components[contract.__name__] = schema
        for path, name in (("/api/models/validate", "Model"), ("/api/simulate", "SimulationRequest")):
            operation = document["paths"][path]["post"]
            operation["requestBody"] = {
                "required": True,
                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/" + name}}},
            }
            operation["responses"]["422"] = {
                "description": "Malformed JSON, invalid schema, or invalid simulation model",
                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ValidationReport"}}},
            }
        document["paths"]["/api/models/validate"]["post"]["responses"]["200"] = {
            "description": "Validation diagnostics; valid is false for semantic model errors",
            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ValidationReport"}}},
        }
        app.openapi_schema = document
        return document
    app.openapi = openapi

