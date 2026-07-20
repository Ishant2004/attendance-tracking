# WFH/WFO Attendance — Documentation

Deep-dive docs for mind-mapping the whole system. Read top-to-bottom, or jump in.

| # | File | What's inside |
|---|---|---|
| 01 | [Database Schema](01-database-schema.md) | Every collection, field, type, allowed values/enums, indexes, and the relationship map |
| 02 | [Backend Logic](02-backend-logic.md) | Layered architecture, auth/JWT, RBAC, the key algorithms (geofence, rollup, detection, dashboards), crons, and the full endpoint inventory |
| 03 | [Frontend Guide](03-frontend-guide.md) | Vite/React structure, routing, auth context + JWT interceptor, pages by role, components, ping loop, env vars |
| 04 | [Feature Flows & Integration](04-feature-flow-and-integration.md) | End-to-end journeys (attendance → rollup → dashboards → flags), role journeys, and how frontend ↔ backend wire together |
| 05 | [Chat Feature](05-chat-feature.md) | 1:1 realtime chat end-to-end: Socket.IO handshake/rooms/events, data model, REST surface, `ChatContext` state, message & unread lifecycle, security, and scaling |

## 30-second mental model
```
Device GPS ─► AttendanceEvent (WFO/WFH resolved vs user's offices)
            ─► AttendanceRecord (daily rollup; Holiday→Weekend→WFO/WFH→Absent)
            ─► Dashboards (aggregates) + AttendanceFlag (weekly outlier detection)

Roles:  employee(self) · manager(their teams' + reports) · leadership(org) · admin(CRUD)
Auth:   JWT access(15m)+refresh(7d), localStorage, axios auto-refresh
Time:   everything in IST (Asia/Kolkata)
```

## Project layout
```
attendance/
├── backend/    Node + Express + Mongoose (MongoDB Atlas)
├── frontend/   Vite + React + Tailwind
└── docs/       ← you are here
```
Also at repo root: the original `assignment.md` (PRD), `database-design.md`, `APIs-design.md` (initial design notes).

---

## Running it locally

**Prerequisites:** Node.js 18+ and a MongoDB connection string (MongoDB Atlas, or local `mongod`).

### 1. Backend → http://localhost:4000
```bash
cd backend
npm install
```
Create `backend/.env`:
```
PORT=4000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/attendance   # or mongodb://localhost:27017/attendance
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
TZ_OFFSET_MINUTES=330          # IST (+5:30)
APP_TIMEZONE=Asia/Kolkata      # used by the cron scheduler
```
Then:
```bash
npm run dev                    # nodemon → starts API + registers cron jobs
node scripts/seedUser.js       # (first run) creates an initial admin user
```
- API docs (Swagger UI): **http://localhost:4000/docs** · health: **/health**
- Regenerate API docs after route changes: `npm run swagger`
- Manual jobs: `node scripts/runRollup.js [YYYY-MM-DD]` · `node scripts/runDetection.js [windowDays]`
- Seed 2026 holidays (optional): `node scripts/seedHolidays.js`

### 2. Frontend → http://localhost:5173
```bash
cd frontend
npm install
```
Create `frontend/.env`:
```
VITE_API_URL=http://localhost:4000
VITE_ALLOW_MANUAL_LOCATION=false   # set true only for local WFO/WFH testing
```
Then:
```bash
npm run dev
```
Open the printed URL, log in with the seeded admin, and create teams / office locations / users from the **Admin** page.

> Notes: restart `npm run dev` after editing any `.env` (Vite/dotenv read env at startup).
> Geolocation (check-in and the passive ping loop) only works on `localhost` or HTTPS.
