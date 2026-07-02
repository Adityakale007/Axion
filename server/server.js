import express from "express";
import http from "http";
import process from "process";
import { config as loadEnv } from "dotenv";
import { Server } from "socket.io";
import axios from "axios";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Buffer } from "buffer";
import cors from "cors";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import Room from "./models/Room.js";
import Analysis from "./models/Analysis.js";
import MockSummary from "./models/MockSummary.js";
import HiddenTest from "./models/HiddenTest.js";
import SessionCard from "./models/SessionCard.js";
import {
  appendIntelligenceEvent,
  aggregateSessionReport,
  buildProblemSnapshot,
  deriveIssueLabelsFromReview,
  fetchIntelligenceLog,
  loadIntelligenceLogsFromFile,
  markIntelligenceSessionEnded,
  saveShareableReport,
  getReportByShareId,
  listReportsForUser,
  getLatestReportForRoom,
} from "./services/sessionIntelligence.js";
import { checkAndAwardTitles } from "./services/titleService.js";
import { generateSessionCard } from "./services/sessionCard.js";
import {
  buildAnalysisFailure,
  buildAnalysisPrompt,
  isUsableAnalysis,
  parseAnalysisResponse,
} from "./services/analysisService.js";
import {
  loadCodeforcesCatalog,
  filterProblems,
  findNormalizedProblem,
  buildRoomProblemPayloadFromCf,
  parseInternalProblemId,
} from "./services/codeforcesCatalog.js";
import createHiddenTestRouter from "./hidden-tests/hiddenTestRoutes.js";
import dailyRoutes from "./routes/dailyRoutes.js";
import challengeRoutes from "./routes/challengeRoutes.js";

loadEnv({ path: new URL("./.env", import.meta.url) });
mongoose.set("bufferCommands", false);

const redisUrl = process.env.REDIS_URL;
let pubClient, subClient;

if (redisUrl) {
  const redisOptions = {
    maxRetriesPerRequest: null, // Required for some environments to prevent crashing on connection loss
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };

  pubClient = new Redis(redisUrl, redisOptions);
  subClient = pubClient.duplicate(redisOptions);

  pubClient.on("error", (err) => {
    console.error("Redis PubClient Error:", err.message);
  });

  subClient.on("error", (err) => {
    console.error("Redis SubClient Error:", err.message);
  });

  pubClient.on("connect", () => console.log("Redis PubClient connected"));
  subClient.on("connect", () => console.log("Redis SubClient connected"));
}

// Connect to MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/forkspace";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function safeVerifyJwt(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "secret");
  } catch {
    return null;
  }
}

function buildUserPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatarId: user.avatarId,
    forkspaceRating: user.forkspaceRating ?? 1000,
    totalSessions: user.totalSessions ?? 0,
    problemsAttempted: user.problemsAttempted ?? 0,
    currentStreak: user.currentStreak ?? 0,
    lastActiveDate: user.lastActiveDate || null,
    titles: user.titles || [],
    avatar: user.avatar || "dev1",
    activityLog: user.activityLog || [],
    sessionsAsNavigator: user.sessionsAsNavigator ?? 0,
  };
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const configuredOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
];

const allowedOrigins = [
  ...new Set(
    [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "https://fork-space.vercel.app",
      ...configuredOrigins,
    ].filter(Boolean),
  ),
];

