import { useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
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
        <nav
            className={`fixed top-0 z-50 w-full transition-all duration-300 ${
                scrolled
                    ? 'border-b border-white/5 bg-slate-900/80 backdrop-blur-md'
                    : 'border-b border-transparent bg-transparent'
            }`}
            style={scrolled ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } : undefined}
        >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between gap-6">
                    <button
                        type="button"
                        onClick={handleScrollToJoin}
                        data-cursor="button"
                        className={`flex shrink-0 items-center gap-3 transition-all duration-300 ${scrolled ? 'border-l-2 border-amber-400 pl-2' : ''}`}
                    >
                        <div className="rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5 dark:bg-white">
                            <img
                                src="/logo.png"
                                alt="ForkSpace logo"
                                className="h-8 w-8 rounded-lg object-contain"
                            />
                        </div>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">ForkSpace</span>
                    </button>

                    <div className="hidden flex-nowrap items-center gap-8 md:flex">
                        <Link
                            to="/analyse"
                            data-cursor="button"
                            className="group shrink-0 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                            <span className="relative after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:bg-amber-400 after:transition-all after:duration-200 group-hover:after:left-0 group-hover:after:w-full">
                                Solution Analyser
                            </span>
                        </Link>
                        <Link
                            to="/daily-challenge"
                            data-cursor="button"
                            className="group shrink-0 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                            <span className="relative after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:bg-amber-400 after:transition-all after:duration-200 group-hover:after:left-0 group-hover:after:w-full">
                                Daily Challenge
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('how-it-works')}
                            data-cursor="button"
                            className="group shrink-0 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                            <span className="relative after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:bg-amber-400 after:transition-all after:duration-200 group-hover:after:left-0 group-hover:after:w-full">
                                How It Works
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('use-cases')}
                            data-cursor="button"
                            className="group shrink-0 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                            <span className="relative after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:bg-amber-400 after:transition-all after:duration-200 group-hover:after:left-0 group-hover:after:w-full">
                                Use Cases
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={handleScrollToJoin}
                            data-cursor="button"
                            className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                        >
                            Start a Room
                        </button>

                        <div className="relative" ref={profileRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProfileOpen((current) => !current);
                                    setIsAvatarPickerOpen(false);
                                }}
                                data-cursor="button"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:text-white"
                                aria-label="Open profile and theme menu"
                            >
                                <AvatarGlyph avatar={getAvatarById(currentUser?.avatarId)} className="h-4 w-4" />
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 top-12 z-20 max-h-[min(82vh,44rem)] w-[24rem] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-lg ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 dark:ring-white/10">
                                    {currentUser ? (
                                        <div className="border-b border-gray-100 px-1 pb-4 dark:border-gray-700">
                                            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/70">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-4xl dark:bg-amber-500/10">
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
                                                                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-900 dark:border-gray-600 dark:bg-slate-950 dark:text-white"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <button type="button" onClick={() => setIsEditingName(true)} className="text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                                {currentUser.name}
                                                            </button>
                                                        )}
                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                                                        <p className="mt-2 text-2xl font-bold text-amber-500">{currentUser.forkspaceRating ?? 1000}</p>
                                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{getRatingLabel(currentUser.forkspaceRating)}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 grid grid-cols-3 gap-2.5 text-center text-xs">
                                                    <div className="rounded-xl bg-white px-2 py-2.5 dark:bg-slate-950">
                                                        <p className="font-semibold text-gray-900 dark:text-white">{currentUser.totalSessions ?? 0}</p>
                                                        <p className="text-gray-500">sessions</p>
                                                    </div>
                                                    <div className="rounded-xl bg-white px-2 py-2.5 dark:bg-slate-950">
                                                        <p className="font-semibold text-gray-900 dark:text-white">{currentUser.problemsAttempted ?? 0}</p>
                                                        <p className="text-gray-500">problems</p>
                                                    </div>
                                                    <div className="rounded-xl bg-white px-2 py-2.5 dark:bg-slate-950">
                                                        <p className="font-semibold text-gray-900 dark:text-white">{currentUser.currentStreak ?? 0} 🔥</p>
                                                        <p className="text-gray-500">streak</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {(currentUser.titles || []).slice(0, 3).map((title) => (
                                                        <span key={title} className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{title}</span>
                                                    ))}
                                                    {(currentUser.titles || []).length > 3 ? (
                                                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200">+{(currentUser.titles || []).length - 3} more</span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-4 grid grid-cols-12 gap-1.5">
                                                    {buildActivityGrid(currentUser.activityLog).map((cell) => (
                                                        <span key={cell.key} className={`h-3 rounded-[4px] border ${cell.active ? 'border-amber-400 bg-amber-400/90' : 'border-gray-300 bg-transparent dark:border-gray-700'}`} title={cell.key} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-b border-gray-100 px-2 pb-3 dark:border-gray-700">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Theme and account</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Switch the look or sign in to save rooms.</p>
                                        </div>
                                    )}

                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {themeOptions.map((option) => {
                                            const Icon = option.icon;
                                            return (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    onClick={() => setTheme(option.key)}
                                                    data-cursor="button"
                                                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs transition ${
                                                        theme === option.key
                                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    <Icon size={14} />
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3 space-y-1">
                                        {currentUser ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
                                                    data-cursor="button"
                                                    className={`block w-full rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                                                        isAvatarPickerOpen
                                                            ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-500/10 dark:text-amber-200'
                                                            : 'border-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {isAvatarPickerOpen ? 'Avatar options open' : 'Update avatar'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleScrollToJoin}
                                                    data-cursor="button"
                                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                                >
                                                    Continue to room
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSignOut}
                                                    data-cursor="button"
                                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                                >
                                                    Sign Out
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleScrollToAuth}
                                                data-cursor="button"
                                                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                            >
                                                Sign in to save rooms
                                            </button>
                                        )}
                                    </div>
                                    {currentUser && isAvatarPickerOpen && (
                                        <div ref={avatarPickerRef} className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                                            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                                Choose avatar
                                            </p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {AVATARS.map((avatar) => {
                                                    const isActive = currentUser.avatarId === avatar.id;
                                                    return (
                                                        <button
                                                            key={avatar.id}
                                                            type="button"
                                                            onClick={() => handleAvatarUpdate(avatar.id)}
                                                            data-cursor="button"
                                                            disabled={isAvatarSaving}
                                                            className={`flex h-12 items-center justify-center rounded-xl border transition ${
                                                                isActive
                                                                    ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm dark:bg-amber-500/10 dark:text-amber-300'
                                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-gray-700'
                                                            } ${isAvatarSaving ? 'cursor-not-allowed opacity-70' : ''}`}
                                                            title={avatar.name}
                                                        >
                                                            <AvatarGlyph avatar={avatar} className="h-4 w-4" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-3 grid grid-cols-4 gap-2">
                                                {PROFILE_AVATARS.map((avatar) => (
                                                    <button
                                                        key={avatar.key}
                                                        type="button"
                                                        onClick={() => handleProfileUpdate({ avatar: avatar.key })}
                                                        data-cursor="button"
                                                        className={`rounded-xl border px-2 py-2 text-lg transition ${
                                                            currentUser.avatar === avatar.key
                                                                ? 'border-amber-400 bg-amber-50 shadow-sm dark:bg-amber-500/10'
                                                                : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50 dark:border-gray-700 dark:bg-slate-900'
                                                        }`}
                                                    >
                                                        {avatar.emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen((prev) => !prev)}
                            data-cursor="button"
                            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 dark:hover:bg-gray-800"
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
            </div>

            {isMenuOpen && (
                <div className="md:hidden">
                    <div className="space-y-2 border-t border-gray-200 bg-white px-4 pb-4 pt-3 dark:border-gray-700 dark:bg-gray-900">
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('how-it-works')}
                            data-cursor="button"
                            className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            How It Works
                        </button>
                        <button
                            type="button"
                            onClick={() => handleScrollToSection('use-cases')}
                            data-cursor="button"
                            className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            Use Cases
                        </button>
                        <button
                            type="button"
                            onClick={handleScrollToJoin}
                            data-cursor="button"
                            className="block w-full rounded-xl bg-amber-500 px-3 py-2 text-left text-base font-semibold text-slate-950 transition hover:bg-amber-400"
                        >
                            Start a Room
                        </button>

                        <div className="rounded-2xl border border-gray-200 px-3 py-3 dark:border-gray-700">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Theme</p>
                            <div className="mt-3 flex items-center gap-2">
                                {themeOptions.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => setTheme(option.key)}
                                            data-cursor="button"
                                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                                                theme === option.key
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <Icon size={14} />
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {currentUser ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleScrollToJoin}
                                    data-cursor="button"
                                    className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                >
                                    Continue as {currentUser.name}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    data-cursor="button"
                                    className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleScrollToAuth}
                                data-cursor="button"
                                className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                            >
                                Sign in to save rooms
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}

export default Navbar;
