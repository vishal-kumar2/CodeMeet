import { nanoid } from "nanoid";
import Session from "../db/sessionModel.js";

// Only a logged-in interviewer can create a session/room.
export const createSession = async (req, res) => {
  try {
    const { title } = req.body;
    const roomId = nanoid(10);

    const session = new Session({
      roomId,
      title: title || "Interview Session",
      interviewer: req.user.id,
    });
    await session.save();

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.status(201).json({
      message: "Session created",
      roomId,
      shareLink: `${clientUrl}/room/${roomId}`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to create session" });
  }
};

// Public: lets the join page show "Waiting for approval from <interviewer>" etc.
// before the candidate is actually let into the socket room.
export const getSessionInfo = async (req, res) => {
  try {
    const { roomId } = req.params;
    const session = await Session.findOne({ roomId }).populate("interviewer", "name username");
    if (!session) return res.status(404).json({ error: "Session not found" });

    return res.json({
      roomId: session.roomId,
      title: session.title,
      status: session.status,
      interviewerName: session.interviewer?.name,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch session" });
  }
};

export const endSession = async (req, res) => {
  try {
    const { roomId } = req.params;
    const session = await Session.findOne({ roomId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (String(session.interviewer) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the interviewer can end this session" });
    }

    session.status = "ended";
    session.endedAt = new Date();
    await session.save();
    return res.json({ message: "Session ended" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to end session" });
  }
};
