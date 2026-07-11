import jwt from "jsonwebtoken";

const extractToken = (req) => {
  if (req.cookies?.token) return req.cookies.token;
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
};

// Blocks the request if there is no valid token.
export const verifyToken = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Attaches req.user if a valid token is present, but never blocks the request.
export const optionalAuth = (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // ignore invalid/expired token, just proceed unauthenticated
    }
  }
  next();
};
