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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1117] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Trophy size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Today's Leaderboard</h3>
            <p className="text-sm text-gray-400">{problemTitle || 'Daily Challenge'}</p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 p-3">
          <Users size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-400">
            {data.totalCount} {data.totalCount === 1 ? 'person' : 'people'} analysed this problem today
          </span>
        </div>

        {loading ? (
          <div className="space-y-4 py-8 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-[0.15em] text-gray-500">
                  <th className="pb-4 pl-2">Rank</th>
                  <th className="pb-4">Name</th>
                  <th className="pb-4 text-center">Score</th>
                  <th className="pb-4">Language</th>
                  <th className="pb-4">Time Complexity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.entries.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-500">No entries yet today. Be the first!</td>
                  </tr>
                ) : (
                  data.entries.map((entry, idx) => (
                    <tr key={idx} className="group transition-colors hover:bg-white/[0.02]">
                      <td className="py-4 pl-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold ${
                          idx === 0 ? 'bg-amber-500 text-black' : 
                          idx === 1 ? 'bg-gray-400 text-black' : 
                          idx === 2 ? 'bg-[#cd7f32] text-black' : 'text-gray-400'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="font-semibold text-white">{entry.displayName}</span>
                        <p className="text-[10px] text-gray-500">{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-lg font-bold text-amber-500">{entry.score}</span>
                      </td>
                      <td className="py-4">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">{entry.language}</span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm font-medium text-gray-400">{entry.timeComplexity || 'O(?)'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!localStorage.getItem('forkspace-token') && (
          <p className="mt-6 text-center text-xs text-gray-500">
            Sign in to appear on the leaderboard and save your history.
          </p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
