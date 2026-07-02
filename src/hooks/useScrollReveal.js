import { useEffect, useRef } from 'react';

function motionReduced() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function useScrollReveal(options = {}) {
    const ref = useRef(null);
    const threshold = options.threshold ?? 0.15;

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;

        if (motionReduced()) {
            node.classList.add('revealed');
            return undefined;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                node.classList.add('revealed');
                const items = Array.from(node.querySelectorAll('.reveal-item'));
                items.forEach((item, index) => {
                    item.style.transitionDelay = `${index * 80}ms`;
                });
                observer.unobserve(node);
            },
            {
                threshold,
                ...options,
            },
        );

        observer.observe(node);
        return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.root, options.rootMargin, threshold]);

    return ref;
}
