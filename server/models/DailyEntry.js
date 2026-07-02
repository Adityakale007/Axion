import mongoose from "mongoose";

const DailyEntrySchema = new mongoose.Schema({
  platform: String, // 'leetcode' | 'codeforces'
  date: String, // "2026-04-18"
  displayName: String, // username or "Anonymous"
  userId: String, // optional, for signed-in users
  score: Number, // 0-100
  verdict: String, // "Good solution · minor overflow risk"
  timeComplexity: String, // "O(n)"
  spaceComplexity: String, // "O(n)"
  language: String, // "C++"
  shareToken: String, // unique token for challenge links
  createdAt: { type: Date, default: Date.now },
});

// Index for fast leaderboard queries
DailyEntrySchema.index({ platform: 1, date: 1, score: -1 });

export default mongoose.model("DailyEntry", DailyEntrySchema);
