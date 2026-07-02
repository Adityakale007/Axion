/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from '../components/Workspace/languages';
import { getAnalysisApiBases } from '../lib/analysisApi';

function InsightCard({ label, value, tone = 'default' }) {
    const toneClasses = {
        default: 'border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900',
        blue: 'border-blue-200 bg-blue-50/80 dark:border-blue-800/40 dark:bg-blue-950/20',
        emerald: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/40 dark:bg-emerald-950/20',
    };

    return (
        <div className={`rounded-3xl border p-5 shadow-sm ${toneClasses[tone]}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{value || 'Not available'}</p>
        </div>
    );
}

async function requestFromAnalysisApis(apiBases, requestFactory) {
    let lastError = null;

    for (const baseUrl of apiBases) {
        try {
            return await requestFactory(baseUrl);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Analysis API is unavailable');
}

function SolutionAnalyzer() {
    const { analysisId } = useParams();
    const navigate = useNavigate();
    const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
    const [code, setCode] = useState('');
    const [prompt, setPrompt] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingShared, setIsFetchingShared] = useState(false);
    const analysisApiBases = useMemo(() => getAnalysisApiBases(), []);

    const normalizedAnalysis = analysis
        ? {
            ...analysis,
            bugs: Array.isArray(analysis.bugs) ? analysis.bugs : [],
            time_complexity: analysis.time_complexity || 'N/A',
            space_complexity: analysis.space_complexity || 'N/A',
            complexity_reasoning: analysis.complexity_reasoning || '',
            optimization_suggestion:
                analysis.optimization_suggestion && typeof analysis.optimization_suggestion === 'object'
                    ? analysis.optimization_suggestion
                    : { before: '', after: '', benefit: '' },
            summary:
                typeof analysis.summary === 'string' && analysis.summary.trim()
                    ? analysis.summary.trim()
                    : 'Analysis generated. Review the details below.',
        }
        : null;

    const hasOptimizationSuggestion = Boolean(
        normalizedAnalysis?.optimization_suggestion?.before
        || normalizedAnalysis?.optimization_suggestion?.after
        || normalizedAnalysis?.optimization_suggestion?.benefit,
    );

    useEffect(() => {
        if (!analysisId) return;

        const loadSharedAnalysis = async () => {
            setIsFetchingShared(true);
            try {
                const response = await requestFromAnalysisApis(analysisApiBases, (baseUrl) => axios.get(`${baseUrl}/api/analysis/${analysisId}`));
                const sharedAnalysis = response.data.analysis;
                setLanguage(sharedAnalysis.language || DEFAULT_LANGUAGE);
                setCode(sharedAnalysis.code || '');
                setPrompt(sharedAnalysis.prompt || '');
                setAnalysis(sharedAnalysis.result || null);
            } catch {
                toast.error('Analysis link not found');
            } finally {
                setIsFetchingShared(false);
            }
        };

        loadSharedAnalysis();
    }, [analysisApiBases, analysisId]);

    const handleAnalyse = async () => {
        if (!code.trim()) {
            toast.error('Paste a solution first.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await requestFromAnalysisApis(analysisApiBases, (baseUrl) => axios.post(`${baseUrl}/api/analysis`, {
                code,
                language,
                prompt,
            }));

            setAnalysis(response.data.analysis);
            navigate(`/analysis/${response.data.analysisId}`);
            toast.success('Analysis ready');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to analyse solution');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyShare = async () => {
        if (!analysisId) {
            toast.error('Run an analysis first.');
            return;
        }

        await navigator.clipboard.writeText(window.location.href);
        toast.success('Shareable analysis link copied');
    };

    return (
        <div className="min-h-screen bg-stone-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">Standalone Tool</p>
                        <h1 className="mt-2 text-4xl font-bold tracking-tight">Solution Analyser</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                            Paste any DSA solution, inspect its complexity and risks, and generate a public shareable analysis link without opening a room.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleCopyShare}
                            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-stone-300 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            Share your analysis
                        </button>
                        <Link
                            to="/"
                            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                        >
                            Back to ForkSpace
                        </Link>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                    <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Language</span>
                                <select
                                    value={language}
                                    onChange={(event) => setLanguage(event.target.value)}
                                    title={LANGUAGE_OPTIONS[language]?.label || "Language"}
                                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                >
                                    {Object.entries(LANGUAGE_OPTIONS).map(([key, value]) => (
                                        <option key={key} value={key}>
                                            {`${value.optionGlyph ?? ""} ${value.label}`.trim()}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Problem context</span>
                                <input
                                    value={prompt}
                                    onChange={(event) => setPrompt(event.target.value)}
                                    placeholder="Optional: describe the problem or intended approach"
                                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </label>
                        </div>
                        <label className="mt-5 block space-y-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Solution</span>
                            <textarea
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                placeholder="// Paste any DSA solution here"
                                className="min-h-[460px] w-full rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 font-mono text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={handleAnalyse}
                            disabled={isLoading}
                            className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                        >
                            {isLoading ? 'Analysing...' : 'Analyse solution'}
                        </button>
                    </section>

                    <section className="space-y-4">
                        {isFetchingShared ? (
                            <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8 text-sm leading-7 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                                Loading shared analysis...
                            </div>
                        ) : normalizedAnalysis ? (
                            <>
                                <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{normalizedAnalysis.summary}</p>
                                    {normalizedAnalysis.complexity_reasoning ? (
                                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">{normalizedAnalysis.complexity_reasoning}</p>
                                    ) : null}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <InsightCard label="Time Complexity" value={normalizedAnalysis.time_complexity} tone="blue" />
                                    <InsightCard label="Space Complexity" value={normalizedAnalysis.space_complexity} tone="emerald" />
                                </div>
                                {normalizedAnalysis.bugs?.length > 0 ? (
                                    <div className="rounded-[2rem] border border-rose-200 bg-rose-50/80 p-6 shadow-sm dark:border-rose-800/40 dark:bg-rose-950/20">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">Specific missed edge cases</p>
                                        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-rose-900 dark:text-rose-100">
                                            {normalizedAnalysis.bugs.slice(0, 3).map((bug, index) => <li key={`${bug}-${index}`}>{bug}</li>)}
                                        </ul>
                                    </div>
                                ) : null}
                                {hasOptimizationSuggestion ? (
                                    <div className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-6 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/20">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">One concrete optimization</p>
                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-900/50">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Before</p>
                                                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800 dark:text-slate-200">{normalizedAnalysis.optimization_suggestion.before}</p>
                                            </div>
                                            <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-900/50">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">After</p>
                                                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800 dark:text-slate-200">{normalizedAnalysis.optimization_suggestion.after}</p>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-sm leading-7 text-amber-900 dark:text-amber-100">{normalizedAnalysis.optimization_suggestion.benefit}</p>
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8 text-sm leading-7 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                                Run an analysis to get complexity, missed edge cases, and a shareable summary card.
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

export default SolutionAnalyzer;
