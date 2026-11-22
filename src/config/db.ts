import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing");
}

export const mongoClient = new MongoClient(uri);

export const db: Db = mongoClient.db(process.env.DB_NAME || "salonbook");

export async function connectDB(): Promise<Db> {
  await mongoClient.connect();
  await db.command({ ping: 1 });

  console.log("MongoDB connected successfully!");
  return db;
}

export function getDB(): Db {
  return db;
}
