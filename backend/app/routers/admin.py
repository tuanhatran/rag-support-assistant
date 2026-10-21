from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.dependencies import require_admin
from app.schemas import ConnectionRequest, UserUpdateRequest

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/connections")
async def list_connections(request: Request, user=Depends(require_admin)):
    return await request.app.state.container.admin.list_connections()


@router.post("/connections", status_code=201)
async def create_connection(body: ConnectionRequest, request: Request, user=Depends(require_admin)):
    connection = await request.app.state.container.admin.save_connection(user, body, request)
    return request.app.state.container.admin.safe_connection(connection)


@router.patch("/connections/{connection_id}")
async def update_connection(connection_id: str, body: ConnectionRequest, request: Request, user=Depends(require_admin)):
    connection = await request.app.state.container.admin.save_connection(user, body, request, connection_id)
    return request.app.state.container.admin.safe_connection(connection)


@router.delete("/connections/{connection_id}")
async def delete_connection(connection_id: str, request: Request, user=Depends(require_admin)):
    await request.app.state.container.admin.delete_connection(user, connection_id, request)
    return {"ok": True}


@router.post("/connections/{connection_id}/test")
async def test_connection(connection_id: str, request: Request, user=Depends(require_admin)):
    return await request.app.state.container.admin.test_connection(user, connection_id, request)


@router.get("/users")
async def list_users(request: Request, user=Depends(require_admin)):
    return await request.app.state.container.admin.list_users()


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdateRequest, request: Request, user=Depends(require_admin)):
    return await request.app.state.container.admin.update_user(user, user_id, body, request)


@router.get("/feedback")
async def feedback_list(request: Request, rating: str = Query(default="", pattern="^(up|down)?$"),
                        user=Depends(require_admin)):
    return await request.app.state.container.admin.list_feedback(rating)


@router.get("/feedback/stats")
async def feedback_stats(request: Request, user=Depends(require_admin)):
    return await request.app.state.container.admin.feedback_stats()


@router.get("/audit")
async def audit_list(request: Request, event: str = Query(default="", max_length=100),
                     outcome: str = Query(default="", max_length=100),
                     username: str = Query(default="", max_length=100),
                     user=Depends(require_admin)):
    return await request.app.state.container.admin.audit_list(event, outcome, username)
