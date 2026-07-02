/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

function Spinner({ className = "h-4 w-4" }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" className="opacity-25" stroke="currentColor" strokeWidth="2.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function statusPill(test) {
  if (test.timedOut)
    return {
      label: "Timeout",
      dotClass: "hp-dot-warn",
      pillClass: "hp-pill-warn",
    };
  if (test.runtimeError)
    return {
      label: "Fault",
      dotClass: "hp-dot-fail",
      pillClass: "hp-pill-fail",
    };
  if (test.isVerified) {
    if (test.passed === true)
      return { label: "Verified Pass", dotClass: "hp-dot-pass", pillClass: "hp-pill-pass" };
    if (test.passed === false)
      return { label: "Verified Fail", dotClass: "hp-dot-fail", pillClass: "hp-pill-fail" };
  }
  return { label: "Stress Probe", dotClass: "hp-dot-info", pillClass: "hp-pill-info" };
}

function TestCard({ test, onDelete, canDelete = true, onUseAsSample }) {
  const status = statusPill(test);
  const canPromoteToSample = typeof onUseAsSample === "function" && Boolean(
    String(test.input || "").trim() && String(test.expectedOutput ?? test.actualOutput ?? "").trim(),
  );
  return (
    <div className="hp-card relative rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="hp-tag">
            {test.category || "edge"}
          </span>
          <span className="hp-tag hp-tag-bug">
            {test.bugClass || "unknown"}
          </span>
          <span className={`hp-status-pill ${status.pillClass}`}>
            <span className={`hp-status-dot ${status.dotClass}`} aria-hidden="true" />
            {status.label}
          </span>
          <span className="hp-tag hp-tag-source">
            {test.isVerified ? "Ground truth verified" : "No ground truth"}
          </span>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDelete(test.id)}
            className="hp-ghost-btn"
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-medium text-[#EAF6FF]">
        {test.description || "Generated test"}
      </p>
      <div className="mt-3 space-y-3">
        {typeof onUseAsSample === "function" ? (
          <button
            type="button"
            onClick={() => onUseAsSample(test)}
            disabled={!canPromoteToSample}
            className="hp-promote-btn"
          >
            {test.isVerified ? "Add to sample tests" : "Add using latest output"}
          </button>
        ) : null}
        {!canPromoteToSample && typeof onUseAsSample === "function" ? (
          <p className="text-[11px] text-[#6f88a8]">
            Run this test once to capture output before adding it into sample tests.
          </p>
        ) : null}
        <div className="grid gap-2 lg:grid-cols-3">
          <div className="min-w-0">
            <p className="hp-field-label">Input</p>
            <pre className="hp-code-block mt-1 max-h-32 overflow-auto">{test.input || ""}</pre>
          </div>
          {test.isVerified && test.expectedOutput != null ? (
            <div className="min-w-0">
              <p className="hp-field-label">Expected output</p>
              <pre className="hp-code-block hp-code-block-good mt-1 max-h-32 overflow-auto">{test.expectedOutput || ""}</pre>
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="hp-field-label">Actual output</p>
            <pre className="hp-code-block mt-1 max-h-32 overflow-auto">{test.actualOutput || (test.runtimeError ? "(runtime error)" : test.timedOut ? "(timeout)" : "(not run yet)")}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HiddenTestPanel({
  serverUrl,
  roomId,
  code,
  language,
  problem,
  externalGenerateSignal = 0,
  onUseAsSampleTest,
}) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [plannerWarning, setPlannerWarning] = useState("");
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [lastRunResults, setLastRunResults] = useState([]);

  const canGenerate = Boolean(
    String(problem?.prompt || problem?.pastedStatement || "").trim(),
  );

  const verified = useMemo(
    () => tests.filter((t) => t.isVerified),
    [tests],
  );
  const stress = useMemo(
    () => tests.filter((t) => !t.isVerified),
    [tests],
  );

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const { data } = await axios.get(
        `${serverUrl}/api/hidden-tests/${encodeURIComponent(roomId)}`,
      );
      setTests(data.tests || []);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load hidden tests");
    }
  }, [roomId, serverUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!externalGenerateSignal) return;
    if (!canGenerate) return;
    void generateTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalGenerateSignal]);

  const generateTests = async () => {
    if (!canGenerate) {
      toast.error("Add problem statement first");
      return;
    }
    setLoading(true);
    setPlannerWarning("");
    try {
      const { data } = await axios.post(`${serverUrl}/api/hidden-tests/generate`, {
        roomId,
      });
      setPlannerWarning(data.warning || "");
      await refresh();
      toast.success("Hidden tests generated");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to generate tests");
    } finally {
      setLoading(false);
    }
  };

  const runAll = async () => {
    if (!tests.length) return;
    if (!code?.trim()) {
      toast.error("Write code first");
      return;
    }
    setRunning(true);
    try {
      const { data } = await axios.post(`${serverUrl}/api/hidden-tests/run`, {
        roomId,
        code,
        language,
        testIds: tests.map((test) => test.id),
      });
      const updatedRows = Array.isArray(data.tests) ? data.tests : [];
      if (!updatedRows.length) {
        toast.error("Hidden tests did not return any updated results");
        return;
      }
      const updatedById = new Map(updatedRows.map((row) => [row.id, row]));
      setTests((prev) => prev.map((row) => updatedById.get(row.id) || row));
      setLastRunResults(updatedRows);
      setShowResultsModal(true);
      toast.success("Hidden tests executed");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to run hidden tests");
    } finally {
      setRunning(false);
    }
  };

  const removeTest = async (id) => {
    try {
      await axios.delete(`${serverUrl}/api/hidden-tests/${encodeURIComponent(id)}`);
      setTests((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      toast.error(error.response?.data?.error || "Delete failed");
    }
  };

  const isBusy = loading || running;

  return (
    <div className="hp-root space-y-4">
      <style>{`
        .hp-root {
          --hp-navy: #101C34;
          --hp-elevated: #152544;
          --hp-glass: rgba(18,34,66,0.65);
          --hp-border-glow: rgba(0,212,255,0.25);
          --hp-cyan: #00F5FF;
          --hp-blue: #00D4FF;
          --hp-electric: #1E90FF;
          --hp-purple: #7C5CFF;
          color: #EAF6FF;
        }
        .hp-surface {
          position: relative;
          background:
            radial-gradient(110% 140% at 0% 0%, rgba(0,212,255,0.08), transparent 55%),
            radial-gradient(90% 120% at 100% 100%, rgba(124,92,255,0.10), transparent 50%),
            linear-gradient(180deg, rgba(21,37,68,0.85), rgba(16,28,52,0.92));
          border: 1px solid var(--hp-border-glow);
          border-radius: 20px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 20px 60px -32px rgba(0,212,255,0.3);
        }
        .hp-surface[data-active="true"] {
          border-color: rgba(124,92,255,0.45);
          box-shadow: 0 0 0 1px rgba(0,212,255,0.15) inset, 0 0 50px -10px rgba(124,92,255,0.4);
        }
        .hp-surface[data-active="true"]::after {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 20px;
          padding: 1px;
          background: conic-gradient(from var(--angle, 0deg), transparent 0%, var(--hp-cyan) 12%, transparent 24%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: hp-trace 2.4s linear infinite;
          pointer-events: none;
        }
        @property --angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
        @keyframes hp-trace { to { --angle: 360deg; } }

        .hp-eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--hp-blue);
          text-shadow: 0 0 12px rgba(0,212,255,0.5);
        }
        .hp-title { font-size: 15px; font-weight: 800; color: #EAF6FF; }

        .hp-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          border-radius: 12px; padding: 10px 16px; font-size: 13px; font-weight: 700;
          background: linear-gradient(135deg, var(--hp-purple), var(--hp-electric));
          color: white;
          box-shadow: 0 0 0 1px rgba(124,92,255,0.4) inset, 0 10px 26px -10px rgba(124,92,255,0.6);
          transition: transform 180ms ease, filter 180ms ease, box-shadow 180ms ease;
        }
        .hp-btn-primary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
        .hp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .hp-btn-primary:focus-visible { outline: 2px solid var(--hp-cyan); outline-offset: 3px; }

        .hp-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          border-radius: 12px; padding: 10px 16px; font-size: 13px; font-weight: 700;
          background: rgba(9,14,26,0.6);
          border: 1px solid rgba(0,212,255,0.2);
          color: #cfeaff;
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }
        .hp-btn-secondary:hover:not(:disabled) { border-color: rgba(0,212,255,0.5); background: rgba(0,212,255,0.06); }
        .hp-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
        .hp-btn-secondary:focus-visible { outline: 2px solid var(--hp-cyan); outline-offset: 3px; }

        .hp-beta-chip {
          border-radius: 999px; border: 1px solid rgba(124,92,255,0.4);
          background: rgba(124,92,255,0.12); color: #c9baff;
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; padding: 2px 8px;
        }

        .hp-section-label {
          font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
        }
        .hp-section-label-verified { color: #00F5FF; text-shadow: 0 0 10px rgba(0,245,255,0.4); }
        .hp-section-label-stress { color: #91A8C3; }

        .hp-empty {
          border: 1px dashed rgba(0,212,255,0.2);
          background: rgba(9,14,26,0.4);
          border-radius: 16px;
          padding: 18px;
          font-size: 13px;
          color: #6f88a8;
        }

        .hp-card {
          background: var(--hp-glass);
          border: 1px solid rgba(0,212,255,0.14);
          box-shadow: 0 12px 34px -22px rgba(0,0,0,0.7);
          transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
        }
        .hp-card:hover, .hp-card:focus-within {
          transform: translateY(-2px);
          border-color: rgba(0,212,255,0.4);
          box-shadow: 0 16px 44px -18px rgba(0,212,255,0.35);
        }

        .hp-tag {
          border-radius: 8px; padding: 3px 9px; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em;
          background: rgba(9,14,26,0.6); border: 1px solid rgba(0,212,255,0.16); color: #91A8C3;
        }
        .hp-tag-bug { border-color: rgba(124,92,255,0.35); background: rgba(124,92,255,0.1); color: #c9baff; }
        .hp-tag-source { border-color: rgba(0,212,255,0.22); color: #9fe8ff; }

        .hp-status-pill {
          display: inline-flex; align-items: center; gap: 6px;
          border-radius: 999px; padding: 3px 10px; font-size: 10px; font-weight: 800;
          letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid transparent;
        }
        .hp-status-dot { width: 6px; height: 6px; border-radius: 999px; }
        .hp-pill-pass { background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.4); color: #6ee7b7; }
        .hp-dot-pass { background: #34d399; box-shadow: 0 0 8px #34d399; }
        .hp-pill-fail { background: rgba(255,92,138,0.1); border-color: rgba(255,92,138,0.4); color: #ff9db8; }
        .hp-dot-fail { background: #ff5c8a; box-shadow: 0 0 8px #ff5c8a; }
        .hp-pill-warn { background: rgba(255,184,76,0.1); border-color: rgba(255,184,76,0.4); color: #ffcf87; }
        .hp-dot-warn { background: #ffb84c; box-shadow: 0 0 8px #ffb84c; }
        .hp-pill-info { background: rgba(0,212,255,0.08); border-color: rgba(0,212,255,0.3); color: #9fe8ff; }
        .hp-dot-info { background: #00D4FF; box-shadow: 0 0 8px #00D4FF; }

        .hp-ghost-btn {
          border-radius: 8px; padding: 5px 10px; font-size: 11px; font-weight: 600;
          border: 1px solid rgba(0,212,255,0.16); background: rgba(9,14,26,0.5); color: #91A8C3;
          transition: border-color 160ms ease, color 160ms ease;
        }
        .hp-ghost-btn:hover { border-color: rgba(255,92,138,0.4); color: #ff9db8; }
        .hp-ghost-btn:focus-visible { outline: 2px solid var(--hp-cyan); outline-offset: 2px; }

        .hp-promote-btn {
          border-radius: 8px; padding: 5px 12px; font-size: 11px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em;
          border: 1px solid rgba(52,211,153,0.35); background: rgba(52,211,153,0.08); color: #6ee7b7;
          transition: background 160ms ease, opacity 160ms ease;
        }
        .hp-promote-btn:hover:not(:disabled) { background: rgba(52,211,153,0.16); }
        .hp-promote-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .hp-promote-btn:focus-visible { outline: 2px solid var(--hp-cyan); outline-offset: 2px; }

        .hp-field-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6f88a8; }
        .hp-code-block {
          border-radius: 10px; padding: 8px; font-family: ui-monospace, monospace; font-size: 11px;
          background: rgba(9,14,26,0.75); border: 1px solid rgba(0,212,255,0.1); color: #cfeaff;
        }
        .hp-code-block-good { border-color: rgba(52,211,153,0.25); background: rgba(52,211,153,0.06); color: #b7f5d8; }

        .hp-stat {
          border-radius: 14px; padding: 10px 12px;
          background: rgba(9,14,26,0.55); border: 1px solid rgba(0,212,255,0.14);
        }
        .hp-stat-pass { border-color: rgba(52,211,153,0.35); background: rgba(52,211,153,0.06); }
        .hp-stat-fail { border-color: rgba(255,92,138,0.35); background: rgba(255,92,138,0.06); }
        .hp-stat-warn { border-color: rgba(255,184,76,0.35); background: rgba(255,184,76,0.06); }
        .hp-stat-info { border-color: rgba(0,212,255,0.3); background: rgba(0,212,255,0.06); }
        .hp-stat-label { font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
        .hp-stat-value { font-size: 20px; font-weight: 900; }

        .hp-modal-backdrop {
          background: rgba(6,10,20,0.72);
          backdrop-filter: blur(6px);
        }
        .hp-modal {
          background: linear-gradient(180deg, rgba(21,37,68,0.96), rgba(12,20,38,0.98));
          border: 1px solid rgba(0,212,255,0.22);
          box-shadow: 0 30px 90px -30px rgba(0,212,255,0.35);
        }

        .hp-scan-bar {
          position: relative;
          height: 3px;
          width: 100%;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(0,212,255,0.08);
        }
        .hp-scan-bar::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; width: 35%;
          background: linear-gradient(90deg, transparent, var(--hp-cyan), var(--hp-purple), transparent);
          box-shadow: 0 0 14px rgba(0,212,255,0.7);
          animation: hp-scan 1.4s ease-in-out infinite;
        }
        @keyframes hp-scan {
          0% { left: -35%; }
          100% { left: 100%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hp-surface[data-active="true"]::after { animation: none; }
          .hp-scan-bar::after { animation: none; left: 0; width: 100%; opacity: 0.5; }
          .hp-card:hover, .hp-card:focus-within { transform: none; }
          .hp-btn-primary:hover:not(:disabled) { transform: none; }
        }
      `}</style>

      {showResultsModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hp-results-title"
          className="hp-modal-backdrop fixed inset-0 z-[1200] flex items-center justify-center p-4"
        >
          <div className="hp-modal flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(0,212,255,0.14)] px-5 py-4">
              <div>
                <p className="hp-eyebrow">AI Validation Engine</p>
                <h3 id="hp-results-title" className="hp-title">Run summary</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResultsModal(false)}
                className="hp-btn-secondary"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="hp-stat hp-stat-pass">
                  <p className="hp-stat-label text-emerald-300">Pass</p>
                  <p className="hp-stat-value text-emerald-100">{lastRunResults.filter((r) => r.passed === true).length}</p>
                </div>
                <div className="hp-stat hp-stat-fail">
                  <p className="hp-stat-label text-rose-300">Fail</p>
                  <p className="hp-stat-value text-rose-100">{lastRunResults.filter((r) => r.passed === false).length}</p>
                </div>
                <div className="hp-stat hp-stat-warn">
                  <p className="hp-stat-label text-amber-300">Timeout</p>
                  <p className="hp-stat-value text-amber-100">{lastRunResults.filter((r) => r.timedOut).length}</p>
                </div>
                <div className="hp-stat hp-stat-info">
                  <p className="hp-stat-label text-sky-300">Stress-only</p>
                  <p className="hp-stat-value text-sky-100">{lastRunResults.filter((r) => !r.isVerified).length}</p>
                </div>
              </div>
              <div className="space-y-3">
                {lastRunResults.map((test) => (
                  <TestCard key={test.id} test={test} onDelete={() => {}} canDelete={false} onUseAsSample={onUseAsSampleTest} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hp-surface p-4" data-active={isBusy}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="hp-eyebrow">AI Validation Engine</p>
            <p className="hp-title">Hidden test execution</p>
          </div>
        </div>

        {isBusy ? (
          <div className="mb-4" aria-live="polite">
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-[#9fe8ff]">
              <Spinner className="h-3.5 w-3.5" />
              {loading ? "Synthesizing hidden tests…" : "Executing against sandbox…"}
            </div>
            <div className="hp-scan-bar" role="status" aria-label={loading ? "Generating tests" : "Running tests"} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || !canGenerate}
            onClick={generateTests}
            className="hp-btn-primary"
          >
            {loading ? <Spinner /> : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
              </svg>
            )}
            {loading ? "Generating…" : "Generate tests"}
            <span className="hp-beta-chip">Beta</span>
          </button>
          <button
            type="button"
            disabled={running || !tests.length}
            onClick={runAll}
            className="hp-btn-secondary"
          >
            {running ? <Spinner /> : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {running ? "Running…" : "Run all tests"}
          </button>
          <button
            type="button"
            onClick={refresh}
            className="hp-btn-secondary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 015.418 15m13.001 0H15" />
            </svg>
            Refresh
          </button>
        </div>
        {!canGenerate ? (
          <p className="mt-3 text-sm text-[#6f88a8]">
            Add problem statement first.
          </p>
        ) : null}
        {plannerWarning ? (
          <p className="mt-3 text-xs text-[#ffcf87]">
            {plannerWarning}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="hp-section-label hp-section-label-verified">
          Verified tests
        </h3>
        {verified.length ? (
          <div className="space-y-3">
            {verified.map((test) => (
              <TestCard key={test.id} test={test} onDelete={removeTest} onUseAsSample={onUseAsSampleTest} />
            ))}
          </div>
        ) : (
          <div className="hp-empty">
            No verified tests yet (samples/admin-curated).
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="hp-section-label hp-section-label-stress">
          Stress tests (no ground truth)
        </h3>
        {stress.length ? (
          <div className="space-y-3">
            {stress.map((test) => (
              <TestCard key={test.id} test={test} onDelete={removeTest} onUseAsSample={onUseAsSampleTest} />
            ))}
          </div>
        ) : (
          <div className="hp-empty">
            No stress tests yet. Generate tests to probe edge behavior.
          </div>
        )}
      </section>
    </div>
  );
}