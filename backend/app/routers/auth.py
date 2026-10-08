from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.dependencies import current_user
from app.schemas import LoginRequest, RegisterRequest
from app.services import PLANS

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE_NAME = "rag-support-assistant"


def set_session_cookie(response: Response, token: str, settings):
    response.set_cookie(COOKIE_NAME, token, httponly=True, secure=settings.cookie_secure,
                        samesite="strict", path="/api", max_age=settings.session_ttl_hours * 3600)


@router.get("/plans")
async def plans(request: Request):
    output = []
    for plan_info in PLANS:
        plan = plan_info["id"]
        connection = await request.app.state.container.repos.connections.find_one({"plans": plan})
        output.append({**plan_info, "model": connection.get("model") if connection else None,
                       "connection": connection.get("name") if connection else None})
    return output


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, request: Request, response: Response):
    container = request.app.state.container
    user = await container.auth.register(body, request)
    _, token = await container.auth.login(user["username"], body.password, request)
    set_session_cookie(response, token, container.settings)
    return await container.auth.me(user)


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response):
    container = request.app.state.container
    user, token = await container.auth.login(body.username, body.password, request)
    set_session_cookie(response, token, container.settings)
    return await container.auth.me(user)


@router.post("/logout")
async def logout(request: Request, response: Response, user=Depends(current_user)):
    container = request.app.state.container
    await container.auth.logout(user, request.cookies.get(COOKIE_NAME), request)
    response.delete_cookie(COOKIE_NAME, path="/api", httponly=True, secure=container.settings.cookie_secure, samesite="strict")
    return {"ok": True}


@router.get("/me")
async def me(request: Request, user=Depends(current_user)):
    return await request.app.state.container.auth.me(user)
