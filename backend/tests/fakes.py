from __future__ import annotations

import copy
import re
from types import SimpleNamespace

from bson import ObjectId


def _value(document: dict, key: str):
    value = document
    for part in key.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _matches(document: dict, query: dict) -> bool:
    for key, expected in query.items():
        actual = _value(document, key)
        if isinstance(expected, dict):
            if "$gt" in expected and not (actual is not None and actual > expected["$gt"]):
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$regex" in expected:
                options = re.IGNORECASE if expected.get("$options") == "i" else 0
                if not re.search(expected["$regex"], str(actual or ""), options):
                    return False
        elif isinstance(actual, list):
            if expected not in actual:
                return False
        elif actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents: list[dict]):
        self.documents = documents

    def sort(self, key: str, direction: int):
        self.documents.sort(key=lambda item: _value(item, key) or "", reverse=direction < 0)
        return self

    async def to_list(self, length: int | None = None):
        values = copy.deepcopy(self.documents)
        return values[:length] if length is not None else values


class FakeCollection:
    def __init__(self):
        self.documents: list[dict] = []

    async def create_index(self, *args, **kwargs):
        return "fake-index"

    async def find_one(self, query: dict, projection=None):
        return copy.deepcopy(next((item for item in self.documents if _matches(item, query)), None))

    def find(self, query: dict | None = None, projection=None):
        return FakeCursor([item for item in self.documents if _matches(item, query or {})])

    async def insert_one(self, document: dict):
        value = copy.deepcopy(document)
        value.setdefault("_id", ObjectId())
        self.documents.append(value)
        return SimpleNamespace(inserted_id=value["_id"])

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        document = next((item for item in self.documents if _matches(item, query)), None)
        if document is None and upsert:
            document = {key: value for key, value in query.items() if not key.startswith("$")}
            document.setdefault("_id", ObjectId())
            self.documents.append(document)
        if document is None:
            return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)
        _apply_update(document, update)
        return SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)

    async def update_many(self, query: dict, update: dict):
        matched = [item for item in self.documents if _matches(item, query)]
        for document in matched:
            _apply_update(document, update)
        return SimpleNamespace(matched_count=len(matched), modified_count=len(matched))

    async def delete_one(self, query: dict):
        document = next((item for item in self.documents if _matches(item, query)), None)
        if document is None:
            return SimpleNamespace(deleted_count=0)
        self.documents.remove(document)
        return SimpleNamespace(deleted_count=1)

    async def delete_many(self, query: dict):
        removed = [item for item in self.documents if _matches(item, query)]
        self.documents[:] = [item for item in self.documents if not _matches(item, query)]
        return SimpleNamespace(deleted_count=len(removed))

    async def count_documents(self, query: dict):
        return sum(_matches(item, query) for item in self.documents)


def _apply_update(document: dict, update: dict):
    for key, values in update.get("$set", {}).items():
        if "." in key:
            parts = key.split(".")
            target = document
            for part in parts[:-1]:
                target = target.setdefault(part, {})
            target[parts[-1]] = copy.deepcopy(values)
        else:
            document[key] = copy.deepcopy(values)
    for key, value in update.get("$push", {}).items():
        document.setdefault(key, []).append(copy.deepcopy(value))
    for key, value in update.get("$pull", {}).items():
        document[key] = [item for item in document.get(key, []) if item != value]


class FakeDatabase:
    def __init__(self):
        self.collections: dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        return self.collections.setdefault(name, FakeCollection())
