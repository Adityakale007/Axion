import mongoose from "mongoose";

const intelligenceEventSchema = new mongoose.Schema(
  {
    ts: { type: Date, default: Date.now },
    type: {
      type: String,
      required: true,
      enum: ["run", "submit_samples", "ai_review", "session_end"],
    },
    userId: { type: String, default: "" },
    username: { type: String, default: "" },
    socketId: { type: String, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const sessionIntelligenceLogSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    roomId: { type: String, required: true },
    problemSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    endReason: { type: String, default: "" },
    events: { type: [intelligenceEventSchema], default: [] },
  },
  { timestamps: true },
);

sessionIntelligenceLogSchema.index({ roomId: 1, startedAt: -1 });

export default mongoose.model("SessionIntelligenceLog", sessionIntelligenceLogSchema);
