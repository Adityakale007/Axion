import { useEffect, useRef } from 'react';

function motionReduced() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function useCardTilt(maxTilt = 4) {
    const ref = useRef(null);

    useEffect(() => {
        const node = ref.current;
        if (!node || typeof window === 'undefined' || motionReduced() || ('ontouchstart' in window)) return undefined;

        const handleMove = (event) => {
            const rect = node.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            const rotateY = x * maxTilt * 2;
            const rotateX = -y * maxTilt * 2;
            node.style.transition = 'none';
            node.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        };

        const handleLeave = () => {
            node.style.transition = 'transform 300ms ease';
            node.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
        };

        const handleEnter = () => {
            node.style.transition = 'none';
        };

        node.addEventListener('mousemove', handleMove);
        node.addEventListener('mouseleave', handleLeave);
        node.addEventListener('mouseenter', handleEnter);

        return () => {
            node.removeEventListener('mousemove', handleMove);
            node.removeEventListener('mouseleave', handleLeave);
            node.removeEventListener('mouseenter', handleEnter);
        };
    }, [maxTilt]);

    return ref;
}
