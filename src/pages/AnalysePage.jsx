/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import { getAnalysisApiBases } from '../lib/analysisApi';
import useCardTilt from '../hooks/useCardTilt';
import DailyChallenge from '../components/DailyChallenge';
import Leaderboard from '../components/Leaderboard';
import ScoreCard from '../components/ScoreCard';
import * as htmlToImage from 'html-to-image';
import { Sparkles } from 'lucide-react';

const LANGUAGE_CHOICES = [
    { value: 'cpp', label: 'C++' },
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
];

const LOADING_STEPS = [
    'Parsing code structure...',
    'Detecting algorithms and patterns...',
    'Analysing time & space complexity...',
    'Checking for bugs and edge cases...',
    'Generating optimization suggestions...',
    'Scoring interview readiness...',
];

function normalizeLegacyAnalysis(result = {}, code = '') {
    if (result.overallScore != null || result.complexity || result.interviewReadiness) {
        return result;
    }

    const bugObjects = Array.isArray(result.bugs)
        ? result.bugs.map((bug) => ({
            severity: 'medium',
            title: bug,
            location: 'Shared analysis',
            explanation: bug,
            fix: 'Review this scenario and patch the edge case in the current approach.',
        }))
        : [];

    return {
        overallScore: bugObjects.length === 0 ? 78 : Math.max(45, 78 - bugObjects.length * 8),
        verdict: bugObjects.length === 0 ? 'Legacy analysis · no obvious critical issues' : 'Legacy analysis · follow-up review advised',
        summary: result.summary || 'This analysis was generated with the older Axion analyzer and has been adapted into the new layout.',
        complexity: {
            time: result.time_complexity || 'N/A',
            timeExplanation: result.complexity_reasoning || 'Legacy analysis did not include a separate time explanation.',
            timeRating: result.time_complexity && /n\^2|n²/i.test(result.time_complexity) ? 'suboptimal' : 'acceptable',
            space: result.space_complexity || 'N/A',
            spaceExplanation: result.complexity_reasoning || 'Legacy analysis did not include a separate space explanation.',
            spaceRating: 'acceptable',
            constraintWarning: null,
        },
        patterns: [],
        bugs: bugObjects,
        metrics: {
            linesOfCode: code ? code.split(/\r?\n/).filter((line) => line.trim()).length : 0,
            cyclomaticComplexity: 1,
            nestingDepth: 1,
            variableCount: 0,
            branchCount: 0,
            readability: 'Medium',
        },
        optimization: {
            hasSuggestion: Boolean(result.optimization_suggestion?.before || result.optimization_suggestion?.after || result.optimization_suggestion?.benefit),
            summary: result.optimization_suggestion?.benefit || '',
            complexityChange: 'same complexity, cleaner code',
            before: result.optimization_suggestion?.before || '',
            after: result.optimization_suggestion?.after || '',
            explanation: result.optimization_suggestion?.benefit || '',
        },
        style: Array.isArray(result.style_issues)
            ? result.style_issues.map((item) => ({ type: 'info', text: item }))
            : [],
        interviewReadiness: {
            correctness: bugObjects.length === 0 ? 82 : 65,
            efficiency: 74,
            edgeCoverage: bugObjects.length === 0 ? 76 : 58,
            clarity: 72,
            robustness: bugObjects.length === 0 ? 78 : 60,
            cfFitness: 73,
            toReach95: 'Re-run the deep analyzer on this solution to get the richer issue list and improve the remaining edge-case coverage.',
        },
        similarProblems: [],
        tags: ['legacy-analysis'],
        missedEdgeCases: Array.isArray(result.bugs) ? result.bugs.slice(0, 4) : [],
        provider: 'legacy',
    };
}

function normalizeAnalysisPayload(result = {}, code = '') {
    return normalizeLegacyAnalysis(result, code);
}

