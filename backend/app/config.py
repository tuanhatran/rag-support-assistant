from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RAG_", env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "rag_support"
    encryption_key: str = ""
    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = ""
    session_ttl_hours: int = 8
    cookie_secure: bool = False
    retrieval_top_k: int = 4
    history_turns: int = 3
    llm_timeout_seconds: int = 60
    log_level: str = "INFO"
    log_format: str = "json"
    data_policy_version: str = "2026-10-08"
    conversation_retention_days: int = 90
    feedback_retention_days: int = 90
    audit_retention_days: int = 365


@lru_cache
def get_settings() -> Settings:
    return Settings()
