import mongoose from "mongoose";

const mockSummarySchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true },
    summary: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("MockSummary", mockSummarySchema);
