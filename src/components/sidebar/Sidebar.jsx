/* eslint-disable react/prop-types */
import axios from 'axios';
import User from '../common/User';
import { Link, useLocation, Navigate, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PLATFORM_OPTIONS = [
    { value: 'codeforces', label: 'Codeforces' },
    { value: 'custom', label: 'Custom' },
    { value: 'leetcode', label: 'LeetCode' },
    { value: 'atcoder', label: 'AtCoder' },
    { value: 'other', label: 'Other' },
];

function formatProblemTitle(platform, problemCode, currentTitle) {
    if (currentTitle && currentTitle !== 'Untitled Practice Problem') {
        return currentTitle;
    }

    if (!problemCode.trim()) {
        return currentTitle || 'Untitled Practice Problem';
    }

    const platformLabel = PLATFORM_OPTIONS.find((option) => option.value === platform)?.label || 'Practice';
    return `${platformLabel} ${problemCode.trim()}`;
}

function shouldResetImportedSource(sourceUrl = '') {
    try {
        const parsedUrl = new URL(sourceUrl);
        return ['codeforces.com', 'm1.codeforces.com', 'leetcode.com'].includes(parsedUrl.hostname);
    } catch {
        return false;
    }
}

function splitJoinedSamples(value = '') {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .trim()
        .split(/\n\s*\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildSamplesFromJoinedText(sampleInput = '', sampleOutput = '') {
    const inputs = splitJoinedSamples(sampleInput);
    const outputs = splitJoinedSamples(sampleOutput);
    const total = Math.max(inputs.length, outputs.length);
    const samples = [];

    for (let index = 0; index < total; index += 1) {
        const input = inputs[index] || '';
        const output = outputs[index] || '';
        if (!input && !output) continue;
        samples.push({
            id: `sample-${index + 1}`,
            input,
            output,
        });
    }

    return samples;
}



const SESSION_MODE_OPTIONS = [
    { value: 'peer_practice', label: 'Peer Practice' },
    { value: 'mock_interview', label: 'Mock Interview' },
    { value: 'mentoring', label: 'Mentoring' },
];

const SESSION_MODE_HELP = {
    peer_practice: 'Equal collaboration. Claim Driver only when one person should type.',
    mock_interview: 'Timer-focused round. Candidate types, interviewer observes and reviews.',
    mentoring: 'Mentor leads the editor. Learner stays read-only and focuses on the approach.',
};

/* Shared style primitives — kept local to this file so nothing else needs to change. */
const glassCard = 'rounded-[1.4rem] border border-[rgba(0,212,255,0.14)] bg-[rgba(16,28,52,0.55)] backdrop-blur-xl';
const glassInput =
    'w-full rounded-xl border border-[rgba(0,212,255,0.16)] bg-[#0b1526]/80 px-3 py-2 text-sm text-[#EAF6FF] placeholder:text-[#4c6079] outline-none transition-all duration-200 focus:border-[#00D4FF]/60 focus:shadow-[0_0_0_3px_rgba(0,212,255,0.12)]';
const eyebrow = 'text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f88a8]';

function ImportProblemModal({
    isOpen,
    onClose,
    problemDraft,
    setProblemDraft,
    isImporting,
    importNotice,
    onImportProblem,
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#020509]/70 p-4 backdrop-blur-md">
            <div
                className="axn-modal-in relative w-full max-w-2xl overflow-hidden rounded-[1.8rem] border border-[rgba(0,212,255,0.18)] bg-[#0b1526]/95 shadow-[0_28px_120px_-30px_rgba(0,0,0,0.85),0_0_60px_-20px_rgba(0,212,255,0.15)] backdrop-blur-2xl"
            >
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/50 to-transparent" />
                <div className="flex items-start justify-between gap-4 border-b border-[rgba(0,212,255,0.1)] px-5 py-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#00D4FF]">Import Helper</p>
                        <h3 className="mt-1 text-xl font-semibold text-[#EAF6FF]">Import Problem</h3>
                        <p className="mt-2 text-sm leading-6 text-[#91A8C3]">
                            Keep import as a helper, then continue editing the shared brief manually.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(0,212,255,0.14)] bg-white/[0.02] text-[#91A8C3] transition-all duration-200 hover:border-[#00D4FF]/40 hover:text-[#EAF6FF]"
                        aria-label="Close import modal"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    <AnimatePresence>
                        {importNotice && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                className="rounded-xl border border-[#00D4FF]/25 bg-[#00D4FF]/[0.06] p-3 text-sm leading-6 text-[#c9ecff]"
                            >
                                {importNotice}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className={`${glassCard} p-4`}>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                            <label className="space-y-1.5">
                                <span className={eyebrow}>Platform</span>
                                <select
                                    value={problemDraft.platform}
                                    onChange={(event) => {
                                        const nextPlatform = event.target.value;
                                        setProblemDraft((prev) => ({
                                            ...prev,
                                            platform: nextPlatform,
                                            sourceUrl: shouldResetImportedSource(prev.sourceUrl) ? '' : prev.sourceUrl,
                                            title: formatProblemTitle(nextPlatform, prev.problemCode, prev.title),
                                        }));
                                    }}
                                    className={glassInput}
                                >
                                    {PLATFORM_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value} className="bg-[#0b1526]">
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className={eyebrow}>Problem Code</span>
                                <input
                                    type="text"
                                    value={problemDraft.problemCode}
                                    maxLength={16}
                                    autoComplete="off"
                                    spellCheck={false}
                                    onChange={(event) => {
                                        const nextProblemCode = event.target.value;
                                        setProblemDraft((prev) => ({
                                            ...prev,
                                            problemCode: nextProblemCode,
                                            sourceUrl: shouldResetImportedSource(prev.sourceUrl) ? '' : prev.sourceUrl,
                                            title: formatProblemTitle(prev.platform, nextProblemCode, prev.title),
                                        }));
                                    }}
                                    placeholder="1885A"
                                    className={glassInput}
                                />
                            </label>
                        </div>
                        <button
                            type="button"
                            onClick={onImportProblem}
                            disabled={isImporting || !problemDraft.problemCode.trim()}
                            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[rgba(0,212,255,0.18)] bg-gradient-to-r from-[#0f213e] to-[#0c1a30] px-3 py-2 text-sm font-medium text-[#EAF6FF] transition-all duration-200 hover:border-[#00D4FF]/45 hover:shadow-[0_0_20px_-6px_rgba(0,212,255,0.5)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
                        >
                            {isImporting ? 'Importing problem...' : 'Import by Platform + Code'}
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#1E90FF] px-4 py-2.5 text-sm font-semibold text-[#04101f] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_24px_-6px_rgba(0,212,255,0.6)] active:scale-[0.98]"
                        >
                            Back to brief
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Sidebar({ users = [], roomId, roomState, socketRef, currentSocketId, currentRole = 'Peer' }) {
    const location = useLocation();
    const navigate = useNavigate();
    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const serverUrl =
        rawServerUrl.includes(':5173') && !import.meta.env.VITE_SERVER_URL
            ? rawServerUrl.replace(':5173', ':5000')
            : rawServerUrl;
    const [isImporting, setIsImporting] = useState(false);
    const [importNotice, setImportNotice] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [showCfInlineForm, setShowCfInlineForm] = useState(false);
    const [activeTab, setActiveTab] = useState('problem');
    const [problemDraft, setProblemDraft] = useState({
        platform: 'codeforces',
        problemCode: '',
        problemUrl: '',
        sourceUrl: '',
        title: '',
        prompt: '',
        constraints: '',
        sampleInput: '',
        sampleOutput: '',
        samples: [],
        tags: [],
        rating: '',
        difficulty: '',
        difficultyLabel: '',
        problemSource: 'manual',
        problemSnapshot: null,
    });
    const lastLocalProblemEditAtRef = useRef(0);
    const sidebarTabRefs = useRef({});
    const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });

    const updateProblemDraft = (updater) => {
        lastLocalProblemEditAtRef.current = Date.now();
        setProblemDraft(updater);
    };

    const hasJoinState = Boolean(location.state);
    const session = roomState?.session || { mode: 'peer_practice', driverSocketId: '', navigatorSocketId: '' };
    const normalizedRole = (currentRole || 'Peer').toLowerCase();
    const isMentoringMode = session.mode === 'mentoring';
    const isMockMode = session.mode === 'mock_interview';
    const canSeePrivateNotes = (isMentoringMode && normalizedRole === 'mentor') || (isMockMode && normalizedRole === 'interviewer');
    const participationLabel =
        session.driverSocketId === currentSocketId
            ? 'Driver'
            : session.navigatorSocketId === currentSocketId
                ? 'Navigator'
                : 'Observer';
    const editorUnlocked =
        isMentoringMode
            ? normalizedRole !== 'learner'
            : isMockMode
                ? normalizedRole === 'candidate' || (!['candidate', 'interviewer'].includes(normalizedRole) && session.driverSocketId === currentSocketId)
                : session.driverSocketId
                    ? session.driverSocketId === currentSocketId
                    : true;
    const driver = users.find((user) => user && user.socketId === session.driverSocketId);
    const navigatorUser = users.find((user) => user && user.socketId === session.navigatorSocketId);
    const getEditorAccess = (user) => {
        const normalizedRole = (user?.role || '').toLowerCase();

        if (session.mode === 'mentoring') {
            return normalizedRole === 'mentor' ? 'control' : 'locked';
        }

        if (session.mode === 'mock_interview') {
            if (normalizedRole === 'interviewer') return 'locked';
            if (normalizedRole === 'candidate') return 'control';
            if (user.socketId === session.driverSocketId) return 'control';
        }

        if (session.driverSocketId) {
            return user.socketId === session.driverSocketId ? 'control' : 'locked';
        }

        return '';
    };

    useEffect(() => {
        const recentlyEditedLocally = Date.now() - lastLocalProblemEditAtRef.current < 1200;
        if (recentlyEditedLocally) return;
        const tagList = roomState?.problem?.tags;
        const tags = Array.isArray(tagList)
            ? tagList
            : typeof tagList === 'string'
                ? tagList.split(',').map((t) => t.trim()).filter(Boolean)
                : [];
        setProblemDraft({
            platform: roomState?.problem?.platform || 'codeforces',
            problemCode: roomState?.problem?.problemCode || '',
            problemUrl: roomState?.problem?.problemUrl || '',
            sourceUrl: roomState?.problem?.sourceUrl || '',
            title: roomState?.problem?.title || '',
            prompt: roomState?.problem?.prompt || '',
            constraints: roomState?.problem?.constraints || '',
            sampleInput: roomState?.problem?.sampleInput || '',
            sampleOutput: roomState?.problem?.sampleOutput || '',
            samples: roomState?.problem?.samples || [],
            tags,
            rating: roomState?.problem?.rating || '',
            difficulty: roomState?.problem?.difficulty || roomState?.problem?.rating || '',
            difficultyLabel: roomState?.problem?.difficultyLabel || '',
            problemSource: roomState?.problem?.problemSource || 'manual',
            problemSnapshot: roomState?.problem?.problemSnapshot || null,
        });
    }, [roomState?.problem]);

    useEffect(() => {
        if (!socketRef?.current || !roomState) return;
        if (JSON.stringify(problemDraft) === JSON.stringify(roomState.problem || {})) return;

        const timer = setTimeout(() => {
            socketRef.current.emit('problem-update', {
                roomId,
                problem: problemDraft,
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [problemDraft, roomId, socketRef, roomState]);

    useEffect(() => {
        const updateIndicator = () => {
            const tabNode = sidebarTabRefs.current[activeTab];
            if (!tabNode) return;
            setTabIndicator({
                left: tabNode.offsetLeft,
                width: tabNode.offsetWidth,
            });
        };

        updateIndicator();
        window.addEventListener('resize', updateIndicator);
        return () => window.removeEventListener('resize', updateIndicator);
    }, [activeTab]);

    if (!hasJoinState) {
        return <Navigate to='/' />;
    }

    const handleResetBrief = () => {
        updateProblemDraft({
            platform: 'codeforces',
            problemCode: '',
            problemUrl: '',
            sourceUrl: '',
            title: '',
            prompt: '',
            constraints: '',
            sampleInput: '',
            sampleOutput: '',
            samples: [],
            tags: [],
            rating: '',
            difficulty: '',
            difficultyLabel: '',
            problemSource: 'manual',
            problemSnapshot: null,
        });
        toast.success('Problem brief reset');
    };

    const handleCopyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID copied');
        } catch {
            toast.error('Failed to copy room ID');
        }
    };

    const handleGoHome = () => {
        navigate('/');
    };

    const handleSessionUpdate = (partialSession) => {
        socketRef?.current?.emit('session-update', {
            roomId,
            session: {
                ...session,
                ...partialSession,
            },
        });
    };

    const handleApproachNotesChange = (event) => {
        handleSessionUpdate({
            approachNotes: event.target.value,
        });
    };

    const handleMentorNotesChange = (event) => {
        handleSessionUpdate({
            mentorNotes: event.target.value,
        });
    };

    const handleToggleSessionClaim = (claimKey) => {
        const currentValue = session[claimKey];
        handleSessionUpdate({
            [claimKey]: currentValue === currentSocketId ? '' : currentSocketId,
        });
    };

    const handleImportProblem = async () => {
        if (!problemDraft.problemCode.trim()) {
            toast.error('Add a platform problem code first.');
            return;
        }

        setIsImporting(true);
        setImportNotice('');

        try {
            const response = await axios.post(`${serverUrl}/api/problem-import`, {
                platform: problemDraft.platform,
                problemCode: problemDraft.problemCode,
                sourceUrl: problemDraft.sourceUrl,
            });

            updateProblemDraft((prev) => ({
                ...prev,
                ...response.data.problem,
            }));

            setImportNotice('Problem details imported into the shared brief.');
            toast.success('Problem details imported');
            setShowImportModal(false);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to import the problem');
        } finally {
            setIsImporting(false);
        }
    };

    const handleSwitchToManualBrief = async () => {
        try {
            await axios.post(`${serverUrl}/api/rooms/${encodeURIComponent(roomId)}/problem-selection`, {
                problemSource: 'manual',
            });
            toast.success('Problem source set to manual (snapshot cleared)');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not update problem source');
        }
    };

    async function loadFromCodeforcesUrl(url) {
        const match = url.match(
            /codeforces\.com\/(?:(?:problemset\/problem\/(\d+)\/([A-Z]\d*))|(?:contest\/(\d+)\/problem\/([A-Z]\d*)))/i
        );
        if (!match) throw new Error('Invalid Codeforces URL');

        const contestId = match[1] || match[3];
        const index = (match[2] || match[4] || '').toUpperCase();

        const res = await fetch('https://codeforces.com/api/problemset.problems');
        const data = await res.json();
        const problems = data?.result?.problems || [];

        const problem = problems.find(
            (p) => String(p.contestId) === String(contestId) && String(p.index).toUpperCase() === index
        );

        if (!problem) throw new Error('Problem not found');

        return {
            title: problem.name,
            tags: (problem.tags || []).join(', '),
            rating: problem.rating || 'Unrated',
            cfUrl: url,
        };
    }

    const handleLoadCfUrl = async () => {
        if (!problemDraft.problemUrl.trim()) {
            toast.error('Paste a Codeforces URL first.');
            return;
        }

        setIsImporting(true);
        setImportNotice('');
        try {
            const result = await loadFromCodeforcesUrl(problemDraft.problemUrl.trim());
            updateProblemDraft((prev) => ({
                ...prev,
                title: result.title,
                tags: result.tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                rating: String(result.rating),
                difficulty: String(result.rating),
                sourceUrl: result.cfUrl,
                platform: 'codeforces',
                problemSource: 'codeforces',
            }));
            toast.success('Codeforces metadata loaded');
        } catch (error) {
            toast.error(error.message || 'Could not parse Codeforces URL');
        } finally {
            setIsImporting(false);
        }
    };

    const snap = problemDraft.problemSnapshot;
    const metaTags = Array.isArray(snap?.tags) && snap.tags.length ? snap.tags : problemDraft.tags;
    const metaRating =
        snap?.rating != null ? String(snap.rating) : problemDraft.rating || '';
    const metaSolved =
        typeof snap?.solvedCount === 'number' ? snap.solvedCount : null;
    const metaDifficulty =
        snap?.difficultyLabel || problemDraft.difficultyLabel || problemDraft.difficulty || '';

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden border-r border-[rgba(0,212,255,0.1)] bg-[#081120]">
            {/* Scoped effects for this component */}
            <style>{`
                @keyframes axn-edge-glow {
                    0%, 100% { opacity: 0.35; }
                    50% { opacity: 0.7; }
                }
                @keyframes axn-modal-pop {
                    from { opacity: 0; transform: scale(0.97) translateY(4px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .axn-modal-in { animation: axn-modal-pop 0.18s ease-out; }
                .axn-sidebar-edge {
                    animation: axn-edge-glow 5s ease-in-out infinite;
                }
                .axn-sidebar-grid {
                    background-image:
                        linear-gradient(rgba(0,212,255,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,212,255,0.05) 1px, transparent 1px);
                    background-size: 34px 34px;
                }
                @media (prefers-reduced-motion: reduce) {
                    .axn-sidebar-edge { animation: none; }
                }
            `}</style>

            {/* Ambient depth layer — sits behind all content, never intercepts clicks */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="axn-sidebar-grid absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
                <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-[#1E90FF]/10 blur-[90px]" />
                <div className="absolute -right-20 top-1/2 h-72 w-72 rounded-full bg-[#7C5CFF]/10 blur-[100px]" />
                <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-[#00F5FF]/10 blur-[90px]" />
                <div className="axn-sidebar-edge absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-[#00D4FF] to-transparent" />
            </div>

            <ImportProblemModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                problemDraft={problemDraft}
                setProblemDraft={updateProblemDraft}
                isImporting={isImporting}
                importNotice={importNotice}
                onImportProblem={handleImportProblem}
            />

            <div className="relative flex-1 min-h-0 overflow-y-auto scroll-smooth">
                <div className="flex flex-col space-y-4 p-4 sm:p-5">
                    {/* Brand / room identity */}
                    <div className="flex w-full items-center gap-1.5">
                        <Link
                            to="/"
                            className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(0,212,255,0.16)] bg-white/[0.03] transition-all duration-200 hover:border-[#00D4FF]/50"
                        >
                            <span className="pointer-events-none absolute -inset-1 rounded-xl bg-[#00D4FF]/25 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-60" />
                            <div className="axn-logo-aura absolute -inset-1.5 rounded-xl bg-gradient-to-br from-indigo-500/50 via-violet-500/40 to-cyan-400/40 blur-md" />
                                <div className="relative rounded-xl bg-[#080b17] p-1 ring-1 ring-white/10">
                                    <img
                                        src="/logo.png"
                                        alt="Axion logo"
                                        className="h-8 w-8 rounded-lg object-contain"
                                    />
                                </div>
                        </Link>
                        <div className="flex h-10 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-full border border-[rgba(0,212,255,0.14)] bg-white/[0.02] px-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f88a8]">Room</span>
                            <code className="min-w-0 truncate rounded-full bg-[#00D4FF]/[0.08] px-1.5 py-0.5 font-mono text-[11px] text-[#c9ecff]">
                                {roomId}
                            </code>
                            <button
                                type="button"
                                onClick={handleCopyRoomId}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[rgba(0,212,255,0.16)] bg-white/[0.03] text-[#91A8C3] transition-all duration-200 hover:border-[#00D4FF]/45 hover:text-[#EAF6FF] hover:shadow-[0_0_10px_-3px_rgba(0,212,255,0.6)]"
                                title="Copy room ID"
                                aria-label="Copy room ID"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Brief panel */}
                    <div className={`${glassCard} p-5 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)]`}>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#91A8C3]">Brief</h3>
                            <span className="rounded-full border border-[rgba(0,212,255,0.2)] bg-[#00D4FF]/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7fe0ff]">
                                Shared
                            </span>
                        </div>

                        <div className={`mb-3 rounded-[1.2rem] border border-[rgba(0,212,255,0.1)] bg-[#0b1526]/70 p-3`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={eyebrow}>Problem source</span>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                        problemDraft.problemSource === 'codeforces'
                                            ? 'border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.1] text-[#c9b9ff]'
                                            : 'border border-white/10 bg-white/[0.03] text-[#91A8C3]'
                                    }`}
                                >
                                    {problemDraft.problemSource === 'codeforces' ? 'Codeforces' : 'Manual'}
                                </span>
                            </div>
                            {(metaTags?.length > 0 || metaRating || metaDifficulty || metaSolved != null) && (
                                <div className="mt-2 space-y-2">
                                    {metaTags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {metaTags.slice(0, 12).map((t) => (
                                                <span
                                                    key={t}
                                                    className="rounded-full border border-[rgba(0,212,255,0.14)] bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#c3d6ea]"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 text-[11px] text-[#91A8C3]">
                                        {metaRating ? (
                                            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono">
                                                Rating {metaRating}
                                            </span>
                                        ) : null}
                                        {metaDifficulty ? (
                                            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5">
                                                {metaDifficulty}
                                            </span>
                                        ) : null}
                                        {metaSolved != null ? (
                                            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono">
                                                {metaSolved.toLocaleString()} solves
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCfInlineForm((v) => !v)}
                                    className="rounded-xl border border-[rgba(0,212,255,0.16)] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-[#c3d6ea] transition-all duration-200 hover:border-[#00D4FF]/40 hover:text-[#EAF6FF]"
                                >
                                    Browse Codeforces
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSwitchToManualBrief}
                                    className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-1.5 text-xs font-medium text-[#91A8C3] transition-all duration-200 hover:border-white/20 hover:text-[#EAF6FF]"
                                >
                                    Use manual brief
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetBrief}
                                    className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-1.5 text-xs font-medium text-rose-300 transition-all duration-200 hover:border-rose-400/40 hover:bg-rose-500/[0.1]"
                                    title="Clear all problem details"
                                >
                                    Reset Brief
                                </button>
                            </div>
                            <AnimatePresence>
                                {showCfInlineForm ? (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-3 rounded-xl border border-[rgba(0,212,255,0.12)] bg-white/[0.02] p-3">
                                            <p className="text-[11px] font-medium text-[#6f88a8]">Paste Problem URL</p>
                                            <div className="mt-2 flex gap-2">
                                                <input
                                                    type="url"
                                                    value={problemDraft.problemUrl}
                                                    onChange={(event) => updateProblemDraft((prev) => ({ ...prev, problemUrl: event.target.value }))}
                                                    placeholder="https://codeforces.com/problemset/problem/1/A"
                                                    className={`min-w-0 flex-1 ${glassInput}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleLoadCfUrl}
                                                    disabled={isImporting}
                                                    className="rounded-lg border border-[rgba(0,212,255,0.16)] bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#c3d6ea] transition-all duration-200 hover:border-[#00D4FF]/40 disabled:opacity-60"
                                                >
                                                    {isImporting ? 'Loading...' : 'Load'}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>
                        </div>

                        {/* Tabs */}
                        <div className="relative mb-4 grid grid-cols-2 gap-2 rounded-[1.2rem] border border-white/[0.06] bg-[#0b1526]/70 p-1">
                            <div
                                aria-hidden="true"
                                className="absolute bottom-1 h-0.5 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#7C5CFF] shadow-[0_0_10px_rgba(0,212,255,0.8)]"
                                style={{
                                    left: `${tabIndicator.left}px`,
                                    width: `${tabIndicator.width}px`,
                                    transition: 'left 200ms ease, width 200ms ease',
                                }}
                            />
                            <button
                                ref={(node) => {
                                    sidebarTabRefs.current.problem = node;
                                }}
                                type="button"
                                onClick={() => setActiveTab('problem')}
                                data-cursor="button"
                                className={`rounded-[0.95rem] px-3 py-2 text-sm transition-colors duration-200 ${
                                    activeTab === 'problem' ? 'font-medium text-[#EAF6FF]' : 'text-[#6f88a8] hover:text-[#c3d6ea]'
                                }`}
                            >
                                Problem
                            </button>
                            <button
                                ref={(node) => {
                                    sidebarTabRefs.current.session = node;
                                }}
                                type="button"
                                onClick={() => setActiveTab('session')}
                                data-cursor="button"
                                className={`rounded-[0.95rem] px-3 py-2 text-sm transition-colors duration-200 ${
                                    activeTab === 'session' ? 'font-medium text-[#EAF6FF]' : 'text-[#6f88a8] hover:text-[#c3d6ea]'
                                }`}
                            >
                                Session
                            </button>
                        </div>

                        <div className="space-y-3">
                            {activeTab === 'problem' ? (
                                <>
                                    <div className={`space-y-3 rounded-[1.35rem] border border-white/[0.06] bg-[#0b1526]/70 p-4`}>
                                        <div>
                                            <p className={eyebrow}>Problem Title</p>
                                            <input
                                                type="text"
                                                value={problemDraft.title}
                                                onChange={(event) => updateProblemDraft((prev) => ({ ...prev, title: event.target.value }))}
                                                placeholder="Problem title"
                                                className={`mt-1.5 ${glassInput}`}
                                            />
                                        </div>
                                        <div>
                                            <p className={eyebrow}>Constraints</p>
                                            <textarea
                                                value={problemDraft.constraints}
                                                onChange={(event) => updateProblemDraft((prev) => ({ ...prev, constraints: event.target.value }))}
                                                placeholder="1 <= n <= 2e5, values can be negative, sum fits in 64-bit..."
                                                className={`mt-1.5 h-20 ${glassInput}`}
                                            />
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <p className={eyebrow}>Tags (comma-separated)</p>
                                                <input
                                                    type="text"
                                                    value={Array.isArray(problemDraft.tags) ? problemDraft.tags.join(', ') : ''}
                                                    onChange={(event) =>
                                                        updateProblemDraft((prev) => ({
                                                            ...prev,
                                                            tags: event.target.value
                                                                .split(',')
                                                                .map((t) => t.trim())
                                                                .filter(Boolean),
                                                        }))
                                                    }
                                                    placeholder="dp, greedy, graphs"
                                                    className={`mt-1.5 ${glassInput}`}
                                                />
                                            </div>
                                            <div>
                                                <p className={eyebrow}>Rating / difficulty</p>
                                                <input
                                                    type="text"
                                                    value={problemDraft.rating || ''}
                                                    onChange={(event) =>
                                                        updateProblemDraft((prev) => ({
                                                            ...prev,
                                                            rating: event.target.value,
                                                            difficulty: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="e.g. 1200, Medium"
                                                    className={`mt-1.5 ${glassInput}`}
                                                />
                                            </div>
                                        </div>
                                        {problemDraft.sourceUrl ? (
                                            <div className="mt-2 rounded-md border border-white/10 bg-white/[0.02] p-2">
                                                <p className="mb-1 text-[11px] text-[#6f88a8]">
                                                    Statement and test cases aren&apos;t available via API.
                                                </p>
                                                <a
                                                    href={problemDraft.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] text-[#00D4FF] underline hover:text-[#7fe0ff]"
                                                >
                                                    Open problem on Codeforces →
                                                </a>
                                                <p className="mt-1 text-[11px] text-[#6f88a8]">
                                                    Copy the statement into Prompt, paste sample I/O into the fields below.
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="grid gap-3">
                                        <div className={`rounded-[1.35rem] border border-white/[0.06] bg-[#0b1526]/70 p-4`}>
                                            <div className="mb-3 flex items-center justify-between">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f88a8]">Prompt and sample tests</p>
                                                <span className="rounded-full border border-[#00F5FF]/25 bg-[#00F5FF]/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ff2f2]">
                                                    Always visible
                                                </span>
                                            </div>
                                            <label className="space-y-1.5">
                                                <span className={eyebrow}>Prompt</span>
                                                <textarea
                                                    value={problemDraft.prompt}
                                                    onChange={(event) => updateProblemDraft((prev) => ({ ...prev, prompt: event.target.value }))}
                                                    placeholder="Paste the full problem statement or the exact prompt you want to solve."
                                                    className={`min-h-[12rem] leading-7 ${glassInput}`}
                                                />
                                            </label>
                                            <div className="mt-3 space-y-3">
                                                <label className="space-y-1.5">
                                                    <span className={eyebrow}>Input</span>
                                                    <textarea
                                                        value={problemDraft.sampleInput}
                                                        onChange={(event) =>
                                                            updateProblemDraft((prev) => {
                                                                const sampleInput = event.target.value;
                                                                return {
                                                                    ...prev,
                                                                    sampleInput,
                                                                    samples: buildSamplesFromJoinedText(sampleInput, prev.sampleOutput),
                                                                };
                                                            })
                                                        }
                                                        placeholder="Paste the sample input here"
                                                        className={`h-36 font-mono ${glassInput}`}
                                                    />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className={eyebrow}>Expected Output</span>
                                                    <textarea
                                                        value={problemDraft.sampleOutput}
                                                        onChange={(event) =>
                                                            updateProblemDraft((prev) => {
                                                                const sampleOutput = event.target.value;
                                                                return {
                                                                    ...prev,
                                                                    sampleOutput,
                                                                    samples: buildSamplesFromJoinedText(prev.sampleInput, sampleOutput),
                                                                };
                                                            })
                                                        }
                                                        placeholder="Paste the expected output here"
                                                        className={`h-36 font-mono ${glassInput}`}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {problemDraft.samples?.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 6 }}
                                                transition={{ duration: 0.18 }}
                                                className="flex items-center justify-between rounded-xl border border-dashed border-[rgba(0,212,255,0.2)] bg-white/[0.015] p-3"
                                            >
                                                <div>
                                                    <p className={eyebrow}>Parsed Samples</p>
                                                    <p className="mt-1 text-sm text-[#c3d6ea]">
                                                        {problemDraft.samples.length} sample {problemDraft.samples.length === 1 ? 'test' : 'tests'} ready for suite runs.
                                                    </p>
                                                </div>
                                                <span className="rounded-full border border-[#00D4FF]/25 bg-[#00D4FF]/[0.06] px-2.5 py-1 text-xs font-semibold text-[#7fe0ff]">
                                                    Ready
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </>
                            ) : (
                                <>
                                    <div className={`rounded-[1.35rem] border border-white/[0.06] bg-[#0b1526]/70 p-4`}>
                                        <div className="mb-3 flex items-center justify-between">
                                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#91A8C3]">Session Setup</h4>
                                            <span className="rounded-full border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91A8C3]">
                                                Shared
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="space-y-1.5">
                                                <span className={eyebrow}>Mode</span>
                                                <select
                                                    value={session.mode}
                                                    onChange={(event) => handleSessionUpdate({ mode: event.target.value })}
                                                    className={glassInput}
                                                >
                                                    {SESSION_MODE_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value} className="bg-[#0b1526]">
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <p className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-xs leading-6 text-[#91A8C3]">
                                                {SESSION_MODE_HELP[session.mode] || SESSION_MODE_HELP.peer_practice}
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSessionClaim('driverSocketId')}
                                                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                                                        session.driverSocketId === currentSocketId
                                                            ? 'border-[#00D4FF]/40 bg-[#00D4FF]/[0.08] text-[#c9ecff] shadow-[0_0_16px_-6px_rgba(0,212,255,0.6)]'
                                                            : 'border-white/[0.06] bg-white/[0.015] text-[#91A8C3] hover:border-white/20 hover:text-[#EAF6FF]'
                                                    }`}
                                                >
                                                    {session.driverSocketId === currentSocketId ? 'Release Driver' : 'Make me Driver'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSessionClaim('navigatorSocketId')}
                                                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                                                        session.navigatorSocketId === currentSocketId
                                                            ? 'border-[#00D4FF]/40 bg-[#00D4FF]/[0.08] text-[#c9ecff] shadow-[0_0_16px_-6px_rgba(0,212,255,0.6)]'
                                                            : 'border-white/[0.06] bg-white/[0.015] text-[#91A8C3] hover:border-white/20 hover:text-[#EAF6FF]'
                                                    }`}
                                                >
                                                    {session.navigatorSocketId === currentSocketId ? 'Release Navigator' : 'Make me Navigator'}
                                                </button>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                                                    <p className={eyebrow}>Driver</p>
                                                    <p className="mt-1 text-sm font-medium text-[#EAF6FF]">{driver?.username || 'Unassigned'}</p>
                                                </div>
                                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                                                    <p className={eyebrow}>Navigator</p>
                                                    <p className="mt-1 text-sm font-medium text-[#EAF6FF]">{navigatorUser?.username || 'Unassigned'}</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                                                    <p className={eyebrow}>Your Session Role</p>
                                                    <p className="mt-1 text-sm font-medium text-[#EAF6FF]">{participationLabel}</p>
                                                </div>
                                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                                                    <p className={eyebrow}>Editor Access</p>
                                                    <p className="mt-1 text-sm font-medium text-[#EAF6FF]">{editorUnlocked ? 'Editor control' : 'Read only'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {importNotice && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                transition={{ duration: 0.18 }}
                                                className="rounded-xl border border-[#00D4FF]/25 bg-[#00D4FF]/[0.06] p-3 text-sm leading-6 text-[#c9ecff] shadow-sm"
                                            >
                                                {importNotice}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <button
                                        type="button"
                                        onClick={() => setShowImportModal(true)}
                                        className="inline-flex w-full items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-sm font-medium text-[#c3d6ea] transition-all duration-200 hover:border-[#00D4FF]/35 hover:text-[#EAF6FF]"
                                    >
                                        Import Problem
                                    </button>
                                    <div className={`rounded-[1.35rem] border border-white/[0.06] bg-[#0b1526]/70 p-4`}>
                                        <div className="mb-3 flex items-center justify-between">
                                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#91A8C3]">Shared Approach Board</h4>
                                            <span className="text-[10px] text-[#6f88a8]">Use this before coding</span>
                                        </div>
                                        <textarea
                                            value={session.approachNotes || ''}
                                            onChange={handleApproachNotesChange}
                                            placeholder="Idea, brute force, optimized approach, edge cases..."
                                            className={`min-h-[120px] ${glassInput}`}
                                        />
                                    </div>
                                    <AnimatePresence>
                                        {canSeePrivateNotes && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 6 }}
                                                transition={{ duration: 0.18 }}
                                                className="rounded-[1.35rem] border border-[#7C5CFF]/25 bg-[#7C5CFF]/[0.05] p-4"
                                            >
                                                <div className="mb-3 flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c9b9ff]">
                                                        {isMockMode ? 'Private Interviewer Notes' : 'Private Mentor Notes'}
                                                    </h4>
                                                    <span className="text-[10px] text-[#a48cff]">Visible only to you</span>
                                                </div>
                                                <textarea
                                                    value={session.mentorNotes || ''}
                                                    onChange={handleMentorNotesChange}
                                                    placeholder="Confusion points, next topic, score/rubric..."
                                                    className="min-h-[120px] w-full rounded-xl border border-[#7C5CFF]/25 bg-[#0b1526]/80 px-3 py-2 text-sm text-[#EAF6FF] outline-none transition-all duration-200 placeholder:text-[#5a5480] focus:border-[#7C5CFF]/60 focus:shadow-[0_0_0_3px_rgba(124,92,255,0.14)]"
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <AnimatePresence>
                                        {isMockMode && session.mockSummary && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 6 }}
                                                transition={{ duration: 0.18 }}
                                                className="rounded-[1.35rem] border border-[#00D4FF]/25 bg-[#00D4FF]/[0.05] p-4"
                                            >
                                                <div className="mb-3 flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7fe0ff]">Mock Summary</h4>
                                                    {session.mockSummary.shareId ? (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                await navigator.clipboard.writeText(`${window.location.origin}/summary/${session.mockSummary.shareId}`);
                                                                toast.success('Mock summary link copied');
                                                            }}
                                                            className="rounded-full border border-[#00D4FF]/25 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7fe0ff] transition-colors duration-200 hover:border-[#00D4FF]/50"
                                                        >
                                                            Share
                                                        </button>
                                                    ) : null}
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <div className="rounded-xl bg-white/[0.03] p-3">
                                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#6f88a8]">Problem</p>
                                                        <p className="mt-1 text-sm font-medium text-[#EAF6FF]">{session.mockSummary.problemTitle}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-white/[0.03] p-3">
                                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#6f88a8]">Latest Run</p>
                                                        <p className="mt-1 text-sm font-medium text-[#EAF6FF]">{session.mockSummary.latestRunStatus}</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <div className="rounded-[1.35rem] border border-[#00F5FF]/20 bg-[#00F5FF]/[0.04] p-4">
                                        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8ff2f2]">
                                            Session Intelligence
                                        </h4>
                                        <p className="mt-2 text-xs leading-5 text-[#a9d9d9]">
                                            Mark the end of this practice block for logging, then generate a shareable report from the workspace panel.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                socketRef?.current?.emit('intelligence-session-end', {
                                                    roomId,
                                                    reason: 'host_end',
                                                });
                                                toast.success('Session marked as ended for intelligence logs.');
                                            }}
                                            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#00F5FF]/25 bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#c9f7f7] transition-all duration-200 hover:border-[#00F5FF]/45 hover:shadow-[0_0_18px_-6px_rgba(0,245,255,0.4)]"
                                        >
                                            End Session
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Room members */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight text-[#EAF6FF]">Room Members</h2>
                            <div className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1">
                                <div className="h-2 w-2 rounded-full bg-[#00D4FF] shadow-[0_0_6px_rgba(0,212,255,0.9)]" />
                                <span className="text-xs font-medium text-[#91A8C3]">{users.length}</span>
                            </div>
                        </div>
                        <div className="h-px bg-gradient-to-r from-[rgba(0,212,255,0.25)] via-white/[0.06] to-transparent" />
                    </div>

                    <div>
                        {users.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03]">
                                    <div className="h-3 w-3 animate-pulse rounded-full bg-[#00D4FF]" />
                                </div>
                                <p className="text-sm text-[#6f88a8]">Loading room members...</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {users.filter(Boolean).map((user) => (
                                <User
                                    key={user.socketId}
                                    username={user.username}
                                    avatarId={user.avatarId}
                                    role={user.role}
                                    isOnline={true}
                                    editorAccess={getEditorAccess(user)}
                                    pairLabel={
                                        user.socketId === session.driverSocketId
                                            ? 'Driver'
                                            : user.socketId === session.navigatorSocketId
                                                ? 'Navigator'
                                                : ''
                                    }
                                />
                            ))}
                        </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick actions / account footer */}
            <div className="relative flex-shrink-0 border-t border-[rgba(0,212,255,0.1)] bg-[#0b1526]/80 px-4 py-3 backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/35 to-transparent" />
                <div className="mb-3 text-center">
                    <Link
                        to="/history/reports"
                        className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00D4FF] underline-offset-4 transition-colors duration-200 hover:text-[#7fe0ff] hover:underline"
                    >
                        History → Analysis Reports
                    </Link>
                </div>
                <div className="mx-auto flex w-fit items-center justify-center gap-1 rounded-xl border border-[rgba(0,212,255,0.14)] bg-white/[0.02] p-1">
                    <button
                        onClick={() => setActiveTab('session')}
                        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[#91A8C3] transition-all duration-200 hover:border-[#00D4FF]/35 hover:bg-white/[0.03] hover:text-[#EAF6FF] hover:shadow-[0_0_14px_-5px_rgba(0,212,255,0.6)]"
                        aria-label="Session settings"
                        title="Session settings"
                    >
                        <svg className="h-4 w-4 transition-transform duration-200 group-hover:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>

                    <button
                        onClick={handleGoHome}
                        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[#91A8C3] transition-all duration-200 hover:border-[#00D4FF]/35 hover:bg-white/[0.03] hover:text-[#EAF6FF] hover:shadow-[0_0_14px_-5px_rgba(0,212,255,0.6)]"
                        aria-label="Home"
                        title="Home"
                    >
                        <svg className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9,22 9,12 15,12 15,22"/>
                        </svg>
                    </button>

                    <Link to="/">
                        <button
                            className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-rose-400/80 transition-all duration-200 hover:border-rose-400/35 hover:bg-rose-500/[0.08] hover:text-rose-300 hover:shadow-[0_0_14px_-5px_rgba(244,63,94,0.5)]"
                            aria-label="Leave room"
                            title="Leave room"
                        >
                            <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16,17 21,12 16,7"/>
                                <line x1="21" x2="9" y1="12" y2="12"/>
                            </svg>
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;