import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { getDB } from "../config/db.js";

const router = Router();

async function getAdmin(req: Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user?.id) return null;
  if (!ObjectId.isValid(session.user.id)) return null;

  const user = await getDB()
    .collection("user")
    .findOne({ _id: new ObjectId(session.user.id) });

  if (user?.role !== "admin") return null;

  return user;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const admin = await getAdmin(req);

    if (!admin) {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const users = await getDB()
      .collection("user")
      .find(
        {},
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
            role: 1,
            emailVerified: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    const safeUsers = users.map((user) => ({
      _id: String(user._id),
      name: user.name || "Unknown",
      email: user.email || "",
      image: user.image || null,
      role: user.role === "admin" ? "admin" : "customer",
      emailVerified: Boolean(user.emailVerified),
      createdAt: user.createdAt || null,
    }));

    res.json({
      success: true,
      data: safeUsers,
    });
  } catch (error) {
    console.error("Failed to load users:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load users",
    });
  }
});

export default router;
