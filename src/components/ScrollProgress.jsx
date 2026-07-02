import { useEffect, useState } from 'react';

export default function ScrollProgress() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const handler = () => {
            const total = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
        };

        handler();
        window.addEventListener('scroll', handler, { passive: true });
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('scroll', handler);
            window.removeEventListener('resize', handler);
        };
    }, []);

    return (
        <div
            aria-hidden="true"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                zIndex: 9998,
                backgroundColor: 'transparent',
                pointerEvents: 'none',
            }}
        >
            <div
                style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #10b981)',
                    transition: 'width 100ms linear',
                    boxShadow: '0 0 6px rgba(245,158,11,0.5)',
                }}
            />
        </div>
    );
}
