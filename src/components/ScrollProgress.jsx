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
        height: 3,
        zIndex: 9998,
        backgroundColor: 'rgba(0, 212, 255, 0.08)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #1E90FF, #00D4FF 55%, #00F5FF)',
          transition: 'width 100ms linear',
          boxShadow: '0 0 8px rgba(0,212,255,0.7), 0 0 16px rgba(0,245,255,0.35)',
        }}
      />
    </div>
  );
}