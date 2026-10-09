from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app.dependencies import require_admin
from app.errors import NotFoundError, ValidationError
from app.ingestion import validate_ingestion_options

router = APIRouter(prefix="/admin/ingestion", tags=["admin-ingestion"])

MAX_FILE_BYTES = 512_000  # 500 KB


@router.get("/options")
async def get_ingestion_options(request: Request, user=Depends(require_admin)):
    container = request.app.state.container
    return await container.ingestion.get_options()


@router.post("/pipelines", status_code=202)
async def create_pipeline(
    request: Request,
    file: UploadFile = File(...),
    chunk_size: int = Form(default=500),
    chunk_overlap: int = Form(default=50),
    separator: str = Form(default="\n\n"),
    embedding_model: str = Form(default="@cf/baai/bge-small-en-v1.5"),
    user=Depends(require_admin),
):
    container = request.app.state.container
    filename = file.filename or ""
    lower_name = filename.lower()
    if not (lower_name.endswith(".txt") or lower_name.endswith(".pdf")):
        raise HTTPException(
            status_code=415,
            detail="Unsupported file extension. Only .txt and .pdf files are accepted.",
        )

    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file cannot be empty.")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_BYTES} bytes (500 KB).",
        )

    try:
        validate_ingestion_options(chunk_size, chunk_overlap, separator, embedding_model)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    pipeline_id = await container.ingestion.create_pipeline(
        filename=filename,
        file_bytes=content,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separator=separator,
        embedding_model=embedding_model,
        actor=user,
    )

    return JSONResponse(
        status_code=202,
        content={"id": pipeline_id, "status": "queued"},
    )


@router.get("/pipelines/{pipeline_id}")
async def get_pipeline_details(
    pipeline_id: str, request: Request, user=Depends(require_admin)
):
    container = request.app.state.container
    return await container.ingestion.get_pipeline(pipeline_id)


@router.get("/pipelines/{pipeline_id}/chunks")
async def get_pipeline_chunks(
    pipeline_id: str, request: Request, user=Depends(require_admin)
):
    container = request.app.state.container
    return await container.ingestion.get_chunks_preview(pipeline_id)
