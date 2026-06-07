export type RoomStatus =
  | "lobby"
  | "prompting"
  | "resolving"
  | "results"
  | "finished";

export type RoundStatus = "open" | "locked" | "complete";

export type SubmissionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "timed_out";

export type ConnectionStatus = "online" | "offline";

export type ParticipantRole = "host" | "player";

export interface User {
  id: number;
  display_name: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Participant {
  id: number;
  room_id: number;
  user_id: number;
  role: ParticipantRole;
  connection_status: ConnectionStatus;
  display_name: string | null;
  joined_at: string;
  left_at: string | null;
}

export interface GenerationJob {
  id: number;
  submission_id: number;
  round_id: number;
  job_type: string;
  status: JobStatus;
  retry_count: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Campaign {
  title: string;
  tagline: string;
  campaign_text: string;
  raw?: string;
}

export interface SubmissionSummary {
  user_id: number;
  submitted: boolean;
  status: SubmissionStatus;
  submission_id?: number;
  id?: number;
  round_id?: number;
  prompt_text?: string;
  submitted_at?: string;
  score?: number | null;
  judge_reason?: string | null;
  campaign?: Campaign;
  ai_output?: string;
  generation_job?: GenerationJob;
  is_winner?: boolean;
}

export interface CurrentRound {
  id: number;
  room_id: number;
  round_number: number;
  status: RoundStatus;
  battle_theme: string;
  prompt_deadline: string | null;
  winner_user_id: number | null;
  resolved_at: string | null;
  created_at: string;
  submissions: SubmissionSummary[];
  submitted_count: number;
  prompts_revealed: boolean;
}

export interface Room {
  id: number;
  code: string;
  host_user_id: number;
  status: RoomStatus;
  current_round_id: number | null;
  max_players: number;
  created_at: string;
}

export interface RoomSnapshot {
  room: Room;
  participants: Participant[];
  current_round: CurrentRound | null;
  activity_cursor: number;
}

export interface ActivityEvent {
  id: number;
  room_id: number;
  round_id: number | null;
  actor_user_id: number | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ApiError {
  error: { code: string; message: string };
}

export interface BattleHistoryItem {
  room_id: number;
  room_code: string;
  battle_theme: string;
  played_at: string;
  my_score: number | null;
  my_rank: number | null;
  total_players: number;
  winner_display_name: string;
  i_won: boolean;
  round_status: string;
}

export interface AdminSubmission {
  display_name: string;
  prompt_text: string;
  ai_output: string;
  score: number;
  judge_reason: string;
  rank: number;
}

export interface AdminBattle {
  room_id: number;
  room_code: string;
  battle_theme: string;
  played_at: string;
  total_players: number;
  winner_display_name: string;
  winner_score: number;
  submissions: AdminSubmission[];
}

export interface AdminUser {
  id: number;
  display_name: string;
  is_admin: boolean;
  created_at: string;
  battle_count: number;
  wins: number;
}
