/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const defaultFilters = {
    tags: '',
    minRating: '',
    maxRating: '',
    minSolved: '',
    maxSolved: '',
    search: '',
};

const inputClass =
    'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-amber-500/60 dark:focus:ring-amber-500/20';

const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400';

/**
 * Large modal to browse Codeforces problems from the server catalog (cached API).
 */
function CodeforcesProblemPicker({ isOpen, onClose, onSelect, serverUrl }) {
    const [filters, setFilters] = useState(defaultFilters);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [warning, setWarning] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const limit = 40;

    const fetchWithFilters = useCallback(
        async (nextOffset, append, filterValues) => {
            const f = filterValues || filters;
            setLoading(true);
            setWarning('');
            try {
                const params = new URLSearchParams();
                if (f.tags.trim()) params.set('tags', f.tags.trim());
                if (f.minRating.trim()) params.set('minRating', f.minRating.trim());
                if (f.maxRating.trim()) params.set('maxRating', f.maxRating.trim());
                if (f.minSolved.trim()) params.set('minSolved', f.minSolved.trim());
                if (f.maxSolved.trim()) params.set('maxSolved', f.maxSolved.trim());
                if (f.search.trim()) params.set('search', f.search.trim());
                params.set('limit', String(limit));
                params.set('offset', String(nextOffset));

                const { data } = await axios.get(
                    `${serverUrl}/api/codeforces/problems?${params.toString()}`,
                );
                setTotal(typeof data.total === 'number' ? data.total : 0);
                setOffset(nextOffset);
                if (append) {
                    setRows((prev) => [...prev, ...(data.rows || [])]);
                } else {
                    setRows(data.rows || []);
                }
                if (data.warning) {
                    setWarning(data.warning);
                }
            } catch (error) {
                setWarning(error.response?.data?.error || error.message || 'Failed to load catalog');
            } finally {
                setLoading(false);
            }
        },
        [filters, limit, serverUrl],
    );

    useEffect(() => {
        if (!isOpen) return;
        fetchWithFilters(0, false);
    }, [isOpen, fetchWithFilters]);

    if (!isOpen) return null;

    const handleSearch = (event) => {
        event.preventDefault();
        fetchWithFilters(0, false);
    };

    const loadMore = () => {
        if (loading || rows.length >= total) return;
        fetchWithFilters(offset + limit, true);
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-md sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cf-picker-title"
                className="flex h-[74vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_28px_100px_-28px_rgba(15,23,42,0.55)] ring-1 ring-black/5 dark:border-slate-700/90 dark:bg-[#060d18] dark:shadow-[0_36px_120px_-36px_rgba(0,0,0,0.9)] dark:ring-white/5"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200/90 px-5 py-2.5 sm:px-6 dark:border-slate-700/80">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                            Codeforces catalog
                        </p>
                        <h3 id="cf-picker-title" className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Pick a problem
                        </h3>
                        <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">Select a row to apply to the room.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Close"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth overscroll-contain">
                    {warning && (
                        <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100 sm:mx-8">
                            {warning}
                        </div>
                    )}

                    <div className="sticky top-0 z-20 border-b border-stone-200/90 bg-white/95 px-5 py-2 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-md dark:border-slate-700/80 dark:bg-[#060d18]/95 sm:px-6">
                        <form onSubmit={handleSearch} className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Filters</p>
                                <button
                                    type="button"
                                    onClick={() => setShowFilters((v) => !v)}
                                    className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    {showFilters ? "Collapse" : "Expand"}
                                </button>
                            </div>
                            {showFilters ? (
                                <>
                            <div className="rounded-2xl border border-stone-200/90 bg-stone-50/90 p-5 dark:border-slate-700/80 dark:bg-slate-900/40">
                                <p className={`${labelClass} mb-4 text-stone-700 dark:text-slate-300`}>Search & tags</p>
                                <div className="space-y-4">
                                    <label className="block space-y-2">
                                        <span className={labelClass}>Tags (comma-separated, AND)</span>
                                        <input
                                            id="cf-tags"
                                            name="tags"
                                            value={filters.tags}
                                            onChange={(e) => setFilters((f) => ({ ...f, tags: e.target.value }))}
                                            placeholder="e.g. dp, greedy"
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="block space-y-2">
                                        <span className={labelClass}>Search by title or problem id</span>
                                        <input
                                            id="cf-search"
                                            name="search"
                                            value={filters.search}
                                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                                            placeholder="e.g. 1885 or xor"
                                            className={inputClass}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
                                <p className={`${labelClass} mb-4 text-amber-900 dark:text-amber-200`}>Rating range</p>
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <label className="block space-y-2">
                                        <span className={labelClass}>Minimum rating</span>
                                        <input
                                            type="number"
                                            id="cf-min-rating"
                                            name="minRating"
                                            value={filters.minRating}
                                            onChange={(e) => setFilters((f) => ({ ...f, minRating: e.target.value }))}
                                            placeholder="800"
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="block space-y-2">
                                        <span className={labelClass}>Maximum rating</span>
                                        <input
                                            type="number"
                                            id="cf-max-rating"
                                            name="maxRating"
                                            value={filters.maxRating}
                                            onChange={(e) => setFilters((f) => ({ ...f, maxRating: e.target.value }))}
                                            placeholder="2000"
                                            className={inputClass}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-5 dark:border-slate-700/80 dark:bg-slate-900/35">
                                <p className={`${labelClass} mb-4 text-slate-700 dark:text-slate-300`}>Solves range</p>
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <label className="block space-y-2">
                                        <span className={labelClass}>Minimum solves</span>
                                        <input
                                            type="number"
                                            id="cf-min-solved"
                                            name="minSolved"
                                            value={filters.minSolved}
                                            onChange={(e) => setFilters((f) => ({ ...f, minSolved: e.target.value }))}
                                            placeholder="0"
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="block space-y-2">
                                        <span className={labelClass}>Maximum solves</span>
                                        <input
                                            type="number"
                                            id="cf-max-solved"
                                            name="maxSolved"
                                            value={filters.maxSolved}
                                            onChange={(e) => setFilters((f) => ({ ...f, maxSolved: e.target.value }))}
                                            placeholder="Optional cap"
                                            className={inputClass}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3 pt-1">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="min-h-[44px] rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                                >
                                    {loading ? 'Loading…' : 'Apply filters'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilters(defaultFilters);
                                        fetchWithFilters(0, false, defaultFilters);
                                    }}
                                    className="min-h-[44px] rounded-xl border-2 border-stone-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-stone-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                >
                                    Reset
                                </button>
                            </div>
                                </>
                            ) : null}
                        </form>
                    </div>

                    <div className="px-5 py-4 sm:px-6 sm:py-5">
                        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-stone-200/80 pb-4 dark:border-slate-700/60">
                            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                                <span className="tabular-nums text-lg text-slate-900 dark:text-white">{rows.length}</span>
                                <span className="text-slate-500 dark:text-slate-500"> of </span>
                                <span className="tabular-nums text-lg text-slate-900 dark:text-white">{total}</span>
                                <span className="font-normal text-slate-500 dark:text-slate-400"> matches</span>
                            </p>
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
                                Click a row to select
                            </p>
                        </div>

                        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {rows.map((row) => (
                                <li key={row.internalProblemId}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(row.internalProblemId)}
                                        className="group flex h-full w-full flex-col rounded-2xl border border-stone-200/90 bg-stone-50/90 px-5 py-4 text-left shadow-sm transition hover:border-amber-400/90 hover:bg-white hover:shadow-lg dark:border-slate-700/90 dark:bg-[#0c1629] dark:hover:border-amber-500/50 dark:hover:bg-[#101f38]"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <span className="font-mono text-base font-bold tracking-tight text-slate-900 dark:text-white">
                                                {row.internalProblemId}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {row.rating != null ? (
                                                    <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-950 dark:bg-amber-500/25 dark:text-amber-100">
                                                        {row.rating}
                                                    </span>
                                                ) : (
                                                    <span className="rounded-lg bg-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                        Unrated
                                                    </span>
                                                )}
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {row.solvedCount.toLocaleString()} solves
                                                </span>
                                            </div>
                                        </div>
                                        <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
                                            {row.title}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {(row.tags || []).slice(0, 8).map((t) => (
                                                <span
                                                    key={t}
                                                    className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-stone-200/90 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-600"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {rows.length === 0 && !loading && (
                            <p className="py-20 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                                No problems match. Relax filters or try again later.
                            </p>
                        )}

                        {rows.length < total && (
                            <div className="mt-8 flex justify-center pb-4">
                                <button
                                    type="button"
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="rounded-xl border-2 border-stone-200 bg-white px-8 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-stone-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                >
                                    {loading ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CodeforcesProblemPicker;
