import mongoose from "mongoose";
import process from "process";

const MONGODB_URI = process.env.MONGODB_URI;

if (!globalThis.__AxionDb) {
  globalThis.__AxionDb = { connection: null, promise: null };
}

export async function connectDb() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (globalThis.__AxionDb.connection) {
    return globalThis.__AxionDb.connection;
  }

  if (!globalThis.__AxionDb.promise) {
    mongoose.set("bufferCommands", false);
    globalThis.__AxionDb.promise = mongoose.connect(MONGODB_URI).then((conn) => {
      globalThis.__AxionDb.connection = conn;
      return conn;
    });
  }

  return globalThis.__AxionDb.promise;
}
