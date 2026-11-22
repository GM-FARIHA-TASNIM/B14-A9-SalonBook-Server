import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import Stripe from "stripe";
import { getDB } from "../config/db.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];

  if (!stripeSecret || !webhookSecret) {
    console.error("Stripe webhook configuration is missing");

    res.status(500).json({
      success: false,
      message: "Webhook configuration missing",
    });
    return;
  }

  if (typeof signature !== "string") {
    res.status(400).json({
      success: false,
      message: "Missing Stripe signature",
    });
    return;
  }

  const stripe = new Stripe(stripeSecret);

  let event: Stripe.Event;

  try {
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({
        success: false,
        message: "Webhook requires raw request body",
      });
      return;
    }

    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe signature verification failed:", error);

    res.status(400).json({
      success: false,
      message: "Invalid webhook signature",
    });
    return;
  }

  try {
    const supportedEvents = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ];

    if (!supportedEvents.includes(event.type)) {
      res.json({ received: true });
      return;
    }

    const checkout = event.data.object as Stripe.Checkout.Session;

    if (checkout.payment_status !== "paid") {
      res.json({ received: true });
      return;
    }

    const appointmentId = checkout.metadata?.appointmentId;
    const userId = checkout.metadata?.userId;

    if (!appointmentId || !ObjectId.isValid(appointmentId) || !userId) {
      console.error("Invalid appointment metadata", event.id);

      res.status(400).json({
        success: false,
        message: "Invalid appointment metadata",
      });
      return;
    }

    const appointments = getDB().collection("appointments");

    const appointment = await appointments.findOne({
      _id: new ObjectId(appointmentId),
      checkoutSessionId: checkout.id,
    });

    if (!appointment) {
      console.error("Appointment not found for Stripe Checkout:", checkout.id);

      res.status(409).json({
        success: false,
        message: "Appointment not found for checkout",
      });
      return;
    }

    const expectedAmount = Math.round(Number(appointment.price) * 100);

    const validPayment =
      Number.isSafeInteger(expectedAmount) &&
      expectedAmount > 0 &&
      checkout.currency?.toLowerCase() === "bdt" &&
      checkout.amount_total === expectedAmount &&
      checkout.metadata?.userId === appointment.userId &&
      checkout.client_reference_id === appointmentId &&
      checkout.mode === "payment" &&
      checkout.payment_status === "paid";

    if (!validPayment) {
      console.error("Stripe payment validation failed:", checkout.id);

      res.status(409).json({
        success: false,
        message: "Payment validation failed",
      });
      return;
    }

    // Repeated delivery of the same event must be safe.
    if (appointment.paymentStatus === "paid") {
      res.json({ received: true });
      return;
    }

    if (appointment.status !== "confirmed") {
      console.error("Appointment is no longer confirmed:", appointmentId);

      res.status(409).json({
        success: false,
        message: "Appointment status is not valid for payment",
      });
      return;
    }

    const now = new Date();

    const paymentIntentId =
      typeof checkout.payment_intent === "string"
        ? checkout.payment_intent
        : (checkout.payment_intent?.id ?? null);

    const result = await appointments.updateOne(
      {
        _id: appointment._id,
        checkoutSessionId: checkout.id,
        userId,
        status: "confirmed",
        paymentStatus: "unpaid",
      },
      {
        $set: {
          paymentStatus: "paid",
          stripePaymentIntentId: paymentIntentId,
          stripeCheckoutSessionId: checkout.id,
          stripeEventId: event.id,
          paidAt: now,
          updatedAt: now,
        },
        $unset: {
          checkoutExpiresAt: "",
        },
      },
    );

    if (result.modifiedCount === 0) {
      // Another webhook may have completed the same payment.
      const latest = await appointments.findOne({
        _id: appointment._id,
        checkoutSessionId: checkout.id,
      });

      if (latest?.paymentStatus !== "paid") {
        res.status(409).json({
          success: false,
          message: "Unable to confirm appointment payment",
        });
        return;
      }
    }

    console.log("Stripe payment processed:", checkout.id);

    res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);

    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
});

export default router;
