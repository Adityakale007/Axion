import Analysis from "../../server/models/Analysis.js";
import { connectDb } from "../_lib/db.js";

const DEFAULT_LANGUAGE = "cpp";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    code = "",
    language = DEFAULT_LANGUAGE,
    problemContext = "",
    result = null,
  } = req.body || {};

  if (!code.trim() || !result || typeof result !== "object") {
    return res.status(400).json({ error: "Missing analysis payload" });
  }

  try {
    await connectDb();
    const analysis = await Analysis.create({
      code,
      language,
      prompt: problemContext,
      result,
    });

    return res.status(201).json({ id: analysis._id.toString() });
  } catch {
    return res.status(500).json({ error: "Failed to save analysis" });
  }
}
