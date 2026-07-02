import { useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeContext } from '../../../Context/ThemeContext';
import { Monitor, Sun, Moon } from 'lucide-react';
import { clearAuthToken, getAuthHeaders, getAuthToken, onAuthChange } from '../../lib/auth';
import AvatarGlyph from './AvatarGlyph';
import { AVATARS, getAvatarById } from '../../lib/avatars';

const PROFILE_AVATARS = [
    { key: 'dev1', emoji: '🧑‍💻' },
    { key: 'dev2', emoji: '👾' },
    { key: 'dev3', emoji: '🤖' },
    { key: 'dev4', emoji: '🦊' },
    { key: 'dev5', emoji: '🐧' },
    { key: 'dev6', emoji: '🦅' },
    { key: 'dev7', emoji: '🐉' },
    { key: 'dev8', emoji: '⚡' },
];

function getRatingLabel(rating = 1000) {
    if (rating > 2100) return 'Grandmaster';
    if (rating >= 1800) return 'Master';
    if (rating >= 1500) return 'Expert';
    if (rating >= 1200) return 'Coder';
    return 'Novice';
}

function buildActivityGrid(activityLog = []) {
    const activeDays = new Set((activityLog || []).map((entry) => new Date(entry.date).toISOString().slice(0, 10)));
    return Array.from({ length: 84 }, (_, index) => {
        const day = new Date();
        day.setDate(day.getDate() - (83 - index));
        const key = day.toISOString().slice(0, 10);
        return { key, active: activeDays.has(key) };
    });
}

/**
 * DESIGN NOTE — Theme toggle:
 * The design brief calls for a permanent, dark-only aesthetic. The underlying
 * ThemeContext (light / dark / system) is left fully intact so no business logic
 * or persisted user preference is broken — but the control is visually restyled
 * as a quiet "Interface" segmented switch that reads as part of the dark-neon
 * system regardless of which mode is active. Remove the block marked
 * THEME_SWITCH below if you'd rather hard-lock the app to dark mode entirely.
 */

