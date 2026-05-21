# PromptArena — MVP Architecture (Phase 1)

Realtime multiplayer AI prompt battle. One monorepo, one Flask process, one Next.js app, SQLite. No microservices.

---

## 1. Database Entities

All tables use integer PKs and UTC timestamps (`created_at`, `updated_at` where useful).

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| display_name | TEXT NOT NULL | Guest-friendly; no auth in MVP |
| session_token | TEXT UNIQUE | Opaque token stored in client cookie/localStorage for reconnect |
| created_at | DATETIME | |

### `rooms`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| code | TEXT UNIQUE | 6-char join code |
| host_user_id | INTEGER FK → users | |
| status | TEXT | See §3 state machine |
| current_round_id | INTEGER FK → rounds NULLABLE | Denormalized pointer for fast reads |
| max_players | INTEGER DEFAULT 8 | |
| created_at | DATETIME | |

### `room_participants`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| room_id | INTEGER FK → rooms | |
| user_id | INTEGER FK → users | |
| role | TEXT | `host` \| `player` |
| connection_status | TEXT | `online` \| `offline` |
| joined_at | DATETIME | |
| left_at | DATETIME NULLABLE | Soft leave |

**Unique:** `(room_id, user_id)` where `left_at IS NULL`

### `rounds`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| room_id | INTEGER FK → rooms | |
| round_number | INTEGER | 1-based per room |
| status | TEXT | See §3 |
| battle_theme | TEXT | Host-set or default prompt challenge |
| prompt_deadline | DATETIME NULLABLE | Server-enforced timeout |
| winner_user_id | INTEGER FK → users NULLABLE | |
| created_at | DATETIME | |
| resolved_at | DATETIME NULLABLE | |

### `submissions`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| round_id | INTEGER FK → rounds | |
| user_id | INTEGER FK → users | |
| prompt_text | TEXT NOT NULL | Player's battle prompt |
| submitted_at | DATETIME | |
| ai_output | TEXT NULLABLE | Filled when job completes |
| score | REAL NULLABLE | 0–100 from judge step |
| judge_reason | TEXT NULLABLE | Short explanation for feed/UI |

**Unique:** `(round_id, user_id)` — one submission per player per round

### `jobs`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| round_id | INTEGER FK → rounds UNIQUE | One resolve job per round |
| type | TEXT | `resolve_round` |
| status | TEXT | See §5 |
| error_message | TEXT NULLABLE | |
| started_at | DATETIME NULLABLE | |
| finished_at | DATETIME NULLABLE | |
| created_at | DATETIME | |

### `activity_events`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| room_id | INTEGER FK → rooms | |
| round_id | INTEGER FK → rounds NULLABLE | |
| actor_user_id | INTEGER FK → users NULLABLE | System events: NULL |
| event_type | TEXT | See §8 |
| payload | TEXT | JSON string (SQLite has no JSONB) |
| created_at | DATETIME | |

**Index:** `(room_id, id DESC)` for feed pagination

---

## 2. Entity Relationships

```
users 1───* room_participants *───1 rooms
users 1───* submissions
users 1───* activity_events (actor, optional)

rooms 1───* rounds
rooms 1───* room_participants
rooms 1───* activity_events
rooms *───1 users (host_user_id)

rounds 1───* submissions
rounds 1───1 jobs (resolve_round)
rounds *───1 users (winner_user_id, optional)

rounds *───1 rooms (room.current_round_id points to active round)
```

**Cardinality rules (MVP):**
- A room has exactly one active round while `status ∈ {prompting, resolving, results}`.
- A round belongs to one room; submissions belong to one round.
- When a room is `lobby` or `finished`, `current_round_id` is NULL.

---

## 3. Explicit State Transitions

### Room status (`rooms.status`)

| State | Meaning |
|-------|---------|
| `lobby` | Waiting for players; host can start |
| `prompting` | Round open; accepting submissions |
| `resolving` | Deadline met or all submitted; AI job running |
| `results` | Scores available; brief display before next action |
| `finished` | Battle ended (host ended or left) |

