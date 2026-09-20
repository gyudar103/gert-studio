# GERT Studio Version 0.1 prototype

A browser editor and Python simulator for stochastic project networks: parallel
activities, named consumable items, synchronization, probabilistic outcomes and
rework cycles.

## Run locally

Install Docker with a running Linux engine. From this repository:

```sh
docker compose up --build -d
```

Open [GERT Studio](http://localhost:5173). The backend is on port 8000;
[API health](http://localhost:8000/api/health) should return `{"status":"ok"}`.
No host Node or Python installation is required.

Choose **Load demo**, then **Validate** and **Run Simulation** for a complete
example of parallel build, integration, testing, success/failure and rework.
The demo supplies visible example values. Blank models require explicit quantities,
probabilities, duration parameters and run limits; an omitted seed is generated
and returned by the backend.

Use **New blank** to create your own model. Add items, Start/State/Terminal nodes,
and connect node handles to create activities. Edit requirements and alternative
outcomes in Properties. **Fit View** brings the network into view as it grows.

**Export JSON** downloads the mathematical model. **Import JSON** validates a file
with the backend before replacing the current network. Decimal values retain their
exact text. Layout is regenerated on import; simulation settings stay separate.
Export before refreshing: there is no database or automatic browser persistence.
Incomplete drafts can be exported but must pass validation before import.

## Verify

With both services running:

```sh
docker compose exec -T frontend npm test
docker compose exec -T frontend npm run build
docker compose --profile test run --build --rm frontend-tests
docker compose exec -T backend python -m pytest tests -q -p no:cacheprovider
```

The optional test image installs Chromium inside Docker and tests against the real
API. Normal startup does not build that image.

## Scope and specifications

- [Product specification](docs/PRODUCT.md)
- [Mathematical semantics](docs/MODEL.md)
- [Backend architecture](docs/ARCHITECTURE.md)
- [Frontend architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Frontend and release verification report](docs/FRONTEND_M1_REPORT.md)

This is a local development prototype. Advanced charts, scenario comparison,
sensitivity analysis, costs, reusable capacity scheduling, authentication,
collaboration and production deployment hardening are outside this milestone.
Large simulations retain per-instance results and can use substantial memory.
