from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.dependencies import build_container, initialize_container
from app.errors import AuthenticationError, AuthorizationError, ConfigurationError, NotFoundError, ValidationError
from app.observability import RequestContextMiddleware, configure_logging
from app.routers import admin, auth, chat, documents, feedback, ingestion, privacy
from app.vectorstore import VectorStore


def create_app(
    settings: Settings | None = None,
    database=None,
    initialize: bool = True,
    vectorstore: VectorStore | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    container = build_container(settings, database=database, vectorstore=vectorstore)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        configure_logging(force=True, level=settings.log_level, log_format=settings.log_format)
        if initialize:
            await initialize_container(container)

        async def sweep_loop():
            while True:
                try:
                    await asyncio.sleep(3600)
                    if hasattr(container.vectorstore, "sweep_expired"):
                        await container.vectorstore.sweep_expired()
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    logging.getLogger("app.vectorstore").warning("Error during vectorstore sweep: %s", exc)

        sweep_task = asyncio.create_task(sweep_loop())
        try:
            yield
        finally:
            sweep_task.cancel()
            try:
                await sweep_task
            except asyncio.CancelledError:
                pass
            if container.client:
                await container.client.close()

    app = FastAPI(title="RAG Support Assistant", version="1.0.0", lifespan=lifespan)
    app.state.container = container
    app.add_middleware(RequestContextMiddleware)
    app.include_router(auth.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(documents.router, prefix="/api")
    app.include_router(feedback.router, prefix="/api")
    app.include_router(privacy.router, prefix="/api")
    app.include_router(admin.router, prefix="/api")
    app.include_router(ingestion.router, prefix="/api")

    @app.exception_handler(AuthenticationError)
    async def authentication_error(request: Request, exc: AuthenticationError):
        return JSONResponse({"detail": str(exc)}, status_code=401)

    @app.exception_handler(AuthorizationError)
    async def authorization_error(request: Request, exc: AuthorizationError):
        return JSONResponse({"detail": str(exc)}, status_code=403)

    @app.exception_handler(NotFoundError)
    async def not_found_error(request: Request, exc: NotFoundError):
        return JSONResponse({"detail": str(exc)}, status_code=404)

    @app.exception_handler(ValidationError)
    async def validation_error(request: Request, exc: ValidationError):
        return JSONResponse({"detail": str(exc)}, status_code=409)

    @app.exception_handler(ConfigurationError)
    async def configuration_error(request: Request, exc: ConfigurationError):
        return JSONResponse({"detail": str(exc)}, status_code=503)

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    return app