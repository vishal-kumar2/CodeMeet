import express from "express";

const router = express.Router();

// Proxies the Metered TURN credentials call so the SECRET KEY never has to
// live in frontend code / the browser. Frontend just calls GET /api/turn-credentials.
router.get("/turn-credentials", async (req, res) => {
  const domain = process.env.METERED_DOMAIN; // e.g. "codemeet.metered.live"
  const secretKey = process.env.METERED_SECRET_KEY;

  if (!domain || !secretKey) {
    console.warn("METERED_DOMAIN / METERED_SECRET_KEY not set — returning empty ICE servers list");
    return res.json([]);
  }

  try {
    const response = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${secretKey}`
    );
    if (!response.ok) {
      console.error(`Metered TURN credentials request failed: ${response.status}`);
      return res.status(502).json({ error: "Failed to fetch TURN credentials" });
    }
    const iceServers = await response.json();
    res.json(iceServers);
  } catch (err) {
    console.error("Failed to fetch TURN credentials:", err);
    res.status(500).json({ error: "Failed to fetch TURN credentials" });
  }
});

export default router;
