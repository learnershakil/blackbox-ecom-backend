import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

// Log levels
export const LogLevel = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  HTTP: "http",
  DEBUG: "debug",
} as const;

export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

// Custom format for console logs
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Custom format for file logs
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), "logs");

class Logger {
  private static instance: winston.Logger;

  private static createLogger(): winston.Logger {
    return winston.createLogger({
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      defaultMeta: {
        service: "blackbox-commerce",
        environment: process.env.NODE_ENV || "development",
      },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: consoleFormat,
          silent: process.env.NODE_ENV === "test",
        }),

        // Daily rotate file for all logs
        new winston.transports.DailyRotateFile({
          filename: path.join(logsDir, "application-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "14d",
          format: fileFormat,
        }),

        // Daily rotate file for error logs only
        new winston.transports.DailyRotateFile({
          filename: path.join(logsDir, "error-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "30d",
          level: "error",
          format: fileFormat,
        }),

        // Daily rotate file for HTTP logs
        new winston.transports.DailyRotateFile({
          filename: path.join(logsDir, "http-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "7d",
          level: "http",
          format: fileFormat,
        }),
      ],

      // Handle uncaught exceptions and rejections
      exceptionHandlers: [
        new winston.transports.DailyRotateFile({
          filename: path.join(logsDir, "exceptions-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "30d",
          format: fileFormat,
        }),
      ],

      rejectionHandlers: [
        new winston.transports.DailyRotateFile({
          filename: path.join(logsDir, "rejections-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "30d",
          format: fileFormat,
        }),
      ],

      exitOnError: false,
    });
  }

  public static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = Logger.createLogger();
    }
    return Logger.instance;
  }

  // Convenience methods
  public static error(message: string, meta?: any): void {
    Logger.getInstance().error(message, meta);
  }

  public static warn(message: string, meta?: any): void {
    Logger.getInstance().warn(message, meta);
  }

  public static info(message: string, meta?: any): void {
    Logger.getInstance().info(message, meta);
  }

  public static http(message: string, meta?: any): void {
    Logger.getInstance().http(message, meta);
  }

  public static debug(message: string, meta?: any): void {
    Logger.getInstance().debug(message, meta);
  }

  // Database operation logging
  public static dbQuery(
    operation: string,
    collection: string,
    query?: any
  ): void {
    Logger.getInstance().debug(`DB Query: ${operation} on ${collection}`, {
      query,
    });
  }

  public static dbError(
    operation: string,
    collection: string,
    error: any
  ): void {
    Logger.getInstance().error(`DB Error: ${operation} on ${collection}`, {
      error: error.message,
    });
  }

  // Authentication logging
  public static authSuccess(userId: string, action: string): void {
    Logger.getInstance().info(`Auth Success: ${action} for user ${userId}`);
  }

  public static authFailure(action: string, reason: string, meta?: any): void {
    Logger.getInstance().warn(`Auth Failure: ${action} - ${reason}`, meta);
  }

  // Security logging
  public static securityEvent(
    event: string,
    severity: "low" | "medium" | "high",
    meta?: any
  ): void {
    Logger.getInstance().warn(
      `Security Event [${severity.toUpperCase()}]: ${event}`,
      meta
    );
  }

  // Performance logging
  public static performance(
    operation: string,
    duration: number,
    meta?: any
  ): void {
    Logger.getInstance().info(
      `Performance: ${operation} took ${duration}ms`,
      meta
    );
  }

  // API logging
  public static apiRequest(
    method: string,
    url: string,
    userId?: string,
    duration?: number
  ): void {
    Logger.getInstance().http(`API Request: ${method} ${url}`, {
      method,
      url,
      userId,
      duration,
    });
  }

  public static apiError(
    method: string,
    url: string,
    error: any,
    userId?: string
  ): void {
    Logger.getInstance().error(`API Error: ${method} ${url}`, {
      method,
      url,
      error: error.message,
      userId,
    });
  }

  // Business logic logging
  public static business(event: string, meta?: any): void {
    Logger.getInstance().info(`Business Event: ${event}`, meta);
  }

  // Payment logging
  public static payment(
    event: string,
    orderId: string,
    amount?: number,
    meta?: any
  ): void {
    Logger.getInstance().info(`Payment Event: ${event} for order ${orderId}`, {
      orderId,
      amount,
      ...meta,
    });
  }

  // Email logging
  public static email(
    event: string,
    recipient: string,
    template?: string,
    meta?: any
  ): void {
    Logger.getInstance().info(`Email Event: ${event} to ${recipient}`, {
      recipient,
      template,
      ...meta,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
export default Logger;
