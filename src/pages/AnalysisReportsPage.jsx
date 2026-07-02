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
        <div className="arp-shell min-h-screen px-4 py-10">
            <style>{`
                .arp-shell {
                    background:
                        radial-gradient(120% 100% at 0% 0%, rgba(0,212,255,0.07), transparent 55%),
                        radial-gradient(90% 90% at 100% 100%, rgba(124,92,255,0.07), transparent 50%),
                        linear-gradient(180deg, #0b1426 0%, #101C34 55%, #0b1426 100%);
                    color: #EAF6FF;
                }
                .arp-title {
                    color: #EAF6FF;
                }
                .arp-home-link {
                    color: #00D4FF;
                    text-shadow: 0 0 8px rgba(0,212,255,0.35);
                    transition: color 160ms ease;
                }
                .arp-home-link:hover { color: #00F5FF; }
                .arp-empty-panel {
                    background: rgba(18,34,66,0.55);
                    border: 1px dashed rgba(0,212,255,0.28);
                    color: #91A8C3;
                    border-radius: 16px;
                }
                .arp-card {
                    background: rgba(18,34,66,0.65);
                    border: 1px solid rgba(0,212,255,0.16);
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    box-shadow: 0 14px 38px -26px rgba(0,0,0,0.7);
                    transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
                }
                .arp-card:hover, .arp-card:focus-visible {
                    transform: translateY(-2px);
                    border-color: rgba(0,212,255,0.45);
                    box-shadow: 0 18px 46px -22px rgba(0,212,255,0.3);
                }
                .arp-card:focus-visible {
                    outline: 2px solid #00F5FF;
                    outline-offset: 2px;
                }
                @media (prefers-reduced-motion: reduce) {
                    .arp-card:hover, .arp-card:focus-visible { transform: none; }
                }
            `}</style>
            <div className="mx-auto max-w-lg">
                <div className="mb-8 flex items-center justify-between gap-3">
                    <h1 className="arp-title text-2xl font-bold">Analysis Reports</h1>
                    <Link
                        to="/"
                        data-cursor="button"
                        className="arp-home-link text-sm font-bold uppercase tracking-widest"
                    >
                        Home
                    </Link>
                </div>
                {!getAuthToken() ? (
                    <p className="arp-empty-panel p-6 text-sm">
                        Sign in from the home page to save and list session intelligence reports here.
                    </p>
                ) : loading ? (
                    <p className="text-sm text-[#91A8C3]">Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-[#91A8C3]">No reports yet. Generate one from a practice room.</p>
                ) : (
                    <ul className="space-y-3">
                        {rows.map((r) => (
                            <li key={r.shareId}>
                                <Link
                                    to={`/report/${r.shareId}`}
                                    data-cursor="card"
                                    className="arp-card block rounded-2xl p-4"
                                >
                                    <p className="font-medium text-[#EAF6FF]">{r.problemTitle || "Session"}</p>
                                    <p className="mt-1 text-xs text-[#91A8C3]">
                                        Score <span className="font-bold text-[#00D4FF]">{r.sessionScore ?? "—"}</span>
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