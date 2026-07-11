# CodeMeet Backend — Fixed & Session-Based

## What changed vs. the original

**Security**
- Passwords are hashed with `bcryptjs` (were plaintext before). Signup/login updated accordingly.
- Signup/login responses no longer leak the password field.
- Login lookup uses an exact match on a stored lowercase username instead of a
  user-controlled `RegExp` (that was a ReDoS / NoSQL-injection-shaped risk).
- JWT now expires in 7 days (was non-expiring) and is stored in an `httpOnly`,
  `secure` (in prod), `sameSite`-appropriate cookie.
- Added `middleware/auth.js` — every route that needs a logged-in user
  (`verifyToken`) now actually checks the JWT. Before, nothing did.
- Rate limiting on `/api/login`, `/api/register`, and `/api/execute/code`.
- `/api/execute/code` now enforces a real timeout (`AbortController` —
  the old `timeout:` option on `fetch` did nothing) and a code-size cap.
- Body size capped at 200kb.

**Session-based interview rooms (the part you asked for)**
- New `Session` model (`db/sessionModel.js`) — a real DB record: `roomId`,
  `interviewer`, `status` (`waiting` / `active` / `ended`).
- `POST /api/sessions` (auth required) — interviewer creates a room, gets back
  a `roomId` + shareable link (`CLIENT_URL/room/:roomId`).
- `GET /api/sessions/:roomId` (public) — lets the join page show the room
  title / interviewer name before anyone connects a socket.
- `POST /api/sessions/:roomId/end` (auth required, interviewer only).
- **The actual join flow is now a handshake, not a direct join:**
  1. Client emits `join-room-request` with `{ roomId, name, token }`.
  2. If the token proves you're the interviewer who owns the session, you're
     let in immediately as host.
  3. Otherwise you're parked in a `pending` list, you get `join-pending`,
     and the host receives `join-request` with your socket id + name.
  4. Host emits `respond-join-request` with `{ roomId, socketId, approve }`.
  5. If approved, the candidate gets `join-approved` and is actually joined
     to the Socket.IO room (only now can they see code/chat/etc). If
     rejected, they get `join-rejected` and nothing else.
  - Room is capped at 2 participants (`MAX_PARTICIPANTS` in
    `socket/socketHandlers.js`) — a third person gets `join-error`
    ("room is already full"). Bump that constant if you ever want panel
    interviews.

This solves the "two people collide" problem: nobody enters the live room
just by having the link. They only get in after the interviewer approves them.

## Frontend changes you'll need to make

Replace the old direct `socket.emit("joinRoom", room)` call with:

```js
socket.emit("join-room-request", { roomId, name: myName, token: myJwtOrNull });

socket.on("join-approved", ({ isHost }) => { /* show the call UI */ });
socket.on("join-pending", () => { /* show "waiting for approval" screen */ });
socket.on("join-rejected", ({ message }) => { /* show rejected screen */ });
socket.on("join-error", ({ message }) => { /* room full / not found / ended */ });

// host only:
socket.on("join-request", ({ socketId, name }) => { /* show Accept/Decline UI */ });
socket.on("pending-requests", (list) => { /* if host reconnects mid-session */ });
// on Accept/Decline click:
socket.emit("respond-join-request", { roomId, socketId, approve: true|false });
```

For the interviewer, before connecting the socket: call
`POST /api/sessions` to create the room and get `roomId`, then use that
`roomId` (with the JWT you already have from login) in `join-room-request`.

For the candidate: they just need the `roomId` from the shared link — no
login required to request access, though you can require it if you want
named/verified candidates.

## Setup

```bash
cp .env.example .env   # fill in MONGO_URI and a real JWT_SECRET
npm install
npm run dev             # or: npm start
```

## Migration note

Existing users in your database have **plaintext passwords** — they won't
match against `bcrypt.compare` anymore. Either:
- wipe the users collection and have everyone re-register, or
- write a one-off script that hashes each existing password in place before
  deploying this version.

## Self-hosting Piston (recommended before real usage)

The public `emkc.org` fallback is rate-limited and not meant for production
load. Piston has an official Docker image — point `PISTON_URL` at your own
instance once it's running instead of relying on the fallback.
