import Analysis from "../../server/models/Analysis.js";
import { connectDb } from "../_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDb();
    const analysis = await Analysis.findById(req.query.analysisId).lean();

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    return res.json({
      analysis: {
        id: analysis._id.toString(),
        code: analysis.code,
        language: analysis.language,
        prompt: analysis.prompt,
        result: analysis.result,
        createdAt: analysis.createdAt,
      },
    });
  } catch {
    return res.status(404).json({ error: "Analysis not found" });
  }
}
