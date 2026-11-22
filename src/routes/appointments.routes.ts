import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { getDB } from "../config/db.js";

const router = Router();

const bookingSchema = z.object({
  serviceId: z.string().refine(ObjectId.isValid, "Invalid service ID"),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  phone: z.string().trim().min(7).max(20),
  message: z.string().max(500).optional(),
});

async function getCurrentUser(req: Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) return null;

  const dbUser = await getDB()
    .collection("user")
    .findOne({ id: session.user.id });

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: dbUser?.role === "admin" ? "admin" : "customer",
  };
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      res.status(401).json({ success: false, message: "Please log in" });
      return;
    }

    const parsed = bookingSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        errors: z.flattenError(parsed.error),
      });
      return;
    }

    const { serviceId, date, time, phone, message } = parsed.data;

    if (date < new Date().toISOString().slice(0, 10)) {
      res.status(400).json({
        success: false,
        message: "Please choose a future date",
      });
      return;
    }

    const service = await getDB()
      .collection("services")
      .findOne({ _id: new ObjectId(serviceId) });

    if (!service) {
      res.status(404).json({
        success: false,
        message: "Service not found",
      });
      return;
    }

    const appointment = {
      userId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      serviceId,
      serviceName: service.name,
      price: service.price,
      date,
      time,
      phone,
      message: message || "",
      status: "pending",
      paymentStatus: "unpaid",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB()
      .collection("appointments")
      .insertOne(appointment);

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: { _id: result.insertedId, ...appointment },
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to book appointment",
    });
  }
});

router.get("/my", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const appointments = await getDB()
      .collection("appointments")
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: appointments });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to load appointments",
    });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);

    if (user?.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const appointments = await getDB()
      .collection("appointments")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: appointments });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to load appointments",
    });
  }
});

router.patch("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = String(req.params.id);

    if (!ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid appointment ID" });
      return;
    }

    const result = await getDB()
      .collection("appointments")
      .updateOne(
        {
          _id: new ObjectId(id),
          userId: user.id,
          status: { $in: ["pending", "confirmed"] },
          paymentStatus: "unpaid",
        },
        {
          $set: {
            status: "cancelled",
            updatedAt: new Date(),
          },
        },
      );

    if (!result.modifiedCount) {
      res.status(409).json({
        success: false,
        message: "Appointment cannot be cancelled",
      });
      return;
    }

    res.json({ success: true, message: "Appointment cancelled" });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to cancel appointment",
    });
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);

    if (user?.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const id = String(req.params.id);

    if (!ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid appointment ID" });
      return;
    }

    const parsed = z
      .object({
        status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid status" });
      return;
    }

    const result = await getDB()
      .collection("appointments")
      .updateOne(
        {
          _id: new ObjectId(id),
          status: { $ne: "cancelled" },
        },
        {
          $set: {
            status: parsed.data.status,
            updatedAt: new Date(),
          },
        },
      );

    if (!result.matchedCount) {
      res.status(404).json({
        success: false,
        message: "Appointment not found or already cancelled",
      });
      return;
    }

    res.json({ success: true, message: "Appointment status updated" });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to update appointment",
    });
  }
});

export default router;
