import API_BASE from "@/config/api";
import {
  handleSessionExpired,
  isUnauthorizedResponse,
} from "@/lib/session-expired";
import type {
  ActivityEvent,
  ApiError,
  AuthTokens,
  Room,
  RoomSnapshot,
  SubmissionSummary,
  User,
} from "@/types";

export interface RoundMutationResponse {
  round: {
    id: number;
    room_id: number;
    round_number: number;
    status: string;
    battle_theme: string;
    winner_user_id: number | null;
  };
  snapshot: RoomSnapshot;
}

export interface SubmitResponse {
  submission: SubmissionSummary;
  generation_job: { id: number; status: string };
  snapshot: RoomSnapshot;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as ApiError;
    const code = err.error?.code;
    const message = err.error?.message;
    if (isUnauthorizedResponse(res.status, code, message)) {
      handleSessionExpired();
    }
    throw new ApiRequestError(
      message || res.statusText,
      code || "REQUEST_FAILED",
      res.status,
    );
  }
  return data as T;
}

function headers(token?: string): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export const api = {
  async register(displayName: string): Promise<AuthTokens> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ display_name: displayName }),
    });
    return parseJson<AuthTokens>(res);
  },

  async me(token: string): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: headers(token),
    });
    return parseJson(res);
  },

  async createRoom(token: string): Promise<{ room: Room }> {
    const res = await fetch(`${API_BASE}/api/rooms`, {
      method: "POST",
      headers: headers(token),
    });
    return parseJson(res);
  },

  async joinRoom(token: string, roomId: number): Promise<{
    participant: unknown;
    snapshot: RoomSnapshot;
  }> {
    const res = await fetch(`${API_BASE}/api/rooms/id/${roomId}/join`, {
      method: "POST",
      headers: headers(token),
    });
    return parseJson(res);
  },

  async getSnapshot(
    token: string,
    roomId: number,
  ): Promise<{ snapshot: RoomSnapshot }> {
    const res = await fetch(`${API_BASE}/api/rooms/id/${roomId}/snapshot`, {
      headers: headers(token),
    });
    return parseJson(res);
  },

  async getActivity(
    token: string,
    roomId: number,
    afterId = 0,
  ): Promise<{ events: ActivityEvent[] }> {
    const res = await fetch(
      `${API_BASE}/api/rooms/id/${roomId}/activity?after_id=${afterId}&limit=50`,
      { headers: headers(token) },
    );
    return parseJson(res);
  },

  async submitPrompt(
    token: string,
    roomId: number,
    roundId: number,
    promptText: string,
  ): Promise<SubmitResponse> {
    const res = await fetch(
      `${API_BASE}/api/rooms/id/${roomId}/round/${roundId}/submit`,
      {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ prompt_text: promptText }),
      },
    );
    return parseJson<SubmitResponse>(res);
  },

  async startRound(
    token: string,
    roomId: number,
    battleTheme: string,
  ): Promise<RoundMutationResponse> {
    const res = await fetch(`${API_BASE}/api/rooms/id/${roomId}/round/start`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ battle_theme: battleTheme }),
    });
    return parseJson<RoundMutationResponse>(res);
  },

  async lockRound(
    token: string,
    roomId: number,
    roundId: number,
  ): Promise<RoundMutationResponse> {
    const res = await fetch(
      `${API_BASE}/api/rooms/id/${roomId}/round/${roundId}/lock`,
      { method: "POST", headers: headers(token) },
    );
    return parseJson<RoundMutationResponse>(res);
  },

  async selectWinner(
    token: string,
    roomId: number,
    roundId: number,
    submissionId: number,
  ): Promise<RoundMutationResponse> {
    const res = await fetch(
      `${API_BASE}/api/rooms/id/${roomId}/round/${roundId}/winner`,
      {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ submission_id: submissionId }),
      },
    );
    return parseJson<RoundMutationResponse>(res);
  },

  async scoreSubmission(
    token: string,
    roomId: number,
    submissionId: number,
    score: number,
  ): Promise<{ submission: SubmissionSummary; snapshot: RoomSnapshot }> {
    const res = await fetch(
      `${API_BASE}/api/rooms/id/${roomId}/submissions/${submissionId}/score`,
      {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ score }),
      },
    );
    return parseJson(res);
  },

  async retryGeneration(
    token: string,
    roomId: number,
    submissionId: number,
  ): Promise<{ generation_job: { id: number; status: string }; snapshot: RoomSnapshot }> {
    const res = await fetch(
      `${API_BASE}/api/rooms/id/${roomId}/submissions/${submissionId}/retry`,
      { method: "POST", headers: headers(token) },
    );
    return parseJson(res);
  },
};

export function getApiUrl(): string {
  return API_BASE;
}
