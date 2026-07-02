import express from "express";
import crypto from "crypto";
import DailyEntry from "../models/DailyEntry.js";
import { getDailyProblem } from "../services/dailyProblem.js";

const router = express.Router();

// GET /api/daily/:platform
router.get("/:platform", async (req, res) => {
  try {
    const { platform } = req.params;
    if (!["leetcode", "codeforces"].includes(platform)) {
      return res.status(400).json({ error: "Invalid platform" });
    }
    const problem = await getDailyProblem(platform);
    res.json({ problem });
  } catch (err) {
    console.error("Daily problem error:", err.message);
    res.status(503).json({
      error: "Daily problem temporarily unavailable",
      fallback: true,
    });
  }
});

// GET /api/daily/:platform/leaderboard
router.get("/:platform/leaderboard", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { platform } = req.params;

    const entries = await DailyEntry.find({ platform, date: today })
      .sort({ score: -1 })
      .limit(10)
      .select(
        "displayName score verdict timeComplexity language createdAt -_id",
      );

    const totalCount = await DailyEntry.countDocuments({
      platform,
      date: today,
    });

    res.json({ entries, totalCount, date: today });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// POST /api/daily/submit
router.post("/submit", async (req, res) => {
  try {
    const {
      platform,
      score,
      verdict,
      timeComplexity,
      spaceComplexity,
      language,
      displayName,
      userId: providedUserId,
    } = req.body;

    const today = new Date().toISOString().split("T")[0];
    const shareToken = crypto.randomBytes(8).toString("hex");

    // userId can be passed from frontend or derived from req.user if using auth middleware
    const userId = providedUserId || req.user?.id || null;

    if (userId) {
      const existing = await DailyEntry.findOne({
        platform,
        date: today,
        userId,
      });
      if (existing) {
        if (score > existing.score) {
          existing.score = score;
          existing.verdict = verdict;
          existing.shareToken = shareToken;
          await existing.save();
          return res.json({ updated: true, shareToken, entry: existing });
        }
        return res.json({ updated: false, shareToken: existing.shareToken });
      }
    }

    const entry = await DailyEntry.create({
      platform,
      date: today,
      displayName: displayName || "Anonymous",
      userId,
      score,
      verdict,
      timeComplexity,
      spaceComplexity,
      language,
      shareToken,
    });

    res.json({ success: true, shareToken, entry });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit entry" });
  }
});

export default router;
