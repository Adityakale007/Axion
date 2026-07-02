import mongoose from "mongoose";

const ChallengeSchema = new mongoose.Schema(
  {
    challengeId: { type: String, unique: true }, // short 8-char token
    challengerName: String,
    challengerScore: Number,
    challengerVerdict: String,
    challengerTimeComplexity: String,
    language: String,
    problemContext: String, // "Hash Table" or "Two Sum" etc
    platform: String, // 'daily-lc' | 'daily-cf' | 'custom'
    date: String,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }, // 7 days
    attempts: [
      {
        // track who tried to beat it
        name: String,
        score: Number,
        triedAt: Date,
      },
    ],
  },
  { timestamps: true },
);

// Add index for expiration
ChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Challenge", ChallengeSchema);
