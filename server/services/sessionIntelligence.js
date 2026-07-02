import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import process from "process";
import crypto from "crypto";
import SessionIntelligenceLog from "../models/SessionIntelligenceLog.js";
import SessionIntelligenceReport from "../models/SessionIntelligenceReport.js";

const MAX_EVENTS = 320;
const dataDirectory = path.join(process.cwd(), "server", "data");
const intelligenceLogFile = path.join(
  dataDirectory,
  "session-intelligence-logs.json",
);

/** In-memory + JSON file fallback when MongoDB is unavailable */
const memoryLogs = new Map();
let intelPersistTimer = null;

function scheduleIntelFilePersist() {
  if (intelPersistTimer) clearTimeout(intelPersistTimer);
  intelPersistTimer = setTimeout(() => {
    intelPersistTimer = null;
    persistMemoryLogsToFile().catch((err) =>
      console.error("Session intelligence file persist failed:", err.message),
    );
  }, 400);
}

async function persistMemoryLogsToFile() {
  await mkdir(dataDirectory, { recursive: true });
  const obj = Object.fromEntries(memoryLogs.entries());
  await writeFile(intelligenceLogFile, JSON.stringify(obj, null, 2), "utf8");
}

export async function loadIntelligenceLogsFromFile() {
  try {
    const raw = await readFile(intelligenceLogFile, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      Object.entries(parsed).forEach(([sessionId, doc]) => {
        if (doc && typeof doc === "object") memoryLogs.set(sessionId, doc);
      });
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Failed to load session intelligence logs file:", err.message);
    }
  }
}

export function buildProblemSnapshot(problem = {}) {
  const tags = Array.isArray(problem.tags)
    ? problem.tags
    : typeof problem.tags === "string" && problem.tags.trim()
      ? problem.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  return {
    title: problem.title || "Untitled Practice Problem",
    tags,
    rating: problem.rating || "",
    difficulty: problem.difficulty || problem.rating || "",
    problemCode: problem.problemCode || "",
    platform: problem.platform || "",
  };
}

export function deriveIssueLabelsFromReview(review = {}) {
  const labels = [];
  const blob = `${review.summary || ""} ${(review.bugs || []).join(" ")} ${review.complexity_reasoning || ""} ${(review.style_issues || []).join(" ")}`.toLowerCase();
  if (/\bedge\b|empty|null|boundary|off[- ]?by|one off|index/.test(blob)) {
    labels.push("edge_case");
  }
  if (/\bbrute\b|naive|o\(n\^2\)|quadratic|triple|try all/.test(blob)) {
    labels.push("brute_force");
  }
  if (/\boff[- ]?by|inclusive|exclusive|boundary|index error|length - 1/.test(blob)) {
    labels.push("off_by_one");
  }
  if (/\boverflow|64[- ]bit|long long|integer range/.test(blob)) {
    labels.push("numeric_limits");
  }
  if (/\btime limit|tle|too slow|complexity/.test(blob)) {
    labels.push("complexity");
  }
  return [...new Set(labels)];
}