```
                    start_round
    lobby ──────────────────────────► prompting
      ▲                                    │
      │                                    │ all_submitted OR deadline
      │                                    ▼
      │                               resolving
      │                                    │
      │                          job_completed (success)
      │                                    ▼
      │                                 results
      │                                    │
      │         end_room                   │ host: end_room OR auto after TTL
      └────────────────────────────────────┴──────────────► finished

prompting ──(deadline, 0 submissions)──► results  [edge: no-op round, still show empty results]

resolving ──(job_failed)──► results  [payload includes error; partial scores if any]
```

**Guards:**
- `start_round`: caller is host, room is `lobby`, ≥2 online players.
- Transitions to `resolving`: only from `prompting`; set atomically in DB + emit.
- `results` → `lobby`: optional MVP stretch; **Phase 1:** `results` → `finished` only (one round per room session).

### Round status (`rounds.status`)

Mirrors room phase for the active round:

| Round state | Room state |
|-------------|------------|
| `open` | `prompting` |
| `locked` | `resolving` |
| `complete` | `results` |

```
open ──(lock)──► locked ──(resolve)──► complete
```

`lock` happens when entering `resolving`; `resolve` when job finishes.

### Participant connection (`room_participants.connection_status`)

```
offline ──(socket connect + join_room)──► online
online ──(disconnect / heartbeat timeout)──► offline
```

Leaving sets `left_at`; reconnect with same `session_token` reactivates row if room not `finished`.

---

## 4. WebSocket Event Model

Transport: **Flask-SocketIO** (rooms as Socket.IO rooms named `room:{id}`).

### Client → Server

| Event | Payload | Handler behavior |
|-------|---------|------------------|
| `authenticate` | `{ session_token }` | Bind socket to user; return `user` |
| `join_room` | `{ room_code }` | Add participant; join SIO room; emit snapshot |
| `leave_room` | `{ room_id }` | Mark offline/left; leave SIO room |
| `start_round` | `{ room_id, battle_theme? }` | Host only; create round; transition states |
| `submit_prompt` | `{ round_id, prompt_text }` | Validate deadline + status; upsert submission |
| `end_room` | `{ room_id }` | Host only; → `finished` |
| `ping` | `{}` | Update last_seen; reply `pong` |

### Server → Client (broadcast to `room:{id}` unless noted)

| Event | Payload | When |
|-------|---------|------|
| `room_snapshot` | Full state (§7) | On join, reconnect, any major transition |
| `participant_updated` | `{ user, connection_status }` | Join/leave/reconnect |
| `round_started` | `{ round, deadline }` | After `start_round` |
| `submission_received` | `{ round_id, user_id, submitted_count, total }` | After submit (prompt text **not** broadcast until results) |
| `round_locked` | `{ round_id }` | Entering `resolving` |
| `round_results` | `{ round, submissions[], winner }` | Job complete; includes all prompts + scores |
| `activity` | `{ event }` | Every `activity_events` insert |
| `error` | `{ code, message }` | To requesting socket only |

**Privacy rule:** During `prompting`, other players only see *that* someone submitted, not the text. Full prompts revealed in `round_results`.

### Ack pattern

Use Socket.IO callbacks for mutating events (`start_round`, `submit_prompt`) returning `{ ok, error? }` so the client can show immediate validation errors without waiting for broadcast.

---

## 5. Async Job Lifecycle

MVP uses a **background thread pool inside the Flask process** (not Celery). Suitable for single-server MVP.

### Job record: `jobs` where `type = resolve_round`

| Status | Meaning |
|--------|---------|
| `queued` | Created, not started |
| `running` | AI calls in progress |
| `completed` | All submissions scored |
| `failed` | Unrecoverable error |

```
queued ──(worker picks up)──► running ──(success)──► completed
                                  │
                                  └──(exception)──► failed
```

### `resolve_round` worker steps

1. Load round + all submissions for round.
2. For each submission (sequential in MVP — parallel later):
   - Call LLM: generate response from `prompt_text` + `battle_theme`.
   - Call LLM judge: score 0–100 + `judge_reason` vs theme/rubric.
   - Update `submissions` row.
3. Set `winner_user_id` = highest score (tie: lowest `user_id` wins).
4. Update round → `complete`, room → `results`.
5. Insert `activity_events` (`round_completed`, `winner_announced`).
6. Emit `round_results` + `room_snapshot` to room.

