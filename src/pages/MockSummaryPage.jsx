import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router';
import toast from 'react-hot-toast';

function MockSummaryPage() {
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const { summaryId } = useParams();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSummary = async () => {
            try {
                const response = await axios.get(`${serverUrl}/api/mock-summary/${summaryId}`);
                setSummary(response.data.summary);
            } catch {
                toast.error('Mock summary not found');
            } finally {
                setLoading(false);
            }
        };

        loadSummary();
    }, [serverUrl, summaryId]);

    const handleCopyShare = async () => {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Summary link copied');
    };

    return (
        <div className="min-h-screen bg-stone-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">Mock Interview</p>
                        <h1 className="mt-2 text-4xl font-bold tracking-tight">Session Summary</h1>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleCopyShare}
                            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-stone-300 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            Share this summary
                        </button>
                        <Link
                            to="/"
                            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                        >
                            Back to ForkSpace
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8 text-sm leading-7 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                        Loading summary...
                    </div>
                ) : summary ? (
                    <div className="space-y-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Problem</p>
                                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.problemTitle}</p>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Duration</p>
                                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.durationLabel}</p>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Candidate</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{summary.candidate}</p>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Latest Run</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{summary.latestRunStatus}</p>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Sample Check</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{summary.latestSampleCheck}</p>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Lines Written</p>
                                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.linesWritten}</p>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Code Size</p>
                                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.codeLength} chars</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8 text-sm leading-7 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                        This summary is unavailable.
                    </div>
                )}
            </div>
        </div>
    );
}

export default MockSummaryPage;
