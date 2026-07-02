import { useEffect, useRef } from 'react';

function motionReduced() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function useCursorGlow(ref) {
    const targetRef = useRef({ x: 0, y: 0 });
    const currentRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(null);

    useEffect(() => {
        const node = ref.current;
        if (!node || motionReduced()) {
            node?.style.removeProperty('--glow-x');
            node?.style.removeProperty('--glow-y');
            return undefined;
        }

        const handleMove = (event) => {
            const rect = node.getBoundingClientRect();
            targetRef.current = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            };
        };

        const animate = () => {
            currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.08;
            currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.08;
            node.style.setProperty('--glow-x', `${currentRef.current.x}px`);
            node.style.setProperty('--glow-y', `${currentRef.current.y}px`);
            rafRef.current = window.requestAnimationFrame(animate);
        };

        node.addEventListener('mousemove', handleMove, { passive: true });
        node.addEventListener('mouseenter', handleMove, { passive: true });
        rafRef.current = window.requestAnimationFrame(animate);

        return () => {
            node.removeEventListener('mousemove', handleMove);
            node.removeEventListener('mouseenter', handleMove);
            if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
        };
    }, [ref]);
}
