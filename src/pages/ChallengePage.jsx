import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Sword, Trophy, Users, Zap, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import SolutionAnalyzer from './SolutionAnalyzer';
import confetti from 'canvas-confetti';

const ChallengePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState(null);
  const [attemptResult, setAttemptResult] = useState(null);

  const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const response = await axios.get(`${serverUrl}/api/challenge/${id}`);
        setChallenge(response.data.challenge);
      } catch (err) {
        setError(err.response?.data?.error || 'Challenge not found or expired');
      } finally {
        setLoading(false);
      }
    };
    fetchChallenge();
  }, [id, serverUrl]);

  const handleAttemptSubmit = async (score) => {
    try {
      const name = localStorage.getItem('forkspace-username') || 'Anonymous';
      const response = await axios.post(`${serverUrl}/api/challenge/${id}/attempt`, {
        name,
        score
      });
      setAttemptResult(response.data);

      if (response.data.won) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#3b82f6']
        });
      }
    } catch (err) {
      toast.error('Failed to record challenge attempt');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="mt-4 text-gray-400">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#020617] text-white">
        <Navbar />
        <div className="mx-auto max-w-lg px-4 pt-32 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-bold">Challenge Not Found</h1>
          <p className="mt-2 text-gray-400">{error}</p>
          <button
            onClick={() => navigate('/analyse')}
            className="mt-8 rounded-xl bg-amber-500 px-6 py-3 font-bold text-black transition hover:bg-amber-400"
          >
            Create Your Own Challenge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />
      
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        {/* Challenger Card */}
        <div className="mb-12 overflow-hidden rounded-[2.5rem] border border-amber-500/30 bg-amber-500/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-amber-500 text-black shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              <Trophy size={40} />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  {challenge.challengerName} scored <span className="text-amber-500">{challenge.challengerScore}/100</span>
                </h1>
                <span className="rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-500 ring-1 ring-amber-500/30">
                  Challenge
                </span>
              </div>
              <p className="mt-3 text-xl font-medium text-amber-500/90 italic">
                "{challenge.challengerVerdict}"
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 border border-white/10">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Language</span>
                  <span className="font-bold text-white">{challenge.language}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 border border-white/10">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Context</span>
                  <span className="font-bold text-white">{challenge.problemContext}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 border border-white/10">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Complexity</span>
                  <span className="font-bold text-white">{challenge.challengerTimeComplexity}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/5 px-6 py-4 border border-white/5">
            <Sparkles size={18} className="text-amber-500" />
            <p className="text-lg font-bold text-gray-300">
              Can you beat this score with a better solution?
            </p>
          </div>
        </div>

        {/* Result Overlay if attempted */}
        {attemptResult && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
            <div className={`w-full max-w-lg overflow-hidden rounded-[2.5rem] border p-8 text-center shadow-2xl ${attemptResult.won ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
              <div className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl ${attemptResult.won ? 'bg-emerald-500 text-black shadow-[0_0_40px_rgba(16,185,129,0.3)]' : 'bg-rose-500 text-white shadow-[0_0_40px_rgba(244,63,94,0.3)]'}`}>
                {attemptResult.won ? <Trophy size={48} /> : <Sword size={48} />}
              </div>
              
              <h2 className="text-4xl font-black tracking-tight text-white">
                {attemptResult.won ? 'VICTORY!' : 'DEFEAT'}
              </h2>
              
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Your Score</p>
                  <p className={`mt-2 text-3xl font-black ${attemptResult.won ? 'text-emerald-500' : 'text-rose-500'}`}>{attemptResult.yourScore}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Challenger</p>
                  <p className="mt-2 text-3xl font-black text-gray-400">{attemptResult.challengerScore}</p>
                </div>
              </div>

              <p className="mt-8 text-xl font-bold text-white">
                {attemptResult.message}
              </p>

              <div className="mt-10 flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-black text-black transition hover:bg-gray-200"
                >
                  {attemptResult.won ? 'Share Your Victory' : 'Try Again'}
                </button>
                <button
                  onClick={() => navigate('/analyse')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-black text-white transition hover:bg-white/10"
                >
                  Create New Challenge
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analyser UI */}
        <div className="relative">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-6 py-2 text-xs font-black uppercase tracking-widest text-black shadow-lg">
            Analyse below to beat the score
          </div>
          <SolutionAnalyzer 
            initialContext={challenge.problemContext} 
            initialLanguage={challenge.language}
            onAnalysisComplete={handleAttemptSubmit}
            isChallengeAttempt={true}
            challengerScore={challenge.challengerScore}
          />
        </div>
      </main>
    </div>
  );
};

export default ChallengePage;
