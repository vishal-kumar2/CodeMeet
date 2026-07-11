import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    title: { type: String, default: "Interview Session" },
    interviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["waiting", "active", "ended"], default: "waiting" },
    maxParticipants: { type: Number, default: 2 }, // interviewer + candidate
    endedAt: { type: Date },
  },
  { timestamps: true }
);

const Session = mongoose.model("Session", sessionSchema);
export default Session;
