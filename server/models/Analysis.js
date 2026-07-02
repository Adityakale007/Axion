import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema(
  {
    language: { type: String, required: true },
    prompt: { type: String, default: "" },
    code: { type: String, required: true },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model("Analysis", analysisSchema);
