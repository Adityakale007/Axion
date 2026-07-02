/**
 * Codeforces problemset catalog: official API, in-memory + file cache, normalized shape.
 * Does not execute code or validate solutions — metadata only.
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import axios from "axios";

const CF_PROBLEMSET_URL = "https://codeforces.com/api/problemset.problems";
const CACHE_FILENAME = "codeforces-problemset-cache.json";
const MEMORY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const HTTP_TIMEOUT_MS = 60000;

let memoryCache = {
  loadedAt: 0,
  problems: [],
  source: "none",
};

function ratingToCfLabel(rating) {
  if (rating == null || rating === "") return "";
  const r = Number(rating);
  if (Number.isNaN(r)) return "";
  if (r < 1200) return "Newbie";
  if (r < 1400) return "Pupil";
  if (r < 1600) return "Specialist";
  if (r < 1900) return "Expert";
  if (r < 2100) return "Candidate Master";
  if (r < 2300) return "Master";
  if (r < 2400) return "International Master";
  if (r < 2600) return "Grandmaster";
  if (r < 3000) return "International Grandmaster";
  return "Legendary Grandmaster";
}

/**
 * @param {string} problemCode e.g. "1485A" or "1485-A"
 * @returns {{ contestId: string, index: string } | null}
 */
export function parseInternalProblemId(problemCode = "") {
  const normalized = String(problemCode).replace(/\s+/g, "").replace(/[-_/]/g, "");
  const match = normalized.match(/^(\d+)([A-Za-z][A-Za-z0-9]*)$/);
  if (!match) return null;
  return { contestId: match[1], index: match[2].toUpperCase() };
}

