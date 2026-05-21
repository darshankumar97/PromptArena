# PromptArena — AI Creative Battle Room

**Poiro Full-Stack Developer Intern Assignment**

A minimal realtime multiplayer battle room: one host runs the challenge, participants submit prompts, the backend runs async AI generation jobs, and the host scores and selects a winner. Built as a focused vertical slice (one room, one round) with backend-enforced roles and Socket.IO live updates.

---

## Demo flow (quick start)

| Step | Action |
|------|--------|
| 1 | Start API: `cd backend && python run.py` |
| 2 | Start UI: `cd frontend && npm run dev` |
| 3 | Open http://localhost:3000 in **two** browser windows |
| 4 | Window A: name **Host** → **Create room** → copy 6-letter code |
| 5 | Window B: name **Guest** → **Join room** with code |
| 6 | Host: **Start round** (edit theme if desired) |
| 7 | Guest: **Submit prompt** → watch job states (queued → running → completed) |
| 8 | Host: **Lock submissions** → score 1–10 (optional) → **Select winner** on a campaign card |
| 9 | Refresh either window — room, submissions, scores, and winner remain (SQLite + JWT) |

**Automated check:** from `backend/`: `python -m pytest tests/ -v`

**Demo helper:** `flask seed-demo` (prints the steps above)

---

## Local setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- npm

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          

pip install -r requirements.txt
copy .env.example .env           

flask --app app:create_app init-db
python run.py
```

API: http://localhost:5000  
Health: http://localhost:5000/api/health

### 2. Frontend

```bash
cd frontend
npm install --include=dev
copy .env.local.example .env.local
npm run dev
```

UI: http://localhost:3000

### Environment variables

| File | Purpose |
|------|---------|
| `backend/.env.example` | Flask, SQLite, JWT, CORS, mock AI tuning |
| `frontend/.env.local.example` | `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`) |

**Required:** `CORS_ORIGINS` on the backend must include `http://localhost:3000`.

---

## Architecture overview

```
┌─────────────────┐     REST (JWT)      ┌──────────────────────────────┐
│  Next.js UI     │◄──────────────────►│  Flask app factory           │
│  Zustand stores │     Socket.IO       │  Blueprints + Socket handlers │
└────────┬────────┘◄──────────────────►│  Services (domain logic)      │
         │                              │  SQLAlchemy → SQLite          │
         │                              │  ThreadPoolExecutor → AI jobs │
         └──────────────────────────────┴──────────────────────────────┘
```

- **Frontend:** App Router, TypeScript, Tailwind, Zustand (`auth`, `socket`, `room` snapshot only).
- **Backend:** Flask (not FastAPI — same layering: blueprints, services, typed models).
- **Realtime:** Flask-SocketIO; room channel `room:{id}`.
- **Async jobs:** In-process `ThreadPoolExecutor` (no Redis/Celery — appropriate for MVP).
- **AI:** `BaseAIProvider` + `MockAIProvider` (2–6s latency, ~12% random failure, cinematic JSON campaigns). Swap provider in `app/ai/__init__.py` for a real LLM later.

Deeper design notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Database schema (entity model)

SQLite via SQLAlchemy. Integer PKs, UTC timestamps.

| Entity | Purpose |
|--------|---------|
| **User** | Guest identity (`display_name`); JWT identifies user across refreshes |
| **Room** | `code`, `host_user_id`, `status`, `current_round_id`, `max_players` |
| **Participant** | `room_id`, `user_id`, `role` (host/player), `connection_status`, soft `left_at` |
| **Round** | `room_id`, `round_number`, `status`, `battle_theme`, `prompt_deadline`, `winner_user_id` |
| **Submission** | One per user per round; `prompt_text`, `status`, `ai_output` (JSON campaign), `score` |
| **GenerationJob** | One per submission; `status`, `retry_count`, timestamps, `error_message` |
| **ActivityEvent** | Append-only feed (`event_type`, JSON `payload`) |

**Relationships:** Room → many Participants, Rounds, ActivityEvents. Round → many Submissions, one active GenerationJob per submission. Room.`current_round_id` points at the live round during battle.

---

## Room & round state machines

### Room (`lobby` → `prompting` → `resolving` → `results` → `finished`)

| Phase | Meaning |
|-------|---------|
| `lobby` | Waiting; host can start round (≥2 members) |
| `prompting` | Participants submit one prompt each |
| `resolving` | Submissions locked; generations finish; host judges |
| `results` | Winner selected; campaigns visible |
| `finished` | Optional end state (not required for happy path) |

### Round (`open` → `locked` → `complete`)

Mirrors room phase while the round is active.

### Generation job (`queued` → `running` → `completed` | `failed` | `timed_out`)

- Created immediately when a prompt is submitted (HTTP returns without waiting).
- **Retry:** one automatic retry on provider failure; manual retry via REST for failed/timed-out jobs (`retry_count` capped at 1).
- **Timeout:** `GENERATION_JOB_TIMEOUT_SECONDS` (default 120) via thread pool `future.result(timeout=…)`.

---

## Realtime event model

### Client → server (Socket.IO)

| Event | Who | Payload |
|-------|-----|---------|
| `authenticate` | All | `{ access_token }` |
| `join_room` | All | `{ room_code }` |
| `leave_room` | All | `{ room_id }` |
| `start_round` | Host | `{ room_id, battle_theme?, deadline_seconds? }` |
| `lock_submissions` | Host | `{ room_id, round_id }` |
| `submit_prompt` | Player | `{ round_id, prompt_text }` |
| `score_submission` | Host | `{ room_id, submission_id, score }` |
| `select_winner` | Host | `{ room_id, round_id, submission_id }` |

