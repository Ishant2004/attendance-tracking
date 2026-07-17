# 03 — Frontend Guide (React + Vite + Tailwind)

## Stack
- **Vite + React 19** (JavaScript), **Tailwind v4** (via `@tailwindcss/vite`).
- **react-router-dom** (routing), **axios** (HTTP), **recharts** (charts), **leaflet** (map picker).
- Tokens in **localStorage**; UI kept "clean & functional".

## Folder structure
```
frontend/src/
├── api/            # one module per resource — thin axios wrappers
│   ├── client.js         # axios instance + JWT interceptor (attach + refresh)
│   ├── auth.js           # login, me, logout, changePassword
│   ├── users.js teams.js locations.js holidays.js
│   ├── attendance.js     # currentStatus, checkIn, checkOut, ping, records
│   ├── leaveRequests.js  # create, mine, inbox, approve, reject, cancel
│   ├── recordChangeRequests.js  # create, mine, inbox, approve, reject, cancel
│   ├── flags.js dashboard.js
├── auth/
│   ├── AuthContext.jsx   # user state, login/logout, session restore
│   └── ProtectedRoute.jsx# gate by auth + role
├── components/
│   ├── ui.jsx            # Card, Badge, Spinner, Stat, Select, PasswordInput, MultiSelect
│   ├── Layout.jsx        # app shell: role-aware nav, tracking pill, logout
│   └── LocationPickerModal.jsx  # Leaflet map → pick coords
├── hooks/usePingLoop.js  # passive 5-min geolocation ping
├── pages/
│   ├── Login.jsx  ChangePassword.jsx  RoleHome.jsx
│   ├── MyAttendance.jsx        # employee/self
│   ├── TeamDashboard.jsx       # manager
│   ├── LeadershipDashboard.jsx # leadership (charts)
│   └── AdminPanel.jsx          # admin (Users/Teams/Office Locations/Holidays)
├── App.jsx         # routes
└── main.jsx        # BrowserRouter + AuthProvider mount
```

## Environment (`frontend/.env`, all `VITE_`-prefixed)
| Var | Purpose |
|---|---|
| `VITE_API_URL` | backend base (e.g. `http://localhost:4000`) — axios prepends `/api` |
| `VITE_ALLOW_MANUAL_LOCATION` | `true` shows the "enter location manually" test box; anything else hides it (keep off in prod) |

> Only `VITE_`-prefixed vars reach the browser. Changing `.env` requires **restarting** `npm run dev`.

## API client + JWT flow (`api/client.js`)
- `baseURL = VITE_API_URL + '/api'`.
- **Request interceptor**: attach `Authorization: Bearer <accessToken>` from localStorage.
- **Response interceptor**: on **401**, try **one** refresh using `refreshToken` → store new access token → replay the original request. If refresh fails → clear tokens → redirect to `/login`.

```
request ──► [attach access token] ──► API
API 401 ──► [POST /auth/refresh] ──► new access token ──► retry once
refresh fails ──► clear tokens ──► /login
```

## Auth context (`auth/AuthContext.jsx`)
- Holds `{ user, loading, login, logout }`.
- **Session restore**: on mount, if an access token exists, calls `/auth/me` to repopulate `user` (survives refresh).
- `login(email,password)` → stores both tokens, sets `user`. `logout()` → clears tokens + user.
- `useAuth()` hook exposes it. (Note: `/auth/me` returns `_id`, so read `user._id`.)

## Routing map (`App.jsx`)
```
/login                     public
──────────── ProtectedRoute (auth) → <Layout/> shell ────────────
  /                        RoleHome → redirects by role
  /me                      MyAttendance            (all roles)
  /org                     OrgDirectory            (all roles)
  /change-password         ChangePassword          (all roles)
  /team                    TeamDashboard           roles: manager/leadership/admin
  /leadership              LeadershipDashboard      roles: leadership/admin
  /admin                   AdminPanel               roles: admin
  *                        → redirect to /
```
`ProtectedRoute` shows a loader while `loading`, redirects to `/login` if not authed, and redirects to `/` if the role isn't allowed.

## App shell (`components/Layout.jsx`)
- **Role-aware nav** (`NAV` map): employee → My Attendance; manager → +Team; leadership → +Organization; admin → +Admin. **Directory** is appended for every role.
- **Tracking pill** (right side): reflects `usePingLoop` state — `Locating…` (pending, pulsing) / `Tracking` (green) / `Location off` (denied) / `Unavailable` / `No GPS`.
- User's **name links to `/change-password`**; **Log out** button.
- `RoleHome` sends each role to its landing page (`employee→/me`, `manager→/team`, `leadership→/leadership`, `admin→/admin`).

