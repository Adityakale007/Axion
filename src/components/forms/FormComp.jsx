import { useRef, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ThemeContext } from '../../../Context/ThemeContext';
import { clearAuthToken, getAuthHeaders, getAuthToken, onAuthChange, setAuthToken } from '../../lib/auth';
import CodeforcesProblemPicker from '../codeforces/CodeforcesProblemPicker';
import AvatarPicker from '../common/AvatarPicker';
import AvatarGlyph from '../common/AvatarGlyph';
import { getAvatarById, getRandomAvatar } from '../../lib/avatars';

function FormComp() {
    const navigate = useNavigate();
    const roomIdRef = useRef(null);
    const usernameRef = useRef(null);
    const roleRef = useRef(null);
    const sessionModeRef = useRef(null);
    const { theme } = useContext(ThemeContext);
    const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
    const serverUrl =
        rawServerUrl.includes(':5173') && !import.meta.env.VITE_SERVER_URL
            ? rawServerUrl.replace(':5173', ':5000')
            : rawServerUrl;
    const [authMode, setAuthMode] = useState('login');
    const [entryMode, setEntryMode] = useState('guest');
    const [authLoading, setAuthLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [history, setHistory] = useState({ rooms: [], runs: [] });
    const [problemSource, setProblemSource] = useState('manual');
    const [cfInternalProblemId, setCfInternalProblemId] = useState('');
    const [showCfPicker, setShowCfPicker] = useState(false);
    const [authForm, setAuthForm] = useState({
        name: '',
        email: '',
        password: '',
    });
    const [avatarId, setAvatarId] = useState('clever-fox');

    const toastStyle = {
        borderRadius: '10px',
        background: theme === 'dark' ? '#1f2937' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
    };

    const loadHistory = useCallback(async () => {
        const token = getAuthToken();

        if (!token) {
            setCurrentUser(null);
            setHistory({ rooms: [], runs: [] });
            return;
        }

        setHistoryLoading(true);

        try {
            const [meResponse, historyResponse] = await Promise.all([
                axios.get(`${serverUrl}/api/auth/me`, {
                    headers: getAuthHeaders(),
                }),
                axios.get(`${serverUrl}/api/auth/history`, {
                    headers: getAuthHeaders(),
                }),
            ]);

            setCurrentUser(meResponse.data.user);
            setHistory(historyResponse.data);
        } catch {
            clearAuthToken();
            setCurrentUser(null);
            setHistory({ rooms: [], runs: [] });
        } finally {
            setHistoryLoading(false);
        }
    }, [serverUrl]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    useEffect(() => onAuthChange(loadHistory), [loadHistory]);

    useEffect(() => {
        if (currentUser) {
            setEntryMode('auth');
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && usernameRef.current && !usernameRef.current.value) {
            usernameRef.current.value = currentUser.name;
        }
    }, [currentUser]);

    const generateRoomId = (event) => {
        event.preventDefault();
        const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();

        if (roomIdRef.current) {
            roomIdRef.current.value = roomId;
            roomIdRef.current.focus();
        }

        toast.success('Room ID generated successfully!', { style: toastStyle });
    };

    const joinRoom = (event) => {
        event.preventDefault();

        const roomId = roomIdRef.current?.value?.trim();
        const username = usernameRef.current?.value?.trim() || currentUser?.name;
        const role = roleRef.current?.value?.trim() || 'Peer';

        if (!roomId || !username) {
            toast.error('Please enter both Room ID and Username', { style: toastStyle });
            return;
        }

        if (problemSource === 'codeforces' && !cfInternalProblemId.trim()) {
            toast.error('Choose a Codeforces problem or switch Problem source to Manual.', { style: toastStyle });
            return;
        }

        let resolvedAvatarId = currentUser?.avatarId || avatarId || 'clever-fox';
        if (!currentUser && entryMode === 'guest') {
            const randomAvatar = getRandomAvatar();
            resolvedAvatarId = randomAvatar.id;
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

        navigate(`/editor/${roomId}`, {
            state: {
                username,
                role,
                avatarId: resolvedAvatarId,
                sessionMode: sessionModeRef.current?.value?.trim() || 'peer_practice',
                problemSource,
                cfInternalProblemId:
                    problemSource === 'codeforces' ? cfInternalProblemId.trim() : undefined,
            }
        });
    };

    const handleAuthSubmit = async (event) => {
        event.preventDefault();
        setAuthLoading(true);

        try {
            const endpoint = authMode === 'signup' ? '/api/auth/register' : '/api/auth/login';
            const payload = authMode === 'signup'
                ? { ...authForm, avatarId }
                : { email: authForm.email, password: authForm.password };
            const response = await axios.post(`${serverUrl}${endpoint}`, payload);

            setAuthToken(response.data.token);
            setCurrentUser(response.data.user);
            setAuthForm({ name: '', email: '', password: '' });
            toast.success(authMode === 'signup' ? 'Account created' : 'Signed in', { style: toastStyle });
            await loadHistory();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Authentication failed', { style: toastStyle });
        } finally {
            setAuthLoading(false);
        }
    };

    const handleSignOut = () => {
        clearAuthToken();
        setCurrentUser(null);
        setHistory({ rooms: [], runs: [] });
        setEntryMode('guest');
        toast.success('Signed out', { style: toastStyle });
    };

    const canShowJoinForm = Boolean(currentUser) || entryMode === 'guest';

    return (
        <div className="flex items-center justify-center">
            <CodeforcesProblemPicker
                isOpen={showCfPicker}
                onClose={() => setShowCfPicker(false)}
                serverUrl={serverUrl}
                onSelect={(internalProblemId) => {
                    setCfInternalProblemId(internalProblemId);
                    setProblemSource('codeforces');
                    setShowCfPicker(false);
                    toast.success(`Selected ${internalProblemId}`, { style: toastStyle });
                }}
            />
            <div className="relative w-full max-w-[30rem]">
                <div className="overflow-hidden rounded-[1.5rem] border border-gray-200/90 bg-white shadow-[0_24px_80px_-46px_rgba(15,23,42,0.5)] dark:border-gray-700/80 dark:bg-gray-900">
                    <div className="border-b border-gray-100 px-5 pb-5 pt-6 text-center dark:border-gray-700 sm:px-7 sm:pb-6 sm:pt-7">
                        <div className="mb-4 flex items-center justify-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 shadow-lg dark:bg-gray-100">
                                <svg className="h-6 w-6 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m13 0H10m8-8H4a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2z" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="mb-2 text-2xl font-bold text-black dark:text-white">
                            Welcome to ForkSpace
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Pick a way in first. Then open a room and start practicing without extra setup.
                        </p>
                    </div>

                    <div className="space-y-4 p-4 sm:space-y-5 sm:p-7">
                        <div id="auth-entry" className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-slate-900/70">
                            {currentUser ? (
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Signed In</p>
                                            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{currentUser.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.email}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSignOut}
                                            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
                                        Your rooms and recent runs will stay attached to your profile.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setEntryMode('guest')}
                                            className={`rounded-2xl border px-4 py-4 text-left transition ${
                                                entryMode === 'guest'
                                                    ? 'border-gray-900 bg-gray-900 text-white shadow-lg dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                                                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:border-gray-600'
                                            }`}
                                        >
                                            <p className="text-sm font-semibold">Continue as Guest</p>
                                            <p className={`mt-1 text-xs leading-5 ${entryMode === 'guest' ? 'text-white/80 dark:text-gray-700' : 'text-gray-500 dark:text-gray-400'}`}>
                                                Fastest way to open a room and start coding together.
                                            </p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEntryMode('auth')}
                                            className={`rounded-2xl border px-4 py-4 text-left transition ${
                                                entryMode === 'auth'
                                                    ? 'border-amber-300 bg-amber-50 text-gray-900 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-white'
                                                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:border-gray-600'
                                            }`}
                                        >
                                            <p className="text-sm font-semibold">Sign in or create account</p>
                                            <p className={`mt-1 text-xs leading-5 ${entryMode === 'auth' ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                                Save rooms, keep history, and continue sessions later.
                                            </p>
                                        </button>
                                    </div>

                                    {entryMode === 'auth' && (
                                        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                            <div className="mb-4 flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
                                                {['login', 'signup'].map((mode) => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        onClick={() => setAuthMode(mode)}
                                                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                                            authMode === mode
                                                                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                                                : 'text-gray-600 dark:text-gray-300'
                                                        }`}
                                                    >
                                                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                                                    </button>
                                                ))}
                                            </div>

                                            <form onSubmit={handleAuthSubmit} className="space-y-3">
                                                {authMode === 'signup' && (
                                                    <input
                                                        type="text"
                                                        value={authForm.name}
                                                        onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                                                        placeholder="Your name"
                                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                                        required
                                                    />
                                                )}
                                                <input
                                                    type="email"
                                                    value={authForm.email}
                                                    onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                                                    placeholder="Email address"
                                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                                    required
                                                />
                                                <input
                                                    type="password"
                                                    value={authForm.password}
                                                    onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                                                    placeholder="Password"
                                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                                    required
                                                />
                                                {authMode === 'signup' && (
                                                    <AvatarPicker selected={avatarId} onChange={setAvatarId} />
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={authLoading}
                                                    className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                                                >
                                                    {authLoading ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {canShowJoinForm && (
                            <form onSubmit={joinRoom} className="space-y-5 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-slate-900/70 sm:p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Step 2</p>
                                        <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Join a practice room</h2>
                                    </div>
                                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                        {currentUser ? 'Signed-in mode' : 'Guest mode'}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="roomId" className="block text-sm font-medium text-black dark:text-gray-300">
                                        Practice Room ID
                                    </label>
                                    <input
                                        type="text"
                                        id="roomId"
                                        ref={roomIdRef}
                                        placeholder="Enter practice room ID"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:ring-gray-100"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="username" className="block text-sm font-medium text-black dark:text-gray-300">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        id="username"
                                        ref={usernameRef}
                                        placeholder="Enter your name"
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:ring-gray-100"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <span className="block text-sm font-medium text-black dark:text-gray-300">
                                        Problem source
                                    </span>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setProblemSource('manual');
                                                setCfInternalProblemId('');
                                            }}
                                            className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                                                problemSource === 'manual'
                                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                                                    : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                                            }`}
                                        >
                                            Manual
                                            <span className="mt-1 block text-xs font-normal opacity-80">
                                                Paste samples and brief like today
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setProblemSource('codeforces')}
                                            className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                                                problemSource === 'codeforces'
                                                    ? 'border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-100'
                                                    : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                                            }`}
                                        >
                                            Codeforces
                                            <span className="mt-1 block text-xs font-normal opacity-80">
                                                Pick from catalog (metadata only)
                                            </span>
                                        </button>
                                    </div>
                                    {problemSource === 'codeforces' && (
                                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                                            <span className="text-xs text-amber-900 dark:text-amber-100">
                                                {cfInternalProblemId
                                                    ? `Selected: ${cfInternalProblemId}`
                                                    : 'No problem selected yet.'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowCfPicker(true)}
                                                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
                                            >
                                                Browse catalog
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label htmlFor="sessionMode" className="block text-sm font-medium text-black dark:text-gray-300">
                                            Session Mode
                                        </label>
                                        <select
                                            id="sessionMode"
                                            ref={sessionModeRef}
                                            defaultValue="peer_practice"
                                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                        >
                                            <option value="peer_practice">Peer Practice</option>
                                            <option value="mock_interview">Mock Interview</option>
                                            <option value="mentoring">Mentoring</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="role" className="block text-sm font-medium text-black dark:text-gray-300">
                                            Session Role
                                        </label>
                                        <select
                                            id="role"
                                            ref={roleRef}
                                            defaultValue="Peer"
                                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-gray-100"
                                        >
                                            <option>Peer</option>
                                            <option>Candidate</option>
                                            <option>Interviewer</option>
                                            <option>Learner</option>
                                            <option>Mentor</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                    <button
                                        type="submit"
                                        className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:scale-[1.01] hover:bg-gray-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus:ring-gray-100 dark:focus:ring-offset-gray-800"
                                    >
                                        Join Practice Room
                                    </button>

                                    <button
                                        type="button"
                                        onClick={generateRoomId}
                                        className="rounded-xl border border-gray-200 bg-white px-4 py-3 font-medium text-black transition-all duration-200 hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                                    >
                                        Generate
                                    </button>
                                </div>
                            </form>
                        )}

                        {currentUser && (
                            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Recent rooms</p>
                                    {historyLoading && <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>}
                                </div>
                                <div className="space-y-2">
                                    {(history.rooms || []).length > 0 ? (
                                        history.rooms.slice(0, 4).map((room) => (
                                            <button
                                                key={room.roomId}
                                                type="button"
                                                onClick={() => {
                                                    if (roomIdRef.current) {
                                                        roomIdRef.current.value = room.roomId;
                                                    }
                                                    if (usernameRef.current) {
                                                        usernameRef.current.value = currentUser.name;
                                                    }
                                                }}
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                                            >
                                                <p className="font-mono text-sm text-gray-900 dark:text-white">{room.roomId}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {room.problemTitle || 'Untitled Practice Problem'}
                                                </p>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Your saved rooms will appear here after you join and work in them.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                <div className="absolute -left-6 top-10 hidden h-14 w-14 rounded-[1.5rem] border border-white/60 bg-white/20 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:block"></div>
                <div className="absolute -right-4 top-20 hidden h-24 w-24 rounded-full bg-amber-300/20 blur-2xl dark:bg-amber-400/10 sm:block"></div>
            </div>
        </div>
    );
}

export default FormComp;
