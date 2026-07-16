# 04 — Feature Flows & Frontend↔Backend Integration

End-to-end journeys tying the whole system together. Read this with `01` (schema),
`02` (backend) and `03` (frontend) open for cross-reference.

---

## A. The core data lifecycle (one picture)

```
 DEVICE (browser)                 BACKEND                        MONGODB
 ───────────────                  ───────                        ───────
 ping / check-in ──POST /attendance-events──► resolve WFO/WFH ──► AttendanceEvent
 (lat,lng)                        (geofence vs user's offices)
                                        │
             nightly cron / on read     ▼
                                  rollupEventsToRecord ─────────► AttendanceRecord (1/day)
                                  (Holiday→Weekend→WFO/WFH→Absent)
                                        │
             dashboards read  ◄─────────┤
             weekly cron ──────────► runDetection ─────────────► AttendanceFlag
```

**One sentence:** raw GPS events → resolved to WFO/WFH → rolled up into a daily record → aggregated by dashboards and scanned into outlier flags; the company calendar (holidays + weekends) decides what "no events" means.

---

## B. Attendance capture (employee's day)

**Actors:** employee (browser) → events API → rollup.

```
1. Employee logs in ──► AuthContext stores tokens, lands on /me
2. Layout mounts ──► usePingLoop starts:
      • immediate POST /attendance-events {lat,lng, eventType:'ping'}
      • repeat every 5 min while tab visible
3. Backend recordEvent():
      • loads user's officeLocations
      • resolveAgainstOffices() → WFO (inside one of MY offices) or WFH
      • saves AttendanceEvent
4. Employee taps "Check in" / "Check out" on /me ──► same endpoint, eventType check_in/out
      • rollup runs for today → today's AttendanceRecord updates live
5. Reading /me history ──► GET /attendance-records/:me (existing records)
   Opening a specific day ──► GET /:me/:date → auto-rollup that day
```

**Frontend ↔ backend contract**
| UI action | Request | Backend effect |
|---|---|---|
| page open (ping loop) | `POST /attendance-events` | event stored, WFO/WFH resolved |
| Check in / out | `POST /attendance-events/check-in|check-out` | event + today's record rolled up |
| status card | `GET /attendance-events/current-status/:me` | latest event → `{status, checkedIn}` |
| history table | `GET /attendance-records/:me` | list of daily records |
| my flags | `GET /flags/:me` | user's outlier flags |

> WFO rule reminder: a day is **WFO if any event that day is WFO**. Manual coordinate entry is a spoofing vector — hidden unless `VITE_ALLOW_MANUAL_LOCATION=true`.

---

## C. Daily rollup & the calendar (what "no events" means)

Runs nightly (00:30 IST) for every active user, and lazily whenever a day is read.

```
for each active user, for the target IST day:
   existing record is Leave/Holiday? ── yes ─► keep it
   events that day?
      yes ─► WFO if any WFO event else WFH; set times, hours, isLate(≥10:00), office
      no  ─► getDayType(date):
                Holiday (active holiday)  ─► status Holiday
                Weekend (Sat/Sun)         ─► status Weekend
                else                      ─► status Absent
```

So nobody is falsely "Absent" on weekends/holidays, and someone who works a weekend still shows WFO/WFH.

---

## D. Outlier detection (weekly)

**Weekly cron (Sun 01:30 IST)** or admin `POST /flags/run-detection`.

```
for each active user, over trailing 7 days:
   keep WORKING-DAY records only (drop Weekend/Holiday/Leave)
   count late / absent / wfo-ratio / irregular-hours
   threshold crossed? ─► upsert AttendanceFlag {user, flagType, weekStartDate}
```
Idempotent (unique index) → re-runs update, never duplicate. Managers see & **Resolve** flags for their team; employees see their own.

---

## E. Role-based journeys

### Employee
`login → /me` → check in/out, see own history + flags → can change password.

### Manager
`login → /team`:
```
GET /teams/managed ─► teams where I'm in managers[]
   0 teams  ─► "you don't manage any team" notice
   1 team   ─► show it
   >1 teams ─► team switcher (dropdown)
selected team ─► GET /dashboard/team/:id  +  GET /flags/team/:id
   → summary tiles, per-member table, resolvable flags
```
Also sees own reports in user listings (`user.manager == me`).

### Leadership
`login → /leadership`:
```
GET /dashboard/leadership     ─► org totals + per-team comparison (table + bars)
GET /dashboard/attendance-trends ─► time series (Recharts line)
```
Read-only, org-wide. Sees all teams.

### Admin
`login → /admin` (4 tabs):
```
Users            create (role, team, manager, office multi-select)
                 / edit name·team·manager·offices (non-admin, modal) / delete (not self)
Teams            create (managers multi-select ≥1) / edit name + managers inline
Office Locations create (map picker) / edit name·lat·lng·radius (manual or map) / delete
Holidays         add / edit / delete

Delete everywhere = soft-delete (isActive:false), confirmed via a dialog, and the row is
removed from the list (no "Active" column). Re-creating an office/holiday with a deleted
name/date reactivates the old record.
```

---

## F. Admin onboarding a user (create → login → self-serve)

```
Admin (Users tab) ──POST /users {name,email,password,role,team?,managers?,officeLocations}──► User created (isActive:true)
        │
        ▼  (admin shares the temporary password out-of-band)
New user ──POST /auth/login──► tokens ──► lands on role home
        │
        ▼
Changes password ──POST /auth/change-password {currentPassword,newPassword}──► done
```
> The earlier OTP email-verification idea was intentionally dropped for simplicity — onboarding is admin-set password + self-service change.

---

## G. Team access model (why "multiple managers" matters)

- A team stores **`managers[]`** (≥1). A `manager`-role user sees a team **iff they're in that array**.
- This is independent of **membership** (`user.team`) and of the **reporting line** (`user.manager`).
- Fix pattern used for real cases: Admin → Teams → **Edit managers** → add the manager → they immediately see it under `/team`.

```
Team.managers[]  ── grants ──►  view team dashboard / members / flags
user.team        ── defines ──► who appears in the team's member list
user.manager     ── defines ──► "my reports" scoping in user/record/flag listings
```

---

## H. Auth & session integration (every request)

```
Browser                                  Backend
───────                                  ───────
login ─────────POST /auth/login────────► verify + issue access(15m)+refresh(7d)
store tokens (localStorage)
any call ──Authorization: Bearer access─► middleware/auth verifies → req.user
access expired (401) ──POST /auth/refresh (refresh token)──► new access token
        └─ interceptor retries the original request once
refresh invalid ──► clear tokens ──► redirect /login
logout ─────────────────────────────► client clears tokens (stateless)
```

---

## I. Timezone (single source of truth = IST)
- Day boundaries, weekend detection, holiday matching, and both crons all use **IST** (`Asia/Kolkata`, +5:30, no DST).
- Records store `date` as the **IST-midnight instant**; holidays store a `YYYY-MM-DD` string. This keeps "which day" consistent across storage, rollup, detection, and dashboards.

---

## Quick cross-reference index
- **Schema / fields / enums** → `01-database-schema.md`
- **API endpoints, services, algorithms, RBAC, crons** → `02-backend-logic.md`
- **Pages, routing, auth context, components, hooks, env** → `03-frontend-guide.md`
- **End-to-end flows & integration (this file)** → `04-feature-flow-and-integration.md`
