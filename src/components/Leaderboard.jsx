import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Trophy, Users } from 'lucide-react';

const Leaderboard = ({ isOpen, onClose, platform, problemTitle }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ entries: [], totalCount: 0 });
  const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();

  useEffect(() => {
    if (!isOpen || !platform) return;
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${serverUrl}/api/daily/${platform}/leaderboard`);
        setData(response.data);
      } catch (err) {
        console.error('Leaderboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [isOpen, platform]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_80px_-15px_rgba(79,70,229,0.15)] sm:p-8">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
        >
          <X size={18} />
        </button>

        {/* Header Section */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 shadow-sm shadow-indigo-500/10">
            <Trophy size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">Today's Leaderboard</h3>
            <p className="mt-1 text-sm font-medium text-zinc-400">{problemTitle || 'Daily Challenge'}</p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
          <Users size={16} className="text-indigo-400" />
          <span className="text-sm font-medium text-zinc-300">
            <strong className="text-white">{data.totalCount}</strong> {data.totalCount === 1 ? 'developer has' : 'developers have'} analyzed this problem today
          </span>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="space-y-3 py-6 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 w-full rounded-xl bg-zinc-900/80" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800/60 bg-zinc-950">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-zinc-900/40">
                <tr className="border-b border-zinc-800/80 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <th className="py-4 pl-6 pr-4">Rank</th>
                  <th className="py-4 px-4">Developer</th>
                  <th className="py-4 px-4 text-center">Score</th>
                  <th className="py-4 px-4">Language</th>
                  <th className="py-4 pr-6 pl-4 text-right">Complexity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {data.entries.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center">
                      <p className="text-sm font-medium text-zinc-500">No entries yet today. Be the first to solve it!</p>
                    </td>
                  </tr>
                ) : (
                  data.entries.map((entry, idx) => (
                    <tr key={idx} className="group transition-colors hover:bg-zinc-900/50">
                      <td className="py-3 pl-6 pr-4">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                          idx === 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 
                          idx === 1 ? 'bg-zinc-300/10 text-zinc-300 border border-zinc-300/20' : 
                          idx === 2 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
                          'text-zinc-500'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors">{entry.displayName}</span>
                        <p className="mt-0.5 text-[10px] font-medium text-zinc-500">{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block text-lg font-black text-indigo-400">{entry.score}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-300">
                          {entry.language}
                        </span>
                      </td>
                      <td className="py-3 pr-6 pl-4 text-right">
                        <span className="font-mono text-xs font-medium text-indigo-300">{entry.timeComplexity || 'O(?)'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Prompt */}
        {!localStorage.getItem('Axion-token') && (
          <div className="mt-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-4 text-center">
            <p className="text-xs font-medium text-zinc-400">
              Sign in to appear on the leaderboard and track your daily performance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;