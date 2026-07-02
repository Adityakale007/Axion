import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const DailyChallenge = ({ onUseAsContext }) => {
  const [activePlatform, setActivePlatform] = useState('leetcode');
  const [loading, setLoading] = useState(true);
  const [problems, setProblems] = useState({ leetcode: null, codeforces: null });
  const [errors, setErrors] = useState({ leetcode: null, codeforces: null });

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
          newErrors.leetcode = 'LC POTD temporarily unavailable — try the CF Daily instead';
        }

        if (cfRes.status === 'fulfilled') {
          newProblems.codeforces = cfRes.value.data.problem;
        } else {
          newErrors.codeforces = 'CF Daily temporarily unavailable — try the LC POTD instead';
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
  }, []);

  const currentProblem = problems[activePlatform];
  const currentError = errors[activePlatform];

  const getDifficultyColor = (diff) => {
    if (!diff) return 'bg-gray-500';
    const d = String(diff).toLowerCase();
    if (d === 'easy') return 'bg-emerald-500';
    if (d === 'medium') return 'bg-amber-500';
    if (d === 'hard') return 'bg-rose-500';
    return 'bg-blue-500'; // for CF ratings
  };

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="relative flex w-64 rounded-xl bg-black/20 p-1">
          <div
            className="absolute h-8 w-[calc(50%-4px)] rounded-lg bg-amber-500 transition-all duration-300"
            style={{ left: activePlatform === 'leetcode' ? '4px' : 'calc(50%)' }}
          />
          <button
            onClick={() => setActivePlatform('leetcode')}
            className={`relative z-10 w-1/2 py-1.5 text-xs font-semibold transition-colors ${activePlatform === 'leetcode' ? 'text-black' : 'text-gray-400'}`}
          >
            LeetCode POTD
          </button>
          <button
            onClick={() => setActivePlatform('codeforces')}
            className={`relative z-10 w-1/2 py-1.5 text-xs font-semibold transition-colors ${activePlatform === 'codeforces' ? 'text-black' : 'text-gray-400'}`}
          >
            CF Daily
          </button>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">Daily Challenge</span>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 w-3/4 rounded bg-white/10" />
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-white/10" />
            <div className="h-6 w-24 rounded-full bg-white/10" />
          </div>
        </div>
      ) : currentError ? (
        <div className="py-2 text-sm text-gray-400">{currentError}</div>
      ) : currentProblem ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ${activePlatform === 'leetcode' ? 'bg-[#ffa116]' : 'bg-[#3182ce]'}`}>
                {activePlatform === 'leetcode' ? 'LC' : 'CF'}
              </span>
              <a
                href={currentProblem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-lg font-semibold text-white hover:text-amber-400"
              >
                {currentProblem.title}
              </a>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${getDifficultyColor(currentProblem.difficulty || currentProblem.rating)}`}>
                {currentProblem.difficulty || currentProblem.rating}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {currentProblem.tags?.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">
                  {tag}
                </span>
              ))}
              <span className="ml-1 text-[11px] font-medium text-amber-500/80">Solve this problem and analyse below ↓</span>
            </div>
          </div>
          <button
            onClick={() => {
              onUseAsContext(currentProblem);
              toast.success('Problem context loaded — paste your solution below');
            }}
            className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400"
          >
            Use as context
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default DailyChallenge;
