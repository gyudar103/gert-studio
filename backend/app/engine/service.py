"""Validated Monte Carlo orchestration, independent of FastAPI."""
from concurrent.futures import ThreadPoolExecutor
import secrets
from app.engine.randomness import ENGINE_VERSION, REPRODUCIBILITY_VERSION
from app.engine.simulation import run_realization
from app.reporting import run_payload, summarize
from app.validation import validate_model


class InvalidModel(ValueError):
    def __init__(self, report):
        self.report = report
        super().__init__("Model validation failed")


def simulate(model, settings, *, workers=1):
    if workers < 1:
        raise ValueError("workers must be positive")
    report = validate_model(model)
    if not report.valid:
        raise InvalidModel(report)
    seed = settings.seed if settings.seed is not None else secrets.randbits(128)

    def run(index):
        return run_realization(model, settings, seed, index, validated=True)

    if workers == 1:
        runs = [run(index) for index in range(settings.realizations)]
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            runs = list(pool.map(run, range(settings.realizations)))
    return {"root_seed": seed, "engine_version": ENGINE_VERSION,
            "reproducibility_version": REPRODUCIBILITY_VERSION,
            "settings": settings.model_copy(update={"seed": seed}).model_dump(mode="json"),
            "validation": report.model_dump(mode="json"),
            "summary": summarize(model, runs),
            "runs": [run_payload(r, model) for r in runs]}

