from fastapi import APIRouter, Depends

from app.api.dependencies import require_current_user
from app.api.schemas import ApiResponse, PredictionAgentRequest
from app.services.prediction_agents_service import PredictionAgentsService


router = APIRouter(prefix="/prediction-agents", tags=["prediction-agents"])


@router.get("", response_model=ApiResponse)
def list_prediction_agents(
    service: PredictionAgentsService = Depends(PredictionAgentsService),
) -> ApiResponse:
    return ApiResponse(message="Prediction agents loaded", data={"agents": service.list_agents()})


@router.post("/analyze", response_model=ApiResponse)
def analyze_with_prediction_agent(
    payload: PredictionAgentRequest,
    user: dict = Depends(require_current_user),
    service: PredictionAgentsService = Depends(PredictionAgentsService),
) -> ApiResponse:
    result = service.analyze(user=user, payload=payload)
    return ApiResponse(message="Prediction agent analysis generated", data=result)
