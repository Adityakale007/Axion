/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Codemirror from "codemirror";
import axios from "axios";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { toPng } from "html-to-image";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/clike/clike";
import "codemirror/mode/python/python";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import useAIHint from "./AIHint";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS } from "./languages";
import { formatCode } from "./formatCode";
import { getAuthHeaders, getAuthToken } from "../../lib/auth";
import SessionIntelligenceReportDashboard from "../sessionIntelligence/SessionIntelligenceReportDashboard.jsx";
import HiddenTestPanel from "../HiddenTestPanel.jsx";
import { getAvatarById } from "../../lib/avatars";
import AvatarGlyph from "../common/AvatarGlyph.jsx";
import RunResultOverlay from "./RunResultOverlay.jsx";
import useCardTilt from "../../hooks/useCardTilt.js";

function normalizeEditorText(text) {
    return String(text ?? "").replace(/\r\n/g, "\n");
}

/** Empty/whitespace or still exactly one of the built-in starter templates (safe to swap on language change). */
function codeIsSafeToReplaceForLanguageSwitch(raw) {
    const normalized = normalizeEditorText(raw).trimEnd();
    if (!normalized.trim()) return true;
    return Object.values(LANGUAGE_OPTIONS).some((opt) => {
        const starter = normalizeEditorText(opt.starterCode).trimEnd();
        return starter === normalized;
    });
}

function codeMatchesLanguageStarter(raw, languageKey) {
    const opt = LANGUAGE_OPTIONS[languageKey];
    if (!opt) return false;
    return (
        normalizeEditorText(raw).trimEnd() === normalizeEditorText(opt.starterCode).trimEnd()
    );
}

