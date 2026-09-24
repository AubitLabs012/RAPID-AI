import type { LiveOceanRegion, MarineMarker, PredictionAgent, PredictionAgentId, PredictionAgentResult } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type DataUploadResult = {
  parsed_records: number;
  valid_observations: number;
  stored: Record<string, number>;
  ai: Record<string, number>;
  markers?: MarineMarker[];
  analysis?: string;
  filename?: string;
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type AuthToken = {
  access_token: string;
};

type AiResponseData = {
  response: string;
};

const CHAT_AUTH_KEY = "maris_chat_auth";
const CHAT_PASSWORD = "Password123";

export async function fetchMarineMarkers(): Promise<MarineMarker[]> {
  const backendUrl = `${API_BASE}/api/marine/markers`;
  const fallbackUrl = "/src/marine-markers.json";

  try {
    const response = await fetch(backendUrl, { headers: { Accept: "application/json" } });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Local static preview can run without the FastAPI service.
  }

  const fallback = await fetch(fallbackUrl, { headers: { Accept: "application/json" } });
  if (!fallback.ok) {
    throw new Error(`Marker API returned ${fallback.status}`);
  }
  return fallback.json();
}

export async function fetchLiveOceanRegions(): Promise<LiveOceanRegion[]> {
  const response = await fetch(`${API_BASE}/api/live-ocean/regions`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as ApiResponse<{ regions: LiveOceanRegion[] }> | { detail?: string } | null;

  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : `Live ocean API returned ${response.status}`;
    throw new Error(detail || `Live ocean API returned ${response.status}`);
  }

  return (payload as ApiResponse<{ regions: LiveOceanRegion[] }>).data.regions;
}

export async function fetchPredictionAgents(): Promise<PredictionAgent[]> {
  const response = await fetch(`${API_BASE}/api/prediction-agents`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as ApiResponse<{ agents: PredictionAgent[] }> | { detail?: string } | null;

  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : `Prediction agents API returned ${response.status}`;
    throw new Error(detail || `Prediction agents API returned ${response.status}`);
  }

  return (payload as ApiResponse<{ agents: PredictionAgent[] }>).data.agents;
}

async function requestJson<T>(path: string, options: RequestInit): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => null) as ApiResponse<T> | { detail?: string } | null;

  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : `Request failed with ${response.status}`;
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return (payload as ApiResponse<T>).data;
}

async function getChatToken(): Promise<string> {
  const saved = localStorage.getItem(CHAT_AUTH_KEY);
  if (saved) {
    try {
      return (JSON.parse(saved) as AuthToken).access_token;
    } catch {
      localStorage.removeItem(CHAT_AUTH_KEY);
    }
  }

  const username = `maris_chat_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const body = JSON.stringify({
    username,
    password: CHAT_PASSWORD,
    role: "user",
    display_name: "RAPID-AI Chat User",
  });
  const token = await requestJson<AuthToken>("/api/signup", { method: "POST", body });
  localStorage.setItem(CHAT_AUTH_KEY, JSON.stringify(token));
  return token.access_token;
}

export async function askMarisAi(prompt: string): Promise<string> {
  const token = await getChatToken();
  try {
    const result = await requestJson<AiResponseData>("/api/ai-response", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt,
        use_voice: false,
        context: {
          topic: "disaster intelligence",
          response_style: "concise_dashboard_answer",
        },
      }),
    });
    return result.response;
  } catch (error) {
    localStorage.removeItem(CHAT_AUTH_KEY);
    if (error instanceof Error && error.message.toLowerCase().includes("token")) {
      return askMarisAi(prompt);
    }
    throw error;
  }
}

export async function runPredictionAgent(
  agentId: PredictionAgentId,
  prompt: string,
  context: Record<string, unknown> = {},
): Promise<PredictionAgentResult> {
  const token = await getChatToken();
  return requestJson<PredictionAgentResult>("/api/prediction-agents/analyze", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      prompt,
      context,
    }),
  });
}

export async function uploadMarinePdf(file: File): Promise<DataUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/marine/upload-pdf`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null) as ApiResponse<DataUploadResult> | { detail?: string } | null;
  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : `PDF upload failed with ${response.status}`;
    throw new Error(detail || `PDF upload failed with ${response.status}`);
  }

  return (payload as ApiResponse<DataUploadResult>).data;
}

export async function uploadMarineImage(file: File): Promise<DataUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/marine/upload-image`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null) as ApiResponse<DataUploadResult> | { detail?: string } | null;
  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : `Image upload failed with ${response.status}`;
    throw new Error(detail || `Image upload failed with ${response.status}`);
  }

  return (payload as ApiResponse<DataUploadResult>).data;
}
