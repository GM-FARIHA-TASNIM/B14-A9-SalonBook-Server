import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import Stripe from "stripe";
import { auth } from "../config/auth.js";
import { getDB } from "../config/db.js";

const router = Router();

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  return new Stripe(key);
}

router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user?.id) {
      res.status(401).json({
        success: false,
        message: "Please sign in first",
      });
      return;
    }

    const appointmentId: unknown = req.body?.appointmentId;

    if (typeof appointmentId !== "string" || !ObjectId.isValid(appointmentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
      return;
    }

    const appointments = getDB().collection("appointments");

    const appointment = await appointments.findOne({
      _id: new ObjectId(appointmentId),
      userId: session.user.id,
    });

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
      return;
    }

    if (
      appointment.status !== "confirmed" ||
      appointment.paymentStatus !== "unpaid"
    ) {
      res.status(409).json({
        success: false,
        message: "Only confirmed unpaid appointments can be paid",
      });
      return;
    }

    const price = Number(appointment.price);

    if (!Number.isFinite(price) || price <= 0 || Math.round(price * 100) < 1) {
      res.status(400).json({
        success: false,
        message: "Invalid appointment price",
      });
      return;
    }

    const stripe = stripeClient();
    const now = new Date();

    // Return an existing active Stripe Checkout session.
    if (
      typeof appointment.checkoutSessionId === "string" &&
      appointment.checkoutSessionId.length > 0
    ) {
      const existing = await stripe.checkout.sessions.retrieve(
        appointment.checkoutSessionId,
      );

      if (
        existing.status === "open" &&
        existing.url &&
        existing.expires_at * 1000 > Date.now()
      ) {
        res.json({
          success: true,
          data: {
            url: existing.url,
          },
        });
        return;
      }

      // Do not create another payment for a completed checkout.
      if (existing.status === "complete") {
        res.status(409).json({
          success: false,
          message:
            "Previous checkout completed. Please refresh your appointments.",
        });
        return;
      }
    }

    // Atomically reserve the appointment for Checkout.
    const reservation = await appointments.updateOne(
      {
        _id: appointment._id,
        userId: session.user.id,
        status: "confirmed",
        paymentStatus: "unpaid",
        $or: [
          { checkoutExpiresAt: { $exists: false } },
          { checkoutExpiresAt: null },
          { checkoutExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          checkoutExpiresAt: new Date(now.getTime() + 31 * 60 * 1000),
          updatedAt: now,
        },
      },
    );

    if (reservation.modifiedCount === 0) {
      res.status(409).json({
        success: false,
        message: "A checkout is already in progress. Please try again shortly.",
      });
      return;
    }

    let checkout: Stripe.Checkout.Session | null = null;

    try {
      const clientURL = process.env.CLIENT_URL || "http://localhost:3000";

      checkout = await stripe.checkout.sessions.create({
        mode: "payment",

        customer_email: session.user.email,

        client_reference_id: appointmentId,

        metadata: {
          appointmentId,
          userId: session.user.id,
        },

        line_items: [
          {
            price_data: {
              currency: "bdt",
              unit_amount: Math.round(price * 100),

              product_data: {
                name: String(appointment.serviceName || "Salon Service"),
              },
            },

            quantity: 1,
          },
        ],

        success_url:
          `${clientURL}/dashboard` + "?tab=appointments&payment=success",

        cancel_url:
          `${clientURL}/dashboard` + "?tab=appointments&payment=cancelled",

        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      });

      if (!checkout.url) {
        throw new Error("Stripe did not return a checkout URL");
      }

      const saved = await appointments.updateOne(
        {
          _id: appointment._id,
          userId: session.user.id,
          paymentStatus: "unpaid",
          status: "confirmed",
        },
        {
          $set: {
            checkoutSessionId: checkout.id,
            checkoutExpiresAt: new Date(checkout.expires_at * 1000),
            updatedAt: new Date(),
          },
        },
      );

      if (saved.modifiedCount === 0) {
        await stripe.checkout.sessions.expire(checkout.id);

        throw new Error("Unable to save the checkout session");
      }

      res.json({
        success: true,
        data: {
          url: checkout.url,
        },
      });
    } catch (error) {
      // Expire an orphaned Checkout session if one was created.
      if (checkout?.id) {
        try {
          const latest = await stripe.checkout.sessions.retrieve(checkout.id);

          if (latest.status === "open") {
            await stripe.checkout.sessions.expire(checkout.id);
          }
        } catch (cleanupError) {
          console.error("Stripe session cleanup failed:", cleanupError);
        }
      }

      // Release the reservation only if it is still unpaid.
      await appointments.updateOne(
        {
          _id: appointment._id,
          userId: session.user.id,
          paymentStatus: "unpaid",
          ...(checkout?.id
            ? { checkoutSessionId: checkout.id }
            : { checkoutSessionId: { $exists: false } }),
        },
        {
          $unset: {
            checkoutSessionId: "",
            checkoutExpiresAt: "",
          },
        },
      );

      throw error;
    }
  } catch (error) {
    console.error("Stripe checkout error:", error);

    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message === "STRIPE_SECRET_KEY is missing"
            ? "Stripe payment is not configured"
            : "Unable to create checkout session"
          : "Unexpected payment error",
    });
  }
});

export default router;
