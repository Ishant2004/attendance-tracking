# 01 — Database Schema (MongoDB / Mongoose)

> The DB is **MongoDB**. Each "table" is a **collection** of documents. Relationships are
> `ObjectId` references (like foreign keys) resolved with Mongoose `.populate()`.
> Every model auto-adds `createdAt` / `updatedAt` (`{ timestamps: true }`) and strips
> `__v` (and `passwordHash`) from JSON responses.

## Collections at a glance

```
User ─┬─ team ────────► Team ──── managers[] ──► User (many managers per team)
      ├─ manager ─────► User        (a user's reporting manager, self-reference)
      └─ officeLocations[] ─► OfficeLocation   (offices this user counts as WFO)

AttendanceEvent ── user ─► User,  officeLocation ─► OfficeLocation   (raw GPS pings)
AttendanceRecord ─ user ─► User,  officeLocation ─► OfficeLocation   (1 per user per day)
AttendanceFlag ─── user ─► User                                      (outlier alerts)
Holiday                                                              (company calendar)
```

---



## 1. `users`

Everyone — employees, managers, leadership, admins — in one collection, split by `role`.


| Field                     | Type                          | Allowed values / rules                                               | Notes                                                                             |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `_id`                     | ObjectId                      | auto                                                                 | primary key                                                                       |
| `name`                    | String                        | required, trimmed                                                    | display name                                                                      |
| `email`                   | String                        | required, **unique**, lowercased, trimmed                            | login identity                                                                    |
| `passwordHash`            | String                        | required, `select:false`                                             | bcrypt hash; **never** returned in JSON. Set via the virtual `password`           |
| `role`                    | String (enum)                 | `employee` | `manager` | `leadership` | `admin` (default `employee`) | drives access control                                                             |
| `team`                    | ObjectId → `Team`             | nullable                                                             | team the user **belongs to** — **required for non-admin** (API-enforced)          |
| `manager`                 | ObjectId → `User`             | nullable                                                             | **reporting manager** — required for non-admin; role must fit hierarchy (employee→manager, manager→leadership, leadership→admin) |
| `officeLocations`         | [ObjectId → `OfficeLocation`] | **≥1 required for non-admin** (API-enforced on create & update)      | offices where this user is counted **WFO**. Empty (admin-only) ⇒ always WFH       |
| `isActive`                | Boolean                       | default `true`                                                       | soft-delete flag (deactivated users can't log in)                                 |
| `createdAt` / `updatedAt` | Date                          | auto                                                                 |                                                                                   |


**Virtual / methods**

- `password` (virtual setter) → hashes into `passwordHash` in a `pre('validate')` hook.
- `comparePassword(plain)` → bcrypt compare.

**Distinctions to remember**

- `team` (membership) ≠ `Team.managers` (who manages it). A user can manage a team they don't belong to, and vice-versa.
- `manager` (on user) = reporting line, a *different* concept from team managers.

---



## 2. `teams`


| Field                   | Type                | Allowed values / rules            | Notes                                                            |
| ----------------------- | ------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `_id`                   | ObjectId            | auto                              |                                                                  |
| `name`                  | String              | required, trimmed                 |                                                                  |
| `managers`              | [ObjectId → `User`] | **≥ 1 required** on create/update | users who can view/manage this team (role manager or leadership) |
| `createdAt`/`updatedAt` | Date                | auto                              |                                                                  |


- **Members** of a team are not stored here — they're `users` where `user.team == team._id`.
- A manager sees a team iff their id ∈ `team.managers`.

---



## 3. `officelocations` (geofences)


| Field          | Type     | Allowed values / rules        | Notes                                                                               |
| -------------- | -------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `_id`          | ObjectId | auto                          |                                                                                     |
| `name`         | String   | required, trimmed, **unique** | e.g. "Bangalore HQ"                                                                 |
| `latitude`     | Number   | required, **-90 … 90**        |                                                                                     |
| `longitude`    | Number   | required, **-180 … 180**      |                                                                                     |
| `radiusMeters` | Number   | required, **≥ 1**             | fence radius; a ping within this distance = inside the fence                        |
| `isActive`     | Boolean  | default `true`                | soft-delete; inactive fences are ignored by geofencing and hidden from normal lists |


---



## 4. `attendanceevents` (raw pings — source of truth, immutable audit trail)


| Field                  | Type                        | Allowed values / rules            | Notes                                                                          |
| ---------------------- | --------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| `_id`                  | ObjectId                    | auto                              |                                                                                |
| `user`                 | ObjectId → `User`           | required                          | who                                                                            |
| `eventType`            | String (enum)               | `check_in` | `check_out` | `ping` | check-in/out = explicit; ping = passive 15-min sample                          |
| `timestamp`            | Date                        | default now                       | when the event happened                                                        |
| `latitude`             | Number                      | required, -90…90                  | device coordinates                                                             |
| `longitude`            | Number                      | required, -180…180                |                                                                                |
| `detectedLocationType` | String (enum)               | `WFO` | `WFH`                     | **computed on ingest** via geofence check against the user's `officeLocations` |
| `officeLocation`       | ObjectId → `OfficeLocation` | nullable                          | which office matched (set only when WFO)                                       |


- **Index:** `{ user: 1, timestamp: -1 }` (fast "latest events for a user").
- Events are **append-only**; the daily record is derived from them.

---



## 5. `attendancerecords` (daily rollup — 1 row per user per day, what dashboards read)


| Field            | Type                        | Allowed values / rules                                     | Notes                                          |
| ---------------- | --------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `_id`            | ObjectId                    | auto                                                       |                                                |
| `user`           | ObjectId → `User`           | required                                                   |                                                |
| `date`           | Date                        | required                                                   | **IST midnight** instant for that calendar day |
| `status`         | String (enum)               | `WFO` | `WFH` | `Absent` | `Leave` | `Holiday` | `Weekend` | the day's classification                       |
| `checkInTime`    | Date                        | nullable                                                   | first check-in (or first event) of the day     |
| `checkOutTime`   | Date                        | nullable                                                   | last check-out (or last event)                 |
| `totalHours`     | Number                      | default 0                                                  | `(checkOut − checkIn)` in hours, 2 dp          |
| `officeLocation` | ObjectId → `OfficeLocation` | nullable                                                   | office of the first WFO event                  |
| `isLate`         | Boolean                     | default false                                              | check-in hour ≥ **10:00** (IST)                |


- **Unique index:** `{ user: 1, date: 1 }` — one record per user per day (makes rollup idempotent/upsert-safe).
- **Status precedence** when derived (see `02-backend-logic`): manual `Leave`/`Holiday` preserved → else events present ⇒ `WFO`/`WFH` → else `Holiday` → `Weekend` → `Absent`.

---



## 6. `attendanceflags` (outlier alerts)


| Field           | Type              | Allowed values / rules                                                     | Notes                                     |
| --------------- | ----------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| `_id`           | ObjectId          | auto                                                                       |                                           |
| `user`          | ObjectId → `User` | required                                                                   | flagged person                            |
| `weekStartDate` | Date              | required                                                                   | start of the detection window (dedup key) |
| `flagType`      | String (enum)     | `frequent_late` | `frequent_absence` | `low_wfo_ratio` | `irregular_hours` |                                           |
| `severity`      | String (enum)     | `low` | `medium` | `high` (default `medium`)                               |                                           |
| `details`       | Mixed (JSON)      | e.g. `{ lateCount: 4, windowDays: 7 }`                                     | human/debug context                       |
| `resolved`      | Boolean           | default false                                                              | manager acknowledges/dismisses            |


- **Unique index:** `{ user: 1, flagType: 1, weekStartDate: 1 }` → detection re-runs **upsert** (no duplicates).

---



## 7. `holidays` (global company calendar)


| Field      | Type     | Allowed values / rules                              | Notes                                                      |
| ---------- | -------- | --------------------------------------------------- | ---------------------------------------------------------- |
| `_id`      | ObjectId | auto                                                |                                                            |
| `date`     | String   | `YYYY-MM-DD`, required, **unique**, regex-validated | stored as a string to avoid timezone drift                 |
| `name`     | String   | required, trimmed                                   | e.g. "Diwali"                                              |
| `isActive` | Boolean  | default true                                        | soft-delete; inactive holidays don't affect classification |


- One global calendar (no per-office scoping). Weekends (Sat/Sun) are computed, not stored.

---



## Relationship map (mind model)

```
                        ┌────────────┐
                        │   Team     │  managers[] ──┐
                        └─────▲──────┘               │
                     team (membership)               │ (a manager)
                              │                       ▼
┌───────────────┐      ┌──────┴──────┐         ┌────────────┐
│OfficeLocation │◄─────│    User     │────────►│    User    │ (reporting manager)
└───────▲───────┘ offices└──┬───┬────┘ manager └────────────┘
        │                   │   │
        │ officeLocation    │   │ user
        │                   │   │
┌───────┴────────┐   ┌──────▼───┴───────┐   ┌──────────────┐   ┌──────────┐
│AttendanceEvent │   │ AttendanceRecord │   │AttendanceFlag│   │ Holiday  │
│ (raw pings)    │──►│ (daily rollup)   │──►│ (outliers)   │   │ (global) │
└────────────────┘   └──────────────────┘   └──────────────┘   └──────────┘
   events feed          records feed            detection reads records
   the rollup           dashboards & detection
```

**Data lifecycle in one line:** device GPS → `AttendanceEvent` (WFO/WFH resolved) → rolled up daily into `AttendanceRecord` → aggregated by dashboards & scanned by detection into `AttendanceFlag`. `Holiday` + weekends shape the record's status.