const DEFAULT_VERDICT = "Analysis complete";

function toStr(value) {
  return value == null ? "" : String(value).trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function stripCodeFences(text = "") {
  return String(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function parseJsonObject(text = "") {
  const normalized = stripCodeFences(text);
  const candidates = [normalized];
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(normalized.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Response did not contain a JSON object");
}

function nonEmptyLines(code = "") {
  return String(code)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
}

function getMaxNestingDepth(code = "") {
  let current = 0;
  let maxDepth = 0;

  for (const char of String(code)) {
    if (char === "{") {
      current += 1;
      maxDepth = Math.max(maxDepth, current);
    } else if (char === "}") {
      current = Math.max(0, current - 1);
    }
  }

  return maxDepth;
}

function countMatches(code = "", regex) {
  return (String(code).match(regex) || []).length;
}

function estimateVariableCount(code = "", language = "cpp") {
  const source = String(code);

  if (language === "python") {
    return countMatches(source, /^\s*([a-zA-Z_]\w*)\s*=/gm);
  }

  if (language === "javascript") {
    return countMatches(
      source,
      /\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)/g,
    );
  }

  return countMatches(
    source,
    /\b(?:int|long long|long|double|float|char|bool|string|vector<[^>]+>|set<[^>]+>|map<[^>]+>|unordered_map<[^>]+>|unordered_set<[^>]+>|pair<[^>]+>)\s+([a-zA-Z_]\w*)/g,
  );
}

function estimateCyclomaticComplexity(code = "") {
  return (
    1 +
    countMatches(code, /\bif\b/g) +
    countMatches(code, /\bfor\b/g) +
    countMatches(code, /\bwhile\b/g) +
    countMatches(code, /\bcase\b/g) +
    countMatches(code, /\bcatch\b/g) +
    countMatches(code, /\?\s*/g) +
    countMatches(code, /&&|\|\|/g)
  );
}

function estimateBranchCount(code = "") {
  return (
    countMatches(code, /\bif\b/g) +
    countMatches(code, /\belse\b/g) +
    countMatches(code, /\bfor\b/g) +
    countMatches(code, /\bwhile\b/g) +
    countMatches(code, /\bswitch\b/g) +
    countMatches(code, /\bcase\b/g)
  );
}

function inferReadability({ linesOfCode, cyclomaticComplexity, nestingDepth }) {
  if (cyclomaticComplexity <= 5 && nestingDepth <= 3 && linesOfCode <= 80) {
    return "High";
  }
  if (cyclomaticComplexity <= 10 && nestingDepth <= 5 && linesOfCode <= 180) {
    return "Medium";
  }
  return "Low";
}

function buildLocalMetrics(code = "", language = "cpp") {
  const linesOfCode = nonEmptyLines(code).length;
  const cyclomaticComplexity = estimateCyclomaticComplexity(code);
  const nestingDepth = getMaxNestingDepth(code);
  const variableCount = estimateVariableCount(code, language);
  const branchCount = estimateBranchCount(code);

  return {
    linesOfCode,
    cyclomaticComplexity,
    nestingDepth,
    variableCount,
    branchCount,
    readability: inferReadability({
      linesOfCode,
      cyclomaticComplexity,
      nestingDepth,
    }),
  };
}

function inferConstraintWarning(problemContext = "", time = "") {
  const context = toStr(problemContext);
  const complexity = toStr(time);

  if (!context || !complexity) return null;

  if (/2.?x.?10\^5|2e5|200000/i.test(context) && /n\^2|n²/i.test(complexity)) {
    return "For n <= 2x10^5, an O(n^2) approach is likely too slow in Codeforces-style limits.";
  }

  if (/10\^5|1e5|100000/i.test(context) && /n\^2|n²/i.test(complexity)) {
    return "For n around 10^5, quadratic work is risky and can TLE unless the hidden constant is extremely small.";
  }

  return null;
}

function normalizeComplexityRating(value, fallback = "acceptable") {
  const normalized = toStr(value).toLowerCase();
  if (["optimal", "acceptable", "suboptimal", "too slow", "high"].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeBug(entry) {
  if (typeof entry === "string") {
    return {
      severity: "medium",
      title: entry,
      location: "Solution",
      explanation: entry,
      fix: "Inspect this branch and add a targeted correction.",
    };
  }

  const bug = entry && typeof entry === "object" ? entry : {};
  return {
    severity: ["critical", "high", "medium", "low"].includes(toStr(bug.severity).toLowerCase())
      ? toStr(bug.severity).toLowerCase()
      : "medium",
    title: toStr(bug.title) || "Potential issue",
    location: toStr(bug.location) || "Solution",
    explanation: toStr(bug.explanation) || "The model flagged this area as risky.",
    fix: toStr(bug.fix) || "Review the flagged code path and patch the edge case.",
  };
}

function normalizePattern(entry) {
  const pattern = entry && typeof entry === "object" ? entry : {};
  return {
    name: toStr(pattern.name) || "Unknown pattern",
    description: toStr(pattern.description) || "Pattern details were not provided.",
    confidence: clamp(Number(pattern.confidence) || 0, 0, 100),
  };
}

function normalizeStyle(entry) {
  if (typeof entry === "string") {
    return { type: "info", text: entry };
  }
  const style = entry && typeof entry === "object" ? entry : {};
  return {
    type: ["warning", "info", "good"].includes(toStr(style.type).toLowerCase())
      ? toStr(style.type).toLowerCase()
      : "info",
    text: toStr(style.text) || "Style feedback unavailable.",
  };
}

function normalizeSimilarProblem(entry) {
  const item = entry && typeof entry === "object" ? entry : {};
  return {
    name: toStr(item.name) || "Related Codeforces problem",
    difficulty: ["Easy", "Medium", "Hard"].includes(toStr(item.difficulty))
      ? toStr(item.difficulty)
      : "Medium",
    rating: clamp(Number(item.rating) || 1200, 800, 4000),
    tags: normalizeArray(item.tags).map((tag) => toStr(tag)).filter(Boolean).slice(0, 5),
    reason: toStr(item.reason) || "Similar constraints or core idea.",
  };
}

function normalizeInterviewReadiness(value, bugsCount = 0) {
  const source = value && typeof value === "object" ? value : {};
  const correctness = clamp(Number(source.correctness) || Math.max(35, 88 - bugsCount * 10), 0, 100);
  const efficiency = clamp(Number(source.efficiency) || 78, 0, 100);
  const edgeCoverage = clamp(Number(source.edgeCoverage) || Math.max(30, 80 - bugsCount * 8), 0, 100);
  const clarity = clamp(Number(source.clarity) || 76, 0, 100);
  const robustness = clamp(Number(source.robustness) || Math.max(30, 82 - bugsCount * 7), 0, 100);
  const cfFitness = clamp(Number(source.cfFitness) || 79, 0, 100);

  return {
    correctness,
    efficiency,
    edgeCoverage,
    clarity,
    robustness,
    cfFitness,
    toReach95:
      toStr(source.toReach95) ||
      "Tighten the edge cases, document the invariant more clearly, and remove any remaining overflow or boundary risks.",
  };
}

function inferVerdict(overallScore, bugs) {
  if (bugs.some((bug) => bug.severity === "critical")) {
    return "Needs work · correctness risk";
  }
  if (overallScore >= 85) return "Strong solution · interview ready";
  if (overallScore >= 70) return "Good solution · minor cleanup left";
  if (overallScore >= 55) return "Promising solution · some risk remains";
  return "Needs revision · major issues detected";
}

function inferOverallScore(interviewReadiness) {
  const values = [
    interviewReadiness.correctness,
    interviewReadiness.efficiency,
    interviewReadiness.edgeCoverage,
    interviewReadiness.clarity,
    interviewReadiness.robustness,
    interviewReadiness.cfFitness,
  ];
  return clamp(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length), 0, 100);
}

export function buildAnalysisPrompt({ code, language = "cpp", problemContext = "" }) {
  return `
You are an expert competitive programming judge and code reviewer.
Analyse the following ${language} solution deeply and return ONLY valid JSON.
${problemContext ? `Problem context: ${problemContext}` : ""}

Code:
\`\`\`${language}
${code}
\`\`\`

Return this exact JSON structure (no markdown, no explanation, only JSON):
{
  "overallScore": <integer 0-100>,
  "verdict": "<one line: e.g. 'Good solution · minor overflow risk'>",
  "summary": "<2-3 sentence paragraph explaining the solution's approach and main strengths/weaknesses>",

  "complexity": {
    "time": "<e.g. O(n log n)>",
    "timeExplanation": "<why, referencing actual code>",
    "timeRating": "<'optimal' | 'acceptable' | 'suboptimal' | 'too slow'>",
    "space": "<e.g. O(n)>",
    "spaceExplanation": "<why>",
    "spaceRating": "<'optimal' | 'acceptable' | 'high'>",
    "constraintWarning": "<null OR string warning if time*n could TLE given typical constraints>"
  },

  "patterns": [
    {
      "name": "<algorithm/pattern name>",
      "description": "<one line>",
      "confidence": <integer 0-100>
    }
  ],

  "bugs": [
    {
      "severity": "<'critical' | 'high' | 'medium' | 'low'>",
      "title": "<short title>",
      "location": "<e.g. 'Line 14' or 'solve() function'>",
      "explanation": "<what the bug is>",
      "fix": "<exact code fix or clear instruction>"
    }
  ],

  "metrics": {
    "linesOfCode": <integer>,
    "cyclomaticComplexity": <integer>,
    "nestingDepth": <integer>,
    "variableCount": <integer>,
    "branchCount": <integer>,
    "readability": "<'High' | 'Medium' | 'Low'>"
  },

  "optimization": {
    "hasSuggestion": <boolean>,
    "summary": "<one line describing the improvement>",
    "complexityChange": "<e.g. 'O(n²) → O(n log n)' or 'same complexity, cleaner code'>",
    "before": "<the relevant code snippet before>",
    "after": "<the improved code snippet>",
    "explanation": "<why this is better>"
  },

  "style": [
    {
      "type": "<'warning' | 'info' | 'good'>",
      "text": "<observation about style, naming, portability, CF-specific notes>"
    }
  ],

  "interviewReadiness": {
    "correctness": <0-100>,
    "efficiency": <0-100>,
    "edgeCoverage": <0-100>,
    "clarity": <0-100>,
    "robustness": <0-100>,
    "cfFitness": <0-100>,
    "toReach95": "<what specifically needs fixing to hit 95+ score>"
  },

  "similarProblems": [
    {
      "name": "<CF problem name and number>",
      "difficulty": "<'Easy' | 'Medium' | 'Hard'>",
      "rating": <integer>,
      "tags": ["<tag1>", "<tag2>"],
      "reason": "<why this is similar>"
    }
  ],

  "tags": ["<tag1>", "<tag2>"],
  "missedEdgeCases": ["<edge case 1>", "<edge case 2>"],
  "provider": "<which AI provider responded>"
}
`;
}

export function normalizeAnalysisResult({
  raw,
  code = "",
  language = "cpp",
  problemContext = "",
  provider = "",
}) {
  const parsed = raw && typeof raw === "object" ? raw : {};
  const localMetrics = buildLocalMetrics(code, language);
  const bugs = normalizeArray(parsed.bugs).map(normalizeBug).slice(0, 8);
  const interviewReadiness = normalizeInterviewReadiness(
    parsed.interviewReadiness,
    bugs.length,
  );
  const overallScore = clamp(
    Number(parsed.overallScore) || inferOverallScore(interviewReadiness),
    0,
    100,
  );

  return {
    overallScore,
    verdict: toStr(parsed.verdict) || inferVerdict(overallScore, bugs) || DEFAULT_VERDICT,
    summary:
      toStr(parsed.summary) ||
      "The solution was analysed, but the model returned only a partial summary. Review the sections below for the detailed breakdown.",
    complexity: {
      time: toStr(parsed?.complexity?.time) || "N/A",
      timeExplanation:
        toStr(parsed?.complexity?.timeExplanation) ||
        "Time complexity explanation was not provided.",
      timeRating: normalizeComplexityRating(parsed?.complexity?.timeRating, "acceptable"),
      space: toStr(parsed?.complexity?.space) || "N/A",
      spaceExplanation:
        toStr(parsed?.complexity?.spaceExplanation) ||
        "Space complexity explanation was not provided.",
      spaceRating: normalizeComplexityRating(parsed?.complexity?.spaceRating, "acceptable"),
      constraintWarning:
        parsed?.complexity?.constraintWarning === null
          ? null
          : toStr(parsed?.complexity?.constraintWarning) ||
            inferConstraintWarning(problemContext, parsed?.complexity?.time),
    },
    patterns: normalizeArray(parsed.patterns).map(normalizePattern).slice(0, 6),
    bugs,
    metrics: {
      linesOfCode: clamp(Number(parsed?.metrics?.linesOfCode) || localMetrics.linesOfCode, 0, 5000),
      cyclomaticComplexity: clamp(
        Number(parsed?.metrics?.cyclomaticComplexity) || localMetrics.cyclomaticComplexity,
        1,
        200,
      ),
      nestingDepth: clamp(Number(parsed?.metrics?.nestingDepth) || localMetrics.nestingDepth, 0, 50),
      variableCount: clamp(Number(parsed?.metrics?.variableCount) || localMetrics.variableCount, 0, 500),
      branchCount: clamp(Number(parsed?.metrics?.branchCount) || localMetrics.branchCount, 0, 500),
      readability:
        ["High", "Medium", "Low"].includes(toStr(parsed?.metrics?.readability))
          ? toStr(parsed?.metrics?.readability)
          : localMetrics.readability,
    },
    optimization: {
      hasSuggestion: Boolean(parsed?.optimization?.hasSuggestion),
      summary: toStr(parsed?.optimization?.summary),
      complexityChange: toStr(parsed?.optimization?.complexityChange),
      before: toStr(parsed?.optimization?.before),
      after: toStr(parsed?.optimization?.after),
      explanation: toStr(parsed?.optimization?.explanation),
    },
    style: normalizeArray(parsed.style).map(normalizeStyle).slice(0, 8),
    interviewReadiness,
    similarProblems: normalizeArray(parsed.similarProblems)
      .map(normalizeSimilarProblem)
      .slice(0, 6),
    tags: normalizeArray(parsed.tags).map((tag) => toStr(tag)).filter(Boolean).slice(0, 8),
    missedEdgeCases: normalizeArray(parsed.missedEdgeCases)
      .map((item) => toStr(item))
      .filter(Boolean)
      .slice(0, 8),
    provider: toStr(parsed.provider || provider) || "unknown",
  };
}

export function parseAnalysisResponse({
  responseText = "",
  code = "",
  language = "cpp",
  problemContext = "",
  provider = "",
}) {
  const parsed = parseJsonObject(responseText);
  return normalizeAnalysisResult({
    raw: parsed,
    code,
    language,
    problemContext,
    provider,
  });
}

export function isUsableAnalysis(result) {
  if (!result || typeof result !== "object") return false;
  if (result.overallScore > 0 && toStr(result.summary)) return true;
  if (normalizeArray(result.patterns).length > 0) return true;
  if (normalizeArray(result.bugs).length > 0) return true;
  return Boolean(toStr(result.complexity?.time) || toStr(result.complexity?.space));
}

export function buildAnalysisFailure(raw = "") {
  return {
    error: "Analysis failed",
    raw: stripCodeFences(raw),
  };
}
