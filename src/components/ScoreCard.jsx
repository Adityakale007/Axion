import React, { forwardRef } from 'react';

const ScoreCard = forwardRef(({ score, verdict, problemTitle, language, timeComplexity, spaceComplexity, bugCount, percentile }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: '800px',
        height: '420px',
        backgroundColor: '#0f172a',
        border: '1px solid #f59e0b4d',
        display: 'flex',
        flexDirection: 'row',
        padding: '40px',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        position: 'absolute',
        top: '-10000px',
        left: '-10000px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        zIndex: -100
      }}
    >
      {/* Simplified background - use solid color circles instead of blurs */}
      <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '300px', height: '300px', borderRadius: '50%', backgroundColor: '#f59e0b0d', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '300px', height: '300px', borderRadius: '50%', backgroundColor: '#10b9810d', zIndex: 0 }} />

      {/* LEFT HALF */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.1)', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#f59e0b', letterSpacing: '-0.02em' }}>ForkSpace</h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>Solution Analyser</p>
        </div>

        <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '8px solid rgba(245, 158, 11, 0.1)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '8px solid #f59e0b' }} />
          <div style={{ fontSize: '64px', fontWeight: '900', color: 'white', position: 'relative', zIndex: 2 }}>{score}</div>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center', maxWidth: '300px' }}>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f59e0b' }}>{verdict || 'Analysis Complete'}</p>
        </div>
      </div>

      {/* RIGHT HALF */}
      <div style={{ flex: 1.2, paddingLeft: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '32px' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', tracking: '0.15em', marginBottom: '8px' }}>Problem</p>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'white', lineHeight: '1.2' }}>{problemTitle || 'Custom Solution'}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Language</p>
            <span style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: '#cbd5e1' }}>{language || 'Unknown'}</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Bugs Detected</p>
            <span style={{ display: 'inline-block', backgroundColor: bugCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: bugCount > 0 ? '#f87171' : '#4ade80' }}>{bugCount} issues</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Time Complexity</p>
            <span style={{ display: 'inline-block', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: '#f59e0b' }}>{timeComplexity || 'O(?)'}</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Space Complexity</p>
            <span style={{ display: 'inline-block', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: '#60a5fa' }}>{spaceComplexity || 'O(?)'}</span>
          </div>
        </div>

        {percentile && (
          <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#f59e0b', fontSize: '18px' }}>🎯</span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#cbd5e1' }}>{percentile}</p>
          </div>
        )}

        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontWeight: '500' }}>Analyse your solution at: <span style={{ color: '#64748b' }}>fork-space.vercel.app/analyse</span></p>
        </div>
      </div>
    </div>
  );
});

export default ScoreCard;
