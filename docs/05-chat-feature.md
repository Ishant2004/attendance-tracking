# 05 — Chat Feature (1:1 realtime messaging)

Direct, one-to-one messaging between any two active users, delivered live over **Socket.IO**
and persisted in MongoDB so history survives reconnects and page reloads.

- **Reach:** anyone ↔ anyone (any active user can DM any other; not yourself).
- **Transport:** Socket.IO (WebSocket, with the library's built-in reconnection & fallback).
- **Persistence:** every message is stored; the socket is only the delivery channel.
- **Scope (MVP):** live send/receive, message history, and per-conversation unread counts. No presence/typing/read-receipts yet.

---

## 1. The big picture

```
┌─────────────────┐            WebSocket (Socket.IO)            ┌─────────────────┐
│  Browser (A)    │◄──────────── chat:message ────────────────►│   Node server   │
│  ChatContext    │───────────── chat:send ───────────────────►│   socket.js     │
│  + Chat page    │◄──────────── chat:message (echo) ──────────│   chatService   │
└───────┬─────────┘                                            └────────┬────────┘
        │ REST (axios): list / history / open / mark-read               │
        ▼                                                                ▼
   /api/chat/*  ─────────────────────────────────────────────►   MongoDB
                                                          Conversation + Message
        ▲                                                                │
┌───────┴─────────┐            chat:message (delivered live)             │
│  Browser (B)    │◄───────────────────────────────────────────────────-┘
└─────────────────┘   (B joined the room named by B's user id on connect)
```

**One-line lifecycle:** `A emits chat:send` → server validates + saves a `Message` and bumps the
`Conversation` → server emits `chat:message` to **both** participants' rooms → each client appends it
live; REST endpoints back-fill history and the conversation list on load.

---

## 2. Data model

Two collections (see also `01-database-schema.md`).

### `conversations`
| Field | Type | Notes |
|---|---|---|
| `participants` | [ObjectId → User] × 2 | the two people in the thread |
| `key` | String, **unique** | sorted participant-id pair `"a:b"` — makes a thread unique per pair |
| `lastMessage` | String (≤200) | preview for the list |
| `lastMessageAt` | Date | sort key for the conversation list |
| `unread` | Map<userId, Number> | per-participant unread counter (serialized to a plain object in JSON) |

- Indexes: unique `key`, and `{ participants:1, lastMessageAt:-1 }`.
- `toJSON` converts the `unread` Map → `{ "<userId>": count }` so the client can read `unread[myId]`.

### `messages`
| Field | Type | Notes |
|---|---|---|
| `conversation` | ObjectId → Conversation | |
| `sender` | ObjectId → User | |
| `body` | String, required, ≤4000 | rendered as plain text on the client (XSS-safe) |
| `readAt` | Date, nullable | set when the recipient reads the thread |

- Index `{ conversation:1, createdAt:-1 }` for fast history paging.

**Why a `key`?** A deterministic sorted-pair key (`keyFor(a,b)`) guarantees exactly one conversation
per pair regardless of who starts it, and lets us create-or-fetch atomically.

---

## 3. Backend pieces

| File | Responsibility |
|---|---|
| `models/Conversation.js`, `models/Message.js` | schemas + indexes + JSON shaping |
| `services/chatService.js` | all data logic (create/find, list, history, send, mark-read) |
| `socket.js` | Socket.IO server: JWT handshake, rooms, events, broadcast helper |
| `controllers/chatController.js` + `routes/chatRoutes.js` | REST surface |
| `server.js` | attaches Socket.IO to the HTTP server (`initSocket(server)`) |

### `chatService` functions
- `keyFor(a, b)` → sorted `"a:b"`.
- `getOrCreateConversation(meId, otherId)` — rejects self-chat / inactive user; **atomic upsert** on `key` (`findOneAndUpdate(..., { upsert:true })`) so two simultaneous first-messages can't collide on the unique index; returns it with participants populated.
- `listConversations(meId)` — threads where `participants` contains me, newest first.
- `getMessages(meId, id, { before, limit })` — participant-guarded; returns up to `min(limit,100)` messages, chronological; `before` (ISO date) pages older.
- `sendMessage(meId, otherId, body)` — trims/validates, persists a `Message`, updates `lastMessage`/`lastMessageAt`, **increments `unread[otherId]`**; returns `{ message, conversation }`.
- `sendToConversation(meId, conversationId, body)` — REST variant; derives the other participant, then `sendMessage`.
- `markRead(meId, id)` — sets `unread[me] = 0` and stamps `readAt` on the other side's unread messages.

### `socket.js` — the realtime layer
- Created in `server.js`: `const server = http.createServer(app); initSocket(server);` (Express stays a plain app; Socket.IO shares the same port).
- **Handshake auth** (`io.use`): reads the JWT **access token** from `socket.handshake.auth.token`, verifies it with the same secret as REST, loads the user, sets `socket.userId`. Invalid/inactive → connection refused.
- **On connect:** `socket.join(socket.userId)` — each user has a room named by their id, so `io.to(userId)` reaches every device they have open.
- **Events:**

| Event | Direction | Payload | Effect |
|---|---|---|---|
| `chat:send` | client → server | `{ toUserId, body }` + ack | `chatService.sendMessage`, then broadcast; ack returns `{ ok, message }` or `{ ok:false, error }` |
| `chat:message` | server → client | `{ message, conversation }` | emitted to **both** participants' rooms |
| `chat:read` | client → server | `{ conversationId }` | `chatService.markRead` (clears the caller's unread) |

- `broadcastMessage(message, conversation)` emits `chat:message` to each participant's room. The **REST send endpoint calls it too**, so a message sent over HTTP still reaches connected sockets.
- `emitToUser(userId, event, payload)` — small helper used by the above (guards on `io` being initialised).

### REST endpoints — `/api/chat` (all auth-required)
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/conversations` | my conversations (sorted by recent, each includes the `unread` map) |
| `POST` | `/conversations` | `{ userId }` → start/fetch a thread |
| `GET` | `/conversations/:id/messages` | history (`?before=&limit=`), participant-guarded |
| `POST` | `/conversations/:id/messages` | send (fallback path; also broadcasts to sockets) |
| `POST` | `/conversations/:id/read` | mark the thread read |

> Sending is normally done over the socket (`chat:send`); the REST send exists as an equivalent
> fallback and for testability.

---

## 4. Frontend pieces

| File | Responsibility |
|---|---|
| `api/chat.js` | thin axios wrappers (list/open/messages/read) |
| `chat/ChatContext.jsx` | the socket connection + all chat state; `useChat()` hook |
| `pages/Chat.jsx` | conversation list + thread + new-message picker |
| `components/Layout.jsx` | **Chat** nav link with a live unread badge |
| `pages/OrgDirectory.jsx` | **Message** button on each person → opens a chat |
| `App.jsx` | mounts `<ChatProvider>` around the authed `<Layout>` |

### `ChatContext` (the brain)
Mounted around the authenticated layout so both the nav badge and the pages share one socket + one source of truth.

State: `conversations`, `messages` (`{ [conversationId]: Message[] }`), `activeId`, `connected`, and derived `totalUnread`.

- **Connection:** `io(API_URL, { auth: (cb) => cb({ token: localStorage.getItem('accessToken') }) })`. Passing `auth` as a **function** means every (re)connect uses the *latest* access token — so a token refresh survives a reconnect.
- **Incoming `chat:message` handler:**
  1. append the message to `messages[conversationId]` (deduped by `_id`),
  2. if I'm currently viewing that thread (`activeRef.current === id`), emit `chat:read` and locally zero my unread,
  3. upsert the conversation to the top of the list.
- **`openConversation(otherUserId)`** — `POST /conversations` → set active → load history → mark read. Used by the "New message" picker and the Directory's Message button.
- **`openConversationById(id)`** — set active → load history → mark read. Used when clicking an existing thread.
- **`sendMessage(toUserId, body)`** — emits `chat:send` with an ack; the authoritative message comes back via the `chat:message` echo (no optimistic insert needed).
- **`markRead(id)`** — emits `chat:read` and locally zeroes `unread[myId]` (instant badge update).
- **`totalUnread`** = Σ `conversation.unread[myId]` → the nav badge.

### `Chat` page
- **Left:** conversation list — other participant, last-message preview, unread badge. **＋ New message** opens a searchable people picker (`usersApi.tree()`, excludes self).
- **Right:** the thread — bubbles (mine right/indigo, theirs left/white), timestamps, auto-scroll to newest, and a composer.
- **Responsive:** on mobile the list and thread swap (thread gets a back arrow); on desktop they sit side by side.

---

## 5. End-to-end walkthroughs

### A. Sending a message (both users online)
```
User A types "hi" and hits Send
  → ChatContext.sendMessage(B, "hi")
    → socket.emit('chat:send', { toUserId: B, body: "hi" }, ack)
      → server io.use already authed this socket as A
      → chatService.sendMessage(A, B, "hi")
          • getOrCreateConversation(A,B)  (upsert on key)
          • Message.create({ conversation, sender:A, body:"hi" })
          • conversation.lastMessage/At updated; unread[B] += 1
      → broadcastMessage(message, conversation)
          • io.to(A).emit('chat:message', {...})   // echo to sender's devices
          • io.to(B).emit('chat:message', {...})   // live delivery to B
      → ack({ ok:true, message })
  → A's ChatContext receives the echo → appends to the open thread
  → B's ChatContext receives it →
        if B is viewing the thread → append + auto chat:read (unread stays 0)
        else                       → append + unread badge for B goes to 1
```

### B. Opening / reading a conversation
```
Click a conversation (or a Directory "Message" button)
  → openConversation / openConversationById
    → (if new) POST /chat/conversations { userId }
    → GET /chat/conversations/:id/messages   (history)
    → setActiveId(id)
    → markRead(id): socket.emit('chat:read') + local unread[me]=0
      → server: chatService.markRead → unread[me]=0, readAt stamped
```

### C. Offline recipient / page reload
- Messages are persisted, so when B reconnects, `GET /conversations` shows the thread with the
  correct `unread[B]` count, and `GET /conversations/:id/messages` returns the full history.
- The socket only carries **live** deltas; the DB is the source of truth.

### D. Unread lifecycle
```
send        → unread[recipient] += 1   (server, in sendMessage)
open thread → unread[me] = 0           (markRead: socket + REST both do this)
nav badge   → Σ unread[myId] across conversations  (recomputed from state)
```

---

## 6. Auth & security
- Socket connections require a valid **access token** in the handshake; unauthenticated sockets are refused.
- Every REST chat route is `auth`-guarded; history/read/send verify the caller is a **participant** of the conversation (403 otherwise).
- `getOrCreateConversation` refuses self-chat (400) and inactive users (404).
- Message bodies are capped at 4000 chars and **rendered as React text** (no `dangerouslySetInnerHTML`) → no stored-XSS.
- Access tokens are short-lived (15 min); because `auth` is provided as a function, reconnects pick up a refreshed token automatically.

---

## 7. Design decisions & trade-offs
- **DB is the source of truth, socket is just delivery** → survives reconnects, multi-device, and server restarts.
- **Sorted-pair `key` + atomic upsert** → exactly one thread per pair, race-free first message.
- **Per-user rooms** (`io.to(userId)`) → deliver to all of a user's tabs/devices without tracking sockets manually.
- **Unread as a counter on the conversation** (not a per-message scan) → O(1) to read for the list/badge.
- **Echo to the sender** (instead of optimistic UI) → the client always renders the authoritative saved message; simpler and consistent across a user's devices.

---

## 8. Scaling & ops notes
- Works as-is on a **single Node instance** (rooms live in memory).
- **Horizontal scaling** (multiple backend instances) needs the **Socket.IO Redis adapter** (`@socket.io/redis-adapter` + a Redis instance) so `io.to(userId)` reaches sockets on other instances. That's the only change required.
- **CORS:** the Socket.IO server allows the frontend origin; the client connects to `VITE_API_URL` (the backend origin, default path `/socket.io`).
- **Deployment:** the platform must allow WebSocket upgrades (Railway does). The static frontend (Vercel) just opens a `wss://` to the backend origin.
- **Retention:** messages/conversations are kept indefinitely today; add a TTL or archival policy if volume grows.

---

## 9. File map (quick reference)
```
backend/src/
├── models/Conversation.js        # thread: participants, key, lastMessage, unread map
├── models/Message.js             # message: conversation, sender, body, readAt
├── services/chatService.js       # create/find, list, history, send, markRead
├── socket.js                     # Socket.IO: handshake auth, rooms, events, broadcast
├── controllers/chatController.js # REST handlers (+ broadcast on REST send)
├── routes/chatRoutes.js          # /api/chat/*
└── server.js                     # http.createServer(app) + initSocket(server)

frontend/src/
├── api/chat.js                   # axios wrappers
├── chat/ChatContext.jsx          # socket + state + useChat()
├── pages/Chat.jsx                # list + thread + new-message picker
├── components/Layout.jsx         # Chat nav link + unread badge
└── pages/OrgDirectory.jsx        # "Message" button → openConversation
```
