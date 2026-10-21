from fastapi import APIRouter, Depends, Request, Response

from app.dependencies import current_user
from app.schemas import ConsentRequest, DeleteAccountRequest
from app.security import SESSION_COOKIE_NAME

router = APIRouter(prefix="/privacy", tags=["privacy"])


@router.get("/policy")
async def policy(request: Request):
    return request.app.state.container.privacy.policy()


@router.post("/consent")
async def consent(body: ConsentRequest, request: Request, user=Depends(current_user)):
    return await request.app.state.container.privacy.consent(user, body.accepted, request)


@router.get("/data")
async def export_data(request: Request, user=Depends(current_user)):
    return await request.app.state.container.privacy.export_data(user, request)


@router.delete("/data")
async def erase_data(request: Request, user=Depends(current_user)):
    return await request.app.state.container.privacy.erase_data(user, request)


@router.post("/account/delete")
async def delete_account(body: DeleteAccountRequest, request: Request, response: Response, user=Depends(current_user)):
    await request.app.state.container.privacy.delete_account(user, body.password, request)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/api", httponly=True,
                           secure=request.app.state.container.settings.cookie_secure, samesite="strict")
    return {"ok": True}