async function requestFromBases(bases, requestFactory) {
    let lastError = null;

    for (const baseUrl of bases) {
        try {
            return await requestFactory(baseUrl);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Analysis API is unavailable');
}

function scoreColor(score) {
    if (score >= 80) return '#00F5FF';
    if (score >= 60) return '#1E90FF';
    return '#ff5c8a';
}

function complexityTone(rating = 'acceptable') {
    if (rating === 'optimal') return 'text-emerald-300';
    if (rating === 'acceptable') return 'text-[#EAF6FF]';
    return 'text-amber-300';
}

function metricTone(type, value) {
    if (type === 'readability') {
        if (value === 'High') return 'text-emerald-300';
        if (value === 'Medium') return 'text-amber-300';
        return 'text-rose-300';
    }

    if (type === 'cyclomaticComplexity') {
        if (value <= 5) return 'text-emerald-300';
        if (value <= 10) return 'text-amber-300';
        return 'text-rose-300';
    }

    if (type === 'nestingDepth') {
        if (value <= 3) return 'text-emerald-300';
        if (value <= 5) return 'text-amber-300';
        return 'text-rose-300';
    }

    return 'text-[#EAF6FF]';
}

function readinessTone(value) {
    if (value >= 80) return 'ax-bar-good text-emerald-300';
    if (value >= 60) return 'ax-bar-mid text-amber-300';
    return 'ax-bar-low text-rose-300';
}

function ratingToFill(rating = 'acceptable') {
    if (rating === 'optimal') return 92;
    if (rating === 'acceptable') return 74;
    if (rating === 'suboptimal') return 45;
    if (rating === 'too slow') return 24;
    if (rating === 'high') return 40;
    return 60;
}

function pillClass(kind) {
    const map = {
        green: 'ax-pill ax-pill-green',
        amber: 'ax-pill ax-pill-amber',
        red: 'ax-pill ax-pill-red',
        blue: 'ax-pill ax-pill-blue',
    };
    return map[kind] || map.blue;
}

function formatLastAnalysed(dateValue) {
    if (!dateValue) return '';
    try {
        return new Date(dateValue).toLocaleString();
    } catch {
        return '';
    }
}

function Section({ index, title, children }) {
    const tiltRef = useCardTilt(4);

    return (
        <section
            ref={tiltRef}
            data-cursor="card"
            className="ax-card rounded-2xl p-4 opacity-0"
            style={{ transformStyle: 'preserve-3d', willChange: 'transform', animation: `fadeUp 0.45s ease ${index * 0.1}s forwards` }}
        >
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[#00D4FF]" style={{ textShadow: '0 0 10px rgba(0,212,255,0.35)' }}>{title}</h2>
            {children}
        </section>
    );
}

function AnalysePage({ isDaily = false }) {
    const { analysisId } = useParams();
    const navigate = useNavigate();
    const apiBases = useMemo(() => getAnalysisApiBases(), []);
    const [language, setLanguage] = useState('cpp');
    const [problemContext, setProblemContext] = useState('');
    const [code, setCode] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [savedId, setSavedId] = useState(analysisId || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingShared, setIsFetchingShared] = useState(false);
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);
    const [lastAnalysedAt, setLastAnalysedAt] = useState('');
    const [analysisError, setAnalysisError] = useState('');

    // Daily Challenge & Leaderboard states
    const [animatedScore, setAnimatedScore] = useState(0);
    const [showActionButtons, setShowActionButtons] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [percentileText, setPercentileText] = useState('');
    const [activeDailyProblem, setActiveDailyProblem] = useState(null);
    const [scorePulse, setScorePulse] = useState(false);
    const [isDbConnected, setIsDbConnected] = useState(true); 
    const [challengeModal, setChallengeModal] = useState(null);
    const cardRef = useRef(null);
    const editorRef = useRef(null);
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await axios.get(`${serverUrl}/health`);
                setIsDbConnected(res.data.db);
            } catch {
                setIsDbConnected(false);
            }
        };
        checkHealth();
    }, [serverUrl]);

    const animateScore = (target, onUpdate) => {
        const start = performance.now();
        const duration = 1500;
        function frame(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
            onUpdate(Math.round(eased * target));
            if (progress < 1) {
                requestAnimationFrame(frame);
            } else {
                setScorePulse(true);
                setTimeout(() => setScorePulse(false), 300);
            }
        }
        requestAnimationFrame(frame);
    };

    const fetchPercentile = async (platform, userScore) => {
        try {
            const response = await axios.get(`${serverUrl}/api/daily/${platform}/leaderboard`);
            const { entries, totalCount } = response.data;
            if (totalCount < 5) {
                setPercentileText('One of the first to analyse today');
            } else {
                const lowerScores = entries.filter(e => e.score < userScore).length;
                const percentile = Math.round((lowerScores / totalCount) * 100);
                setPercentileText(`Better than ${percentile}% of solutions today`);
            }
        } catch (err) {
            console.error('Percentile fetch failed:', err);
        }
    };

    const handleShareScore = async () => {
        if (!cardRef.current) return;
        try {
            // Wait for any potential layout changes
            await new Promise(resolve => setTimeout(resolve, 50));

            // Use toPng with improved options
            const dataUrl = await htmlToImage.toPng(cardRef.current, { 
                width: 800, 
                height: 420,
                pixelRatio: 2,
                cacheBust: true,
                skipAutoScale: true,
                // These help with resource loading
                preferredFontFormat: 'woff2'
            });

            if (!dataUrl || dataUrl.length < 1000) {
                throw new Error('Generated image is too small or empty');
            }

            const link = document.createElement('a');
            link.download = `Axion-score-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();

            await handleChallengeFriend();
            toast.success('Score card downloaded!');
        } catch (err) {
            console.error('Share image error:', err);
            toast.error('Image generation failed. Please try again.');
        }
    };

    const handleChallengeFriend = async () => {
        try {
            const displayAnalysis = analysis ? normalizeAnalysisPayload(analysis, code) : null;
            if (!displayAnalysis) return;

            const response = await axios.post(`${serverUrl}/api/challenge/create`, {
                challengerName: localStorage.getItem('Axion-username') || 'Anonymous',
                challengerScore: displayAnalysis.overallScore,
                challengerVerdict: displayAnalysis.verdict,
                challengerTimeComplexity: displayAnalysis.complexity.time,
                language: language,
                problemContext: problemContext || 'Custom Problem',
                platform: activeDailyProblem ? `daily-${activeDailyProblem.platform}` : 'custom'
            });

            const challengeUrl = response.data.challengeUrl;
            await navigator.clipboard.writeText(challengeUrl);
            
            const waText = encodeURIComponent( 
                `I scored ${displayAnalysis.overallScore}/100 on Axion Daily Challenge${ 
                  activeDailyProblem?.platform === 'leetcode' ? " (today's LeetCode POTD)" : 
                  activeDailyProblem?.platform === 'codeforces' ? " (today's CF Daily)" : "" 
                }. Can you beat it? ${challengeUrl}` 
            ); 
            const waUrl = `https://wa.me/?text=${waText}`;

            setChallengeModal({ open: true, challengeUrl, waUrl, score: displayAnalysis.overallScore });
            toast.success('Challenge created and link copied!');
        } catch (err) {
            console.error('Challenge creation failed:', err);
            toast.error('Failed to create challenge');
        }
    };

    const handleUseDailyProblem = (problem) => {
        setProblemContext(problem.title + ' - ' + problem.statement.slice(0, 200));
        setActiveDailyProblem(problem);
        if (language === '') setLanguage('cpp');
        editorRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const lineCount = code ? code.split(/\r?\n/).length : 0;
    const charCount = code.length;
    const displayAnalysis = analysis ? normalizeAnalysisPayload(analysis, code) : null;
    const provider = displayAnalysis?.provider || 'Axion AI';
    const circumference = 251;
    const currentScoreValue = displayAnalysis?.overallScore || 0;
    const scoreOffset = circumference - (animatedScore / 100) * circumference;

    useEffect(() => {
        if (!isLoading) {
            setLoadingStepIndex(0);
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setLoadingStepIndex((current) => (current + 1) % LOADING_STEPS.length);
        }, 480);

        return () => window.clearInterval(intervalId);
    }, [isLoading]);

    useEffect(() => {
        if (!analysisId) return;

        const loadSharedAnalysis = async () => {
            setIsFetchingShared(true);
            try {
                const response = await requestFromBases(apiBases, (baseUrl) => axios.get(`${baseUrl}/api/analysis/${analysisId}`));
                const shared = response.data.analysis;
                setLanguage(shared.language || 'cpp');
                setProblemContext(shared.prompt || '');
                setCode(shared.code || '');
                setAnalysis(normalizeAnalysisPayload(shared.result || {}, shared.code || ''));
                setSavedId(shared.id || analysisId);
                setLastAnalysedAt(shared.createdAt || '');
                setAnalysisError('');
            } catch {
                toast.error('Analysis link not found');
            } finally {
                setIsFetchingShared(false);
            }
        };

        loadSharedAnalysis();
    }, [analysisId, apiBases]);

    const copyShareLink = async () => {
        if (!savedId) {
            toast.error('Run an analysis first.');
            return;
        }

        await navigator.clipboard.writeText(window.location.href);
        toast.success('Share link copied');
    };

    const handleAnalyse = async () => {
        if (!code.trim()) {
            toast.error('Paste your solution first.');
            return;
        }

        setIsLoading(true);
        setAnalysisError('');

        try {
            const analysisResponse = await requestFromBases(apiBases, (baseUrl) => axios.post(`${baseUrl}/api/analyse`, {
                code,
                language,
                problemContext,
            }));

            const parsedResult = normalizeAnalysisPayload(analysisResponse.data, code);
            const saveResponse = await requestFromBases(apiBases, (baseUrl) => axios.post(`${baseUrl}/api/analysis/save`, {
                code,
                language,
                problemContext,
                result: parsedResult,
            }));

            const nextId = saveResponse.data.id;
            setAnalysis(parsedResult);
            setSavedId(nextId);
            setLastAnalysedAt(new Date().toISOString());
            
            // Trigger score animation
            setAnimatedScore(0);
            animateScore(parsedResult.overallScore, setAnimatedScore);

            // Fetch percentile and show action buttons after delay
            if (activeDailyProblem) {
                fetchPercentile(activeDailyProblem.platform, parsedResult.overallScore);
                
                // Submit to leaderboard automatically if matching daily problem
                axios.post(`${serverUrl}/api/daily/submit`, {
                    platform: activeDailyProblem.platform,
                    score: parsedResult.overallScore,
                    verdict: parsedResult.verdict,
                    timeComplexity: parsedResult.complexity.time,
                    spaceComplexity: parsedResult.complexity.space,
                    language: language,
                    displayName: localStorage.getItem('Axion-username') || 'Anonymous'
                }).catch(err => console.error('Leaderboard auto-submit failed:', err));
            }

            setTimeout(() => setShowActionButtons(true), 800);

            window.history.pushState({}, '', `/analysis/${nextId}`);
            navigate(`/analysis/${nextId}`, { replace: true });
            toast.success('Analysis ready');
        } catch (error) {
            const message = error.response?.data?.error || 'Analysis failed';
            setAnalysisError(error.response?.data?.raw || message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const openProblemSearch = (problem) => {
        const tags = Array.isArray(problem.tags) ? problem.tags.join(',') : '';
        window.open(`https://codeforces.com/problemset?tags=${encodeURIComponent(tags)}`, '_blank', 'noopener,noreferrer');
    };

    const resultSections = displayAnalysis ? [
        {
            key: 'overall',
            title: 'Overall Score',
            content: (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="ax-subcard rounded-2xl p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center">
                            <div className={`ax-ring-wrap relative h-28 w-28 shrink-0 rounded-full transition-shadow duration-300 ${scorePulse ? 'ax-ring-pulse' : ''}`}>
                        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                            <circle cx="40" cy="40" r="32" stroke="#18213a" strokeWidth="8" fill="none" />
                            <circle
                                cx="40"
                                cy="40"
                                r="32"
                                stroke={scoreColor(animatedScore)}
                                strokeWidth="8"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={scoreOffset}
                                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 6px ${scoreColor(animatedScore)})` }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-[#EAF6FF]">{animatedScore}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="ax-eyebrow">Axion verdict</p>
                                <h3 className="mt-2 text-2xl font-semibold text-[#EAF6FF]">{displayAnalysis.verdict}</h3>
                                {percentileText && (
                                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#00F5FF]" style={{ textShadow: '0 0 8px rgba(0,245,255,0.4)' }}>{percentileText}</p>
                                )}
                                
                                {isDaily && isDbConnected && (
                                    <button 
                                        onClick={() => setIsLeaderboardOpen(true)}
                                        className="ax-mini-btn mt-2"
                                    >
                                        🏆 View Today's Leaderboard
                                    </button>
                                )}

                                <p className="mt-3 text-base leading-8 text-[#c9d9ee]">{displayAnalysis.summary}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {displayAnalysis.tags.map((tag) => (
                                        <span key={tag} className={pillClass('blue')}>{tag}</span>
                                    ))}
                                    <span className={displayAnalysis.bugs.length ? pillClass('red') : pillClass('green')}>
                                        {displayAnalysis.bugs.length} issues
                                    </span>
                                    <span className={displayAnalysis.complexity.timeRating === 'optimal' ? pillClass('green') : pillClass('amber')}>
                                        {displayAnalysis.complexity.timeRating}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        <div ref={editorRef} className="ax-subcard rounded-2xl p-4">
                            <p className="ax-eyebrow">Time complexity</p>
                            <p className="mt-3 text-2xl font-bold text-[#00D4FF]" style={{ textShadow: '0 0 10px rgba(0,212,255,0.35)' }}>{displayAnalysis.complexity.time}</p>
                        </div>
                        <div className="ax-subcard rounded-2xl p-4">
                            <p className="ax-eyebrow">Space complexity</p>
                            <p className="mt-3 text-2xl font-bold text-[#00F5FF]" style={{ textShadow: '0 0 10px rgba(0,245,255,0.35)' }}>{displayAnalysis.complexity.space}</p>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'complexity',
            title: 'Complexity Analysis',
            content: (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {[
                            ['TIME COMPLEXITY', displayAnalysis.complexity.time, displayAnalysis.complexity.timeExplanation, displayAnalysis.complexity.timeRating],
                            ['SPACE COMPLEXITY', displayAnalysis.complexity.space, displayAnalysis.complexity.spaceExplanation, displayAnalysis.complexity.spaceRating],
                        ].map(([label, value, explanation, rating]) => (
                            <div key={label} className="ax-subcard rounded-2xl p-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6f88a8]">{label}</p>
                                <p className={`mt-4 font-mono text-4xl ${complexityTone(rating)}`}>{value}</p>
                                <span className={rating === 'optimal' ? pillClass('green') : rating === 'acceptable' ? pillClass('blue') : pillClass('amber')}>
                                    {rating}
                                </span>
                                <p className="mt-4 text-sm leading-7 text-[#c9d9ee]">{explanation}</p>
                                <div className="ax-inset mt-4 rounded-xl px-4 py-3 text-sm text-[#91A8C3]">
                                    Complexity confidence: {ratingToFill(rating)} / 100
                                </div>
                            </div>
                        ))}
                    </div>
                    {displayAnalysis.complexity.constraintWarning ? (
                        <div className="ax-subcard rounded-lg p-3 text-sm leading-7 text-[#91A8C3]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6f88a8]">Constraint Check</p>
                            <p className="mt-2">{displayAnalysis.complexity.constraintWarning}</p>
                        </div>
                    ) : null}
                </div>
            ),
        },
        {
            key: 'patterns',
            title: 'Algorithm & Pattern Detection',
            content: displayAnalysis.patterns.length ? (
                <div className="space-y-3">
                    {displayAnalysis.patterns.map((pattern) => (
                        <div key={`${pattern.name}-${pattern.confidence}`} className="ax-subcard flex items-start gap-3 rounded-lg p-3">
                            <div className="ax-icon-chip mt-1 h-10 w-10 rounded-lg text-center text-lg leading-10">A</div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium text-[#EAF6FF]">{pattern.name}</p>
                                    <span className={`text-xs font-semibold ${pattern.confidence >= 90 ? 'text-emerald-300' : pattern.confidence >= 60 ? 'text-[#EAF6FF]' : 'text-amber-300'}`}>
                                        {pattern.confidence}% {pattern.confidence < 60 ? 'Suggestion' : 'confidence'}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-[#91A8C3]">{pattern.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-[#91A8C3]">No specific algorithmic patterns detected.</p>
            ),
        },
        {
            key: 'bugs',
            title: 'Bug & Risk Detection',
            content: displayAnalysis.bugs.length ? (
                <div className="space-y-3">
                    {displayAnalysis.bugs.map((bug) => (
                        <div key={`${bug.title}-${bug.location}`} className="ax-subcard flex overflow-hidden rounded-lg">
                            <div className={`w-1 ${bug.severity === 'critical' ? 'bg-rose-500' : bug.severity === 'high' ? 'bg-amber-400' : bug.severity === 'medium' ? 'bg-sky-400' : 'bg-[#3a4a6b]'}`} />
                            <div className="flex-1 p-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={bug.severity === 'critical' ? pillClass('red') : bug.severity === 'high' ? pillClass('amber') : bug.severity === 'medium' ? pillClass('blue') : 'ax-pill'}>
                                        {bug.severity}
                                    </span>
                                    <h3 className="text-sm font-medium text-[#EAF6FF]">{bug.title}</h3>
                                </div>
                                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[#6f88a8]">{bug.location}</p>
                                <p className="mt-2 text-sm leading-6 text-[#91A8C3]">{bug.explanation}</p>
                                <pre className="ax-code-block mt-3 overflow-x-auto p-3 font-mono text-[11px] leading-6">{bug.fix}</pre>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">No critical issues found.</div>
            ),
        },
        {
            key: 'metrics',
            title: 'Code Metrics',
            content: (
                <div className="ax-metric-grid grid gap-px rounded-xl md:grid-cols-3">
                    {[
                        ['Lines of code', displayAnalysis.metrics.linesOfCode, 'default'],
                        ['Cyclomatic complexity', displayAnalysis.metrics.cyclomaticComplexity, 'cyclomaticComplexity'],
                        ['Nesting depth', displayAnalysis.metrics.nestingDepth, 'nestingDepth'],
                        ['Variable count', displayAnalysis.metrics.variableCount, 'default'],
                        ['Branch count', displayAnalysis.metrics.branchCount, 'default'],
                        ['Readability', displayAnalysis.metrics.readability, 'readability'],
                    ].map(([label, value, type]) => (
                        <div key={label} className="ax-metric-cell p-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6f88a8]">{label}</p>
                            <p className={`mt-3 text-lg font-bold ${metricTone(type, value)}`}>{value}</p>
                        </div>
                    ))}
                </div>
            ),
        },
        ...(displayAnalysis.optimization?.hasSuggestion ? [{
            key: 'optimization',
            title: 'Concrete Optimization',
            content: (
                <div className="space-y-4">
                    <div className="ax-metric-grid grid gap-px rounded-xl md:grid-cols-2">
                        <div className="ax-metric-cell p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-rose-300">Before</p>
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-[#91A8C3]">{displayAnalysis.optimization.before}</pre>
                        </div>
                        <div className="ax-metric-cell p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">After</p>
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-[#EAF6FF]">{displayAnalysis.optimization.after}</pre>
                        </div>
                    </div>
                    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                        <p>{displayAnalysis.optimization.summary || displayAnalysis.optimization.complexityChange}</p>
                        <p className="mt-2">Up: {displayAnalysis.optimization.explanation}</p>
                    </div>
                </div>
            ),
        }] : []),
        {
            key: 'style',
            title: 'Style & Readability',
            content: (
                <div className="space-y-3">
                    {displayAnalysis.style.length ? displayAnalysis.style.map((item, itemIndex) => (
                        <div key={`${item.text}-${itemIndex}`} className="flex items-start gap-3 text-sm text-[#91A8C3]">
                            <span className={`mt-2 h-2.5 w-2.5 rounded-full ${item.type === 'warning' ? 'bg-amber-400' : item.type === 'good' ? 'bg-emerald-400' : 'bg-[#00D4FF]'}`} style={{ boxShadow: item.type === 'good' ? '0 0 6px #34d399' : item.type === 'warning' ? '0 0 6px #fbbf24' : '0 0 6px #00D4FF' }} />
                            <p><span className="font-medium text-[#EAF6FF]">{item.type}</span> {item.text}</p>
                        </div>
                    )) : <p className="text-sm text-[#91A8C3]">No extra style remarks from the analyzer.</p>}
                </div>
            ),
        },
        {
            key: 'readiness',
            title: 'Interview Readiness',
            content: (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                            ['Correctness', displayAnalysis.interviewReadiness.correctness],
                            ['Efficiency', displayAnalysis.interviewReadiness.efficiency],
                            ['Edge coverage', displayAnalysis.interviewReadiness.edgeCoverage],
                            ['Clarity', displayAnalysis.interviewReadiness.clarity],
                            ['Robustness', displayAnalysis.interviewReadiness.robustness],
                            ['CF fitness', displayAnalysis.interviewReadiness.cfFitness],
                        ].map(([label, value]) => {
                            const [barClass, textClass] = readinessTone(value).split(' ');
                            return (
                                <div key={label} className="ax-subcard rounded-2xl p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm text-[#EAF6FF]">{label}</p>
                                        <span className={`text-2xl font-bold ${textClass}`}>{value}%</span>
                                    </div>
                                    <div className="ax-inset mt-4 rounded-xl px-4 py-3">
                                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[#6f88a8]">
                                            <span>Readiness</span>
                                            <span>{value >= 80 ? 'Strong' : value >= 60 ? 'Solid' : 'Needs work'}</span>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0c1428]">
                                            <div className={`ax-fill-bar h-full rounded-full ${barClass}`} style={{ width: `${value}%`, animation: 'barGrow 0.65s ease 0.4s both' }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="ax-subcard rounded-lg p-4 text-sm leading-7 text-[#91A8C3]">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">To Reach 95+</p>
                        <p className="mt-2">{displayAnalysis.interviewReadiness.toReach95}</p>
                    </div>
                </div>
            ),
        },
        ...(displayAnalysis.missedEdgeCases.length ? [{
            key: 'edges',
            title: 'Missed Edge Cases',
            content: (
                <div className="space-y-3">
                    {displayAnalysis.missedEdgeCases.map((edgeCase, edgeIndex) => (
                        <div key={`${edgeCase}-${edgeIndex}`} className="ax-subcard border-l-4 border-rose-500 p-3 text-sm text-[#EAF6FF]">
                            {edgeCase}
                        </div>
                    ))}
                </div>
            ),
        }] : []),
        {
            key: 'similar',
            title: 'Similar Problems',
            content: displayAnalysis.similarProblems.length ? (
                <div className="space-y-3">
                    {displayAnalysis.similarProblems.map((problem) => (
                        <button
                            key={`${problem.name}-${problem.rating}`}
                            type="button"
                            onClick={() => openProblemSearch(problem)}
                            className="ax-subcard ax-hoverable w-full rounded-lg p-4 text-left"
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${problem.difficulty === 'Easy' ? 'text-emerald-300' : problem.difficulty === 'Hard' ? 'text-rose-300' : 'text-amber-300'}`}>
                                    {problem.difficulty[0]}
                                </span>
                                <p className="font-medium text-[#EAF6FF]">{problem.name}</p>
                                <span className="text-xs text-[#91A8C3]">{problem.rating}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {problem.tags.map((tag) => (
                                    <span key={tag} className={pillClass('blue')}>{tag}</span>
                                ))}
                            </div>
                            <p className="mt-3 text-sm text-[#91A8C3]">{problem.reason}</p>
                        </button>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-[#91A8C3]">No similar Codeforces problems suggested yet.</p>
            ),
        },
    ] : [];

    return (
        <div className="ax-shell h-screen overflow-hidden text-[#EAF6FF]">
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes barGrow {
                    from { width: 0; }
                    to { width: var(--w, 100%); }
                }
                @keyframes pulseTrack {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(220%); }
                }
                @keyframes axRingPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,255,0.5); }
                    50% { box-shadow: 0 0 0 10px rgba(0,212,255,0); }
                }
                .ax-shell {
                    background:
                        radial-gradient(120% 100% at 0% 0%, rgba(0,212,255,0.06), transparent 55%),
                        radial-gradient(90% 90% at 100% 100%, rgba(124,92,255,0.06), transparent 50%),
                        linear-gradient(180deg, #0b1426 0%, #101C34 55%, #0b1426 100%);
                }
                .ax-header {
                    background: rgba(16,28,52,0.75);
                    border-bottom: 1px solid rgba(0,212,255,0.14);
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                }
                .ax-brand-badge {
                    background: linear-gradient(135deg, #152544, #0c1428);
                    border: 1px solid rgba(0,212,255,0.25);
                    box-shadow: 0 0 16px rgba(0,212,255,0.15);
                }
                .ax-ghost-btn {
                    border: 1px solid rgba(0,212,255,0.22);
                    background: rgba(9,14,26,0.5);
                    color: #cfeaff;
                    transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
                }
                .ax-ghost-btn:hover { border-color: rgba(0,212,255,0.55); background: rgba(0,212,255,0.08); }
                .ax-ghost-btn:focus-visible { outline: 2px solid #00F5FF; outline-offset: 2px; }
                .ax-aside {
                    background: linear-gradient(180deg, rgba(21,37,68,0.55), rgba(16,28,52,0.7));
                    border-right: 1px solid rgba(0,212,255,0.12);
                }
                .ax-card {
                    background: rgba(18,34,66,0.65);
                    border: 1px solid rgba(0,212,255,0.16);
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    box-shadow: 0 16px 44px -28px rgba(0,0,0,0.7);
                    transition: border-color 220ms ease, box-shadow 220ms ease;
                }
                .ax-card:hover { border-color: rgba(0,212,255,0.32); box-shadow: 0 18px 50px -24px rgba(0,212,255,0.25); }
                .ax-subcard {
                    background: rgba(9,14,26,0.55);
                    border: 1px solid rgba(0,212,255,0.12);
                }
                .ax-inset {
                    background: rgba(6,10,20,0.6);
                    border: 1px solid rgba(0,212,255,0.1);
                }
                .ax-hoverable { transition: border-color 200ms ease, transform 200ms ease; }
                .ax-hoverable:hover { border-color: rgba(0,212,255,0.4); transform: translateY(-1px); }
                .ax-eyebrow {
                    font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #91A8C3;
                }
                .ax-input, .ax-select, .ax-textarea {
                    background: rgba(9,14,26,0.6);
                    border: 1px solid rgba(0,212,255,0.18);
                    color: #EAF6FF;
                    transition: border-color 180ms ease, box-shadow 180ms ease;
                }
                .ax-input:focus, .ax-select:focus, .ax-textarea:focus {
                    outline: none;
                    border-color: rgba(0,212,255,0.55);
                    box-shadow: 0 0 0 3px rgba(0,212,255,0.14);
                }
                .ax-primary-btn {
                    background: linear-gradient(135deg, #1E90FF, #00B8E6);
                    box-shadow: 0 0 0 1px rgba(0,212,255,0.4) inset, 0 10px 28px -10px rgba(0,212,255,0.65);
                    color: white;
                    transition: transform 180ms ease, filter 180ms ease;
                }
                .ax-primary-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .ax-primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .ax-primary-btn:focus-visible { outline: 2px solid #00F5FF; outline-offset: 2px; }
                .ax-pill {
                    display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 12px;
                    font-size: 11px; font-weight: 700; border: 1px solid rgba(0,212,255,0.2);
                    background: rgba(0,212,255,0.06); color: #9fe8ff;
                }
                .ax-pill-blue { border-color: rgba(0,212,255,0.32); background: rgba(0,212,255,0.1); color: #9fe8ff; }
                .ax-pill-green { border-color: rgba(52,211,153,0.35); background: rgba(52,211,153,0.1); color: #6ee7b7; }
                .ax-pill-amber { border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.1); color: #fcd34d; }
                .ax-pill-red { border-color: rgba(255,92,138,0.35); background: rgba(255,92,138,0.1); color: #ff9db8; }
                .ax-mini-btn {
                    display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; padding: 6px 12px;
                    font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
                    background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); color: #00D4FF;
                    transition: background 160ms ease;
                }
                .ax-mini-btn:hover { background: rgba(0,212,255,0.18); }
                .ax-icon-chip {
                    background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.25); color: #00D4FF;
                }
                .ax-code-block {
                    background: rgba(6,10,20,0.75); border: 1px solid rgba(0,212,255,0.1); border-radius: 10px; color: #91A8C3;
                }
                .ax-metric-grid { background: rgba(0,212,255,0.1); }
                .ax-metric-cell { background: rgba(9,14,26,0.65); }
                .ax-ring-wrap { transition: box-shadow 200ms ease; }
                .ax-ring-pulse { animation: axRingPulse 0.6s ease; }
                .ax-bar-good { background: linear-gradient(90deg, #1E90FF, #00F5FF); box-shadow: 0 0 10px rgba(0,245,255,0.6); }
                .ax-bar-mid { background: linear-gradient(90deg, #d29922, #fcd34d); box-shadow: 0 0 10px rgba(251,191,36,0.5); }
                .ax-bar-low { background: linear-gradient(90deg, #ef4444, #ff5c8a); box-shadow: 0 0 10px rgba(255,92,138,0.5); }
                .ax-fill-bar { transition: width 0.65s ease; }
                .ax-loading-scan {
                    position: relative; height: 3px; width: 100%; max-width: 36rem; overflow: hidden; border-radius: 999px;
                    background: rgba(0,212,255,0.08);
                }
                .ax-loading-scan::after {
                    content: ''; position: absolute; top: 0; bottom: 0; width: 32%;
                    background: linear-gradient(90deg, transparent, #00D4FF, #7C5CFF, transparent);
                    box-shadow: 0 0 16px rgba(0,212,255,0.7);
                    animation: pulseTrack 1.1s linear infinite;
                }
                .ax-action-tile {
                    border: 1px solid rgba(0,212,255,0.2); background: rgba(9,14,26,0.5);
                    transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
                }
                .ax-action-tile:hover { transform: translateY(-2px); border-color: rgba(0,212,255,0.5); background: rgba(0,212,255,0.06); }
                .ax-action-tile-cyan:hover { border-color: rgba(0,245,255,0.5); background: rgba(0,245,255,0.06); }
                .ax-action-tile-purple:hover { border-color: rgba(124,92,255,0.5); background: rgba(124,92,255,0.06); }
                .ax-modal {
                    background: linear-gradient(180deg, rgba(21,37,68,0.96), rgba(10,17,33,0.98));
                    border: 1px solid rgba(0,212,255,0.28);
                    box-shadow: 0 30px 90px -30px rgba(0,212,255,0.4);
                }
                @media (prefers-reduced-motion: reduce) {
                    .ax-loading-scan::after { animation: none; left: 0; width: 100%; opacity: 0.5; }
                    .ax-ring-pulse { animation: none; }
                    .ax-hoverable:hover, .ax-action-tile:hover, .ax-primary-btn:hover:not(:disabled) { transform: none; }
                }
            `}</style>

            <header className="ax-header flex items-center justify-between px-5 py-4">
                <Link to="/" data-cursor="button" className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-[rgba(0,212,255,0.06)]">
                    <div className="ax-brand-badge rounded-lg p-1">
                        <img src="/logo.png" alt="Axion logo" className="h-8 w-8 rounded-lg object-contain" />
                    </div>
                    <div>
                        <p className="text-sm font-bold tracking-[0.25em] text-[#00D4FF]" style={{ textShadow: '0 0 10px rgba(0,212,255,0.4)' }}>Axion - Solution Analyser</p>
                        <p className="mt-1 text-xs text-[#91A8C3]">Deep analytics for interview-style and Codeforces-style solutions.</p>
                    </div>
                </Link>
                <div className="flex items-center gap-3">
                    <Link data-cursor="button" to="/history/reports" className="ax-ghost-btn rounded-lg px-3 py-2 text-sm">History</Link>
                    <button data-cursor="button" type="button" onClick={copyShareLink} className="ax-ghost-btn rounded-lg px-3 py-2 text-sm">Share</button>
                </div>
            </header>

            <div className="flex h-[calc(100vh-73px)]">
                <aside className="ax-aside flex h-full w-full flex-col lg:w-[40%] xl:w-[38%]">
                    <div className="overflow-y-auto px-5 py-5">
                        <div className="mb-6 space-y-2">
                            <h1 className="text-2xl font-bold text-white">
                                {isDaily ? 'Daily Challenge' : 'Solution Analyser'}
                            </h1>
                            <p className="text-sm text-[#91A8C3]">
                                {isDaily 
                                    ? 'Daily problems. Deep analysis. Real rankings. Challenge your friends.' 
                                    : 'Deep AI review for complexity, bugs, and interview readiness.'}
                            </p>
                        </div>
                        
                        {isDaily && <DailyChallenge onUseAsContext={handleUseDailyProblem} />}
                        
                        <div className="mt-6 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                            <label className="space-y-2">
                                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#91A8C3]">Language</span>
                                <select
                                    value={language}
                                    onChange={(event) => setLanguage(event.target.value)}
                                    className="ax-select w-full rounded-xl px-4 py-3 text-sm outline-none"
                                >
                                    {LANGUAGE_CHOICES.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#91A8C3]">Problem context</span>
                                <input
                                    value={problemContext}
                                    onChange={(event) => setProblemContext(event.target.value)}
                                    placeholder="e.g. segment tree, n <= 2x10^5, CF-style"
                                    className="ax-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                />
                            </label>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-[#91A8C3]">
                            <p>Lines: {lineCount} - Chars: {charCount}</p>
                            {analysisError ? <p className="max-w-full rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 lg:max-w-[70%]">{analysisError}</p> : null}
                        </div>

                        <div className="ax-subcard mt-3 min-h-[60vh] rounded-2xl p-1">
                            <textarea
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                placeholder="// Paste your solution here"
                                className="ax-textarea h-[calc(100vh-260px)] min-h-[520px] w-full resize-none rounded-2xl border-0 !bg-transparent px-4 py-4 font-mono text-sm leading-[1.7] outline-none"
                            />
                        </div>
                    </div>
                    <div className="border-t border-[rgba(0,212,255,0.12)] px-5 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleAnalyse}
                                disabled={isLoading}
                                data-cursor="button"
                                className="ax-primary-btn rounded-xl px-5 py-3 text-sm font-bold"
                            >
                                {isLoading ? 'Analysing...' : analysis ? 'Re-analyse' : 'Analyse solution'}
                            </button>
                            {lastAnalysedAt ? <p className="text-sm text-[#91A8C3]">Last analysed {formatLastAnalysed(lastAnalysedAt)}</p> : null}
                        </div>
                        <p className="mt-3 text-xs text-[#6f88a8]">Powered by {provider} - results in ~3s</p>
                    </div>
                </aside>

                <main className="flex-1 overflow-y-auto px-5 py-5">
                    {isFetchingShared ? (
                        <div className="flex h-full items-center justify-center text-sm text-[#91A8C3]">Loading shared analysis...</div>
                    ) : isLoading ? (
                        <div className="flex h-full flex-col items-center justify-center">
                            <div className="ax-loading-scan" role="status" aria-live="polite" aria-label={LOADING_STEPS[loadingStepIndex]} />
                            <p className="mt-6 text-sm text-[#EAF6FF]">{LOADING_STEPS[loadingStepIndex]}</p>
                        </div>
                    ) : !displayAnalysis ? (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <div className="ax-icon-chip flex h-16 w-16 items-center justify-center rounded-2xl text-2xl">A</div>
                            <h2 className="mt-6 text-xl font-semibold text-[#EAF6FF]">Paste your solution and click Analyse.</h2>
                            <p className="mt-2 max-w-lg text-sm text-[#91A8C3]">Deep metrics - bug detection - pattern recognition - interview score</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {resultSections.map((section, index) => (
                                <Section key={section.key} index={index} title={section.title}>
                                    {section.content}
                                </Section>
                            ))}
                            <div
                                className="ax-card rounded-xl p-3 opacity-0"
                                style={{ animation: `fadeUp 0.45s ease ${resultSections.length * 0.1}s forwards` }}
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="ax-icon-chip flex h-10 w-10 items-center justify-center rounded-xl">F</div>
                                        <div>
                                            <p className="text-sm font-medium text-[#EAF6FF]">Analysis ready - Score {displayAnalysis.overallScore}/100 - {displayAnalysis.complexity.time} - {displayAnalysis.bugs.length} issues</p>
                                            <p className="text-xs text-[#91A8C3]">Saved as a shareable Axion analysis page.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button data-cursor="button" type="button" onClick={copyShareLink} className="ax-ghost-btn rounded-lg px-3 py-2 text-sm">Copy link</button>
                                        <button data-cursor="button" type="button" onClick={() => navigate('/')} className="ax-primary-btn rounded-lg px-3 py-2 text-sm font-semibold">Open in Axion</button>
                                    </div>
                                </div>
                            </div>

                            {showActionButtons && (
                                <div className="grid grid-cols-3 gap-4 animate-slideUp">
                                    {isDbConnected && (
                                        <button
                                            onClick={() => setIsLeaderboardOpen(true)}
                                            className="ax-action-tile flex flex-col items-center justify-center gap-2 rounded-2xl p-4"
                                        >
                                            <span className="text-2xl">📊</span>
                                            <span className="text-sm font-bold uppercase tracking-wider text-[#00D4FF]">View Leaderboard</span>
                                        </button>
                                    )}
                                    {isDbConnected && (
                                        <button
                                            onClick={handleChallengeFriend}
                                            className="ax-action-tile ax-action-tile-purple flex flex-col items-center justify-center gap-2 rounded-2xl p-4"
                                        >
                                            <span className="text-2xl">🏆</span>
                                            <span className="text-sm font-bold uppercase tracking-wider text-[#c9baff]">Challenge a Friend</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={handleShareScore}
                                        className={`ax-action-tile ax-action-tile-cyan flex flex-col items-center justify-center gap-2 rounded-2xl p-4 ${!isDbConnected ? 'col-span-3' : ''}`}
                                    >
                                        <span className="text-2xl">📤</span>
                                        <span className="text-sm font-bold uppercase tracking-wider text-[#00F5FF]">Share Score</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Hidden Score Card for image generation */}
            <ScoreCard 
                ref={cardRef}
                score={displayAnalysis?.overallScore || 0}
                verdict={displayAnalysis?.verdict || ''}
                problemTitle={activeDailyProblem?.title || problemContext.split(' - ')[0] || 'Custom Solution'}
                language={language}
                timeComplexity={displayAnalysis?.complexity.time || 'O(?)'}
                spaceComplexity={displayAnalysis?.complexity.space || 'O(?)'}
                bugCount={displayAnalysis?.bugs.length || 0}
                percentile={percentileText}
            />

            {challengeModal?.open && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="ax-modal relative w-full max-w-md overflow-hidden rounded-[2rem] p-8 text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl text-[#0b1426]" style={{ background: 'linear-gradient(135deg, #00D4FF, #7C5CFF)', boxShadow: '0 0 30px rgba(0,212,255,0.4)' }}>
                            <Sparkles size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Challenge Created!</h2>
                        <p className="mt-2 text-[#91A8C3]">Your score: <span className="font-bold text-[#00D4FF]">{challengeModal.score}/100</span></p>
                        
                        <div className="mt-8 space-y-4">
                            <div className="ax-subcard rounded-xl p-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-[#6f88a8]">Challenge URL</p>
                                <p className="mt-1 truncate text-sm font-mono text-[#cfeaff]">{challengeModal.challengeUrl}</p>
                            </div>
                            
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(challengeModal.challengeUrl);
                                    toast.success('Link copied!');
                                }}
                                className="ax-primary-btn w-full rounded-xl px-6 py-3 font-bold"
                            >
                                Copy Link
                            </button>
                            
                            <a
                                href={challengeModal.waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 font-bold text-white transition hover:opacity-90"
                            >
                                Share on WhatsApp
                            </a>
                            
                            <button
                                onClick={() => setChallengeModal(null)}
                                className="ax-ghost-btn w-full rounded-xl px-6 py-3 font-bold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Leaderboard 
                isOpen={isLeaderboardOpen} 
                onClose={() => setIsLeaderboardOpen(false)}
                platform={activeDailyProblem?.platform}
                problemTitle={activeDailyProblem?.title}
            />
        </div>
    );
}

export default AnalysePage;