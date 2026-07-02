import mongoose from "mongoose";

const hiddenTestSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    sessionId: { type: String, default: "", index: true },
    problemId: { type: String, default: "" },
    input: { type: String, required: true },
    expectedOutput: { type: String, default: null },
    actualOutput: { type: String, default: "" },
    isVerified: { type: Boolean, default: false, index: true },
    passed: { type: Boolean, default: null },
    category: { type: String, default: "edge" },
    description: { type: String, default: "" },
    bugClass: { type: String, default: "unknown", index: true },
    size: { type: Number, default: 0 },
    generationSource: { type: String, default: "llm-assisted" },
    timedOut: { type: Boolean, default: false },
    exitCode: { type: Number, default: null },
    suspiciousOutput: { type: Boolean, default: false },
    runtimeError: { type: Boolean, default: false },
  },
  { timestamps: true },
);

hiddenTestSchema.index({ roomId: 1, createdAt: -1 });

export default mongoose.model("HiddenTest", hiddenTestSchema);
