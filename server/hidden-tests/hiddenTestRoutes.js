import express from "express";
import HiddenTest from "../models/HiddenTest.js";
import { planHiddenTests } from "./testPlanner.js";
import { generateInputFromSpec } from "./inputGenerator.js";
import { classifyOutput, runWithPiston } from "./pistonRunner.js";

const memoryTestsByRoom = new Map();

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(v = "") {
  return String(v ?? "").replace(/\r\n/g, "\n");
}

function toViewModel(row) {
  return {
    id: String(row._id || row.id),
    roomId: row.roomId,
    sessionId: row.sessionId || "",
    problemId: row.problemId || "",
    input: row.input || "",
    expectedOutput: row.expectedOutput ?? null,
    actualOutput: row.actualOutput || "",
    isVerified: Boolean(row.isVerified),
    passed: row.passed ?? null,
    category: row.category || "edge",
    description: row.description || "",
    bugClass: row.bugClass || "unknown",
    size: row.size || 0,
    generationSource: row.generationSource || "llm-assisted",
    timedOut: Boolean(row.timedOut),
    exitCode: row.exitCode ?? null,
    suspiciousOutput: Boolean(row.suspiciousOutput),
    runtimeError: Boolean(row.runtimeError),
    createdAt: row.createdAt || nowIso(),
    updatedAt: row.updatedAt || row.createdAt || nowIso(),
  };
}

function parseSamples(problem = {}) {
  const samples = Array.isArray(problem.samples) ? problem.samples : [];
  return samples
    .filter((s) => s && String(s.input || "").trim().length > 0)
    .map((s, idx) => ({
      category: "sample",
      description: `Sample #${idx + 1}`,
      bugClass: "known-case",
      input: normalizeText(s.input || ""),
      expectedOutput: normalizeText(s.output || ""),
      isVerified: true,
      size: normalizeText(s.input || "").length,
    }))
    .slice(0, 2);
}

async function listRoomTests(isDatabaseConnected, roomId) {
  if (isDatabaseConnected()) {
    const docs = await HiddenTest.find({ roomId }).sort({ createdAt: -1 }).lean();
    return docs.map(toViewModel);
  }
  return memoryTestsByRoom.get(roomId) || [];
}

function saveMemory(roomId, test) {
  const prev = memoryTestsByRoom.get(roomId) || [];
  const next = [test, ...prev];
  memoryTestsByRoom.set(roomId, next);
  return test;
}

function updateMemory(roomId, testId, patch) {
  const prev = memoryTestsByRoom.get(roomId) || [];
  const next = prev.map((t) => (t.id === testId ? { ...t, ...patch, updatedAt: nowIso() } : t));
  memoryTestsByRoom.set(roomId, next);
  return next.find((t) => t.id === testId) || null;
}

function deleteMemory(testId) {
  for (const [roomId, list] of memoryTestsByRoom.entries()) {
    const idx = list.findIndex((t) => t.id === testId);
    if (idx >= 0) {
      list.splice(idx, 1);
      memoryTestsByRoom.set(roomId, list);
      return true;
    }
  }
  return false;
}

async function clearRoomTests(isDatabaseConnected, roomId) {
  if (!roomId) return;
  if (isDatabaseConnected()) {
    await HiddenTest.deleteMany({ roomId });
    return;
  }
  memoryTestsByRoom.set(roomId, []);
}

