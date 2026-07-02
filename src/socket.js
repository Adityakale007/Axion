import { io } from "socket.io-client";


export async function connectSocket() {
    const envServerUrl = (import.meta.env.VITE_SERVER_URL || "").trim();
    const isLocalBrowserHost =
        typeof window !== "undefined" &&
        ["localhost", "127.0.0.1"].includes(window.location.hostname);

    let serverUrl = envServerUrl || (typeof window !== "undefined" ? window.location.origin : "");

    // In local dev on Windows, localhost can intermittently resolve in ways that break WS.
    // Prefer IPv4 loopback explicitly when targeting the local backend.
    if (!envServerUrl && isLocalBrowserHost) {
        serverUrl = `${window.location.protocol}//127.0.0.1:5000`;
    } else if (serverUrl.includes("localhost:5000")) {
        serverUrl = serverUrl.replace("localhost:5000", "127.0.0.1:5000");
    } else if (!envServerUrl && serverUrl.includes(":5173")) {
        serverUrl = serverUrl.replace(":5173", ":5000");
    }

    const socketOptions = {
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ["polling", "websocket"],
        upgrade: true,
        rememberUpgrade: true,
    };

    return io(serverUrl, socketOptions);
};
