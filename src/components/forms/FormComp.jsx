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
    // Theme context is still read (some parents rely on the provider being
    // consumed), but this page now commits to a single neon-navy surface —
    // matching the rest of the app — instead of a separate light palette.
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
        borderRadius: '12px',
        background: '#0b1426',
        color: '#EAF6FF',
        border: '1px solid rgba(0,212,255,0.25)',
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
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#00D4FF]/50 bg-[#00D4FF]/15">
                        <AvatarGlyph avatar={getAvatarById(randomAvatar.id)} className="h-3.5 w-3.5" />
                    </span>
                    {`You're ${randomAvatar.name} this session`}
                </span>,
                {
                duration: 3500,
                position: 'bottom-center',
                style: {
                    background: '#0b1426',
                    color: '#7CD9FF',
                    borderRadius: '12px',
                    border: '1px solid rgba(0,212,255,0.3)',
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
        <div className="flex items-center justify-center" data-theme={theme}>
            <style>{`
                .fc-shell {
                    background:
                        radial-gradient(120% 120% at 0% 0%, rgba(0,212,255,0.09), transparent 55%),
                        radial-gradient(90% 100% at 100% 100%, rgba(124,92,255,0.09), transparent 50%),
                        linear-gradient(180deg, rgba(21,37,68,0.9), rgba(11,20,38,0.98));
                    border: 1px solid rgba(0,212,255,0.22);
                    box-shadow: 0 30px 90px -28px rgba(0,212,255,0.28);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                }
                .fc-header { border-bottom: 1px solid rgba(0,212,255,0.14); }
                .fc-logo-badge {
                    background: linear-gradient(135deg, #1E90FF, #00D4FF);
                    box-shadow: 0 0 24px rgba(0,212,255,0.4);
                }
                .fc-body { background: rgba(6,10,20,0.35); }
                .fc-card {
                    background: rgba(18,34,66,0.6);
                    border: 1px solid rgba(0,212,255,0.16);
                }
                .fc-inset {
                    background: rgba(9,14,26,0.6);
                    border: 1px solid rgba(0,212,255,0.14);
                }
                .fc-eyebrow { color: #00D4FF; text-shadow: 0 0 8px rgba(0,212,255,0.35); }
                .fc-callout {
                    border: 1px solid rgba(0,212,255,0.25);
                    background: rgba(0,212,255,0.08);
                    color: #cfeaff;
                }
                .fc-toggle-btn {
                    border: 1px solid rgba(0,212,255,0.16);
                    background: rgba(9,14,26,0.55);
                    color: #91A8C3;
                    transition: border-color 180ms ease, background 180ms ease, color 180ms ease;
                }
                .fc-toggle-btn:hover { border-color: rgba(0,212,255,0.4); }
                .fc-toggle-btn[data-active="true"] {
                    border-color: rgba(0,212,255,0.55);
                    background: rgba(0,212,255,0.1);
                    color: #EAF6FF;
                    box-shadow: 0 0 0 1px rgba(0,212,255,0.2) inset;
                }
                .fc-toggle-btn-title { font-weight: 700; font-size: 0.875rem; }
                .fc-toggle-btn-title[data-active="true"] { color: #7CD9FF; }
                .fc-toggle-btn-desc { margin-top: 4px; font-size: 0.75rem; line-height: 1.5; color: #6f88a8; }
                .fc-toggle-btn-desc[data-active="true"] { color: #9fc9e8; }
                .fc-tab-wrap {
                    background: rgba(6,10,20,0.7);
                    border: 1px solid rgba(0,212,255,0.16);
                }
                .fc-tab {
                    color: #91A8C3;
                    transition: color 180ms ease, background 180ms ease;
                }
                .fc-tab[data-active="true"] {
                    background: linear-gradient(135deg, #1E90FF, #00D4FF);
                    color: #06121f;
                    box-shadow: 0 0 14px rgba(0,212,255,0.4);
                }
                .fc-input {
                    background: rgba(6,10,20,0.75);
                    border: 1px solid rgba(0,212,255,0.18);
                    color: #EAF6FF;
                    transition: border-color 180ms ease, box-shadow 180ms ease;
                }
                .fc-input::placeholder { color: #4d6584; }
                .fc-input:focus {
                    outline: none;
                    border-color: rgba(0,212,255,0.55);
                    box-shadow: 0 0 0 3px rgba(0,212,255,0.14);
                }
                .fc-primary-btn {
                    background: linear-gradient(135deg, #1E90FF, #00B8E6);
                    color: white;
                    box-shadow: 0 0 0 1px rgba(0,212,255,0.4) inset, 0 10px 26px -10px rgba(0,212,255,0.6);
                    transition: transform 180ms ease, filter 180ms ease;
                }
                .fc-primary-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .fc-primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .fc-primary-btn:focus-visible { outline: 2px solid #00F5FF; outline-offset: 2px; }
                .fc-ghost-btn {
                    border: 1px solid rgba(0,212,255,0.18);
                    background: rgba(9,14,26,0.55);
                    color: #cfeaff;
                    transition: border-color 180ms ease, background 180ms ease;
                }
                .fc-ghost-btn:hover { border-color: rgba(0,212,255,0.45); background: rgba(0,212,255,0.08); }
                .fc-badge {
                    border: 1px solid rgba(0,212,255,0.2);
                    background: rgba(9,14,26,0.6);
                    color: #91A8C3;
                }
                .fc-source-btn {
                    border: 1px solid rgba(0,212,255,0.16);
                    background: rgba(9,14,26,0.55);
                    transition: border-color 180ms ease, background 180ms ease;
                }
                .fc-source-btn:hover { border-color: rgba(0,212,255,0.4); }
                .fc-source-btn[data-active="true"] {
                    border-color: rgba(0,212,255,0.55);
                    background: rgba(0,212,255,0.1);
                    box-shadow: 0 0 0 1px rgba(0,212,255,0.2) inset;
                }
                .fc-cf-callout {
                    border: 1px solid rgba(0,212,255,0.22);
                    background: rgba(0,212,255,0.06);
                }
                .fc-recent-btn {
                    border: 1px solid rgba(0,212,255,0.1);
                    background: rgba(9,14,26,0.55);
                    transition: border-color 180ms ease, background 180ms ease;
                }
                .fc-recent-btn:hover { border-color: rgba(0,212,255,0.35); background: rgba(0,212,255,0.06); }
                .fc-decor-1 {
                    border: 1px solid rgba(0,212,255,0.14);
                    background: rgba(255,255,255,0.03);
                    backdrop-filter: blur(8px);
                }
                .fc-decor-2 { background: rgba(0,212,255,0.16); filter: blur(64px); }
            `}</style>
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

            <div className="relative w-full max-w-[32rem]">
                <div className="fc-shell overflow-hidden rounded-[1.5rem]">

                    {/* Header Section */}
                    <div className="fc-header px-6 pb-6 pt-8 text-center sm:px-8 sm:pb-8 sm:pt-10">
                        <div className="mb-5 flex items-center justify-center">
                            <div className="fc-logo-badge flex h-14 w-14 items-center justify-center rounded-2xl">
                                <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l3 3-3 3m13 0H10m8-8H4a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2z" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="mb-2 text-3xl font-black tracking-tight text-white">
                            Welcome to Axion
                        </h1>
                        <p className="text-sm font-medium text-[#91A8C3]">
                            Select your entry mode, launch a workspace, and start coding instantly.
                        </p>
                    </div>

                    <div className="fc-body space-y-4 p-5 sm:space-y-6 sm:p-8">

                        {/* Auth / Guest Entry Toggle */}
                        <div id="auth-entry" className="fc-card rounded-2xl p-4">
                            {currentUser ? (
                                <div className="space-y-3">
                                    <div className="fc-inset flex items-center justify-between gap-3 rounded-xl px-4 py-4">
                                        <div>
                                            <p className="fc-eyebrow text-[10px] font-bold uppercase tracking-widest">Signed In As</p>
                                            <p className="mt-1 text-base font-bold text-white">{currentUser.name}</p>
                                            <p className="text-xs font-medium text-[#91A8C3]">{currentUser.email}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSignOut}
                                            className="fc-ghost-btn rounded-lg px-3 py-2 text-xs font-bold"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                    <div className="fc-callout rounded-xl px-4 py-3 text-sm font-medium">
                                        Your workspace history and solution analysis will be saved to your profile.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setEntryMode('guest')}
                                            data-active={entryMode === 'guest'}
                                            className="fc-toggle-btn rounded-xl px-4 py-4 text-left"
                                        >
                                            <p className="fc-toggle-btn-title" data-active={entryMode === 'guest'}>Continue as Guest</p>
                                            <p className="fc-toggle-btn-desc" data-active={entryMode === 'guest'}>
                                                Fastest way to open a room and start collaborating.
                                            </p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEntryMode('auth')}
                                            data-active={entryMode === 'auth'}
                                            className="fc-toggle-btn rounded-xl px-4 py-4 text-left"
                                        >
                                            <p className="fc-toggle-btn-title" data-active={entryMode === 'auth'}>Sign In / Register</p>
                                            <p className="fc-toggle-btn-desc" data-active={entryMode === 'auth'}>
                                                Save rooms, build history, and track your progress.
                                            </p>
                                        </button>
                                    </div>

                                    {entryMode === 'auth' && (
                                        <div className="fc-inset rounded-xl p-4">
                                            <div className="fc-tab-wrap mb-4 flex rounded-lg p-1">
                                                {['login', 'signup'].map((mode) => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        onClick={() => setAuthMode(mode)}
                                                        data-active={authMode === mode}
                                                        className="fc-tab flex-1 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        {mode === 'login' ? 'Sign In' : 'Register'}
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
                                                        className="fc-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                                        required
                                                    />
                                                )}
                                                <input
                                                    type="email"
                                                    value={authForm.email}
                                                    onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                                                    placeholder="Email address"
                                                    className="fc-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                                    required
                                                />
                                                <input
                                                    type="password"
                                                    value={authForm.password}
                                                    onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                                                    placeholder="Password"
                                                    className="fc-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                                                    required
                                                />
                                                {authMode === 'signup' && (
                                                    <div className="pt-2">
                                                        <AvatarPicker selected={avatarId} onChange={setAvatarId} />
                                                    </div>
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={authLoading}
                                                    className="fc-primary-btn mt-2 w-full rounded-xl px-4 py-3 text-sm font-bold"
                                                >
                                                    {authLoading ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Join Workspace Form */}
                        {canShowJoinForm && (
                            <form onSubmit={joinRoom} className="fc-card space-y-6 rounded-2xl p-5 sm:p-6">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(0,212,255,0.14)] pb-4">
                                    <div>
                                        <p className="fc-eyebrow text-[10px] font-bold uppercase tracking-widest">Workspace Setup</p>
                                        <h2 className="mt-1 text-xl font-bold text-white">Configure Session</h2>
                                    </div>
                                    <span className="fc-badge rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                                        {currentUser ? 'Authenticated' : 'Guest'}
                                    </span>
                                </div>

                                <div className="space-y-2.5">
                                    <label htmlFor="roomId" className="block text-xs font-bold uppercase tracking-wider text-[#91A8C3]">
                                        Workspace ID
                                    </label>
                                    <input
                                        type="text"
                                        id="roomId"
                                        ref={roomIdRef}
                                        placeholder="Enter or generate ID"
                                        className="fc-input w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
                                        required
                                    />
                                </div>

                                <div className="space-y-2.5">
                                    <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-[#91A8C3]">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        id="username"
                                        ref={usernameRef}
                                        placeholder="How others will see you"
                                        className="fc-input w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
                                        required
                                    />
                                </div>

                                <div className="space-y-2.5">
                                    <span className="block text-xs font-bold uppercase tracking-wider text-[#91A8C3]">
                                        Challenge Source
                                    </span>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setProblemSource('manual');
                                                setCfInternalProblemId('');
                                            }}
                                            data-active={problemSource === 'manual'}
                                            className="fc-source-btn rounded-xl px-4 py-3 text-left"
                                        >
                                            <p className={`text-sm font-bold ${problemSource === 'manual' ? 'text-[#7CD9FF]' : 'text-[#cfeaff]'}`}>Manual Setup</p>
                                            <p className={`mt-0.5 text-[11px] font-medium ${problemSource === 'manual' ? 'text-[#9fc9e8]' : 'text-[#6f88a8]'}`}>
                                                Paste your own prompt & I/O
                                            </p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setProblemSource('codeforces')}
                                            data-active={problemSource === 'codeforces'}
                                            className="fc-source-btn rounded-xl px-4 py-3 text-left"
                                        >
                                            <p className={`text-sm font-bold ${problemSource === 'codeforces' ? 'text-[#7CD9FF]' : 'text-[#cfeaff]'}`}>Codeforces</p>
                                            <p className={`mt-0.5 text-[11px] font-medium ${problemSource === 'codeforces' ? 'text-[#9fc9e8]' : 'text-[#6f88a8]'}`}>
                                                Import from standard catalog
                                            </p>
                                        </button>
                                    </div>
                                    {problemSource === 'codeforces' && (
                                        <div className="fc-cf-callout mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
                                            <span className="text-xs font-semibold text-[#9fe8ff]">
                                                {cfInternalProblemId
                                                    ? `Selected: ${cfInternalProblemId}`
                                                    : 'No problem selected yet.'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowCfPicker(true)}
                                                className="fc-primary-btn rounded-lg px-3 py-1.5 text-xs font-bold"
                                            >
                                                Browse Catalog
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2.5">
                                        <label htmlFor="sessionMode" className="block text-xs font-bold uppercase tracking-wider text-[#91A8C3]">
                                            Session Mode
                                        </label>
                                        <select
                                            id="sessionMode"
                                            ref={sessionModeRef}
                                            defaultValue="peer_practice"
                                            className="fc-input w-full appearance-none rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                                        >
                                            <option value="peer_practice">Peer Practice</option>
                                            <option value="mock_interview">Mock Interview</option>
                                            <option value="mentoring">Mentoring</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2.5">
                                        <label htmlFor="role" className="block text-xs font-bold uppercase tracking-wider text-[#91A8C3]">
                                            Your Role
                                        </label>
                                        <select
                                            id="role"
                                            ref={roleRef}
                                            defaultValue="Peer"
                                            className="fc-input w-full appearance-none rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                                        >
                                            <option>Peer</option>
                                            <option>Candidate</option>
                                            <option>Interviewer</option>
                                            <option>Learner</option>
                                            <option>Mentor</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid gap-3 pt-2 sm:grid-cols-[1fr_auto]">
                                    <button
                                        type="submit"
                                        className="fc-primary-btn w-full rounded-xl px-4 py-3.5 text-sm font-bold"
                                    >
                                        Launch Workspace
                                    </button>

                                    <button
                                        type="button"
                                        onClick={generateRoomId}
                                        className="fc-ghost-btn rounded-xl px-5 py-3.5 text-sm font-bold"
                                    >
                                        Generate ID
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Recent Rooms Section */}
                        {currentUser && (
                            <div className="fc-card rounded-2xl p-5">
                                <div className="mb-4 flex items-center justify-between">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#91A8C3]">Recent Workspaces</p>
                                    {historyLoading && <span className="text-[10px] font-bold uppercase tracking-widest text-[#00D4FF]">Loading...</span>}
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
                                                className="fc-recent-btn group flex w-full flex-col items-start rounded-xl px-4 py-3 text-left"
                                            >
                                                <p className="font-mono text-xs font-bold text-[#EAF6FF] transition-colors group-hover:text-[#00D4FF]">
                                                    {room.roomId}
                                                </p>
                                                <p className="mt-1 truncate text-xs font-medium text-[#91A8C3]">
                                                    {room.problemTitle || 'Untitled Practice Problem'}
                                                </p>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-[rgba(0,212,255,0.2)] bg-[rgba(9,14,26,0.5)] py-6 text-center">
                                            <p className="text-xs font-medium text-[#91A8C3]">
                                                Your saved rooms will appear here.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="fc-decor-1 absolute -left-6 top-12 hidden h-16 w-16 rounded-[1.5rem] sm:block"></div>
                <div className="fc-decor-2 absolute -right-6 top-24 hidden h-32 w-32 rounded-full sm:block"></div>
            </div>
        </div>
    );
}

export default FormComp;