import { useEffect, useRef, useState } from 'react';

function supportsTouch() {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CustomCursor() {
    const [enabled, setEnabled] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [mouseX, setMouseX] = useState(0);
    const [mouseY, setMouseY] = useState(0);
    const [ringX, setRingX] = useState(0);
    const [ringY, setRingY] = useState(0);
    const [hoverState, setHoverState] = useState({
        isHoveringButton: false,
        isHoveringEditor: false,
        isHoveringCard: false,
    });

    const mouseTargetRef = useRef({ x: 0, y: 0 });
    const ringRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const nextReduced = prefersReducedMotion();
        setReducedMotion(nextReduced);
        setEnabled(!supportsTouch());

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleMotionChange = (event) => setReducedMotion(event.matches);

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleMotionChange);
        } else {
            mediaQuery.addListener(handleMotionChange);
        }

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleMotionChange);
            } else {
                mediaQuery.removeListener(handleMotionChange);
            }
        };
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;

        const handleMouseMove = (event) => {
            const x = event.clientX;
            const y = event.clientY;
            mouseTargetRef.current = { x, y };
            setMouseX(x);
            setMouseY(y);

            const target = event.target instanceof Element ? event.target : null;
            setHoverState({
                isHoveringButton: Boolean(target?.closest('[data-cursor="button"], button, a, [role="button"]')),
                isHoveringEditor: Boolean(target?.closest('[data-cursor="editor"]')),
                isHoveringCard: Boolean(target?.closest('[data-cursor="card"]')),
            });
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [enabled]);

    useEffect(() => {
        if (!enabled || reducedMotion) return undefined;

        const animate = () => {
            ringRef.current.x += (mouseTargetRef.current.x - ringRef.current.x) * 0.12;
            ringRef.current.y += (mouseTargetRef.current.y - ringRef.current.y) * 0.12;
            setRingX(ringRef.current.x);
            setRingY(ringRef.current.y);
            rafRef.current = window.requestAnimationFrame(animate);
        };

        rafRef.current = window.requestAnimationFrame(animate);
        return () => {
            if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
        };
    }, [enabled, reducedMotion]);

    useEffect(() => {
        if (!enabled || !reducedMotion) return;
        setRingX(mouseX);
        setRingY(mouseY);
    }, [enabled, reducedMotion, mouseX, mouseY]);

    if (!enabled) return null;

    const ringSize = hoverState.isHoveringButton ? 36 : hoverState.isHoveringCard ? 20 : 24;
    const ringOpacity = hoverState.isHoveringButton ? 1 : hoverState.isHoveringCard ? 0.4 : 0.6;
    const ringColor = hoverState.isHoveringEditor ? '#10b981' : '#f59e0b';

    return (
        <>
            {!reducedMotion ? (
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed left-0 top-0 z-[9999]"
                    style={{
                        width: `${ringSize}px`,
                        height: `${ringSize}px`,
                        borderRadius: '9999px',
                        border: `1.5px solid ${ringColor}`,
                        opacity: ringOpacity,
                        transform: `translate3d(${ringX - ringSize / 2}px, ${ringY - ringSize / 2}px, 0)`,
                        transition: 'width 200ms ease, height 200ms ease, opacity 200ms ease, border-color 200ms ease',
                        willChange: 'transform, width, height, opacity',
                    }}
                />
            ) : null}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed left-0 top-0 z-[9999]"
                style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '9999px',
                    background: hoverState.isHoveringEditor ? '#10b981' : 'var(--cursor-color, #f59e0b)',
                    transform: `translate3d(${mouseX - 2}px, ${mouseY - 2}px, 0)`,
                        willChange: 'transform',
                }}
            />
        </>
    );
}