**Enqueue triggers:** Room transitions to `resolving` (all submitted OR deadline scheduler fires).

**Idempotency:** Unique `jobs.round_id`; if job already `running`/`completed`, ignore duplicate enqueue.

**Deadline scheduler:** Simple APScheduler interval (every 5s) or check on each `submit_prompt`: if `now > prompt_deadline` and status `prompting`, lock round and enqueue job.

---

## 6. Backend Role Permissions

| Action | Host | Player | Unauthenticated |
|--------|------|--------|-----------------|
| Create room (REST) | — | — | ✓ (creates user + token) |
| Join room (WS) | ✓ | ✓ | ✓ (after authenticate) |
| Start round | ✓ | ✗ | ✗ |
| Submit prompt | ✓ | ✓ (if in room, round open) | ✗ |
| End room | ✓ | ✗ | ✗ |
| View activity feed (REST) | ✓ | ✓ | ✗ |
| Receive room broadcasts | ✓ | ✓ | ✗ |

**Enforcement:** Decorator `@require_auth` on socket handlers; `@require_room_member` + `@require_role('host')` where needed. Load participant from `(room_id, user_id)` with `left_at IS NULL`.

**Host transfer (MVP skip):** If host disconnects, host remains host; they can reconnect. No auto-promote in Phase 1.

---

## 7. Reconnect Recovery Strategy

### Client identity
- On first visit: `POST /api/session` → `{ user_id, session_token }` stored in localStorage.
- Every socket connect: emit `authenticate` then `join_room` if user was in a battle.

### Server-side
- Map `session_token` → `user_id` in memory (`sid → user_id`) and optional Redis later; MVP: in-memory dict on single server.
- Track `last_seen_at` on heartbeat `ping` (every 30s).

### On `join_room` / reconnect
Server emits **`room_snapshot`** — single source of truth:

```json
{
  "room": { "id", "code", "status", "host_user_id" },
  "participants": [{ "user_id", "display_name", "role", "connection_status" }],
  "current_round": {
    "id", "round_number", "status", "battle_theme",
    "prompt_deadline", "submissions": [
      { "user_id", "submitted": true }
    ]
  },
  "my_submission": { "prompt_text" } | null,
  "latest_results": { ... } | null,
  "activity_cursor": 12345
}
```

**Rules:**
- If room `finished`, snapshot includes final results only; client routes to summary screen.
- If `prompting` and user already submitted, include `my_submission` only for that user (via targeted emit or snapshot field).
- Client Zustand store replaces state from snapshot (no merge logic beyond activity append).

### Missed events during disconnect
- Snapshot covers authoritative state; optional `GET /api/rooms/:id/activity?after=:cursor` to backfill feed gaps.

---

## 8. Activity Feed Architecture

### Write path
Every meaningful action inserts one `activity_events` row **in the same DB transaction** as the state change, then emits `activity` on the socket.

### Event types (MVP)

| event_type | payload example |
|------------|-----------------|
| `room_created` | `{ code }` |
| `player_joined` | `{ display_name }` |
| `player_left` | `{ display_name }` |
| `round_started` | `{ round_number, battle_theme }` |
| `prompt_submitted` | `{ display_name }` — no prompt text |
| `round_locked` | `{ round_number }` |
| `round_completed` | `{ round_number }` |
| `winner_announced` | `{ display_name, score }` |
| `room_ended` | `{}` |

### Read path
- **Live:** `activity` socket events appended to Zustand `activityFeed[]` (cap 100 in memory).
- **History:** `GET /api/rooms/:id/activity?after_id=0&limit=50` returns chronological page for scroll-up.

### UI
Single `ActivityFeed` component; renders `event_type` → template. No separate microservice.

---

## 9. API Route Design

### REST (JSON)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/session` | Create anonymous user + session_token |
| POST | `/api/rooms` | Create room; body: `{ display_name }`; returns `{ room, code, user }` |
| GET | `/api/rooms/:code` | Public lobby info (status, player count) — no prompts |
| GET | `/api/rooms/:id` | Full room detail for authenticated member |
| GET | `/api/rooms/:id/activity` | Query: `after_id`, `limit` |
| GET | `/api/health` | `{ status: "ok" }` |

