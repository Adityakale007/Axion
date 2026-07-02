import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useLocation } from 'react-router';
import axios from 'axios';
import Sidebar from '../components/sidebar/Sidebar';
import Workspace from '../components/Workspace/Workspace';
import { connectSocket } from '../socket';
import toast from 'react-hot-toast';
import { getAuthToken } from '../lib/auth';
import { getRandomAvatar } from '../lib/avatars';

const SIDEBAR_WIDTH_KEY = 'forkspace.sidebarWidth';
const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 500;
const SIDEBAR_DEFAULT = 360;

function readInitialSidebarWidth() {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!raw) return SIDEBAR_DEFAULT;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) return n;
  } catch {
    /* ignore */
  }
  return SIDEBAR_DEFAULT;
}

function Editor() {
  const socketRef = useRef(null);
  const { roomId } = useParams();
  const { state } = useLocation();
  const enteredUsername = state?.username;
  const enteredRole = state?.role || 'Peer';
  const enteredSessionMode = state?.sessionMode || 'peer_practice';
  const enteredProblemSource = state?.problemSource || 'manual';
  const enteredCfProblemId = state?.cfInternalProblemId || '';
  const enteredAvatarId = state?.avatarId || getRandomAvatar().id;
  const serverUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
  const [socketConnected, setSocketConnected] = useState(false);
  const [users, setUsers] = useState([]); // Add this to track users
  const [roomState, setRoomState] = useState(null);
  const [currentSocketId, setCurrentSocketId] = useState('');
  const hasShownConnectionError = useRef(false);
  const hasShownRoomEntryToast = useRef(false);
  const username = enteredUsername || 'Anonymous';

  const [sidebarWidth, setSidebarWidth] = useState(readInitialSidebarWidth);
  const [isLg, setIsLg] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;
  const sidebarResizeRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsLg(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const onSidebarResizeStart = useCallback((event) => {
    event.preventDefault();
    sidebarResizeRef.current = {
      startX: event.clientX,
      startW: sidebarWidthRef.current,
    };
    const onMove = (ev) => {
      const s = sidebarResizeRef.current;
      if (!s) return;
      const delta = ev.clientX - s.startX;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, s.startW + delta));
      setSidebarWidth(next);
    };
    const onUp = () => {
      sidebarResizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidthRef.current));
      } catch {
        /* ignore */
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    return () => {
      /* cleanup if unmount mid-drag */
      sidebarResizeRef.current = null;
    };
  }, []);
  
  useEffect(() => {
    let cancelled = false;

    function handleErrors() {
      setSocketConnected(false);

      if (!hasShownConnectionError.current) {
        toast.error('Realtime server is unavailable. Start the backend on port 5000 and we will reconnect automatically.');
        hasShownConnectionError.current = true;
      }
    }

    const initSocket = async () => {
      if (
        enteredProblemSource === 'codeforces' &&
        enteredCfProblemId.trim() &&
        roomId
      ) {
        try {
          await axios.post(
            `${serverUrl}/api/rooms/${encodeURIComponent(roomId)}/problem-selection`,
            {
              problemSource: 'codeforces',
              internalProblemId: enteredCfProblemId.trim(),
            },
          );
        } catch (error) {
          if (!cancelled) {
            toast.error(
              error.response?.data?.error ||
                'Could not load the selected Codeforces problem. You can pick one from the sidebar.',
            );
          }
        }
      }

      if (cancelled) {
        return;
      }

      try {
        socketRef.current = await connectSocket();

        socketRef.current.on('connect_error', handleErrors);
        socketRef.current.on('connect', () => {
          setSocketConnected(true);
          setCurrentSocketId(socketRef.current.id);
          hasShownConnectionError.current = false;

          socketRef.current.emit('join', {
            roomId,
            username,
            role: enteredRole,
            avatarId: enteredAvatarId,
            authToken: getAuthToken(),
            sessionMode: enteredSessionMode,
          });
        });
        socketRef.current.on('disconnect', () => {
          setSocketConnected(false);
          setCurrentSocketId('');
        });
        socketRef.current.on('room-state', (nextRoomState) => {
          setRoomState(nextRoomState);
        });
        socketRef.current.on('language-change', ({ language }) => {
          if (!language) return;
          setRoomState((prev) => ({
            ...(prev || {}),
            language,
          }));
        });
        socketRef.current.on('problem-update', ({ problem }) => {
          setRoomState((prev) => ({
            ...(prev || {}),
            problem,
          }));
        });
        socketRef.current.on('session-update', ({ session }) => {
          setRoomState((prev) => ({
            ...(prev || {}),
            session,
          }));
        });

        socketRef.current.on('joined', ({ users, username: joinedUsername, role }) => {
          setUsers(users);
          if (!hasShownRoomEntryToast.current && joinedUsername === username) {
            toast.success(`${joinedUsername} entered the room as ${role}`);
            hasShownRoomEntryToast.current = true;
            return;
          }
          if (joinedUsername !== username) {
            toast.success(`${joinedUsername} joined as ${role}`);
          }
        });

        socketRef.current.on('left', ({ socketId, username }) => {
          toast.success(`${username} left the room`);
          setUsers((prev) => prev.filter((user) => user.socketId !== socketId));
        });
      } catch {
        if (!cancelled) {
          toast.error('Failed to connect to server');
        }
      }
    };

    initSocket();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.off('connect_error', handleErrors);
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('room-state');
        socketRef.current.off('language-change');
        socketRef.current.off('problem-update');
        socketRef.current.off('session-update');
        socketRef.current.off('joined');
        socketRef.current.off('left');
        socketRef.current.disconnect();
      }
    };
  }, [
    roomId,
    enteredRole,
    enteredSessionMode,
    enteredUsername,
    username,
    enteredProblemSource,
    enteredCfProblemId,
    enteredAvatarId,
    serverUrl,
  ]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.08),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-[15px] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.08),_transparent_22%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] lg:h-screen lg:overflow-hidden lg:flex-row">
      <aside
        className="relative w-full border-b border-white/10 bg-white/75 backdrop-blur-xl dark:bg-slate-950/55 lg:h-screen lg:shrink-0 lg:border-b-0 lg:border-r lg:border-white/10"
        style={
          isLg
            ? { width: sidebarWidth, minWidth: SIDEBAR_MIN, maxWidth: SIDEBAR_MAX }
            : undefined
        }
      >
        <Sidebar 
          socketRef={socketRef} 
          roomId={roomId} 
          socketConnected={socketConnected} 
          users={users}
          roomState={roomState}
          currentSocketId={currentSocketId}
          currentRole={enteredRole}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={onSidebarResizeStart}
          className="absolute right-0 top-0 z-30 hidden h-full w-3 translate-x-1/2 cursor-col-resize lg:block"
        >
          <div className="mx-auto h-full w-1 rounded-full bg-gray-300/80 transition hover:bg-amber-400/90 dark:bg-slate-600 dark:hover:bg-amber-500/80" />
        </div>
      </aside>
      <main className="flex min-h-[60vh] min-w-0 flex-1 flex-col bg-transparent lg:min-h-0 lg:h-screen">
        {socketConnected ? (
          <Workspace
            socketRef={socketRef}
            roomId={roomId}
            roomState={roomState}
            currentSocketId={currentSocketId}
            currentRole={enteredRole}
            currentUsername={username}
            users={users}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 py-16">
            <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white/88 p-8 text-center shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-500/10 dark:text-amber-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V6.75a3.75 3.75 0 117.5 0V9m-8.25 0h8.5A2.25 2.25 0 0118.25 11.25v6.5A2.25 2.25 0 0116 20H8a2.25 2.25 0 01-2.25-2.25v-6.5A2.25 2.25 0 018 9z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Connecting to your practice room</h1>
              <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-400">
                The interview workspace will appear as soon as the realtime server on port 5000 responds. Keep `npm run dev:server` running and this page will reconnect automatically.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Editor;