function OutputSection({ tone, title, children }) {
    const toneClasses = {
        success: "border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-50 shadow-[0_0_24px_-12px_rgba(0,245,255,0.6)]",
        error: "border-rose-400/30 bg-rose-400/[0.07] text-rose-50 shadow-[0_0_24px_-12px_rgba(255,80,110,0.5)]",
        warning: "border-[#7C5CFF]/35 bg-[#7C5CFF]/[0.08] text-violet-50 shadow-[0_0_24px_-12px_rgba(124,92,255,0.5)]",
        info: "border-[#1E90FF]/35 bg-[#1E90FF]/[0.08] text-sky-50 shadow-[0_0_24px_-12px_rgba(30,144,255,0.5)]",
    };

    const dotClasses = {
        success: "bg-cyan-300 shadow-[0_0_8px_2px_rgba(0,245,255,0.7)]",
        error: "bg-rose-400 shadow-[0_0_8px_2px_rgba(255,80,110,0.6)]",
        warning: "bg-[#a78bfa] shadow-[0_0_8px_2px_rgba(124,92,255,0.6)]",
        info: "bg-[#38bdf8] shadow-[0_0_8px_2px_rgba(30,144,255,0.6)]",
    };

    return (
        <div className={`rounded-2xl border backdrop-blur-md p-4 ${toneClasses[tone]}`}>
            <div className="mb-2 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${dotClasses[tone]}`}></div>
                <span className="font-medium tracking-wide">{title}</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[#EAF6FF]/90">{children}</pre>
        </div>
    );
}

function ProgressiveSampleSuiteResults({ allPass, summary, results = [] }) {
    const [visibleCount, setVisibleCount] = useState(0);

    useEffect(() => {
        setVisibleCount(0);
        const timers = results.map((_, index) => window.setTimeout(() => {
            setVisibleCount((current) => Math.max(current, index + 1));
        }, index * 200));

        return () => timers.forEach((timerId) => window.clearTimeout(timerId));
    }, [results]);

    return (
        <div className="space-y-3 text-sm">
            <OutputSection tone={allPass ? "success" : "warning"} title="Sample suite">
                {`Passed ${summary?.passed ?? 0} / ${summary?.total ?? 0}`}
            </OutputSection>
            {results.slice(0, visibleCount).map((r, index) => {
                const passed = Boolean(r.passed);
                return (
                    <div
                        key={r.id || r.index}
                        className={`rounded-2xl border p-3 opacity-0 backdrop-blur-md ${passed ? "border-cyan-400/25 bg-cyan-400/[0.04]" : "border-rose-400/25 bg-rose-400/[0.05]"} ${passed ? "workspace-sample-pass" : "workspace-sample-fail"}`}
                        style={{
                            animation: `sampleReveal 150ms ease ${index * 10}ms forwards, ${passed ? "samplePassFlash" : "sampleFailFlash"} 400ms ease forwards`,
                        }}
                    >
                        <p className="font-semibold text-[#EAF6FF]">Test {r.index}{passed ? " ✓" : " ✗"}</p>
                        {r.compile_output ? (
                            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-[#91A8C3]">{r.compile_output}</pre>
                        ) : null}
                        {r.stderr ? (
                            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-rose-300">{r.stderr}</pre>
                        ) : null}
                        {!passed && !r.compile_output && !r.stderr ? (
                            <div className="mt-2">
                                <ComparisonPanel expectedOutput={r.expectedOutput} actualOutput={r.actualOutput} />
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

function AIReviewBugCard({ bug, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const title = typeof bug === "string" ? bug : bug?.title || bug?.explanation || "Potential issue";
    const explanation = typeof bug === "string" ? bug : bug?.explanation || bug?.description || "";
    const codeSnippet = typeof bug === "object" ? bug?.code || bug?.fix || "" : "";

    return (
        <div className="overflow-hidden rounded-2xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.65)] backdrop-blur-xl shadow-[0_0_0_1px_rgba(0,212,255,0.04)]">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
                <div className="flex min-w-0 items-center gap-3">
                    <span className="text-base">🐛</span>
                    <p className="truncate text-sm font-medium text-[#EAF6FF]">{title}</p>
                </div>
                <span className={`text-xs text-[#91A8C3] transition-transform ${isOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>
            <div
                className="overflow-hidden transition-[max-height] duration-200 ease-out"
                style={{ maxHeight: isOpen ? "280px" : "0px" }}
            >
                <div className="space-y-3 border-t border-[rgba(0,212,255,0.12)] px-4 py-3 text-sm text-[#91A8C3]">
                    {explanation ? <p>{explanation}</p> : null}
                    {codeSnippet ? (
                        <pre className="overflow-x-auto rounded-xl bg-[#050c18] px-3 py-2 font-mono text-xs text-[#00D4FF]">{codeSnippet}</pre>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function AIReviewStructuredPanel({ reviewContent }) {
    if (!reviewContent) return null;

    const bugs = Array.isArray(reviewContent.bugs) ? reviewContent.bugs : [];
    const optimization = reviewContent.optimization_suggestion || reviewContent.optimization || null;
    const score = Number(reviewContent.overallScore || reviewContent.score || 0);
    const bugCountTone = bugs.length > 0 ? "border-rose-400/30 bg-rose-400/[0.06] text-rose-200" : "border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-200";
    const scoreTone = score >= 80 ? "text-cyan-300" : score >= 60 ? "text-[#a78bfa]" : "text-rose-300";

    return (
        <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="rounded-2xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4 shadow-[0_0_0_1px_rgba(0,212,255,0.04)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#91A8C3]">Solution snapshot</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.08] px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c4b5fd]">Time complexity</p>
                            <p className="mt-2 text-xl font-bold text-white">{reviewContent.time_complexity || "N/A"}</p>
                        </div>
                        <div className="rounded-xl border border-[#1E90FF]/30 bg-[#1E90FF]/[0.08] px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7dd3fc]">Space complexity</p>
                            <p className="mt-2 text-xl font-bold text-white">{reviewContent.space_complexity || "N/A"}</p>
                        </div>
                        <div className={`rounded-xl border px-4 py-3 ${bugCountTone}`}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">Risk count</p>
                            <p className="mt-2 text-xl font-bold">{bugs.length > 0 ? `${bugs.length} issues` : "Clean"}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4 text-center shadow-[0_0_30px_-10px_rgba(0,212,255,0.35)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#91A8C3]">Overall score</p>
                    <p className={`mt-3 text-4xl font-black ${scoreTone}`}>{score || 74}</p>
                    <p className="mt-2 text-xs text-[#91A8C3]">out of 100</p>
                </div>
            </div>

            {bugs.length > 0 ? (
                <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4b5fd]">Issues found</p>
                    {bugs.map((bug, index) => (
                        <AIReviewBugCard key={`${typeof bug === "string" ? bug : bug?.title || index}-${index}`} bug={bug} defaultOpen={index === 0} />
                    ))}
                </div>
            ) : null}

            {optimization && (optimization.before || optimization.after || optimization.benefit || optimization.explanation) ? (
                <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#91A8C3]">Suggested improvement</p>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border-l-4 border-rose-400 bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">Before</p>
                            <pre className="mt-3 overflow-x-auto rounded-lg bg-[#050c18] px-3 py-2 font-mono text-xs text-[#91A8C3]">{optimization.before || "No before snippet provided."}</pre>
                        </div>
                        <div className="rounded-xl border-l-4 border-cyan-400 bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">After</p>
                            <pre className="mt-3 overflow-x-auto rounded-lg bg-[#050c18] px-3 py-2 font-mono text-xs text-cyan-100">{optimization.after || "No after snippet provided."}</pre>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4">
                <p className="text-sm text-[#cfe4f7]">{reviewContent.summary || "AI review complete."}</p>
                <span className={`rounded-full border border-[rgba(0,212,255,0.3)] bg-[#00D4FF]/10 px-3 py-1 text-sm font-semibold ${scoreTone}`}>{`${score || 74} / 100`}</span>
            </div>
        </div>
    );
}

function buildLineComparison(expectedOutput = "", actualOutput = "") {
    const expectedLines = (expectedOutput || "").split('\n');
    const actualLines = (actualOutput || "").split('\n');
    const maxLength = Math.max(expectedLines.length, actualLines.length);
    let firstDiffLine = -1;

    const lines = Array.from({ length: maxLength }, (_, index) => {
        const expectedLine = expectedLines[index] || "";
        const actualLine = actualLines[index] || "";
        const matches = normalizeOutput(expectedLine) === normalizeOutput(actualLine);

        if (!matches && firstDiffLine === -1) {
            firstDiffLine = index + 1;
        }

        return {
            lineNumber: index + 1,
            expectedLine,
            actualLine,
            matches,
        };
    });

    return { lines, firstDiffLine, expectedLines, actualLines };
}

function ComparisonPanel({ expectedOutput, actualOutput }) {
    const { lines, firstDiffLine, expectedLines, actualLines } = buildLineComparison(expectedOutput, actualOutput);

    const getPossibleCause = () => {
        if (actualLines.length < expectedLines.length) return "Output is shorter than expected. Missing data?";
        if (actualLines.length > expectedLines.length) return "Output is longer than expected. Extra prints or wrong logic?";
        if (firstDiffLine !== -1) return "Data mismatch. Check your logic for the given line.";
        return null;
    };

    return (
        <div className="space-y-3">
            {firstDiffLine !== -1 && (
                <div className="rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.08] p-2 text-xs font-medium text-[#d8ccff]">
                    <span className="font-bold text-white">Hint:</span> First difference found at line {firstDiffLine}. {getPossibleCause()}
                </div>
            )}
            <div className="rounded-2xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] backdrop-blur-xl p-4">
                <div className="mb-3 grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#91A8C3]">
                        Line
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                        Expected
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c4b5fd]">
                        Actual
                    </p>
                </div>
                <div className="space-y-2">
                    {lines.length > 0 ? lines.map((line) => (
                        <div
                            key={`${line.lineNumber}-${line.expectedLine}-${line.actualLine}`}
                            className="grid gap-3 rounded-xl sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)]"
                        >
                            <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${line.matches ? 'bg-cyan-400/10 text-cyan-200' : 'bg-rose-400/10 text-rose-200'}`}>
                                Line {line.lineNumber}
                            </div>
                            <pre className={`overflow-x-auto whitespace-pre-wrap rounded-lg px-3 py-2 font-mono text-sm leading-relaxed ${line.matches ? 'bg-cyan-400/5 text-cyan-50' : 'bg-rose-400/5 text-rose-50'}`}>{line.expectedLine || ' '}</pre>
                            <pre className={`overflow-x-auto whitespace-pre-wrap rounded-lg px-3 py-2 font-mono text-sm leading-relaxed ${line.matches ? 'bg-cyan-400/5 text-cyan-50' : 'bg-rose-400/5 text-rose-50'}`}>{line.actualLine || ' '}</pre>
                        </div>
                    )) : (
                        <p className="text-sm text-[#91A8C3]">No expected output provided.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function OverlayPanel({ title, subtitle, onClose, children }) {
    return createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#03070f]/70 p-4 backdrop-blur-md">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[rgba(0,212,255,0.22)] bg-[#0b1730]/95 shadow-[0_0_0_1px_rgba(0,212,255,0.08),0_40px_140px_-40px_rgba(0,212,255,0.35)]">
                <div className="flex items-start justify-between gap-4 border-b border-[rgba(0,212,255,0.16)] bg-[linear-gradient(180deg,rgba(21,37,68,0.9),rgba(8,17,32,0.92))] px-6 py-5">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00D4FF]">{subtitle}</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#EAF6FF]">{title}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(0,212,255,0.25)] bg-[rgba(16,28,52,0.7)] text-[#91A8C3] transition hover:border-[#00D4FF]/60 hover:text-[#EAF6FF] hover:shadow-[0_0_16px_-4px_rgba(0,212,255,0.6)]"
                        aria-label="Close overlay"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(8,17,32,0.6),rgba(11,23,48,0.9))] px-6 py-6">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ButtonSpinner() {
    return (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" className="opacity-30" stroke="currentColor" strokeWidth="2.2" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}

function normalizeOutput(value = "") {
    return value.replace(/\r\n/g, "\n").trim();
}

function formatTimerLabel(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return minutes > 0 ? `${minutes} minutes ${seconds}s` : `${seconds}s`;
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

const TIMER_PRESETS = [
    { label: "15m", value: 15 * 60 },
    { label: "30m", value: 30 * 60 },
    { label: "45m", value: 45 * 60 },
    { label: "60m", value: 60 * 60 },
];

const SESSION_MODE_LABELS = {
    peer_practice: 'Peer Practice',
    mock_interview: 'Mock Interview',
    mentoring: 'Mentoring',
};

function Workspace({ socketRef, roomId, roomState, currentSocketId, currentRole = 'Peer', currentUsername = 'Anonymous', users = [] }) {
    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    // Fallback for development if frontend is on 5173 and backend is on 5000
    const serverUrl = (rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL)
        ? rawServerUrl.replace(":5173", ":5000")
        : rawServerUrl;

    const editorRef = useRef(null);
    const remoteCursorMarkersRef = useRef({});
    const myColorRef = useRef('#00D4FF');
    const settingsRef = useRef(null);
    const selectedLanguageRef = useRef(DEFAULT_LANGUAGE);
    const isUserLanguageChangeRef = useRef(false);
    const {
        ghostHint,
        fetchHint,
        acceptGhostHint,
        showDropdown,
        aiHints,
        isLoading,
        fetchAIHints,
        closeDropdown,
        applyHint
    } = useAIHint(
        editorRef,
        socketRef,
        roomId
    );
    const [output, setOutput] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);
    const [lastRunMeta, setLastRunMeta] = useState(null);
    const [timerDuration, setTimerDuration] = useState(45 * 60);
    const [timeRemaining, setTimeRemaining] = useState(45 * 60);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [showOutputModal, setShowOutputModal] = useState(false);
    const [reviewContent, setReviewContent] = useState(null);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
    const [activeRightTab, setActiveRightTab] = useState("output");
    /** Brief highlight after a new report is generated (Output-like priority). */
    const [isNewReport, setIsNewReport] = useState(false);
    const [runBy, setRunBy] = useState('');
    const [reportLoading, setReportLoading] = useState(false);
    const [lastReportPayload, setLastReportPayload] = useState(null);
    const [previousReportPayload, setPreviousReportPayload] = useState(null);
    const [lastShareId, setLastShareId] = useState('');
    const [showReportModal, setShowReportModal] = useState(false);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [celebrationResult, setCelebrationResult] = useState(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [runVisualState, setRunVisualState] = useState("idle");
    const [rightPanelWidthPct, setRightPanelWidthPct] = useState(() => {
        const raw = Number(localStorage.getItem("Axion.rightPanelWidthPct"));
        if (Number.isFinite(raw) && raw >= 25 && raw <= 50) return raw;
        return 35;
    });
    const rightTabRefs = useRef({});
    const [rightTabIndicator, setRightTabIndicator] = useState({ left: 0, width: 0 });
    const reportCardTiltRef = useCardTilt(4);
    const [testGenerateSignal, setTestGenerateSignal] = useState(0);
    const [editorContentVersion, setEditorContentVersion] = useState(0);
    const [collabHintDismissed, setCollabHintDismissed] = useState(false);
    const [showLanguageSwitchModal, setShowLanguageSwitchModal] = useState(false);
    const [pendingLanguage, setPendingLanguage] = useState(null);
    const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
    const [clearConfirmCountdown, setClearConfirmCountdown] = useState(0);
    const [canUndoClear, setCanUndoClear] = useState(false);
    const [showFormattedFlash, setShowFormattedFlash] = useState(false);
    const [runButtonAnimating, setRunButtonAnimating] = useState(false);
    const [runFeedbackTone, setRunFeedbackTone] = useState("");
    const [hasCelebratedAcceptedRun, setHasCelebratedAcceptedRun] = useState(false);
    const [activityScore, setActivityScore] = useState(0);
    const [partnerLastActivity, setPartnerLastActivity] = useState({});
    const [activityClock, setActivityClock] = useState(Date.now());
    const [unlockedTitle, setUnlockedTitle] = useState("");
    const shareCardCaptureRef = useRef(null);
    const lastClearedCodeRef = useRef("");
    const clearUndoTimeoutRef = useRef(null);
    const runCountRef = useRef(0);
    const waCountRef = useRef(0);
    const sessionStartedAtRef = useRef(Date.now());
    const celebrationTimeoutRef = useRef(null);

    const markActivity = useCallback((delta = 1) => {
        setActivityScore((current) => Math.min(100, current + delta));
    }, []);

    const markPartnerActivity = useCallback((username) => {
        if (!username) return;
        setPartnerLastActivity((current) => ({
            ...current,
            [username]: Date.now(),
        }));
    }, []);

    useEffect(() => {
        setCollabHintDismissed(false);
    }, [roomId]);

    useEffect(() => {
        if (activeRightTab !== "report") {
            setIsNewReport(false);
        }
    }, [activeRightTab]);

    useEffect(() => {
        if (!isNewReport) return undefined;
        const id = window.setTimeout(() => setIsNewReport(false), 12000);
        return () => window.clearTimeout(id);
    }, [isNewReport]);

    useEffect(() => {
        if (!showFormattedFlash) return undefined;
        const id = window.setTimeout(() => setShowFormattedFlash(false), 1000);
        return () => window.clearTimeout(id);
    }, [showFormattedFlash]);

    useEffect(() => {
        const updateIndicator = () => {
            const activeNode = rightTabRefs.current[activeRightTab];
            if (!activeNode) return;
            setRightTabIndicator({
                left: activeNode.offsetLeft,
                width: activeNode.offsetWidth,
            });
        };

        updateIndicator();
        window.addEventListener("resize", updateIndicator);
        return () => window.removeEventListener("resize", updateIndicator);
    }, [activeRightTab]);

    useEffect(() => {
        if (runVisualState === "idle" || runVisualState === "compiling") return undefined;
        const timer = window.setTimeout(() => setRunVisualState("idle"), 700);
        return () => window.clearTimeout(timer);
    }, [runVisualState]);

    useEffect(() => {
        if (!unlockedTitle) return undefined;
        const timeoutId = window.setTimeout(() => setUnlockedTitle(""), 1500);
        return () => window.clearTimeout(timeoutId);
    }, [unlockedTitle]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setActivityScore((current) => Math.max(0, current - 1));
            setActivityClock(Date.now());
        }, 10000);

        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (!showClearConfirmModal) return undefined;
        setClearConfirmCountdown(2);
        const startedAt = Date.now();
        const intervalId = window.setInterval(() => {
            const elapsedSeconds = (Date.now() - startedAt) / 1000;
            const remaining = Math.max(0, 2 - elapsedSeconds);
            setClearConfirmCountdown(Number(remaining.toFixed(1)));
        }, 100);
        return () => window.clearInterval(intervalId);
    }, [showClearConfirmModal]);

    useEffect(() => () => {
        if (clearUndoTimeoutRef.current) {
            window.clearTimeout(clearUndoTimeoutRef.current);
        }
        if (celebrationTimeoutRef.current) {
            window.clearTimeout(celebrationTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(
            "Axion.rightPanelWidthPct",
            String(rightPanelWidthPct),
        );
    }, [rightPanelWidthPct]);

    const startPanelResize = useCallback((event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startPct = rightPanelWidthPct;
        const onMove = (ev) => {
            const deltaPx = ev.clientX - startX;
            const deltaPct = (deltaPx / window.innerWidth) * 100;
            const next = Math.max(25, Math.min(50, startPct - deltaPct));
            setRightPanelWidthPct(next);
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [rightPanelWidthPct]);

    const renderReviewContent = () => {
        if (isReviewLoading) {
            return (
                <div className="flex min-h-[14rem] items-center justify-center rounded-[1.4rem] border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.06] backdrop-blur-xl p-5">
                    <div className="flex items-center gap-3 text-sm font-medium text-[#d8ccff]">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#a78bfa] border-t-transparent"></div>
                        Analyzing solution...
                    </div>
                </div>
            );
        }

        if (!reviewContent) {
            return (
                <div className="rounded-[1.4rem] border border-dashed border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.4)] p-5 text-sm leading-7 text-[#91A8C3]">
                    Run `Review Solution` to get complexity, bug checks, and optimization suggestions here.
                </div>
            );
        }

        return <AIReviewStructuredPanel reviewContent={reviewContent} />;
    };

    const sampleInput = roomState?.problem?.sampleInput || "";
    const expectedOutput = roomState?.problem?.sampleOutput || "";
    const session = useMemo(() => (
        roomState?.session || {
            mode: 'peer_practice',
            driverSocketId: '',
            navigatorSocketId: '',
            approachNotes: '',
            edgeCaseChecklist: [],
            runHistory: [],
            mentorNotes: '',
            mockSummary: null,
            mockLocked: false,
        }
    ), [roomState?.session]);

    const problemToolbarMeta = useMemo(() => {
        const prob = roomState?.problem;
        const snap = prob?.problemSnapshot;
        if (!prob && !snap) return null;
        const title = snap?.title || prob?.title || "";
        const tags =
            Array.isArray(snap?.tags) && snap.tags.length
                ? snap.tags
                : Array.isArray(prob?.tags)
                  ? prob.tags
                  : [];
        const rating = snap?.rating != null ? snap.rating : prob?.rating;
        const solved =
            typeof snap?.solvedCount === "number" ? snap.solvedCount : null;
        const diff =
            snap?.difficultyLabel || prob?.difficultyLabel || prob?.difficulty;
        const showBar =
            (title && title !== "Untitled Practice Problem") ||
            tags.length > 0 ||
            (rating != null && String(rating).length > 0) ||
            solved != null ||
            (diff != null && String(diff).length > 0) ||
            prob?.problemSource === "codeforces";
        if (!showBar) return null;
        return { title, tags, rating, solved, diff };
    }, [roomState?.problem]);

    const normalizedRole = (currentRole || 'Peer').toLowerCase();
    const isDriver = session.driverSocketId === currentSocketId;
    const isNavigator = session.navigatorSocketId === currentSocketId;
    const driverUser = users.find((user) => user && user.socketId === session.driverSocketId);
    const navigatorUser = users.find((user) => user && user.socketId === session.navigatorSocketId);
    const hasAssignedDriver = Boolean(session.driverSocketId);
    const isMentoringMode = session.mode === 'mentoring';
    const isMockMode = session.mode === 'mock_interview';
    const isLearnerRole = normalizedRole === 'learner';
    const isInterviewerRole = normalizedRole === 'interviewer';
    const isCandidateRole = normalizedRole === 'candidate';
    const canRunInCurrentMode = !isMockMode || !hasAssignedDriver || isDriver;
    const checklistTotal = session.edgeCaseChecklist.length;
    const checklistCompleted = session.edgeCaseChecklist.filter((item) => item.checked).length;
    const criticalOpenCount = session.edgeCaseChecklist.filter(
        (item) => item.priority === 'critical' && !item.checked
    ).length;
    const isRunBusy = lastRunMeta?.status === "Running";
    const isSubmitBusy = lastRunMeta?.status === "Submitting samples...";
    const roomEnergyPercent = Math.max(0, Math.min(100, activityScore));
    const roomEnergyTone = activityScore > 20 ? "bg-gradient-to-r from-[#00D4FF] via-[#1E90FF] to-[#7C5CFF]" : "bg-[rgba(0,212,255,0.15)]";
    const partnerUser = users.find((user) => user && user.socketId !== currentSocketId);
    const partnerIdle = partnerUser?.username
        ? activityClock - (partnerLastActivity[partnerUser.username] || activityClock) >= 180000
        : false;

    useEffect(() => {
        if (!partnerUser?.username) return;
        setPartnerLastActivity((current) => current[partnerUser.username]
            ? current
            : { ...current, [partnerUser.username]: Date.now() });
    }, [partnerUser?.username]);

    const canEdit =
        isMentoringMode
            ? isLearnerRole
                ? false
                : true
            : isMockMode
                ? isInterviewerRole
                    ? false
                    : isCandidateRole
                        ? true
                        : hasAssignedDriver
                            ? isDriver
                            : true
                : hasAssignedDriver
                    ? isDriver
                    : true;
    const editorUnlocked = canEdit && !session.mockLocked;

    const controlTone = editorUnlocked
        ? isDriver
            ? 'driver'
            : isMentoringMode
                ? 'mentor'
                : isMockMode
                    ? 'candidate'
                    : 'shared'
        : isNavigator
            ? 'navigator'
            : 'locked';

    const participationLabel =
        isDriver
            ? 'Driver'
            : isNavigator
                ? 'Navigator'
                : 'Observer';
    const isDesktopLayout =
        typeof window !== "undefined" ? window.innerWidth >= 1280 : false;

    const handleSwapRoles = () => {
        socketRef.current?.emit('swap-roles', { roomId });
    };

    const toggleEdgeCase = (id) => {
        const nextChecklist = session.edgeCaseChecklist.map((item) =>
            item.id === id ? { ...item, checked: !item.checked } : item
        );
        socketRef.current?.emit('session-update', {
            roomId,
            session: { ...session, edgeCaseChecklist: nextChecklist },
        });
    };

    const createMockSummaryShare = useCallback(async (summaryPayload) => {
        try {
            const response = await axios.post(`${serverUrl}/api/mock-summary`, {
                roomId,
                summary: summaryPayload,
            }, {
                headers: getAuthHeaders(),
            });

            return response.data.summaryId;
        } catch {
            return null;
        }
    }, [roomId, serverUrl]);

    const reviewSolution = async () => {
        setIsReviewLoading(true);
        setShowAnalysisModal(true);
        markActivity(2);
        try {
            const code = editorRef.current?.getValue() || "";
            setReviewContent(null);
            const response = await axios.post(`${serverUrl}/api/ai/review`, {
                code,
                problem: roomState?.problem,
                language: selectedLanguageRef.current,
                roomId,
            }, {
                headers: getAuthHeaders(),
            });
            setReviewContent(response.data);
        } catch {
            toast.error("Failed to get review");
        } finally {
            setIsReviewLoading(false);
        }
    };


    useEffect(() => {
        async function connect() {
            editorRef.current = Codemirror.fromTextArea(
                document.getElementById("realtimeEditor"),
                {
                    mode: LANGUAGE_OPTIONS[DEFAULT_LANGUAGE].editorMode,
                    theme: "dracula",
                    autoCloseTags: true,
                    autoCloseBrackets: true,
                    lineNumbers: true,
                }
            );

            // Override font family to use monospace instead of Sora
            const cmWrapper = editorRef.current.getWrapperElement();
            if (cmWrapper) {
                cmWrapper.style.fontFamily = "'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace";
            }

            editorRef.current.on("change", (instance, changes) => {
                const { origin } = changes;
                setEditorContentVersion((v) => v + 1);
                if (origin !== "setValue") {
                    setCollabHintDismissed(true);
                    markActivity(1);
                }
                const code = instance.getValue();
                if (origin !== "setValue") {
                    socketRef.current.emit("code-change", {
                        roomId,
                        code,
                    });
                }
            });

            editorRef.current.on("cursorActivity", (instance) => {
                const socket = socketRef.current;
                if (!socket) return;
                const selections = instance.listSelections?.() || [];
                const primary = selections[0];
                if (!primary) return;
                const anchorIndex = instance.indexFromPos(primary.anchor);
                const headIndex = instance.indexFromPos(primary.head);
                socket.emit("cursor-move", {
                    roomId,
                    anchor: anchorIndex,
                    head: headIndex,
                });
            });
        }
        connect();
    }, [markActivity, roomId, socketRef]);

    useEffect(() => {
        if (!editorRef.current) return;

        const wrapper = editorRef.current.getWrapperElement();
        editorRef.current.setOption("readOnly", editorUnlocked ? false : "nocursor");

        if (wrapper) {
            wrapper.classList.remove(
                "Axion-editor-driver",
                "Axion-editor-navigator",
                "Axion-editor-mentor",
                "Axion-editor-candidate",
                "Axion-editor-shared",
                "Axion-editor-locked",
            );
            wrapper.classList.add(`Axion-editor-${controlTone}`);
        }
    }, [controlTone, editorUnlocked]);

    useEffect(() => {
        if (!editorRef.current || !roomState) return;

        const serverLanguage = roomState.language;
        if (serverLanguage && LANGUAGE_OPTIONS[serverLanguage]) {
            if (serverLanguage === selectedLanguageRef.current) {
                isUserLanguageChangeRef.current = false;
            } else if (!isUserLanguageChangeRef.current) {
                const nextLanguage = serverLanguage;
                selectedLanguageRef.current = nextLanguage;
                setSelectedLanguage(nextLanguage);
                editorRef.current.setOption("mode", LANGUAGE_OPTIONS[nextLanguage].editorMode);
                const cur = editorRef.current.getValue();
                if (codeIsSafeToReplaceForLanguageSwitch(cur)) {
                    const nextCode = LANGUAGE_OPTIONS[nextLanguage].starterCode;
                    editorRef.current.setValue(nextCode);
                    socketRef.current?.emit("code-change", { roomId, code: nextCode });
                }
            }
        }

        // Only set the value if the editor is currently empty (initial load)
        const currentCode = editorRef.current.getValue();
        if (typeof roomState.code === "string" && !currentCode.trim() && roomState.code.trim()) {
            editorRef.current.setValue(roomState.code);
        }
    }, [roomState, roomId]);

    useEffect(() => {
        const socket = socketRef.current;

        if (!socket || !editorRef.current) return;

        const handleCodeChange = ({ code }) => {
            if (code !== null && editorRef.current) {
                const otherUser = users.find((user) => user && user.socketId !== currentSocketId);
                markPartnerActivity(otherUser?.username);
                const currentCode = editorRef.current.getValue();
                if (code !== currentCode) {
                    const cursor = editorRef.current.getCursor();
                    const scrollInfo = editorRef.current.getScrollInfo();

                    editorRef.current.setValue(code);

                    editorRef.current.setCursor(cursor);
                    editorRef.current.scrollTo(scrollInfo.left, scrollInfo.top);
                }
            }
        };

        socket.on("code-change", handleCodeChange);
        socket.on("user-color-assigned", ({ color }) => {
            if (typeof color === 'string' && color.trim()) {
                myColorRef.current = color;
            }
        });
        socket.on("remote-cursor-update", ({ socketId, anchor, head, username, color }) => {
            if (!editorRef.current || !socketId) return;
            if (socketId === currentSocketId) return;

            const existingMarkers = remoteCursorMarkersRef.current[socketId] || [];
            existingMarkers.forEach((marker) => marker?.clear?.());

            const safeAnchor = Math.max(0, Math.min(anchor, editorRef.current.getValue().length));
            const safeHead = Math.max(0, Math.min(head, editorRef.current.getValue().length));
            const cursorPos = editorRef.current.posFromIndex(safeHead);
            const anchorPos = editorRef.current.posFromIndex(safeAnchor);
            const selectionStart = safeAnchor <= safeHead ? anchorPos : cursorPos;
            const selectionEnd = safeAnchor <= safeHead ? cursorPos : anchorPos;
            const userColor = color || '#00D4FF';

            const cursorEl = document.createElement('span');
            cursorEl.className = 'remote-cursor-widget';
            cursorEl.style.borderLeft = `2px solid ${userColor}`;

            const labelEl = document.createElement('span');
            labelEl.className = 'remote-cursor-label';
            labelEl.style.backgroundColor = userColor;
            labelEl.textContent = `${username || 'Guest'}`;
            cursorEl.appendChild(labelEl);

            const cursorMarker = editorRef.current.setBookmark(cursorPos, {
                widget: cursorEl,
                insertLeft: false,
            });

            const markers = [cursorMarker];
            if (safeAnchor !== safeHead) {
                const selectionMarker = editorRef.current.markText(selectionStart, selectionEnd, {
                    className: 'remote-selection',
                    css: `background: ${userColor}33; border-radius: 2px;`,
                });
                markers.push(selectionMarker);
            }

            remoteCursorMarkersRef.current[socketId] = markers;
        });
        socket.on("user-left", ({ socketId }) => {
            const markers = remoteCursorMarkersRef.current[socketId] || [];
            markers.forEach((marker) => marker?.clear?.());
            delete remoteCursorMarkersRef.current[socketId];
        });
        socket.on("run-result", ({ result, runBy: resultRunBy }) => {
            if (resultRunBy && resultRunBy !== currentUsername) {
                toast(`${resultRunBy} ran the code`, {
                    duration: 2000,
                    position: "bottom-right",
                });
                markPartnerActivity(resultRunBy);
            }
            markActivity(5);
            const languageConfig = LANGUAGE_OPTIONS[selectedLanguageRef.current] || LANGUAGE_OPTIONS[DEFAULT_LANGUAGE];
            const { stdout, stderr, compile_output, message, time, memory } = result || {};
            const statusDescription = String(result?.status?.description || result?.status?.status || "");
            const normalizedStdout = normalizeOutput(stdout || "");
            const normalizedExpectedOutput = normalizeOutput(expectedOutput);
            const hasCompileError = Boolean(compile_output);
            const isTleSignal = /time limit exceeded|timeout/i.test(`${statusDescription} ${stderr || ""} ${message || ""}`);
            const hasRuntimeError = Boolean(stderr) && !isTleSignal;
            const sampleMatched =
                normalizedExpectedOutput &&
                !hasCompileError &&
                !hasRuntimeError &&
                normalizedStdout === normalizedExpectedOutput;
            const sampleMismatched =
                normalizedExpectedOutput &&
                !hasCompileError &&
                !hasRuntimeError &&
                normalizedStdout !== normalizedExpectedOutput;

            setRunBy(resultRunBy || '');
            setLastRunMeta({
                languageLabel: languageConfig.label,
                hasStdin: sampleInput.trim().length > 0,
                inputSource: sampleInput.trim().length > 0 ? "sample" : "none",
                status: hasCompileError ? "Compilation Error" : hasRuntimeError ? "Runtime Error" : "Completed",
                time: formatExecutionTime(time),
                memory: formatMemoryUsage(memory),
                sampleCheck: sampleMatched ? "passed" : sampleMismatched ? "mismatch" : normalizedExpectedOutput ? "not_checked" : "not_available",
                updatedAt: Date.now(),
            });

            const status =
                hasCompileError
                    ? "CE"
                    : isTleSignal
                        ? "TLE"
                        : hasRuntimeError
                            ? "RE"
                            : normalizedExpectedOutput && !sampleMatched
                                ? "WA"
                                : /accepted/i.test(statusDescription)
                                    ? "AC"
                                    : "AC";
            setRunVisualState(status === "AC" ? "success" : status === "TLE" ? "tle" : "error");
            setRunFeedbackTone(status);
            window.setTimeout(() => setRunFeedbackTone(""), status === "WA" ? 500 : status === "TLE" ? 500 : 350);
            const currentRunCount = runCountRef.current + 1;
            const waBeforeThisRun = waCountRef.current;
            if (status === "WA") {
                waCountRef.current = waCountRef.current + 1;
            }
            runCountRef.current = currentRunCount;
            if (status === "AC" && !hasCelebratedAcceptedRun) {
                confetti({
                    particleCount: 160,
                    spread: 90,
                    origin: { x: 0.5, y: 0 },
                    colors: ["#00D4FF", "#1E90FF", "#00F5FF", "#7C5CFF"],
                    ticks: 240,
                });
                window.setTimeout(() => {
                    confetti({
                        particleCount: 120,
                        spread: 110,
                        origin: { x: 0.5, y: 0.05 },
                        colors: ["#00D4FF", "#1E90FF", "#00F5FF", "#7C5CFF"],
                        ticks: 220,
                    });
                }, 350);
                setHasCelebratedAcceptedRun(true);
            }
            if (celebrationTimeoutRef.current) {
                window.clearTimeout(celebrationTimeoutRef.current);
            }
            celebrationTimeoutRef.current = window.setTimeout(() => {
                setCelebrationResult({
                    status,
                    stdout: stdout || "",
                    stderr: `${compile_output || ""}${compile_output && stderr ? "\n" : ""}${stderr || ""}`,
                    time,
                    memory,
                    runBy: resultRunBy || "Guest",
                    runCount: currentRunCount,
                    waCount: waBeforeThisRun,
                    sessionDuration: Math.floor((Date.now() - sessionStartedAtRef.current) / 1000),
                    expectedOutput: normalizedExpectedOutput,
                    actualOutput: normalizedStdout,
                    problemTitle: roomState?.problem?.title || "Practice Problem",
                    language: languageConfig.label,
                });
                setShowCelebration(true);
            }, 800);

            const nextOutput = (
                <div className="space-y-4 text-sm">
                    {sampleMatched && <OutputSection tone="success" title="Passed Sample">Actual output matches the expected output for the shared sample test case.</OutputSection>}
                    {sampleMismatched && <ComparisonPanel expectedOutput={expectedOutput} actualOutput={stdout} />}
                    {compile_output && <OutputSection tone="warning" title="Compilation Error">{compile_output}</OutputSection>}
                    {stderr && <OutputSection tone="error" title="Runtime Error">{stderr}</OutputSection>}
                    {stdout && <OutputSection tone="success" title="Program Output">{stdout}</OutputSection>}
                    {message && <OutputSection tone="info" title="System Message">{message}</OutputSection>}
                </div>
            );
            window.setTimeout(() => {
                setOutput(nextOutput);
                setShowOutputModal(true);
            }, 800);
        });
        socket.on("run-error", ({ error }) => {
            const message = error || "Run request failed";
            toast.error(message);
            setRunVisualState("error");
            setLastRunMeta((prev) => ({
                ...(prev || {}),
                status: "Request Failed",
            }));
        });
        socket.on("language-change", ({ language }) => {
            if (!LANGUAGE_OPTIONS[language]) return;

            // Don't override if this is a user-initiated change (to prevent echo)
            if (isUserLanguageChangeRef.current) return;

            selectedLanguageRef.current = language;
            setSelectedLanguage(language);
            editorRef.current?.setOption("mode", LANGUAGE_OPTIONS[language].editorMode);

            const cur = editorRef.current?.getValue() ?? "";
            if (codeIsSafeToReplaceForLanguageSwitch(cur)) {
                const nextCode = LANGUAGE_OPTIONS[language].starterCode;
                editorRef.current?.setValue(nextCode);
                socketRef.current?.emit("code-change", { roomId, code: nextCode });
            }
        });

        return () => {
            socket.off("code-change", handleCodeChange);
            socket.off("user-color-assigned");
            socket.off("remote-cursor-update");
            socket.off("user-left");
            socket.off("run-result");
            socket.off("run-error");
            socket.off("language-change");
            Object.values(remoteCursorMarkersRef.current).forEach((markers) => {
                markers.forEach((marker) => marker?.clear?.());
            });
            remoteCursorMarkersRef.current = {};
        };
    }, [socketRef, roomId, currentSocketId, currentUsername, expectedOutput, hasCelebratedAcceptedRun, markActivity, markPartnerActivity, sampleInput, roomState?.problem?.title, users]);

    // AI Hint Keymap
    useEffect(() => {
        const cm = editorRef.current;
        if (!cm) return;

        // Keymap
        cm.addKeyMap({
            "Ctrl-Space": fetchHint,
            Tab: () => {
                if (ghostHint) acceptGhostHint();
                else cm.replaceSelection("\t");
            },
            Esc: () => {
                // Clear ghost hint if available
                if (ghostHint) {
                    // Assuming there's a clearGhostHint function or we can set ghostHint to null
                    // This would need to be implemented in the useAIHint hook
                }
            },
        });
    }, [ghostHint, fetchHint, acceptGhostHint]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown) {
                const dropdown = event.target.closest('.ai-dropdown');
                const aiButton = event.target.closest('.ai-button');

                if (!dropdown && !aiButton) {
                    closeDropdown();
                }
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown, closeDropdown]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSettings && settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        };

        if (showSettings) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showSettings]);

    useEffect(() => {
        if (!isTimerRunning) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setTimeRemaining((currentValue) => (currentValue <= 1 ? 0 : currentValue - 1));
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [
        createMockSummaryShare,
        currentUsername,
        driverUser?.username,
        isCandidateRole,
        isInterviewerRole,
        isMockMode,
        isTimerRunning,
        lastRunMeta?.sampleCheck,
        lastRunMeta?.status,
        navigatorUser?.username,
        output,
        roomId,
        roomState?.problem?.title,
        session,
        socketRef,
        timerDuration,
    ]);

    useEffect(() => {
        if (!isMockMode || timeRemaining !== 0 || !isTimerRunning) {
            return;
        }

        const finishMockRound = async () => {
            setIsTimerRunning(false);

            const snapshot = {
                capturedAt: new Date().toISOString(),
                durationLabel: formatTimerLabel(timerDuration),
                timerFinished: true,
                candidate: isCandidateRole ? currentUsername : driverUser?.username || currentUsername,
                interviewer: isInterviewerRole ? currentUsername : navigatorUser?.username || 'Not assigned',
                problemTitle: roomState?.problem?.title || 'Untitled Practice Problem',
                latestRunStatus: lastRunMeta?.status || 'Not run yet',
                latestSampleCheck: lastRunMeta?.sampleCheck || 'n/a',
                codeLength: (editorRef.current?.getValue() || '').trim().length,
                linesWritten: editorRef.current?.lineCount?.() || 0,
                finalOutputPreview: typeof output === 'string' ? output : '',
            };
            const shareId = await createMockSummaryShare(snapshot);

            socketRef.current?.emit('session-update', {
                roomId,
                session: {
                    ...session,
                    mockLocked: true,
                    mockSummary: {
                        ...snapshot,
                        shareId,
                    },
                },
            });
            toast.success("Mock timer complete. Session snapshot saved.");

            if (getAuthToken()) {
                try {
                    const intelRes = await axios.post(
                        `${serverUrl}/api/session-intelligence/report`,
                        {
                            roomId,
                            saveShare: true,
                            endSession: true,
                            endReason: "mock_timer",
                        },
                        { headers: getAuthHeaders() },
                    );
                    if (intelRes.data?.shareId) {
                        setLastShareId(intelRes.data.shareId);
                        setLastReportPayload(intelRes.data.report);
                        setIsOutputCollapsed(false);
                        setIsNewReport(true);
                        setShowReportModal(true);
                        toast.success("Session intelligence report saved.");
                    }
                } catch {
                    /* optional — room may have no intelligence events yet */
                }
            }
        };

        finishMockRound();
    }, [
        createMockSummaryShare,
        currentUsername,
        driverUser?.username,
        isCandidateRole,
        isInterviewerRole,
        isMockMode,
        isTimerRunning,
        lastRunMeta?.sampleCheck,
        lastRunMeta?.status,
        navigatorUser?.username,
        output,
        roomId,
        roomState?.problem?.title,
        session,
        serverUrl,
        socketRef,
        timeRemaining,
        timerDuration,
    ]);

    const handleTimerPresetChange = (event) => {
        const nextDuration = Number(event.target.value);
        setTimerDuration(nextDuration);
        setTimeRemaining(nextDuration);
        setIsTimerRunning(false);
        if (isMockMode && session.mockLocked) {
            socketRef.current?.emit('session-update', {
                roomId,
                session: {
                    ...session,
                    mockLocked: false,
                },
            });
        }
    };

    const handleTimerToggle = () => {
        if (timeRemaining === 0) {
            setTimeRemaining(timerDuration);
        }

        setIsTimerRunning((currentValue) => !currentValue);
    };

    const handleTimerReset = () => {
        setIsTimerRunning(false);
        setTimeRemaining(timerDuration);
        if (isMockMode && session.mockLocked) {
            socketRef.current?.emit('session-update', {
                roomId,
                session: {
                    ...session,
                    mockLocked: false,
                },
            });
        }
    };

    const syncCodeToRoom = (nextCode) => {
        socketRef.current?.emit("code-change", {
            roomId,
            code: nextCode,
        });
    };

    const applyLanguageSwitch = useCallback((next) => {
        if (!LANGUAGE_OPTIONS[next]) return;

        const prevLang = selectedLanguageRef.current;
        if (prevLang === next) return;

        const nextCode = LANGUAGE_OPTIONS[next].starterCode;

        setCollabHintDismissed(false);
        isUserLanguageChangeRef.current = true;
        selectedLanguageRef.current = next;
        setSelectedLanguage(next);
        editorRef.current?.setOption("mode", LANGUAGE_OPTIONS[next].editorMode);
        editorRef.current?.setValue(nextCode);
        socketRef.current?.emit("code-change", { roomId, code: nextCode });
        socketRef.current?.emit("language-change", { roomId, language: next });
    }, [roomId]);

    const handleLanguageChange = useCallback((event) => {
        const next = event.target.value;
        if (!LANGUAGE_OPTIONS[next]) return;

        const prevLang = selectedLanguageRef.current;
        if (prevLang === next) return;

        const currentCode = editorRef.current?.getValue() ?? "";
        const safeReplace = codeIsSafeToReplaceForLanguageSwitch(currentCode);
        if (!safeReplace) {
            setPendingLanguage(next);
            setShowLanguageSwitchModal(true);
            return;
        }

        applyLanguageSwitch(next);
    }, [applyLanguageSwitch]);

    const handleResetCode = () => {
        setCollabHintDismissed(false);
        const nextCode = LANGUAGE_OPTIONS[selectedLanguageRef.current].starterCode;
        editorRef.current?.setValue(nextCode);
        syncCodeToRoom(nextCode);
    };

    const handleOpenClearConfirm = () => {
        if (!editorUnlocked) return;
        setShowClearConfirmModal(true);
    };

    const handleConfirmClear = () => {
        if (clearConfirmCountdown > 0) return;
        const currentCode = editorRef.current?.getValue() ?? "";
        lastClearedCodeRef.current = currentCode;
        if (clearUndoTimeoutRef.current) {
            window.clearTimeout(clearUndoTimeoutRef.current);
        }
        setCanUndoClear(true);
        clearUndoTimeoutRef.current = window.setTimeout(() => {
            setCanUndoClear(false);
            lastClearedCodeRef.current = "";
            clearUndoTimeoutRef.current = null;
        }, 30000);
        handleResetCode();
        setShowClearConfirmModal(false);
    };

    const handleUndoClear = () => {
        if (!canUndoClear || !lastClearedCodeRef.current) return;
        const previousCode = lastClearedCodeRef.current;
        editorRef.current?.setValue(previousCode);
        syncCodeToRoom(previousCode);
        setCanUndoClear(false);
        lastClearedCodeRef.current = "";
        if (clearUndoTimeoutRef.current) {
            window.clearTimeout(clearUndoTimeoutRef.current);
            clearUndoTimeoutRef.current = null;
        }
    };

    const handleShareRunCard = async () => {
        if (lastShareId) {
            const url = `${window.location.origin}/report/${lastShareId}`;
            await navigator.clipboard.writeText(url);
            toast.success("Share link copied");
            return;
        }
        await generateSessionReport({ endSession: false });
    };

    const handleRunOverlayHint = () => {
        setShowAnalysisModal(true);
        void fetchAIHints();
    };

    const handleShareSessionCard = async () => {
        try {
            if (!lastReportPayload) {
                throw new Error("Generate a session report first");
            }
            if (shareCardCaptureRef.current) {
                const dataUrl = await toPng(shareCardCaptureRef.current, {
                    cacheBust: true,
                    pixelRatio: 2,
                });
                const link = document.createElement("a");
                link.download = "Axion-session.png";
                link.href = dataUrl;
                link.click();
            }

            const shareUrl = lastShareId
                ? `${window.location.origin}/report/${lastShareId}`
                : window.location.href;
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Session image downloaded and link copied");
        } catch (error) {
            const msg =
                error?.response?.data?.error ||
                error?.message ||
                "Could not prepare the session share card";
            toast.error(msg);
        }
    };
    const runCode = async () => {
        if (!canRunInCurrentMode) {
            toast.error("Only the Driver can run code in mock mode.");
            return;
        }
        setRunButtonAnimating(true);
        window.setTimeout(() => setRunButtonAnimating(false), 150);
        markActivity(5);
        const currentCode = editorRef.current.getValue();
        const autoFormattedCode = formatCode(selectedLanguageRef.current, currentCode);
        const rawCode = autoFormattedCode !== currentCode ? autoFormattedCode : currentCode;
        if (rawCode !== currentCode) {
            editorRef.current.setValue(rawCode);
            syncCodeToRoom(rawCode);
            setShowFormattedFlash(true);
        }
        const languageConfig = LANGUAGE_OPTIONS[selectedLanguageRef.current] || LANGUAGE_OPTIONS[DEFAULT_LANGUAGE];
        const fallbackSampleInput = sampleInput.trim();
        const effectiveStdin = sampleInput;
        const inputSource = fallbackSampleInput.length > 0 ? "sample" : "none";
        const normalizedExpectedOutput = normalizeOutput(expectedOutput);
        setActiveRightTab("output");
        setRunVisualState("compiling");

        setLastRunMeta({
            languageLabel: languageConfig.label,
            hasStdin: effectiveStdin.trim().length > 0,
            inputSource,
            status: "Running",
            time: null,
            memory: null,
            sampleCheck: normalizedExpectedOutput ? "pending" : "not_available",
            updatedAt: Date.now(),
        });
        setOutput(
            <div className="rounded-2xl border border-[#1E90FF]/30 bg-[#1E90FF]/[0.08] backdrop-blur-md p-4">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[#7dd3fc] font-medium">Compiling...<span className="workspace-blink-cursor">|</span></span>
                </div>
            </div>
        );

        try {
            const ack = await new Promise((resolve) => {
                const timeoutId = window.setTimeout(() => {
                    resolve({ ok: false, error: "Realtime run request timed out" });
                }, 15000);

                socketRef.current?.emit("run-code", {
                    roomId,
                    code: rawCode,
                    languageId: languageConfig.judge0Id,
                    stdin: effectiveStdin,
                }, (payload) => {
                    window.clearTimeout(timeoutId);
                    resolve(payload);
                });
            });

            if (!ack?.ok) {
                throw new Error(ack?.error || "Run request failed");
            }
        } catch (error) {
            const runErrorMessage =
                error?.response?.data?.error ||
                error?.message ||
                "Run request failed";
            setLastRunMeta({
                languageLabel: languageConfig.label,
                hasStdin: effectiveStdin.trim().length > 0,
                inputSource,
                status: "Request Failed",
                time: null,
                memory: null,
                sampleCheck: normalizedExpectedOutput ? "not_checked" : "not_available",
            });
            setOutput(
                <div className="text-rose-300 p-4">
                    <p>Error running code: {runErrorMessage}</p>
                </div>
            );
            setShowOutputModal(true);
            toast.error(runErrorMessage);
            setRunVisualState("error");
        }
    };

    const generateSessionReport = async (options = {}) => {
        const { endSession = false, endReason = "manual", wholeRoom = false } = options;
        setReportLoading(true);
        try {
            const res = await axios.post(
                `${serverUrl}/api/session-intelligence/report`,
                {
                    roomId,
                    saveShare: true,
                    endSession,
                    endReason: endSession ? endReason : undefined,
                    personal: wholeRoom ? "all" : undefined,
                },
                { headers: getAuthHeaders() },
            );
            setLastReportPayload(res.data.report);
            setPreviousReportPayload(res.data.previousReport || null);
            setLastShareId(res.data.shareId || "");
            setIsOutputCollapsed(false);
            setIsNewReport(true);
            setShowReportModal(true);
            if (res.data.newTitle) {
                setUnlockedTitle(res.data.newTitle);
            }
            toast.success("Session intelligence report is ready.");
        } catch (error) {
            const msg =
                error?.response?.data?.error ||
                error?.message ||
                "Could not generate report";
            toast.error(msg);
        } finally {
            setReportLoading(false);
        }
    };

    const handleUseHiddenTestAsSample = (test) => {
        if (!socketRef?.current || !test) return;
        const input = String(test.input || "").trim();
        const output = String(test.expectedOutput ?? test.actualOutput ?? "").trim();
        if (!input || !output) {
            toast.error("This test needs a captured output before it can be added.");
            return;
        }

        const baseProblem = roomState?.problem || {};
        const existingSamples = Array.isArray(baseProblem.samples) ? baseProblem.samples : [];
        const alreadyExists = existingSamples.some(
            (sample) => String(sample.input || "").trim() === input && String(sample.output || "").trim() === output,
        );
        if (alreadyExists) {
            toast.success("That sample test is already in the brief.");
            return;
        }

        const nextSamples = [
            ...existingSamples,
            {
                id: `sample-${existingSamples.length + 1}`,
                input,
                output,
            },
        ];
        const appendBlock = (prev, next) => (String(prev || "").trim() ? `${String(prev).trim()}\n\n${next}` : next);
        const nextProblem = {
            ...baseProblem,
            sampleInput: appendBlock(baseProblem.sampleInput, input),
            sampleOutput: appendBlock(baseProblem.sampleOutput, output),
            samples: nextSamples,
        };

        socketRef.current.emit("problem-update", {
            roomId,
            problem: nextProblem,
        });
        toast.success("Added hidden test as sample case");
    };

    const submitSamples = async () => {
        if (!canRunInCurrentMode) {
            toast.error("Only the Driver can run code in mock mode.");
            return;
        }
        markActivity(5);
        const samples = roomState?.problem?.samples || [];
        if (!samples.length) {
            toast.error("Add sample tests in the brief (parsed samples) before submitting.");
            return;
        }
        const rawCode = editorRef.current?.getValue() || "";
        const languageConfig =
            LANGUAGE_OPTIONS[selectedLanguageRef.current] || LANGUAGE_OPTIONS[DEFAULT_LANGUAGE];
        setActiveRightTab("output");
        setLastRunMeta({
            languageLabel: languageConfig.label,
            hasStdin: true,
            inputSource: "suite",
            status: "Submitting samples...",
            time: null,
            memory: null,
            sampleCheck: "pending",
            updatedAt: Date.now(),
        });
        setOutput(
            <div className="rounded-2xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.08] backdrop-blur-md p-4">
                <p className="text-sm font-medium text-[#e4defc]">Compiling...<span className="workspace-blink-cursor">|</span></p>
            </div>,
        );
        try {
            const { data } = await axios.post(
                `${serverUrl}/api/run-sample-suite`,
                {
                    code: rawCode,
                    languageId: languageConfig.judge0Id,
                    samples,
                    roomId,
                },
                { headers: getAuthHeaders() },
            );
            const { results, summary } = data;
            const allPass = summary?.failed === 0 && summary?.passed === summary?.total;
            setLastRunMeta({
                languageLabel: languageConfig.label,
                hasStdin: true,
                inputSource: "suite",
                status: allPass ? "All samples passed" : "Some samples failed",
                time: null,
                memory: null,
                sampleCheck: allPass ? "passed" : "mismatch",
                updatedAt: Date.now(),
            });
            const blocks = <ProgressiveSampleSuiteResults allPass={allPass} summary={summary} results={results || []} />;
            setOutput(blocks);
            setShowOutputModal(true);
            if (allPass) {
                toast.success("All parsed samples passed.");
            } else {
                toast.error("Sample suite reported failures.");
            }
        } catch (error) {
            const msg = error?.response?.data?.error || error?.message || "Submit failed";
            toast.error(msg);
            setLastRunMeta((prev) => ({
                ...(prev || {}),
                status: "Submit failed",
                sampleCheck: "not_checked",
                updatedAt: Date.now(),
            }));
        }
    };

    /* editorContentVersion bumps on each CodeMirror change so visibility recomputes when the buffer updates. */
    const collaborationHintVisible = useMemo(() => {
        if (collabHintDismissed || !editorRef.current) return false;
        return codeMatchesLanguageStarter(editorRef.current.getValue(), selectedLanguage);
    }, [collabHintDismissed, selectedLanguage, editorContentVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- editorContentVersion is an intentional invalidation signal

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#081120]">
            <style>{`
                @keyframes axionDrift {
                    0%, 100% { transform: translate3d(0,0,0) scale(1); }
                    50% { transform: translate3d(2%, -3%, 0) scale(1.05); }
                }
                @keyframes axionGridPan {
                    0% { background-position: 0 0; }
                    100% { background-position: 64px 64px; }
                }
                .Axion-bg-grid {
                    background-image:
                        linear-gradient(rgba(0,212,255,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,212,255,0.05) 1px, transparent 1px);
                    background-size: 64px 64px;
                    animation: axionGridPan 40s linear infinite;
                }
                .Axion-bg-glow-a { animation: axionDrift 22s ease-in-out infinite; }
                .Axion-bg-glow-b { animation: axionDrift 26s ease-in-out infinite reverse; }
                @media (prefers-reduced-motion: reduce) {
                    .Axion-bg-grid, .Axion-bg-glow-a, .Axion-bg-glow-b { animation: none !important; }
                }
            `}</style>

            {/* Ambient background layer */}
            <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                <div className="Axion-bg-grid absolute inset-0 opacity-70" />
                <div className="Axion-bg-glow-a absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-[#1E90FF]/20 blur-[110px]" />
                <div className="Axion-bg-glow-b absolute -right-24 top-1/3 h-[24rem] w-[24rem] rounded-full bg-[#7C5CFF]/20 blur-[120px]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,28,52,0)_0%,rgba(5,10,20,0.6)_100%)]" />
            </div>

            {unlockedTitle ? (
                <div className="pointer-events-none fixed inset-0 z-[10001] flex items-center justify-center bg-[#03070f]/60 backdrop-blur-sm">
                    <div className="rounded-3xl border border-[#00D4FF]/40 bg-[#0b1730]/95 px-10 py-8 text-center text-white shadow-[0_0_60px_-10px_rgba(0,212,255,0.6)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00D4FF]">Title Unlocked</p>
                        <div className="mt-4 text-4xl">🏆</div>
                        <p className="mt-4 text-2xl font-bold text-[#00D4FF]">{unlockedTitle}</p>
                    </div>
                </div>
            ) : null}
            {lastReportPayload ? (
                <div className="pointer-events-none absolute -left-[9999px] top-0">
                    <div
                        ref={shareCardCaptureRef}
                        className="h-[630px] w-[1200px] px-14 py-12 text-white"
                        style={{ background: "linear-gradient(135deg, #081120 0%, #0d1a30 55%, #101c34 100%)" }}
                    >
                        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#00D4FF]">Axion</p>
                        <p className="mt-2 text-5xl font-black">{roomState?.problem?.title || "Untitled Practice Session"}</p>
                        <div className="mt-6 inline-flex rounded-full bg-gradient-to-r from-[#00D4FF] to-[#1E90FF] px-5 py-2 text-3xl font-bold text-[#081120]">
                            {lastReportPayload.sessionScore} / 100
                        </div>
                        <div className="mt-8 flex items-center gap-8 text-2xl">
                            {users.slice(0, 2).map((user) => (
                                <div key={user.socketId} className="flex items-center gap-3">
                                    <span className="text-3xl">{getAvatarById(user.avatarId || "clever-fox").emoji}</span>
                                    <span>{user.username}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 grid grid-cols-2 gap-6 text-xl text-[#91A8C3]">
                            <p>Language: {LANGUAGE_OPTIONS[selectedLanguageRef.current]?.label || "C++"}</p>
                            <p>Duration: {formatDuration(Math.floor((Date.now() - sessionStartedAtRef.current) / 1000))}</p>
                            <p>Date: {new Date().toLocaleDateString()}</p>
                            <p>URL: fork-space.vercel.app</p>
                        </div>
                        <p className="mt-10 max-w-4xl text-lg leading-8 text-[#cfe4f7]">{lastReportPayload.howYouThink}</p>
                    </div>
                </div>
            ) : null}
            <div className="relative z-10 h-[2px] w-full bg-[rgba(0,212,255,0.08)]">
                <div
                    className={`h-full transition-[width] duration-500 shadow-[0_0_10px_1px_rgba(0,212,255,0.6)] ${roomEnergyTone}`}
                    style={{ width: `${roomEnergyPercent}%` }}
                />
            </div>
            {showOutputModal && output && (
                <OverlayPanel
                    title={lastRunMeta?.inputSource === "suite" ? "Submission Output" : "Run Output"}
                    subtitle="Execution Results"
                    onClose={() => setShowOutputModal(false)}
                >
                    <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="rounded-[1.35rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91A8C3]">Language</p>
                                <p className="mt-2 text-sm font-semibold text-[#EAF6FF]">{lastRunMeta?.languageLabel || LANGUAGE_OPTIONS[selectedLanguageRef.current].label}</p>
                            </div>
                            <div className="rounded-[1.35rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91A8C3]">Status</p>
                                <p className="mt-2 text-sm font-semibold text-[#EAF6FF]">{lastRunMeta?.status || 'idle'}</p>
                            </div>
                            <div className="rounded-[1.35rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91A8C3]">Execution Time</p>
                                <p className="mt-2 text-sm font-semibold text-[#EAF6FF]">{lastRunMeta?.time ?? 'Not run yet'}</p>
                            </div>
                            <div className="rounded-[1.35rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.65)] backdrop-blur-xl p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91A8C3]">Memory</p>
                                <p className="mt-2 text-sm font-semibold text-[#EAF6FF]">{lastRunMeta?.memory ?? 'Not run yet'}</p>
                            </div>
                        </div>
                        <div className={`rounded-[1.5rem] border bg-[rgba(16,28,52,0.6)] backdrop-blur-xl p-5 ${runFeedbackTone === "AC" ? "workspace-output-success border-cyan-400/40 shadow-[0_0_30px_-10px_rgba(0,245,255,0.5)]" : runFeedbackTone === "WA" ? "workspace-output-wa border-rose-400/40 shadow-[0_0_30px_-10px_rgba(255,80,110,0.5)]" : runFeedbackTone === "TLE" ? "workspace-output-tle border-[#7C5CFF]/40 shadow-[0_0_30px_-10px_rgba(124,92,255,0.5)]" : "border-[rgba(0,212,255,0.16)]"}`}>
                            {output}
                        </div>
                    </div>
                </OverlayPanel>
            )}
            {showReportModal && lastReportPayload ? (
                <OverlayPanel
                    title="Session Report"
                    subtitle="Session Intelligence"
                    onClose={() => setShowReportModal(false)}
                >
                    <div className="space-y-4">
                        <SessionIntelligenceReportDashboard
                            report={lastReportPayload}
                            previousReport={previousReportPayload}
                            title={roomState?.problem?.title || "Practice session"}
                            variant="standalone"
                        />
                        {lastShareId ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={handleShareSessionCard}
                                    className="w-full rounded-xl border border-cyan-400/40 bg-cyan-400/[0.08] px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/[0.14] hover:shadow-[0_0_18px_-4px_rgba(0,245,255,0.6)]"
                                >
                                    Share Card
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const url = `${window.location.origin}/report/${lastShareId}`;
                                        await navigator.clipboard.writeText(url);
                                        toast.success("Share link copied");
                                    }}
                                    className="w-full rounded-xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-3 py-2 text-sm font-medium text-[#EAF6FF] transition hover:border-[#00D4FF]/50"
                                >
                                    Copy report link
                                </button>
                            </div>
                        ) : null}
                    </div>
                </OverlayPanel>
            ) : null}
            {showAnalysisModal ? (
                <OverlayPanel
                    title="Solution Analysis"
                    subtitle="Session Intelligence"
                    onClose={() => setShowAnalysisModal(false)}
                >
                    <div className="space-y-5">
                        <div className="rounded-[1.4rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] backdrop-blur-xl p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowChecklist((v) => !v)}
                                    className="text-xs font-semibold uppercase tracking-wider text-[#91A8C3] hover:text-[#EAF6FF]"
                                >
                                    Edge Case Checklist {showChecklist ? "Hide" : "Show"}
                                </button>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-2 py-0.5 text-[#91A8C3]">
                                        {checklistCompleted}/{checklistTotal}
                                    </span>
                                    {criticalOpenCount > 0 && (
                                        <span className="rounded-full border border-rose-400/30 bg-rose-400/[0.08] px-2 py-0.5 text-rose-300">
                                            {criticalOpenCount} critical open
                                        </span>
                                    )}
                                </div>
                            </div>
                            {showChecklist ? (
                            <div className="grid grid-cols-1 gap-2">
                                {session.edgeCaseChecklist.map((item) => (
                                    <label key={item.id} className="group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-1.5 hover:border-[rgba(0,212,255,0.15)]">
                                        <input
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={() => toggleEdgeCase(item.id)}
                                            className="mt-0.5 h-4 w-4 rounded border-[rgba(0,212,255,0.3)] bg-transparent text-[#00D4FF] focus:ring-[#00D4FF]"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm ${item.checked ? 'text-[#91A8C3]/60 line-through' : 'text-[#cfe4f7]'}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                            {item.hint ? (
                                                <p className="mt-0.5 text-xs leading-5 text-[#91A8C3]">
                                                    {item.hint}
                                                </p>
                                            ) : null}
                                        </div>
                                    </label>
                                ))}
                            </div>
                            ) : (
                                <p className="text-sm text-[#91A8C3]">
                                    Checklist is collapsed so analysis stays focused. Expand when you want to verify edge cases.
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={reviewSolution}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#7C5CFF]/35 bg-[#7C5CFF]/[0.1] px-3 py-2 text-sm font-medium text-[#d8ccff] transition hover:bg-[#7C5CFF]/[0.18] hover:shadow-[0_0_18px_-4px_rgba(124,92,255,0.5)]"
                            >
                                {isReviewLoading ? <ButtonSpinner /> : null}
                                Re-run analysis
                            </button>
                            <button
                                type="button"
                                onClick={fetchAIHints}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-3 py-2 text-sm font-medium text-[#EAF6FF] transition hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/[0.08]"
                            >
                                {isLoading ? <ButtonSpinner /> : null}
                                Refresh AI Hints
                            </button>
                        </div>

                        <div className="rounded-[1.4rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] backdrop-blur-xl p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#91A8C3]">AI Hints</h3>
                                {isLoading ? <span className="text-[10px] text-[#00D4FF]">Loading...</span> : null}
                            </div>
                            {aiHints.length > 0 ? (
                                <div className="space-y-2">
                                    {aiHints.map((hint, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => applyHint(hint)}
                                            className="w-full rounded-xl border border-[rgba(0,212,255,0.15)] bg-[rgba(16,28,52,0.4)] p-3 text-left text-sm text-[#cfe4f7] transition hover:border-[#00D4FF]/40 hover:bg-[#00D4FF]/[0.06]"
                                        >
                                            {hint}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-[#91A8C3]">No suggestions available right now.</p>
                            )}
                        </div>

                        {renderReviewContent()}
                    </div>
                </OverlayPanel>
            ) : null}
            {showLanguageSwitchModal && pendingLanguage ? (
                <OverlayPanel
                    title="Switch Language?"
                    subtitle="Template Replacement Preview"
                    onClose={() => {
                        setShowLanguageSwitchModal(false);
                        setPendingLanguage(null);
                    }}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-[#cfe4f7]">
                            Your current code will be replaced with the starter template for {LANGUAGE_OPTIONS[pendingLanguage]?.label || pendingLanguage}.
                        </p>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.05] p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">Your current code (will be replaced)</p>
                                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg bg-[#050c18] p-3 font-mono text-xs leading-6 text-[#cfe4f7]">{editorRef.current?.getValue() ?? ""}</pre>
                            </div>
                            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">New starter template</p>
                                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg bg-[#050c18] p-3 font-mono text-xs leading-6 text-[#cfe4f7]">{LANGUAGE_OPTIONS[pendingLanguage]?.starterCode ?? ""}</pre>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowLanguageSwitchModal(false);
                                    setPendingLanguage(null);
                                }}
                                className="rounded-lg border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-4 py-2 text-sm font-medium text-[#EAF6FF] hover:border-[#00D4FF]/40"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    applyLanguageSwitch(pendingLanguage);
                                    setShowLanguageSwitchModal(false);
                                    setPendingLanguage(null);
                                }}
                                className="rounded-lg bg-gradient-to-r from-[#1E90FF] to-[#00D4FF] px-4 py-2 text-sm font-semibold text-[#081120] shadow-[0_0_20px_-4px_rgba(0,212,255,0.6)] hover:brightness-110"
                            >
                                Switch Language
                            </button>
                        </div>
                    </div>
                </OverlayPanel>
            ) : null}
            {showClearConfirmModal ? (
                <OverlayPanel
                    title="Clear Editor For Everyone?"
                    subtitle="Destructive Action"
                    onClose={() => setShowClearConfirmModal(false)}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-[#cfe4f7]">
                            Clear the editor for everyone in this room? This can&apos;t be undone.
                        </p>
                        <p className="text-xs text-[#91A8C3]">
                            Confirm unlocks after 2 seconds to prevent accidental data loss.
                        </p>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowClearConfirmModal(false)}
                                className="rounded-lg border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-4 py-2 text-sm font-medium text-[#EAF6FF] hover:border-[#00D4FF]/40"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmClear}
                                disabled={clearConfirmCountdown > 0}
                                className="rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(244,63,94,0.6)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {clearConfirmCountdown > 0 ? `Confirm in ${clearConfirmCountdown.toFixed(1)}s` : "Confirm Clear"}
                            </button>
                        </div>
                    </div>
                </OverlayPanel>
            ) : null}
            {showCelebration && celebrationResult ? (
                <RunResultOverlay
                    result={celebrationResult}
                    users={users.filter(Boolean).map((user) => ({
                        username: user.username || "Guest",
                        avatarId: user.avatarId || "clever-fox",
                    }))}
                    aiInsight={reviewContent?.summary || reviewContent?.complexity_reasoning || null}
                    complexityLabel={reviewContent?.time_complexity}
                    edgeCases={session.edgeCaseChecklist || []}
                    approachBoard={{ brute: session.mentorNotes || "", optimized: session.approachNotes || "" }}
                    onClose={() => setShowCelebration(false)}
                    onShareCard={() => {
                        void handleShareRunCard();
                    }}
                    onGetHint={handleRunOverlayHint}
                    currentUsername={currentUsername}
                />
            ) : null}

            <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-[rgba(0,212,255,0.12)] bg-[rgba(8,17,32,0.75)] backdrop-blur-xl px-4 py-2.5">
                    <button
                        data-cursor="button"
                        data-run-state={runVisualState}
                        className={`workspace-run-button inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E90FF] to-[#00D4FF] px-4 text-[15px] font-semibold text-[#081120] shadow-[0_0_20px_-4px_rgba(0,212,255,0.6)] transition-[transform,box-shadow] duration-150 hover:shadow-[0_0_28px_-2px_rgba(0,212,255,0.85)] hover:brightness-105 disabled:pointer-events-none disabled:opacity-50 ${runButtonAnimating ? "scale-105" : "scale-100"}`}
                        onClick={runCode}
                        disabled={!canRunInCurrentMode || isRunBusy}
                        title={canRunInCurrentMode ? 'Run code for everyone in this room' : 'Only the Driver can run code in mock mode'}
                    >
                        {isRunBusy ? <ButtonSpinner /> : (
                            <svg className="workspace-run-button-icon h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        )}
                        {isRunBusy ? "Running..." : "Run"}
                    </button>
                    {showFormattedFlash ? (
                        <span className="inline-flex h-8 items-center rounded-full border border-cyan-400/40 bg-cyan-400/[0.1] px-3 text-xs font-semibold text-cyan-200">
                            Formatted
                        </span>
                    ) : null}
                    <button
                        data-cursor="button"
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#00D4FF]/45 bg-[rgba(16,28,52,0.5)] px-4 text-[15px] text-[#7dd3fc] transition-colors hover:bg-[#00D4FF]/[0.1] hover:shadow-[0_0_16px_-4px_rgba(0,212,255,0.5)] disabled:pointer-events-none disabled:opacity-50"
                        onClick={submitSamples}
                        disabled={!canRunInCurrentMode || isSubmitBusy}
                        title={canRunInCurrentMode ? "Run all parsed sample tests (Judge0)" : "Only the Driver can submit in mock mode"}
                    >
                        {isSubmitBusy ? <ButtonSpinner /> : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {isSubmitBusy ? "Submitting..." : "Submit"}
                    </button>
                    {partnerIdle ? (
                        <span className="ml-2 text-sm italic text-[#91A8C3]">{partnerUser?.username} seems to be thinking...</span>
                    ) : null}
                    <span className="mx-1 h-5 w-px bg-[rgba(0,212,255,0.15)]" />
                    <button
                        type="button"
                        data-cursor="button"
                        onClick={() => {
                            setShowAnalysisModal(true);
                            if (!reviewContent) {
                                void reviewSolution();
                            }
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.4)] px-3 text-[15px] text-[#cfe4f7] transition-colors hover:bg-[#00D4FF]/[0.08] hover:text-[#EAF6FF]"
                    >
                        {isReviewLoading ? <ButtonSpinner /> : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17l-4-4 4-4m6 8l4-4-4-4" />
                            </svg>
                        )}
                        Analyze
                    </button>
                    <button
                        type="button"
                        data-cursor="button"
                        onClick={() => {
                            if (lastReportPayload) {
                                setShowReportModal(true);
                                return;
                            }
                            void generateSessionReport({ endSession: false });
                        }}
                        disabled={reportLoading}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.4)] px-3 text-[15px] text-[#cfe4f7] transition-colors hover:bg-[#00D4FF]/[0.08] hover:text-[#EAF6FF] disabled:opacity-60"
                    >
                        {reportLoading ? <ButtonSpinner /> : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m3 6V7m3 10v-3m3 7H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                            </svg>
                        )}
                        {reportLoading ? "Working..." : "Report"}
                    </button>
                    <button
                        type="button"
                        data-cursor="button"
                        onClick={() => {
                            setActiveRightTab("tests");
                            setTestGenerateSignal((v) => v + 1);
                            setIsOutputCollapsed(false);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.4)] px-3 text-[15px] text-[#cfe4f7] transition-colors hover:bg-[#00D4FF]/[0.08] hover:text-[#EAF6FF]"
                        title="Generate hidden tests"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                        </svg>
                        Generate Tests
                        <span className="rounded-full border border-[#7C5CFF]/40 bg-[#7C5CFF]/[0.15] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c4b5fd]">
                            Beta
                        </span>
                    </button>
                    <button
                        type="button"
                        data-cursor="button"
                        onClick={() => setIsOutputCollapsed((prev) => !prev)}
                        className="hidden xl:inline-flex h-10 items-center gap-2 rounded-xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.4)] px-3 text-[15px] text-[#cfe4f7] transition-colors hover:bg-[#00D4FF]/[0.08] hover:text-[#EAF6FF]"
                        title={isOutputCollapsed ? "Show right sidebar" : "Collapse right sidebar"}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            {isOutputCollapsed ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6M4 5h2v14H4z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6M18 5h2v14h-2z" />
                            )}
                        </svg>
                        {isOutputCollapsed ? "Show Panel" : "Hide Panel"}
                    </button>
                    <button
                        data-cursor="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(0,212,255,0.2)] text-[#91A8C3] transition-colors hover:bg-[#00D4FF]/[0.08] hover:text-[#EAF6FF] disabled:pointer-events-none disabled:opacity-50"
                        onClick={handleOpenClearConfirm}
                        disabled={!editorUnlocked}
                        title={editorUnlocked ? 'Clear editor' : 'Only the active editor owner can clear code right now'}
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                        </svg>
                    </button>
                    {canUndoClear ? (
                        <button
                            type="button"
                            onClick={handleUndoClear}
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/[0.1] px-3 text-xs font-semibold text-[#d8ccff] hover:bg-[#7C5CFF]/[0.18]"
                            title="Undo clear (available for 30 seconds)"
                        >
                            Undo Clear
                        </button>
                    ) : null}
                    <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.55)] px-3 backdrop-blur-md">
                        <label htmlFor="language-select" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#91A8C3]">
                            Language
                        </label>
                        <select
                            id="language-select"
                            value={selectedLanguage}
                            onChange={handleLanguageChange}
                            disabled={!editorUnlocked}
                            title={LANGUAGE_OPTIONS[selectedLanguage]?.label || "Language"}
                            className="h-8 min-w-[138px] rounded-full border border-[rgba(0,212,255,0.25)] bg-[#0b1730] px-3 text-[15px] font-medium text-[#EAF6FF] shadow-sm outline-none transition focus:border-[#00D4FF] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.25)]"
                        >
                            {Object.entries(LANGUAGE_OPTIONS).map(([languageKey, config]) => (
                                <option key={languageKey} value={languageKey}>
                                    {`${config.optionGlyph ?? ""} ${config.label}`.trim()}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex h-10 items-center gap-2 rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.55)] px-3 backdrop-blur-md">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-[#00F5FF] shadow-[0_0_8px_2px_rgba(0,245,255,0.7)]"></div>
                        <span className="text-[15px] font-medium text-[#91A8C3]">{SESSION_MODE_LABELS[session.mode] || 'Peer Practice'}</span>
                    </div>
                        {(participationLabel === 'Driver' || participationLabel === 'Navigator') && (
                        <button
                            onClick={handleSwapRoles}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.55)] text-[#cfe4f7] transition hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/[0.08] hover:text-[#EAF6FF]"
                            title="Swap Roles"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </button>
                    )}
                        {users.length > 0 && (
                        <div className="flex h-9 items-center rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.55)] px-2 backdrop-blur-md">
                            {users.slice(0, 5).map((user, index) => {
                                if (!user) return null;
                                return (
                                    <div
                                        key={user.socketId}
                                        style={{ backgroundColor: user.color || '#1E90FF', marginLeft: index === 0 ? 0 : -6 }}
                                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#081120] text-sm shadow-[0_0_10px_-2px_rgba(0,212,255,0.6)]"
                                        title={`${user.username || "Guest"} (${user.role || "Peer"})`}
                                    >
                                        <AvatarGlyph avatar={getAvatarById(user.avatarId)} className="h-3.5 w-3.5" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                        {problemToolbarMeta && (
                        <div className="hidden min-w-0 max-w-[min(360px,42vw)] flex-col justify-center gap-1 rounded-xl border border-[rgba(0,212,255,0.14)] bg-[rgba(16,28,52,0.4)] px-3 py-1.5 text-left xl:flex">
                            <span className="truncate text-xs font-semibold text-[#EAF6FF]">
                                {problemToolbarMeta.title || "Practice problem"}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#91A8C3]">
                                {problemToolbarMeta.tags?.slice(0, 5).map((t) => (
                                    <span
                                        key={t}
                                        className="rounded-full border border-[rgba(0,212,255,0.16)] bg-[#00D4FF]/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#7dd3fc]"
                                    >
                                        {t}
                                    </span>
                                ))}
                                {problemToolbarMeta.rating != null && problemToolbarMeta.rating !== "" ? (
                                    <span className="whitespace-nowrap rounded-full border border-[rgba(0,212,255,0.16)] bg-[#00D4FF]/[0.06] px-2 py-0.5 text-[10px]">
                                        Rating {String(problemToolbarMeta.rating)}
                                    </span>
                                ) : null}
                                {problemToolbarMeta.diff ? (
                                    <span className="whitespace-nowrap rounded-full border border-[rgba(0,212,255,0.16)] bg-[#00D4FF]/[0.06] px-2 py-0.5 text-[10px]">
                                        {String(problemToolbarMeta.diff)}
                                    </span>
                                ) : null}
                                {problemToolbarMeta.solved != null ? (
                                    <span className="whitespace-nowrap rounded-full border border-[rgba(0,212,255,0.16)] bg-[#00D4FF]/[0.06] px-2 py-0.5 text-[10px]">
                                        {problemToolbarMeta.solved.toLocaleString()} solves
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    )}
                    {isMockMode && (
                            <div className="flex items-center gap-2 rounded-full border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.08] px-3 py-1.5 backdrop-blur-md">
                                <span className="min-w-[4.2rem] rounded-full border border-[#7C5CFF]/40 bg-[#7C5CFF]/[0.18] px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#e4defc]">
                                    {formatTimerLabel(timeRemaining)}
                                </span>
                                <select
                                    value={timerDuration}
                                    onChange={handleTimerPresetChange}
                                    className="h-9 rounded-xl border border-[rgba(0,212,255,0.2)] bg-[#0b1730] px-2 text-sm font-medium text-[#EAF6FF] shadow-sm outline-none transition focus:border-[#7C5CFF]"
                                >
                                    {TIMER_PRESETS.map((preset) => (
                                        <option key={preset.value} value={preset.value}>
                                            {preset.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleTimerToggle}
                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-3 text-sm font-medium text-[#EAF6FF] transition hover:border-[#00D4FF]/50"
                                >
                                    {isTimerRunning ? "Pause" : "Start"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleTimerReset}
                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-3 text-sm font-medium text-[#EAF6FF] transition hover:border-[#00D4FF]/50"
                                >
                                    Reset
                                </button>
                            </div>
                        )}
            </div>

            <div
                className="relative z-10 grid min-h-0 flex-1 grid-cols-1"
                style={
                    isOutputCollapsed || !isDesktopLayout
                        ? undefined
                        : { gridTemplateColumns: `minmax(0,1fr) 8px ${rightPanelWidthPct}%` }
                }
            >
                <div
                    data-cursor="editor"
                    className={`editor-wrapper relative min-h-[24rem] border-t xl:min-h-0 ${editorUnlocked
                    ? 'border-cyan-400/25 shadow-[inset_0_1px_0_0_rgba(0,245,255,0.15)]'
                    : 'border-rose-400/25 shadow-[inset_0_1px_0_0_rgba(255,80,110,0.15)]'
                    } bg-[rgba(8,17,32,0.5)]`}
                >
                    <textarea
                        id="realtimeEditor"
                        className="h-full w-full resize-none border-0 bg-transparent p-6 text-sm font-mono text-[#EAF6FF] outline-none"
                        placeholder=""
                    />
                    {collaborationHintVisible ? (
                        <div
                            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-8"
                            aria-hidden
                        >
                            <p className="max-w-sm text-center text-sm font-medium leading-relaxed text-[#91A8C3]/70 select-none">
                                Start coding together...
                            </p>
                        </div>
                    ) : null}
                </div>

                <div
                    onMouseDown={startPanelResize}
                    className={`${isOutputCollapsed ? 'hidden' : 'hidden xl:block'} cursor-col-resize border-t border-[rgba(0,212,255,0.14)] bg-[rgba(16,28,52,0.5)] hover:bg-[#00D4FF]/20`}
                    title="Resize panel"
                />

                <aside className={`${isOutputCollapsed ? 'hidden xl:hidden' : 'block'} overflow-hidden border-t border-[rgba(0,212,255,0.12)] bg-[rgba(8,17,32,0.55)] backdrop-blur-xl xl:h-full xl:flex-none xl:border-l xl:border-t-0`}>
                    <div className="flex h-full flex-col min-h-0">
                        <div className="flex flex-none items-center gap-2 border-b border-[rgba(0,212,255,0.12)] bg-[rgba(11,23,48,0.7)] px-4 py-2.5">
                            <div className="flex gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-rose-400/70"></div>
                                <div className="h-3 w-3 rounded-full bg-amber-300/70"></div>
                                <div className="h-3 w-3 rounded-full bg-cyan-300/70"></div>
                            </div>
                        </div>

                        <div className="flex-none border-b border-[rgba(0,212,255,0.12)] bg-[rgba(13,23,43,0.7)] px-4 py-3.5">
                            <div className="relative flex flex-wrap gap-2 rounded-[1.2rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(5,12,24,0.5)] p-1.5">
                                <div
                                    aria-hidden="true"
                                    className="absolute bottom-1 h-0.5 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#7C5CFF] shadow-[0_0_8px_1px_rgba(0,212,255,0.6)]"
                                    style={{
                                        left: `${rightTabIndicator.left}px`,
                                        width: `${rightTabIndicator.width}px`,
                                        transition: 'left 200ms ease, width 200ms ease',
                                    }}
                                />
                                {[
                                    { key: "output", label: "Output" },
                                    { key: "submissions", label: "Submissions" },
                                    { key: "tests", label: "Tests" },
                                ].map((tab) => {
                                    const isActive = activeRightTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            ref={(node) => {
                                                rightTabRefs.current[tab.key] = node;
                                            }}
                                            type="button"
                                            onClick={() => setActiveRightTab(tab.key)}
                                            data-cursor="button"
                                            className={`rounded-[0.95rem] border-b-2 px-3.5 py-2.5 text-sm transition ${isActive
                                                ? "border-[#00D4FF] text-[#EAF6FF] font-medium"
                                                : "border-transparent text-[#91A8C3] hover:text-[#cfe4f7]"
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-5">
                            {activeRightTab === "output" && (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {runBy && (
                                            <div className="rounded-full border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] px-3 py-1 text-xs font-medium text-[#cfe4f7]">
                                                Run by {runBy}
                                            </div>
                                        )}
                                        <div className="rounded-full border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] px-3 py-1 text-xs font-medium text-[#cfe4f7]">
                                            {lastRunMeta?.languageLabel || LANGUAGE_OPTIONS[selectedLanguageRef.current].label}
                                        </div>
                                        <div className="rounded-full border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] px-3 py-1 text-xs font-medium text-[#cfe4f7]">
                                            status: {lastRunMeta?.status || "idle"}
                                        </div>
                                        <div className={`rounded-full border px-3 py-1 text-xs font-medium ${lastRunMeta?.sampleCheck === "passed"
                                            ? "border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200"
                                            : lastRunMeta?.sampleCheck === "mismatch"
                                                ? "border-rose-400/30 bg-rose-400/[0.08] text-rose-200"
                                                : "border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] text-[#cfe4f7]"
                                            }`}>
                                            sample: {lastRunMeta?.sampleCheck === "passed"
                                                ? "passed"
                                                : lastRunMeta?.sampleCheck === "mismatch"
                                                    ? "mismatch"
                                                    : lastRunMeta?.sampleCheck === "pending"
                                                        ? "checking"
                                                        : lastRunMeta?.sampleCheck === "not_checked"
                                                            ? "not checked"
                                                            : "n/a"}
                                        </div>
                                        {lastRunMeta?.updatedAt ? (
                                            <div className="rounded-full border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] px-3 py-1 text-xs font-medium text-[#91A8C3]">
                                                updated {new Date(lastRunMeta.updatedAt).toLocaleTimeString()}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] px-3 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#91A8C3]">Execution Time</p>
                                            <p className="mt-1 text-lg font-semibold text-[#EAF6FF]">{lastRunMeta?.time ?? "Not run yet"}</p>
                                        </div>
                                        <div className="rounded-2xl border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] px-3 py-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#91A8C3]">Memory</p>
                                            <p className="mt-1 text-lg font-semibold text-[#EAF6FF]">{lastRunMeta?.memory ?? "Not run yet"}</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowOutputModal(true)}
                                        disabled={!output}
                                        className="inline-flex w-full items-center justify-center rounded-xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.55)] px-3 py-2 text-sm font-medium text-[#cfe4f7] transition hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Open large output
                                    </button>

                                    {output ? (
                                        <div className="rounded-[1.5rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] backdrop-blur-xl p-5">
                                            <div className="font-mono text-sm text-[#EAF6FF]">{output}</div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.35)] p-5 text-sm leading-7 text-[#91A8C3]">
                                            Run your code to see compiler output, runtime messages, and execution stats here.
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeRightTab === "submissions" && (
                                session.runHistory.length > 0 ? (
                                    <div className="space-y-3">
                                        {session.runHistory.map((run) => (
                                            <div key={run.id} className="rounded-[1.4rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-1.5 w-1.5 rounded-full ${run.passed ? 'bg-cyan-300' : 'bg-rose-400'}`}></div>
                                                        <span className="text-sm font-medium text-[#cfe4f7]">{run.status}</span>
                                                        <span className={`rounded-full px-2 py-0.5 text-xs ${run.sampleCheck === 'passed'
                                                            ? 'bg-cyan-400/10 text-cyan-200'
                                                            : run.sampleCheck === 'mismatch'
                                                                ? 'bg-rose-400/10 text-rose-200'
                                                                : 'bg-[rgba(0,212,255,0.08)] text-[#91A8C3]'
                                                            }`}>
                                                            {run.sampleCheck === 'passed' ? 'Passed sample' : run.sampleCheck === 'mismatch' ? 'Mismatch' : 'No check'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-[#91A8C3]">
                                                        <span>{formatExecutionTime(run.time)}</span>
                                                        <span>{formatMemoryUsage(run.memory)}</span>
                                                    </div>
                                                </div>
                                                {(run.stdin || run.stdout || run.expectedOutput) && (
                                                    <div className="mt-3 space-y-2">
                                                        {run.stdin ? (
                                                            <pre className="whitespace-pre-wrap rounded-lg bg-[#050c18] px-3 py-2 font-mono text-[11px] text-[#91A8C3]">{`stdin\n${run.stdin}`}</pre>
                                                        ) : null}
                                                        <div className="grid gap-2">
                                                            {run.stdout ? (
                                                                <pre className="whitespace-pre-wrap rounded-lg bg-[#050c18] px-3 py-2 font-mono text-[11px] text-[#91A8C3]">{`stdout\n${run.stdout}`}</pre>
                                                            ) : null}
                                                            {run.expectedOutput ? (
                                                                <pre className="whitespace-pre-wrap rounded-lg bg-[#050c18] px-3 py-2 font-mono text-[11px] text-[#91A8C3]">{`expected\n${run.expectedOutput}`}</pre>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.35)] p-5 text-sm leading-7 text-[#91A8C3]">
                                        Run your code to populate the last 5 executions here.
                                    </div>
                                )
                            )}

                            {activeRightTab === "ai" && (
                                <div className="space-y-5">
                                    <p className="text-xs leading-5 text-[#91A8C3]">
                                        Session Intelligence: edge checklist, AI hints, and solution review (same flow as before).
                                    </p>
                                    <div className="rounded-[1.4rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] p-4">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#91A8C3]">Edge Case Checklist</h3>
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <span className="rounded-full border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-2 py-0.5 text-[#91A8C3]">
                                                    {checklistCompleted}/{checklistTotal}
                                                </span>
                                                {criticalOpenCount > 0 && (
                                                    <span className="rounded-full border border-rose-400/30 bg-rose-400/[0.08] px-2 py-0.5 text-rose-300">
                                                        {criticalOpenCount} critical open
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {session.edgeCaseChecklist.map((item) => (
                                                <label key={item.id} className="group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-1.5 hover:border-[rgba(0,212,255,0.15)]">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.checked}
                                                        onChange={() => toggleEdgeCase(item.id)}
                                                        className="mt-0.5 h-4 w-4 rounded border-[rgba(0,212,255,0.3)] bg-transparent text-[#00D4FF] focus:ring-[#00D4FF]"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm ${item.checked ? 'text-[#91A8C3]/60 line-through' : 'text-[#cfe4f7]'}`}>
                                                                {item.label}
                                                            </span>
                                                            {!item.checked && item.priority === 'critical' && (
                                                                <span className="rounded-full border border-rose-400/30 bg-rose-400/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-300">
                                                                    Critical
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.hint && (
                                                            <p className="mt-0.5 text-xs leading-5 text-[#91A8C3]">
                                                                {item.hint}
                                                            </p>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={reviewSolution}
                                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#7C5CFF]/35 bg-[#7C5CFF]/[0.1] px-3 py-2 text-sm font-medium text-[#d8ccff] transition hover:bg-[#7C5CFF]/[0.18]"
                                        >
                                            Review solution
                                        </button>
                                        <button
                                            type="button"
                                            onClick={fetchAIHints}
                                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.55)] px-3 py-2 text-sm font-medium text-[#cfe4f7] transition hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/[0.08]"
                                        >
                                            Refresh AI Hints
                                        </button>
                                    </div>

                                    <div className="rounded-[1.4rem] border border-[rgba(0,212,255,0.16)] bg-[rgba(16,28,52,0.55)] p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#91A8C3]">AI Hints</h3>
                                            {isLoading ? <span className="text-[10px] text-[#00D4FF]">Loading...</span> : null}
                                        </div>
                                        {aiHints.length > 0 ? (
                                            <div className="space-y-2">
                                                {aiHints.map((hint, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => applyHint(hint)}
                                                        className="w-full rounded-xl border border-[rgba(0,212,255,0.15)] bg-[rgba(16,28,52,0.4)] p-3 text-left text-sm text-[#cfe4f7] transition hover:border-[#00D4FF]/40 hover:bg-[#00D4FF]/[0.06]"
                                                    >
                                                        {hint}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-[#91A8C3]">No suggestions available right now.</p>
                                        )}
                                    </div>

                                    {renderReviewContent()}
                                </div>
                            )}

                            {activeRightTab === "tests" && (
                                <HiddenTestPanel
                                    serverUrl={serverUrl}
                                    roomId={roomId}
                                    language={selectedLanguageRef.current}
                                    code={editorRef.current?.getValue?.() || ""}
                                    problem={roomState?.problem || {}}
                                    externalGenerateSignal={testGenerateSignal}
                                    onUseAsSampleTest={handleUseHiddenTestAsSample}
                                />
                            )}

                            {activeRightTab === "report" && (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            disabled={reportLoading}
                                            onClick={() => generateSessionReport({ endSession: false })}
                                            className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-xl border border-[#00D4FF]/35 bg-[#00D4FF]/[0.1] px-3 py-2 text-sm font-medium text-[#7dd3fc] transition hover:bg-[#00D4FF]/[0.18] disabled:opacity-60"
                                        >
                                            {reportLoading ? "Working…" : "Generate Report"}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={reportLoading}
                                            onClick={() =>
                                                generateSessionReport({
                                                    endSession: true,
                                                    endReason: "manual_end",
                                                })
                                            }
                                            className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-xl border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.55)] px-3 py-2 text-sm font-medium text-[#cfe4f7] transition hover:bg-[#00D4FF]/[0.08] disabled:opacity-60"
                                        >
                                            Generate and end session
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={reportLoading}
                                        onClick={() => generateSessionReport({ wholeRoom: true })}
                                        className="w-full rounded-xl border border-dashed border-[rgba(0,212,255,0.2)] px-3 py-2 text-xs font-medium text-[#91A8C3] hover:bg-[rgba(16,28,52,0.4)]"
                                    >
                                        Use whole-room activity (all participants)
                                    </button>
                                    {!lastShareId ? (
                                        <p className="text-xs text-[#91A8C3]">
                                            Generate a report to get a shareable link. Sign in to keep reports in History → Analysis Reports.
                                        </p>
                                    ) : null}

                                    {lastReportPayload ? (
                                        <div
                                            ref={reportCardTiltRef}
                                            data-cursor="card"
                                            className={`relative rounded-[1.5rem] border border-[#00D4FF]/25 bg-gradient-to-b from-[#00D4FF]/[0.06] to-transparent p-1 shadow-[0_0_40px_-16px_rgba(0,212,255,0.4)] ring-1 ring-[#00D4FF]/15 transition-[box-shadow,ring] duration-500 ${isNewReport && activeRightTab === "report" ? "ring-2 ring-[#00D4FF]/60 shadow-[0_0_48px_-12px_rgba(0,212,255,0.6)]" : ""}`}
                                            style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
                                        >
                                            <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-t-[1.25rem] border-b border-[#00D4FF]/20 bg-[rgba(8,17,32,0.9)] px-3 py-2.5 backdrop-blur-md">
                                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#91A8C3]">
                                                    Session report
                                                </span>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-gradient-to-r from-[#00D4FF] to-[#1E90FF] px-2.5 py-1 text-xs font-bold tabular-nums text-[#081120]">
                                                        {lastReportPayload.sessionScore}
                                                    </span>
                                                    {lastShareId ? (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const url = `${window.location.origin}/report/${lastShareId}`;
                                                                await navigator.clipboard.writeText(url);
                                                                toast.success("Share link copied");
                                                            }}
                                                            className="rounded-lg border border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.6)] px-2.5 py-1 text-[11px] font-semibold text-[#cfe4f7] transition hover:border-[#00D4FF]/50"
                                                        >
                                                            Copy link
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="p-2 pt-3 sm:p-3">
                                                <SessionIntelligenceReportDashboard
                                                    report={lastReportPayload}
                                                    previousReport={previousReportPayload}
                                                    title={
                                                        roomState?.problem?.title ||
                                                        "Practice session"
                                                    }
                                                    variant="embedded"
                                                />
                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(0,212,255,0.14)] pt-3">
                                                    <p className="text-[10px] text-[#91A8C3]">
                                                        Screenshot-friendly layout · share from Copy link
                                                    </p>
                                                    <button
                                                        type="button"
                                                        disabled={reportLoading}
                                                        onClick={() => generateSessionReport({ endSession: false })}
                                                        className="text-[11px] font-semibold text-[#00D4FF] underline-offset-2 hover:underline disabled:opacity-50"
                                                    >
                                                        Regenerate
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-[rgba(0,212,255,0.2)] bg-[rgba(16,28,52,0.35)] p-5 text-sm text-[#91A8C3]">
                                            Run code, submit samples, or run a signed-in solution review, then generate your report here.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default Workspace;