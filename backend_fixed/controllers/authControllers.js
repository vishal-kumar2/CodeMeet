import User from "../db/model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const usernameLower = username.trim().toLowerCase();
    const user = await User.findOne({ usernameLower });
    if (!user) return res.status(404).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    const token = generateToken(user._id);
    res.cookie("token", token, cookieOptions);

    const { password: _pw, ...safeUser } = user.toObject();
    // Also returned in the body (not just the httpOnly cookie): the cookie
    // authenticates normal API requests, but the Socket.IO "join-room-request"
    // handshake proves host identity via an explicit token field, and client
    // JS can't read an httpOnly cookie to put it there.
    return res.status(200).json({ message: "Login success", user: safeUser, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const logout = (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ message: "Logout successful" });
};

export const signup = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const trimmedUsername = username.trim();
    const usernameLower = trimmedUsername.toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ usernameLower }, { email: trimmedEmail }],
    });
    if (existing) {
      const field = existing.email === trimmedEmail ? "Email" : "Username";
      return res.status(409).json({ error: `${field} already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: trimmedEmail,
      username: trimmedUsername,
      usernameLower,
      password: hashedPassword,
    });
    await user.save();

    const { password: _pw, ...safeUser } = user.toObject();
    return res.status(201).json({ message: "User registered successfully", user: safeUser });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({ error: `${field} already exists` });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
};
