import mongoose from "mongoose";

const DailyProblemSchema = new mongoose.Schema({
  platform: String, // 'leetcode' | 'codeforces'
  date: String, // "2026-04-18"
  title: String,
  difficulty: String,
  rating: Number,
  tags: [String],
  url: String,
  statement: String, // plain text context for AI analyser
  fetchedAt: { type: Date, default: Date.now, expires: 86400 }, // auto-delete after 24h
});

export default mongoose.model("DailyProblem", DailyProblemSchema);
