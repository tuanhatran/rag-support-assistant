from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.dependencies import consented_user, current_user
from app.errors import NotFoundError
from app.schemas import MessageRequest

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/active-model")
async def active_model(request: Request, user=Depends(current_user)):
    connection = await request.app.state.container.auth.connection_for_plan(user["plan"])
    return {"plan": user["plan"], "name": connection["name"], "provider": connection["provider"], "model": connection["model"]}


@router.get("/sessions")
async def list_sessions(request: Request, user=Depends(current_user)):
    sessions = await request.app.state.container.repos.list_user_sessions(str(user["_id"]))
    return [request.app.state.container.chat.serialize_session(item, include_messages=False) for item in sessions]


@router.post("/sessions", status_code=201)
async def create_session(request: Request, user=Depends(consented_user)):
    return await request.app.state.container.chat.create_session(user)


@router.get("/sessions/{session_id}")
async def get_session(request: Request, session_id: str, user=Depends(current_user)):
    session = await request.app.state.container.repos.get_chat(session_id, str(user["_id"]))
    if not session:
        raise NotFoundError("Conversation not found")
    return request.app.state.container.chat.serialize_session(session)


@router.delete("/sessions/{session_id}")
async def delete_session(request: Request, session_id: str, user=Depends(current_user)):
    repos = request.app.state.container.repos
    result = await repos.chat_sessions.delete_one({"_id": session_id, "user_id": str(user["_id"])})
    if not result.deleted_count:
        raise NotFoundError("Conversation not found")
    await repos.feedback.delete_many({"session_id": session_id, "user_id": str(user["_id"])})
    return {"ok": True}


@router.post("/sessions/{session_id}/messages")
async def send_message(request: Request, session_id: str, body: MessageRequest, user=Depends(consented_user)):
    return await request.app.state.container.chat.ask(user, session_id, body.question)
