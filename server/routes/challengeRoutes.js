import express from "express";
import crypto from "crypto";
import Challenge from "../models/Challenge.js";

const router = express.Router();

// POST /api/challenge/create
router.post("/create", async (req, res) => {
  try {
    const {
      challengerName,
      challengerScore,
      challengerVerdict,
      challengerTimeComplexity,
      language,
      problemContext,
      platform,
    } = req.body;

    const challengeId = crypto.randomBytes(5).toString("hex");

    const challenge = await Challenge.create({
      challengeId,
      challengerName: challengerName || "Anonymous",
      challengerScore,
      challengerVerdict,
      challengerTimeComplexity,
      language,
      problemContext,
      platform,
      date: new Date().toISOString().split("T")[0],
    });

    res.json({
      challengeId,
      challengeUrl: `${process.env.CLIENT_URL || "http://localhost:5173"}/challenge/${challengeId}`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create challenge" });
  }
});

// GET /api/challenge/:id
router.get("/:id", async (req, res) => {
  try {
    const challenge = await Challenge.findOne({ challengeId: req.params.id });
    if (!challenge)
      return res.status(404).json({ error: "Challenge not found or expired" });

    res.json({ challenge });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch challenge" });
  }
});

// POST /api/challenge/:id/attempt
router.post("/:id/attempt", async (req, res) => {
  try {
    const { name, score } = req.body;
    const challenge = await Challenge.findOne({ challengeId: req.params.id });
    if (!challenge) return res.status(404).json({ error: "Not found" });

    challenge.attempts.push({
      name: name || "Anonymous",
      score,
      triedAt: new Date(),
    });
    await challenge.save();

    const won = score > challenge.challengerScore;
    const diff = Math.abs(score - challenge.challengerScore);

    res.json({
      won,
      diff,
      challengerScore: challenge.challengerScore,
      yourScore: score,
      message: won
        ? `You beat ${challenge.challengerName} by ${diff} points!`
        : `${challenge.challengerName} wins by ${diff} points. Try again?`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to record attempt" });
  }
});

export default router;