function corsOriginResolver(origin, callback) {
  // Allow non-browser and server-to-server calls without an Origin header.
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS origin not allowed: ${origin}`), false);
}

const app = express();

// Configure Helmet to avoid "blacklist and siteRules" warnings and allow common resources
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" }, // Added to address the warning
  }),
);

app.use(
  cors({
    origin: corsOriginResolver,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());

// Middleware to check database connection
app.use((req, res, next) => {
  if (!isDatabaseConnected() && req.path.startsWith("/api/auth")) {
    return res.status(503).json({
      error: "Database is not connected. Please ensure MongoDB is running.",
    });
  }
  next();
});

app.use(
  "/api/hidden-tests",
  createHiddenTestRouter({
    isDatabaseConnected,
    getRoomState: getOrCreateRoomState,
  }),
);

app.use("/api/daily", dailyRoutes);
app.use("/api/challenge", challengeRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOriginResolver,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

if (pubClient && subClient) {
  io.adapter(createAdapter(pubClient, subClient));
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1,
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "ForkSpace API",
    ok: true,
    message: "Backend is running. Use the frontend app to access UI.",
    health: "/health",
  });
});

app.post("/api/auth/register", async (req, res) => {
  const {
    name = "",
    email = "",
    password = "",
    avatarId = "clever-fox",
  } = req.body || {};
  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }

    user = new User({ name, email: normalizedEmail, password, avatarId });
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" },
    );

    res.status(201).json({
      token,
      user: buildUserPayload(user),
    });
  } catch (err) {
    console.error("Registration error details:", err);
    res.status(500).json({
      error: "Failed to register user",
      details: err.message,
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email = "", password = "" } = req.body || {};
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: buildUserPayload(user),
    });
  } catch (err) {
    console.error("Login error details:", err);
    res.status(500).json({
      error: "Failed to login",
      details: err.message,
    });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    res.json({
      user: buildUserPayload(user),
    });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/api/auth/history", async (req, res) => {
  const user = await getUserFromAuthHeader(req);

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({
    rooms: user.roomHistory || [],
    runs: user.runHistory || [],
  });
});

app.patch("/api/auth/avatar", async (req, res) => {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const nextAvatarId = String(req.body?.avatarId || "").trim();
  if (!nextAvatarId) {
    return res.status(400).json({ error: "avatarId is required" });
  }

  user.avatarId = nextAvatarId;
  await user.save();

  return res.json({
    user: buildUserPayload(user),
  });
});

app.patch("/api/auth/profile", async (req, res) => {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const nextName = String(req.body?.name || "").trim();
  const nextAvatar = String(req.body?.avatar || "").trim();

  if (nextName) {
    user.name = nextName.slice(0, 60);
  }
  if (nextAvatar) {
    user.avatar = nextAvatar;
  }

  await user.save();

  return res.json({
    user: buildUserPayload(user),
  });
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});

const SUPPORTED_LANGUAGES = {
  cpp: {
    id: 54,
    label: "C++",
    starterCode:
      '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello, ForkSpace!";\n    return 0;\n}\n',
  },
  javascript: {
    id: 63,
    label: "JavaScript",
    starterCode:
      'function main() {\n  console.log("Hello, ForkSpace!");\n}\n\nmain();\n',
  },
  python: {
    id: 71,
    label: "Python",
    starterCode:
      'def main():\n    print("Hello, ForkSpace!")\n\n\nif __name__ == "__main__":\n    main()\n',
  },
};

const DEFAULT_LANGUAGE = "cpp";
const roomStateMap = new Map();
const dataDirectory = path.join(process.cwd(), "server", "data");
const roomStateFile = path.join(dataDirectory, "room-state.json");
const userStateFile = path.join(dataDirectory, "user-state.json");
const memorySessionCards = new Map();
let persistTimer = null;
let userPersistTimer = null;
let userState = {
  users: [],
  roomHistoryByUser: {},
  runHistoryByUser: {},
};

function getLanguageConfig(language) {
  return SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}

function createDefaultProblemState() {
  return {
    platform: "custom",
    problemCode: "",
    problemUrl: "",
    sourceUrl: "",
    title: "Untitled Practice Problem",
    prompt: "",
    constraints: "",
    pastedStatement: "",
    sampleInput: "",
    sampleOutput: "",
    samples: [],
    tags: [],
    rating: "",
    difficulty: "",
    difficultyLabel: "",
    problemSource: "manual",
    problemSnapshot: null,
  };
}

function createDefaultSessionState() {
  return {
    mode: "peer_practice",
    driverSocketId: "",
    navigatorSocketId: "",
    approachNotes: "",
    edgeCaseChecklist: [
      {
        id: "empty_or_null",
        label: "Empty / null input handling",
        hint: "Do we return early for empty string/array/list/tree?",
        priority: "critical",
        checked: false,
      },
      {
        id: "single_element",
        label: "Single-element or minimum-size case",
        hint: "n = 0/1 or smallest valid constraints",
        priority: "high",
        checked: false,
      },
      {
        id: "boundaries",
        label: "Boundary indexes and off-by-one",
        hint: "First/last index, loop bounds, inclusive vs exclusive",
        priority: "critical",
        checked: false,
      },
      {
        id: "duplicates_stability",
        label: "Duplicates and equality behavior",
        hint: "Same values, tie-breaking, stable ordering assumptions",
        priority: "high",
        checked: false,
      },
      {
        id: "sorted_assumption",
        label: "Sorted/unique assumptions validated",
        hint: "Are we relying on sorted input or uniqueness implicitly?",
        priority: "high",
        checked: false,
      },
      {
        id: "overflow_limits",
        label: "Integer overflow and extreme limits",
        hint: "2e5, 1e9, multiplication, prefix sums, mid calculation",
        priority: "critical",
        checked: false,
      },
      {
        id: "all_negative_or_zero",
        label: "All-negative / all-zero scenarios",
        hint: "Common failure for max/min, greedy, and DP transitions",
        priority: "high",
        checked: false,
      },
      {
        id: "complexity_budget",
        label: "Complexity fits worst-case constraints",
        hint: "Time and memory still pass on max input size?",
        priority: "critical",
        checked: false,
      },
    ],
    runHistory: [],
    mentorNotes: "",
    mockSummary: null,
    mockLocked: false,
    intelligenceSessionId: "",
    intelligenceStartedAt: "",
  };
}

function attachNormalizedSession(session = {}) {
  const defaults = createDefaultSessionState();
  return {
    ...defaults,
    ...(session || {}),
    mode:
      typeof session?.mode === "string" && session.mode.trim()
        ? session.mode
        : defaults.mode,
    driverSocketId:
      typeof session?.driverSocketId === "string"
        ? session.driverSocketId
        : defaults.driverSocketId,
    navigatorSocketId:
      typeof session?.navigatorSocketId === "string"
        ? session.navigatorSocketId
        : defaults.navigatorSocketId,
    approachNotes:
      typeof session?.approachNotes === "string"
        ? session.approachNotes
        : defaults.approachNotes,
    edgeCaseChecklist: Array.isArray(session?.edgeCaseChecklist)
      ? session.edgeCaseChecklist
      : defaults.edgeCaseChecklist,
    runHistory: Array.isArray(session?.runHistory)
      ? session.runHistory
      : defaults.runHistory,
    mentorNotes:
      typeof session?.mentorNotes === "string"
        ? session.mentorNotes
        : defaults.mentorNotes,
    mockSummary:
      session?.mockSummary && typeof session.mockSummary === "object"
        ? session.mockSummary
        : defaults.mockSummary,
    mockLocked:
      typeof session?.mockLocked === "boolean"
        ? session.mockLocked
        : defaults.mockLocked,
    intelligenceSessionId:
      typeof session?.intelligenceSessionId === "string"
        ? session.intelligenceSessionId
        : defaults.intelligenceSessionId,
    intelligenceStartedAt:
      typeof session?.intelligenceStartedAt === "string"
        ? session.intelligenceStartedAt
        : defaults.intelligenceStartedAt,
  };
}

function createDefaultRoomState() {
  const defaultConfig = getLanguageConfig(DEFAULT_LANGUAGE);

  return {
    language: DEFAULT_LANGUAGE,
    code: defaultConfig.starterCode,
    session: createDefaultSessionState(),
    problem: createDefaultProblemState(),
  };
}

async function loadPersistedRoomStates() {
  try {
    await mkdir(dataDirectory, { recursive: true });
    const fileContent = await readFile(roomStateFile, "utf8");
    const parsed = JSON.parse(fileContent);

    Object.entries(parsed).forEach(([roomId, roomState]) => {
      const nextLanguage = SUPPORTED_LANGUAGES[roomState?.language]
        ? roomState.language
        : DEFAULT_LANGUAGE;
      const defaultConfig = getLanguageConfig(nextLanguage);

      roomStateMap.set(roomId, {
        language: nextLanguage,
        code:
          typeof roomState?.code === "string"
            ? roomState.code
            : defaultConfig.starterCode,
        session: attachNormalizedSession(roomState?.session || {}),
        problem: attachNormalizedSamples(roomState?.problem || {}),
      });
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to load room state persistence:", error.message);
    }
  }
}

async function persistRoomStates() {
  await mkdir(dataDirectory, { recursive: true });
  const serializableState = Object.fromEntries(roomStateMap.entries());
  await writeFile(
    roomStateFile,
    JSON.stringify(serializableState, null, 2),
    "utf8",
  );
}

async function loadPersistedUserState() {
  try {
    await mkdir(dataDirectory, { recursive: true });
    const fileContent = await readFile(userStateFile, "utf8");
    const parsed = JSON.parse(fileContent);

    userState = {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      roomHistoryByUser: parsed?.roomHistoryByUser || {},
      runHistoryByUser: parsed?.runHistoryByUser || {},
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to load user state persistence:", error.message);
    }
  }
}

async function persistUserState() {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(userStateFile, JSON.stringify(userState, null, 2), "utf8");
}

function scheduleRoomStatePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistRoomStates().catch((error) => {
      console.error("Failed to persist room state:", error.message);
    });
  }, 250);
}

function scheduleUserStatePersist() {
  if (userPersistTimer) {
    clearTimeout(userPersistTimer);
  }

  userPersistTimer = setTimeout(() => {
    userPersistTimer = null;
    persistUserState().catch((error) => {
      console.error("Failed to persist user state:", error.message);
    });
  }, 250);
}

async function flushRoomStatePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  try {
    await persistRoomStates();
  } catch (error) {
    console.error("Failed to flush room state persistence:", error.message);
  }
}

async function flushUserStatePersist() {
  if (userPersistTimer) {
    clearTimeout(userPersistTimer);
    userPersistTimer = null;
  }

  try {
    await persistUserState();
  } catch (error) {
    console.error("Failed to flush user state persistence:", error.message);
  }
}

function getOrCreateRoomState(roomId) {
  if (!roomStateMap.has(roomId)) {
    roomStateMap.set(roomId, createDefaultRoomState());
    scheduleRoomStatePersist();
  }

  return roomStateMap.get(roomId);
}

function createRoomId() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function createUniqueRoomId() {
  let attempts = 0;
  let candidate = createRoomId();
  while (roomStateMap.has(candidate) && attempts < 10) {
    candidate = createRoomId();
    attempts += 1;
  }
  return candidate;
}

function ensureIntelligenceSession(roomState) {
  if (!roomState?.session) return;
  if (!roomState.session.intelligenceSessionId) {
    roomState.session = attachNormalizedSession({
      ...roomState.session,
      intelligenceSessionId: crypto.randomUUID(),
      intelligenceStartedAt: new Date().toISOString(),
    });
    scheduleRoomStatePersist();
  }
}

async function getUserFromAuthHeader(req) {
  if (!isDatabaseConnected()) return null;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    return await User.findById(decoded.userId);
  } catch (err) {
    return null;
  }
}

async function persistRoomDocument(roomId, roomState) {
  if (!isDatabaseConnected()) return;
  try {
    await Room.findOneAndUpdate(
      { roomId },
      {
        roomId,
        code: roomState.code,
        language: roomState.language,
        problem: roomState.problem,
        session: roomState.session,
        updatedAt: new Date(),
      },
      { upsert: true },
    );
  } catch (err) {
    console.error("Error saving room to MongoDB:", err);
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
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

function inferLanguageFromCode(code = "") {
  if (
    code.includes("#include") ||
    code.includes("using namespace std") ||
    code.includes("int main(")
  ) {
    return "cpp";
  }

  if (
    code.includes("def ") ||
    code.includes("print(") ||
    code.includes("__name__")
  ) {
    return "python";
  }

  if (
    code.includes("function ") ||
    code.includes("console.log") ||
    code.includes("const ") ||
    code.includes("let ")
  ) {
    return "javascript";
  }

  return DEFAULT_LANGUAGE;
}

function buildFallbackHint(prompt = "", suffix = "") {
  const combined = `${prompt}\n${suffix}`;
  const language = inferLanguageFromCode(combined);

  if (language === "cpp") {
    if (
      prompt.includes("int main(") &&
      !prompt.includes("return 0;") &&
      suffix.includes("}")
    ) {
      return "\n    return 0;";
    }

    if (prompt.trim().endsWith('cout << "Hello, ForkSpace!"')) {
      return " << endl;";
    }
  }

  if (language === "javascript") {
    if (prompt.trim().endsWith('console.log("Hello, ForkSpace!")')) {
      return ";";
    }

    if (prompt.includes("function main()") && !prompt.includes("main();")) {
      return "\n\nmain();";
    }
  }

  if (language === "python") {
    if (prompt.trim().endsWith('if __name__ == "__main__":')) {
      return "\n    main()";
    }
  }

  return "";
}

function buildFallbackHints(code = "", beforeCursor = "", afterCursor = "") {
  const language = inferLanguageFromCode(
    code || `${beforeCursor}\n${afterCursor}`,
  );
  const suggestions = [];

  if (language === "cpp") {
    if (!code.includes("return 0;") && code.includes("int main(")) {
      suggestions.push(
        "Add `return 0;` before the closing brace of `main` to make the program exit explicitly.",
      );
    }
    if (
      !code.includes("#include <bits/stdc++.h>") &&
      !code.includes("#include <iostream>")
    ) {
      suggestions.push(
        "Add the required include directives before using `cout`, containers, or algorithms.",
      );
    }
    suggestions.push(
      "For competitive programming, keep input/output fast and move the core logic into a helper function for easier debugging.",
    );
  }

  if (language === "javascript") {
    if (!code.includes("main();") && code.includes("function main()")) {
      suggestions.push(
        "Call `main();` after defining the function so the program actually runs.",
      );
    }
    suggestions.push(
      "Prefer small functions for parsing input, solving the task, and printing output separately.",
    );
  }

  if (language === "python") {
    if (!code.includes('if __name__ == "__main__":')) {
      suggestions.push(
        'Add an `if __name__ == "__main__":` guard to keep the entry point clear.',
      );
    }
    suggestions.push(
      "Keep parsing, solving, and printing in separate functions so the solution is easier to test.",
    );
  }

  suggestions.push(
    "Test one edge case and one normal case after every small change to catch regressions early.",
  );

  return [...new Set(suggestions)].slice(0, 5);
}

function getMistralApiKey() {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey || apiKey.toLowerCase().includes("your_")) return "";
  return apiKey;
}

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey.toLowerCase().includes("your_")) return "";
  return apiKey;
}

function getGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || apiKey.toLowerCase().includes("your_")) return "";
  return apiKey;
}

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const PREFERRED_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

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
    const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
    try {
      const response = await axios.post(
        groqUrl,
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
          timeout: 15000,
        },
      );
      return response.data?.choices?.[0]?.message?.content || "";
    } catch (error) {
      console.error(
        "Groq API error detail:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Default to Mistral
  try {
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
        timeout: 15000,
      },
    );
    return extractAiText(response.data);
  } catch (error) {
    console.error(
      "Mistral API error detail:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

async function upsertRecentRoom(userId, roomEntry) {
  if (!isDatabaseConnected()) return;
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Filter out existing entry for this room to avoid duplicates
    const filteredHistory = (user.roomHistory || []).filter(
      (entry) => entry.roomId !== roomEntry.roomId,
    );

    const nextHistory = [
      {
        ...roomEntry,
        updatedAt: new Date(),
      },
      ...filteredHistory,
    ].slice(0, 12);

    // Use atomic update to avoid VersionError
    await User.updateOne(
      { _id: userId },
      { $set: { roomHistory: nextHistory } },
    );
  } catch (err) {
    console.error("Error updating room history:", err);
  }
}

async function appendRunHistory(userId, runEntry) {
  if (!isDatabaseConnected()) return;
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const nextHistory = [
      {
        ...runEntry,
        createdAt: new Date(),
      },
      ...(user.runHistory || []),
    ].slice(0, 30);

    // Use atomic update to avoid VersionError
    await User.updateOne(
      { _id: userId },
      { $set: { runHistory: nextHistory } },
    );
  } catch (err) {
    console.error("Error updating run history:", err);
  }
}

function decodeHtmlEntities(value = "") {
  const entityMap = {
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };

  return value
    .replace(
      /&(lt|gt|amp|quot|#39|nbsp);/g,
      (match) => entityMap[match] || match,
    )
    .replace(/&#(\d+);/g, (_match, codePoint) =>
      String.fromCharCode(Number(codePoint)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint) =>
      String.fromCharCode(parseInt(codePoint, 16)),
    );
}

function stripHtml(value = "") {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(
        /<\/(p|div|section|article|li|ul|ol|pre|h1|h2|h3|h4|h5|h6|tr|td)>/gi,
        "\n",
      )
      .replace(/<li>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPreformattedText(value = "") {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<div>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeWhitespace(value = "") {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeForComparison(value = "") {
  return normalizeWhitespace(value)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function normalizeOutput(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function buildSamplesFromJoinedText(sampleInput = "", sampleOutput = "") {
  const inputs = normalizeWhitespace(sampleInput)
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const outputs = normalizeWhitespace(sampleOutput)
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const length = Math.max(inputs.length, outputs.length);

  return Array.from({ length }, (_, index) => ({
    id: `sample-${index + 1}`,
    input: inputs[index] || "",
    output: outputs[index] || "",
  })).filter((sample) => sample.input || sample.output);
}

function attachNormalizedSamples(problem = {}) {
  const normalizedProblem = {
    ...createDefaultProblemState(),
    ...problem,
  };
  const normalizedJoinedInput = normalizeWhitespace(
    normalizedProblem.sampleInput,
  );
  const normalizedJoinedOutput = normalizeWhitespace(
    normalizedProblem.sampleOutput,
  );
  const normalizedIncomingSamples = Array.isArray(problem?.samples)
    ? problem.samples
        .map((sample, index) => ({
          id: sample.id || `sample-${index + 1}`,
          input: normalizeWhitespace(sample.input || ""),
          output: normalizeWhitespace(sample.output || ""),
        }))
        .filter((sample) => sample.input || sample.output)
    : [];
  const joinedFromIncomingSamples = {
    input: normalizedIncomingSamples
      .map((sample) => sample.input)
      .filter(Boolean)
      .join("\n\n"),
    output: normalizedIncomingSamples
      .map((sample) => sample.output)
      .filter(Boolean)
      .join("\n\n"),
  };
  const joinedTextLooksEdited =
    normalizedJoinedInput !==
      normalizeWhitespace(joinedFromIncomingSamples.input) ||
    normalizedJoinedOutput !==
      normalizeWhitespace(joinedFromIncomingSamples.output);
  const samples =
    normalizedIncomingSamples.length > 0 && !joinedTextLooksEdited
      ? normalizedIncomingSamples
      : buildSamplesFromJoinedText(
          normalizedJoinedInput,
          normalizedJoinedOutput,
        );

  const tagsRaw = normalizedProblem.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
    : typeof tagsRaw === "string"
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  return {
    ...normalizedProblem,
    problemUrl:
      normalizedProblem.problemUrl || normalizedProblem.sourceUrl || "",
    constraints: normalizeWhitespace(normalizedProblem.constraints || ""),
    pastedStatement: normalizedProblem.pastedStatement || "",
    sampleInput: normalizedJoinedInput,
    sampleOutput: normalizedJoinedOutput,
    samples,
    tags,
    rating: normalizedProblem.rating || "",
    difficulty: normalizedProblem.difficulty || normalizedProblem.rating || "",
    difficultyLabel:
      typeof normalizedProblem.difficultyLabel === "string"
        ? normalizedProblem.difficultyLabel
        : "",
    problemSource:
      typeof normalizedProblem.problemSource === "string" &&
      normalizedProblem.problemSource.trim()
        ? normalizedProblem.problemSource
        : "manual",
    problemSnapshot:
      normalizedProblem.problemSnapshot &&
      typeof normalizedProblem.problemSnapshot === "object"
        ? normalizedProblem.problemSnapshot
        : null,
  };
}

function normalizeCodeforcesProblemCode(problemCode = "") {
  const normalized = problemCode.replace(/\s+/g, "").replace(/[-_/]/g, "");
  const match = normalized.match(/^(\d+)([A-Za-z][A-Za-z0-9]*)$/);

  if (!match) {
    return null;
  }

  return {
    contestId: match[1],
    index: match[2].toUpperCase(),
  };
}

function buildCodeforcesCandidateUrls(normalizedProblem, sourceUrl = "") {
  const urls = [];

  if (sourceUrl?.trim()) {
    try {
      const parsedUrl = new URL(sourceUrl.trim());
      const normalizedHost = parsedUrl.hostname.replace(/^m1\./i, "");
      const sourceMatch = parsedUrl.pathname.match(
        /\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Za-z][A-Za-z0-9]*)/i,
      );

      if (
        normalizedHost === "codeforces.com" &&
        sourceMatch?.[1] === normalizedProblem.contestId &&
        sourceMatch?.[2]?.toUpperCase() === normalizedProblem.index
      ) {
        parsedUrl.hostname = "codeforces.com";
        urls.push(parsedUrl.toString());
      }
    } catch {
      // Ignore malformed source URLs and fall back to canonical Codeforces pages.
    }
  }

  urls.push(
    `https://codeforces.com/problemset/problem/${normalizedProblem.contestId}/${normalizedProblem.index}`,
  );
  urls.push(
    `https://codeforces.com/contest/${normalizedProblem.contestId}/problem/${normalizedProblem.index}`,
  );

  return [...new Set(urls)];
}