function normalizeRows(problems, statistics) {
  const stats = Array.isArray(statistics) ? statistics : [];
  const out = [];

  for (let i = 0; i < problems.length; i++) {
    const p = problems[i];
    if (!p?.contestId || !p?.index) continue;
    const st = stats[i] || {};
    const index = String(p.index).toUpperCase();
    const internalProblemId = `${p.contestId}${index}`;
    const problemUrl = `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;

    out.push({
      internalProblemId,
      platform: "codeforces",
      contestId: p.contestId,
      index,
      title: p.name || `Problem ${internalProblemId}`,
      tags: Array.isArray(p.tags) ? p.tags : [],
      rating: typeof p.rating === "number" ? p.rating : null,
      solvedCount: typeof st.solvedCount === "number" ? st.solvedCount : 0,
      problemUrl,
      statementUrl: problemUrl,
      difficultyLabel: ratingToCfLabel(p.rating),
    });
  }

  return out;
}

async function readFallbackFile(dataDirectory) {
  const filePath = path.join(dataDirectory, CACHE_FILENAME);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const problems = Array.isArray(parsed?.problems) ? parsed.problems : [];
    return {
      problems,
      fetchedAt: parsed?.fetchedAt || null,
      fromFile: true,
    };
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[codeforces] fallback cache read failed:", err.message);
    }
    return { problems: [], fetchedAt: null, fromFile: false };
  }
}

async function writeFallbackFile(dataDirectory, problems, fetchedAt) {
  try {
    await mkdir(dataDirectory, { recursive: true });
    const filePath = path.join(dataDirectory, CACHE_FILENAME);
    await writeFile(
      filePath,
      JSON.stringify({ fetchedAt, problems }, null, 2),
      "utf8",
    );
  } catch (err) {
    console.error("[codeforces] failed to write cache file:", err.message);
  }
}

/**
 * Load full normalized catalog (cached).
 * @returns {Promise<{ problems: object[], source: string, stale?: boolean, warning?: string }>}
 */
export async function loadCodeforcesCatalog(dataDirectory) {
  const now = Date.now();
  if (
    memoryCache.problems.length > 0 &&
    now - memoryCache.loadedAt < MEMORY_TTL_MS
  ) {
    return { problems: memoryCache.problems, source: memoryCache.source };
  }

  try {
    const { data } = await axios.get(CF_PROBLEMSET_URL, {
      timeout: HTTP_TIMEOUT_MS,
      validateStatus: (s) => s === 200,
    });

    if (data?.status !== "OK" || !data?.result?.problems) {
      throw new Error(data?.comment || "Unexpected Codeforces API response");
    }

    const problems = normalizeRows(
      data.result.problems,
      data.result.problemStatistics,
    );
    const fetchedAt = new Date().toISOString();

    memoryCache = {
      loadedAt: now,
      problems,
      source: "live",
    };

    await writeFallbackFile(dataDirectory, problems, fetchedAt);

    return { problems, source: "live" };
  } catch (err) {
    console.error("[codeforces] API fetch failed:", err.message);

    const fallback = await readFallbackFile(dataDirectory);
    memoryCache = {
      loadedAt: now,
      problems: fallback.problems,
      source: fallback.problems.length ? "file_fallback" : "empty",
    };

    return {
      problems: fallback.problems,
      source: memoryCache.source,
      stale: true,
      warning:
        fallback.problems.length > 0
          ? "Using last saved Codeforces catalog. Live API unavailable."
          : "Codeforces catalog unavailable and no local cache found. Try again later.",
    };
  }
}

function parseTagsParam(tags) {
  if (!tags || typeof tags !== "string") return [];
  return tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function parseNum(v, fallback = null) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {object[]} problems
 * @param {object} q query params
 */
export function filterProblems(problems, q) {
  const tagList = parseTagsParam(q.tags);
  const minRating = parseNum(q.minRating, null);
  const maxRating = parseNum(q.maxRating, null);
  const minSolved = parseNum(q.minSolved, null);
  const maxSolved = parseNum(q.maxSolved, null);
  const search = (q.search || "").trim().toLowerCase();
  const offset = Math.max(0, parseInt(q.offset, 10) || 0);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 40));

  let rows = problems.filter((p) => {
    if (tagList.length) {
      const set = new Set((p.tags || []).map((t) => String(t).toLowerCase()));
      const ok = tagList.every((t) => set.has(t));
      if (!ok) return false;
    }
    if (minRating != null && (p.rating == null || p.rating < minRating)) {
      return false;
    }
    if (maxRating != null && (p.rating == null || p.rating > maxRating)) {
      return false;
    }
    if (minSolved != null && p.solvedCount < minSolved) return false;
    if (maxSolved != null && p.solvedCount > maxSolved) return false;
    if (search) {
      const hay = `${p.internalProblemId} ${p.title}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const total = rows.length;
  rows = rows.slice(offset, offset + limit);

  return { rows, total, offset, limit };
}

export async function findNormalizedProblem(dataDirectory, internalProblemId) {
  const parsed = parseInternalProblemId(internalProblemId);
  if (!parsed) return null;

  const { problems } = await loadCodeforcesCatalog(dataDirectory);
  const key = `${parsed.contestId}${parsed.index}`;
  return problems.find((p) => p.internalProblemId === key) || null;
}

/**
 * Build merged problem fields + snapshot for room state (session metadata only).
 */
export function buildRoomProblemPayloadFromCf(
  normalized,
  { roomId, sessionId },
) {
  const problemUrl = normalized.problemUrl;
  const problemCode = `${normalized.contestId}${normalized.index}`;
  const ratingStr =
    normalized.rating != null ? String(normalized.rating) : "";

  const snapshot = {
    internalProblemId: normalized.internalProblemId,
    platform: "codeforces",
    title: normalized.title,
    tags: normalized.tags || [],
    rating: normalized.rating,
    solvedCount: normalized.solvedCount,
    statementUrl: normalized.statementUrl || problemUrl,
    problemUrl,
    contestId: normalized.contestId,
    index: normalized.index,
    difficultyLabel: normalized.difficultyLabel || ratingToCfLabel(normalized.rating),
    roomId: roomId || "",
    sessionId: sessionId || "",
    capturedAt: new Date().toISOString(),
  };

  return {
    platform: "codeforces",
    problemCode,
    problemUrl,
    sourceUrl: problemUrl,
    title: normalized.title,
    tags: normalized.tags || [],
    rating: ratingStr,
    difficulty: normalized.difficultyLabel || ratingStr,
    difficultyLabel: snapshot.difficultyLabel,
    problemSource: "codeforces",
    problemSnapshot: snapshot,
  };
}

export { ratingToCfLabel };
