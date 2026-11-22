import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { getDB } from "../config/db.js";
import { isAdmin } from "../utils/admin.js";

const router = Router();

const serviceSchema = z.object({
  name: z.string().trim().min(2),
  category: z.enum(["Hair", "Facial", "Nails", "Makeup", "Spa"]),
  description: z.string().trim().min(10),
  price: z.number().positive(),
  duration: z.number().int().positive(),
  image: z.url(),
  featured: z.boolean().default(false),
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, category } = req.query;

    const filter: Record<string, unknown> = {};

    if (typeof search === "string" && search.trim()) {
      filter.name = {
        $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    if (typeof category === "string" && category !== "All") {
      filter.category = category;
    }

    const services = await getDB()
      .collection("services")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: services });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to load services" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid service ID" });
      return;
    }

    const service = await getDB()
      .collection("services")
      .findOne({ _id: new ObjectId(id) });

    if (!service) {
      res.status(404).json({ success: false, message: "Service not found" });
      return;
    }

    res.json({ success: true, data: service });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load service" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req))) {
      res
        .status(403)
        .json({ success: false, message: "Admin access required" });
      return;
    }

    const parsed = serviceSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const result = await getDB()
      .collection("services")
      .insertOne({
        ...parsed.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    res.status(201).json({
      success: true,
      message: "Service created",
      id: result.insertedId,
    });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to create service" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req))) {
      res
        .status(403)
        .json({ success: false, message: "Admin access required" });
      return;
    }

    const id = String(req.params.id);

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid service ID" });
      return;
    }

    const parsed = serviceSchema.partial().safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ success: false, message: "No fields to update" });
      return;
    }

    const result = await getDB()
      .collection("services")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...parsed.data, updatedAt: new Date() } },
      );

    if (!result.matchedCount) {
      res.status(404).json({ success: false, message: "Service not found" });
      return;
    }

    res.json({ success: true, message: "Service updated" });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to update service" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req))) {
      res
        .status(403)
        .json({ success: false, message: "Admin access required" });
      return;
    }

    const id = String(req.params.id);

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid service ID" });
      return;
    }

    const result = await getDB()
      .collection("services")
      .deleteOne({ _id: new ObjectId(id) });

    if (!result.deletedCount) {
      res.status(404).json({ success: false, message: "Service not found" });
      return;
    }

    res.json({ success: true, message: "Service deleted" });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete service" });
  }
});

export default router;
