from fastapi import APIRouter, Depends, Request

from app.dependencies import consented_user
from app.schemas import FeedbackRequest

router = APIRouter(tags=["feedback"])


@router.post("/feedback")
async def submit_feedback(body: FeedbackRequest, request: Request, user=Depends(consented_user)):
    return await request.app.state.container.feedback.submit(user, body)
