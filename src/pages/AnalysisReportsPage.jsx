import { useEffect, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import toast from "react-hot-toast";
import { getAuthHeaders, getAuthToken } from "../lib/auth";

function AnalysisReportsPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const serverUrl =
        rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL
            ? rawServerUrl.replace(":5173", ":5000")
            : rawServerUrl;

    useEffect(() => {
        if (!getAuthToken()) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await axios.get(`${serverUrl}/api/session-intelligence/my-reports`, {
                    headers: getAuthHeaders(),
                });
                if (!cancelled) setRows(res.data.reports || []);
            } catch {
                toast.error("Could not load reports. Try signing in again.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [serverUrl]);

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] px-4 py-10 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)]">
            <div className="mx-auto max-w-lg">
                <div className="mb-8 flex items-center justify-between gap-3">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Analysis Reports</h1>
                    <Link
                        to="/"
                        data-cursor="button"
                        className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
                    >
                        Home
                    </Link>
                </div>

                {!getAuthToken() ? (
                    <p className="rounded-2xl border border-dashed border-gray-300 bg-white/90 p-6 text-sm text-gray-700 dark:border-gray-600 dark:bg-slate-900/70 dark:text-gray-300">
                        Sign in from the home page to save and list session intelligence reports here.
                    </p>
                ) : loading ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No reports yet. Generate one from a practice room.</p>
                ) : (
                    <ul className="space-y-3">
                        {rows.map((r) => (
                            <li key={r.shareId}>
                                <Link
                                    to={`/report/${r.shareId}`}
                                    data-cursor="card"
                                    className="block rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm transition hover:border-amber-300 dark:border-gray-700 dark:bg-slate-900/80 dark:hover:border-amber-600/50"
                                >
                                    <p className="font-medium text-gray-900 dark:text-white">{r.problemTitle || "Session"}</p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Score {r.sessionScore ?? "—"}
                                        {r.createdAt
                                            ? ` · ${new Date(r.createdAt).toLocaleString()}`
                                            : ""}
                                    </p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default AnalysisReportsPage;
