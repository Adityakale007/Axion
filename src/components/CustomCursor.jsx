import { useEffect, useRef, useState } from "react";

function supportsTouch() {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hoverButton, setHoverButton] = useState(false);
  const [hoverEditor, setHoverEditor] = useState(false);

  const ringRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);

  const [ringPos, setRingPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    setEnabled(!supportsTouch());

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const handleChange = (e) => setReducedMotion(e.matches);

    if (mq.addEventListener) {
      mq.addEventListener("change", handleChange);
    } else {
      mq.addListener(handleChange);
    }

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handleChange);
      } else {
        mq.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;

      setMouse({ x, y });

      // Show cursor only after first movement
      if (!visible) {
        setVisible(true);
        ringRef.current = { x, y };
        setRingPos({ x, y });
      }

      const target =
        e.target instanceof Element ? e.target : null;

      setHoverButton(
        !!target?.closest(
          "button, a, [role='button'], input[type='submit']"
        )
      );

      setHoverEditor(
        !!target?.closest(
          ".monaco-editor, pre, code, textarea, [data-cursor='editor']"
        )
      );
    };

    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    window.addEventListener("mousemove", handleMove, {
      passive: true,
    });

    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("mouseenter", handleEnter);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("mouseenter", handleEnter);
    };
  }, [enabled, visible]);

  useEffect(() => {
    if (!enabled || reducedMotion || !visible) return;

    const animate = () => {
      ringRef.current.x +=
        (mouse.x - ringRef.current.x) * 0.35;

      ringRef.current.y +=
        (mouse.y - ringRef.current.y) * 0.35;

      setRingPos({
        x: ringRef.current.x,
        y: ringRef.current.y,
      });

      animationRef.current =
        requestAnimationFrame(animate);
    };

    animationRef.current =
      requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, reducedMotion, visible, mouse]);

  if (!enabled || !visible) return null;

  const accent = hoverEditor ? "#00ff88" : "#00e5ff";
  const ringSize = hoverButton ? 42 : 28;

  return (
    <>
      {/* Neon Glow */}
      {!reducedMotion && (
        <div
          className="pointer-events-none fixed left-0 top-0 z-[9997]"
          style={{
            width: `${ringSize + 20}px`,
            height: `${ringSize + 20}px`,
            borderRadius: "9999px",
            transform: `translate3d(
              ${ringPos.x - (ringSize + 20) / 2}px,
              ${ringPos.y - (ringSize + 20) / 2}px,
              0
            )`,
            background: `radial-gradient(
              circle,
              ${accent}66 0%,
              ${accent}22 40%,
              transparent 75%
            )`,
            filter: "blur(14px)",
            willChange: "transform",
          }}
        />
      )}

      {/* Neon Ring */}
      <div
        className="pointer-events-none fixed left-0 top-0 z-[9998]"
        style={{
          width: `${ringSize}px`,
          height: `${ringSize}px`,
          borderRadius: "9999px",
          border: `1.5px solid ${accent}`,
          transform: `translate3d(
            ${ringPos.x - ringSize / 2}px,
            ${ringPos.y - ringSize / 2}px,
            0
          )`,
          boxShadow: `
            0 0 6px ${accent},
            0 0 14px ${accent},
            0 0 30px ${accent}99
          `,
          transition:
            "width 180ms ease, height 180ms ease, border-color 180ms ease",
          willChange: "transform",
        }}
      />

      {/* Crosshair Horizontal */}
      <div
        className="pointer-events-none fixed left-0 top-0 z-[9999]"
        style={{
          width: "14px",
          height: "1px",
          background: accent,
          transform: `translate3d(${mouse.x - 7}px, ${mouse.y}px, 0)`,
          boxShadow: `0 0 8px ${accent}`,
        }}
      />

      {/* Crosshair Vertical */}
      <div
        className="pointer-events-none fixed left-0 top-0 z-[9999]"
        style={{
          width: "1px",
          height: "14px",
          background: accent,
          transform: `translate3d(${mouse.x}px, ${mouse.y - 7}px, 0)`,
          boxShadow: `0 0 8px ${accent}`,
        }}
      />

      {/* Center Dot */}
      <div
        className="pointer-events-none fixed left-0 top-0 z-[10000]"
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "9999px",
          background: accent,
          transform: `translate3d(${mouse.x - 3}px, ${mouse.y - 3}px, 0)`,
          boxShadow: `
            0 0 5px ${accent},
            0 0 10px ${accent},
            0 0 20px ${accent},
            0 0 40px ${accent}
          `,
          willChange: "transform",
        }}
      />
    </>
  );
}