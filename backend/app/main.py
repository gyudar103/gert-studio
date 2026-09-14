from fastapi import FastAPI
from app.api.routes import router
from app.api.openapi import install_openapi


app = FastAPI(
    title="GERT Studio API",
    version="0.1.0",
)

app.include_router(router)
install_openapi(app)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
