/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" className="opacity-30" stroke="currentColor" strokeWidth="2.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function statusPill(test) {
  if (test.timedOut) return { label: "timeout", cls: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100" };
  if (test.runtimeError) return { label: "crash", cls: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-100" };
  if (test.isVerified) {
    if (test.passed === true) return { label: "pass", cls: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100" };
    if (test.passed === false) return { label: "fail", cls: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-100" };
  }
  return { label: "stress-only", cls: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-100" };
}

function TestCard({ test, onDelete, canDelete = true, onUseAsSample }) {
  const status = statusPill(test);
  const canPromoteToSample = typeof onUseAsSample === "function" && Boolean(
    String(test.input || "").trim() && String(test.expectedOutput ?? test.actualOutput ?? "").trim(),
  );
  return (
    <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-700/80 dark:bg-[#0d172b]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
            {test.category || "edge"}
          </span>
          <span className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-200">
            {test.bugClass || "unknown"}
          </span>
          <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>
            {status.label}
          </span>
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
            {test.isVerified ? "Verified" : "Stress test (no ground truth)"}
          </span>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDelete(test.id)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800"
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        {test.description || "Generated test"}
      </p>
      <div className="mt-3 space-y-3">
        {typeof onUseAsSample === "function" ? (
          <button
            type="button"
            onClick={() => onUseAsSample(test)}
            disabled={!canPromoteToSample}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700/60 dark:bg-emerald-900/25 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
          >
            {test.isVerified ? "Add to sample tests" : "Add using latest output"}
          </button>
        ) : null}
        {!canPromoteToSample && typeof onUseAsSample === "function" ? (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Run this test once to capture output before adding it into sample tests.
          </p>
        ) : null}
        <div className="grid gap-2 lg:grid-cols-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Input</p>
            <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">{test.input || ""}</pre>
          </div>
          {test.isVerified && test.expectedOutput != null ? (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Expected output</p>
              <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-emerald-50 p-2 font-mono text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{test.expectedOutput || ""}</pre>
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Actual output</p>
            <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">{test.actualOutput || (test.runtimeError ? "(runtime error)" : test.timedOut ? "(timeout)" : "(not run yet)")}</pre>
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

  return (
    <div className="space-y-4">
      {showResultsModal ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-[#081121] dark:text-gray-100">
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600 dark:text-gray-300">Hidden tests</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Run summary</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResultsModal(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-slate-900 dark:text-gray-200"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-emerald-950/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Pass</p>
                  <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{lastRunResults.filter((r) => r.passed === true).length}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm dark:border-rose-800/50 dark:bg-rose-950/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-200">Fail</p>
                  <p className="text-lg font-bold text-rose-900 dark:text-rose-100">{lastRunResults.filter((r) => r.passed === false).length}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800/50 dark:bg-amber-950/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">Timeout</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{lastRunResults.filter((r) => r.timedOut).length}</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-800/50 dark:bg-sky-950/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">Stress-only</p>
                  <p className="text-lg font-bold text-sky-900 dark:text-sky-100">{lastRunResults.filter((r) => !r.isVerified).length}</p>
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

      <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-4 shadow-sm dark:border-gray-700/80 dark:bg-[#0d172b]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || !canGenerate}
            onClick={generateTests}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800/40 dark:bg-amber-900/25 dark:text-amber-200"
          >
            {loading ? <Spinner /> : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
              </svg>
            )}
            {loading ? "Generating..." : "Generate tests"}
            <span className="rounded-full border border-amber-300/70 bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
              Beta
            </span>
          </button>
          <button
            type="button"
            disabled={running || !tests.length}
            onClick={runAll}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-stone-50 disabled:opacity-60 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200"
          >
            {running ? <Spinner /> : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {running ? "Running..." : "Run all tests"}
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-stone-50 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 015.418 15m13.001 0H15" />
            </svg>
            Refresh
          </button>
        </div>
        {!canGenerate ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Add problem statement first.
          </p>
        ) : null}
        {plannerWarning ? (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            {plannerWarning}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
          Verified tests
        </h3>
        {verified.length ? (
          <div className="space-y-3">
            {verified.map((test) => (
              <TestCard key={test.id} test={test} onDelete={removeTest} onUseAsSample={onUseAsSampleTest} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
            No verified tests yet (samples/admin-curated).
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
          Stress tests (no ground truth)
        </h3>
        {stress.length ? (
          <div className="space-y-3">
            {stress.map((test) => (
              <TestCard key={test.id} test={test} onDelete={removeTest} onUseAsSample={onUseAsSampleTest} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
            No stress tests yet. Generate tests to probe edge behavior.
          </div>
        )}
      </section>
    </div>
  );
}
