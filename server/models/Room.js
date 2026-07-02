import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  code: { type: String, default: "" },
  language: { type: String, default: "cpp" },
  problem: { type: mongoose.Schema.Types.Mixed, default: {} },
  session: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Room", roomSchema);
