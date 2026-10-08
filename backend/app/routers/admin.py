from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Request

from app.dependencies import require_admin
from app.errors import NotFoundError
from app.llm import complete, mock_answer
from app.schemas import ConnectionRequest, UserUpdateRequest
from app.security import decrypt_secret

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
    container = request.app.state.container
    try:
        connection = await container.repos.connections.find_one({"_id": ObjectId(connection_id)})
    except Exception:
        connection = None
    if not connection:
        raise NotFoundError("Connection not found")
    try:
        if connection["provider"] == "mock":
            answer = mock_answer([])
        else:
            api_key = decrypt_secret(container.settings.encryption_key, connection.get("api_key_encrypted", ""))
            answer = await complete(connection, api_key,
                [{"role": "system", "content": "Reply with a brief connection test confirmation."},
                 {"role": "user", "content": "Connection test"}], container.settings.llm_timeout_seconds)
        outcome = "success"
        result = {"ok": True, "message": answer[:240]}
    except Exception as exc:
        outcome = "failure"
        result = {"ok": False, "message": f"Connection test failed ({type(exc).__name__})"}
    await container.audit.record("admin.connection.tested", outcome, user, {"connection_id": connection_id},
                                 details={"provider": connection["provider"], "model": connection["model"]}, request=request)
    return result


@router.get("/users")
async def list_users(request: Request, user=Depends(require_admin)):
    records = await request.app.state.container.repos.users.find({}, {"username": 1, "role": 1, "plan": 1, "created_at": 1}).sort("username", 1).to_list(length=1000)
    return [{"id": str(item["_id"]), "username": item["username"], "role": item["role"],
             "plan": item["plan"], "created_at": item.get("created_at")} for item in records]


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdateRequest, request: Request, user=Depends(require_admin)):
    return await request.app.state.container.admin.update_user(user, user_id, body, request)


@router.get("/feedback")
async def feedback_list(request: Request, rating: str = Query(default="", pattern="^(up|down)?$"),
                        user=Depends(require_admin)):
    query = {"rating": rating} if rating else {}
    records = await request.app.state.container.repos.feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=1000)
    return records


@router.get("/feedback/stats")
async def feedback_stats(request: Request, user=Depends(require_admin)):
    records = await request.app.state.container.repos.feedback.find({}, {"rating": 1}).to_list(length=10000)
    total = len(records)
    helpful = sum(item.get("rating") == "up" for item in records)
    down = total - helpful
    return {"total": total, "helpful": helpful, "not_helpful": down,
            "satisfaction_percent": round(helpful / total * 100) if total else 0}


@router.get("/audit")
async def audit_list(request: Request, event: str = "", outcome: str = "", username: str = "",
                     user=Depends(require_admin)):
    return await request.app.state.container.admin.audit_list(event, outcome, username)
