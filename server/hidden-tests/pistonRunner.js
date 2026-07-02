import axios from "axios";

const PISTON_URL = "https://emkc.org/api/v2/piston/execute";
const TIMEOUT_MS = 5000;

const PISTON_LANG = {
  cpp: { language: "cpp", version: "10.2.0" },
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
};

function normalize(str = "") {
  return String(str).replace(/\r\n/g, "\n").trim();
}

export function classifyOutput({ run = {}, expectedOutput = null, isVerified = false }) {
  const stdout = run.stdout || "";
  const stderr = run.stderr || "";
  const timedOut = Boolean(run.signal || run.code === 124);
  const runtimeError = Boolean(stderr.trim()) || typeof run.code === "number" && run.code !== 0;
  const suspiciousOutput =
    stdout.length > 100000 ||
    (!stdout.trim() && !stderr.trim()) ||
    /\b(undefined|null|nan)\b/i.test(stdout);

  let passed = null;
  if (isVerified) {
    passed = normalize(stdout) === normalize(expectedOutput || "");
  }

  return {
    actualOutput: stdout,
    passed,
    timedOut,
    runtimeError,
    suspiciousOutput,
    exitCode: typeof run.code === "number" ? run.code : null,
    stderr: stderr || "",
  };
}

export async function runWithPiston({
  code,
  languageKey,
  stdin = "",
}) {
  const cfg = PISTON_LANG[languageKey];
  if (!cfg) {
    return {
      ok: false,
      error: `Unsupported language for hidden tests: ${languageKey}`,
      run: null,
    };
  }
  try {
    const { data } = await axios.post(
      PISTON_URL,
      {
        language: cfg.language,
        version: cfg.version,
        files: [{ content: code }],
        stdin,
      },
      { timeout: TIMEOUT_MS },
    );
    return { ok: true, run: data?.run || {} };
  } catch (error) {
    return {
      ok: false,
      error:
        error?.response?.data?.message ||
        error.message ||
        "Piston execution failed",
      run: null,
    };
  }
}
