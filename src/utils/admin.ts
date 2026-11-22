import type { Request } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { getDB } from "../config/db.js";

export async function isAdmin(req: Request): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user?.id) return false;

  if (!ObjectId.isValid(session.user.id)) {
    return false;
  }

  const user = await getDB()
    .collection("user")
    .findOne({
      _id: new ObjectId(session.user.id),
    });

  return user?.role === "admin";
}
