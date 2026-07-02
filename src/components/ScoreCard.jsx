import React, { forwardRef } from 'react';

/**
 * NOTE ON PRESERVATION:
 * This component is rendered off-screen at a fixed 800x420 box and captured
 * as an image elsewhere in the app (position: absolute; top/left: -10000px).
 * That capture contract — the ref, the fixed pixel dimensions, and every
 * existing prop — is left untouched. All new visual richness (category
 * breakdown, history, ranking, insights) is additive and fully optional:
 * if a caller only ever passes the original props, the layout degrades
 * gracefully to the same information the original card showed.
 */

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function RadialScore({ score = 0, size = 168, stroke = 10 }) {
  const numeric = clamp(Number(score) || 0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (numeric / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="scGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E90FF" />
            <stop offset="55%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#00F5FF" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#18213a"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#scGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.65))' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '52px', fontWeight: 900, color: '#EAF6FF', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {Math.round(numeric)}
        </span>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#91A8C3', marginTop: '4px' }}>
          / 100
        </span>
      </div>
    </div>
  );
}

function MetricChip({ label, value, tone = 'neutral' }) {
  const toneStyles = {
    neutral: { bg: '#18213a', border: 'rgba(0,212,255,0.16)', color: '#EAF6FF' },
    good: { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.35)', color: '#6ee7b7' },
    bad: { bg: 'rgba(255,92,138,0.1)', border: 'rgba(255,92,138,0.35)', color: '#ff9db8' },
    accent: { bg: 'rgba(0,212,255,0.1)', border: 'rgba(0,212,255,0.35)', color: '#00D4FF' },
  }[tone];

  return (
    <div>
      <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#71717a', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.12em' }}>
        {label}
      </p>
      <span
        style={{
          display: 'inline-block',
          backgroundColor: toneStyles.bg,
          border: `1px solid ${toneStyles.border}`,
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 700,
          color: toneStyles.color,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const ScoreCard = forwardRef(
  (
    {
      score,
      verdict,
      problemTitle,
      language,
      timeComplexity,
      spaceComplexity,
      bugCount,
      percentile,
      // Optional, additive props — safe to omit entirely.
      categoryBreakdown, // e.g. [{ label: 'Correctness', value: 92 }, ...]
      ranking, // e.g. { label: 'Top 8%', context: 'among peers this week' }
      improvementInsight, // e.g. 'Tighten loop invariants to cut O(n²) passes.'
    },
    ref,
  ) => {
    const hasBugs = Number(bugCount) > 0;

    return (
      <div
        ref={ref}
        style={{
          width: '800px',
          height: '420px',
          backgroundColor: '#101C34',
          backgroundImage:
            'radial-gradient(120% 140% at 10% -10%, rgba(0,212,255,0.14), transparent 55%), ' +
            'radial-gradient(90% 120% at 100% 115%, rgba(124,92,255,0.12), transparent 50%), ' +
            'linear-gradient(180deg, rgba(21,37,68,0.92) 0%, rgba(16,28,52,0.98) 100%)',
          border: '1px solid rgba(0,212,255,0.22)',
          display: 'flex',
          flexDirection: 'row',
          padding: '40px',
          color: '#EAF6FF',
          fontFamily: "'Inter', sans-serif",
          position: 'absolute',
          top: '-10000px',
          left: '-10000px',
          overflow: 'hidden',
          boxSizing: 'border-box',
          zIndex: -100,
          boxShadow: '0 0 0 1px rgba(0,212,255,0.05) inset',
        }}
      >
        {/* Ambient orbs */}
        <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '320px', height: '320px', borderRadius: '50%', backgroundColor: 'rgba(0,212,255,0.06)', filter: 'blur(2px)', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: '-120px', right: '-100px', width: '340px', height: '340px', borderRadius: '50%', backgroundColor: 'rgba(124,92,255,0.07)', zIndex: 0 }} />
        {/* Scan line accent */}
        <div style={{ position: 'absolute', top: 0, left: '40px', right: '40px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)' }} />

        {/* LEFT: primary score */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            borderRight: '1px solid rgba(0,212,255,0.14)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>AXION</h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#00D4FF', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              AI Performance Analysis
            </p>
          </div>

          <RadialScore score={score} />

          <div style={{ marginTop: '22px', textAlign: 'center', maxWidth: '300px' }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#7CD9FF' }}>
              {verdict || 'Analysis Complete'}
            </p>
          </div>

          {ranking?.label ? (
            <div
              style={{
                marginTop: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '999px',
                padding: '5px 14px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: '#c9baff',
                background: 'rgba(124,92,255,0.12)',
                border: '1px solid rgba(124,92,255,0.4)',
              }}
            >
              🏆 {ranking.label}
              {ranking.context ? (
                <span style={{ color: '#91A8C3', fontWeight: 600 }}>{ranking.context}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* RIGHT: breakdown */}
        <div style={{ flex: 1.25, paddingLeft: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: '26px' }}>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '8px' }}>
              Problem
            </p>
            <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              {problemTitle || 'Custom Solution'}
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <MetricChip label="Language" value={language || 'Unknown'} />
            <MetricChip label="Issues" value={`${bugCount} detected`} tone={hasBugs ? 'bad' : 'good'} />
            <MetricChip label="Time Complexity" value={timeComplexity || 'O(?)'} tone="accent" />
            <MetricChip label="Space Complexity" value={spaceComplexity || 'O(?)'} tone="accent" />
          </div>

          {Array.isArray(categoryBreakdown) && categoryBreakdown.length ? (
            <div style={{ marginTop: '22px' }}>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '10px' }}>
                Category breakdown
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categoryBreakdown.slice(0, 3).map((cat) => {
                  const value = clamp(Number(cat.value) || 0);
                  return (
                    <div key={cat.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '92px', fontSize: '10px', fontWeight: 700, color: '#91A8C3', flexShrink: 0 }}>
                        {cat.label}
                      </span>
                      <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: '#18213a', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${value}%`,
                            height: '100%',
                            borderRadius: '999px',
                            background: 'linear-gradient(90deg, #1E90FF, #00D4FF)',
                            boxShadow: '0 0 8px rgba(0,212,255,0.6)',
                          }}
                        />
                      </div>
                      <span style={{ width: '30px', textAlign: 'right', fontSize: '10px', fontWeight: 800, color: '#00D4FF' }}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : percentile ? (
            <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#91A8C3' }}>{percentile}</p>
            </div>
          ) : null}

          {improvementInsight ? (
            <div
              style={{
                marginTop: '18px',
                borderRadius: '10px',
                border: '1px solid rgba(124,92,255,0.3)',
                background: 'rgba(124,92,255,0.08)',
                padding: '10px 12px',
              }}
            >
              <p style={{ margin: 0, fontSize: '9px', fontWeight: 800, color: '#c9baff', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>
                Improvement insight
              </p>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#EAF6FF', lineHeight: 1.4 }}>
                {improvementInsight}
              </p>
            </div>
          ) : null}

          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(0,212,255,0.16)', paddingTop: '18px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#5b7799', fontWeight: 700 }}>
              Axion Analytics · fork-space.vercel.app
            </p>
          </div>
        </div>
      </div>
    );
  },
);

ScoreCard.displayName = 'ScoreCard';

export default ScoreCard;