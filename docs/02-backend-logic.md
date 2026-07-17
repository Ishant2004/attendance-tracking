# 02 — Backend Logic (Node + Express + Mongoose)

## Architecture — layered, thin controllers

```
HTTP request
   │
   ▼
routes/*.js        → path + method, attaches middleware (auth, authorize, validators)
   │
   ▼
middleware/        → auth (verify JWT) · authorize(...roles) · validate (express-validator) · errorHandler
   │
   ▼
controllers/*.js   → thin: read req, call a service, shape the JSON response
   │
   ▼
services/*.js      → ALL business logic + data access (the brains)
   │
   ▼
models/*.js        → Mongoose schemas (validation, indexes, hooks)
   │
   ▼
MongoDB
```

**Cross-cutting utilities**
- `utils/ApiError.js` — `throw new ApiError(status, message)`.
- `utils/asyncHandler.js` — wraps async controllers so thrown errors reach the error handler.
- `middleware/errorHandler.js` — turns errors into `{ success:false, message }` with the status.
- **Response envelope:** success → `{ success:true, data:{...}, message? }`.
- `config/env.js` — central env (`port`, `mongoUri`, `jwt.*`, `tzOffsetMinutes=330`, `timezone='Asia/Kolkata'`).
- `utils/datetime.js` — IST helpers: `dateStrInTZ()`, `dayWindow(dateStr)` → `[start,end]` UTC instants for an IST day, `isWeekend(dateStr)`.

## Auth & JWT

- **Login** (`authService.login`): find user by email **with** `+passwordHash`, `comparePassword`, reject if `!isActive` → returns `{ user, accessToken, refreshToken }`.
- **Access token** — short-lived (`15m`), payload `{ sub: userId, role }`. **Refresh token** — long-lived (`7d`), payload `{ sub }`.
- `middleware/auth.js` — reads `Authorization: Bearer <token>`, verifies access token, loads `req.user` (full Mongoose doc, so `.save()` works), rejects inactive/expired/invalid.
- `middleware/authorize(...roles)` — 403 unless `req.user.role` is in the list.
- **Change password** (`authService.changePassword`): re-fetch with `+passwordHash`, verify current password, reject reuse of same password, set new (hashed by hook).

## Role-based access control (RBAC)

| Role | Scope |
|---|---|
| `employee` | self only |
| `manager` | self + reports (`user.manager == me`) + teams where `me ∈ team.managers` |
| `leadership` | org-wide read (all teams/users) |
| `admin` | full CRUD on users / teams / office-locations / holidays |

Two scoping helpers power this:
- `userService.assertCanView(requester, target)` — self / report / leadership / admin.
- `teamService.isManagerOf(team, userId)` — is user in `team.managers[]` (handles populated or raw refs). Reused by dashboard + flag services.

## Domain logic (the important algorithms)

