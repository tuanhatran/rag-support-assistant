from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse

from app.dependencies import consented_user, current_user
from app.llm import is_keyless_ollama
from app.observability import request_context
from app.schemas import MessageRequest

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/active-model")
async def active_model(request: Request, user=Depends(current_user)):
    connection = await request.app.state.container.auth.connection_for_plan(user["plan"])
    return {"plan": user["plan"], "name": connection["name"], "provider": connection["provider"], "model": connection["model"]}


@router.get("/sessions")
async def list_sessions(request: Request, user=Depends(current_user)):
    return await request.app.state.container.chat.list_sessions(user)


@router.post("/sessions", status_code=201)
async def create_session(request: Request, user=Depends(consented_user)):
    return await request.app.state.container.chat.create_session(user)


@router.get("/sessions/{session_id}")
async def get_session(request: Request, session_id: str, user=Depends(current_user)):
    return await request.app.state.container.chat.get_session(user, session_id)


@router.delete("/sessions/{session_id}")
async def delete_session(request: Request, session_id: str, user=Depends(current_user)):
    return await request.app.state.container.chat.delete_session(user, session_id, request)


@router.post("/sessions/{session_id}/messages")
async def send_message(request: Request, session_id: str, body: MessageRequest, user=Depends(consented_user)):
    container = request.app.state.container
    connection = await container.auth.connection_for_plan(user["plan"])
    if not is_keyless_ollama(connection):
        return await container.chat.ask(user, session_id, body.question, connection)
    stream = await container.chat.ask_streaming(user, session_id, body.question, connection)
    context = request_context.get()

    async def events():
        token = request_context.set(context)
        try:
            async for event, payload in stream:
                encoded = json.dumps(jsonable_encoder(payload), separators=(",", ":"))
                yield f"event: {event}\ndata: {encoded}\n\n"
        finally:
            request_context.reset(token)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
