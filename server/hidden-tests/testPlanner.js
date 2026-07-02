import axios from "axios";
import process from "process";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

function stripFences(text = "") {
  return String(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function fallbackPlans() {
  return [
    {
      category: "boundary",
      description: "single item minimum size",
      bugClass: "empty case",
      inputSpec: { type: "array", n: 1 },
    },
    {
      category: "boundary",
      description: "larger input near typical limits",
      bugClass: "wrong loop bounds",
      inputSpec: { type: "array", n: 50 },
    },
    {
      category: "robustness",
      description: "string edge pattern",
      bugClass: "off-by-one",
      inputSpec: { type: "string", length: 32, alphabet: "abc" },
    },
  ];
}

function humanizePlannerWarning(message = "") {
  const normalized = String(message || "").trim();
  if (!normalized) {
    return "Hidden-test planning fell back to safe defaults.";
  }
  if (/quota exceeded|rate.?limit|429/i.test(normalized)) {
    return "AI planner quota is unavailable right now, so ForkSpace used built-in fallback hidden tests instead.";
  }
  return normalized;
}

function normalizePlans(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const spec = item.inputSpec;
    if (!spec || typeof spec !== "object") continue;
    out.push({
      category: String(item.category || "edge").slice(0, 32),
      description: String(item.description || "Generated edge case").slice(0, 180),
      bugClass: String(item.bugClass || "unknown").slice(0, 64),
      inputSpec: spec,
    });
    if (out.length >= 4) break;
  }
  return out;
}

export async function planHiddenTests({
  problemStatement,
  constraints = "",
  sampleIO = "",
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey.toLowerCase().includes("your_")) {
    return { plans: fallbackPlans(), source: "fallback_no_key", warning: "Gemini key missing. Used fallback plans." };
  }

  const prompt = `You are a test planning assistant for competitive programming.
Return ONLY valid JSON array. No markdown. No prose.
Generate 4 concise hidden test plans.
Do NOT provide expected outputs.
Do NOT provide raw stdin strings.
Schema:
[
  {
    "category": "boundary|stress|robustness|randomized",
    "description": "short description",
    "bugClass": "off-by-one|overflow|empty case|wrong loop bounds|unknown",
    "inputSpec": { "type": "array|string|graph", ... }
  }
]
Problem statement:
${problemStatement}

Constraints:
${constraints}

Sample I/O:
${sampleIO}
`;

  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600,
          responseMimeType: "application/json",
        },
      },
      {
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = stripFences(text);
    let parsed = [];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { plans: fallbackPlans(), source: "fallback_parse_error", warning: "Planner parse failed. Used fallback plans." };
    }
    const normalized = normalizePlans(parsed);
    if (!normalized.length) {
      return { plans: fallbackPlans(), source: "fallback_empty", warning: "Planner returned no valid plans. Used fallback plans." };
    }
    return { plans: normalized.slice(0, 4), source: "gemini" };
  } catch (error) {
    return {
      plans: fallbackPlans(),
      source: "fallback_request_error",
      warning: humanizePlannerWarning(
        error?.response?.data?.error?.message ||
        error.message ||
        "Planner failed. Used fallback plans.",
      ),
    };
  }
}
