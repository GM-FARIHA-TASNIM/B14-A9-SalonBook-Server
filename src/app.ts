import express from "express";
import cors from "cors";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";

import { auth } from "./config/auth.js";

import servicesRoutes from "./routes/services.routes.js";
import appointmentsRoutes from "./routes/appointments.routes.js";
import usersRoutes from "./routes/users.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import stripeWebhookRoutes from "./routes/stripe-webhook.routes.js";

const app = express();

const clientURL = process.env.CLIENT_URL || "http://localhost:3000";

// CORS Configuration
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Stripe Webhook
// IMPORTANT: Must be registered before express.json()
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookRoutes,
);

// Better Auth
app.all("/api/auth/*splat", toNodeHandler(auth));

// JSON Body Parser
app.use(express.json());

// Home Route
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "SalonBook API is running successfully!",
  });
});

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "SalonBook backend is healthy",
  });
});

// Current Logged-in User
app.get("/api/me", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    res.json({
      success: true,
      user: session.user,
    });
  } catch (error) {
    console.error("Session error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch session",
    });
  }
});

// Services Routes
app.use("/api/services", servicesRoutes);

// Appointment Routes
app.use("/api/appointments", appointmentsRoutes);

// Users Routes
app.use("/api/users", usersRoutes);

// Stripe Payment Routes
app.use("/api/payments", paymentsRoutes);

// Unknown API Routes
app.use("/api", (_req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

export default app;
