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

const statusSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});

async function getCurrentUser(req: Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user?.id) return null;

  if (!ObjectId.isValid(session.user.id)) {
    return null;
  }

  const dbUser = await getDB()
    .collection("user")
    .findOne({
      _id: new ObjectId(session.user.id),
    });

  if (!dbUser) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: dbUser.role === "admin" ? "admin" : "customer",
  };
}

// Active Stripe Checkout sessions must not be cancelled
// or have their appointment status changed.
function checkoutNotActive() {
  return {
    $or: [
      { checkoutExpiresAt: { $exists: false } },
      { checkoutExpiresAt: null },
      { checkoutExpiresAt: { $lte: new Date() } },
    ],
  };
}

// CREATE APPOINTMENT
router.post("/", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Please log in",
      });
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
      .findOne({
        _id: new ObjectId(serviceId),
      });

    if (!service) {
      res.status(404).json({
        success: false,
        message: "Service not found",
      });
      return;
    }

    const now = new Date();

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
      createdAt: now,
      updatedAt: now,
    };

    const result = await getDB()
      .collection("appointments")
      .insertOne(appointment);

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: {
        _id: result.insertedId,
        ...appointment,
      },
    });
  } catch (error) {
    console.error("Booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to book appointment",
    });
  }
});

// CUSTOMER APPOINTMENTS
router.get("/my", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const appointments = await getDB()
      .collection("appointments")
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.error("Load appointments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load appointments",
    });
  }
});

// ADMIN: ALL APPOINTMENTS
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

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.error("Admin appointments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load appointments",
    });
  }
});

// CUSTOMER: CANCEL APPOINTMENT
router.patch("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const id = String(req.params.id);

    if (!ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
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
          ...checkoutNotActive(),
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
        message:
          "Appointment cannot be cancelled. It may be paid, completed, or have an active checkout.",
      });
      return;
    }

    res.json({
      success: true,
      message: "Appointment cancelled",
    });
  } catch (error) {
    console.error("Cancellation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to cancel appointment",
    });
  }
});

// ADMIN: UPDATE APPOINTMENT STATUS
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
      res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
      return;
    }

    const parsed = statusSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid status",
      });
      return;
    }

    const appointments = getDB().collection("appointments");

    const appointment = await appointments.findOne({
      _id: new ObjectId(id),
    });

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
      return;
    }

    if (appointment.status === "cancelled") {
      res.status(409).json({
        success: false,
        message: "Cancelled appointments cannot be modified",
      });
      return;
    }

    // Paid appointments cannot be cancelled or returned
    // to pending through the admin dashboard.
    if (
      appointment.paymentStatus === "paid" &&
      (parsed.data.status === "cancelled" || parsed.data.status === "pending")
    ) {
      res.status(409).json({
        success: false,
        message:
          "Paid appointments cannot be cancelled or moved to pending without a refund workflow",
      });
      return;
    }

    const result = await appointments.updateOne(
      {
        _id: new ObjectId(id),
        status: { $ne: "cancelled" },
        ...checkoutNotActive(),
        ...(parsed.data.status === "cancelled" ||
        parsed.data.status === "pending"
          ? { paymentStatus: { $ne: "paid" } }
          : {}),
      },
      {
        $set: {
          status: parsed.data.status,
          updatedAt: new Date(),
        },
      },
    );

    if (!result.matchedCount) {
      res.status(409).json({
        success: false,
        message:
          "Appointment status cannot be updated while checkout is active or the requested change is not allowed",
      });
      return;
    }

    res.json({
      success: true,
      message: "Appointment status updated",
    });
  } catch (error) {
    console.error("Status update error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update appointment",
    });
  }
});

export default router;
