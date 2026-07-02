/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import axios from 'axios';
import { BrainCircuit, FlaskConical, GraduationCap, Radar, ShieldCheck, Sparkles, Sword, Users2, Workflow, X, Zap } from 'lucide-react';
import FormComp from '../components/forms/FormComp';
import Navbar from '../components/common/Navbar';
import AvatarGlyph from '../components/common/AvatarGlyph';
import { getAuthHeaders, getAuthToken } from '../lib/auth';
import { getAvatarById, getRandomAvatar } from '../lib/avatars';
import { toast } from 'react-hot-toast';
import useCursorGlow from '../hooks/useCursorGlow';
import useScrollReveal from '../hooks/useScrollReveal';
import useCardTilt from '../hooks/useCardTilt';

const useCases = [
    {
        icon: Sword,
        title: 'Mock Interview',
        description: 'Candidate and interviewer stay in one room with a shared editor, shared runs, and clear Driver/Navigator structure.',
    },
    {
        icon: GraduationCap,
        title: 'DSA Mentoring',
        description: 'Bring in a Codeforces-style problem, talk through the approach, and debug together without handing the screen back and forth.',
    },
    {
        icon: Zap,
        title: 'Peer Practice',
        description: 'Pick one problem, build one solution together, then pressure-test it with samples, hidden tests, and fast shared feedback.',
    },
];

const quickStartSteps = [
    'Create a room or paste a Room ID. Jump in as guest — no account needed to start.',
    'Pick a session mode: Mock Interview, DSA Mentoring, or Peer Practice. Assign Driver and Navigator roles so both sides know the structure.',
    'Write code together, run it, compare output against sample cases. Use Analyze for complexity and bug review, Report for a session summary — when you actually need it.',
];

quickStartSteps.length = 0;
quickStartSteps.push(
    'Create a room or paste a Room ID. Start as a guest if you just want to get moving.',
    'Choose the session mode, load the problem, and assign Driver or Navigator roles only if that structure helps the session.',
    'Code together, run samples, generate hidden tests, then open Analyze or Report when you want a sharper post-run review.',
);

const featureHighlights = [
    {
        icon: Workflow,
        title: 'One Shared Workspace',
        description: 'The brief, editor, participants, and runs stay together so the session feels like one workflow instead of several tabs.',
    },
    {
        icon: Radar,
        title: 'Problem Setup That Stays Honest',
        description: 'Browse Codeforces, import what helps, and keep the editable brief in your control instead of locking the room to scraped text.',
    },
    {
        icon: FlaskConical,
        title: 'Hidden Tests That Help',
        description: 'Generate verified and stress-style cases, see pass/fail/timeouts clearly, and bring useful failures back into sample tests.',
    },
    {
        icon: BrainCircuit,
        title: 'Analysis With Follow-Through',
        description: 'Use the solution analyser for code review, then capture a report that summarizes strengths, gaps, pace, and next-step practice.',
    },
    {
        icon: Users2,
        title: 'Structured Session Modes',
        description: 'Peer Practice, Mock Interview, and Mentoring give the room the right shape without forcing a heavyweight setup flow.',
    },
    {
        icon: ShieldCheck,
        title: 'Guest-First, Account-Optional',
        description: 'Start fast without signup, then keep rooms, reports, and history only when you actually want persistence.',
    },
];

function createRoomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function AnimatedHeadline({ text }) {
    const [visible, setVisible] = useState(false);
    const words = text.split(' ');

    useEffect(() => {
        if (prefersReducedMotion()) {
            setVisible(true);
            return undefined;
        }
        const timer = window.setTimeout(() => setVisible(true), 20);
        return () => window.clearTimeout(timer);
    }, []);

    return (
        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
            {words.map((word, index) => (
                <span
                    key={`${word}-${index}`}
                    className={`word-reveal ${visible ? 'visible' : ''}`}
                    style={visible && !prefersReducedMotion() ? { animationDelay: `${index * 80}ms` } : undefined}
                >
                    {word}
                </span>
            ))}
        </h1>
    );
}

function UseCaseCard({ item }) {
    const tiltRef = useCardTilt(4);

    return (
        <article
            ref={tiltRef}
            data-cursor="card"
            className="reveal-item rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
            <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <item.icon size={18} strokeWidth={2} />
            </div>
            <h3 className="text-xl font-semibold">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{item.description}</p>
        </article>
    );
}