function extractLeetCodeExampleOutputs(content = "") {
  const textContent = stripHtml(content);
  const outputMatches = [
    ...textContent.matchAll(
      /Output:\s*([\s\S]*?)(?=\n(?:Explanation|Example \d+:|Constraints:|Follow-up:|$))/g,
    ),
  ];

  return outputMatches
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join("\n\n");
}

function extractCodeforcesPrompt(html = "") {
  const titleRegex = /<div class="title">[\s\S]*?<\/div>/i;
  const titleMatch = titleRegex.exec(html);

  if (!titleMatch) {
    return "";
  }

  const promptStart = titleMatch.index + titleMatch[0].length;
  const sampleIndex = html.indexOf('<div class="sample-test">', promptStart);
  const promptEnd =
    sampleIndex >= 0
      ? sampleIndex
      : html.indexOf('<div class="note">', promptStart);

  if (promptEnd < 0) {
    return "";
  }

  return stripHtml(html.slice(promptStart, promptEnd));
}

function extractCodeforcesSamples(html = "") {
  const sampleInputs = [
    ...html.matchAll(
      /<div class="input">[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    ),
  ]
    .map((match) => extractPreformattedText(match[1]))
    .filter(Boolean);
  const sampleOutputs = [
    ...html.matchAll(
      /<div class="output">[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    ),
  ]
    .map((match) => extractPreformattedText(match[1]))
    .filter(Boolean);

  return {
    sampleInput: sampleInputs.join("\n\n"),
    sampleOutput: sampleOutputs.join("\n\n"),
  };
}

function extractCodeforcesSamplesFromText(html = "") {
  const text = stripHtml(html);
  const normalizedText = text.replace(/\n[ \t]+/g, "\n").trim();
  const pairs = [];
  const examplesAnchor = normalizedText.search(
    /(?:^|\n)(?:Examples?|Sample(?:s| Test)?)\s*\n/i,
  );
  const scanText =
    examplesAnchor >= 0 ? normalizedText.slice(examplesAnchor) : normalizedText;
  const lines = scanText.split("\n").map((line) => line.trimEnd());

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Input$/i.test(lines[index].trim())) {
      continue;
    }

    const inputLines = [];
    const outputLines = [];
    let cursor = index + 1;

    while (cursor < lines.length && !/^Output$/i.test(lines[cursor].trim())) {
      inputLines.push(lines[cursor]);
      cursor += 1;
    }

    if (cursor >= lines.length) {
      break;
    }

    cursor += 1;

    while (
      cursor < lines.length &&
      !/^Input$/i.test(lines[cursor].trim()) &&
      !/^(Note|Notes|Scoring|Tutorial|Explanation|Codeforces)$/i.test(
        lines[cursor].trim(),
      )
    ) {
      outputLines.push(lines[cursor]);
      cursor += 1;
    }

    pairs.push({
      input: inputLines.join("\n").trim(),
      output: outputLines.join("\n").trim(),
    });

    index = cursor - 1;
  }

  return {
    sampleInput: pairs
      .map((pair) => pair.input)
      .filter(Boolean)
      .join("\n\n"),
    sampleOutput: pairs
      .map((pair) => pair.output)
      .filter(Boolean)
      .join("\n\n"),
  };
}

function parseExamplesFromText(statement = "") {
  const lines = normalizeWhitespace(statement).split("\n");
  const samples = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Input:?$/i.test(lines[index].trim())) {
      continue;
    }

    const inputLines = [];
    const outputLines = [];
    let cursor = index + 1;

    while (cursor < lines.length && !/^Output:?$/i.test(lines[cursor].trim())) {
      inputLines.push(lines[cursor]);
      cursor += 1;
    }

    if (cursor >= lines.length) {
      break;
    }

    cursor += 1;

    while (
      cursor < lines.length &&
      !/^Input:?$/i.test(lines[cursor].trim()) &&
      !/^(Explanation|Note|Notes|Constraints|Follow-up|Scoring|Tutorial):?$/i.test(
        lines[cursor].trim(),
      )
    ) {
      outputLines.push(lines[cursor]);
      cursor += 1;
    }

    samples.push({
      id: `sample-${samples.length + 1}`,
      input: normalizeWhitespace(inputLines.join("\n")),
      output: normalizeWhitespace(outputLines.join("\n")),
    });

    index = cursor - 1;
  }

  return samples.filter((sample) => sample.input || sample.output);
}

function inferTitleFromStatement(statement = "") {
  const [firstLine = "Imported Practice Problem"] =
    normalizeWhitespace(statement).split("\n");
  return firstLine.length > 0 && firstLine.length < 120
    ? firstLine
    : "Imported Practice Problem";
}

function deriveProblemMetadataFromUrl(problemUrl = "") {
  const parsedUrl = new URL(problemUrl.trim());
  const hostname = parsedUrl.hostname.replace(/^m1\./i, "");

  if (hostname === "codeforces.com") {
    const match = parsedUrl.pathname.match(
      /\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Za-z][A-Za-z0-9]*)/i,
    );

    if (!match) {
      throw new Error("That Codeforces URL does not look like a problem page.");
    }

    const problemCode = `${match[1]}${match[2].toUpperCase()}`;

    return {
      platform: "codeforces",
      problemCode,
      problemUrl: parsedUrl.toString(),
      sourceUrl: parsedUrl.toString(),
      title: `Codeforces ${problemCode}`,
    };
  }

  if (hostname === "leetcode.com") {
    const match = parsedUrl.pathname.match(/\/problems\/([a-z0-9-]+)\//i);

    if (!match) {
      throw new Error("That LeetCode URL does not look like a problem page.");
    }

    return {
      platform: "leetcode",
      problemCode: match[1],
      problemUrl: parsedUrl.toString(),
      sourceUrl: parsedUrl.toString(),
      title: `LeetCode ${match[1]}`,
    };
  }

  throw new Error(
    "URL import currently supports Codeforces and LeetCode only.",
  );
}

