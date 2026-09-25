from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import require_current_user
from app.api.schemas import ApiResponse, LoginRequest, SignupRequest
from app.auth.service import AuthService


router = APIRouter(tags=["auth"])


@router.post("/login", response_model=ApiResponse)
def login(payload: LoginRequest, auth_service: AuthService = Depends(AuthService)) -> ApiResponse:
    try:
        token_payload = auth_service.login(payload.username, payload.password, payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return ApiResponse(message="Login successful", data=token_payload.model_dump())


@router.post("/signup", response_model=ApiResponse)
def signup(payload: SignupRequest, auth_service: AuthService = Depends(AuthService)) -> ApiResponse:
    try:
        token_payload = auth_service.signup(payload.username, payload.password, payload.role, payload.display_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ApiResponse(message="Signup successful", data=token_payload.model_dump())


@router.get("/login/me", response_model=ApiResponse)
def me(user: dict = Depends(require_current_user)) -> ApiResponse:
    return ApiResponse(message="Current user loaded", data={"user": user})
