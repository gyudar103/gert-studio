# GERT Studio Version 0.1 prototype

A browser editor and Python simulator for stochastic project networks: parallel
activities, named consumable items, synchronization, probabilistic outcomes and
rework cycles.

## Run on Windows

Download the portable Windows ZIP from the repository's GitHub Releases, extract
the entire folder, and run **GERT Studio.exe**. End users need no Python, Node.js,
npm, Git, Docker, WSL, or developer tools. Keep the control window open while using
the app; use **Exit GERT Studio** to stop it.
See [Windows distribution and build instructions](docs/WINDOWS_DISTRIBUTION.md).

## Optional Docker startup

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
Export before refreshing: model data has no database or automatic browser persistence.
Desktop panel separators resize the Model, Canvas, Properties, and Analysis areas;
panel sizes alone persist locally. Use **Reset layout** to restore default sizes.
Structurally valid drafts can be exported and imported with explicit `null` duration
distributions, parameters, and probabilities. Invalid supplied values still block
import. Complete missing inputs before simulation. Node, duration, and outcome notes
are edited in the properties panel and persist in JSON; certainty is descriptive only.

## Verify

Native Python 3.12 and Node/npm are the primary developer tools. Follow the
[native tests and packaged verification workflow](docs/WINDOWS_DISTRIBUTION.md#verify).
Release acceptance requires verification of the exact Windows candidate/artifact;
see the [verification report](docs/WINDOWS_VERIFICATION.md) for recorded evidence.
Docker checks below are optional unless Docker behavior changes.

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
