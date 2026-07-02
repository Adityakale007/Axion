import mongoose from "mongoose";
import process from "process";

const MONGODB_URI = process.env.MONGODB_URI;

if (!globalThis.__forkspaceDb) {
  globalThis.__forkspaceDb = { connection: null, promise: null };
}

export async function connectDb() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (globalThis.__forkspaceDb.connection) {
    return globalThis.__forkspaceDb.connection;
  }

  if (!globalThis.__forkspaceDb.promise) {
    mongoose.set("bufferCommands", false);
    globalThis.__forkspaceDb.promise = mongoose.connect(MONGODB_URI).then((conn) => {
      globalThis.__forkspaceDb.connection = conn;
      return conn;
    });
  }

  return globalThis.__forkspaceDb.promise;
}
