/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import axios from 'axios';
import {
    BrainCircuit,
    FlaskConical,
    GraduationCap,
    Radar,
    ShieldCheck,
    Sword,
    Terminal,
    Users2,
    Workflow,
    X,
    Zap,
} from 'lucide-react';
import FormComp from '../components/forms/FormComp';
import Navbar from '../components/common/Navbar';
import AvatarGlyph from '../components/common/AvatarGlyph';
import { getAuthHeaders, getAuthToken } from '../lib/auth';
import { getAvatarById, getRandomAvatar } from '../lib/avatars';
import { toast } from 'react-hot-toast';
import useCursorGlow from '../hooks/useCursorGlow';
import useScrollReveal from '../hooks/useScrollReveal';
import useCardTilt from '../hooks/useCardTilt';

/* ---------------------------------------------------------------------- */
/*  Static content                                                         */
/* ---------------------------------------------------------------------- */

const useCases = [
    {
        icon: Sword,
        title: 'Mock Interview',
        description:
            'Candidates and interviewers convene within a shared workspace featuring a live editor, synchronized execution, and a well-defined Driver/Navigator paradigm.',
    },
    {
        icon: GraduationCap,
        title: 'DSA Mentoring',
        description:
            'Introduce a Codeforces-style problem, deliberate on algorithmic strategies, and troubleshoot collaboratively without the inefficiencies of repeated screen handovers.',
    },
    {
        icon: Zap,
        title: 'Peer Practice',
        description:
            'Co-author a unified solution, subject it to canonical and adversarial test cases, and iterate rapidly through immediate, shared feedback loops.',
    },
];

const quickStartSteps = [
    'Provision a collaborative workspace or attach to an existing Room ID, with guest access enabling immediate participation without introducing unnecessary onboarding overhead.',
    'Configure the session modality, contextualize the problem domain, and formalize Driver or Navigator responsibilities wherever structured collaboration improves efficiency.',
    'Iteratively architect the solution, validate representative behaviours, and synthesize adversarial inputs designed to expose latent implementation defects and algorithmic fragilities.',
    'Interrogate the resulting artefacts through complexity diagnostics, implementation analyses, and archival reports intended to preserve valuable retrospective insights.',
];

const featureHighlights = [
    {
        icon: Workflow,
        title: "Everything. One Place.",
        description:
            "Problem statement, editor, collaborators, execution logs, and AI assistance converge within a unified workspace engineered for uninterrupted flow.",
    },
    {
        icon: Radar,
        title: "Intelligent Problem Ingestion",
        description:
            "Import challenges directly from Codeforces, refine the problem context, and curate sessions tailored to your objectives.",
    },
    {
        icon: FlaskConical,
        title: "Beyond Canonical Test Cases",
        description:
            "Synthesize adversarial inputs, expose latent defects, and rigorously validate solutions before they encounter production-grade edge cases.",
    },
    {
        icon: BrainCircuit,
        title: "AI That Operates as a Mentor",
        description:
            "Receive immediate code critiques, complexity analyses, and individualized guidance designed to cultivate deeper engineering intuition.",
    },
    {
        icon: Users2,
        title: "Collaborative Deliberate Practice",
        description:
            "Transition seamlessly between Peer Practice, Mock Interviews, and Mentorship sessions within purpose-built collaborative environments.",
    },
    {
        icon: ShieldCheck,
        title: "Instantaneous Onboarding",
        description:
            "Enter a room within seconds through guest access, then persist your progress whenever long-term continuity becomes desirable.",
    },
];

// Ambient "presence" markers — small collaborator cursors drifting through the
// hero, a nod to the fact that this is a realtime multiplayer workspace.
const presenceMarkers = [
    { label: 'nyx_07', top: '18%', left: '9%', color: '#22D3EE', duration: '22s', delay: '0s' },
    { label: 'kade.dev', top: '68%', left: '14%', color: '#2F6BFF', duration: '26s', delay: '2s' },
    { label: 'root@rae', top: '24%', left: '88%', color: '#8B5CF6', duration: '24s', delay: '1s' },
    { label: 'iris_9', top: '74%', left: '86%', color: '#22D3EE', duration: '28s', delay: '3s' },
];

function createRoomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------------------------------------------------------------------- */
/*  Small presentational pieces                                            */
/* ---------------------------------------------------------------------- */

function AnimatedHeadline({ text, gradientWords = [] }) {
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
        <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl lg:text-[3.4rem]">
            {words.map((word, index) => {
                const key = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
                const isGradient = gradientWords.includes(key);
                return (
                    <span
                        key={`${word}-${index}`}
                        className={`word-reveal inline-block ${visible ? 'visible' : ''} ${
                            isGradient
                                ? 'bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent'
                                : ''
                        }`}
                        style={visible && !prefersReducedMotion() ? { animationDelay: `${index * 80}ms` } : undefined}
                    >
                        {word}&nbsp;
                    </span>
                );
            })}
        </h1>
    );
}

function UseCaseCard({ item }) {
    const tiltRef = useCardTilt(4);

    return (
        <article
            ref={tiltRef}
            data-cursor="card"
            className="reveal-item group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0A0F1F]/70 p-6 shadow-[0_0_0_1px_rgba(34,211,238,0)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_0_32px_-8px_rgba(34,211,238,0.35)]"
            style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl transition group-hover:bg-cyan-400/20" />
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 to-blue-600/15 text-cyan-300">
                <item.icon size={18} strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold text-slate-100">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
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
            <div className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-[#0A0F1F] font-mono text-sm font-semibold text-cyan-300 shadow-[0_0_18px_-4px_rgba(34,211,238,0.55)]">
                {String(index + 1).padStart(2, '0')}
            </div>
            <div className="absolute left-[1.375rem] top-11 hidden h-px w-8 bg-gradient-to-r from-cyan-400/50 to-transparent md:block md:w-10" />
            <div
                ref={tiltRef}
                className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-[#0A0F1F]/70 p-5 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/25 hover:shadow-[0_0_28px_-10px_rgba(34,211,238,0.4)] md:max-w-[42%]"
                style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
            >
                <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400/80">
                    Step {index + 1}
                </p>
                <p className="text-sm leading-7 text-slate-300">{step}</p>
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------------- */
/*  Page                                                                    */
/* ---------------------------------------------------------------------- */

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
                        topScore,
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
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/10">
                        <AvatarGlyph avatar={getAvatarById(randomAvatar.id)} className="h-3.5 w-3.5" />
                    </span>
                    {`You're ${randomAvatar.name} this session`}
                </span>,
                {
                    duration: 3500,
                    position: 'bottom-center',
                    style: {
                        background: '#0A0F1F',
                        color: '#67E8F9',
                        border: '1px solid rgba(34,211,238,0.25)',
                        boxShadow: '0 0 24px -6px rgba(34,211,238,0.45)',
                        borderRadius: '10px',
                    },
                },
            );
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
        <div className="min-h-screen bg-[#05070F] text-slate-100 antialiased">
            {/* Local keyframes — self-contained so this file doesn't depend on
                animation names defined elsewhere in the app's global stylesheet. */}
            <style>{`
                @keyframes axionGlowDrift1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(40px,-30px); } }
                @keyframes axionGlowDrift2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-50px,25px); } }
                @keyframes axionGridPulse { 0%,100% { opacity: 0.35; } 50% { opacity: 0.6; } }
                @keyframes axionRingRotate { to { transform: rotate(360deg); } }
                @keyframes axionPresenceFloat {
                    0% { transform: translate(0,0); opacity: 0; }
                    10% { opacity: 0.85; }
                    50% { transform: translate(18px,-22px); }
                    90% { opacity: 0.85; }
                    100% { transform: translate(-6px,10px); opacity: 0; }
                }
                @keyframes axionDotPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.55);} 50% { box-shadow: 0 0 0 6px rgba(34,211,238,0);} }
                @media (prefers-reduced-motion: reduce) {
                    .axion-anim { animation: none !important; }
                }
            `}</style>

            <Navbar onSignInClick={handleOnSignInClick} />

            <main>
                {/* ---------------------------------------------------------------- HERO */}
                <section
                    ref={heroRef}
                    className="relative overflow-hidden border-b border-white/5 px-4 pb-24 pt-20 sm:px-6 lg:px-8"
                    style={{
                        background:
                            'radial-gradient(1100px circle at 18% 0%, rgba(47,107,255,0.16), transparent 55%),' +
                            'radial-gradient(900px circle at 84% 6%, rgba(139,92,246,0.10), transparent 50%),' +
                            'linear-gradient(180deg, #05070F 0%, #060A16 55%, #05070F 100%)',
                    }}
                >
                    {/* fine circuit grid */}
                    <div
                        aria-hidden="true"
                        className="axion-anim pointer-events-none absolute inset-0"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(103,232,249,0.05) 1px, transparent 1px),' +
                                'linear-gradient(90deg, rgba(103,232,249,0.05) 1px, transparent 1px)',
                            backgroundSize: '42px 42px',
                            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 20%, black 40%, transparent 80%)',
                            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 20%, black 40%, transparent 80%)',
                            animation: 'axionGridPulse 8s ease-in-out infinite',
                        }}
                    />

                    {/* cursor-follow glow */}
                    {!reduceMotion ? (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background:
                                    'radial-gradient(560px circle at var(--glow-x) var(--glow-y), rgba(34,211,238,0.06), transparent 75%)',
                            }}
                        />
                    ) : null}

                    {/* ambient glow blobs */}
                    <div
                        aria-hidden="true"
                        className="axion-anim pointer-events-none absolute h-[420px] w-[420px] rounded-full"
                        style={{
                            background: 'radial-gradient(circle, rgba(47,107,255,0.14) 0%, transparent 70%)',
                            top: '8%',
                            left: '-6%',
                            filter: 'blur(70px)',
                            animation: 'axionGlowDrift1 24s ease-in-out infinite',
                        }}
                    />
                    <div
                        aria-hidden="true"
                        className="axion-anim pointer-events-none absolute h-[340px] w-[340px] rounded-full"
                        style={{
                            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
                            bottom: '4%',
                            right: '-4%',
                            filter: 'blur(80px)',
                            animation: 'axionGlowDrift2 28s ease-in-out infinite',
                        }}
                    />

                    {/* live collaborator presence markers */}
                    {!reduceMotion &&
                        presenceMarkers.map((marker) => (
                            <div
                                key={marker.label}
                                aria-hidden="true"
                                className="axion-anim pointer-events-none absolute hidden items-center gap-1.5 lg:flex"
                                style={{
                                    top: marker.top,
                                    left: marker.left,
                                    animation: `axionPresenceFloat ${marker.duration} ease-in-out ${marker.delay} infinite`,
                                }}
                            >
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ background: marker.color, boxShadow: `0 0 8px 1px ${marker.color}` }}
                                />
                                <span
                                    className="font-mono text-[10px] tracking-wide text-slate-500"
                                    style={{ color: marker.color, opacity: 0.7 }}
                                >
                                    {marker.label}
                                </span>
                            </div>
                        ))}

                    <div className="relative mx-auto py-4 flex max-w-5xl flex-col items-center text-center">
                        <div
                            data-cursor="card"
                            className="inline-flex items-center gap-3 rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-4 py-1.5 font-mono text-xs text-cyan-300 backdrop-blur "
                            style={{
                                opacity: heroBadgeVisible ? 1 : 0,
                                transform: heroBadgeVisible ? 'translateY(0)' : 'translateY(8px)',
                                transition: reduceMotion ? 'none' : 'opacity 400ms ease 200ms, transform 400ms ease 200ms',
                            }}
                        >
                            <span className="axion-anim relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400" style={{ animation: 'axionDotPulse 2s ease-out infinite' }} />
                            </span>
                            <Terminal size={13} strokeWidth={1.75} />
                            realtime · collaborative · multiplayer workspace
                        </div>

                        <div className="mt-8 space-y-5">
                            <AnimatedHeadline
                                text="A unified workspace for deliberate DSA practice, mock interviews, and collaborative mentorship."
                                gradientWords={['unified', 'dsa', 'mock', 'mentorship.']}
                            />
                            <p className="mx-auto max-w-3xl text-lg leading-8 text-slate-400">
                                Axion keeps the problem brief, shared editor, sample runs, hidden tests, solution analysis, and session reporting in one focused workflow.
                            </p>
                        </div>

                        <div
                            className="mt-9 flex flex-col gap-3 sm:flex-row"
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
                                className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(34,211,238,0.7)] transition duration-300 hover:shadow-[0_0_36px_-4px_rgba(34,211,238,0.85)] hover:brightness-110 active:scale-[0.98]"
                            >
                                <span className="relative z-10">Open a Room</span>
                            </button>
                            <Link
                                to="/analyse"
                                data-cursor="button"
                                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-slate-200 backdrop-blur transition duration-300 hover:border-cyan-400/40 hover:bg-cyan-400/[0.06] hover:text-cyan-200"
                            >
                                Open Solution Analyser
                            </Link>
                            <Link
                                to="/daily-challenge"
                                data-cursor="button"
                                className="inline-flex items-center justify-center rounded-xl border border-purple-400/25 bg-purple-400/[0.04] px-6 py-2.5 text-sm font-medium text-purple-200 backdrop-blur transition duration-300 hover:border-purple-400/50 hover:bg-purple-400/[0.09]"
                            >
                                Daily Challenge
                            </Link>
                        </div>

                        {dailyStats && (
                            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] tracking-wide text-slate-400">
                                    {dailyStats.totalCount} solutions today
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] tracking-wide text-slate-400">
                                    avg {dailyStats.avgScore} pts
                                </span>
                                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1 font-mono text-[11px] tracking-wide text-cyan-300">
                                    top {dailyStats.topScore} pts
                                </span>
                            </div>
                        )}

                        {/* ---- quick-join card, the focal "login" element ---- */}
                        <div className="relative mt-10 w-full max-w-2xl">
                            <div
                                aria-hidden="true"
                                className="axion-anim absolute -inset-[1.5px] rounded-[1.9rem] opacity-70 blur-[3px]"
                                style={{
                                    background: 'conic-gradient(from 0deg, #22D3EE, #2F6BFF, #8B5CF6, #22D3EE)',
                                    animation: 'axionRingRotate 7s linear infinite',
                                }}
                            />
                            <form
                                id="join-session"
                                onSubmit={handleQuickJoin}
                                data-cursor="card"
                                className="relative flex w-full flex-col gap-3 rounded-[1.85rem] border border-white/10 bg-[#0A0F1F]/90 p-4 shadow-[0_28px_90px_-40px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:flex-row sm:items-center"
                            >
                                <input
                                    ref={quickRoomRef}
                                    type="text"
                                    value={quickRoomId}
                                    onChange={(event) => setQuickRoomId(event.target.value.toUpperCase())}
                                    placeholder="Paste a room ID or generate one"
                                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#060A16] px-4 py-3 font-mono text-sm tracking-wide text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.14),0_0_20px_-4px_rgba(34,211,238,0.55)]"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleGenerateRoomId}
                                        data-cursor="button"
                                        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] hover:text-cyan-200"
                                    >
                                        Generate
                                    </button>
                                    <button
                                        type="submit"
                                        data-cursor="button"
                                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgba(34,211,238,0.7)] transition duration-300 hover:shadow-[0_0_30px_-4px_rgba(34,211,238,0.85)] hover:brightness-110 active:scale-[0.98] sm:flex-none"
                                    >
                                        Enter
                                    </button>
                                </div>
                            </form>
                        </div>

                        <p className="mt-3 text-sm text-slate-500">
                            {currentUser ? `Jump in as ${currentUser.name}.` : 'No signup needed. Sign in only if you want saved rooms, reports, and history.'}
                        </p>

                        <div className="mt-6 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
                            <div data-cursor="card" className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/25">
                                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Shared Room</p>
                                <p className="mt-1 text-sm text-slate-400">Real-time editor synchronization, persistent presence indicators, well-defined collaboration roles, and a unified source of truth for every stage of the session.</p>
                            </div>
                            <div
                                data-cursor="card"
                                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/25"
                            >
                                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
                                    Problem Import
                                </p>
                                <p className="mt-1 text-sm text-slate-400">
                                    Ingest challenges directly from Codeforces, contextualize the problem
                                    statement, and curate sessions aligned with specific objectives.
                                </p>
                            </div>
                            <div data-cursor="card" className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/25">
                                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Review + Report</p>
                                <p className="mt-1 text-sm text-slate-400">Evaluate implementation quality, computational complexity, and edge-case resilience, then retain a shareable report for sessions that warrant archival.</p>
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
                                className="mt-6 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-300 backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] hover:text-cyan-200"
                            >
                                {showAuthPanel ? 'Close account access' : 'Sign in to save progress'}
                            </button>
                        )}
                    </div>
                </section>

                {/* ---------------------------------------------------------------- AUTH PANEL */}
                {(!currentUser && showAuthPanel) && (
                    <section
                        ref={authEntryRef}
                        id="auth-entry"
                        className="scroll-mt-24 border-b border-white/5 bg-[#060A16] px-4 py-10 sm:px-6 lg:px-8"
                    >
                        <div className="mx-auto max-w-6xl space-y-5">
                            <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4">
                                <div className="space-y-2 text-left">
                                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400/80">Account Access</p>
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-100">Sign in only when you want saved rooms, reports, and history.</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAuthPanel(false)}
                                    data-cursor="button"
                                    className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-200"
                                    aria-label="Close sign-in panel"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex justify-center">
                                <div className="relative w-full max-w-md">
                                    <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-blue-500/10 blur-3xl"
                                    />
                                    <div className="relative rounded-3xl border border-white/10 bg-[#0A0F1F]/90 p-1 shadow-[0_0_40px_-16px_rgba(34,211,238,0.35)] backdrop-blur-2xl">
                                        <FormComp />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ---------------------------------------------------------------- FEATURES */}
                <section id="features" className="scroll-mt-24 border-b border-white/5 bg-[#05070F] px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-3xl space-y-3">
                            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400/80">Core Features</p>
                            <h2 className="text-3xl font-bold tracking-tight text-slate-100">Built for real interview-style problem solving.</h2>
                            <p className="text-slate-400">
                                The goal is not to be a full IDE. The goal is to make one shared DSA session feel clear, fast, and reviewable from start to finish.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {featureHighlights.map((feature) => (
                                <article
                                    key={feature.title}
                                    data-cursor="card"
                                    className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-400/25 hover:shadow-[0_16px_42px_-24px_rgba(34,211,238,0.4)]"
                                >
                                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 to-blue-600/15 text-cyan-300 transition group-hover:scale-105">
                                        <feature.icon size={18} strokeWidth={1.75} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-100">{feature.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-slate-400">{feature.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ---------------------------------------------------------------- HOW IT WORKS */}
                <section ref={howItWorksRef} id="how-it-works" className="reveal-container scroll-mt-24 bg-[#05070F] px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400/80">How It Works</p>
                            <h2 className="text-3xl font-bold tracking-tight text-slate-100">A simple flow that stays useful as the session gets deeper.</h2>
                            <p className="text-slate-400">
                                Open the room, shape the problem, code together, then pull in tests and review only when they add value.
                            </p>
                        </div>

                        <div className="relative mx-auto max-w-4xl">
                            <div className="absolute bottom-6 left-[1.375rem] top-6 w-px bg-gradient-to-b from-cyan-400/60 via-blue-500/40 to-purple-500/20 md:left-1/2" />
                            <div className="space-y-5">
                                {quickStartSteps.map((step, index) => {
                                    const isRight = index % 2 === 1;
                                    return <StepCard key={step} step={step} index={index} isRight={isRight} />;
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------------------------------------------------------------- USE CASES */}
                <section ref={useCasesRef} id="use-cases" className="reveal-container scroll-mt-24 border-y border-white/5 bg-[#060A16] px-4 py-14 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl space-y-8">
                        <div className="max-w-2xl space-y-3">
                            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400/80">Use Cases</p>
                            <h2 className="text-3xl font-bold tracking-tight text-slate-100">Three common session types. One consistent room.</h2>
                            <p className="text-slate-400">
                                Axion stays intentionally narrow so the room feels predictable whether you are interviewing, mentoring, or practicing with a peer.
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

            <footer className="border-t border-white/5 bg-[#05070F] px-4 py-6 text-sm text-slate-500 sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
                    <p className="font-bold tracking-wide">Axion</p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <a
                            href="https://github.com/Adityakale007"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-cursor="button"
                            className="transition hover:text-cyan-300"
                        >
                            GitHub
                        </a>
                        <a
                            href="/LICENSE"
                            data-cursor="button"
                            className="transition hover:text-cyan-300"
                        >
                            MIT License
                        </a>
                        <span>Made by Aditya Kale, NIT Raipur</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Login;
