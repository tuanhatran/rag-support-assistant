from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.dependencies import build_container, initialize_container
from app.errors import AuthenticationError, AuthorizationError, ConfigurationError, NotFoundError, ValidationError
from app.observability import RequestContextMiddleware, configure_logging
from app.routers import admin, auth, chat, documents, feedback, privacy


def create_app(settings: Settings | None = None, database=None, initialize: bool = True) -> FastAPI:
    settings = settings or get_settings()
    container = build_container(settings, database=database)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        configure_logging(force=True, level=settings.log_level, log_format=settings.log_format)
        if initialize:
            await initialize_container(container)
        yield
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