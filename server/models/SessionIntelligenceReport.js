import mongoose from "mongoose";

const sessionIntelligenceReportSchema = new mongoose.Schema(
  {
    shareId: { type: String, required: true, unique: true },
    userId: { type: String, default: "" },
    roomId: { type: String, default: "" },
    sessionId: { type: String, default: "" },
    problemTitle: { type: String, default: "" },
    report: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

sessionIntelligenceReportSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model(
  "SessionIntelligenceReport",
  sessionIntelligenceReportSchema,
);
