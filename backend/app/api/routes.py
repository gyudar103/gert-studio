"""Thin HTTP adapters; parse JSON decimals before Pydantic sees them."""
import json
from decimal import Decimal
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from app.schemas.model import Model, SimulationRequest
from app.validation import Diagnostic, ValidationReport, schema_diagnostics, validate_model
from app.engine.service import InvalidModel, simulate

router = APIRouter()


def reject_constant(value):
    raise ValueError("Nonfinite JSON number: " + value)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key: " + key)
        result[key] = value
    return result


async def parse(request, contract):
    raw = json.loads(await request.body(), parse_float=Decimal,
                     parse_constant=reject_constant, object_pairs_hook=unique_object)
    return contract.model_validate(raw)


def bad_input(exc):
    diagnostics = (schema_diagnostics(exc) if isinstance(exc, ValidationError) else
                   [Diagnostic(severity="error", code="json", message=str(exc), path=[])])
    return JSONResponse(status_code=422, content=ValidationReport(
        valid=False, diagnostics=diagnostics).model_dump(mode="json"))


@router.post("/api/models/validate")
async def validate(request: Request):
    try:
        model = await parse(request, Model)
    except (ValueError, UnicodeError) as exc:
        return bad_input(exc)
    return validate_model(model)


@router.post("/api/simulate")
async def simulation(request: Request):
    try:
        payload = await parse(request, SimulationRequest)
    except (ValueError, UnicodeError) as exc:
        return bad_input(exc)
    try:
        return await run_in_threadpool(simulate, payload.model, payload.settings)
    except InvalidModel as exc:
        return JSONResponse(status_code=422, content=exc.report.model_dump(mode="json"))

