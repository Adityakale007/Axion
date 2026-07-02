import axios from "axios";
import process from "process";
import { connectDb } from "./_lib/db.js";
import {
  buildAnalysisFailure,
  buildAnalysisPrompt,
  isUsableAnalysis,
  parseAnalysisResponse,
} from "../server/services/analysisService.js";

const DEFAULT_LANGUAGE = "cpp";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const PREFERRED_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim();
}

function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim();
}

function getMistralApiKey() {
  return process.env.MISTRAL_API_KEY?.trim();
}

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
      headers: { "x-goog-api-key": apiKey },
      params: { pageSize: 1000 },
      timeout: 10000,
    });

    return (response.data?.models || [])
      .filter((entry) =>
        entry?.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((entry) => entry?.name?.replace(/^models\//, ""))
      .filter(Boolean);
  } catch {
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
        return { text, modelName };
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("All Gemini generateContent models failed");
}

async function getAiReview(prompt, apiKey, model = "mistral") {
  if (model === "gemini") {
    const { text } = await generateWithGemini(prompt, apiKey, {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    });
    return text;
  }

  if (model === "groq") {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      },
    );

    return response.data?.choices?.[0]?.message?.content || "";
  }

  const response = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "codestral-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    },
  );

  return extractAiText(response.data);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    code,
    language = DEFAULT_LANGUAGE,
    prompt = "",
    problemContext = "",
  } = req.body || {};
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();
  const mistralKey = getMistralApiKey();
  const effectiveProblemContext = problemContext || prompt || "";

  if (!code?.trim()) {
    return res.status(400).json({ error: "Missing code" });
  }

  if (!geminiKey && !groqKey && !mistralKey) {
    return res.status(503).json({
      error:
        "AI services are not configured. Add GEMINI_API_KEY, GROQ_API_KEY, or MISTRAL_API_KEY to the deployment environment.",
    });
  }

  try {
    await connectDb();
    const promptText = buildAnalysisPrompt({
      code,
      language,
      problemContext: effectiveProblemContext,
    });
    let lastRawResponse = "";
    const providers = [
      ["groq", groqKey],
      ["gemini", geminiKey],
      ["mistral", mistralKey],
    ].filter(([, key]) => Boolean(key));

    for (const [provider, key] of providers) {
      try {
        const responseText = await getAiReview(promptText, key, provider);
        if (!responseText) continue;
        lastRawResponse = responseText;

        const parsed = parseAnalysisResponse({
          responseText,
          code,
          language,
          problemContext: effectiveProblemContext,
          provider,
        });

        if (isUsableAnalysis(parsed)) {
          return res.status(200).json(parsed);
        }
      } catch {
        // Try the next provider.
      }
    }

    if (lastRawResponse) {
      return res.status(500).json(buildAnalysisFailure(lastRawResponse));
    }

    return res.status(500).json({
      error: "Analysis failed",
      raw: "All configured AI providers failed or returned an empty response.",
    });
  } catch (error) {
    const errorMsg =
      error.response?.data?.error?.message || error.message || "Unknown error";
    return res.status(500).json({ error: "Analysis failed", raw: errorMsg });
  }
}