### Geofencing — `utils/geofence.js`
- `distanceMeters(lat1,lon1,lat2,lon2)` — **haversine** great-circle distance.
- `resolveAgainstOffices(offices, lat, lng)` — checks the point against a **specific list of offices** (the user's assigned, active ones); returns the nearest match → `{ detectedLocationType:'WFO', officeLocation }`, else `{ 'WFH', null }`.
- **On event ingest** (`attendanceEventService.recordEvent`): load the user's `officeLocations` (populated), resolve against **only those** → so WFO means "inside one of *your* offices". No assigned offices ⇒ always WFH.

### Daily rollup — `attendanceRecordService.rollupEventsToRecord(userId, dateStr)`
Aggregates a user's events for one IST day into their `AttendanceRecord`. Precedence:
1. If an existing record is approved **Leave / Half Day / Holiday**, or has **`manualOverride`** set (a manager correction) → keep it (don't clobber) — this is why check-in/out have **no effect** on an approved leave day, and why an approved record correction sticks.
2. If there **are events**: `status = WFO` if *any* event that day is WFO, else `WFH`.
   - `checkInTime` = first `check_in` (or first event); `checkOutTime` = last `check_out` (or last event).
   - `totalHours` = hours between them; `officeLocation` = first WFO event's office.
   - `isLate` = check-in hour **≥ 10:00 IST** (`LATE_THRESHOLD_HOUR = 10`).
3. If **no events**: classify the day via `calendarService.getDayType` → `Holiday` → `Weekend` → else `Absent`.
- **Idempotent** (unique `{user,date}` index). Called on read of `/:userId/:date`, on check-in/out, and by the nightly cron.
- **"Any WFO wins"** heuristic: one office ping flips the day to WFO.

### Calendar — `calendarService.getDayType(dateStr)`
`Holiday` (active holiday for that date) → else `Weekend` (Sat/Sun) → else `Working`. Holidays match by `YYYY-MM-DD` string (timezone-proof).

### Outlier detection — `flagService.runDetection({ windowDays = 7 })`
For each active user, over the trailing window, considers **working-day records only** (excludes Weekend/Holiday/Leave/Half Day), then:

| Flag | Condition | Severity |
|---|---|---|
| `frequent_late` | late count **≥ 3** | medium (≥3) / high (≥5) |
| `frequent_absence` | Absent count **≥ 3** | medium / high |
| `low_wfo_ratio` | worked ≥ 3 days **and** WFO/worked **< 0.20** | medium |
| `irregular_hours` | days with hours `<4` or `>12` **≥ 3** | medium / high |

Thresholds: `{ lateCount:3, absenceCount:3, lowWfoRatio:0.2, irregularCount:3 }`. **Upserts** on `{user, flagType, weekStartDate}` → idempotent.

### Dashboards — `dashboardService.js` (read-only aggregation)
- `individual(userId, range)` — per-day records + a `summary` (WFO/WFH/Absent/late counts, `wfoRatio`, `avgHours`, present days) + open flag count.
- `team(teamId, range)` — team `summary` + per-member breakdown (`members[]`).
- `leadership(range)` — org totals + per-team comparison.
- `wfoRatio` / `trends` — org/team/user scoped; trends uses a Mongo `$group` by `YYYY-MM-DD`.
- Default range = trailing **30 days**; manager access checked via `isManagerOf`.

### Leave & half-day workflow — `leaveRequestService.js`
- **createRequest** — a user files a request for themselves; `manager` is snapshotted from `user.manager` (must exist). `half_day` collapses `toDate` to `fromDate`. Rejects (409) any request that **overlaps** an existing `pending`/`approved` one for that user (lexical `YYYY-MM-DD` comparison: `from ≤ otherTo && to ≥ otherFrom`).
- **listMine / listInbox** — own requests vs. the approval queue (requests where `manager == me`, i.e. your direct reports; naturally follows the reporting hierarchy). Cancelled requests are excluded from the inbox.
- **review(approve|reject)** — only the assigned manager, or leadership/admin, may act; a request can only be reviewed while `pending`. On **approve**, `applyToRecords` upserts each **working day** in the range to `Leave` (or `Half Day`), skipping weekends/holidays. Because the rollup preserves those statuses, later pings/check-ins don't override an approved day.
- **cancelRequest** — the requester withdraws their own still-`pending` request (→ `cancelled`); frees the dates for a new request.

### Record correction workflow — `recordChangeRequestService.js`
- Same request/approve/reject/cancel shape as leave, but for **one day's status**. `createRequest` snapshots the record's `currentStatus`, blocks a second pending request for the same day (409), and rejects asking for the status it already has.
- On **approve**, `applyToRecord` upserts the day's `AttendanceRecord` to `requestedStatus` and sets `manualOverride:true` (clearing the time fields for non-working statuses). The rollup honours `manualOverride`, so the correction survives future pings/reads. The direct manager override (`PUT /attendance-records/:id`) also sets `manualOverride` when it changes `status`.
- **`GET /users/:id`** populates `manager` (name/email) and `team` (name) — the `/me` page uses this to show the user's reporting manager.

### Realtime chat — `socket.js` (Socket.IO)
- Socket.IO is attached to the same HTTP server in `server.js` (`initSocket(server)`); `app.js` stays a plain Express app.
- **Handshake auth:** `io.use` reads the JWT access token from `socket.handshake.auth.token`, verifies it (same secret as REST), loads the user, and sets `socket.userId`; invalid/inactive → connection refused.
- On connect each socket **joins a room named by its user id**, so a message is delivered with `io.to(userId)`.
- Events: client emits **`chat:send`** `{ toUserId, body }` (with an ack) → `chatService.sendMessage` persists it, then `broadcastMessage` emits **`chat:message`** `{ message, conversation }` to **both** participants' rooms; client emits **`chat:read`** `{ conversationId }` to clear unread.
- `chatService`: `keyFor` (sorted-pair thread key), `getOrCreateConversation`, `sendMessage` (persist + bump `lastMessage`/`unread`), `markRead`, and history/list helpers. Single-instance in-memory rooms; horizontal scaling would add the Socket.IO Redis adapter.

## Background jobs — `jobs/attendanceJobs.js` (node-cron, IST)
- **Nightly rollup** — `'30 0 * * *'` (00:30 IST): materialize *yesterday* for every active user (creates Absent/Weekend/Holiday for no-shows).
- **Weekly detection** — `'30 1 * * 0'` (Sun 01:30 IST): `runDetection({windowDays:7})`.
- Manual triggers: `scripts/runRollup.js [YYYY-MM-DD]`, `scripts/runDetection.js [windowDays]`.
- Timezone: cron uses `timezone: 'Asia/Kolkata'`; day math uses fixed +5:30 offset (IST has no DST).

## Full endpoint inventory

> Base: `/api`. Envelope: `{ success, data, message }`. `A`=auth required.

### Auth — `/auth`
| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/login` | public | email+password → tokens+user |
| POST | `/refresh` | public | refreshToken → new access token |
| POST | `/logout` | A | stateless ack |
| GET | `/me` | A | current user |
| POST | `/change-password` | A | `{currentPassword,newPassword}` |

### Users — `/users`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | manager/leadership/admin | list **active users** (role-scoped; manager → reports+self) — deactivated users are hidden |
| GET | `/tree` | any A | org-wide directory: all active users with minimal fields (`name, role, team.name, manager`) for the reporting-hierarchy view |
| GET | `/:id` | self/manager/leadership/admin | one user (populates `manager` name/email + `team` name) |
| POST | `/` | admin | create — **non-admin requires team + manager + ≥1 office**; manager's role must fit the hierarchy (employee→manager, manager→leadership, leadership→admin). Admins are exempt |
| PUT | `/:id` | admin (any fields) / self (name,password) | update — same invariants enforced on the result (non-admin must keep a valid team, hierarchy-correct manager, and ≥1 office) |
| DELETE | `/:id` | admin | soft-deactivate (**cannot deactivate self** → 400) |
| GET | `/:id/team` | self/manager/leadership/admin | user's team (populated) |

### Teams — `/teams`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | leadership/admin | all teams |
| GET | `/managed` | manager/leadership/admin | teams where caller ∈ managers[] |
| GET | `/:id` | manager(of)/leadership/admin | one team |
| POST | `/` | admin | create (name, **managers[] ≥1**) |
| PUT | `/:id` | admin | update (name / managers[]) |
| GET | `/:id/members` | manager(of)/leadership/admin | users in the team |

### Office locations — `/office-locations`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | any A | active fences (admin can `?includeInactive=true`) |
| GET | `/:id` | admin | one |
| POST | `/` | admin | create (name,lat,lng,radiusMeters) — **reactivates** a soft-deleted location with the same name |
| PUT | `/:id` | admin | update (name/lat/lng/radius) |
| DELETE | `/:id` | admin | soft-delete (`isActive:false`) — hidden from lists |

### Attendance events — `/attendance-events`
| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/` | A (rate-limited 60/min) | passive ping (self) |
| POST | `/check-in` | A | explicit check-in (self) |
| POST | `/check-out` | A | explicit check-out (self) |
| GET | `/current-status/:userId` | self/manager | latest status (WFO/WFH, checkedIn) |
| GET | `/:userId` | self/manager | raw event history |

### Attendance records — `/attendance-records`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | manager/leadership/admin | list (filters user/team/date-range) |
| GET | `/:userId/:date` | self/manager | one day (auto-rolls-up on read) |
| GET | `/:userId` | self/manager | history |
| PUT | `/:id` | manager(report)/admin | manual override |
| POST | `/mark-leave` | self/manager/leadership/admin | set Leave/Holiday for a date |

### Leave requests — `/leave-requests`
| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/` | A | request time off for **self** — `{type:'leave'|'half_day', fromDate, toDate?, reason?}` (addressed to your `manager`; requires you to have one) |
| GET | `/mine` | A | your own requests |
| GET | `/inbox` | manager/leadership/admin | requests from your **direct reports** (approval queue, pending first) |
| PUT | `/:id/approve` | manager/leadership/admin | approve (assigned manager, or leadership/admin) → writes `Leave`/`Half Day` onto working days |
| PUT | `/:id/reject` | manager/leadership/admin | reject (no record change) |
| PUT | `/:id/cancel` | A (requester) | withdraw your own **pending** request (→ `cancelled`) |

### Record-change requests — `/record-change-requests`
| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/` | A | request a correction to **one of your own days** — `{date, requestedStatus, reason?}` (one pending per day; can't request the current status) |
| GET | `/mine` | A | your own change requests |
| GET | `/inbox` | manager/leadership/admin | requests from your direct reports |
| PUT | `/:id/approve` | manager/leadership/admin | approve → sets that day's record to `requestedStatus` with `manualOverride:true` |
| PUT | `/:id/reject` | manager/leadership/admin | reject (no record change) |
| PUT | `/:id/cancel` | A (requester) | withdraw your own pending request |

### Chat — `/chat`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/conversations` | A | my conversations (sorted by recent, includes per-user `unread`) |
| POST | `/conversations` | A | start/fetch a 1:1 thread — `{ userId }` (anyone ↔ anyone; not yourself) |
| GET | `/conversations/:id/messages` | A (participant) | message history (`?before=&limit=`, newest-capped at 100) |
| POST | `/conversations/:id/messages` | A (participant) | send a message (also broadcast over Socket.IO) |
| POST | `/conversations/:id/read` | A (participant) | mark the thread read (resets my unread, stamps `readAt`) |

> Sending is normally done over the **WebSocket** (`chat:send`); the REST send endpoint is an equivalent fallback and also broadcasts.

### Flags — `/flags`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | manager/leadership/admin | list (filters team/severity/type/resolved) |
| GET | `/:userId` | self/manager | a user's flags |
| GET | `/team/:teamId` | manager(of)/leadership/admin | team flags |
| POST | `/` | manager/admin | create a flag |
| PUT | `/:id/resolve` | manager(report)/admin | resolve |
| POST | `/run-detection` | admin | run detection now |

### Dashboard — `/dashboard`
| Method | Path | Access |
|---|---|---|
| GET | `/individual/:userId` | self/manager/leadership/admin |
| GET | `/team/:teamId` | manager(of)/leadership/admin |
| GET | `/leadership` | leadership/admin |
| GET | `/wfo-wfh-ratio` | scoped (user self / team manager / org leadership) |
| GET | `/attendance-trends` | scoped as above |

### Holidays — `/holidays`
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | any A | active holidays (admin `?includeInactive=true`) |
| POST | `/` | admin | create (date `YYYY-MM-DD`, name) — reactivates a soft-deleted date |
| PUT | `/:id` | admin | update `date` and/or `name` (409 if new date clashes; refreshes `updatedAt`) |
| DELETE | `/:id` | admin | soft-delete |

## API docs
Swagger UI is served at **`/docs`** (generated by `swagger-autogen` from the routes, spec at `src/docs/swagger-output.json`; regenerate with `npm run swagger`).
