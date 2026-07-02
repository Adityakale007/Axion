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

// Axion UI: neon-blue glass inputs with cyan focus rings
const inputClass = 'cfp-input w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200';

const labelClass = 'text-[11px] font-bold uppercase tracking-[0.15em] text-[#6f88a8]';

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
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[rgba(6,10,20,0.78)] p-3 backdrop-blur-sm sm:p-4 transition-opacity">
            <style>{`
                .cfp-shell {
                    background:
                        radial-gradient(120% 120% at 0% 0%, rgba(0,212,255,0.08), transparent 55%),
                        radial-gradient(90% 100% at 100% 100%, rgba(124,92,255,0.08), transparent 50%),
                        linear-gradient(180deg, rgba(21,37,68,0.92), rgba(12,20,38,0.98));
                    border: 1px solid rgba(0,212,255,0.22);
                    box-shadow: 0 30px 90px -30px rgba(0,212,255,0.3);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                }
                .cfp-close-btn {
                    border: 1px solid rgba(0,212,255,0.2);
                    background: rgba(9,14,26,0.6);
                    color: #91A8C3;
                    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
                }
                .cfp-close-btn:hover { border-color: rgba(0,212,255,0.5); color: #EAF6FF; background: rgba(0,212,255,0.08); }
                .cfp-close-btn:focus-visible { outline: 2px solid #00F5FF; outline-offset: 2px; }
                .cfp-warning {
                    border: 1px solid rgba(255,92,138,0.35);
                    background: rgba(255,92,138,0.1);
                    color: #ff9db8;
                }
                .cfp-search-bar {
                    background: rgba(9,14,26,0.85);
                    border-bottom: 1px solid rgba(0,212,255,0.14);
                    backdrop-filter: blur(10px);
                }
                .cfp-expand-btn {
                    border: 1px solid rgba(0,212,255,0.2);
                    background: rgba(9,14,26,0.6);
                    color: #cfeaff;
                    transition: border-color 160ms ease, background 160ms ease;
                }
                .cfp-expand-btn:hover { border-color: rgba(0,212,255,0.5); background: rgba(0,212,255,0.08); }
                .cfp-group-card {
                    border: 1px solid rgba(0,212,255,0.12);
                    background: rgba(9,14,26,0.5);
                }
                .cfp-group-card-accent {
                    border: 1px solid rgba(0,212,255,0.28);
                    background: rgba(0,212,255,0.06);
                }
                .cfp-input {
                    background: rgba(6,10,20,0.7);
                    border: 1px solid rgba(0,212,255,0.18);
                    color: #EAF6FF;
                }
                .cfp-input::placeholder { color: #4d6584; }
                .cfp-input:focus {
                    border-color: rgba(0,212,255,0.55);
                    box-shadow: 0 0 0 3px rgba(0,212,255,0.14);
                    background: rgba(6,10,20,0.9);
                }
                .cfp-submit-btn {
                    background: linear-gradient(135deg, #1E90FF, #00B8E6);
                    color: white;
                    box-shadow: 0 0 0 1px rgba(0,212,255,0.4) inset, 0 8px 22px -10px rgba(0,212,255,0.6);
                    transition: transform 180ms ease, filter 180ms ease;
                }
                .cfp-submit-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .cfp-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .cfp-reset-btn {
                    border: 1px solid rgba(0,212,255,0.2);
                    background: rgba(9,14,26,0.6);
                    color: #cfeaff;
                    transition: border-color 160ms ease, background 160ms ease;
                }
                .cfp-reset-btn:hover { border-color: rgba(0,212,255,0.5); background: rgba(0,212,255,0.08); }
                .cfp-card {
                    border: 1px solid rgba(0,212,255,0.14);
                    background: rgba(18,34,66,0.55);
                    transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
                }
                .cfp-card:hover, .cfp-card:focus-visible {
                    transform: translateY(-2px);
                    border-color: rgba(0,212,255,0.5);
                    box-shadow: 0 14px 36px -18px rgba(0,212,255,0.35);
                }
                .cfp-card:focus-visible { outline: 2px solid #00F5FF; outline-offset: 2px; }
                .cfp-pill-rated {
                    background: rgba(0,212,255,0.1);
                    border: 1px solid rgba(0,212,255,0.3);
                    color: #9fe8ff;
                }
                .cfp-pill-unrated {
                    background: rgba(9,14,26,0.7);
                    border: 1px solid rgba(0,212,255,0.14);
                    color: #91A8C3;
                }
                .cfp-tag {
                    background: rgba(9,14,26,0.7);
                    border: 1px solid rgba(0,212,255,0.12);
                    color: #91A8C3;
                }
                .cfp-load-more {
                    border: 1px solid rgba(0,212,255,0.22);
                    background: rgba(9,14,26,0.6);
                    color: #cfeaff;
                    transition: border-color 160ms ease, background 160ms ease;
                }
                .cfp-load-more:hover:not(:disabled) { border-color: rgba(0,212,255,0.5); background: rgba(0,212,255,0.08); }
            `}</style>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cf-picker-title"
                className="cfp-shell flex h-[78vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[rgba(0,212,255,0.14)] px-6 py-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00D4FF]" style={{ textShadow: '0 0 10px rgba(0,212,255,0.4)' }}>
                            Problem Database
                        </p>
                        <h3 id="cf-picker-title" className="mt-1 text-2xl font-bold tracking-tight text-[#EAF6FF]">
                            Select Challenge
                        </h3>
                        <p className="mt-1 max-w-2xl text-xs text-[#91A8C3]">
                            Search the Codeforces catalog to import into your workspace.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="cfp-close-btn inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        aria-label="Close"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth overscroll-contain">
                    {warning && (
                        <div className="cfp-warning mx-6 mt-5 rounded-xl px-4 py-3 text-sm font-medium sm:mx-8">
                            {warning}
                        </div>
                    )}

                    <div className="cfp-search-bar sticky top-0 z-20 px-5 py-3 sm:px-6">
                        <form onSubmit={handleSearch} className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#6f88a8]">
                                    Search & Filters
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowFilters((v) => !v)}
                                    className="cfp-expand-btn rounded-lg px-3 py-1.5 text-xs font-semibold"
                                >
                                    {showFilters ? "Collapse" : "Expand"}
                                </button>
                            </div>
                            {showFilters ? (
                                <>
                                    <div className="cfp-group-card rounded-xl p-5">
                                        <p className={`${labelClass} mb-4 text-[#cfeaff]`}>General Search</p>
                                        <div className="space-y-4">
                                            <label className="block space-y-2">
                                                <span className={labelClass}>Tags (comma-separated, AND)</span>
                                                <input
                                                    id="cf-tags"
                                                    name="tags"
                                                    value={filters.tags}
                                                    onChange={(e) => setFilters((f) => ({ ...f, tags: e.target.value }))}
                                                    placeholder="e.g. dp, greedy, bitmasks"
                                                    className={inputClass}
                                                />
                                            </label>
                                            <label className="block space-y-2">
                                                <span className={labelClass}>Search by Title or Problem ID</span>
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

                                    <div className="cfp-group-card-accent rounded-xl p-5">
                                        <p className={`${labelClass} mb-4 text-[#00D4FF]`}>Difficulty Rating</p>
                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                            <label className="block space-y-2">
                                                <span className={labelClass}>Minimum Rating</span>
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
                                                <span className={labelClass}>Maximum Rating</span>
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

                                    <div className="cfp-group-card rounded-xl p-5">
                                        <p className={`${labelClass} mb-4 text-[#cfeaff]`}>Solve Count</p>
                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                            <label className="block space-y-2">
                                                <span className={labelClass}>Minimum Solves</span>
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
                                                <span className={labelClass}>Maximum Solves</span>
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

                                    <div className="flex flex-wrap gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="cfp-submit-btn min-h-[44px] rounded-xl px-6 py-2.5 text-sm font-bold"
                                        >
                                            {loading ? 'Loading…' : 'Apply Filters'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilters(defaultFilters);
                                                fetchWithFilters(0, false, defaultFilters);
                                            }}
                                            className="cfp-reset-btn min-h-[44px] rounded-xl px-6 py-2.5 text-sm font-bold"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </form>
                    </div>

                    <div className="px-5 py-6 sm:px-6">
                        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[rgba(0,212,255,0.14)] pb-4">
                            <p className="text-sm font-medium text-[#91A8C3]">
                                Showing <span className="font-bold text-[#EAF6FF]">{rows.length}</span> of{' '}
                                <span className="font-bold text-[#EAF6FF]">{total}</span> results
                            </p>
                        </div>

                        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {rows.map((row) => (
                                <li key={row.internalProblemId}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(row.internalProblemId)}
                                        className="cfp-card group flex h-full w-full flex-col rounded-xl px-5 py-5 text-left"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3 w-full">
                                            <span className="font-mono text-sm font-bold tracking-tight text-[#EAF6FF]">
                                                {row.internalProblemId}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {row.rating != null ? (
                                                    <span className="cfp-pill-rated rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums">
                                                        Rating: {row.rating}
                                                    </span>
                                                ) : (
                                                    <span className="cfp-pill-unrated rounded-md px-2 py-0.5 text-[11px] font-semibold">
                                                        Unrated
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="mt-2.5 line-clamp-2 text-base font-bold leading-tight text-[#EAF6FF] transition-colors group-hover:text-[#00D4FF]">
                                            {row.title}
                                        </p>

                                        <div className="mt-4 flex w-full items-end justify-between gap-4 mt-auto pt-2">
                                            <div className="flex flex-wrap gap-1.5 flex-1">
                                                {(row.tags || []).slice(0, 4).map((t) => (
                                                    <span
                                                        key={t}
                                                        className="cfp-tag rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                                {(row.tags || []).length > 4 && (
                                                    <span className="text-[10px] font-medium text-[#5b7799] flex items-center">
                                                        +{row.tags.length - 4} more
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[11px] font-semibold text-[#5b7799] whitespace-nowrap">
                                                {row.solvedCount.toLocaleString()} solves
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {rows.length === 0 && !loading && (
                            <div className="py-24 text-center">
                                <p className="text-sm font-medium text-[#91A8C3]">
                                    No challenges found. Try adjusting your filters.
                                </p>
                            </div>
                        )}

                        {rows.length < total && (
                            <div className="mt-10 flex justify-center pb-6">
                                <button
                                    type="button"
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="cfp-load-more rounded-xl px-8 py-2.5 text-sm font-bold disabled:opacity-50"
                                >
                                    {loading ? 'Loading…' : 'Load More'}
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