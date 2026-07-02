/* eslint-disable react/prop-types */
import { useMemo } from "react";
import { getAvatarById } from "../../lib/avatars";

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatExecutionTime(value) {
  if (value == null || value === "" || value === "N/A") return "N/A";
  const numeric = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return String(value);
  return `${numeric.toLocaleString("en-US", {
    minimumFractionDigits: numeric > 0 && numeric < 1 ? 3 : 0,
    maximumFractionDigits: 3,
  })} seconds`;
}

function formatMemoryUsage(value) {
  if (value == null || value === "" || value === "N/A") return "N/A";
  const numeric = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return String(value);
  return `${Math.round(numeric).toLocaleString("en-US")} KB`;
}

function detectComplexity(result) {
  if (!result) return "Not analysed";
  const match = String(result).match(/O\([^)]+\)/i);
  return match ? match[0] : "Analysing...";
}

function firstLine(value = "", maxLen = 8) {
  const line = String(value || "").split("\n")[0].trim();
  return line.length > maxLen ? `${line.slice(0, maxLen)}…` : line || "-";
}

function parseLineNumber(stderr = "") {
  const match = String(stderr).match(/line\s+(\d+)/i) || String(stderr).match(/:(\d+):\d+/);
  return match?.[1] || "Unknown";
}

function getErrorType(result) {
  if (result.status === "CE") return "Compile error";
  if (result.status === "TLE") return "Timeout";
  if (result.status === "RE") return "Runtime error";
  return "Execution error";
}

function estimateNeeded(approachBoard) {
  const text = `${approachBoard?.optimized || ""} ${approachBoard?.brute || ""}`;
  const match = text.match(/O\([^)]+\)/i);
  return match ? match[0] : "O(n log n)";
}

function highlightInsight(text = "") {
  const pattern = /(O\([^)]+\)|\bline\s+\d+\b|\b[a-zA-Z_]\w*\s*\(\))/gi;
  const tokenPattern = /^(O\([^)]+\)|\bline\s+\d+\b|\b[a-zA-Z_]\w*\s*\(\))$/i;
  return String(text)
    .split(pattern)
    .filter(Boolean)
    .map((chunk, idx) =>
      tokenPattern.test(chunk) ? (
        <span key={`${chunk}-${idx}`} className="font-medium text-gray-200">
          {chunk}
        </span>
      ) : (
        <span key={`${chunk}-${idx}`}>{chunk}</span>
      ),
    );
}