export default function createHiddenTestRouter({
  isDatabaseConnected,
  getRoomState,
}) {
  const router = express.Router();

  router.get("/:roomId", async (req, res) => {
    try {
      const rows = await listRoomTests(isDatabaseConnected, req.params.roomId);
      return res.json({ tests: rows });
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to list tests" });
    }
  });

  router.post("/generate", async (req, res) => {
    const { roomId, curatedTests } = req.body || {};
    if (!roomId) return res.status(400).json({ error: "Missing roomId" });

    const roomState = getRoomState(roomId);
    const problem = roomState?.problem || {};
    const problemStatement = String(
      problem.prompt || problem.pastedStatement || "",
    ).trim();
    if (!problemStatement) {
      return res.status(400).json({ error: "Add problem statement first" });
    }

    const sampleIO = [
      problem.sampleInput ? `Sample Input:\n${problem.sampleInput}` : "",
      problem.sampleOutput ? `Sample Output:\n${problem.sampleOutput}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const planner = await planHiddenTests({
      problemStatement,
      constraints: problem.constraints || "",
      sampleIO,
    });

    const generatedStress = [];
    for (let i = 0; i < planner.plans.length; i++) {
      const plan = planner.plans[i];
      const generated = generateInputFromSpec({
        inputSpec: plan.inputSpec,
        constraints: problem.constraints || "",
        seed: Date.now() + i * 97,
      });
      if (!generated) continue;
      const safeInput = String(generated.stdin || "").trim();
      if (!safeInput) continue;
      generatedStress.push({
        category: plan.category || "stress",
        description: plan.description || "Generated stress test",
        bugClass: plan.bugClass || "unknown",
        input: safeInput,
        expectedOutput: null,
        isVerified: false,
        size: generated.size || generated.stdin.length,
      });
      if (generatedStress.length >= 4) break;
    }

    const curatedVerified = Array.isArray(curatedTests)
      ? curatedTests
          .filter((t) => t && typeof t === "object")
          .map((t, idx) => ({
            category: "admin",
            description: String(t.description || `Admin test #${idx + 1}`),
            bugClass: String(t.bugClass || "known-case"),
            input: normalizeText(t.input || ""),
            expectedOutput:
              t.expectedOutput == null ? null : normalizeText(t.expectedOutput),
            isVerified: t.expectedOutput != null,
            size: normalizeText(t.input || "").length,
          }))
          .filter((t) => String(t.input || "").trim().length > 0)
      : [];
    const verified = [...parseSamples(problem), ...curatedVerified].filter(
      (t) => t.isVerified,
    );
    const nextTests = [...verified, ...generatedStress].slice(0, 4);
    if (!nextTests.length) {
      return res.status(400).json({ error: "Could not generate tests safely." });
    }

    const sessionId = roomState?.session?.intelligenceSessionId || "";
    const problemId = problem.problemSnapshot?.internalProblemId || problem.problemCode || "";

    await clearRoomTests(isDatabaseConnected, roomId);

    const saved = [];
    for (const item of nextTests) {
      const safeInput = normalizeText(item.input || "").trim();
      if (!safeInput) continue;
      const row = {
        roomId,
        sessionId,
        problemId,
        input: safeInput,
        expectedOutput:
          item.expectedOutput == null ? null : normalizeText(item.expectedOutput),
        actualOutput: "",
        isVerified: Boolean(item.isVerified),
        passed: null,
        category: item.category || "edge",
        description: item.description || "",
        bugClass: item.bugClass || "unknown",
        size: item.size || item.input.length,
        generationSource: "llm-assisted",
        timedOut: false,
        exitCode: null,
        suspiciousOutput: false,
        runtimeError: false,
      };
      if (isDatabaseConnected()) {
        const doc = await HiddenTest.create(row);
        saved.push(toViewModel(doc.toObject()));
      } else {
        const vm = toViewModel({
          ...row,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        saveMemory(roomId, vm);
        saved.push(vm);
      }
    }

    if (!saved.length) {
      return res.status(400).json({
        error:
          "No valid hidden tests were produced (empty-input tests were discarded).",
      });
    }

    return res.json({
      tests: saved,
      plannerSource: planner.source,
      warning: planner.warning || null,
    });
  });

  router.post("/run", async (req, res) => {
    const { roomId, code, language, testIds } = req.body || {};
    if (!roomId || !code || !language) {
      return res.status(400).json({ error: "Missing roomId/code/language" });
    }

    const rows = await listRoomTests(isDatabaseConnected, roomId);
    let target = rows;
    if (Array.isArray(testIds) && testIds.length) {
      const set = new Set(testIds.map(String));
      target = rows.filter((t) => set.has(String(t.id)));
    }
    if (!target.length) {
      return res.status(404).json({ error: "No tests found for run" });
    }

    const jobs = target.map(async (test) => {
      const runRes = await runWithPiston({
        code,
        languageKey: language,
        stdin: test.input || "",
      });
      if (!runRes.ok) {
        const failedPatch = {
          actualOutput: "",
          passed: test.isVerified ? false : null,
          timedOut: false,
          runtimeError: true,
          suspiciousOutput: false,
          exitCode: null,
        };
        if (isDatabaseConnected()) {
          await HiddenTest.findByIdAndUpdate(test.id, failedPatch);
        } else {
          updateMemory(roomId, test.id, failedPatch);
        }
        return {
          ...test,
          ...failedPatch,
          pistonError: runRes.error,
          statusLabel: "crash",
        };
      }

      const cls = classifyOutput({
        run: runRes.run,
        expectedOutput: test.expectedOutput,
        isVerified: test.isVerified,
      });
      const patch = {
        actualOutput: cls.actualOutput,
        passed: cls.passed,
        timedOut: cls.timedOut,
        runtimeError: cls.runtimeError,
        suspiciousOutput: cls.suspiciousOutput,
        exitCode: cls.exitCode,
      };
      if (isDatabaseConnected()) {
        await HiddenTest.findByIdAndUpdate(test.id, patch);
      } else {
        updateMemory(roomId, test.id, patch);
      }

      return {
        ...test,
        ...patch,
        statusLabel: cls.timedOut
          ? "timeout"
          : cls.runtimeError
            ? "crash"
            : test.isVerified
              ? cls.passed
                ? "pass"
                : "fail"
              : "stress-only",
      };
    });

    const updated = await Promise.all(jobs);
    return res.json({ tests: updated });
  });

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing id" });
    if (isDatabaseConnected()) {
      await HiddenTest.findByIdAndDelete(id);
      return res.json({ ok: true });
    }
    return res.json({ ok: deleteMemory(id) });
  });

  return router;
}
