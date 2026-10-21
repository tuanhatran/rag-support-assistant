from __future__ import annotations

import re
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ASCENDING, DESCENDING


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_object_id(value: str | ObjectId | None) -> ObjectId | None:
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str):
        try:
            return ObjectId(value)
        except (InvalidId, TypeError):
            return None
    return None


class Repositories:
    def __init__(self, database):
        self.db = database
        self.users = database["users"]
        self.sessions = database["auth_sessions"]
        self.chat_sessions = database["chat_sessions"]
        self.feedback = database["chat_feedback"]
        self.connections = database["llm_connections"]
        self.audit_logs = database["audit_logs"]
        self.ingestion_pipelines = database["ingestion_pipelines"]

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
        await self.ingestion_pipelines.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        await self.ingestion_pipelines.create_index([("created_at", DESCENDING)])

    # Users

    async def get_user_by_username(self, username: str):
        return await self.users.find_one({"username": username.lower()})

    async def get_user(self, user_id: str | ObjectId | None):
        oid = parse_object_id(user_id)
        if oid is None:
            return None
        return await self.users.find_one({"_id": oid})

    async def insert_user(self, user: dict) -> ObjectId:
        result = await self.users.insert_one(user)
        return result.inserted_id

    async def update_user(self, user_id: ObjectId, changes: dict) -> None:
        await self.users.update_one({"_id": user_id}, {"$set": changes})

    async def delete_user(self, user_id: ObjectId) -> None:
        await self.users.delete_one({"_id": user_id})

    async def count_admins(self) -> int:
        return await self.users.count_documents({"role": "admin"})

    async def list_users(self, limit: int = 1000) -> list[dict]:
        cursor = self.users.find({}, {"username": 1, "role": 1, "plan": 1, "created_at": 1}).sort("username", 1)
        return await cursor.to_list(length=limit)

    # Sessions

    async def insert_session(self, session: dict) -> None:
        await self.sessions.insert_one(session)

    async def get_session(self, token_hash: str):
        return await self.sessions.find_one({"_id": token_hash, "expires_at": {"$gt": utcnow()}})

    async def delete_session(self, token_hash: str) -> None:
        await self.sessions.delete_one({"_id": token_hash})

    async def delete_sessions_for_user(self, user_id: str) -> None:
        await self.sessions.delete_many({"user_id": user_id})

    # LLM connections

    async def get_connection(self, connection_id: str | ObjectId | None):
        oid = parse_object_id(connection_id)
        if oid is None:
            return None
        return await self.connections.find_one({"_id": oid})

    async def get_connection_by_name(self, name: str):
        return await self.connections.find_one({"name": name})

    async def find_connection_for_plan(self, plan: str):
        return await self.connections.find_one({"plans": plan})

    async def list_connections(self, limit: int = 200) -> list[dict]:
        return await self.connections.find().to_list(length=limit)

    async def count_connections(self) -> int:
        return await self.connections.count_documents({})

    async def insert_connection(self, value: dict) -> ObjectId:
        result = await self.connections.insert_one(value)
        return result.inserted_id

    async def update_connection(self, connection_id: ObjectId, value: dict) -> None:
        await self.connections.update_one({"_id": connection_id}, {"$set": value})

    async def delete_connection(self, connection_id: ObjectId) -> None:
        await self.connections.delete_one({"_id": connection_id})

    async def unassign_plan_from_others(self, plan: str, keep_id: ObjectId) -> None:
        await self.connections.update_many(
            {"plans": plan, "_id": {"$ne": keep_id}},
            {"$pull": {"plans": plan}},
        )

    # Chat sessions

    async def insert_chat_session(self, session: dict) -> None:
        await self.chat_sessions.insert_one(session)

    async def list_user_sessions(self, user_id: str, limit: int = 200) -> list[dict]:
        cursor = self.chat_sessions.find({"user_id": user_id}).sort("updated_at", DESCENDING)
        return await cursor.to_list(length=limit)

    async def get_chat(self, session_id: str, user_id: str):
        return await self.chat_sessions.find_one({"_id": session_id, "user_id": user_id})

    async def delete_chat(self, session_id: str, user_id: str) -> int:
        result = await self.chat_sessions.delete_one({"_id": session_id, "user_id": user_id})
        return result.deleted_count

    async def append_message(
        self,
        session_id: str,
        user_id: str,
        message: dict,
        title: str,
        updated_at: datetime,
        expires_at: datetime,
    ) -> None:
        await self.chat_sessions.update_one(
            {"_id": session_id, "user_id": user_id},
            {"$push": {"messages": message}, "$set": {"title": title, "updated_at": updated_at, "expires_at": expires_at}},
        )

    async def delete_user_chat_sessions(self, user_id: str) -> int:
        result = await self.chat_sessions.delete_many({"user_id": user_id})
        return result.deleted_count

    async def export_chat_sessions(self, user_id: str, limit: int = 1000) -> list[dict]:
        return await self.chat_sessions.find({"user_id": user_id}, {"_id": 0}).to_list(length=limit)

    # Feedback

    async def upsert_feedback(self, document: dict) -> None:
        await self.feedback.update_one(
            {"session_id": document["session_id"], "message_id": document["message_id"]},
            {"$set": document},
            upsert=True,
        )

    async def delete_feedback_for_session(self, session_id: str, user_id: str) -> int:
        result = await self.feedback.delete_many({"session_id": session_id, "user_id": user_id})
        return result.deleted_count

    async def delete_user_feedback(self, user_id: str) -> int:
        result = await self.feedback.delete_many({"user_id": user_id})
        return result.deleted_count

    async def export_feedback(self, user_id: str, limit: int = 1000) -> list[dict]:
        return await self.feedback.find({"user_id": user_id}, {"_id": 0}).to_list(length=limit)

    async def list_feedback(self, rating: str = "", limit: int = 1000) -> list[dict]:
        query = {"rating": rating} if rating else {}
        return await self.feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=limit)

    async def list_feedback_ratings(self, limit: int = 10000) -> list[str]:
        records = await self.feedback.find({}, {"rating": 1}).to_list(length=limit)
        return [item.get("rating", "") for item in records]

    # Audit log

    async def insert_audit(self, document: dict) -> None:
        await self.audit_logs.insert_one(document)

    async def list_audit(self, event: str = "", outcome: str = "", username: str = "", limit: int = 500) -> list[dict]:
        query = {}
        if event:
            query["event"] = {"$regex": re.escape(event), "$options": "i"}
        if outcome:
            query["outcome"] = outcome
        if username:
            query["actor.username"] = {"$regex": re.escape(username), "$options": "i"}
        return await self.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(length=limit)

    # Ingestion pipelines

    async def insert_pipeline(self, document: dict) -> None:
        await self.ingestion_pipelines.insert_one(document)

    async def update_pipeline(self, pipeline_id: str | ObjectId, update: dict) -> None:
        await self.ingestion_pipelines.update_one({"_id": pipeline_id}, update)

    async def get_pipeline(self, pipeline_id: str | ObjectId):
        return await self.ingestion_pipelines.find_one({"_id": pipeline_id})

    async def get_active_pipeline(self, pipeline_id: str | ObjectId):
        return await self.ingestion_pipelines.find_one(
            {"_id": pipeline_id, "expires_at": {"$gt": utcnow()}}
        )

    async def list_pipelines(self, limit: int = 50) -> list[dict]:
        cursor = self.ingestion_pipelines.find({}, {"extracted_text": 0, "stages": 0}).sort("created_at", -1)
        return await cursor.to_list(length=limit)

    async def mark_pipelines_interrupted(self) -> None:
        await self.ingestion_pipelines.update_many(
            {"status": {"$in": ["queued", "running"]}},
            {"$set": {"status": "failed", "error": "interrupted by restart", "updated_at": utcnow()}},
        )


async def seed_connection(repos: Repositories) -> None:
    if await repos.count_connections() == 0:
        await repos.insert_connection({
            "name": "Built-in simulator", "provider": "mock", "model": "extractive-simulator",
            "base_url": "", "api_version": "", "temperature": 0, "max_tokens": 1200,
            "api_key_encrypted": "", "api_key_hint": "", "plans": ["basic", "standard", "premium"],
        })