function Navbar({ onSignInClick }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAvatarSaving, setIsAvatarSaving] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [draftName, setDraftName] = useState('');
    const { theme, setTheme } = useContext(ThemeContext);
    const profileRef = useRef(null);
    const avatarPickerRef = useRef(null);
    const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    const handleScrollToJoin = () => {
        closeMenu();
        setIsProfileOpen(false);
        document.getElementById('join-session')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleScrollToAuth = () => {
        closeMenu();
        setIsProfileOpen(false);
        if (onSignInClick) {
            onSignInClick();
        } else {
            document.getElementById('auth-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleScrollToSection = (sectionId) => {
        closeMenu();
        setIsProfileOpen(false);
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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
                setDraftName(response.data.user?.name || '');
            } catch {
                clearAuthToken();
                setCurrentUser(null);
            }
        };

        loadCurrentUser();

        const removeAuthListener = onAuthChange(loadCurrentUser);
        const handleStorage = () => loadCurrentUser();
        window.addEventListener('storage', handleStorage);

        return () => {
            removeAuthListener();
            window.removeEventListener('storage', handleStorage);
        };
    }, [serverUrl]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isAvatarPickerOpen) return;
        avatarPickerRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    }, [isAvatarPickerOpen]);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 60);
        handler();
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    const handleSignOut = () => {
        clearAuthToken();
        setIsProfileOpen(false);
        setIsAvatarPickerOpen(false);
        closeMenu();
    };

    const handleAvatarUpdate = async (avatarId) => {
        if (!currentUser) return;
        if (currentUser.avatarId === avatarId || isAvatarSaving) return;
        setIsAvatarSaving(true);
        try {
            const response = await axios.patch(
                `${serverUrl}/api/auth/avatar`,
                { avatarId },
                { headers: getAuthHeaders() },
            );
            setCurrentUser(response.data.user || { ...currentUser, avatarId });
            setIsAvatarPickerOpen(true);
            toast.success('Avatar updated');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not update avatar right now');
        } finally {
            setIsAvatarSaving(false);
        }
    };

    const handleProfileUpdate = async (updates = {}) => {
        if (!currentUser) return;
        try {
            const response = await axios.patch(
                `${serverUrl}/api/auth/profile`,
                updates,
                { headers: getAuthHeaders() },
            );
            setCurrentUser(response.data.user);
            setDraftName(response.data.user?.name || '');
            setIsEditingName(false);
        } catch {
            // keep UI stable
        }
    };

    const themeOptions = [
        { key: 'light', label: 'Light', icon: Sun },
        { key: 'dark', label: 'Dark', icon: Moon },
        { key: 'system', label: 'System', icon: Monitor },
    ];

    return (
        <>
            {/* Scoped keyframes / effects — safe to move into a global stylesheet */}
            <style>{`
                @keyframes axn-aura {
                    0%, 100% { opacity: 0.55; transform: scale(1); }
                    50% { opacity: 0.9; transform: scale(1.06); }
                }
                @keyframes axn-spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes axn-drift {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-2px); }
                }
                .axn-logo-aura {
                    animation: axn-aura 4.5s ease-in-out infinite;
                }
                .axn-ring-spin {
                    animation: axn-spin 3.2s linear infinite;
                }
                .axn-drift {
                    animation: axn-drift 6s ease-in-out infinite;
                }
                .axn-noise {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
                    mix-blend-mode: overlay;
                }
                @media (prefers-reduced-motion: reduce) {
                    .axn-logo-aura, .axn-ring-spin, .axn-drift { animation: none; }
                }
            `}</style>

            <div
                className={`fixed inset-x-0 top-0 z-50 flex justify-center px-3 transition-[padding] duration-300 sm:px-6 ${
                    scrolled ? 'pt-3' : 'pt-5'
                }`}
            >
                <nav
                    className={`relative w-full max-w-6xl overflow-visible rounded-[1.75rem] border bg-[#0b1120]/70 backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300 ${
                        scrolled
                            ? 'border-indigo-400/25 shadow-[0_8px_40px_-12px_rgba(99,102,241,0.45),0_0_0_1px_rgba(99,102,241,0.08)]'
                            : 'border-white/[0.06] shadow-[0_20px_60px_-25px_rgba(0,0,0,0.8)]'
                    }`}
                >
                    {/* subtle grain for material depth */}
                    <div className="axn-noise pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-[0.025]" />
                    {/* hairline top sheen */}
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

                    <div className="relative mx-auto flex h-16 items-center justify-between gap-6 px-5 sm:px-7">
                        <button
                            type="button"
                            onClick={handleScrollToJoin}
                            data-cursor="button"
                            className="group flex shrink-0 items-center gap-3"
                        >
                            <div className="relative">
                                <div className="axn-logo-aura absolute -inset-1.5 rounded-xl bg-gradient-to-br from-indigo-500/50 via-violet-500/40 to-cyan-400/40 blur-md" />
                                <div className="relative rounded-xl bg-[#080b17] p-1 ring-1 ring-white/10">
                                    <img
                                        src="/logo.png"
                                        alt="Axion logo"
                                        className="h-8 w-8 rounded-lg object-contain"
                                    />
                                </div>
                            </div>
                            <span className="text-[17px] font-semibold tracking-tight text-white">
                                Axion
                            </span>
                        </button>

                        <div className="hidden flex-nowrap items-center gap-9 md:flex">
                            <Link
                                to="/analyse"
                                data-cursor="button"
                                className="group relative shrink-0 py-1 text-[13px] font-medium tracking-wide text-white/55 transition-colors duration-200 hover:text-white"
                            >
                                Solution Analyzer
                                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] transition-all duration-300 group-hover:w-full" />
                            </Link>
                            <Link
                                to="/daily-challenge"
                                data-cursor="button"
                                className="group relative shrink-0 py-1 text-[13px] font-medium tracking-wide text-white/55 transition-colors duration-200 hover:text-white"
                            >
                                Daily Challenge
                                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] transition-all duration-300 group-hover:w-full" />
                            </Link>
                            <button
                                type="button"
                                onClick={() => handleScrollToSection('how-it-works')}
                                data-cursor="button"
                                className="group relative shrink-0 py-1 text-[13px] font-medium tracking-wide text-white/55 transition-colors duration-200 hover:text-white"
                            >
                                How It Works
                                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] transition-all duration-300 group-hover:w-full" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleScrollToSection('use-cases')}
                                data-cursor="button"
                                className="group relative shrink-0 py-1 text-[13px] font-medium tracking-wide text-white/55 transition-colors duration-200 hover:text-white"
                            >
                                Use Cases
                                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] transition-all duration-300 group-hover:w-full" />
                            </button>

                            <button
                                type="button"
                                onClick={handleScrollToJoin}
                                data-cursor="button"
                                className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-[13px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition-all duration-250 hover:scale-[1.03] hover:shadow-[0_0_28px_-4px_rgba(139,92,246,0.65)] active:scale-[0.98]"
                            >
                                Start Workspace
                            </button>

                            <div className="relative" ref={profileRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsProfileOpen((current) => !current);
                                        setIsAvatarPickerOpen(false);
                                    }}
                                    data-cursor="button"
                                    className="group relative flex h-10 w-10 items-center justify-center"
                                    aria-label="Open profile and theme menu"
                                >
                                    <span className="axn-ring-spin pointer-events-none absolute -inset-[3px] rounded-full bg-[conic-gradient(from_0deg,#22d3ee,#6366f1,#8b5cf6,#22d3ee)] opacity-0 blur-[2px] transition-opacity duration-300 group-hover:opacity-70" />
                                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0b1120] text-sm font-semibold text-white/80 transition-colors duration-200 group-hover:text-white">
                                        <AvatarGlyph avatar={getAvatarById(currentUser?.avatarId)} className="h-5 w-5" />
                                    </span>
                                </button>

                                <AnimatePresence>
                                    {isProfileOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                            transition={{ duration: 0.18, ease: 'easeOut' }}
                                            className="absolute right-0 top-14 z-20 w-[24rem] max-w-[calc(100vw-1.5rem)] rounded-[1.25rem] bg-gradient-to-b from-indigo-500/30 via-violet-500/10 to-transparent p-px shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)]"
                                        >
                                            <div className="max-h-[min(82vh,44rem)] overflow-y-auto rounded-[1.25rem] bg-[#080b17]/95 p-4 backdrop-blur-xl">
                                                {currentUser ? (
                                                    <div className="border-b border-white/[0.06] px-1 pb-4">
                                                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                                                            <div className="flex items-start gap-4">
                                                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-4xl shadow-[0_0_20px_-6px_rgba(99,102,241,0.5)]">
                                                                    {PROFILE_AVATARS.find((avatar) => avatar.key === currentUser.avatar)?.emoji || '🧑‍💻'}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    {isEditingName ? (
                                                                        <input
                                                                            value={draftName}
                                                                            onChange={(event) => setDraftName(event.target.value)}
                                                                            onBlur={() => handleProfileUpdate({ name: draftName })}
                                                                            onKeyDown={(event) => {
                                                                                if (event.key === 'Enter') handleProfileUpdate({ name: draftName });
                                                                            }}
                                                                            className="w-full rounded-lg border border-indigo-400/40 bg-[#0b1120] px-2 py-1 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                                                            autoFocus
                                                                        />
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setIsEditingName(true)}
                                                                            className="text-left text-base font-semibold text-white transition-colors duration-200 hover:text-indigo-300"
                                                                        >
                                                                            {currentUser.name}
                                                                        </button>
                                                                    )}
                                                                    <p className="mt-0.5 text-xs font-medium text-white/40">{currentUser.email}</p>
                                                                    <div className="mt-3 flex items-end gap-2">
                                                                        <p className="bg-gradient-to-r from-cyan-300 via-indigo-300 to-violet-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                                                                            {currentUser.AxionRating ?? 1000}
                                                                        </p>
                                                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                                                                            {getRatingLabel(currentUser.AxionRating)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                                                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3">
                                                                    <p className="text-lg font-semibold text-white">{currentUser.totalSessions ?? 0}</p>
                                                                    <p className="mt-0.5 font-medium text-white/35">Sessions</p>
                                                                </div>
                                                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3">
                                                                    <p className="text-lg font-semibold text-white">{currentUser.problemsAttempted ?? 0}</p>
                                                                    <p className="mt-0.5 font-medium text-white/35">Problems</p>
                                                                </div>
                                                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3">
                                                                    <p className="text-lg font-semibold text-white">
                                                                        {currentUser.currentStreak ?? 0} <span className="text-orange-400">🔥</span>
                                                                    </p>
                                                                    <p className="mt-0.5 font-medium text-white/35">Streak</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 flex flex-wrap gap-2">
                                                                {(currentUser.titles || []).slice(0, 3).map((title) => (
                                                                    <span
                                                                        key={title}
                                                                        className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-300"
                                                                    >
                                                                        {title}
                                                                    </span>
                                                                ))}
                                                                {(currentUser.titles || []).length > 3 ? (
                                                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                                                                        +{(currentUser.titles || []).length - 3} more
                                                                    </span>
                                                                ) : null}
                                                            </div>

                                                            <div className="mt-5">
                                                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Activity</p>
                                                                <div className="grid grid-cols-12 gap-1.5">
                                                                    {buildActivityGrid(currentUser.activityLog).map((cell) => (
                                                                        <span
                                                                            key={cell.key}
                                                                            className={`h-3.5 rounded-[3px] border transition-colors duration-200 ${
                                                                                cell.active
                                                                                    ? 'border-indigo-400/60 bg-gradient-to-br from-indigo-400 to-cyan-400 shadow-[0_0_6px_rgba(99,102,241,0.6)]'
                                                                                    : 'border-white/[0.05] bg-white/[0.02]'
                                                                            }`}
                                                                            title={cell.key}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="border-b border-white/[0.06] px-2 pb-4 pt-2">
                                                        <p className="text-sm font-semibold text-white">Interface &amp; Account</p>
                                                        <p className="mt-1 text-xs text-white/40">Sign in to save your workspace history and analysis.</p>
                                                    </div>
                                                )}

                                                {/* THEME_SWITCH — restyled, logic untouched */}
                                                <div className="mt-4 grid grid-cols-3 gap-2">
                                                    {themeOptions.map((option) => {
                                                        const Icon = option.icon;
                                                        return (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                onClick={() => setTheme(option.key)}
                                                                data-cursor="button"
                                                                className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-all duration-200 ${
                                                                    theme === option.key
                                                                        ? 'border border-indigo-400/30 bg-indigo-500/10 text-indigo-300 shadow-[0_0_16px_-6px_rgba(99,102,241,0.7)]'
                                                                        : 'border border-transparent text-white/40 hover:bg-white/[0.03] hover:text-white/80'
                                                                }`}
                                                            >
                                                                <Icon size={16} />
                                                                {option.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-4 space-y-1.5">
                                                    {currentUser ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
                                                                data-cursor="button"
                                                                className={`block w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                                                                    isAvatarPickerOpen
                                                                        ? 'bg-indigo-500/10 text-indigo-300'
                                                                        : 'text-white/70 hover:bg-white/[0.04] hover:text-white'
                                                                }`}
                                                            >
                                                                {isAvatarPickerOpen ? 'Hide Avatar Settings' : 'Update Profile Icon'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleScrollToJoin}
                                                                data-cursor="button"
                                                                className="block w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium text-white/70 transition-colors duration-200 hover:bg-white/[0.04] hover:text-white"
                                                            >
                                                                Enter Workspace
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleSignOut}
                                                                data-cursor="button"
                                                                className="block w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium text-rose-400 transition-colors duration-200 hover:bg-rose-500/[0.08]"
                                                            >
                                                                Sign Out
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={handleScrollToAuth}
                                                            data-cursor="button"
                                                            className="block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-center text-sm font-semibold text-white transition-all duration-250 hover:scale-[1.01] hover:shadow-[0_0_24px_-6px_rgba(139,92,246,0.6)]"
                                                        >
                                                            Sign In / Register
                                                        </button>
                                                    )}
                                                </div>

                                                <AnimatePresence>
                                                    {currentUser && isAvatarPickerOpen && (
                                                        <motion.div
                                                            ref={avatarPickerRef}
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                                            className="mt-4 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-3"
                                                        >
                                                            <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                                                                Select User Glyph
                                                            </p>
                                                            <div className="grid grid-cols-4 gap-2">
                                                                {AVATARS.map((avatar) => {
                                                                    const isActive = currentUser.avatarId === avatar.id;
                                                                    return (
                                                                        <button
                                                                            key={avatar.id}
                                                                            type="button"
                                                                            onClick={() => handleAvatarUpdate(avatar.id)}
                                                                            data-cursor="button"
                                                                            disabled={isAvatarSaving}
                                                                            className={`flex h-12 items-center justify-center rounded-xl border transition-all duration-200 ${
                                                                                isActive
                                                                                    ? 'border-indigo-400/50 bg-indigo-500/10 text-indigo-300 shadow-[0_0_14px_-5px_rgba(99,102,241,0.8)]'
                                                                                    : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-cyan-400/30 hover:text-cyan-300 hover:shadow-[0_0_12px_-6px_rgba(34,211,238,0.6)]'
                                                                            } ${isAvatarSaving ? 'cursor-not-allowed opacity-50' : ''}`}
                                                                            title={avatar.name}
                                                                        >
                                                                            <AvatarGlyph avatar={avatar} className="h-5 w-5" />
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                            <p className="mb-3 mt-4 px-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                                                                Select Display Emoji
                                                            </p>
                                                            <div className="grid grid-cols-4 gap-2">
                                                                {PROFILE_AVATARS.map((avatar) => (
                                                                    <button
                                                                        key={avatar.key}
                                                                        type="button"
                                                                        onClick={() => handleProfileUpdate({ avatar: avatar.key })}
                                                                        data-cursor="button"
                                                                        className={`rounded-xl border px-2 py-2 text-xl transition-all duration-200 ${
                                                                            currentUser.avatar === avatar.key
                                                                                ? 'border-indigo-400/50 bg-indigo-500/10 shadow-[0_0_14px_-5px_rgba(99,102,241,0.8)]'
                                                                                : 'border-white/[0.06] bg-white/[0.02] hover:border-cyan-400/30 hover:bg-white/[0.04]'
                                                                        }`}
                                                                    >
                                                                        {avatar.emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Mobile Menu Toggle */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setIsMenuOpen((prev) => !prev)}
                                data-cursor="button"
                                className="inline-flex items-center justify-center rounded-lg p-2.5 text-white/60 transition-colors duration-200 hover:bg-white/[0.05] hover:text-white focus:outline-none"
                                aria-expanded={isMenuOpen}
                            >
                                <span className="sr-only">Open main menu</span>
                                {!isMenuOpen ? (
                                    <svg className="block h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                ) : (
                                    <svg className="block h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu Dropdown */}
                    <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                className="overflow-hidden md:hidden"
                            >
                                <div className="space-y-2 border-t border-white/[0.06] px-4 pb-6 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleScrollToSection('how-it-works')}
                                        data-cursor="button"
                                        className="block w-full rounded-xl px-4 py-3 text-left text-base font-medium text-white/75 transition-colors duration-200 hover:bg-white/[0.04] hover:text-cyan-300"
                                    >
                                        How It Works
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleScrollToSection('use-cases')}
                                        data-cursor="button"
                                        className="block w-full rounded-xl px-4 py-3 text-left text-base font-medium text-white/75 transition-colors duration-200 hover:bg-white/[0.04] hover:text-cyan-300"
                                    >
                                        Use Cases
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleScrollToJoin}
                                        data-cursor="button"
                                        className="block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-center text-base font-semibold text-white shadow-[0_0_24px_-8px_rgba(139,92,246,0.6)] transition-all duration-250 active:scale-[0.98]"
                                    >
                                        Start Workspace
                                    </button>

                                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Interface</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            {themeOptions.map((option) => {
                                                const Icon = option.icon;
                                                return (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        onClick={() => setTheme(option.key)}
                                                        data-cursor="button"
                                                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                                                            theme === option.key
                                                                ? 'border border-indigo-400/30 bg-indigo-500/10 text-indigo-300'
                                                                : 'border border-transparent text-white/45 hover:bg-white/[0.04]'
                                                        }`}
                                                    >
                                                        <Icon size={16} />
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        {currentUser ? (
                                            <div className="space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={handleScrollToJoin}
                                                    data-cursor="button"
                                                    className="block w-full rounded-xl border border-white/[0.08] px-4 py-3 text-center text-sm font-semibold text-white/80 transition-colors duration-200 hover:bg-white/[0.04]"
                                                >
                                                    Enter as {currentUser.name}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSignOut}
                                                    data-cursor="button"
                                                    className="block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold text-rose-400 transition-colors duration-200 hover:bg-rose-500/[0.08]"
                                                >
                                                    Sign Out
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleScrollToAuth}
                                                data-cursor="button"
                                                className="block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-center text-sm font-semibold text-white transition-all duration-250"
                                            >
                                                Sign In / Register
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </nav>
            </div>
        </>
    );
}

export default Navbar;