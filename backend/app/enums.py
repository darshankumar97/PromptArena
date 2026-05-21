from enum import Enum


class RoomStatus(str, Enum):
    LOBBY = "lobby"
    PROMPTING = "prompting"
    RESOLVING = "resolving"
    RESULTS = "results"
    FINISHED = "finished"


class RoundStatus(str, Enum):
    OPEN = "open"
    LOCKED = "locked"
    COMPLETE = "complete"


class SubmissionStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMED_OUT = "timed_out"


class JobType(str, Enum):
    RESOLVE_ROUND = "resolve_round"
    GENERATE_SUBMISSION = "generate_submission"


class ParticipantRole(str, Enum):
    HOST = "host"
    PLAYER = "player"


class ConnectionStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"


class ActivityEventType(str, Enum):
    ROOM_CREATED = "room_created"
    PLAYER_JOINED = "player_joined"
    PLAYER_LEFT = "player_left"
    ROUND_STARTED = "round_started"
    PROMPT_SUBMITTED = "prompt_submitted"
    ROUND_LOCKED = "round_locked"
    ROUND_COMPLETED = "round_completed"
    SUBMISSION_SCORED = "submission_scored"
    WINNER_ANNOUNCED = "winner_announced"
    ROOM_ENDED = "room_ended"
