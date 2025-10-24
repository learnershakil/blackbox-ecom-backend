import express, { Express, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import { config } from "dotenv";

// Load environment variables
config();

// Import middleware
import {
  httpLogger,
  globalErrorHandler,
  AppError,
  applySecurity,
  generalLimiter,
  performanceLogger,
  requestContextLogger,
  apiNotFoundHandler,
} from "./middlewares";

// Import routes
import router from "./routes";

// Import documentation setup
import { setupDocs } from "./config/docs";

// Create Express application
const app: Express = express();

// Trust proxy (important for rate limiting, IP detection)
app.set("trust proxy", 1);

// Health check endpoint (before middleware)
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Apply security middleware
app.use(applySecurity);

// Apply logging middleware
app.use(httpLogger);
app.use(performanceLogger);
app.use(requestContextLogger);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Global rate limiting
app.use("/api/", generalLimiter);

// API Routes
app.use("/api", router);

// Setup API documentation
setupDocs(app);

// API documentation route
app.get("/api/docs", (req: Request, res: Response) => {
  res.redirect("/docs");
});

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "BlackBox Commerce API",
    version: "1.0.0",
    documentation: "/docs",
    health: "/health",
    timestamp: new Date().toISOString(),
  });
});

// Handle API routes that are not found (with helpful suggestions)
app.use(apiNotFoundHandler);

// Handle all other undefined routes
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(
    `Route '${req.originalUrl}' not found. Please check the API documentation at /docs for available endpoints.`,
    404
  );
  next(error);
});

// Global error handler (must be last middleware)
app.use(globalErrorHandler);

export default app;
