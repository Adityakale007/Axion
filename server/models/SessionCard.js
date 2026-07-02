import mongoose from "mongoose";

const sessionCardSchema = new mongoose.Schema(
  {
    roomId: { type: String, default: "" },
    sessionId: { type: String, default: "" },
    shareId: { type: String, required: true, unique: true },
    problemTitle: { type: String, default: "" },
    tags: { type: [String], default: [] },
    rating: { type: String, default: "" },
    score: { type: Number, default: null },
    strongestSignals: { type: [String], default: [] },
    biggestGap: { type: String, default: "" },
    duration: { type: String, default: "" },
  },
  { timestamps: true },
);

sessionCardSchema.index({ roomId: 1, createdAt: -1 });

export default mongoose.model("SessionCard", sessionCardSchema);