## Passive location tracking (`hooks/usePingLoop.js`)
- While enabled + tab **visible**: pings the browser's geolocation and `POST /attendance-events` **immediately, then every 5 min**.
- Effect-local flags (`cancelled`, `inFlight`, `timer`) — safe under React StrictMode double-mount.
- Pauses when the tab is hidden (Page Visibility API), resumes (with an immediate ping) when visible.
- `utils/geo.js` `getCurrentPosition()` has a watchdog + `{enableHighAccuracy:false, timeout:8s, maximumAge:5min}` so it never hangs and can use a cached fix.

## Pages by role
- **MyAttendance** (`/me`, everyone): current status card (now includes the user's **reporting manager** name, fetched via `usersApi.get`) + **Check in/out** buttons (real GPS; manual box only if `VITE_ALLOW_MANUAL_LOCATION=true`); **Request time off** form (Leave for a day/period, or Half day for one day, + optional reason) and **My requests** list (pending ones have a **Cancel** button; overlapping-date requests are rejected with a message); an **Approvals** card (managers/leadership/admin only) with two sections — **Time off** and **Record corrections** — listing your reports' requests with **Approve/Reject**; attendance history table where each row has a **Request change** action (a modal to ask your manager to correct that day's status) and a **My record-change requests** list (with Cancel for pending); "My flags".
- **TeamDashboard** (`/team`, managers): loads **teams you manage** (`/teams/managed`); **team switcher** if >1; summary tiles + per-member table + team flags with **Resolve**. Friendly notice if you manage none.
- **LeadershipDashboard** (`/leadership`): org stat tiles + **Recharts** trend line (WFO/WFH/Absent/Late) + team-comparison bars + teams table.
- **AdminPanel** (`/admin`): four tabs —
  - **Users**: create (role + **required** team/manager + office `MultiSelect`; the manager dropdown is filtered to the role the hierarchy requires — employee→manager, manager→leadership, leadership→admin; admins skip team/manager); list with **Edit** (a modal to change name / team / manager / assigned offices — shown for employee/manager/leadership, not admin) and **Delete** (own row shows "You").
  - **Teams**: create (name + **manager `MultiSelect`**, ≥1), list with **Edit** (inline name input + manager `MultiSelect` + Save).
  - **Office Locations**: create (name/lat/lng/radius) + **📍 Choose location** map picker; list with **Edit** (modal: name/lat/lng/radius, manual or map picker) + **Delete**.

> **Delete = soft-delete everywhere.** Users, office locations, and holidays are never hard-deleted — the record is flagged `isActive:false` but **removed from the UI lists** (so there's no "Active" column). Every Delete asks for **confirmation** first. Because deleted items vanish from the list, you can re-create an office/holiday with the same name/date (the backend reactivates the soft-deleted record).
  - **Holidays**: add (date+name), list, soft-delete.
- **OrgDirectory** (`/org`, everyone): the company **reporting hierarchy** as a visual **org-chart** — boxes connected by orthogonal lines, laid out by a tidy top-down algorithm computed client-side from `usersApi.tree()` (a flat list keyed by `manager`). Interactions: **pan** (drag), **zoom** (scroll or **+ / − / Fit** buttons, auto-fits on load), per-node **collapse/expand** toggles, and search by name/role/team (rings matches and pans to the first). The current user is highlighted; users with no manager become roots (renders as a forest). No external chart library — pure SVG + CSS transform.
- **ChangePassword** (`/change-password`): centered card, current/new/confirm with eye-toggle password fields.

## Reusable UI (`components/ui.jsx`)
- `Card`, `Badge` (tone-colored: WFO green / WFH blue / Absent red / late high, etc.), `Spinner`, `Stat` (metric tile), `Select` (styled native single-select + chevron), `PasswordInput` (show/hide eye toggle — used on login, change-password, admin create-user), `MultiSelect` (searchable multi-select dropdown with removable tags — used for user→offices and team→managers), `ConfirmDialog` (confirmation modal for deletes).

## Map picker (`components/LocationPickerModal.jsx`)
- Plain **Leaflet** + OpenStreetMap tiles (no API key). Click to drop a pin (or "Use my current location") → returns `{latitude, longitude}` → fills the office form. Uses a `circleMarker` (no marker-image bundling issues).
