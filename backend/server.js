import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectdb from "./db/connectDb.js";
import auth from "./routes/auth.js";
import session from "./routes/session.js";
import execute from "./routes/execute.js";
import turn from "./routes/turn.js";
import registerSocketHandlers from "./socket/socketHandlers.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Comma-separated list in .env, e.g.
// ALLOWED_ORIGINS=http://localhost:5173,https://your-app.vercel.app
const allowedOrigins = (process.env.ALLOWED_ORIGINS || CLIENT_URL)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true },
});

app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST"], credentials: true }));

connectdb();

app.use("/api", auth);
app.use("/api/sessions", session);
app.use("/api/execute", execute);
app.use("/api", turn);

registerSocketHandlers(io);

app.get("/", (req, res) => res.send("Backend running"));

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
