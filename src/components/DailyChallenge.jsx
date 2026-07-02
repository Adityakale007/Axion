import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

/**
 * Derived, purely-local presentation helpers.
 * No new API calls are introduced — these only shape data that
 * already arrives from /api/daily/leetcode and /api/daily/codeforces.
 */
const DIFFICULTY_META = {
  easy: { label: 'Easy', pct: 30, xp: 60, minutes: '15–20 min' },
  medium: { label: 'Medium', pct: 60, xp: 120, minutes: '25–40 min' },
  hard: { label: 'Hard', pct: 90, xp: 220, minutes: '45–70 min' },
};

const getDifficultyKey = (diff) => {
  const d = String(diff || '').toLowerCase();
  if (d === 'easy') return 'easy';
  if (d === 'hard') return 'hard';
  if (d === 'medium') return 'medium';
  // Codeforces sends a numeric rating rather than a word — bucket it.
  const rating = Number(diff);
  if (!Number.isNaN(rating) && rating > 0) {
    if (rating < 1400) return 'easy';
    if (rating < 2000) return 'medium';
    return 'hard';
  }
  return 'medium';
};

const DailyChallenge = ({ onUseAsContext }) => {
  const [activePlatform, setActivePlatform] = useState('leetcode');
  const [loading, setLoading] = useState(true);
  const [problems, setProblems] = useState({ leetcode: null, codeforces: null });
  const [errors, setErrors] = useState({ leetcode: null, codeforces: null });
  const [fillProgress, setFillProgress] = useState({ leetcode: 0, codeforces: 0 });

  const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();

  useEffect(() => {
    const fetchDailyProblems = async () => {
      setLoading(true);
      try {
        const [lcRes, cfRes] = await Promise.allSettled([
          axios.get(`${serverUrl}/api/daily/leetcode`),
          axios.get(`${serverUrl}/api/daily/codeforces`)
        ]);

        const newProblems = { ...problems };
        const newErrors = { ...errors };

        if (lcRes.status === 'fulfilled') {
          newProblems.leetcode = lcRes.value.data.problem;
        } else {
          newErrors.leetcode = 'LeetCode POTD unavailable.';
        }

        if (cfRes.status === 'fulfilled') {
          newProblems.codeforces = cfRes.value.data.problem;
        } else {
          newErrors.codeforces = 'Codeforces Daily unavailable.';
        }

        setProblems(newProblems);
        setErrors(newErrors);
      } catch (err) {
        console.error('Error fetching daily problems:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyProblems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate the progress ring/bar fill in on data arrival (respects reduced motion via CSS).
  useEffect(() => {
    ['leetcode', 'codeforces'].forEach((platform) => {
      const p = problems[platform];
      if (!p) return;
      const meta = DIFFICULTY_META[getDifficultyKey(p.difficulty || p.rating)];
      const target = p.completed ? 100 : meta.pct;
      const raf = requestAnimationFrame(() => {
        setFillProgress((prev) => ({ ...prev, [platform]: target }));
      });
      return () => cancelAnimationFrame(raf);
    });
  }, [problems]);

  const currentProblem = problems[activePlatform];
  const currentError = errors[activePlatform];
  const currentDiffKey = currentProblem
    ? getDifficultyKey(currentProblem.difficulty || currentProblem.rating)
    : 'medium';
  const currentMeta = DIFFICULTY_META[currentDiffKey];
  const isCompleted = Boolean(currentProblem?.completed);

  const diffDotClass = {
    easy: 'mc-dot mc-dot-easy',
    medium: 'mc-dot mc-dot-medium',
    hard: 'mc-dot mc-dot-hard',
  }[currentDiffKey];

  return (
    <section
      aria-label="Daily challenge mission control"
      className="mc-panel relative mb-8 overflow-hidden rounded-3xl p-6 sm:p-7"
    >
      <style>{`
        .mc-panel {
          background:
            radial-gradient(120% 140% at 15% -10%, rgba(0,212,255,0.10), transparent 55%),
            radial-gradient(90% 120% at 100% 110%, rgba(124,92,255,0.08), transparent 50%),
            linear-gradient(180deg, rgba(21,37,68,0.85) 0%, rgba(16,28,52,0.92) 100%);
          border: 1px solid rgba(0,212,255,0.18);
          box-shadow:
            0 0 0 1px rgba(0,212,255,0.04) inset,
            0 20px 60px -30px rgba(0,212,255,0.25),
            0 1px 0 rgba(255,255,255,0.03) inset;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .mc-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(115deg, transparent 40%, rgba(0,212,255,0.05) 50%, transparent 60%);
          background-size: 220% 220%;
          animation: mc-sheen 9s ease-in-out infinite;
        }
        @keyframes mc-sheen {
          0% { background-position: 120% 0%; }
          50% { background-position: -20% 0%; }
          100% { background-position: 120% 0%; }
        }
        .mc-eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #00D4FF;
          text-shadow: 0 0 12px rgba(0,212,255,0.5);
        }
        .mc-toggle {
          background: rgba(9,14,26,0.7);
          border: 1px solid rgba(0,212,255,0.16);
        }
        .mc-toggle-thumb {
          background: linear-gradient(135deg, #1E90FF, #00D4FF);
          box-shadow: 0 0 18px rgba(0,212,255,0.55), 0 0 0 1px rgba(0,212,255,0.35) inset;
        }
        .mc-tab {
          color: #91A8C3;
          transition: color 200ms ease;
        }
        .mc-tab[data-active="true"] {
          color: #EAF6FF;
          text-shadow: 0 0 10px rgba(0,212,255,0.4);
        }
        .mc-tab:focus-visible {
          outline: 2px solid #00F5FF;
          outline-offset: 3px;
          border-radius: 8px;
        }
        .mc-card {
          background: rgba(18,34,66,0.65);
          border: 1px solid rgba(0,212,255,0.14);
          box-shadow: 0 12px 40px -22px rgba(0,0,0,0.6);
          transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
        }
        .mc-card:hover, .mc-card:focus-within {
          transform: translateY(-3px) scale(1.005);
          border-color: rgba(0,212,255,0.4);
          box-shadow: 0 18px 50px -20px rgba(0,212,255,0.35), 0 0 0 1px rgba(0,212,255,0.15) inset;
        }
        .mc-card[data-recommended="true"] {
          border-color: rgba(0,245,255,0.55);
          box-shadow: 0 0 0 1px rgba(0,245,255,0.25) inset, 0 0 40px -8px rgba(0,245,255,0.35);
        }
        .mc-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #00F5FF;
          box-shadow: 0 0 10px #00F5FF, 0 0 20px rgba(0,245,255,0.6);
          animation: mc-pulse 1.8s ease-in-out infinite;
        }
        @keyframes mc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.4); }
        }
        .mc-capsule {
          border: 1px solid rgba(0,212,255,0.25);
          background: rgba(0,212,255,0.08);
          color: #9fe8ff;
          box-shadow: 0 0 12px rgba(0,212,255,0.12) inset;
        }
        .mc-dot { width: 7px; height: 7px; border-radius: 999px; }
        .mc-dot-easy { background: #34d399; box-shadow: 0 0 8px #34d399; }
        .mc-dot-medium { background: #00D4FF; box-shadow: 0 0 8px #00D4FF; }
        .mc-dot-hard { background: #ff5c8a; box-shadow: 0 0 8px #ff5c8a; }
        .mc-track {
          background: rgba(9,14,26,0.85);
          border: 1px solid rgba(0,212,255,0.12);
        }
        .mc-fill {
          background: linear-gradient(90deg, #1E90FF, #00D4FF 60%, #00F5FF);
          box-shadow: 0 0 12px rgba(0,212,255,0.65);
          transition: width 900ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mc-cta {
          background: linear-gradient(135deg, #1E90FF, #00B8E6);
          box-shadow: 0 0 0 1px rgba(0,212,255,0.4) inset, 0 8px 24px -8px rgba(0,212,255,0.6);
          transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
        }
        .mc-cta:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .mc-cta:active { transform: translateY(0); }
        .mc-cta:focus-visible {
          outline: 2px solid #00F5FF;
          outline-offset: 3px;
        }
        .mc-skeleton {
          background: linear-gradient(90deg, rgba(0,212,255,0.06), rgba(0,212,255,0.14), rgba(0,212,255,0.06));
          background-size: 200% 100%;
          animation: mc-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes mc-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mc-panel::before, .mc-pulse-dot, .mc-skeleton, .mc-fill { animation: none !important; }
          .mc-card:hover, .mc-card:focus-within { transform: none; }
          .mc-fill { transition: none; }
        }
      `}</style>

      {/* Header row */}
      <div className="relative z-10 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Select platform"
          className="mc-toggle relative flex w-full rounded-2xl p-1 sm:w-auto"
        >
          <div
            aria-hidden="true"
            className="mc-toggle-thumb absolute top-1 bottom-1 rounded-xl transition-all duration-300"
            style={{
              width: 'calc(50% - 8px)',
              left: activePlatform === 'leetcode' ? '4px' : 'calc(50%)',
            }}
          />
          <button
            role="tab"
            aria-selected={activePlatform === 'leetcode'}
            data-active={activePlatform === 'leetcode'}
            onClick={() => setActivePlatform('leetcode')}
            className="mc-tab relative z-10 w-1/2 rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest"
          >
            LeetCode
          </button>
          <button
            role="tab"
            aria-selected={activePlatform === 'codeforces'}
            data-active={activePlatform === 'codeforces'}
            onClick={() => setActivePlatform('codeforces')}
            className="mc-tab relative z-10 w-1/2 rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest"
          >
            Codeforces
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="mc-pulse-dot" aria-hidden="true" />
          <span className="mc-eyebrow">Daily Mission</span>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="relative z-10 space-y-4" aria-busy="true" aria-live="polite">
          <div className="mc-skeleton h-7 w-2/3 rounded-lg sm:w-1/3" />
          <div className="flex gap-2">
            <div className="mc-skeleton h-6 w-16 rounded-lg" />
            <div className="mc-skeleton h-6 w-24 rounded-lg" />
          </div>
          <div className="mc-skeleton h-2 w-full rounded-full" />
        </div>
      ) : currentError ? (
        <div
          role="status"
          className="relative z-10 rounded-2xl border border-[rgba(0,212,255,0.12)] bg-[rgba(9,14,26,0.5)] py-6 text-center text-sm font-medium text-[#91A8C3]"
        >
          {currentError}
        </div>
      ) : currentProblem ? (
        <div
          className="mc-card relative z-10 flex flex-col gap-5 rounded-2xl p-5 sm:p-6"
          data-recommended={!isCompleted}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={currentProblem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xl font-black text-[#EAF6FF] transition-colors hover:text-[#00D4FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F5FF] rounded-sm"
                >
                  {currentProblem.title}
                </a>
                <span className="mc-capsule inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest">
                  <span className={diffDotClass} aria-hidden="true" />
                  {currentProblem.difficulty || currentProblem.rating}
                </span>
                <span
                  className="mc-capsule inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest"
                  style={
                    isCompleted
                      ? { borderColor: 'rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.08)', color: '#6ee7b7' }
                      : undefined
                  }
                >
                  {isCompleted ? 'Completed' : 'Pending'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {currentProblem.tags?.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg border border-[rgba(0,212,255,0.14)] bg-[rgba(9,14,26,0.6)] px-2.5 py-1 text-[10px] font-bold text-[#91A8C3]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                onUseAsContext(currentProblem);
                toast.success('Context loaded: ' + currentProblem.title, { icon: '🚀' });
              }}
              className="mc-cta shrink-0 rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
            >
              Use as Context
            </button>
          </div>

          {/* Progress + stats strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-center">
            <div className="sm:col-span-2">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#91A8C3]">
                <span>Estimated readiness</span>
                <span className="text-[#00D4FF]">{fillProgress[activePlatform]}%</span>
              </div>
              <div
                className="mc-track h-2 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-valuenow={fillProgress[activePlatform]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Challenge readiness progress"
              >
                <div
                  className="mc-fill h-full rounded-full"
                  style={{ width: `${fillProgress[activePlatform]}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#91A8C3]">Est. time</p>
                <p className="text-xs font-black text-[#EAF6FF]">{currentMeta.minutes}</p>
              </div>
              <div className="h-8 w-px bg-[rgba(0,212,255,0.15)]" aria-hidden="true" />
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#91A8C3]">Reward</p>
                <p className="text-xs font-black text-[#00F5FF]">+{currentMeta.xp} XP</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default DailyChallenge;