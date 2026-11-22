import express from "express";
import cors from "cors";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./config/auth.js";
import servicesRoutes from "./routes/services.routes.js";
import appointmentsRoutes from "./routes/appointments.routes.js";

const app = express();

const clientURL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(
  cors({
    origin: [clientURL, "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "SalonBook API is running successfully!",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "SalonBook backend is healthy",
  });
});

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
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to fetch session",
    });
  }
});

app.use("/api/services", servicesRoutes);
app.use("/api/appointments", appointmentsRoutes);

export default app;
