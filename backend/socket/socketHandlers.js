import jwt from "jsonwebtoken";
import Session from "../db/sessionModel.js";
import roomManager from "./roomManager.js";

const MAX_PARTICIPANTS = 2; // interviewer + one candidate

const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`User ${socket.id} connected`);

    /**
     * Replaces the old "joinRoom" free-for-all. Every client — host or
     * candidate — calls this first with { roomId, name, token }.
     *  - If the caller's JWT matches session.interviewer, they're let in
     *    immediately as the host.
     *  - Otherwise they're parked in `pending` and the host is notified via
     *    "join-request". Nothing is broadcast to the room and no one can see
     *    shared code/chat until the host approves them.
     */
    socket.on("join-room-request", async ({ roomId, name, token }) => {
      try {
        if (!roomId) return;

        const session = await Session.findOne({ roomId });
        if (!session) return socket.emit("join-error", { message: "Session not found" });
        if (session.status === "ended") {
          return socket.emit("join-error", { message: "This interview session has ended" });
        }

        const room = roomManager.getRoom(roomId);
        const decoded = token ? verifySocketToken(token) : null;
        const isHost = decoded && String(decoded.id) === String(session.interviewer);

        if (isHost) {
          room.hostSocketId = socket.id;
          room.participants.set(socket.id, { name: name || "Interviewer", isHost: true });
          socket.data.roomId = roomId;
          socket.data.isHost = true;
          socket.join(roomId);

          if (session.status === "waiting") {
            session.status = "active";
            await session.save();
          }

          socket.emit("join-approved", { roomId, isHost: true });
          socket.to(roomId).emit("peer-ready", { peerId: socket.id, status: "host-joined" });

          // In case candidates were already waiting when the host (re)connected
          if (room.pending.size > 0) {
            socket.emit(
              "pending-requests",
              Array.from(room.pending.entries()).map(([socketId, info]) => ({ socketId, ...info }))
            );
          }
          return;
        }

        // --- Candidate path: request access, don't join yet ---
        if (!room.hostSocketId) {
          return socket.emit("join-error", { message: "Waiting for the interviewer to start the session" });
        }
        if (room.participants.size >= MAX_PARTICIPANTS) {
          return socket.emit("join-error", { message: "This interview room is already full" });
        }

        room.pending.set(socket.id, { name: name || "Candidate" });
        socket.data.roomId = roomId;

        socket.emit("join-pending", { message: "Waiting for the interviewer to let you in" });
        io.to(room.hostSocketId).emit("join-request", { socketId: socket.id, name: name || "Candidate" });
      } catch (err) {
        console.error("join-room-request error:", err);
        socket.emit("join-error", { message: "Something went wrong while joining" });
      }
    });

    // Host approves/rejects a specific waiting candidate.
    socket.on("respond-join-request", ({ roomId, socketId, approve }) => {
      const room = roomManager.getRoom(roomId);
      if (room.hostSocketId !== socket.id) return; // only the host can respond

      const pendingUser = room.pending.get(socketId);
      if (!pendingUser) return;
      room.pending.delete(socketId);

      const candidateSocket = io.sockets.sockets.get(socketId);
      if (!candidateSocket) return; // they disconnected before being reviewed

      if (approve) {
        room.participants.set(socketId, { name: pendingUser.name, isHost: false });
        candidateSocket.join(roomId);
        candidateSocket.emit("join-approved", { roomId, isHost: false });
        io.to(roomId).emit("peer-ready", { peerId: socketId, status: "joined" });
      } else {
        candidateSocket.emit("join-rejected", { message: "The interviewer declined your request to join" });
      }
    });

    socket.on("leaveRoom", (roomId) => {
      socket.leave(roomId);
      roomManager.removeSocketEverywhere(socket.id);
      socket.to(roomId).emit("peer-left", { peerId: socket.id });
      console.log(`User ${socket.id} left room ${roomId}`);
    });

    // --- Collaboration events, unchanged in behavior — these only ever
    // reach sockets already inside io.to(room), i.e. approved participants ---
    socket.on("message", ({ room, data }) => socket.to(room).emit("recieve-message", data));
    socket.on("display-code", ({ room, data }) => socket.to(room).emit("recieve-code", data));
    socket.on("input-change", ({ room, data }) => socket.to(room).emit("recieve-input", data));
    socket.on("output-change", ({ room, data }) => socket.to(room).emit("recieve-output", data));
    socket.on("change-language", ({ room, data }) => socket.to(room).emit("recieve-language", data));
    socket.on("text-change", ({ room, data }) => socket.to(room).emit("recieve-text", data));
    socket.on("request-code-sync", (room) => socket.to(room).emit("request-code-sync"));
    socket.on("sync-code", ({ room, code, language, version }) =>
      socket.to(room).emit("sync-code", { code, language, version })
    );
    socket.on("request-notes-sync", (room) => socket.to(room).emit("request-notes-sync"));
    socket.on("sync-notes", ({ room, data }) => socket.to(room).emit("sync-notes", data));

    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        const room = roomManager.getRoom(roomId);
        const wasHost = room.hostSocketId === socket.id;
        roomManager.removeSocketEverywhere(socket.id);
        socket.to(roomId).emit(wasHost ? "host-left" : "peer-left", { peerId: socket.id });
      }
      console.log(`User ${socket.id} disconnected`);
    });
  });
}
