from fastapi import APIRouter, Depends

from app.api.dependencies import require_current_user
from app.api.schemas import ApiResponse, GameActionRequest
from app.services.game_service import GameService


router = APIRouter(prefix="/game", tags=["game"])


@router.post("", response_model=ApiResponse)
def handle_game_action(
    payload: GameActionRequest,
    user: dict = Depends(require_current_user),
    game_service: GameService = Depends(GameService),
) -> ApiResponse:
    effective_user_id = payload.user_id if user.get("role") == "admin" else user["id"]
    result = game_service.process_result(payload.model_copy(update={"user_id": effective_user_id}))
    return ApiResponse(message="Game action processed", data=result)
