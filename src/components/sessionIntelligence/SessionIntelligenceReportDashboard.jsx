/* eslint-disable react/prop-types */
/**
 * Visual dashboard for Session Intelligence report data (embedded + share page).
 * Presentational only — same fields as API report object.
 */
import {
    PolarAngleAxis,
    PolarGrid,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from 'recharts';

/** Remove duplicate lines while preserving order (backend can repeat filler lines). */
function dedupeStrings(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const s = typeof item === 'string' ? item.trim() : String(item ?? '').trim();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

function SectionDivider({ label }) {
    return (
        <div className="flex items-center gap-3 py-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-slate-700" />
            {label ? (
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    {label}
                </span>
            ) : null}
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-slate-700" />
        </div>
    );
}

export default function SessionIntelligenceReportDashboard({
    report,
    previousReport = null,
    title = 'Practice session',
    subtitle = 'Based on runs, checklist, and reviews in this session.',
    variant = 'embedded',
}) {
    if (!report) return null;

    const pad = variant === 'standalone' ? 'p-6 sm:p-8' : 'p-4 sm:p-5';
    const shell =
        variant === 'standalone'
            ? 'overflow-hidden rounded-[1.35rem] border border-gray-200/90 bg-white/90 shadow-[0_4px_40px_-12px_rgba(15,23,42,0.2),0_0_0_1px_rgba(251,191,36,0.12)] dark:border-slate-700/90 dark:bg-slate-950/50 dark:shadow-[0_4px_48px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(251,191,36,0.08)]'
            : 'overflow-hidden rounded-[1.15rem] border-0 bg-transparent shadow-none ring-0';

    const strongest = dedupeStrings(report.strongestSignals);
    const gaps = dedupeStrings(report.biggestGaps);
    const steps = dedupeStrings(report.nextSteps);
    const targets = dedupeStrings(report.nextPracticeTargets);
    const toRadarMetrics = (source) => {
        if (!source) return null;
        const stats = source.stats || {};
        const score = Number(source.sessionScore) || 0;
        const speed = Math.max(20, Math.min(100, 100 - Math.min(70, Math.round((Number(stats.firstSubmitMs || 0) / 60000) * 2))));
        const correctness = Math.max(15, Math.min(100, score + (Number(stats.sampleSuitePassCount || 0) * 4) - (Number(stats.sampleMismatchCount || 0) * 8)));
        const codeQuality = Math.max(20, Math.min(100, score + (Number(stats.aiReviewCount || 0) * 3) - (Number(stats.compileErrors || 0) * 6)));
        const edgeCoverage = Math.max(20, Math.min(100, score + ((source.issueLabels || []).includes('edge_case') ? -10 : 6)));
        const complexityHandling = Math.max(20, Math.min(100, score + ((source.issueLabels || []).includes('complexity') ? -8 : 7)));
        return { speed, correctness, codeQuality, edgeCoverage, complexityHandling };
    };
    const currentRadar = toRadarMetrics(report);
    const previousRadar = toRadarMetrics(previousReport);
    const radarData = currentRadar ? [
        { subject: 'Speed', current: currentRadar.speed, previous: previousRadar?.speed ?? 0 },
        { subject: 'Correctness', current: currentRadar.correctness, previous: previousRadar?.correctness ?? 0 },
        { subject: 'Code Quality', current: currentRadar.codeQuality, previous: previousRadar?.codeQuality ?? 0 },
        { subject: 'Edge Case Coverage', current: currentRadar.edgeCoverage, previous: previousRadar?.edgeCoverage ?? 0 },
        { subject: 'Complexity Handling', current: currentRadar.complexityHandling, previous: previousRadar?.complexityHandling ?? 0 },
    ] : [];
    const deltaRows = previousRadar ? [
        ['Speed', currentRadar.speed - previousRadar.speed],
        ['Correctness', currentRadar.correctness - previousRadar.correctness],
        ['Code Quality', currentRadar.codeQuality - previousRadar.codeQuality],
        ['Edge Case Coverage', currentRadar.edgeCoverage - previousRadar.edgeCoverage],
        ['Complexity Handling', currentRadar.complexityHandling - previousRadar.complexityHandling],
    ].filter(([, delta]) => Math.abs(delta) >= 5) : [];

    return (
        <div className={`${shell} ${pad} space-y-1`}>
            <div className="rounded-2xl border border-gray-200/80 bg-white/90 px-5 py-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/65 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                            Session intelligence
                        </p>
                        <h2 className="mt-2 text-xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                            {title}
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">{subtitle}</p>
                    </div>
                    <div className="min-w-[11rem] rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100/60 px-5 py-4 text-right shadow-sm dark:border-amber-900/45 dark:from-amber-950/30 dark:via-slate-900/70 dark:to-slate-900/70">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                            Session score
                        </p>
                        <p className="mt-2 text-5xl font-extrabold leading-none text-amber-900 dark:text-amber-100">
                            {report.sessionScore}
                        </p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-200/80 dark:bg-amber-950/50">
                            <div
                                className="h-full rounded-full bg-amber-500"
                                style={{ width: `${Math.max(0, Math.min(100, Number(report.sessionScore) || 0))}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200/80 bg-white/90 px-5 py-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/65 sm:px-6">
                <div className="mx-auto h-[260px] w-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="#334155" strokeOpacity={0.4} />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            {previousRadar ? (
                                <Radar
                                    dataKey="previous"
                                    stroke="#3b82f6"
                                    fill="#3b82f6"
                                    fillOpacity={0.3}
                                    strokeDasharray="4 4"
                                />
                            ) : null}
                            <Radar
                                dataKey="current"
                                stroke="#f59e0b"
                                fill="#f59e0b"
                                fillOpacity={0.6}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
                {previousRadar ? (
                    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />This session</span>
                        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Last session</span>
                    </div>
                ) : null}
                {deltaRows.length ? (
                    <div className="mt-4 space-y-2">
                        {deltaRows.map(([label, delta]) => (
                            <p key={label} className={`text-sm ${delta > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                {delta > 0 ? '↑' : '↓'} {label} {delta > 0 ? '+' : ''}{delta}% from last session
                            </p>
                        ))}
                    </div>
                ) : null}
            </div>

            {/* Insight — blue */}
            <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/95 to-white p-5 shadow-sm dark:border-sky-900/45 dark:from-sky-950/40 dark:to-slate-900/70">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    How you think
                </p>
                <p className="mt-3 line-clamp-4 text-sm font-medium leading-relaxed text-sky-950 dark:text-sky-50">
                    {report.howYouThink || '—'}
                </p>
            </div>

            <SectionDivider label="Signals & gaps" />

            <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
                {/* Strengths — green */}
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Strongest signals
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {strongest.length ? (
                            strongest.map((s, i) => (
                                <span
                                    key={i}
                                    className="inline-flex max-w-full items-start gap-2 rounded-xl border border-emerald-200/90 bg-white/90 px-3 py-2.5 text-xs font-medium leading-snug text-emerald-950 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-50"
                                >
                                    <svg
                                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                        aria-hidden
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>{s}</span>
                                </span>
                            ))
                        ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400">No signals listed.</p>
                        )}
                    </div>
                </div>

                {/* Gaps — amber / orange */}
                <div className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/45 dark:bg-amber-950/25">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Biggest gaps
                    </p>
                    <div className="mt-4 space-y-2.5">
                        {gaps.length ? (
                            gaps.map((g, i) => (
                                <div
                                    key={i}
                                    className="flex gap-3 rounded-xl border border-orange-200/80 bg-white/90 px-3.5 py-3 shadow-sm dark:border-orange-900/40 dark:bg-orange-950/30"
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-200">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <p className="min-w-0 text-sm font-medium leading-snug text-orange-950 dark:text-orange-50">{g}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400">No gaps listed.</p>
                        )}
                    </div>
                </div>
            </div>

            <SectionDivider label="Next" />

            {/* Next steps — blue action */}
            <div className="rounded-2xl border border-blue-200/75 bg-blue-50/45 p-5 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/25">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Next steps
                </p>
                <ol className="mt-4 space-y-2.5">
                    {steps.length ? (
                        steps.map((s, i) => (
                            <li
                                key={i}
                                className="flex gap-3 rounded-xl border border-blue-200/60 bg-white/90 px-3.5 py-3 text-sm font-medium leading-snug text-blue-950 shadow-sm dark:border-blue-900/35 dark:bg-slate-900/50 dark:text-blue-50"
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white dark:bg-blue-700">
                                    {i + 1}
                                </span>
                                <span className="min-w-0 pt-0.5">{s}</span>
                            </li>
                        ))
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No next steps listed.</p>
                    )}
                </ol>
            </div>

            {/* Practice targets */}
            <div className="rounded-2xl border border-violet-200/70 bg-violet-50/40 p-5 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Next practice targets
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {targets.length ? (
                        targets.map((t, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center rounded-full border border-violet-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-violet-950 shadow-sm dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-100"
                            >
                                {t}
                            </span>
                        ))
                    ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">No targets listed.</p>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-gray-200/70 bg-gray-50/80 px-4 py-3 text-xs text-gray-600 dark:border-gray-700/70 dark:bg-slate-900/60 dark:text-gray-400">
                <span className="font-semibold">Score note:</span> The score blends runtime reliability, sample outcomes, and iteration quality for this session.
            </div>
        </div>
    );
}
