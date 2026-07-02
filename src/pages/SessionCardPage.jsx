import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import axios from "axios";
import toast from "react-hot-toast";

function SessionCardPage() {
  const { shareId } = useParams();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState(null);
  const cardRef = useRef(null);

  const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
  const serverUrl =
    rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL
      ? rawServerUrl.replace(":5173", ":5000")
      : rawServerUrl;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${serverUrl}/api/session-card/${shareId}`);
        if (!cancelled) setCard(data.card || null);
      } catch {
        toast.error("Session card not found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverUrl, shareId]);

  const headline = useMemo(() => {
    if (!card?.strongestSignals?.length) return "How you think: Practical, signal-driven iteration.";
    return `How you think: ${card.strongestSignals[0]}`;
  }, [card?.strongestSignals]);

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/card/${shareId}`;
    await navigator.clipboard.writeText(link);
    toast.success("Card link copied");
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-sm text-amber-300 hover:underline">← Home</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCopyLink} className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
              Copy link
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-400">Loading session card…</p>
        ) : !card ? (
          <p className="text-center text-sm text-slate-400">Card not available.</p>
        ) : (
          <div ref={cardRef} className="mx-auto w-full max-w-xl rounded-3xl border border-slate-700/70 bg-[#0d1117] p-6 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.75)]">
            <h1 className="text-2xl font-bold tracking-tight text-white">{card.problemTitle || "Practice session"}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {(card.tags || []).slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-slate-300">{tag}</span>
              ))}
              {card.rating ? (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-300">
                  Rating {card.rating}
                </span>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Score</p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">{card.score ?? "N/A"}</p>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">{headline}</p>

            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Strongest signals</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-200">
                {(card.strongestSignals || []).slice(0, 2).map((signal) => (
                  <li key={signal}>✔ {signal}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-amber-300">Biggest gap</p>
              <p className="mt-1 text-sm text-amber-100">⚠ {card.biggestGap || "Keep tightening edge-case checks and output validation."}</p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-700 pt-4 text-xs text-slate-400">
              <span>ForkSpace Session</span>
              <a href="/new" className="text-amber-300 hover:underline">forkspace.app/new</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionCardPage;
