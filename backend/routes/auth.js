import express from "express";
import rateLimit from "express-rate-limit";
import { login, logout, signup, me } from "../controllers/authControllers.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Brute-force protection on login/signup
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", authLimiter, login);
router.post("/register", authLimiter, signup);
router.post("/logout", logout);
router.get("/me", verifyToken, me);

export default router;