function cloneDoc(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function upsertLogMongo(sessionId, roomId, mutator) {
  const existing = await SessionIntelligenceLog.findOne({ sessionId }).lean();
  const base = existing || {
    sessionId,
    roomId,
    problemSnapshot: {},
    startedAt: new Date(),
    endedAt: null,
    endReason: "",
    events: [],
  };
  const next = mutator(cloneDoc(base));
  next.events = (next.events || []).slice(-MAX_EVENTS);
  await SessionIntelligenceLog.findOneAndUpdate(
    { sessionId },
    { $set: next },
    { upsert: true, returnDocument: "after" },
  );
}

function upsertLogMemory(sessionId, roomId, mutator) {
  const existing = memoryLogs.get(sessionId) || {
    sessionId,
    roomId,
    problemSnapshot: {},
    startedAt: new Date().toISOString(),
    endedAt: null,
    endReason: "",
    events: [],
  };
  const next = mutator(cloneDoc(existing));
  next.events = (next.events || []).slice(-MAX_EVENTS);
  memoryLogs.set(sessionId, next);
  scheduleIntelFilePersist();
}

export async function appendIntelligenceEvent(
  isDatabaseConnected,
  sessionId,
  roomId,
  problemSnapshot,
  event,
) {
  if (!sessionId || !roomId) return;

  const normalized = {
    ...event,
    ts: new Date(),
    payload: event.payload || {},
  };

  const mutator = (doc) => {
    if (!doc.problemSnapshot || !Object.keys(doc.problemSnapshot).length) {
      doc.problemSnapshot = problemSnapshot || {};
    }
    doc.roomId = roomId;
    doc.events = [...(doc.events || []), normalized];
    return doc;
  };

  try {
    if (isDatabaseConnected()) {
      await upsertLogMongo(sessionId, roomId, mutator);
    } else {
      upsertLogMemory(sessionId, roomId, mutator);
    }
  } catch (err) {
    console.error("appendIntelligenceEvent:", err.message);
    upsertLogMemory(sessionId, roomId, mutator);
  }
}

export async function markIntelligenceSessionEnded(
  isDatabaseConnected,
  sessionId,
  roomId,
  reason,
) {
  if (!sessionId) return;
  const mutator = (doc) => {
    doc.endedAt = new Date().toISOString();
    doc.endReason = reason || "ended";
    doc.events = [
      ...(doc.events || []),
      {
        ts: new Date(),
        type: "session_end",
        userId: "",
        username: "",
        socketId: "",
        payload: { reason: reason || "ended" },
      },
    ];
    return doc;
  };

  try {
    if (isDatabaseConnected()) {
      await upsertLogMongo(sessionId, roomId, mutator);
    } else {
      upsertLogMemory(sessionId, roomId, mutator);
    }
  } catch (err) {
    console.error("markIntelligenceSessionEnded:", err.message);
    upsertLogMemory(sessionId, roomId, mutator);
  }
}

export async function fetchIntelligenceLog(isDatabaseConnected, sessionId) {
  if (isDatabaseConnected()) {
    try {
      const doc = await SessionIntelligenceLog.findOne({ sessionId }).lean();
      if (doc) return doc;
    } catch {
      /* fall through */
    }
  }
  return memoryLogs.get(sessionId) || null;
}

function filterEventsForUser(events, userId, username) {
  if (!userId && !username) return events;
  return events.filter((e) => {
    if (e.type === "session_end") return true;
    if (userId && e.userId && String(e.userId) === String(userId)) return true;
    if (username && e.username && e.username === username) return true;
    return false;
  });
}

function msSinceStart(startedAt, eventTs) {
  const t0 = startedAt ? new Date(startedAt).getTime() : null;
  const t1 = eventTs ? new Date(eventTs).getTime() : null;
  if (!t0 || !t1 || Number.isNaN(t0) || Number.isNaN(t1)) return null;
  return Math.max(0, t1 - t0);
}

export function aggregateSessionReport(logDoc, filter = {}) {
  const { userId = "", username = "" } = filter;
  const startedAt = logDoc.startedAt;
  const problem = logDoc.problemSnapshot || {};
  let events = Array.isArray(logDoc.events) ? logDoc.events : [];
  const personal = Boolean(userId || username);
  if (personal) {
    events = filterEventsForUser(events, userId, username);
  }

  const runs = events.filter((e) => e.type === "run");
  const submits = events.filter((e) => e.type === "submit_samples");
  const reviews = events.filter((e) => e.type === "ai_review");

  let firstRunMs = null;
  let firstSubmitMs = null;
  for (const e of events) {
    if (e.type === "run" && firstRunMs === null) {
      firstRunMs = msSinceStart(startedAt, e.ts);
    }
    if (e.type === "submit_samples" && firstSubmitMs === null) {
      firstSubmitMs = msSinceStart(startedAt, e.ts);
    }
  }

  let compileErrors = 0;
  let runtimeErrors = 0;
  let sampleMismatch = 0;
  let samplePass = 0;
  let runPass = 0;
  const mistakeCounts = {};

  for (const e of runs) {
    const err = e.payload?.errorType;
    if (err === "compile") compileErrors += 1;
    else if (err === "runtime") runtimeErrors += 1;
    else if (e.payload?.sampleCheck === "mismatch") sampleMismatch += 1;
    else if (e.payload?.sampleCheck === "passed") runPass += 1;
  }

  for (const e of submits) {
    const s = e.payload?.summary;
    if (s?.failed > 0) {
      mistakeCounts.sample_fail = (mistakeCounts.sample_fail || 0) + 1;
    }
    if (s?.passed === s?.total && s?.total > 0) samplePass += 1;
    if (e.payload?.compileHalt) compileErrors += 1;
  }

  const allLabels = [];
  for (const e of reviews) {
    const lab = e.payload?.issueLabels;
    if (Array.isArray(lab)) allLabels.push(...lab);
  }
  const labelCounts = {};
  for (const l of allLabels) {
    labelCounts[l] = (labelCounts[l] || 0) + 1;
  }

  const lastReview = reviews[reviews.length - 1]?.payload || {};
  const complexityGuess =
    lastReview.time_complexity ||
    lastReview.timeComplexity ||
    (reviews.length ? "see_review" : "unknown");

  const totalAttempts = runs.length + submits.length;
  const failSignals =
    compileErrors + runtimeErrors + sampleMismatch + Math.max(0, submits.length - samplePass);
  let sessionScore = 56;
  if (totalAttempts === 0) {
    sessionScore = 42;
  } else {
    const reliabilityBonus = Math.min(18, runPass * 2 + samplePass * 6);
    const reviewBonus = Math.min(10, reviews.length * 3);
    const activityBonus = Math.min(8, Math.max(0, totalAttempts - 1) * 2);
    const compilePenalty = compileErrors * 7;
    const runtimePenalty = runtimeErrors * 8;
    const mismatchPenalty = sampleMismatch * 6;
    const failSubmitPenalty = Math.max(0, submits.length - samplePass) * 5;
    const frictionPenalty = failSignals >= totalAttempts ? 8 : 0;

    sessionScore =
      56 +
      reliabilityBonus +
      reviewBonus +
      activityBonus -
      compilePenalty -
      runtimePenalty -
      mismatchPenalty -
      failSubmitPenalty -
      frictionPenalty;

    if (totalAttempts < 2) {
      sessionScore = Math.min(sessionScore, 74);
    } else if (totalAttempts < 4) {
      sessionScore = Math.min(sessionScore, 88);
    }
  }
  sessionScore = Math.max(12, Math.min(99, Math.round(sessionScore)));

  const slowSubmit =
    firstSubmitMs != null && firstRunMs != null && firstSubmitMs > firstRunMs + 5 * 60 * 1000;

  const strongestSignals = [];
  if (runPass > 0 || samplePass > 0) {
    strongestSignals.push("You validate behavior with executions before moving on.");
  }
  if (reviews.length > 0) {
    strongestSignals.push("You use structured review to sanity-check complexity and bugs.");
  }
  if (runs.length >= 3) {
    strongestSignals.push("You iterate quickly with multiple run attempts.");
  }
  while (strongestSignals.length < 3) {
    strongestSignals.push("You stayed in the problem space long enough to gather signal.");
    if (strongestSignals.length >= 3) break;
  }

  const biggestGaps = [];
  if (compileErrors >= 2) {
    biggestGaps.push("Repeated compile errors — slow down and align types/syntax before testing logic.");
  }
  if (runtimeErrors >= 2) {
    biggestGaps.push("Multiple runtime errors — add guard checks and trace assumptions on small inputs.");
  }
  if (sampleMismatch >= 2 || labelCounts.off_by_one) {
    biggestGaps.push("Output mismatches or off-by-one risk — compare line-by-line and revisit loop bounds.");
  }
  if (labelCounts.brute_force) {
    biggestGaps.push("Complexity warnings suggest a more efficient structure may be needed for tight limits.");
  }
  if (labelCounts.edge_case) {
    biggestGaps.push("Edge-case gaps called out — explicitly test empty, single, and max constraints.");
  }
  while (biggestGaps.length < 3) {
    biggestGaps.push("Keep tying each change back to the statement and sample expectations.");
    if (biggestGaps.length >= 3) break;
  }

  const repeatedMistakeTypes = Object.entries(mistakeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topicHints = [...(problem.tags || [])].filter(Boolean);
  const nextPracticeTargets = [
    topicHints[0] || "Arrays and two pointers",
    topicHints[1] || "Prefix sums and bounds",
    topicHints[2] || "Complexity-aware implementation",
  ].slice(0, 3);

  let howYouThink =
    "Balanced exploration: you mix running code with reasoning about the brief.";
  if (runs.length > submits.length * 2) {
    howYouThink =
      "Exploration-heavy: you prefer executing often to probe behavior before locking an approach.";
  } else if (submits.length > runs.length) {
    howYouThink =
      "Milestone-driven: you move toward full sample checks relatively quickly after fewer dry runs.";
  }
  if (slowSubmit) {
    howYouThink +=
      " You take more time between first run and full sample submission — accuracy may trade off against pace.";
  }

  const nextSteps = [
    compileErrors ? "Fix the compile loop first with the smallest repro input." : "Add one extra edge test beyond the provided sample.",
    sampleMismatch ? "Diff stdout against expected on the first mismatching line only." : "State the invariant before each loop header.",
    reviews.length === 0 ? "Run Session Intelligence review once before your next submit." : "Pick one review bullet and patch it before adding features.",
  ];

  return {
    version: 1,
    sessionId: logDoc.sessionId,
    roomId: logDoc.roomId,
    problemTitle: problem.title || "Practice problem",
    problemTags: problem.tags || [],
    problemRating: problem.rating || problem.difficulty || "",
    generatedAt: new Date().toISOString(),
    sessionScore,
    howYouThink,
    strongestSignals: strongestSignals.slice(0, 3),
    biggestGaps: biggestGaps.slice(0, 3),
    nextSteps,
    nextPracticeTargets,
    stats: {
      runCount: runs.length,
      submitCount: submits.length,
      aiReviewCount: reviews.length,
      compileErrors,
      runtimeErrors,
      sampleMismatchCount: sampleMismatch,
      sampleSuitePassCount: samplePass,
      firstRunMs,
      firstSubmitMs,
      speedVsAccuracyNote: slowSubmit
        ? "Slower path to full sample submission — consider smaller checkpoints."
        : "Reasonable cadence between runs and submissions.",
    },
    repeatedMistakeTypes,
    complexityGuess,
    issueLabels: [...new Set(allLabels)],
    endReason: logDoc.endReason || "",
    personalized: personal,
  };
}

export async function saveShareableReport(
  isDatabaseConnected,
  { userId = "", roomId, sessionId, report, problemTitle },
) {
  const shareId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const mongoRow = {
    shareId,
    userId: userId ? String(userId) : "",
    roomId: roomId || "",
    sessionId: sessionId || "",
    problemTitle: problemTitle || "",
    report,
  };
  const memRow = { type: "report", ...mongoRow, createdAt };

  if (isDatabaseConnected()) {
    try {
      await SessionIntelligenceReport.create(mongoRow);
      return shareId;
    } catch (err) {
      console.error("saveShareableReport mongo:", err.message);
    }
  }

  memoryLogs.set(`report:${shareId}`, memRow);
  scheduleIntelFilePersist();
  return shareId;
}

export async function getReportByShareId(isDatabaseConnected, shareId) {
  if (isDatabaseConnected()) {
    try {
      const doc = await SessionIntelligenceReport.findOne({ shareId }).lean();
      if (doc) return doc;
    } catch {
      /* fall through */
    }
  }
  const mem = memoryLogs.get(`report:${shareId}`);
  return mem || null;
}

export async function listReportsForUser(isDatabaseConnected, userId, limit = 24) {
  if (!userId) return [];
  if (isDatabaseConnected()) {
    try {
      return await SessionIntelligenceReport.find({ userId: String(userId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch {
      return [];
    }
  }
  return Array.from(memoryLogs.entries())
    .filter(
      ([k, v]) =>
        k.startsWith("report:") &&
        v.type === "report" &&
        v.userId === String(userId),
    )
    .map(([, v]) => v)
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )
    .slice(0, limit);
}

export async function getLatestReportForRoom(isDatabaseConnected, roomId) {
  if (!roomId) return null;
  if (isDatabaseConnected()) {
    try {
      const doc = await SessionIntelligenceReport.findOne({ roomId: String(roomId) })
        .sort({ createdAt: -1 })
        .lean();
      if (doc) return doc;
    } catch {
      /* fall through */
    }
  }

  return Array.from(memoryLogs.entries())
    .filter(
      ([k, v]) =>
        k.startsWith("report:") &&
        v.type === "report" &&
        v.roomId === String(roomId),
    )
    .map(([, v]) => v)
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )[0] || null;
}

