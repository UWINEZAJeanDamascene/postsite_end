import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import { config } from "./config";
import {
  initializeWebSocketServer,
  closeWebSocketServer,
} from "./websocket/server";
import { connectDB, disconnectDB } from "./config/mongoose";

// Import routes
import authRoutes from "./routes/auth";
import sitesRoutes from "./routes/sites";
import siteRecordsRoutes from "./routes/siteRecords";
import mainStockRoutes from "./routes/mainStock";
import viewsRoutes from "./routes/views";
import materialsRoutes from "./routes/materials";
import actionLogsRoutes from "./routes/actionLogs";
import notificationsRoutes from "./routes/notifications";
import companiesRoutes from "./routes/companies";
import purchaseOrderRoutes from "./routes/purchaseOrders";
import supplierRoutes from "./routes/suppliers";
import deliveryNoteRoutes from "./routes/deliveryNotes";
import purchaseReturnRoutes from "./routes/purchaseReturns";
import quotationRoutes from "./routes/quotations";

const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
// Allow cross-origin requests with credentials (cookies)
// CORS configuration: allow the configured FRONTEND_URL, any vercel.app subdomain,
// and common localhost dev origins. Echo the request origin when allowing credentials.
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (curl, Postman, mobile apps)
      if (!origin) return callback(null, true);

      const devOrigins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
      ];

      // Allow explicit FRONTEND_URL from env (useful for custom domains)
      const frontendUrl = config.FRONTEND_URL;

      // Allow localhost during development and the configured frontend URL
      if (devOrigins.includes(origin) || origin === frontendUrl) {
        return callback(null, true);
      }

      // Allow any vercel.app subdomain (production preview and deployments)
      try {
        const vercelRegex = /\.vercel\.app$/i;
        if (vercelRegex.test(origin)) {
          return callback(null, true);
        }
      } catch (err) {
        // fallthrough to block
      }

      console.warn("CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Parse cookies for authentication
app.use(cookieParser());

// API info endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "Lilstock API Server",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/auth/*",
      sites: "/sites/*",
      "main-stock": "/main-stock/*",
      "purchase-orders": "/purchase-orders/*",
      // Add other endpoints as needed
    },
  });
});

// Health check
app.get("/health", async (_req, res) => {
  try {
    // Check database connection
    const mongoose = (await import("./config/mongoose")).default;
    if (mongoose.connection.readyState === 1) {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
        environment: config.NODE_ENV,
      });
    } else {
      throw new Error("Database not connected");
    }
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: "Database connection failed",
    });
  }
});

// Debug endpoint to inspect incoming request auth headers/cookies (safe: does not return tokens)
app.get("/debug/request-info", (req, res) => {
  try {
    const origin = req.headers.origin || null;
    const hasAuthHeader = !!req.headers.authorization;
    const hasCookie = !!(req.cookies && (req.cookies as any).access_token);
    const authHeaderSample =
      typeof req.headers.authorization === "string"
        ? req.headers.authorization.slice(0, 40) +
          (req.headers.authorization.length > 40 ? "..." : "")
        : null;
    const cookieLength =
      req.cookies && (req.cookies as any).access_token
        ? (req.cookies as any).access_token.length
        : 0;

    res.json({
      origin,
      hasAuthHeader,
      hasCookie,
      authHeaderSample,
      cookieLength,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to inspect request" });
  }
});

// API routes
app.use("/auth", authRoutes);
app.use("/sites", sitesRoutes);
app.use("/site-records", siteRecordsRoutes);
app.use("/main-stock", mainStockRoutes);
app.use("/views", viewsRoutes);
app.use("/materials", materialsRoutes);
app.use("/action-logs", actionLogsRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/companies", companiesRoutes);
app.use("/purchase-orders", purchaseOrderRoutes);
app.use("/suppliers", supplierRoutes);
app.use("/delivery-notes", deliveryNoteRoutes);
app.use("/purchase-returns", purchaseReturnRoutes);
app.use("/quotations", quotationRoutes);
console.log("Routes registered successfully");

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Error:", err);
    res.status(500).json({
      error:
        config.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    });
  },
);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Connect to database and start server
async function startServer() {
  try {
    console.log("Connecting to database...");
    await connectDB();
    console.log("Database connected successfully");

    const server = app.listen(config.PORT, () => {
      console.log(`API server running on port ${config.PORT}`);
      console.log(
        `Health check available at http://localhost:${config.PORT}/health`,
      );
    });

    // Initialize WebSocket server
    initializeWebSocketServer();

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      console.log("SIGTERM received, shutting down gracefully");
      closeWebSocketServer();
      server.close(() => {
        console.log("HTTP server closed");
      });
      await disconnectDB();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("SIGINT received, shutting down gracefully");
      closeWebSocketServer();
      server.close(() => {
        console.log("HTTP server closed");
      });
      await disconnectDB();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;
