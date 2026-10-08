from __future__ import annotations

from datetime import datetime, timezone

from pymongo import ASCENDING, DESCENDING


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Repositories:
    def __init__(self, database):
        self.db = database
        self.users = database["users"]
        self.sessions = database["auth_sessions"]
        self.chat_sessions = database["chat_sessions"]
        self.feedback = database["chat_feedback"]
        self.connections = database["llm_connections"]
        self.audit_logs = database["audit_logs"]

    async def ensure_indexes(self) -> None:
        await self.users.create_index([("username", ASCENDING)], unique=True)
        await self.sessions.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        await self.sessions.create_index([("user_id", ASCENDING)])
        await self.chat_sessions.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        await self.chat_sessions.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        await self.feedback.create_index([("session_id", ASCENDING), ("message_id", ASCENDING)], unique=True)
        await self.feedback.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        await self.connections.create_index([("name", ASCENDING)], unique=True)
        await self.connections.create_index([("plans", ASCENDING)])
        await self.audit_logs.create_index([("timestamp", DESCENDING)])
        await self.audit_logs.create_index([("event", ASCENDING), ("timestamp", DESCENDING)])
        await self.audit_logs.create_index([("actor.username", ASCENDING), ("timestamp", DESCENDING)])
        await self.audit_logs.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)

    async def get_user_by_username(self, username: str):
        return await self.users.find_one({"username": username.lower()})

    async def get_user(self, user_id: str):
        from bson import ObjectId
        try:
            oid = ObjectId(user_id)
        except Exception:
            return None
        return await self.users.find_one({"_id": oid})

    async def list_user_sessions(self, user_id: str):
        cursor = self.chat_sessions.find({"user_id": user_id}).sort("updated_at", DESCENDING)
        return await cursor.to_list(length=200)

    async def get_chat(self, session_id: str, user_id: str):
        return await self.chat_sessions.find_one({"_id": session_id, "user_id": user_id})


async def seed_connection(repos: Repositories) -> None:
    if await repos.connections.count_documents({}) == 0:
        await repos.connections.insert_one({
            "name": "Built-in simulator", "provider": "mock", "model": "extractive-simulator",
            "base_url": "", "api_version": "", "temperature": 0, "max_tokens": 1200,
            "api_key_encrypted": "", "api_key_hint": "", "plans": ["basic", "standard", "premium"],
        })