### Server → room broadcast

| Event | When |
|-------|------|
| `room_snapshot` | Any material state change (authoritative shared state) |
| `activity` | New `ActivityEvent` row |
| `round_started` / `round_locked` / `round_completed` | Round lifecycle |
| `submission_received` | New prompt (count only — no leaked text pre-results) |
| `job_queued` / `job_running` / `job_completed` / `job_failed` | Per-submission AI job |
| `submission_scored` / `winner_selected` | Host judging |
| `submission_saved` | Ack to submitter only |

REST mirrors host/player actions for clients that prefer HTTP; both paths emit the same socket events.

---

## Chosen judging / scoring mechanism

**Mechanism:** Host-only **numeric score (1–10)** on each completed submission, plus **single winner selection** on one submission card.

**Why this design**

- Matches assignment requirement to “score, rank, or eliminate” without building brackets, public voting, or AI-as-judge.
- One clear winner (`round.winner_user_id`) is easy to persist and show in UI (winner badge).
- Scores are optional metadata for tie-breaking and future leaderboards.

**Weaknesses**

- No automatic ranking across multiple submissions; host must compare cards manually.
- No elimination rounds — only one linear round.
- Host could pick winner without scoring (score defaults to 10 when winner is selected without prior score).

**Production improvements**

- Rubric checklist per theme, blind judging mode, participant voting with host override, ELO across rooms, or LLM-assisted critique with human-final approval.

---

## What is persisted vs ephemeral

| Persisted (SQLite) | Ephemeral |
|--------------------|-----------|
| Users, rooms, participants, rounds, submissions, jobs, scores, winner, activity events | Socket `sid` → `user_id` map (in-memory) |
| JWT in browser `localStorage` | Thread pool task handles |
| Last room code in `localStorage` for rejoin UX | |

Refreshing the page: JWT + DB restore room snapshot via REST/Socket; battle state survives.

---

## Failure handling strategy

| Failure | Behavior |
|---------|----------|
| Invalid / empty prompt | 422 validation before write |
| Duplicate submission | 409 `DUPLICATE_SUBMISSION` |
| Host submits | 403 `HOST_CANNOT_SUBMIT` (backend + hidden UI) |
| Non-host controls round | 403 `HOST_ONLY` |
| Judge before generation done | 409 `GENERATION_NOT_COMPLETE` |
| Mock AI failure | Auto-retry once → then `failed` + UI retry button |
| Job timeout | `timed_out` on job; submission `failed`; retry if allowed |
| Socket disconnect | Auto-reconnect; re-`authenticate` + re-`join_room`; personal snapshot refresh |
| Token expired | Landing hydrate clears bad token; user re-enters name |

---

## AI / provider assumptions

- **Current:** `MockAIProvider` — sleep 2–6s, ~12% failure, returns `{ title, tagline, campaign_text }` (e.g. “Chrome Tears”, “Neon Saints”).
- **Config:** `MOCK_AI_*`, `GENERATION_JOB_TIMEOUT_SECONDS` in `backend/.env`.
- **Real LLM:** Implement `BaseAIProvider.generate_campaign()` and register in `get_ai_provider()`; keep job wrapper unchanged.

---

## Role & permission enforcement (backend)

| Action | Host | Player |
|--------|------|--------|
| Start / lock round, score, pick winner | Yes | No |
| Submit prompt | **No** (`HOST_CANNOT_SUBMIT`) | Yes (one per round, while `prompting`) |
| Join room | Yes | Yes |

Enforced in `RoundService`, `JudgingService`, and socket handlers — not only hidden buttons.

---

## Known limitations

- **One round per room session** — no tournament bracket.
- **Guest auth** — each “login” registers a new user unless reusing stored JWT; no email/password.
- **Single server process** — in-memory socket map and thread pool; no horizontal scale without Redis adapter + queue.
- **Polling not used** for battle state — Socket.IO required.
- **No spectator mode, media generation, payments, moderation.**
- **Mobile layout** — desktop-first battle dashboard.
- **No hosted deployment** in repo (local demo only).

---

## What I would improve with more time

1. Real OpenAI/Anthropic provider behind `BaseAIProvider` with structured output schema.
2. Playwright e2e test for two-tab battle flow.
3. Redis + Celery for generation at scale; Socket.IO message queue for multi-worker.
4. Refresh token rotation and “same display name” session resume policy.
5. Host deadline auto-lock scheduler when all jobs complete.
6. Short demo video/GIF in repo for reviewers.

---

## Project structure

```
PromptArena/
├── README.md                 ← this file (submission README)
├── backend/
│   ├── app/                  # Flask factory, models, services, sockets
│   ├── tests/                # pytest assignment flow
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py
├── frontend/
│   ├── src/app/              # Landing + /room/[code]
│   ├── src/components/       # Room UI
│   ├── src/stores/           # Zustand
│   └── .env.local.example
└── docs/ARCHITECTURE.md      # Extended architecture (phase 1)
```

---

## Submission checklist (assignment §9–10)

| Item | Location |
|------|----------|
| Application source | `backend/`, `frontend/` |
| README (setup, architecture, tradeoffs, judging, gaps) | This file |
| Demo evidence | Record the quick start flow above (screen recording or screenshots) |
| Environment sample | `backend/.env.example`, `frontend/.env.local.example` |
| Seed / test data | `flask seed-demo`; `pytest tests/` |

---

## License / attribution

Built for the Poiro intern assignment. Backend and frontend are MIT-style sample code for review purposes.
