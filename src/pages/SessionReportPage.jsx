import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import axios from "axios";
import toast from "react-hot-toast";
import SessionIntelligenceReportDashboard from "../components/sessionIntelligence/SessionIntelligenceReportDashboard.jsx";

function SessionReportPage() {
    const { shareId } = useParams();
    const [loading, setLoading] = useState(true);
    const [payload, setPayload] = useState(null);

    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const serverUrl =
        rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL
            ? rawServerUrl.replace(":5173", ":5000")
            : rawServerUrl;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axios.get(
                    `${serverUrl}/api/session-intelligence/report/${shareId}`,
                );
                if (!cancelled) setPayload(res.data);
            } catch {
                toast.error("Report not found or server unavailable.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [shareId, serverUrl]);

    const report = payload?.report;

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] px-4 py-8 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] sm:px-6 sm:py-12">
            <div className="mx-auto max-w-3xl">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <Link
                        to="/"
                        data-cursor="button"
                        className="text-sm font-semibold text-amber-700 transition hover:underline dark:text-amber-300"
                    >
                        ← Home
                    </Link>
                    <Link
                        to="/history/reports"
                        data-cursor="button"
                        className="text-sm font-medium text-gray-600 transition hover:underline dark:text-gray-400"
                    >
                        Analysis Reports
                    </Link>
                </div>

                {loading ? (
                    <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                        Loading report…
                    </p>
                ) : !report ? (
                    <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                        Nothing to show.
                    </p>
                ) : (
                    <div className="space-y-6">
                        <div className="text-center sm:text-left">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                                ForkSpace · Session intelligence
                            </p>
                            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                                Shared report
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                Polished summary for screenshots and portfolios. Same data as the workspace Report tab.
                            </p>
                        </div>
                        <div data-cursor="card">
                            <SessionIntelligenceReportDashboard
                                report={report}
                                previousReport={payload.previousReport}
                                title={payload.problemTitle || "Practice session"}
                                variant="standalone"
                            />
                        </div>
                        <p className="text-center text-[11px] text-gray-500 dark:text-gray-500">
                            ForkSpace session report · ID {shareId}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SessionReportPage;
