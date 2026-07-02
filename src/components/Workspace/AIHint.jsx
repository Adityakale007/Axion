import axios from "axios";
import { useState, useRef } from "react";
import toast from "react-hot-toast";

export default function useAIHint(editorRef, socketRef, roomId) {
  const rawServerUrl = (import.meta.env.VITE_SERVER_URL || window.location.origin).trim();
  const serverUrl = (rawServerUrl.includes(":5173") && !import.meta.env.VITE_SERVER_URL) 
    ? rawServerUrl.replace(":5173", ":5000") 
    : rawServerUrl;

  const [ghostHint, setGhostHint] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [aiHints, setAiHints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const ghostMarkerRef = useRef(null);
  const hasShownAiError = useRef(false);

  const notifyAiUnavailable = (message) => {
    if (!hasShownAiError.current) {
      toast.error(message);
      hasShownAiError.current = true;
    }
  };

  const showGhostHint = (hint) => {
    clearGhostHint();
    setGhostHint(hint);

    const cm = editorRef.current;
    if (!cm) return;

    const cursor = cm.getCursor();

    ghostMarkerRef.current = cm.setBookmark(cursor, {
      widget: (() => {
        const span = document.createElement("span");
        span.style.opacity = "0.5";
        span.style.color = "#999";
        span.style.fontFamily = "monospace";
        span.style.pointerEvents = "none";
        span.textContent = hint;
        return span;
      })(),
    });
  };

  const acceptGhostHint = () => {
    if (!ghostHint) return;
    const cm = editorRef.current;
    if (!cm) return;

    cm.replaceSelection(ghostHint);
    clearGhostHint();

    socketRef.current.emit("code-change", {
      roomId,
      code: cm.getValue(),
    });
  };

  const clearGhostHint = () => {
    if (ghostMarkerRef.current) {
      ghostMarkerRef.current.clear();
      ghostMarkerRef.current = null;
    }
    setGhostHint("");
  };

  const fetchHint = async () => {
    if (!editorRef.current) return;

    const cm = editorRef.current;
    const cursor = cm.getCursor();

    const code = cm.getValue();
    const beforeCursor = code.substring(0, cm.indexFromPos(cursor));
    const afterCursor = code.substring(cm.indexFromPos(cursor));

    try {
      const res = await axios.post(`${serverUrl}/api/ai-hint`, {
        prompt: beforeCursor,
        suffix: afterCursor,
      });

      const { hint, error, warning } = res.data;

      if (hint && hint.trim()) {
        if (error || warning) {
          notifyAiUnavailable("AI suggestions are running in fallback mode right now.");
        }
        hasShownAiError.current = false;
        showGhostHint(hint);
        return;
      }

      if (error || warning) {
        notifyAiUnavailable("AI hints are temporarily unavailable. The editor will keep working without them.");
      }
    } catch {
      notifyAiUnavailable("AI hints are unavailable right now. Check the backend and Mistral configuration.");
    }
  };

  const fetchAIHints = async () => {
    if (!editorRef.current) return;
    
    setIsLoading(true);
    setShowDropdown(true);
    
    const cm = editorRef.current;
    const code = cm.getValue();
    const cursor = cm.getCursor();
    const beforeCursor = code.substring(0, cm.indexFromPos(cursor));
    const afterCursor = code.substring(cm.indexFromPos(cursor));

    try {
      const res = await axios.post(`${serverUrl}/api/ai-hints`, {
        code: code,
        cursor: cm.indexFromPos(cursor),
        beforeCursor: beforeCursor,
        afterCursor: afterCursor,
      });

      const { hints, error, warning } = res.data;
      const nextHints = Array.isArray(hints) ? hints.filter((hint) => typeof hint === "string" && hint.trim()) : [];

      if (nextHints.length > 0) {
        if (error || warning) {
          notifyAiUnavailable("AI suggestions are running in fallback mode right now.");
        }
        hasShownAiError.current = false;
        setAiHints(nextHints);
      } else {
        setAiHints([]);
        if (error || warning) {
          setShowDropdown(false);
          notifyAiUnavailable("AI hints are temporarily unavailable. The editor will keep working without them.");
        }
      }
    } catch {
      setAiHints([]);
      setShowDropdown(false);
      notifyAiUnavailable("AI hints are unavailable right now. Check the backend and Mistral configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  const closeDropdown = () => {
    setShowDropdown(false);
    setAiHints([]);
  };

  const applyHint = (hint) => {
    if (!editorRef.current) return;
    const cm = editorRef.current;
    
    cm.replaceSelection(hint);
    closeDropdown();

    socketRef.current.emit("code-change", {
      roomId,
      code: cm.getValue(),
    });
  };

  return {
    ghostHint,
    showGhostHint,
    acceptGhostHint,
    clearGhostHint,
    fetchHint,
    showDropdown,
    aiHints,
    isLoading,
    fetchAIHints,
    closeDropdown,
    applyHint,
  };
}
