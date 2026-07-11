import express from "express";
import rateLimit from "express-rate-limit";

const router = express.Router();

const JUDGE0_API = "https://ce.judge0.com";

const LANGUAGE_IDS = {
  cpp: 54,
  c: 50,
  java: 62,
  python: 71,
  javascript: 93,
};

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: "Too many execution requests" },
});

const toBase64 = (str) => Buffer.from(str, "utf8").toString("base64");
const fromBase64 = (str) => {
  if (!str) return "";
  return Buffer.from(str, "base64").toString("utf8");
};

router.post("/code", executeLimiter, async (req, res) => {
  try {
    const { language, code, input } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "No code provided",
      });
    }

    const languageId = LANGUAGE_IDS[language];

    if (!languageId) {
      return res.status(400).json({
        success: false,
        error: "Unsupported language",
      });
    }

    const response = await fetch(
      `${JUDGE0_API}/submissions?base64_encoded=true&wait=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_code: toBase64(code),
          language_id: languageId,
          stdin: input ? toBase64(input) : "",
          cpu_time_limit: 5,
          cpu_extra_time: 1,
          memory_limit: 128000,
        }),
      }
    );

    const result = await response.json();
    console.log(result);

    const stdout = fromBase64(result.stdout).trim();
    const stderr = fromBase64(result.stderr).trim();
    const compileOutput = fromBase64(result.compile_output).trim();

    if (result.status.id !== 3) {
      return res.json({
        success: false,
        output: stdout,
        error:
          compileOutput ||
          stderr ||
          result.status.description,
      });
    }

    return res.json({
      success: true,
      output: stdout || "No Output",
      executionTime: result.time,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;