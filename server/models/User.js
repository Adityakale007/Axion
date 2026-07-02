import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatarId: { type: String, default: "clever-fox" },
  forkspaceRating: { type: Number, default: 1000 },
  totalSessions: { type: Number, default: 0 },
  problemsAttempted: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  lastActiveDate: { type: Date, default: null },
  titles: [{ type: String }],
  avatar: { type: String, default: "dev1" },
  sessionsAsNavigator: { type: Number, default: 0 },
  activityLog: [
    {
      date: { type: Date, default: Date.now },
      sessionId: { type: String, default: "" },
    },
  ],
  roomHistory: [
    {
      roomId: String,
      role: String,
      username: String,
      problemTitle: String,
      problemCode: String,
      updatedAt: { type: Date, default: Date.now },
    },
  ],
  runHistory: [
    {
      status: String,
      time: String,
      memory: String,
      passed: Boolean,
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
