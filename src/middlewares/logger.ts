import * as winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import morgan, { Options } from "morgan";
import { Request, Response, NextFunction, RequestHandler } from "express";
import * as path from "path";
import * as fs from "fs";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""}`;
  })
);

// Create daily rotate file transport
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  format: logFormat,
});

// Create error log transport
const errorLogTransport = new (DailyRotateFile as any)({
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "30d",
  level: "error",
  format: logFormat,
});

// Create security log transport
const securityLogTransport = new (DailyRotateFile as any)({
  filename: path.join(logsDir, "security-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "30d",
  format: logFormat,
});

// Create access log transport for HTTP requests
const httpAccessLogTransport = new (DailyRotateFile as any)({
  filename: path.join(logsDir, "access-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
});

// Main application logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "blackbox-commerce-api" },
  transports: [dailyRotateFileTransport, errorLogTransport],
});

// Security logger for sensitive operations
export const securityLogger = winston.createLogger({
  level: "info",
  format: logFormat,
  defaultMeta: { service: "security" },
  transports: [securityLogTransport],
});

// Access logger for HTTP requests
export const httpAccessLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [httpAccessLogTransport],
});

// Add console transport in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Custom morgan token for user ID
morgan.token("user-id", (req: any) => {
  return req.user?.id || "anonymous";
});

// Custom morgan token for response time with color
morgan.token("response-time-colored", (req, res) => {
  const responseTime = parseFloat(
    (morgan as any).token("response-time")(req, res) || "0"
  );
  if (responseTime > 1000) return `\x1b[31m${responseTime}ms\x1b[0m`; // Red for >1s
  if (responseTime > 500) return `\x1b[33m${responseTime}ms\x1b[0m`; // Yellow for >500ms
  return `\x1b[32m${responseTime}ms\x1b[0m`; // Green for <500ms
});

// Custom morgan format for development
const devFormat = ":method :url :status :response-time-colored - :user-id";

// Custom morgan format for production
const prodFormat = JSON.stringify({
  method: ":method",
  url: ":url",
  status: ":status",
  responseTime: ":response-time",
  contentLength: ":res[content-length]",
  userAgent: ":user-agent",
  userId: ":user-id",
  ip: ":remote-addr",
  date: ":date[iso]",
});

// HTTP request logging middleware
export const httpLogger: RequestHandler = morgan(
  process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  {
    stream: {
      write: (message: string) => {
        if (process.env.NODE_ENV === "production") {
          httpAccessLogger.info(JSON.parse(message.trim()));
        } else {
          process.stdout.write(message);
        }
      },
    },
    skip: (req: Request) => {
      // Skip logging for health checks and static assets
      return req.url === "/health" || req.url.startsWith("/static");
    },
  }
);

// Error logging middleware
export const errorLogger = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error("Request Error", {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: (req as any).user?.id,
    },
    timestamp: new Date().toISOString(),
  });

  next(error);
};

// Security event logger
export const logSecurityEvent = (
  event: string,
  req: Request,
  details?: any
) => {
  securityLogger.info("Security Event", {
    event,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: (req as any).user?.id,
    url: req.url,
    method: req.method,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Database operation logger
export const dbLogger = {
  info: (operation: string, collection: string, details?: any) => {
    logger.info("Database Operation", {
      operation,
      collection,
      details,
      timestamp: new Date().toISOString(),
    });
  },
  error: (
    operation: string,
    collection: string,
    error: Error,
    details?: any
  ) => {
    logger.error("Database Error", {
      operation,
      collection,
      error: {
        message: error.message,
        stack: error.stack,
      },
      details,
      timestamp: new Date().toISOString(),
    });
  },
};

// Performance logging middleware
export const performanceLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;

    // Log slow requests (>1000ms)
    if (duration > 1000) {
      logger.warn("Slow Request", {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        status: res.statusCode,
        ip: req.ip,
        userId: (req as any).user?.id,
      });
    }
  });

  next();
};

// Request context logger (adds request ID)
export const requestContextLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  logger.defaultMeta = {
    ...logger.defaultMeta,
    requestId,
  };

  next();
};

// Combine all logging middleware
export const loggingMiddleware: RequestHandler[] = [
  requestContextLogger,
  httpLogger,
  performanceLogger,
];

// Log application startup
export const logStartup = (port: number) => {
  logger.info("Application Started", {
    port,
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
};

// Log application shutdown
export const logShutdown = (signal: string) => {
  logger.info("Application Shutdown", {
    signal,
    timestamp: new Date().toISOString(),
  });
};

// Export individual loggers for specific use cases
export {
  logger as appLogger,
  securityLogger as secLogger,
  httpAccessLogger as accessLogger,
};

export default logger;
