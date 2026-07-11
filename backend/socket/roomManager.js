// Tracks who's actually connected to each room right now (host, active
// participants, people waiting on approval). This is in-memory and ephemeral —
// the durable "does this room exist / who owns it" fact lives in MongoDB
// (see db/sessionModel.js). If the server restarts, live call state resets,
// which is fine: clients will just be prompted to rejoin.

const rooms = new Map();

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      hostSocketId: null,
      participants: new Map(), // socketId -> { name, isHost }
      pending: new Map(), // socketId -> { name }
    });
  }
  return rooms.get(roomId);
};

// Call on disconnect — removes a socket from whichever room(s) reference it
// and cleans up rooms that are now completely empty.
const removeSocketEverywhere = (socketId) => {
  for (const [roomId, room] of rooms.entries()) {
    room.participants.delete(socketId);
    room.pending.delete(socketId);
    if (room.hostSocketId === socketId) room.hostSocketId = null;

    if (!room.hostSocketId && room.participants.size === 0 && room.pending.size === 0) {
      rooms.delete(roomId);
    }
  }
};

export default { getRoom, removeSocketEverywhere, rooms };
