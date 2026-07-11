import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { createSession, getSessionInfo, endSession } from "../controllers/sessionControllers.js";

const router = express.Router();

router.post("/", verifyToken, createSession); // interviewer creates a room
router.get("/:roomId", getSessionInfo); // public: room metadata for the join screen
router.post("/:roomId/end", verifyToken, endSession); // interviewer ends the interview

export default router;