async function importCodeforcesProblem(problemCode, sourceUrl = "") {
  const normalized = normalizeCodeforcesProblemCode(problemCode);

  if (!normalized) {
    throw new Error("Use a Codeforces code like 1885A or 1941B.");
  }

  const candidateUrls = buildCodeforcesCandidateUrls(normalized, sourceUrl);
  let lastErrorMessage = "Codeforces import failed.";

  for (const candidateUrl of candidateUrls) {
    try {
      const response = await axios.get(candidateUrl, {
        timeout: 12000,
        headers: {
          "User-Agent": "Mozilla/5.0 ForkSpace Problem Importer",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const html = response.data;
      if (/Please wait\. Your browser is being checked/i.test(html)) {
        lastErrorMessage = `Codeforces temporarily blocked automated access for ${candidateUrl}.`;
        continue;
      }
      const titleMatch =
        html.match(/<div class="title">([\s\S]*?)<\/div>/i) ||
        html.match(/<title>[\s\S]*?-\s*([^<]+?)\s*-\s*Codeforces<\/title>/i);
      const prompt = extractCodeforcesPrompt(html);
      const htmlSamples = extractCodeforcesSamples(html);
      const textSamples =
        !htmlSamples.sampleInput && !htmlSamples.sampleOutput
          ? extractCodeforcesSamplesFromText(html)
          : { sampleInput: "", sampleOutput: "" };
      const sampleInput = htmlSamples.sampleInput || textSamples.sampleInput;
      const sampleOutput = htmlSamples.sampleOutput || textSamples.sampleOutput;

      if (!sampleInput && !sampleOutput) {
        lastErrorMessage = `Fetched ${candidateUrl} but could not extract sample tests.`;
        continue;
      }

      return {
        platform: "codeforces",
        problemCode: `${normalized.contestId}${normalized.index}`,
        problemUrl: candidateUrl,
        sourceUrl: candidateUrl,
        title:
          stripHtml(titleMatch?.[1] || "") ||
          `Codeforces ${normalized.contestId}${normalized.index}`,
        prompt,
        sampleInput,
        sampleOutput,
        samples: buildSamplesFromJoinedText(sampleInput, sampleOutput),
      };
    } catch (error) {
      const upstreamStatus = error.response?.status;
      lastErrorMessage = upstreamStatus
        ? `Codeforces responded with status ${upstreamStatus} for ${candidateUrl}.`
        : `Could not reach ${candidateUrl}.`;
    }
  }

  throw new Error(lastErrorMessage);
}

async function resolveLeetCodeSlug(problemCode = "") {
  const trimmed = problemCode.trim();

  if (!trimmed) {
    throw new Error(
      "Add a LeetCode problem id like 1235 or a slug like two-sum.",
    );
  }

  if (/^[a-z0-9-]+$/i.test(trimmed) && /[a-z]/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Use a numeric LeetCode id like 1235 or a problem slug.");
  }

  const response = await axios.get("https://leetcode.com/api/problems/all/", {
    headers: {
      "User-Agent": "Mozilla/5.0 ForkSpace Problem Importer",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const matchingProblem = response.data?.stat_status_pairs?.find((item) => {
    const frontendId = String(item?.stat?.frontend_question_id || "");
    const questionId = String(item?.stat?.question_id || "");
    return frontendId === trimmed || questionId === trimmed;
  });

  if (!matchingProblem?.stat?.question__title_slug) {
    throw new Error(`LeetCode problem ${trimmed} was not found.`);
  }

  return matchingProblem.stat.question__title_slug;
}

async function importLeetCodeProblem(problemCode, sourceUrl = "") {
  const slug = await resolveLeetCodeSlug(problemCode);
  const nextSourceUrl = sourceUrl || `https://leetcode.com/problems/${slug}/`;
  const response = await axios.post(
    "https://leetcode.com/graphql/",
    {
      query: `
        query problemImport($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            title
            content
            exampleTestcases
          }
        }
      `,
      variables: {
        titleSlug: slug,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        Referer: nextSourceUrl,
        "User-Agent": "Mozilla/5.0 ForkSpace Problem Importer",
      },
    },
  );

  const question = response.data?.data?.question;

  if (!question) {
    throw new Error("Failed to fetch the LeetCode problem details.");
  }

  return {
    platform: "leetcode",
    problemCode: problemCode.trim(),
    problemUrl: nextSourceUrl,
    sourceUrl: nextSourceUrl,
    title: question.title || `LeetCode ${problemCode.trim()}`,
    prompt: stripHtml(question.content || ""),
    sampleInput: (question.exampleTestcases || "").replace(/\r/g, "").trim(),
    sampleOutput: extractLeetCodeExampleOutputs(question.content || ""),
    samples: buildSamplesFromJoinedText(
      question.exampleTestcases || "",
      extractLeetCodeExampleOutputs(question.content || ""),
    ),
  };
}

async function importProblemFromUrl(problemUrl) {
  let metadata;

  try {
    metadata = deriveProblemMetadataFromUrl(problemUrl);
  } catch {
    throw new Error("Enter a valid Codeforces or LeetCode problem URL.");
  }

  if (metadata.platform === "codeforces") {
    return importCodeforcesProblem(metadata.problemCode, metadata.problemUrl);
  }

  return importLeetCodeProblem(metadata.problemCode, metadata.problemUrl);
}

function importProblemFromText(statement = "") {
  const normalizedStatement = normalizeWhitespace(statement);

  if (!normalizedStatement) {
    throw new Error("Paste a problem statement before parsing.");
  }

  const samples = parseExamplesFromText(normalizedStatement);

  return attachNormalizedSamples({
    title: inferTitleFromStatement(normalizedStatement),
    prompt: normalizedStatement,
    pastedStatement: normalizedStatement,
    sampleInput: samples.map((sample) => sample.input).join("\n\n"),
    sampleOutput: samples.map((sample) => sample.output).join("\n\n"),
    samples,
  });
}

app.post("/api/ai-hint", aiLimiter, async (req, res) => {
  try {
    const { prompt, suffix } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const mistralApiKey = getMistralApiKey();
    const geminiApiKey = getGeminiApiKey();

    if (!mistralApiKey && !geminiApiKey) {
      return res.json({
        hint: buildFallbackHint(prompt, suffix),
        source: "fallback",
      });
    }

    let hint;
    if (geminiApiKey) {
      const fullPrompt = `Based on this code context, provide a single, very short code completion (just the next few characters or line).
Code before cursor:
${prompt}
Code after cursor:
${suffix}
Return ONLY the completion text, no explanation.`;
      hint = (
        await generateWithGemini(fullPrompt, geminiApiKey, {
          temperature: 0.2,
          maxOutputTokens: 128,
        })
      ).text;
    } else {
      const response = await axios.post(
        "https://api.mistral.ai/v1/fim/completions",
        {
          model: "codestral-latest",
          prompt,
          suffix: suffix || "",
          max_tokens: 128,
          temperature: 0.2,
          stop: ["\n\n"],
        },
        {
          headers: {
            Authorization: `Bearer ${mistralApiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 8000,
        },
      );
      hint = extractAiText(response.data);
    }

    return res.json({
      hint: hint || buildFallbackHint(prompt, suffix),
      source: hint ? (geminiApiKey ? "gemini" : "mistral") : "fallback",
    });
  } catch (error) {
    return res.json({
      hint: buildFallbackHint(req.body?.prompt, req.body?.suffix),
      source: "fallback",
      warning:
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to fetch AI hint",
    });
  }
});

app.post("/api/ai-hints", aiLimiter, async (req, res) => {
  try {
    const { code, beforeCursor, afterCursor } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing code", hints: [] });
    }

    const mistralApiKey = getMistralApiKey();
    const geminiApiKey = getGeminiApiKey();

    if (!mistralApiKey && !geminiApiKey) {
      return res.json({
        hints: buildFallbackHints(code, beforeCursor, afterCursor),
        source: "fallback",
      });
    }

    const suggestions = [];

    if (geminiApiKey) {
      const prompt = `Code:\n${code}\n\nBefore cursor:\n${beforeCursor}\n\nAfter cursor:\n${afterCursor}\n\nBased on the current code and cursor position, provide 3-5 short, helpful DSA-oriented code completion suggestions or hints. Keep them very brief and in a plain JSON array format like ["hint1", "hint2"]. Do not include markdown or explanations.`;
      const review = (
        await generateWithGemini(prompt, geminiApiKey, {
          temperature: 0.3,
          maxOutputTokens: 256,
        })
      ).text;
      try {
        // More robust JSON extraction for AI responses that might include markdown
        const jsonStart = review.indexOf("[");
        const jsonEnd = review.lastIndexOf("]") + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonText = review.substring(jsonStart, jsonEnd);
          const parsed = JSON.parse(jsonText);
          if (Array.isArray(parsed)) {
            suggestions.push(
              ...parsed.filter((s) => typeof s === "string" && s.trim()),
            );
          }
        } else if (review.trim()) {
          // Fallback: treat the whole response as one hint if no array found
          suggestions.push(review.trim().split("\n")[0]);
        }
      } catch (err) {
        console.error("AI hints parse error:", err.message);
        if (review && review.length < 200) suggestions.push(review.trim());
      }
    } else if (mistralApiKey) {
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
              Authorization: `Bearer ${mistralApiKey}`,
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

      const response = await axios.post(
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
            Authorization: `Bearer ${mistralApiKey}`,
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

    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 5);

    return res.json({
      hints:
        uniqueSuggestions.length > 0
          ? uniqueSuggestions
          : buildFallbackHints(code, beforeCursor, afterCursor),
      source:
        uniqueSuggestions.length > 0
          ? geminiApiKey
            ? "gemini"
            : "mistral"
          : "fallback",
    });
  } catch (error) {
    const errorMsg =
      error.response?.data?.error?.message || error.message || "Unknown error";
    console.error("AI hints error:", errorMsg);
    return res.json({
      warning: errorMsg,
      hints: buildFallbackHints(
        req.body?.code,
        req.body?.beforeCursor,
        req.body?.afterCursor,
      ),
      source: "fallback",
    });
  }
});

app.post("/api/ai/review", aiLimiter, async (req, res) => {
  const { code, problem, language, roomId: reviewRoomId = "" } = req.body || {};
  const reviewUser = await getUserFromAuthHeader(req);
  const mistralKey = getMistralApiKey();
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();

  if (!code) return res.status(400).json({ error: "Missing code" });
  if (!mistralKey && !geminiKey && !groqKey) {
    return res.status(503).json({
      error:
        "AI services are not configured. Please add GEMINI_API_KEY, GROQ_API_KEY, or MISTRAL_API_KEY to your .env file.",
    });
  }

  const prompt = `Review this solution for the problem: "${problem?.title || "Untitled"}".
Problem Description: ${problem?.prompt || problem?.pastedStatement || "No description provided."}
Constraints: ${problem?.constraints || "No constraints provided."}
Language: ${language}

Return ONLY valid JSON with this exact shape:
{
  "bugs": ["bug description 1", "bug description 2"],
  "time_complexity": "O(n)",
  "space_complexity": "O(1)",
  "complexity_reasoning": "why those complexities apply in 1-2 sentences",
  "style_issues": ["issue 1"],
  "optimization_suggestion": {
    "before": "what is inefficient now",
    "after": "what to change",
    "benefit": "why it improves the solution"
  },
  "summary": "one sentence overall assessment"
}

Code to review:
\`\`\`${language}
${code}
\`\`\``;

  const toFriendlyAiError = (value = "") => {
    const text = String(value || "");
    if (/quota exceeded|rate.?limit|429/i.test(text)) {
      return "The AI provider is temporarily out of quota. Try again shortly or configure another provider.";
    }
    return text || "Unknown error";
  };

  try {
    let review;
    // Priority: Groq -> Gemini -> Mistral
    if (groqKey) {
      try {
        review = await getAiReview(prompt, groqKey, "groq");
      } catch {
        console.warn("Groq failed, falling back to other AI if available");
      }
    }

    if (!review && geminiKey) {
      try {
        review = await getAiReview(prompt, geminiKey, "gemini");
      } catch {
        console.warn("Gemini failed, falling back to Mistral if available");
      }
    }

    if (!review && mistralKey) {
      review = await getAiReview(prompt, mistralKey, "mistral");
    }

    if (!review) {
      return res.status(500).json({
        error:
          "All configured AI providers failed or returned an empty response. This might be due to safety filters or service issues.",
      });
    }

    // Try to extract JSON if AI wrapped it in markdown
    let jsonResponse;
    try {
      const jsonStart = review.indexOf("{");
      const jsonEnd = review.lastIndexOf("}") + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonResponse = JSON.parse(review.substring(jsonStart, jsonEnd));
      } else {
        jsonResponse = JSON.parse(review);
      }
    } catch {
      // Fallback if not JSON
      jsonResponse = {
        bugs: [],
        time_complexity: "N/A",
        space_complexity: "N/A",
        complexity_reasoning: "",
        style_issues: [],
        optimization_suggestion: null,
        summary: review,
      };
    }

    if (reviewRoomId && reviewUser) {
      const rs = getOrCreateRoomState(reviewRoomId);
      ensureIntelligenceSession(rs);
      const sid = rs.session.intelligenceSessionId;
      if (sid) {
        const issueLabels = deriveIssueLabelsFromReview(jsonResponse);
        void appendIntelligenceEvent(
          isDatabaseConnected,
          sid,
          reviewRoomId,
          buildProblemSnapshot(rs.problem),
          {
            type: "ai_review",
            userId: String(reviewUser._id),
            username: reviewUser.name || "User",
            socketId: "",
            payload: {
              ...jsonResponse,
              issueLabels,
            },
          },
        );
      }
    }

    res.json(jsonResponse);
  } catch (error) {
    const errorMsg = toFriendlyAiError(
      error.response?.data?.error?.message || error.message || "Unknown error",
    );
    console.error("AI review error:", errorMsg);
    res.status(500).json({
      error: `AI Review failed: ${errorMsg}. Please check your API key and connection.`,
    });
  }
});

async function handleStandaloneAnalysis(req, res) {
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
        "AI services are not configured. Please add GEMINI_API_KEY, GROQ_API_KEY, or MISTRAL_API_KEY to your .env file.",
    });
  }

  const analysisPrompt = buildAnalysisPrompt({
    code,
    language,
    problemContext: effectiveProblemContext,
  });

  const toFriendlyAiError = (value = "") => {
    const text = String(value || "");
    if (/quota exceeded|rate.?limit|429/i.test(text)) {
      return "The configured AI provider is out of quota right now. Try again shortly or configure another provider.";
    }
    return text || "Unknown error";
  };

  try {
    let lastRawResponse = "";
    const analysisProviders = [
      ["groq", groqKey],
      ["gemini", geminiKey],
      ["mistral", mistralKey],
    ].filter(([, key]) => Boolean(key));

    for (const [provider, key] of analysisProviders) {
      try {
        const review = await getAiReview(analysisPrompt, key, provider);
        if (!review) continue;
        lastRawResponse = review;

        try {
          const parsed = parseAnalysisResponse({
            responseText: review,
            code,
            language,
            problemContext: effectiveProblemContext,
            provider,
          });

          if (isUsableAnalysis(parsed)) {
            return res.status(200).json(parsed);
          }
        } catch {
          console.warn(
            `${provider} returned non-JSON analysis, trying next provider`,
          );
        }
      } catch {
        console.warn(`${provider} failed for analysis, falling back`);
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
    const errorMsg = toFriendlyAiError(
      error.response?.data?.error?.message || error.message || "Unknown error",
    );
    console.error("Standalone analysis error:", errorMsg);
    return res.status(500).json({
      error: "Analysis failed",
      raw: errorMsg,
    });
  }
}

app.post("/api/analyse", aiLimiter, handleStandaloneAnalysis);
app.post("/api/analysis", aiLimiter, handleStandaloneAnalysis);

app.post("/api/analysis/save", async (req, res) => {
  const {
    code = "",
    language = DEFAULT_LANGUAGE,
    problemContext = "",
    result = null,
  } = req.body || {};

  if (!code.trim() || !result || typeof result !== "object") {
    return res.status(400).json({ error: "Missing analysis payload" });
  }

  try {
    const analysis = await Analysis.create({
      code,
      language,
      prompt: problemContext,
      result,
    });

    return res.status(201).json({ id: analysis._id.toString() });
  } catch (error) {
    return res.status(500).json({ error: "Failed to save analysis" });
  }
});

app.get("/api/analysis/:analysisId", async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.analysisId).lean();
    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    res.json({
      analysis: {
        id: analysis._id.toString(),
        code: analysis.code,
        language: analysis.language,
        prompt: analysis.prompt,
        result: analysis.result,
        createdAt: analysis.createdAt,
      },
    });
  } catch {
    res.status(404).json({ error: "Analysis not found" });
  }
});

app.post("/api/mock-summary", async (req, res) => {
  const { roomId = "", summary = null } = req.body || {};

  if (!roomId.trim() || !summary || typeof summary !== "object") {
    return res.status(400).json({ error: "Missing room summary payload" });
  }

  try {
    const record = await MockSummary.create({
      roomId: roomId.trim(),
      summary,
    });

    res.status(201).json({
      summaryId: record._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to save mock summary" });
  }
});

app.get("/api/mock-summary/:summaryId", async (req, res) => {
  try {
    const summary = await MockSummary.findById(req.params.summaryId).lean();
    if (!summary) {
      return res.status(404).json({ error: "Summary not found" });
    }

    res.json({
      summary: {
        id: summary._id.toString(),
        roomId: summary.roomId,
        createdAt: summary.createdAt,
        ...summary.summary,
      },
    });
  } catch {
    res.status(404).json({ error: "Summary not found" });
  }
});

app.post("/api/problem-import", async (req, res) => {
  try {
    const {
      platform = "custom",
      problemCode = "",
      sourceUrl = "",
    } = req.body || {};

    if (!problemCode.trim()) {
      return res
        .status(400)
        .json({ error: "Add a problem code before importing." });
    }

    let importedProblem = null;

    if (platform === "codeforces") {
      importedProblem = await importCodeforcesProblem(problemCode, sourceUrl);
    } else if (platform === "leetcode") {
      importedProblem = await importLeetCodeProblem(problemCode, sourceUrl);
    } else {
      return res.status(400).json({
        error:
          "Automatic import is supported for Codeforces and LeetCode right now.",
      });
    }

    return res.json({ problem: importedProblem });
  } catch (error) {
    return res.status(502).json({
      error: error.message || "Failed to import the problem details.",
    });
  }
});

app.post("/api/problem-import-text", async (req, res) => {
  try {
    const { statement = "" } = req.body || {};
    const problem = importProblemFromText(statement);

    return res.json({ problem });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Failed to parse the pasted statement.",
    });
  }
});

function encodeBase64Utf8(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeBase64Utf8(value) {
  return Buffer.from(value, "base64").toString("utf8");
}

function getJudge0Config() {
  const apiUrl = (process.env.JUDGE0_API_URL || "").trim();
  const apiKey = (process.env.JUDGE0_API_KEY || "").trim();
  const usingRapidApi = /rapidapi\.com/i.test(apiUrl);
  const normalizedKey = apiKey.toLowerCase();
  const keyLooksPlaceholder =
    !apiKey ||
    ["n", "na", "none", "null", "undefined"].includes(normalizedKey) ||
    normalizedKey.includes("your_");

  if (!apiUrl) {
    return { ok: false, error: "JUDGE0_API_URL is missing" };
  }

  if (usingRapidApi && keyLooksPlaceholder) {
    return {
      ok: false,
      error:
        "Judge0 RapidAPI key is missing or invalid. Set a real JUDGE0_API_KEY in Render env.",
    };
  }

  return {
    ok: true,
    apiUrl,
    apiKey,
    usingRapidApi,
  };
}

function extractUpstreamError(error, fallbackMessage = "Request failed") {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData.trim();
  }

  if (responseData && typeof responseData === "object") {
    const primaryMessage =
      responseData.error ||
      responseData.message ||
      responseData.detail ||
      responseData.details;
    if (typeof primaryMessage === "string" && primaryMessage.trim()) {
      return primaryMessage.trim();
    }
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (error?.response?.status) {
    return `${fallbackMessage} (upstream status ${error.response.status})`;
  }

  return fallbackMessage;
}

async function executeSubmission({
  code,
  stdin = "",
  languageId = getLanguageConfig(DEFAULT_LANGUAGE).id,
}) {
  const judge0 = getJudge0Config();
  if (!judge0.ok) {
    throw new Error(judge0.error);
  }

  const createOptions = (useBase64 = false) => ({
    method: "POST",
    url: `${judge0.apiUrl}/submissions`,
    params: {
      ...(useBase64 ? { base64_encoded: "true" } : {}),
      wait: "true",
      fields: "*",
    },
    headers: {
      "Content-Type": "application/json",
      ...(judge0.usingRapidApi
        ? {
            "x-rapidapi-key": judge0.apiKey,
            "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
          }
        : {}),
    },
    data: {
      language_id: languageId,
      source_code: useBase64 ? encodeBase64Utf8(code) : code,
      stdin: useBase64 ? encodeBase64Utf8(stdin) : stdin,
    },
  });

  let response;

  try {
    response = await axios.request(createOptions(false));
  } catch (error) {
    const apiError = error.response?.data?.error;
    const shouldRetryWithBase64 =
      typeof apiError === "string" &&
      apiError.includes("use base64_encoded=true");

    if (!shouldRetryWithBase64) {
      throw error;
    }

    response = await axios.request(createOptions(true));
  }

  const usedBase64 = response.config?.params?.base64_encoded === "true";
  const payload = response.data;

  return {
    ...payload,
    stdout:
      usedBase64 && payload.stdout
        ? decodeBase64Utf8(payload.stdout)
        : payload.stdout,
    stderr:
      usedBase64 && payload.stderr
        ? decodeBase64Utf8(payload.stderr)
        : payload.stderr,
    compile_output:
      usedBase64 && payload.compile_output
        ? decodeBase64Utf8(payload.compile_output)
        : payload.compile_output,
    message:
      usedBase64 && payload.message
        ? decodeBase64Utf8(payload.message)
        : payload.message,
  };
}

app.post("/api/run-code", async (req, res) => {
  const {
    code,
    stdin = "",
    languageId = getLanguageConfig(DEFAULT_LANGUAGE).id,
    roomId = "",
  } = req.body;
  const supportedLanguageIds = new Set(
    Object.values(SUPPORTED_LANGUAGES).map(({ id }) => id),
  );
  const authenticatedUser = await getUserFromAuthHeader(req);

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  if (!supportedLanguageIds.has(languageId)) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  const judge0 = getJudge0Config();
  if (!judge0.ok) {
    return res.status(503).json({ error: judge0.error });
  }

  try {
    const execution = await executeSubmission({ code, stdin, languageId });

    if (authenticatedUser) {
      const roomState = roomId ? getOrCreateRoomState(roomId) : null;
      await appendRunHistory(authenticatedUser._id, {
        roomId: roomId || null,
        languageId,
        languageLabel:
          Object.values(SUPPORTED_LANGUAGES).find(
            (language) => language.id === languageId,
          )?.label || "Unknown",
        problemTitle: roomState?.problem?.title || "Untitled Practice Problem",
        problemCode: roomState?.problem?.problemCode || "",
        status: execution.compile_output
          ? "compile_error"
          : execution.stderr
            ? "runtime_error"
            : "completed",
      });
    }

    return res.json(execution);
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error: extractUpstreamError(error, "Error running code"),
    });
  }
});

app.post("/api/run-sample-suite", async (req, res) => {
  const {
    code,
    languageId = getLanguageConfig(DEFAULT_LANGUAGE).id,
    samples = [],
  } = req.body || {};
  const supportedLanguageIds = new Set(
    Object.values(SUPPORTED_LANGUAGES).map(({ id }) => id),
  );
  const authenticatedUser = await getUserFromAuthHeader(req);
  const roomId = req.body?.roomId || "";

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  if (!supportedLanguageIds.has(languageId)) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  if (!Array.isArray(samples) || samples.length === 0) {
    return res
      .status(400)
      .json({ error: "No sample tests are available for this problem yet." });
  }

  const judge0 = getJudge0Config();
  if (!judge0.ok) {
    return res.status(503).json({ error: judge0.error });
  }

  try {
    const results = [];

    for (const [index, sample] of samples.entries()) {
      const execution = await executeSubmission({
        code,
        stdin: sample.input || "",
        languageId,
      });

      results.push({
        id: sample.id || `sample-${index + 1}`,
        index: index + 1,
        input: sample.input || "",
        expectedOutput: sample.output || "",
        actualOutput: execution.stdout || "",
        passed:
          !execution.compile_output &&
          !execution.stderr &&
          normalizeForComparison(execution.stdout || "") ===
            normalizeForComparison(sample.output || ""),
        time: execution.time || null,
        memory: execution.memory || null,
        compile_output: execution.compile_output || "",
        stderr: execution.stderr || "",
        message: execution.message || "",
      });

      if (execution.compile_output) {
        break;
      }
    }

    if (authenticatedUser) {
      const roomState = roomId ? getOrCreateRoomState(roomId) : null;
      await appendRunHistory(authenticatedUser._id, {
        roomId: roomId || null,
        languageId,
        languageLabel:
          Object.values(SUPPORTED_LANGUAGES).find(
            (language) => language.id === languageId,
          )?.label || "Unknown",
        problemTitle: roomState?.problem?.title || "Untitled Practice Problem",
        problemCode: roomState?.problem?.problemCode || "",
        status: results.every((result) => result.passed)
          ? "samples_passed"
          : "samples_failed",
      });

      if (roomId && roomState) {
        ensureIntelligenceSession(roomState);
        const sid = roomState.session.intelligenceSessionId;
        const summary = {
          total: results.length,
          passed: results.filter((result) => result.passed).length,
          failed: results.filter((result) => !result.passed).length,
        };
        void appendIntelligenceEvent(
          isDatabaseConnected,
          sid,
          roomId,
          buildProblemSnapshot(roomState.problem),
          {
            type: "submit_samples",
            userId: String(authenticatedUser._id),
            username: authenticatedUser.name || "User",
            socketId: "",
            payload: {
              summary,
              allPassed: results.every((result) => result.passed),
              compileHalt: results.some((result) => result.compile_output),
            },
          },
        );
      }
    }

    return res.json({
      results,
      summary: {
        total: results.length,
        passed: results.filter((result) => result.passed).length,
        failed: results.filter((result) => !result.passed).length,
      },
    });
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error: extractUpstreamError(error, "Error running the sample suite"),
    });
  }
});

async function enrichReportWithHiddenTestSignals({
  roomId,
  sessionId,
  report,
}) {
  if (!isDatabaseConnected() || !report) return report;
  try {
    const rows = await HiddenTest.find({
      roomId,
      sessionId,
      bugClass: {
        $in: ["off-by-one", "overflow", "empty case", "wrong loop bounds"],
      },
      $or: [
        { passed: false },
        { timedOut: true },
        { runtimeError: true },
        { suspiciousOutput: true },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(48)
      .lean();
    if (!rows.length) return report;

    const counts = {};
    for (const row of rows) {
      const key = row.bugClass || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    }
    const repeated = Object.entries(counts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);
    if (!repeated.length) return report;

    const [topBug, topCount] = repeated[0];
    const hiddenSignal = `Hidden tests indicate repeated ${topBug} issues (${topCount} occurrences).`;
    return {
      ...report,
      biggestGaps: [
        ...new Set([...(report.biggestGaps || []), hiddenSignal]),
      ].slice(0, 5),
      nextSteps: [
        ...new Set([
          ...(report.nextSteps || []),
          `Target ${topBug} by adding one dedicated boundary case before each submit.`,
        ]),
      ].slice(0, 5),
    };
  } catch {
    return report;
  }
}

app.post("/api/session-intelligence/report", async (req, res) => {
  const user = await getUserFromAuthHeader(req);
  const {
    roomId,
    endSession = false,
    saveShare = true,
    personal,
    endReason = "session_end",
  } = req.body || {};
  /* personal: omit or true = only this user's events when signed in; false / "all" = whole room */

  if (!roomId) {
    return res.status(400).json({ error: "Missing roomId" });
  }

  const roomState = getOrCreateRoomState(roomId);
  ensureIntelligenceSession(roomState);
  const sessionId = roomState.session.intelligenceSessionId;
  const logDoc = await fetchIntelligenceLog(isDatabaseConnected, sessionId);

  if (!logDoc || !Array.isArray(logDoc.events) || logDoc.events.length === 0) {
    return res.status(400).json({
      error:
        "No session intelligence data yet. Run code, submit samples against parsed tests, or run a signed-in solution review first.",
    });
  }

  const usePersonal = Boolean(user) && personal !== "all" && personal !== false;
  const filter = usePersonal
    ? { userId: String(user._id), username: user.name }
    : {};

  let report = aggregateSessionReport(logDoc, filter);
  report = await enrichReportWithHiddenTestSignals({
    roomId,
    sessionId,
    report,
  });
  let previousReport = null;
  if (user?._id) {
    const existingReports = await listReportsForUser(
      isDatabaseConnected,
      String(user._id),
    );
    previousReport = existingReports?.[0]?.report || null;
  }
  let shareId = null;
  if (saveShare !== false && saveShare !== "false") {
    shareId = await saveShareableReport(isDatabaseConnected, {
      userId: user?._id ? String(user._id) : "",
      roomId,
      sessionId,
      problemTitle: report.problemTitle,
      report,
    });
  }

  let newTitle = null;
  if (user) {
    const today = new Date();
    const priorDate = user.lastActiveDate
      ? new Date(user.lastActiveDate)
      : null;
    const diffDays = priorDate
      ? Math.floor(
          (Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
          ) -
            Date.UTC(
              priorDate.getUTCFullYear(),
              priorDate.getUTCMonth(),
              priorDate.getUTCDate(),
            )) /
            86400000,
        )
      : null;
    const nextStreak =
      diffDays === null
        ? 1
        : diffDays === 0
          ? Math.max(1, user.currentStreak || 1)
          : diffDays === 1
            ? (user.currentStreak || 0) + 1
            : 1;
    const solvedScore = Number(report.sessionScore || 0);
    const cfProblemRating =
      Number(report.problemRating || roomState?.problem?.rating || 0) || 0;
    const solvedInMinutes = report.stats?.firstSubmitMs
      ? Math.round(report.stats.firstSubmitMs / 60000)
      : null;
    const halfTimeLimitMinutes =
      Number(roomState?.problem?.timeLimitMinutes || 0) / 2 || null;
    const timeBonus =
      halfTimeLimitMinutes &&
      solvedInMinutes &&
      solvedInMinutes <= halfTimeLimitMinutes
        ? 10
        : 0;
    const cfBonus = cfProblemRating >= 1600 ? 25 : 0;
    user.forkspaceRating = clampNumber(
      Math.round(
        (user.forkspaceRating || 1000) +
          (solvedScore - 60) * 1.5 +
          cfBonus +
          timeBonus,
      ),
      600,
      3000,
    );
    user.totalSessions = (user.totalSessions || 0) + 1;
    user.problemsAttempted = (user.problemsAttempted || 0) + 1;
    user.currentStreak = nextStreak;
    user.lastActiveDate = today;
    user.activityLog = [
      ...(user.activityLog || []),
      { date: today, sessionId },
    ].slice(-84);
    await user.save();
    const awarded = await checkAndAwardTitles(String(user._id), {
      solvedInMinutes,
      cfProblemRating,
    });
    newTitle = awarded.newTitle;
  }

  if (endSession === true || endSession === "true") {
    await markIntelligenceSessionEnded(
      isDatabaseConnected,
      sessionId,
      roomId,
      endReason,
    );
    roomState.session = attachNormalizedSession({
      ...roomState.session,
      intelligenceSessionId: crypto.randomUUID(),
      intelligenceStartedAt: new Date().toISOString(),
    });
    scheduleRoomStatePersist();
    persistRoomDocument(roomId, roomState);
    io.to(roomId).emit("session-update", { session: roomState.session });
  }

  return res.json({
    report,
    shareId,
    sessionId,
    previousReport,
    newTitle,
    user: user ? buildUserPayload(user) : null,
  });
});

app.get("/api/session-intelligence/report/:shareId", async (req, res) => {
  const doc = await getReportByShareId(isDatabaseConnected, req.params.shareId);
  if (!doc) {
    return res.status(404).json({ error: "Report not found" });
  }
  let previousReport = null;
  if (doc.userId) {
    const rows = await listReportsForUser(
      isDatabaseConnected,
      String(doc.userId),
    );
    previousReport =
      rows.find((row) => row.shareId !== doc.shareId)?.report || null;
  }
  return res.json({
    shareId: doc.shareId,
    problemTitle: doc.problemTitle,
    report: doc.report,
    previousReport,
    createdAt: doc.createdAt,
  });
});

app.get("/api/session-intelligence/my-reports", async (req, res) => {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const rows = await listReportsForUser(isDatabaseConnected, String(user._id));
  return res.json({
    reports: rows.map((r) => ({
      shareId: r.shareId,
      problemTitle: r.problemTitle,
      sessionId: r.sessionId,
      roomId: r.roomId,
      sessionScore: r.report?.sessionScore,
      createdAt: r.createdAt,
    })),
  });
});

app.post("/api/session-card/generate", async (req, res) => {
  const { roomId = "" } = req.body || {};
  if (!String(roomId).trim()) {
    return res.status(400).json({ error: "Missing roomId" });
  }

  const latestReport = await getLatestReportForRoom(
    isDatabaseConnected,
    String(roomId).trim(),
  );
  if (!latestReport?.report) {
    return res.status(400).json({
      error:
        "No session report available yet for this room. Generate a report first.",
    });
  }

  const card = generateSessionCard(latestReport);
  let shareId = card.shareId;

  if (isDatabaseConnected()) {
    try {
      await SessionCard.create(card);
    } catch {
      shareId = `${card.shareId}-${Date.now().toString(36).slice(-3)}`;
      await SessionCard.create({ ...card, shareId });
    }
  } else {
    memorySessionCards.set(shareId, {
      ...card,
      shareId,
      createdAt: new Date().toISOString(),
    });
  }

  return res.json({ shareId });
});

app.get("/api/session-card/:shareId", async (req, res) => {
  const { shareId = "" } = req.params;
  if (!shareId.trim()) {
    return res.status(400).json({ error: "Missing shareId" });
  }

  if (isDatabaseConnected()) {
    const doc = await SessionCard.findOne({ shareId: shareId.trim() }).lean();
    if (doc) return res.json({ card: doc });
  }

  const mem = memorySessionCards.get(shareId.trim());
  if (mem) return res.json({ card: mem });

  return res.status(404).json({ error: "Session card not found" });
});

app.get("/api/codeforces/problems", async (req, res) => {
  try {
    const { problems, source, stale, warning } =
      await loadCodeforcesCatalog(dataDirectory);
    const filtered = filterProblems(problems, req.query);
    return res.json({
      rows: filtered.rows,
      total: filtered.total,
      offset: filtered.offset,
      limit: filtered.limit,
      source,
      stale: Boolean(stale),
      warning: warning || undefined,
    });
  } catch (error) {
    console.error("[codeforces] list error:", error.message);
    return res.status(500).json({ error: error.message || "Catalog error" });
  }
});

app.get("/api/codeforces/problem/:internalProblemId", async (req, res) => {
  const rawId = req.params.internalProblemId || "";
  if (!parseInternalProblemId(rawId)) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  try {
    const normalized = await findNormalizedProblem(dataDirectory, rawId);
    if (!normalized) {
      return res.status(404).json({ error: "Problem not found in catalog" });
    }
    return res.json({ problem: normalized });
  } catch (error) {
    console.error("[codeforces] problem lookup:", error.message);
    return res.status(500).json({ error: error.message || "Lookup failed" });
  }
});

app.get("/api/rooms/:roomId/problem-snapshot", (req, res) => {
  const { roomId } = req.params;
  const roomState = roomStateMap.get(roomId);
  const snapshot = roomState?.problem?.problemSnapshot || null;
  return res.json({
    roomId,
    snapshot,
    sessionId: roomState?.session?.intelligenceSessionId || null,
  });
});

app.get("/api/rooms/new", (req, res) => {
  const roomId = createUniqueRoomId();
  getOrCreateRoomState(roomId);
  return res.json({ roomId });
});

app.post("/api/rooms/:roomId/problem-selection", async (req, res) => {
  const { roomId } = req.params;
  const { problemSource, internalProblemId } = req.body || {};

  try {
    const roomState = getOrCreateRoomState(roomId);
    ensureIntelligenceSession(roomState);
    const sessionId = roomState.session?.intelligenceSessionId || "";

    if (problemSource === "manual") {
      roomState.problem = attachNormalizedSamples({
        ...roomState.problem,
        problemSource: "manual",
        problemSnapshot: null,
      });
      scheduleRoomStatePersist();
      persistRoomDocument(roomId, roomState);
      io.to(roomId).emit("problem-update", { problem: roomState.problem });
      return res.json({ ok: true, problem: roomState.problem });
    }

    if (problemSource !== "codeforces" || !internalProblemId) {
      return res.status(400).json({
        error:
          'Set problemSource to "manual" or provide problemSource "codeforces" with internalProblemId.',
      });
    }

    const normalized = await findNormalizedProblem(
      dataDirectory,
      String(internalProblemId),
    );
    if (!normalized) {
      return res.status(404).json({
        error:
          "Problem not found in catalog. Try again when the API or cache is available.",
      });
    }

    const payload = buildRoomProblemPayloadFromCf(normalized, {
      roomId,
      sessionId,
    });

    roomState.problem = attachNormalizedSamples({
      ...roomState.problem,
      ...payload,
    });
    scheduleRoomStatePersist();
    persistRoomDocument(roomId, roomState);
    io.to(roomId).emit("problem-update", { problem: roomState.problem });

    return res.json({ ok: true, problem: roomState.problem });
  } catch (error) {
    console.error("[problem-selection]", error.message);
    return res
      .status(500)
      .json({ error: error.message || "Failed to apply problem selection" });
  }
});

// Socket.io connection handlers

const userSocketMap = {};
const USER_COLORS = [
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#f43f5e",
  "#a855f7",
  "#06b6d4",
];

function pickColorForRoom(roomId, currentSocketId) {
  const roomUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
    .filter((socketId) => socketId !== currentSocketId)
    .map((socketId) => userSocketMap[socketId])
    .filter(Boolean);
  const usedColors = new Set(
    roomUsers.map((user) => user.color).filter(Boolean),
  );
  const availableColor = USER_COLORS.find((color) => !usedColors.has(color));
  return availableColor || USER_COLORS[roomUsers.length % USER_COLORS.length];
}

function getUsersInRoom(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId]?.username,
        role: userSocketMap[socketId]?.role || "Peer",
        avatarId: userSocketMap[socketId]?.avatarId || "clever-fox",
        color: userSocketMap[socketId]?.color || USER_COLORS[0],
        isOnline: true,
      };
    },
  );
}

io.on("connection", (socket) => {
  // console.log('socket connected', socket.id); // remove in prod

  socket.on(
    "join",
    async ({ roomId, username, role, authToken, sessionMode, avatarId }) => {
      let roomState = roomStateMap.get(roomId);

      if (!roomState) {
        try {
          if (!isDatabaseConnected()) {
            roomState = getOrCreateRoomState(roomId);
          } else {
            const savedRoom = await Room.findOne({ roomId });
            if (savedRoom) {
              roomState = {
                ...createDefaultRoomState(),
                code: savedRoom.code,
                language: savedRoom.language,
              };
              roomStateMap.set(roomId, roomState);
            } else {
              roomState = getOrCreateRoomState(roomId);
            }
          }
        } catch (err) {
          console.error("Error fetching room from MongoDB:", err);
          roomState = getOrCreateRoomState(roomId);
        }
      }

      const authPayload = authToken ? safeVerifyJwt(authToken) : null;
      let authenticatedUser = null;
      if (authPayload?.userId && isDatabaseConnected()) {
        authenticatedUser = await User.findById(authPayload.userId);
      }
      const resolvedUsername = authenticatedUser?.name || username;

      userSocketMap[socket.id] = {
        username: resolvedUsername,
        role: role || "Peer",
        avatarId: authenticatedUser?.avatarId || avatarId || "clever-fox",
        color: pickColorForRoom(roomId, socket.id),
        userId: authenticatedUser?._id || null,
      };
      socket.join(roomId);

      if (sessionMode && roomState.session.mode !== sessionMode) {
        roomState.session = attachNormalizedSession({
          ...roomState.session,
          mode: sessionMode,
        });
        scheduleRoomStatePersist();
      }

      ensureIntelligenceSession(roomState);

      const users = getUsersInRoom(roomId);

      users.forEach(({ socketId }) => {
        io.to(socketId).emit("joined", {
          users,
          username: resolvedUsername,
          role: userSocketMap[socket.id].role,
          socketId: socket.id,
        });
      });

      if (authenticatedUser) {
        upsertRecentRoom(authenticatedUser._id, {
          roomId,
          role: role || "Peer",
          username: resolvedUsername,
          problemTitle: roomState.problem?.title || "Untitled Practice Problem",
          problemCode: roomState.problem?.problemCode || "",
        });
      }

      socket.emit("room-state", roomState);
      socket.emit("user-color-assigned", {
        color: userSocketMap[socket.id].color,
      });
    },
  );

  socket.on("code-change", ({ roomId, code }) => {
    const roomState = getOrCreateRoomState(roomId);
    roomState.code = code;
    scheduleRoomStatePersist();
    socket.in(roomId).emit("code-change", { code });
  });

  socket.on("language-change", ({ roomId, language }) => {
    const roomState = getOrCreateRoomState(roomId);
    const nextLanguage = SUPPORTED_LANGUAGES[language]
      ? language
      : DEFAULT_LANGUAGE;

    roomState.language = nextLanguage;
    scheduleRoomStatePersist();

    io.to(roomId).emit("language-change", {
      language: nextLanguage,
    });
  });

  socket.on("problem-update", ({ roomId, problem }) => {
    const roomState = getOrCreateRoomState(roomId);
    const incoming = problem || {};
    const merged = {
      ...roomState.problem,
      ...incoming,
    };
    if (!Object.prototype.hasOwnProperty.call(incoming, "problemSnapshot")) {
      merged.problemSnapshot = roomState.problem?.problemSnapshot ?? null;
    }
    if (!Object.prototype.hasOwnProperty.call(incoming, "problemSource")) {
      merged.problemSource = roomState.problem?.problemSource ?? "manual";
    }
    roomState.problem = attachNormalizedSamples(merged);
    scheduleRoomStatePersist();
    persistRoomDocument(roomId, roomState);

    const authenticatedUsers = getUsersInRoom(roomId)
      .map((user) => userSocketMap[user.socketId]?.userId)
      .filter(Boolean);

    authenticatedUsers.forEach((userId) => {
      upsertRecentRoom(userId, {
        roomId,
        role: userSocketMap[socket.id]?.role || "Peer",
        username: userSocketMap[socket.id]?.username || "Anonymous",
        problemTitle: roomState.problem?.title || "Untitled Practice Problem",
        problemCode: roomState.problem?.problemCode || "",
      });
    });

    io.to(roomId).emit("problem-update", {
      problem: roomState.problem,
    });
  });

  socket.on("session-update", ({ roomId, session }) => {
    const roomState = getOrCreateRoomState(roomId);
    roomState.session = attachNormalizedSession({
      ...roomState.session,
      ...(session || {}),
    });
    scheduleRoomStatePersist();
    persistRoomDocument(roomId, roomState);

    io.to(roomId).emit("session-update", {
      session: roomState.session,
    });
  });

  socket.on("swap-roles", ({ roomId }) => {
    const roomState = getOrCreateRoomState(roomId);
    const { driverSocketId, navigatorSocketId } = roomState.session;

    roomState.session = attachNormalizedSession({
      ...roomState.session,
      driverSocketId: navigatorSocketId,
      navigatorSocketId: driverSocketId,
    });
    scheduleRoomStatePersist();
    persistRoomDocument(roomId, roomState);

    io.to(roomId).emit("session-update", {
      session: roomState.session,
    });
  });

  socket.on("run-history-update", ({ roomId, run }) => {
    const roomState = getOrCreateRoomState(roomId);
    const nextRun = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...(run || {}),
    };

    roomState.session.runHistory = [
      nextRun,
      ...roomState.session.runHistory,
    ].slice(0, 5);
    scheduleRoomStatePersist();
    persistRoomDocument(roomId, roomState);

    io.to(roomId).emit("session-update", {
      session: roomState.session,
    });
  });

  socket.on("cursor-move", ({ roomId, anchor, head }) => {
    if (!roomId || typeof anchor !== "number" || typeof head !== "number") {
      return;
    }

    socket.to(roomId).emit("remote-cursor-update", {
      socketId: socket.id,
      anchor,
      head,
      username: userSocketMap[socket.id]?.username || "Anonymous",
      color: userSocketMap[socket.id]?.color || USER_COLORS[0],
    });
  });

  socket.on(
    "run-code",
    async ({ roomId, code, languageId, stdin = "" }, callback) => {
      if (!roomId || !code) {
        callback?.({ ok: false, error: "Missing roomId or code" });
        return;
      }

      const supportedLanguageIds = new Set(
        Object.values(SUPPORTED_LANGUAGES).map(({ id }) => id),
      );
      if (!supportedLanguageIds.has(languageId)) {
        callback?.({ ok: false, error: "Unsupported language" });
        return;
      }
      const judge0 = getJudge0Config();
      if (!judge0.ok) {
        callback?.({ ok: false, error: judge0.error });
        return;
      }

      try {
        const execution = await executeSubmission({ code, stdin, languageId });
        const runBy = userSocketMap[socket.id]?.username || "Guest";
        const roomState = getOrCreateRoomState(roomId);
        ensureIntelligenceSession(roomState);
        const normalizedStdout = normalizeOutput(execution.stdout || "");
        const normalizedExpected = normalizeOutput(
          roomState?.problem?.sampleOutput || "",
        );
        const hasCompileError = Boolean(execution.compile_output);
        const hasRuntimeError = Boolean(execution.stderr);
        const sampleMatched =
          normalizedExpected &&
          !hasCompileError &&
          !hasRuntimeError &&
          normalizedStdout === normalizedExpected;
        const sampleMismatched =
          normalizedExpected &&
          !hasCompileError &&
          !hasRuntimeError &&
          normalizedStdout !== normalizedExpected;
        const runEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          status: hasCompileError
            ? "Compilation Error"
            : hasRuntimeError
              ? "Runtime Error"
              : "Completed",
          time: execution.time || "N/A",
          memory: execution.memory || "N/A",
          passed: sampleMatched,
          languageLabel:
            Object.values(SUPPORTED_LANGUAGES).find(
              (language) => language.id === languageId,
            )?.label || "Unknown",
          stdin,
          stdout: normalizedStdout,
          expectedOutput: normalizedExpected,
          sampleCheck: sampleMatched
            ? "passed"
            : sampleMismatched
              ? "mismatch"
              : "not_checked",
        };
        roomState.session.runHistory = [
          runEntry,
          ...roomState.session.runHistory,
        ].slice(0, 5);
        scheduleRoomStatePersist();

        const intelId = roomState.session.intelligenceSessionId;
        const runner = userSocketMap[socket.id];
        void appendIntelligenceEvent(
          isDatabaseConnected,
          intelId,
          roomId,
          buildProblemSnapshot(roomState.problem),
          {
            type: "run",
            userId: runner?.userId ? String(runner.userId) : "",
            username: runner?.username || "Guest",
            socketId: socket.id,
            payload: {
              errorType: hasCompileError
                ? "compile"
                : hasRuntimeError
                  ? "runtime"
                  : null,
              sampleCheck: runEntry.sampleCheck,
              status: runEntry.status,
              passed: sampleMatched,
              languageLabel: runEntry.languageLabel,
            },
          },
        );

        io.to(roomId).emit("run-result", {
          result: execution,
          runBy,
        });
        io.to(roomId).emit("session-update", {
          session: roomState.session,
        });

        callback?.({ ok: true });
      } catch (error) {
        const message = extractUpstreamError(error, "Error running code");
        callback?.({ ok: false, error: message });
        socket.emit("run-error", { error: message });
      }
    },
  );

  socket.on("intelligence-session-end", async ({ roomId, reason }) => {
    if (!roomId) return;
    const roomState = roomStateMap.get(roomId);
    const sid = roomState?.session?.intelligenceSessionId;
    if (!roomState || !sid) return;

    await markIntelligenceSessionEnded(
      isDatabaseConnected,
      sid,
      roomId,
      reason || "manual_end",
    );
    io.to(roomId).emit("intelligence-session-ended", {
      sessionId: sid,
      reason: reason || "manual_end",
    });
  });

  socket.on("disconnecting", async () => {
    const rooms = [...socket.rooms];
    for (const roomId of rooms) {
      const roomState = roomStateMap.get(roomId);

      if (roomState) {
        // Save to MongoDB on disconnect
        await persistRoomDocument(roomId, roomState);

        if (roomState.session) {
          const nextSession = attachNormalizedSession({
            ...roomState.session,
            driverSocketId:
              roomState.session.driverSocketId === socket.id
                ? ""
                : roomState.session.driverSocketId,
            navigatorSocketId:
              roomState.session.navigatorSocketId === socket.id
                ? ""
                : roomState.session.navigatorSocketId,
          });

          const sessionChanged =
            nextSession.driverSocketId !== roomState.session.driverSocketId ||
            nextSession.navigatorSocketId !==
              roomState.session.navigatorSocketId;

          if (sessionChanged) {
            roomState.session = nextSession;
            scheduleRoomStatePersist();
            socket.in(roomId).emit("session-update", {
              session: roomState.session,
            });
          }
        }

        socket.in(roomId).emit("left", {
          socketId: socket.id,
          username: userSocketMap[socket.id]?.username,
        });
        socket.in(roomId).emit("user-left", {
          socketId: socket.id,
        });
      }
    }
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 5000;

await loadPersistedRoomStates();
await loadPersistedUserState();
await loadIntelligenceLogsFromFile();

process.on("SIGINT", async () => {
  await flushRoomStatePersist();
  await flushUserStatePersist();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await flushRoomStatePersist();
  await flushUserStatePersist();
  process.exit(0);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT} (host 0.0.0.0)`);
  console.log(`Socket origins: ${allowedOrigins.join(", ")}`);
  const judge0 = getJudge0Config();
  console.log(
    `Startup diagnostics -> Mongo: ${
      isDatabaseConnected() ? "connected" : "disconnected"
    }, Redis: ${redisUrl ? "configured" : "not configured"}, Judge0: ${
      judge0.ok ? "configured" : judge0.error
    }`,
  );
});
