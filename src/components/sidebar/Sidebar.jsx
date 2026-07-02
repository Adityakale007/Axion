/* eslint-disable react/prop-types */
import axios from 'axios';
import User from '../common/User';
import { Link, useLocation, Navigate, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { useEffect, useRef, useState } from 'react';

const PLATFORM_OPTIONS = [
    { value: 'codeforces', label: 'Codeforces' },
    { value: 'custom', label: 'Custom / Other' },
    { value: 'leetcode', label: 'LeetCode (discussion)' },
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-[1.8rem] border border-stone-200 bg-white shadow-[0_28px_120px_-42px_rgba(15,23,42,0.5)] dark:border-slate-700 dark:bg-[#081121]">
                <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 dark:border-slate-700">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Import Helper</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">Import Problem</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                            Keep import as a helper, then continue editing the shared brief manually.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-stone-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                        aria-label="Close import modal"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    {importNotice && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-sm leading-6 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
                            {importNotice}
                        </div>
                    )}

                    <div className="rounded-[1.35rem] border border-stone-200/80 bg-stone-50 p-4 dark:border-slate-700/80 dark:bg-[#0d172b]">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                    Platform
                                </span>
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
                                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                    {PLATFORM_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                    Problem Code
                                </span>
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
                                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                />
                            </label>
                        </div>
                        <button
                            type="button"
                            onClick={onImportProblem}
                            disabled={isImporting || !problemDraft.problemCode.trim()}
                            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                        >
                            {isImporting ? 'Importing problem...' : 'Import by Platform + Code'}
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
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
        <div className="flex h-full w-full flex-col border-r border-white/10 bg-transparent dark:bg-transparent">
            <ImportProblemModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                problemDraft={problemDraft}
                setProblemDraft={updateProblemDraft}
                isImporting={isImporting}
                importNotice={importNotice}
                onImportProblem={handleImportProblem}
            />
            <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
                <div className="flex flex-col space-y-4 p-4 sm:p-5">
                    <div className="flex w-full items-center gap-1.5">
                        <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 transition hover:bg-white/10">
                            <img src="/logo.png" alt="ForkSpace logo" className="h-6 w-6 brightness-0 invert" />
                        </Link>
                        <div className="flex h-10 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-full border border-white/15 bg-white/5 px-2 dark:bg-white/[0.04]">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Room</span>
                            <code className="min-w-0 truncate rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-gray-100">
                                {roomId}
                            </code>
                            <button
                                type="button"
                                onClick={handleCopyRoomId}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 text-gray-200 transition hover:bg-white/20"
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
                    <div className="rounded-[1.6rem] border border-stone-200/80 bg-white p-5 shadow-[0_16px_42px_-28px_rgba(15,23,42,0.22)] dark:border-slate-700/80 dark:bg-[#081121]">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                    Brief
                                </h3>
                            </div>
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600 dark:bg-[#111d33] dark:text-slate-300">
                                Shared
                            </span>
                        </div>

                        <div className="mb-3 rounded-[1.2rem] border border-stone-200/70 bg-white/90 p-3 dark:border-slate-700/80 dark:bg-[#0d172b]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                    Problem source
                                </span>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                        problemDraft.problemSource === 'codeforces'
                                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100'
                                            : 'bg-stone-100 text-stone-700 dark:bg-slate-800 dark:text-slate-200'
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
                                                    className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700 dark:bg-slate-800 dark:text-slate-200"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 text-[11px] text-stone-600 dark:text-slate-400">
                                        {metaRating ? (
                                            <span className="rounded-md bg-stone-50 px-2 py-0.5 dark:bg-slate-900/80">
                                                Rating {metaRating}
                                            </span>
                                        ) : null}
                                        {metaDifficulty ? (
                                            <span className="rounded-md bg-stone-50 px-2 py-0.5 dark:bg-slate-900/80">
                                                {metaDifficulty}
                                            </span>
                                        ) : null}
                                        {metaSolved != null ? (
                                            <span className="rounded-md bg-stone-50 px-2 py-0.5 dark:bg-slate-900/80">
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
                                    className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 transition hover:border-amber-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                >
                                    Browse Codeforces
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSwitchToManualBrief}
                                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    Use manual brief
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetBrief}
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-white dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-200 dark:hover:bg-rose-900/40"
                                    title="Clear all problem details"
                                >
                                    Reset Brief
                                </button>
                            </div>
                            {showCfInlineForm ? (
                                <div className="mt-3 rounded-xl border border-stone-200/80 bg-stone-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                                    <p className="text-[11px] font-medium text-gray-500">Paste Codeforces URL</p>
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            type="url"
                                            value={problemDraft.problemUrl}
                                            onChange={(event) => updateProblemDraft((prev) => ({ ...prev, problemUrl: event.target.value }))}
                                            placeholder="https://codeforces.com/problemset/problem/1/A"
                                            className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleLoadCfUrl}
                                            disabled={isImporting}
                                            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200"
                                        >
                                            {isImporting ? 'Loading...' : 'Load'}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="relative mb-4 grid grid-cols-2 gap-2 rounded-[1.2rem] border border-stone-200/80 bg-stone-50 p-1 dark:border-slate-700/80 dark:bg-[#0d172b]">
                            <div
                                aria-hidden="true"
                                className="absolute bottom-1 h-0.5 rounded-full bg-amber-400"
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
                                className={`rounded-[0.95rem] border-b-2 px-3 py-2 text-sm transition ${
                                    activeTab === 'problem'
                                        ? 'border-amber-400 text-white font-medium'
                                        : 'border-transparent text-gray-500 hover:text-gray-300'
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
                                className={`rounded-[0.95rem] border-b-2 px-3 py-2 text-sm transition ${
                                    activeTab === 'session'
                                        ? 'border-amber-400 text-white font-medium'
                                        : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                Session
                            </button>
                        </div>

                        <div className="space-y-3">
                            {activeTab === 'problem' ? (
                                <>
                                    <div className="space-y-3 rounded-[1.35rem] border border-stone-200/80 bg-stone-50 p-4 dark:border-slate-700/80 dark:bg-[#0d172b]">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                Problem Title
                                            </p>
                                            <input
                                                type="text"
                                                value={problemDraft.title}
                                                onChange={(event) => updateProblemDraft((prev) => ({ ...prev, title: event.target.value }))}
                                                placeholder="Problem title"
                                                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                Constraints
                                            </p>
                                            <textarea
                                                value={problemDraft.constraints}
                                                onChange={(event) => updateProblemDraft((prev) => ({ ...prev, constraints: event.target.value }))}
                                                placeholder="1 <= n <= 2e5, values can be negative, sum fits in 64-bit..."
                                                className="mt-1.5 h-20 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                    Tags (comma-separated)
                                                </p>
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
                                                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                    Rating / difficulty
                                                </p>
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
                                                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                        {problemDraft.sourceUrl ? (
                                            <div className="mt-2 rounded-md border border-white/10 bg-white/5 p-2">
                                                <p className="mb-1 text-[11px] text-gray-400">
                                                    Statement and test cases aren&apos;t available via API.
                                                </p>
                                                <a
                                                    href={problemDraft.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] text-amber-400 underline hover:text-amber-300"
                                                >
                                                    Open problem on Codeforces →
                                                </a>
                                                <p className="mt-1 text-[11px] text-gray-500">
                                                    Copy the statement into Prompt, paste sample I/O into the fields below.
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="grid gap-3">
                                        <div className="rounded-[1.35rem] border border-stone-200/80 bg-stone-50 p-4 dark:border-slate-700/80 dark:bg-[#0d172b]">
                                            <div className="mb-3 flex items-center justify-between">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-600 dark:text-gray-300">Prompt and sample tests</p>
                                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                                                    Always visible
                                                </span>
                                            </div>
                                            <label className="space-y-1.5">
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                    Prompt
                                                </span>
                                                <textarea
                                                    value={problemDraft.prompt}
                                                    onChange={(event) => updateProblemDraft((prev) => ({ ...prev, prompt: event.target.value }))}
                                                    placeholder="Paste the full problem statement or the exact prompt you want to solve."
                                                    className="min-h-[12rem] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm leading-7 text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                />
                                            </label>
                                            <div className="mt-3 space-y-3">
                                                <label className="space-y-1.5">
                                                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                        Input
                                                    </span>
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
                                                        className="h-36 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                    />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                        Expected Output
                                                    </span>
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
                                                        className="h-36 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    {problemDraft.samples?.length > 0 && (
                                        <div className="flex items-center justify-between rounded-xl border border-dashed border-stone-300 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                    Parsed Samples
                                                </p>
                                                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                                                    {problemDraft.samples.length} sample {problemDraft.samples.length === 1 ? 'test' : 'tests'} ready for suite runs.
                                                </p>
                                            </div>
                                            <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200">
                                                Ready
                                            </span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="rounded-[1.35rem] border border-stone-200/80 bg-stone-50 p-4 dark:border-slate-700/80 dark:bg-[#0d172b]">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                Session Setup
                                            </h4>
                                            <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600 dark:border-slate-700 dark:bg-[#111d33] dark:text-slate-300">
                                                Shared
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="space-y-1.5">
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                    Mode
                                                </span>
                                                <select
                                                    value={session.mode}
                                                    onChange={(event) => handleSessionUpdate({ mode: event.target.value })}
                                                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                >
                                                    {SESSION_MODE_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <p className="rounded-xl border border-stone-200 bg-white/80 px-3 py-2 text-xs leading-6 text-stone-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                                                {SESSION_MODE_HELP[session.mode] || SESSION_MODE_HELP.peer_practice}
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSessionClaim('driverSocketId')}
                                                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                                        session.driverSocketId === currentSocketId
                                                            ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-100'
                                                            : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:text-stone-900 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white'
                                                    }`}
                                                >
                                                    {session.driverSocketId === currentSocketId ? 'Release Driver' : 'Make me Driver'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSessionClaim('navigatorSocketId')}
                                                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                                        session.navigatorSocketId === currentSocketId
                                                            ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-100'
                                                            : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:text-stone-900 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white'
                                                    }`}
                                                >
                                                    {session.navigatorSocketId === currentSocketId ? 'Release Navigator' : 'Make me Navigator'}
                                                </button>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Driver</p>
                                                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{driver?.username || 'Unassigned'}</p>
                                                </div>
                                                <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Navigator</p>
                                                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{navigatorUser?.username || 'Unassigned'}</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Your Session Role</p>
                                                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{participationLabel}</p>
                                                </div>
                                                <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Editor Access</p>
                                                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{editorUnlocked ? 'Editor control' : 'Read only'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {importNotice && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-sm leading-6 text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
                                            {importNotice}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowImportModal(true)}
                                        className="inline-flex w-full items-center justify-center rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-white hover:text-stone-900 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                                    >
                                        Import Problem
                                    </button>
                                    <div className="rounded-[1.35rem] border border-stone-200/80 bg-stone-50 p-4 dark:border-slate-700/80 dark:bg-[#0d172b]">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                Shared Approach Board
                                            </h4>
                                            <span className="text-[10px] text-gray-400">Use this before coding</span>
                                        </div>
                                        <textarea
                                            value={session.approachNotes || ''}
                                            onChange={handleApproachNotesChange}
                                            placeholder="Idea, brute force, optimized approach, edge cases..."
                                            className="min-h-[120px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        />
                                    </div>
                                    {canSeePrivateNotes && (
                                        <div className="rounded-[1.35rem] border border-purple-200 bg-purple-50/40 p-4 dark:border-purple-800/40 dark:bg-purple-950/15">
                                            <div className="mb-3 flex items-center justify-between">
                                                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-purple-700 dark:text-purple-300">
                                                    {isMockMode ? 'Private Interviewer Notes' : 'Private Mentor Notes'}
                                                </h4>
                                                <span className="text-[10px] text-purple-400">Visible only to you</span>
                                            </div>
                                            <textarea
                                                value={session.mentorNotes || ''}
                                                onChange={handleMentorNotesChange}
                                                placeholder="Confusion points, next topic, score/rubric..."
                                                className="min-h-[120px] w-full rounded-xl border border-purple-100 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-purple-400 dark:border-purple-800/50 dark:bg-slate-900 dark:text-white"
                                            />
                                        </div>
                                    )}
                                    {isMockMode && session.mockSummary && (
                                        <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
                                            <div className="mb-3 flex items-center justify-between">
                                                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Mock Summary</h4>
                                                {session.mockSummary.shareId ? (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            await navigator.clipboard.writeText(`${window.location.origin}/summary/${session.mockSummary.shareId}`);
                                                            toast.success('Mock summary link copied');
                                                        }}
                                                        className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-800/40 dark:bg-slate-900/60 dark:text-amber-200"
                                                    >
                                                        Share
                                                    </button>
                                                ) : null}
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/50">
                                                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Problem</p>
                                                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{session.mockSummary.problemTitle}</p>
                                                </div>
                                                <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/50">
                                                    <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Latest Run</p>
                                                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{session.mockSummary.latestRunStatus}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="rounded-[1.35rem] border border-teal-200/80 bg-teal-50/50 p-4 dark:border-teal-800/40 dark:bg-teal-950/20">
                                        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-800 dark:text-teal-200">
                                            Session Intelligence
                                        </h4>
                                        <p className="mt-2 text-xs leading-5 text-teal-900/90 dark:text-teal-100/80">
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
                                            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-teal-300 bg-white px-3 py-2 text-sm font-medium text-teal-900 transition hover:bg-teal-50 dark:border-teal-700 dark:bg-slate-900 dark:text-teal-100 dark:hover:bg-teal-950/40"
                                        >
                                            End Session
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                                Room Members
                            </h2>
                            <div className="flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-gray-800 px-2.5 py-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{users.length}</span>
                            </div>
                        </div>
                        <div className="h-px bg-gradient-to-r from-gray-200 dark:from-gray-700 via-gray-200/50 dark:via-gray-700/50 to-transparent"></div>
                    </div>

                    <div>
                        {users.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                    <div className="h-3 w-3 animate-pulse rounded-full bg-gray-400 dark:bg-gray-600"></div>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Loading room members...</p>
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
            
            <div className="flex-shrink-0 border-t border-stone-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-[#081121]">
                <div className="mb-3 text-center">
                    <Link
                        to="/history/reports"
                        className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 underline-offset-4 hover:underline dark:text-amber-300"
                    >
                        History → Analysis Reports
                    </Link>
                </div>
                <div className="mx-auto flex w-fit items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                    <button
                        onClick={() => setActiveTab('session')}
                        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 border border-gray-200/80 dark:border-gray-600/80 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
                        aria-label="Session settings"
                        title="Session settings"
                    >
                        <svg className="h-4 w-4 text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </button>
                    
                    <button
                        onClick={handleGoHome}
                        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 border border-gray-200/80 dark:border-gray-600/80 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
                        aria-label="Home"
                        title="Home"
                    >
                        <svg className="h-4 w-4 text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9,22 9,12 15,12 15,22"/>
                        </svg>
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </button>
                    
                    <Link to="/">
                        <button
                            className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50/90 dark:bg-red-950/90 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200/80 dark:border-red-800/80 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
                            aria-label="Leave room"
                            title="Leave room"
                        >
                            <svg className="h-4 w-4 text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16,17 21,12 16,7"/>
                                <line x1="21" x2="9" y1="12" y2="12"/>
                            </svg>
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-red-500/10 dark:from-red-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
