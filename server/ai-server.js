import { config as configDotenv } from "dotenv";
import express from "express";
import axios from "axios";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import process from "process";

configDotenv({ path: new URL("./.env", import.meta.url) });

const app = express();

// Security middleware
app.use(helmet());


// CORS configuration - Allow both development and production origins
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Local development
      "http://localhost:5000", // Alternative local port
      "https://Axion.studio", // Production domain
      "https://www.Axion.studio", // Production with www
      "https://Axion.vercel.app", // Vercel preview deployments
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());

const aiHintLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const PREFERRED_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

function extractAiText(responseData) {
  const firstChoice = responseData?.choices?.[0];

  return (
    firstChoice?.message?.content ||
    firstChoice?.delta?.content ||
    firstChoice?.text ||
    firstChoice?.completion ||
    ""
  );
}

async function listGeminiGenerateContentModels(apiKey) {
  try {
    const response = await axios.get(`${GEMINI_API_BASE_URL}/models`, {
      headers: {
        "x-goog-api-key": apiKey,
      },
      params: {
        pageSize: 1000,
      },
      timeout: 10000,
    });

    const models = response.data?.models || [];
    return models
      .filter((entry) =>
        entry?.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((entry) => entry?.name?.replace(/^models\//, ""))
      .filter(Boolean);
  } catch (error) {
    console.warn(
      "Gemini model discovery failed:",
      error.response?.data?.error?.message || error.message,
    );
    return [];
  }
}

function buildGeminiModelCandidates(discoveredModels = []) {
  const discoveredPreferred = discoveredModels.filter(
    (modelName) =>
      modelName.includes("flash") &&
      !modelName.includes("image") &&
      !modelName.includes("live") &&
      !modelName.includes("tts"),
  );

  return [...new Set([...PREFERRED_GEMINI_MODELS, ...discoveredPreferred])];
}

async function generateWithGemini(prompt, apiKey, generationConfig = {}) {
  const discoveredModels = await listGeminiGenerateContentModels(apiKey);
  const models = buildGeminiModelCandidates(discoveredModels);
  let lastError;

  for (const modelName of models) {
    try {
      const response = await axios.post(
        `${GEMINI_API_BASE_URL}/models/${modelName}:generateContent`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        },
        {
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        },
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return {
          text,
          modelName,
        };
      }
    } catch (error) {
      lastError = error;
      console.warn(
        `Gemini ${modelName} failed:`,
        error.response?.data?.error?.message || error.message,
      );
    }
  }

  throw lastError || new Error("All Gemini generateContent models failed");
}

app.post("/api/ai-hint", aiHintLimiter, async (req, res) => {
  try {
    const { prompt, suffix } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const mistralKey = process.env.MISTRAL_API_KEY?.trim();
    const groqKey = process.env.GROQ_API_KEY?.trim();

    if (!geminiKey && !mistralKey && !groqKey) {
      return res.status(503).json({ error: "AI services not configured" });
    }

    let hint = "";
    if (groqKey) {
      try {
        const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
        const response = await axios.post(
          groqUrl,
          {
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "user",
                content: `Based on this code context, provide a single, very short code completion (just the next few characters or line). Return ONLY the completion text.\n\nCode before cursor:\n${prompt}\n\nCode after cursor:\n${suffix}`,
              },
            ],
            temperature: 0.2,
            max_tokens: 64,
          },
          {
            headers: {
              Authorization: `Bearer ${groqKey}`,
              "Content-Type": "application/json",
            },
            timeout: 5000,
          },
        );
        hint = response.data?.choices?.[0]?.message?.content || "";
      } catch {
        console.warn("Groq hint failed, falling back...");
      }
    }

    if (!hint && geminiKey) {
      hint = (
        await generateWithGemini(
          `Based on this code context, provide a single, very short code completion (just the next few characters or line). Return ONLY the completion text.\n\nCode before cursor:\n${prompt}\n\nCode after cursor:\n${suffix}`,
          geminiKey,
          { temperature: 0.2, maxOutputTokens: 64 },
        )
      ).text;
    }

    if (!hint && mistralKey) {
      const response = await axios.post(
        "https://api.mistral.ai/v1/fim/completions",
        {
          model: "codestral-latest",
          prompt: prompt,
          suffix: suffix || "",
          max_tokens: 128,
          temperature: 0.2,
          stop: ["\n\n"],
        },
        {
          headers: {
            Authorization: `Bearer ${mistralKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );
      hint = extractAiText(response.data);
    }

    res.json({ hint: hint.trim() });
  } catch (err) {
    const errorMsg =
      err.response?.data?.error?.message || err.message || "Unknown error";
    console.error("AI hint error:", errorMsg);
    res.status(500).json({ error: `Failed to fetch AI hint: ${errorMsg}` });
  }
});

app.post("/api/ai-hints", aiHintLimiter, async (req, res) => {
  try {
    const { code, beforeCursor, afterCursor } = req.body;

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const mistralKey = process.env.MISTRAL_API_KEY?.trim();
    const groqKey = process.env.GROQ_API_KEY?.trim();

    if (!code || (!geminiKey && !mistralKey && !groqKey)) {
      return res
        .status(400)
        .json({ error: "Missing code or API key", hints: [] });
    }

    const suggestions = [];

    if (groqKey) {
      try {
        const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
        const response = await axios.post(
          groqUrl,
          {
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "user",
                content: `Based on the code below, provide 3-5 short DSA-oriented code completion suggestions in a plain JSON array format like ["hint1", "hint2"].\n\nCode:\n${code}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 256,
          },
          {
            headers: {
              Authorization: `Bearer ${groqKey}`,
              "Content-Type": "application/json",
            },
            timeout: 5000,
          },
        );
        const text = response.data?.choices?.[0]?.message?.content || "";
        try {
          const jsonStart = text.indexOf("[");
          const jsonEnd = text.lastIndexOf("]") + 1;
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const parsed = JSON.parse(text.substring(jsonStart, jsonEnd));
            if (Array.isArray(parsed)) suggestions.push(...parsed);
          }
        } catch {
          if (text) suggestions.push(text.trim().split("\n")[0]);
        }
      } catch {
        console.warn("Groq hints failed, falling back...");
      }
    }

    if (suggestions.length === 0 && geminiKey) {
      try {
        const text = (
          await generateWithGemini(
            `Based on the code below, provide 3-5 short DSA-oriented code completion suggestions in a plain JSON array format like ["hint1", "hint2"].\n\nCode:\n${code}`,
            geminiKey,
            { temperature: 0.3, maxOutputTokens: 256 },
          )
        ).text;
        try {
          const jsonStart = text.indexOf("[");
          const jsonEnd = text.lastIndexOf("]") + 1;
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const parsed = JSON.parse(text.substring(jsonStart, jsonEnd));
            if (Array.isArray(parsed)) {
              suggestions.push(...parsed);
            }
          }
        } catch {
          if (text) {
            suggestions.push(text.trim().split("\n")[0]);
          }
        }
      } catch {
        console.warn("Gemini hints failed, falling back...");
      }
    }

    if (suggestions.length === 0 && mistralKey) {
      // Mistral logic... (keeping existing)
      if (beforeCursor && afterCursor) {
        const response = await axios.post(
          "https://api.mistral.ai/v1/fim/completions",
          {
            model: "codestral-latest",
            prompt: beforeCursor,
            suffix: afterCursor,
            max_tokens: 64,
            temperature: 0.3,
            stop: ["\n\n"],
          },
          {
            headers: {
              Authorization: `Bearer ${mistralKey}`,
              "Content-Type": "application/json",
            },
            timeout: 8000,
          },
        );

        const hint = extractAiText(response.data);
        if (hint.trim()) {
          suggestions.push(hint.trim());
        }
      }

      // Generate general completion suggestion
      const response2 = await axios.post(
        "https://api.mistral.ai/v1/fim/completions",
        {
          model: "codestral-latest",
          prompt: code,
          suffix: "",
          max_tokens: 64,
          temperature: 0.4,
        },
        {
          headers: {
            Authorization: `Bearer ${mistralKey}`,
            "Content-Type": "application/json",
          },
          timeout: 8000,
        },
      );

      const hint2 = extractAiText(response2.data);
      if (hint2.trim()) {
        suggestions.push(hint2.trim());
      }
    }

    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 5);
    res.json({ hints: uniqueSuggestions });
  } catch (err) {
    const errorMsg =
      err.response?.data?.error?.message || err.message || "Unknown error";
    console.error("AI hints error:", errorMsg);
    res
      .status(500)
      .json({ error: `Failed to fetch AI hints: ${errorMsg}`, hints: [] });
  }
});

const PORT = process.env.MISTRAL_PORT || 3001;

app.listen(PORT, () => {
  console.log(`MISTRAL AI Server is running on http://localhost:${PORT}`);
});
