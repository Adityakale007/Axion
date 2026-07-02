import crypto from "crypto";

function shortShareId() {
  return crypto
    .randomBytes(6)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 10);
}

function formatDurationFromStats(stats = {}) {
  const firstRunMs = Number(stats?.firstRunMs);
  const firstSubmitMs = Number(stats?.firstSubmitMs);
  const base =
    Number.isFinite(firstSubmitMs) && firstSubmitMs > 0
      ? firstSubmitMs
      : Number.isFinite(firstRunMs) && firstRunMs > 0
        ? firstRunMs
        : 0;
  if (!base) return "";
  const totalSeconds = Math.max(1, Math.round(base / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function generateSessionCard(reportData = {}) {
  const report = reportData?.report || {};
  const tags = Array.isArray(report.problemTags)
    ? report.problemTags.filter(Boolean).slice(0, 6)
    : [];
  const strongestSignals = Array.isArray(report.strongestSignals)
    ? report.strongestSignals.filter(Boolean).slice(0, 2)
    : [];
  const biggestGap = Array.isArray(report.biggestGaps)
    ? report.biggestGaps.find(Boolean) || ""
    : "";

  return {
    roomId: reportData.roomId || report.roomId || "",
    sessionId: reportData.sessionId || report.sessionId || "",
    shareId: shortShareId(),
    problemTitle: reportData.problemTitle || report.problemTitle || "Practice session",
    tags,
    rating: String(report.problemRating || ""),
    score:
      typeof report.sessionScore === "number"
        ? report.sessionScore
        : null,
    strongestSignals,
    biggestGap,
    duration: formatDurationFromStats(report.stats || {}),
  };
}
