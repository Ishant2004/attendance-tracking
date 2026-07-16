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
1. If an existing record is manual **Leave/Holiday** → keep it (don't clobber).
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
For each active user, over the trailing window, considers **working-day records only** (excludes Weekend/Holiday/Leave), then:

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
| GET | `/` | manager/leadership/admin | list (role-scoped; manager → reports+self) |
| GET | `/:id` | self/manager/leadership/admin | one user |
| POST | `/` | admin | create (name,email,password,role,team?,manager?,officeLocations?) |
| PUT | `/:id` | admin (any fields) / self (name,password) | update |
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
| POST | `/` | admin | create (name,lat,lng,radiusMeters) |
| PUT | `/:id` | admin | update |
| DELETE | `/:id` | admin | soft-deactivate |

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
