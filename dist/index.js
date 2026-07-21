"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const prisma_1 = __importDefault(require("./config/prisma"));
const server_1 = require("./websocket/server");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const sites_1 = __importDefault(require("./routes/sites"));
const siteRecords_1 = __importDefault(require("./routes/siteRecords"));
const mainStock_1 = __importDefault(require("./routes/mainStock"));
const views_1 = __importDefault(require("./routes/views"));
const materials_1 = __importDefault(require("./routes/materials"));
const actionLogs_1 = __importDefault(require("./routes/actionLogs"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const companies_1 = __importDefault(require("./routes/companies"));
const purchaseOrders_1 = __importDefault(require("./routes/purchaseOrders"));
const suppliers_1 = __importDefault(require("./routes/suppliers"));
const deliveryNotes_1 = __importDefault(require("./routes/deliveryNotes"));
const purchaseReturns_1 = __importDefault(require("./routes/purchaseReturns"));
const quotations_1 = __importDefault(require("./routes/quotations"));
const clients_1 = __importDefault(require("./routes/clients"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
}));
// Allow cross-origin requests with credentials (cookies)
// CORS configuration: allow the configured FRONTEND_URL, any vercel.app subdomain,
// and common localhost dev origins. Echo the request origin when allowing credentials.
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (curl, Postman, mobile apps)
        if (!origin)
            return callback(null, true);
        const devOrigins = [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ];
        // Allow explicit FRONTEND_URL from env (useful for custom domains)
        const frontendUrl = config_1.config.FRONTEND_URL;
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
        }
        catch (err) {
            // fallthrough to block
        }
        console.warn("CORS blocked origin:", origin);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Parse cookies for authentication
app.use((0, cookie_parser_1.default)());
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
            quotations: "/quotations/*",
            invoices: "/invoices/*",
            clients: "/clients/*",
            // Add other endpoints as needed
        },
    });
});
// Health check
app.get("/health", async (_req, res) => {
    try {
        await prisma_1.default.$queryRaw `SELECT 1`;
        res.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            database: "connected",
            environment: config_1.config.NODE_ENV,
            routes: { invoices: "/invoices", apiInvoices: "/api/invoices" },
        });
    }
    catch (error) {
        console.error("Health check failed:", error);
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
        const hasCookie = !!(req.cookies && req.cookies.access_token);
        const authHeaderSample = typeof req.headers.authorization === "string"
            ? req.headers.authorization.slice(0, 40) +
                (req.headers.authorization.length > 40 ? "..." : "")
            : null;
        const cookieLength = req.cookies && req.cookies.access_token
            ? req.cookies.access_token.length
            : 0;
        res.json({
            origin,
            hasAuthHeader,
            hasCookie,
            authHeaderSample,
            cookieLength,
        });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to inspect request" });
    }
});
// API routes
app.use("/auth", auth_1.default);
app.use("/api/auth", auth_1.default);
app.use("/sites", sites_1.default);
app.use("/api/sites", sites_1.default);
app.use("/site-records", siteRecords_1.default);
app.use("/api/site-records", siteRecords_1.default);
app.use("/main-stock", mainStock_1.default);
app.use("/api/main-stock", mainStock_1.default);
app.use("/views", views_1.default);
app.use("/api/views", views_1.default);
app.use("/materials", materials_1.default);
app.use("/api/materials", materials_1.default);
app.use("/action-logs", actionLogs_1.default);
app.use("/api/action-logs", actionLogs_1.default);
app.use("/notifications", notifications_1.default);
app.use("/api/notifications", notifications_1.default);
app.use("/companies", companies_1.default);
app.use("/api/companies", companies_1.default);
app.use("/purchase-orders", purchaseOrders_1.default);
app.use("/api/purchase-orders", purchaseOrders_1.default);
app.use("/suppliers", suppliers_1.default);
app.use("/api/suppliers", suppliers_1.default);
app.use("/delivery-notes", deliveryNotes_1.default);
app.use("/api/delivery-notes", deliveryNotes_1.default);
app.use("/purchase-returns", purchaseReturns_1.default);
app.use("/api/purchase-returns", purchaseReturns_1.default);
app.use("/quotations", quotations_1.default);
app.use("/api/quotations", quotations_1.default);
app.use("/invoices", invoices_1.default);
app.use("/api/invoices", invoices_1.default);
app.use("/clients", clients_1.default);
app.use("/api/clients", clients_1.default);
console.log("Routes registered successfully");
// Error handling middleware
app.use((err, _req, res, _next) => {
    console.error("Error:", err);
    res.status(500).json({
        error: config_1.config.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
});
// Connect to database and start server
async function startServer() {
    try {
        console.log("Connecting to database...");
        await prisma_1.default.$connect();
        console.log("Database connected successfully");
        const server = app.listen(config_1.config.PORT, () => {
            console.log(`API server running on port ${config_1.config.PORT}`);
            console.log(`Health check available at http://localhost:${config_1.config.PORT}/health`);
        });
        // Initialize WebSocket server
        (0, server_1.initializeWebSocketServer)();
        // Graceful shutdown
        process.on("SIGTERM", async () => {
            console.log("SIGTERM received, shutting down gracefully");
            (0, server_1.closeWebSocketServer)();
            server.close(() => {
                console.log("HTTP server closed");
            });
            await prisma_1.default.$disconnect();
            process.exit(0);
        });
        process.on("SIGINT", async () => {
            console.log("SIGINT received, shutting down gracefully");
            (0, server_1.closeWebSocketServer)();
            server.close(() => {
                console.log("HTTP server closed");
            });
            await prisma_1.default.$disconnect();
            process.exit(0);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
if (require.main === module) {
    startServer();
}
exports.default = app;
//# sourceMappingURL=index.js.map