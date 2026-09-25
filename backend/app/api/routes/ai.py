from fastapi import APIRouter, Depends

from app.api.dependencies import require_current_user
from app.api.schemas import AIResponseRequest, ApiResponse
from app.services.ai_service import AIService


router = APIRouter(prefix="/ai-response", tags=["ai"])


@router.post("", response_model=ApiResponse)
def generate_ai_response(
    payload: AIResponseRequest,
    user: dict = Depends(require_current_user),
    ai_service: AIService = Depends(AIService),
) -> ApiResponse:
    result = ai_service.process_prompt(user=user, payload=payload)
    return ApiResponse(message="AI response generated", data=result)
