from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


Plan = Literal["basic", "standard", "premium"]
Role = Literal["user", "admin"]
Rating = Literal["up", "down"]
PROVIDERS = ("mock", "openai", "azure_openai", "anthropic")
CATEGORIES = {"incorrect", "incomplete", "irrelevant_sources", "unclear", "too_slow", "other"}


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9._-]+$")
    password: str = Field(min_length=12, max_length=256)
    plan: Plan
    policy_accepted: bool


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=1, max_length=256)


class MessageRequest(BaseModel):
    question: str = Field(min_length=1, max_length=10000)

    @field_validator("question")
    @classmethod
    def question_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Question cannot be blank")
        return value


class FeedbackRequest(BaseModel):
    session_id: str
    message_id: str
    rating: Rating
    categories: list[str] = Field(default_factory=list, max_length=6)
    comment: str = Field(default="", max_length=2000)

    @field_validator("categories")
    @classmethod
    def known_categories(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value) or not set(value) <= CATEGORIES:
            raise ValueError("Invalid feedback category")
        return value


class ConsentRequest(BaseModel):
    accepted: bool


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class ConnectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    provider: Literal["mock", "openai", "azure_openai", "anthropic"]
    model: str = Field(min_length=1, max_length=200)
    base_url: str = ""
    api_version: str = ""
    api_key: str = ""
    remove_api_key: bool = False
    temperature: float = Field(default=0.2, ge=0, le=2)
    max_tokens: int = Field(default=1200, ge=1, le=16000)
    plans: list[Plan] = Field(default_factory=list)

    @model_validator(mode="after")
    def azure_requires_endpoint_and_version(self):
        if self.provider == "azure_openai" and (not self.base_url.strip() or not self.api_version.strip()):
            raise ValueError("Azure OpenAI requires a base URL and API version")
        return self


class UserUpdateRequest(BaseModel):
    role: Role | None = None
    plan: Plan | None = None