**Not REST (Socket.IO):** start round, submit prompt, end room, realtime updates.

### Error shape (consistent)

```json
{ "error": { "code": "ROOM_FULL", "message": "..." } }
```

### CORS
Next.js dev → Flask origin allowed; credentials for session cookie optional (MVP: token in header `X-Session-Token`).

---

## 10. Folder Structure

```
PromptArena/
├── docs/
│   └── ARCHITECTURE.md          # this file
├── backend/
│   ├── app.py                   # create_app(), socketio.run()
│   ├── config.py                # SQLITE_PATH, SECRET_KEY, LLM keys
│   ├── extensions.py            # db, socketio instances
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── room.py
│   │   ├── round.py
│   │   ├── submission.py
│   │   ├── job.py
│   │   └── activity.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── session.py
│   │   ├── rooms.py
│   │   └── health.py
│   ├── socket_handlers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── room.py
│   │   └── battle.py
│   ├── services/
│   │   ├── room_service.py      # state transitions + guards
│   │   ├── battle_service.py    # submissions, lock, winner
│   │   ├── activity_service.py  # insert + serialize events
│   │   └── snapshot_service.py  # build room_snapshot payload
│   ├── jobs/
│   │   ├── worker.py            # thread pool executor
│   │   └── resolve_round.py     # AI generate + judge
│   ├── scheduler.py             # deadline checks (APScheduler)
│   └── db/
│       ├── init_db.py
│       └── schema.sql             # optional raw SQL bootstrap
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       ├── app/
│       │   ├── page.tsx                 # landing / create / join
│       │   ├── room/[code]/page.tsx     # battle room UI
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ActivityFeed.tsx
│       │   ├── ParticipantList.tsx
│       │   ├── PromptEditor.tsx
│       │   ├── ResultsPanel.tsx
│       │   └── RoomHeader.tsx
│       ├── stores/
│       │   └── battleStore.ts           # Zustand: room, round, feed, connection
│       ├── lib/
│       │   ├── api.ts                   # REST client
│       │   └── socket.ts                # Socket.IO client + reconnect
│       └── types/
│           └── index.ts                 # mirrors snapshot + events
├── .env.example
└── README.md
```

---

## Playable Round — End-to-End Flow (Reference)

1. User A: `POST /api/session` → token. `POST /api/rooms` → code `ABC123`.
2. User B: session + `join_room` via socket with code.
3. Host A: `start_round` → room `prompting`, `round_started` broadcast, deadline set (e.g. 90s).
4. A and B: `submit_prompt` → `submission_received` updates count; activity `prompt_submitted`.
5. When both submitted (or deadline): server → `resolving`, `round_locked`, job `queued`.
6. Worker runs `resolve_round`, scores, picks winner.
7. Server → `round_results` + room `results`; activity `winner_announced`.
8. Host: `end_room` → `finished`; or client shows results and ends session.

---

## Zustand Store Shape (frontend contract)

```ts
interface BattleStore {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  user: User | null;
  room: Room | null;
  participants: Participant[];
  currentRound: Round | null;
  mySubmission: string | null;
  results: RoundResults | null;
  activityFeed: ActivityEvent[];
  activityCursor: number;
  // actions
  applySnapshot: (s: RoomSnapshot) => void;
  appendActivity: (e: ActivityEvent) => void;
  setConnectionStatus: (s: ...) => void;
}
```

Socket listener module dispatches to these actions; components stay mostly dumb.

---

## Tech Notes (MVP constraints)

| Choice | Rationale |
|--------|-----------|
| SQLite | Zero ops; fine for demo/single instance |
| Thread pool jobs | No Redis/Celery until scale demands it |
| Single round per room | Matches "one complete playable battle round" scope |
| Anonymous sessions | Ship faster; add OAuth later |
| Sequential AI calls | Simpler error handling; optimize later |

---

## Out of Scope (Phase 2+)

- Multiple rounds per room / tournaments
- Spectators, chat, emotes
- Redis adapter for multi-worker Socket.IO
- Prompt moderation pipeline
- ELO / leaderboards

---

*Phase 1 deliverable: this document. Implementation follows folder structure and contracts above.*