export default function RunResultOverlay({
  result,
  users = [],
  aiInsight,
  complexityLabel,
  edgeCases = [],
  approachBoard = { brute: "", optimized: "" },
  onClose,
  onShareCard,
  onGetHint,
  currentUsername = "",
}) {
  const isAC = result?.status === "AC";
  const statusTone = result?.status || "WA";
  const isFirstAC = isAC && Number(result?.waCount || 0) > 0;
  const isCleanAC = isAC && Number(result?.runCount || 0) === 1;
  const runnerIsViewer = currentUsername && result?.runBy && currentUsername === result.runBy;
  const complexity = detectComplexity(complexityLabel || aiInsight || `${approachBoard?.optimized || ""} ${approachBoard?.brute || ""}`);
  const fallbackInsight =
    statusTone === "TLE"
      ? `Your current approach looks heavier than needed. Try aligning to ${estimateNeeded(approachBoard)} and reduce nested passes.`
      : statusTone === "WA"
        ? `Compare expected vs actual for the first failing case and verify transitions against your intended ${approachBoard?.optimized || "optimized"} approach.`
        : "Focus on the first failing signal, then rerun quickly with one focused test.";

  const particleSpecs = useMemo(
    () =>
      isAC
        ? Array.from({ length: 20 }, (_, i) => ({
            id: i,
            x: Math.round((Math.random() - 0.5) * 220),
            y: Math.round(80 + Math.random() * 60),
            delay: Math.random() * 0.3,
            dur: 0.7 + Math.random() * 0.4,
            size: 5 + Math.floor(Math.random() * 3),
            color: ["#4ade80", "#86efac", "#bbf7d0", "#a3e635", "#34d399"][Math.floor(Math.random() * 5)],
          }))
        : [],
    [isAC],
  );

  const headerMap = {
    AC: { pill: "border border-green-500/30 bg-green-500/15 text-green-400", border: "border-green-500/40 run-glow-green", badge: "● ACCEPTED", title: isCleanAC ? "Clean solve. First try. 🎯" : isFirstAC ? `Got it. ${result.waCount} WA before.` : (runnerIsViewer ? "You got it." : `${result.runBy} got it.`), titleCls: "text-green-400" },
    WA: { pill: "border border-red-500/25 bg-red-500/12 text-red-400", border: "border-red-500/30 run-glow-red", badge: "● WRONG ANSWER", title: "Not yet. Keep going.", titleCls: "text-red-400" },
    TLE: { pill: "border border-amber-500/25 bg-amber-500/12 text-amber-400", border: "border-amber-500/30", badge: "⏱ TIME LIMIT EXCEEDED", title: "Too slow. Optimize it.", titleCls: "text-amber-400" },
    RE: { pill: "border border-orange-500/25 bg-orange-500/12 text-orange-400", border: "border-orange-500/30", badge: "✕ RUNTIME ERROR", title: "Runtime crashed. Check bounds.", titleCls: "text-orange-400" },
    CE: { pill: "border border-purple-500/25 bg-purple-500/12 text-purple-400", border: "border-purple-500/30", badge: "✕ COMPILE ERROR", title: "Doesn't compile yet.", titleCls: "text-purple-400" },
  };
  const header = headerMap[statusTone] || headerMap.WA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`run-scale-in relative w-[400px] max-w-[94vw] overflow-hidden rounded-2xl border bg-[#0d1117] p-4 ${header.border}`}>
        {particleSpecs.map((p) => (
          <span key={p.id} className="run-particle absolute left-1/2 top-12 rounded-full" style={{ width: p.size, height: p.size, backgroundColor: p.color, "--dx": `${p.x}px`, "--dy": `${p.y}px`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
        ))}
        <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${header.pill}`}>
          {statusTone === "AC" ? <span className="run-dot-pulse">●</span> : null}
          {statusTone === "AC" ? "ACCEPTED" : header.badge}
        </div>
        <h3 className={`mt-3 text-xl font-semibold ${header.titleCls}`}>{header.title}</h3>
        <p className="mt-1 text-xs text-gray-500">{`${result.problemTitle} · ${result.language} · Run #${result.runCount}`}</p>

        <div className="mt-4 flex items-center justify-center gap-2">
          {users.slice(0, 2).map((user, idx) => {
            if (!user) return null;
            const avatar = getAvatarById(user.avatarId);
            return (
              <div key={`${user.username}-${idx}`} className="flex items-center gap-2">
                {idx === 1 ? <span className="text-gray-500">+</span> : null}
                <div className={`flex flex-col items-center ${isAC ? "run-avatar-bounce" : "run-avatar-shake"}`}>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-xl ${isAC ? "border-green-500/50 bg-green-500/10" : statusTone === "TLE" ? "border-amber-500/40 bg-amber-500/10" : "border-red-500/40 bg-red-500/10"}`}>{avatar.emoji}</div>
                  <span className="mt-1 text-[10px] text-gray-400">{user.username}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-gray-800">
          {(statusTone === "AC"
            ? [
                ["Runs to AC", String(result.runCount), `${result.waCount} WA before`, "text-green-400"],
                ["Time taken", formatDuration(result.sessionDuration), "session duration", "text-gray-100"],
                ["Complexity", complexity, "from code analysis", "text-green-400"],
                ["Exec time", formatExecutionTime(result.time), "within limit", "text-gray-100"],
              ]
            : statusTone === "WA"
              ? [
                  ["Failed on", "Case 1", "sample test cases", "text-red-400"],
                  ["Runs so far", String(result.runCount), `${result.waCount} WA total`, "text-gray-100"],
                  ["Expected", firstLine(result.expectedOutput), "first line", "text-red-400"],
                  ["Got", firstLine(result.actualOutput), "first line", "text-red-400"],
                ]
              : statusTone === "TLE"
                ? [
                    ["Your complexity", complexity, "detected", "text-amber-400"],
                    ["Needed", estimateNeeded(approachBoard), "target", "text-gray-100"],
                    ["Exec time", formatExecutionTime(result.time), "limit exceeded", "text-amber-400"],
                    ["Runs so far", String(result.runCount), "session", "text-gray-100"],
                  ]
                : [
                    ["Error type", getErrorType(result), "diagnostic", "text-orange-400"],
                    ["At line", parseLineNumber(result.stderr || result.stdout), "from stack trace", "text-orange-400"],
                    ["Runs so far", String(result.runCount), "session", "text-gray-100"],
                    ["Time in session", formatDuration(result.sessionDuration), "elapsed", "text-gray-100"],
                  ]).map(([label, value, sub, cls], idx) => (
            <div key={`${label}-${idx}`} className="run-fade-cell bg-[#0d1117] p-2.5" style={{ animationDelay: `${0.1 * idx}s` }}>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
              <p className={`mt-1 font-mono text-lg tabular-nums ${cls}`}>{value}</p>
              <p className="text-[10px] text-gray-500">{sub}</p>
            </div>
          ))}
        </div>

        {(aiInsight || statusTone === "TLE" || statusTone === "WA") ? (
          <div className="run-slide-down mt-4 rounded-xl border border-gray-800 bg-[#0f141d] p-3" style={{ animationDelay: "0.7s" }}>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">AI INSIGHT</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">{highlightInsight(aiInsight || fallbackInsight)}</p>
          </div>
        ) : null}

        {edgeCases.length > 0 ? (
          <div className="run-slide-down mt-3 flex items-center justify-between gap-2" style={{ animationDelay: "0.85s" }}>
            <p className="text-xs text-gray-500">Edge cases</p>
            <div className="flex flex-wrap justify-end gap-1">
              {edgeCases.slice(0, 4).map((item) => (
                <span key={item.label} className={`rounded-full border px-2 py-0.5 text-[10px] ${item.checked ? "border-green-500/20 bg-green-500/12 text-green-400" : statusTone === "WA" ? "border-gray-600 bg-gray-700/40 text-gray-300" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="run-slide-down mt-4 flex items-center justify-end gap-2" style={{ animationDelay: "1s" }}>
          {statusTone === "CE" ? (
            <button type="button" onClick={onClose} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">Fix it</button>
          ) : (
            <>
              <button
                type="button"
                onClick={statusTone === "AC" ? onShareCard : onClose}
                className={`rounded-lg px-3 py-2 text-sm text-white ${statusTone === "AC" ? "bg-green-600 hover:bg-green-700" : statusTone === "TLE" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-700 hover:bg-red-800"}`}
              >
                {statusTone === "AC" ? "Share session card" : statusTone === "TLE" ? "Rethink approach" : "Keep debugging"}
              </button>
              <button type="button" onClick={statusTone === "AC" ? onClose : onGetHint} className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200">
                {statusTone === "AC" ? "Close" : "Get a hint"}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`
        .run-scale-in{animation:runScaleIn .35s cubic-bezier(0.34,1.56,0.64,1);}
        .run-glow-green{animation:borderGlowGreen 2s infinite;}
        .run-glow-red{animation:borderGlowRed 2s infinite;}
        .run-fade-cell{opacity:0;animation:fadeCell .35s ease forwards;}
        .run-slide-down{opacity:0;transform:translateY(-8px);animation:slideDown .35s ease forwards;}
        .run-avatar-bounce{animation:avatarBounce .6s ease .5s both;}
        .run-avatar-shake{animation:avatarShake .5s ease .4s both;}
        .run-particle{opacity:0;animation:particleFly 1s ease forwards;pointer-events:none;}
        @keyframes runScaleIn{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes dotPulse{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes borderGlowGreen{0%,100%{box-shadow:0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 22px rgba(34,197,94,.28)}}
        @keyframes borderGlowRed{0%,100%{box-shadow:0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 22px rgba(239,68,68,.22)}}
        @keyframes avatarBounce{0%{transform:translateY(0)}40%{transform:translateY(-12px)}65%{transform:translateY(-4px)}100%{transform:translateY(0)}}
        @keyframes avatarShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}50%{transform:translateX(5px)}75%{transform:translateX(-3px)}}
        @keyframes fadeCell{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{to{opacity:1;transform:translateY(0)}}
        @keyframes particleFly{0%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)), calc(-1 * var(--dy)))}}
        .run-dot-pulse{animation:dotPulse 1.2s infinite}
      `}</style>
    </div>
  );
}
