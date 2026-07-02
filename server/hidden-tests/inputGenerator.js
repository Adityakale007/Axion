const MAX_SIZE = 1000;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function parseConstraintRange(constraints = "", key = "n", fallback = [1, 50]) {
  const text = String(constraints || "");
  const re = new RegExp(`${key}\\s*(?:<=|<|=)\\s*(\\d{1,6})`, "i");
  const m = text.match(re);
  if (!m) return fallback;
  const hi = clamp(parseInt(m[1], 10) || fallback[1], 1, MAX_SIZE);
  return [1, hi];
}

function seededInt(seed, lo, hi) {
  let x = Math.sin(seed) * 10000;
  x = x - Math.floor(x);
  return Math.floor(lo + x * (hi - lo + 1));
}

function makeArray(spec, constraints, seed) {
  const [minN, maxN] = parseConstraintRange(constraints, "n", [1, 50]);
  const n = clamp(
    Number(spec.n) || seededInt(seed + 1, minN, maxN),
    1,
    MAX_SIZE,
  );
  const minVal = Number(spec.min ?? -1000);
  const maxVal = Number(spec.max ?? 1000);
  const arr = Array.from({ length: n }, (_, i) =>
    seededInt(seed + i + 11, minVal, maxVal),
  );
  return {
    stdin: `${n}\n${arr.join(" ")}`,
    size: n,
  };
}

function makeString(spec, _constraints, seed) {
  const length = clamp(Number(spec.length) || 32, 1, MAX_SIZE);
  const alphabet = String(spec.alphabet || "abcxyz");
  const chars = [];
  for (let i = 0; i < length; i++) {
    const idx = seededInt(seed + i + 3, 0, Math.max(0, alphabet.length - 1));
    chars.push(alphabet[idx] || "a");
  }
  return {
    stdin: chars.join(""),
    size: length,
  };
}

function makeGraph(spec, constraints, seed) {
  const [minN, maxN] = parseConstraintRange(constraints, "n", [2, 40]);
  const n = clamp(Number(spec.n) || seededInt(seed + 1, minN, maxN), 2, 200);
  const mRaw = Number(spec.m) || Math.max(n - 1, Math.floor(n * 1.5));
  const m = clamp(mRaw, n - 1, Math.min(MAX_SIZE, n * (n - 1)));
  const weighted = Boolean(spec.weighted);
  const edges = [];
  const used = new Set();

  // Build a connected backbone first.
  for (let i = 2; i <= n; i++) {
    const u = i - 1;
    const v = i;
    const w = weighted ? seededInt(seed + i, 1, 20) : null;
    edges.push(weighted ? `${u} ${v} ${w}` : `${u} ${v}`);
    used.add(`${u}-${v}`);
  }
  while (edges.length < m) {
    const u = seededInt(seed + edges.length * 3, 1, n);
    const v = seededInt(seed + edges.length * 5 + 1, 1, n);
    if (u === v) continue;
    const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
    if (used.has(key)) continue;
    used.add(key);
    const w = weighted ? seededInt(seed + edges.length * 7 + 3, 1, 20) : null;
    edges.push(weighted ? `${u} ${v} ${w}` : `${u} ${v}`);
  }
  return {
    stdin: `${n} ${edges.length}\n${edges.join("\n")}`,
    size: edges.length,
  };
}

export function generateInputFromSpec({
  inputSpec,
  constraints = "",
  seed = Date.now(),
}) {
  if (!inputSpec || typeof inputSpec !== "object") {
    return null;
  }
  const type = String(inputSpec.type || "").toLowerCase();
  try {
    if (type === "array") {
      return makeArray(inputSpec, constraints, seed);
    }
    if (type === "string") {
      return makeString(inputSpec, constraints, seed);
    }
    if (type === "graph") {
      return makeGraph(inputSpec, constraints, seed);
    }
    return null;
  } catch {
    return null;
  }
}
