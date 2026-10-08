from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from rank_bm25 import BM25Okapi


STOPWORDS = set("a about after all also an and any are as at be been being but by can could did do does for from get got had has have he her here hers him his how i if in into is it its just many me more most my no not of on or our ours she should so some than that the their them then there these they this those to too us very was we were what when where which who why will with would you your".split())
TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    tokens = []
    for token in TOKEN_RE.findall(text.lower()):
        if len(token) <= 1 or token in STOPWORDS:
            continue
        for suffix in ("ing", "ed", "es", "s"):
            if token.endswith(suffix) and len(token) - len(suffix) >= 4:
                token = token[:-len(suffix)]
                break
        tokens.append(token)
    return tokens


@dataclass
class Chunk:
    document_id: str
    title: str
    category: str
    tags: list[str]
    section: str
    body: str

    def indexed_text(self) -> str:
        return " ".join([self.title, *self.tags, self.section, self.body])


def parse_document(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    frontmatter = {}
    if text.startswith("---\n"):
        _, metadata, text = text.split("---", 2)
        for line in metadata.strip().splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                frontmatter[key.strip()] = value.strip().strip('"\'')
    title = frontmatter.get("title", path.stem.replace("-", " ").title())
    category = frontmatter.get("category", "General")
    tags = [tag.strip() for tag in frontmatter.get("tags", "").split(",") if tag.strip()]
    headings = list(re.finditer(r"^##\s+(.+?)\s*$", text, re.MULTILINE))
    chunks = []
    if headings:
        preface = text[:headings[0].start()].strip()
        if preface:
            chunks.append(Chunk(path.stem, title, category, tags, "Overview", preface))
        for index, heading in enumerate(headings):
            start = heading.end()
            end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
            body = text[start:end].strip()
            if body:
                chunks.append(Chunk(path.stem, title, category, tags, heading.group(1).strip(), body))
    else:
        chunks.append(Chunk(path.stem, title, category, tags, "Overview", text.strip()))
    return {"id": path.stem, "title": title, "category": category, "tags": tags, "markdown": text, "chunks": chunks}


class KnowledgeBase:
    def __init__(self, directory: str | Path, top_k: int = 4):
        self.directory = Path(directory)
        self.top_k = top_k
        self.documents = [parse_document(path) for path in sorted(self.directory.glob("*.md"))]
        self.chunks = [chunk for document in self.documents for chunk in document["chunks"]]
        self.tokens = [tokenize(chunk.indexed_text()) for chunk in self.chunks]
        self.index = BM25Okapi(self.tokens, k1=1.5, b=0.75) if self.tokens else None
        self.document_frequency: dict[str, int] = {}
        for terms in self.tokens:
            for term in set(terms):
                self.document_frequency[term] = self.document_frequency.get(term, 0) + 1

    def search(self, query: str, top_k: int | None = None) -> list[dict]:
        query_terms = tokenize(query)
        if not query_terms:
            return []
        matching_terms = {term for term in query_terms if self.document_frequency.get(term, 0)}
        if len(matching_terms) < min(2, len(set(query_terms))):
            return []
        if self.index is None:
            return []
        scored = [(score, chunk) for score, chunk in zip(self.index.get_scores(query_terms), self.chunks) if score > 0]
        scored.sort(key=lambda item: item[0], reverse=True)
        if not scored:
            return []
        threshold = scored[0][0] * 0.25
        results = []
        for score, chunk in scored:
            if score < threshold:
                break
            excerpt = chunk.body[:200]
            results.append({"document_id": chunk.document_id, "document_title": chunk.title,
                            "category": chunk.category, "section": chunk.section,
                            "score": round(score, 5), "excerpt": excerpt, "text": chunk.body})
            if len(results) >= (top_k or self.top_k):
                break
        best = results[0]["score"] if results else 1
        for result in results:
            result["score"] = result["score"] / best
        return results

    def get_document(self, document_id: str):
        return next((doc for doc in self.documents if doc["id"] == document_id), None)
