import { useEffect } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import toast from "react-hot-toast";

function NewRoomRedirect() {
  const navigate = useNavigate();
  const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
  const serverUrl =
    rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL
      ? rawServerUrl.replace(":5173", ":5000")
      : rawServerUrl;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${serverUrl}/api/rooms/new`);
        if (cancelled) return;
        const roomId = String(data?.roomId || "").trim();
        if (!roomId) {
          throw new Error("Could not create a room");
        }
        navigate(`/room/${roomId}`, {
          replace: true,
          state: {
            username: "Guest",
            role: "Peer",
            sessionMode: "peer_practice",
          },
        });
      } catch (error) {
        if (cancelled) return;
        toast.error(error?.response?.data?.error || error?.message || "Could not create room");
        navigate("/", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, serverUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] px-6">
      <p className="text-sm font-medium text-slate-300">Creating your room…</p>
    </div>
  );
}

export default NewRoomRedirect;
