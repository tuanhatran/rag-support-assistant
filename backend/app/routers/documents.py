from fastapi import APIRouter, Depends, Query, Request

from app.dependencies import current_user
from app.errors import NotFoundError

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
async def list_documents(request: Request, category: str = "", tag: str = "", q: str = Query(default="", max_length=100),
                         user=Depends(current_user)):
    documents = request.app.state.container.knowledge.documents
    result = []
    for document in documents:
        if category and document["category"].lower() != category.lower():
            continue
        if tag and tag.lower() not in [item.lower() for item in document["tags"]]:
            continue
        if q and q.lower() not in (document["title"] + " " + document["markdown"] + " " + " ".join(document["tags"])).lower():
            continue
        result.append({key: document[key] for key in ("id", "title", "category", "tags")})
    return result


@router.get("/{document_id}")
async def get_document(request: Request, document_id: str, user=Depends(current_user)):
    document = request.app.state.container.knowledge.get_document(document_id)
    if not document:
        raise NotFoundError("Document not found")
    return {key: document[key] for key in ("id", "title", "category", "tags", "markdown")}