function StepCard({ step, index, isRight }) {
    const tiltRef = useCardTilt(4);

    return (
        <div
            className={`reveal-item relative flex items-start gap-4 md:gap-6 ${isRight ? 'md:flex-row-reverse' : ''}`}
            data-cursor="card"
        >
            <div className="relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 font-semibold text-amber-700 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                {index + 1}
            </div>
            <div className="absolute left-6 top-6 hidden h-px w-8 bg-amber-300/60 dark:bg-amber-500/40 md:block md:w-10" />
            <div
                className={`absolute top-6 hidden h-8 w-8 border-t border-amber-300/60 dark:border-amber-500/40 md:block ${
                    isRight
                        ? 'left-[calc(50%+2.5rem)] rounded-tr-full border-r'
                        : 'left-[calc(50%-2rem)] rounded-tl-full border-l'
                }`}
            />
            <div
                ref={tiltRef}
                className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 md:max-w-[42%]"
                style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
            >
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">
                    Step {index + 1}
                </p>
                <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{step}</p>
            </div>
        </div>
    );
}

function Login() {
    const navigate = useNavigate();
    const quickRoomRef = useRef(null);
    const authEntryRef = useRef(null);
    const heroRef = useRef(null);
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const [currentUser, setCurrentUser] = useState(null);
    const [quickRoomId, setQuickRoomId] = useState('');
    const [showAuthPanel, setShowAuthPanel] = useState(false);
    const [heroBadgeVisible, setHeroBadgeVisible] = useState(false);
    const [heroCtasVisible, setHeroCtasVisible] = useState(false);
    const [dailyStats, setDailyStats] = useState(null);
    const wordCount = 'One shared room for serious DSA practice, mock interviews, and mentoring.'.split(' ').length;

    useEffect(() => {
        const fetchDailyStats = async () => {
            try {
                const response = await axios.get(`${serverUrl}/api/daily/leetcode/leaderboard`);
                if (response.data && response.data.totalCount > 0) {
                    const entries = response.data.entries || [];
                    const avgScore = entries.length > 0 
                        ? Math.round(entries.reduce((acc, curr) => acc + curr.score, 0) / entries.length) 
                        : 0;
                    const topScore = entries.length > 0 ? entries[0].score : 0;
                    setDailyStats({
                        totalCount: response.data.totalCount,
                        avgScore,
                        topScore
                    });
                }
            } catch (err) {
                // silent fail
            }
        };
        fetchDailyStats();
    }, [serverUrl]);
    const reduceMotion = prefersReducedMotion();
    const howItWorksRef = useScrollReveal();
    const useCasesRef = useScrollReveal();

    useCursorGlow(heroRef);

    useEffect(() => {
        const loadCurrentUser = async () => {
            if (!getAuthToken()) {
                setCurrentUser(null);
                return;
            }

            try {
                const response = await axios.get(`${serverUrl}/api/auth/me`, {
                    headers: getAuthHeaders(),
                });
                setCurrentUser(response.data.user);
            } catch {
                setCurrentUser(null);
            }
        };

        loadCurrentUser();
    }, [serverUrl]);

    useEffect(() => {
        if (reduceMotion) {
            setHeroBadgeVisible(true);
            setHeroCtasVisible(true);
            return undefined;
        }

        const badgeTimer = window.setTimeout(() => setHeroBadgeVisible(true), 200);
        const ctaTimer = window.setTimeout(() => setHeroCtasVisible(true), wordCount * 80 + 200);
        return () => {
            window.clearTimeout(badgeTimer);
            window.clearTimeout(ctaTimer);
        };
    }, [reduceMotion, wordCount]);

    const handleGenerateRoomId = () => {
        setQuickRoomId(createRoomId());
    };

    const handleQuickJoin = (event) => {
        event.preventDefault();
        const resolvedRoomId = quickRoomId.trim() || createRoomId();
        const randomAvatar = getRandomAvatar();
        const resolvedAvatarId = currentUser?.avatarId || randomAvatar.id;

        if (!currentUser) {
            toast(
                <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/15">
                        <AvatarGlyph avatar={getAvatarById(randomAvatar.id)} className="h-3.5 w-3.5" />
                    </span>
                    {`You're ${randomAvatar.name} this session`}
                </span>,
                {
                duration: 3500,
                position: 'bottom-center',
                style: {
                    background: '#111827',
                    color: '#f59e0b',
                    borderRadius: '10px',
                },
            });
        }

        navigate(`/editor/${resolvedRoomId}`, {
            state: {
                username: currentUser?.name || 'Guest',
                avatarId: resolvedAvatarId,
                role: 'Peer',
                sessionMode: 'peer_practice',
            },
        });
    };

    const focusQuickEntry = () => {
        quickRoomRef.current?.focus();
    };

    const handleOnSignInClick = () => {
        setShowAuthPanel(true);
        window.setTimeout(() => {
            authEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 30);
    };

    return (
        <div className="min-h-screen bg-stone-50 text-slate-900 dark:bg-slate-950 dark:text-white">
            <Navbar onSignInClick={handleOnSignInClick} />

            <main>
                <section
                    ref={heroRef}
                    className="relative overflow-hidden border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_28%),radial-gradient(circle_at_78%_18%,_rgba(148,163,184,0.1),_transparent_18%),linear-gradient(180deg,#fff8ef_0%,#f8fafc_48%,#f8fafc_100%)] px-4 pb-20 pt-20 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_24%),radial-gradient(circle_at_78%_18%,_rgba(148,163,184,0.08),_transparent_18%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)] sm:px-6 lg:px-8"
                >
                    {!reduceMotion ? (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: 'radial-gradient(600px circle at var(--glow-x) var(--glow-y), rgba(245,158,11,0.04), transparent 80%)',
                            }}
                        />
                    ) : null}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-full ambient-blob"
                        style={{
                            width: 400,
                            height: 400,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
                            top: '20%',
                            left: '10%',
                            filter: 'blur(60px)',
                            animation: 'floatBlob1 25s ease-in-out infinite',
                        }}
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-full ambient-blob"
                        style={{
                            width: 300,
                            height: 300,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)',
                            top: '60%',
                            right: '15%',
                            filter: 'blur(80px)',
                            animation: 'floatBlob2 35s ease-in-out infinite',
                        }}
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-full ambient-blob"
                        style={{
                            width: 200,
                            height: 200,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)',
                            top: '40%',
                            right: '30%',
                            filter: 'blur(40px)',
                            animation: 'floatBlob3 20s ease-in-out infinite alternate',
                        }}
                    />
                    <div className="pointer-events-none absolute -left-20 top-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/10" />
                    <div className="pointer-events-none absolute -right-20 top-12 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />
                    <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
                        <div
                            data-cursor="card"
                            className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-white/80 px-4 py-1.5 text-sm text-amber-900 shadow-sm backdrop-blur dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                            style={{
                                opacity: heroBadgeVisible ? 1 : 0,
                                transform: heroBadgeVisible ? 'translateY(0)' : 'translateY(8px)',
                                transition: reduceMotion ? 'none' : 'opacity 400ms ease 200ms, transform 400ms ease 200ms',
                            }}
                        >
                            <Sparkles size={14} />
                            Realtime collaborative workspace for serious DSA practice
                        </div>

                        <div className="mt-8 space-y-5">
                            <AnimatedHeadline text="One shared room for serious DSA practice, mock interviews, and mentoring." />
                            <p className="mx-auto max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                ForkSpace keeps the problem brief, shared editor, sample runs, hidden tests, solution analysis, and session reporting in one focused workflow.
                            </p>
                        </div>

                        <div
                            className="mt-8 flex flex-col gap-3 sm:flex-row"
                            style={{
                                opacity: heroCtasVisible ? 1 : 0,
                                transform: heroCtasVisible ? 'translateY(0)' : 'translateY(10px)',
                                transition: reduceMotion ? 'none' : `opacity 400ms ease ${wordCount * 80 + 200}ms, transform 400ms ease ${wordCount * 80 + 200}ms`,
                            }}
                        >
                            <button
                                type="button"
                                onClick={focusQuickEntry}
                                data-cursor="button"
                                className="inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                                Open a Room
                            </button>
                            <Link
                                to="/analyse"
                                data-cursor="button"
                                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                            >
                                Open Solution Analyser
                            </Link>
                            <Link
                                to="/daily-challenge"
                                data-cursor="button"
                                className="inline-flex items-center justify-center rounded-md border border-amber-500 px-5 py-2.5 text-sm text-amber-400 transition hover:bg-amber-500/10"
                            >
                                Daily Challenge
                            </Link>
                        </div>

                        {dailyStats && (
                            <div className="mt-4 flex items-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-500/80">
                                <span>{dailyStats.totalCount} Solutions today</span>
                                <span>Avg {dailyStats.avgScore} pts</span>
                                <span>Top {dailyStats.topScore} pts</span>
                            </div>
                        )}

                        <form
                            id="join-session"
                            onSubmit={handleQuickJoin}
                            data-cursor="card"
                            className="mt-8 flex w-full max-w-2xl flex-col gap-3 rounded-[1.75rem] border border-stone-200 bg-white/85 p-4 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/75 sm:flex-row sm:items-center"
                        >
                            <input
                                ref={quickRoomRef}
                                type="text"
                                value={quickRoomId}
                                onChange={(event) => setQuickRoomId(event.target.value.toUpperCase())}
                                placeholder="Paste a room ID or generate one"
                                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleGenerateRoomId}
                                    data-cursor="button"
                                    className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                >
                                    Generate
                                </button>
                                <button
                                    type="submit"
                                    data-cursor="button"
                                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:flex-none"
                                >
                                    Enter
                                </button>
                            </div>
                        </form>

                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            {currentUser ? `Jump in as ${currentUser.name}.` : 'No signup needed. Sign in only if you want saved rooms, reports, and history.'}
                        </p>
                        <div className="mt-6 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
                            <div data-cursor="card" className="rounded-2xl border border-stone-200 bg-white/75 px-4 py-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/55">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Shared Room</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Live editor sync, presence, room roles, and one source of truth for the whole session.</p>
                            </div>
                            <div data-cursor="card" className="rounded-2xl border border-stone-200 bg-white/75 px-4 py-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/55">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Runs + Hidden Tests</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Run samples, submit the parsed suite, then generate deeper tests when the obvious cases are no longer enough.</p>
                            </div>
                            <div data-cursor="card" className="rounded-2xl border border-stone-200 bg-white/75 px-4 py-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/55">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Review + Report</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Inspect code quality, complexity, and edge-case coverage, then keep a shareable report when it is worth saving.</p>
                            </div>
                        </div>

                        {!currentUser && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAuthPanel((prev) => {
                                        const next = !prev;
                                        if (next) {
                                            window.setTimeout(() => {
                                                authEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }, 30);
                                        }
                                        return next;
                                    });
                                }}
                                data-cursor="button"
                                className="mt-5 inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:bg-stone-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                                {showAuthPanel ? 'Close account access' : 'Sign in to save progress'}
                            </button>
                        )}
                    </div>
                </section>

                {(!currentUser && showAuthPanel) && (
                    <section ref={authEntryRef} id="auth-entry" className="scroll-mt-24 border-b border-stone-200 bg-white px-4 py-10 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-6xl space-y-5">
                            <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4">
                                <div className="space-y-2 text-left">
                                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Account Access</p>
                                    <h2 className="text-2xl font-bold tracking-tight">Sign in only when you want saved rooms, reports, and history.</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAuthPanel(false)}
                                    data-cursor="button"
                                    className="rounded-xl border border-stone-200 bg-white p-2 text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                                    aria-label="Close sign-in panel"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex justify-center">
                                <FormComp />
                            </div>
                        </div>
                    </section>
                )}

                <section id="features" className="scroll-mt-24 border-b border-stone-200 bg-white px-4 py-14 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-3xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Core Features</p>
                            <h2 className="text-3xl font-bold tracking-tight">Built for real interview-style problem solving.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                The goal is not to be a full IDE. The goal is to make one shared DSA session feel clear, fast, and reviewable from start to finish.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {featureHighlights.map((feature) => (
                                <article
                                    key={feature.title}
                                    data-cursor="card"
                                    className="group rounded-3xl border border-stone-200 bg-stone-50/75 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-amber-300/60 hover:shadow-[0_16px_42px_-24px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-amber-500/40"
                                >
                                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 transition group-hover:scale-105 dark:bg-amber-500/10 dark:text-amber-300">
                                        <feature.icon size={18} strokeWidth={2} />
                                    </div>
                                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{feature.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section ref={howItWorksRef} id="how-it-works" className="reveal-container scroll-mt-24 bg-white px-4 py-14 dark:bg-slate-950 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">How It Works</p>
                            <h2 className="text-3xl font-bold tracking-tight">A simple flow that stays useful as the session gets deeper.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                Open the room, shape the problem, code together, then pull in tests and review only when they add value.
                            </p>
                        </div>

                        <div className="relative mx-auto max-w-4xl">
                            <div className="absolute bottom-6 left-6 top-6 w-px bg-gradient-to-b from-amber-300/70 via-amber-400/60 to-amber-300/40 dark:from-amber-500/50 dark:via-amber-400/40 dark:to-amber-600/20 md:left-1/2" />
                            <div className="space-y-5">
                                {quickStartSteps.map((step, index) => {
                                    const isRight = index % 2 === 1;
                                    return <StepCard key={step} step={step} index={index} isRight={isRight} />;
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                <section ref={useCasesRef} id="use-cases" className="reveal-container scroll-mt-24 border-y border-stone-200 bg-stone-100/70 px-4 py-14 dark:border-slate-800 dark:bg-slate-900/40 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-400">Use Cases</p>
                            <h2 className="text-3xl font-bold tracking-tight">Three common session types. One consistent room.</h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                ForkSpace stays intentionally narrow so the room feels predictable whether you are interviewing, mentoring, or practicing with a peer.
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-3">
                            {useCases.map((item) => (
                                <UseCaseCard key={item.title} item={item} />
                            ))}
                        </div>
                    </div>
                </section>

            </main>

            <footer className="border-t border-stone-200 bg-stone-100/70 px-4 py-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
                    <p>ForkSpace</p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <a
                            href="https://github.com/Sundramrai3691"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-cursor="button"
                            className="transition hover:text-slate-900 dark:hover:text-white"
                        >
                            GitHub
                        </a>
                        <a
                            href="/LICENSE"
                            data-cursor="button"
                            className="transition hover:text-slate-900 dark:hover:text-white"
                        >
                            MIT License
                        </a>
                        <span>Made by Sundram Kumar Rai, NIT Raipur</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Login;
