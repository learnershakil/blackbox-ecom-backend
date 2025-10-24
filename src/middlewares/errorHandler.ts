import { Request, Response, NextFunction } from "express";
import mongoose, { CastError } from "mongoose";

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  message: string;
  error?:
    | string
    | {
        code: string;
        timestamp: string;
        name?: string;
      };
  stack?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Handle MongoDB Cast Error (Invalid ObjectId)
const handleCastError = (error: CastError): AppError => {
  const message = `Invalid ${error.path}: ${error.value}`;
  return new AppError(message, 400);
};

// Handle MongoDB Validation Error
const handleValidationError = (
  error: mongoose.Error.ValidationError
): AppError => {
  const errors = Object.values(error.errors).map((err: any) => err.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

// Handle MongoDB Duplicate Key Error
const handleDuplicateKeyError = (error: any): AppError => {
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];
  const message = `${field} '${value}' already exists. Please use another value.`;
  return new AppError(message, 400);
};

// Handle JWT errors
const handleJWTError = (): AppError => {
  return new AppError("Invalid token. Please log in again.", 401);
};

const handleJWTExpiredError = (): AppError => {
  return new AppError("Your token has expired. Please log in again.", 401);
};

// Send error response in development
const sendErrorDev = (err: AppError, res: Response): void => {
  const errorResponse: ErrorResponse = {
    success: false,
    message: err.message,
    error: {
      code: getErrorCode(err.statusCode, err.message),
      timestamp: new Date().toISOString(),
      name: err.name,
    },
    // Only include stack trace in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(err.statusCode).json(errorResponse);
};

// Send error response in production
const sendErrorProd = (err: AppError, res: Response): void => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const errorResponse: ErrorResponse = {
      success: false,
      message: err.message,
      error: {
        code: getErrorCode(err.statusCode, err.message),
        timestamp: new Date().toISOString(),
      },
    };

    res.status(err.statusCode).json(errorResponse);
  } else {
    // Programming or other unknown error: don't leak error details
    console.error("ERROR 💥", err);

    const errorResponse: ErrorResponse = {
      success: false,
      message: "Internal server error. Please try again later.",
      error: {
        code: "INTERNAL_SERVER_ERROR",
        timestamp: new Date().toISOString(),
      },
    };

    res.status(500).json(errorResponse);
  }
};

// Helper function to generate error codes
const getErrorCode = (statusCode: number, message: string): string => {
  if (statusCode === 404) {
    if (message.includes("find")) {
      return "ROUTE_NOT_FOUND";
    }
    return "RESOURCE_NOT_FOUND";
  }

  if (statusCode === 401) return "UNAUTHORIZED";
  if (statusCode === 403) return "FORBIDDEN";
  if (statusCode === 400) return "BAD_REQUEST";
  if (statusCode === 409) return "CONFLICT";
  if (statusCode === 422) return "VALIDATION_ERROR";
  if (statusCode === 429) return "RATE_LIMIT_EXCEEDED";

  return "SERVER_ERROR";
};

// Main error handling middleware
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set default error properties
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Determine if we're in development mode
  const isDevelopment = process.env.NODE_ENV === "development";

  // Create a copy of the error for processing
  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (err.name === "CastError") error = handleCastError(err);
  if (err.name === "ValidationError") error = handleValidationError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === "JsonWebTokenError") error = handleJWTError();
  if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

  // Send appropriate response based on environment
  if (isDevelopment) {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }

  // Log error for debugging (in all environments)
  console.error(`[${new Date().toISOString()}] ERROR:`, {
    message: err.message,
    statusCode: err.statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    ...(isDevelopment && { stack: err.stack }),
  });
};

// Async error handler wrapper
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

// 404 handler for unmatched routes
export const notFound = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const err = new AppError(
    `Can't find ${req.originalUrl} on this server!`,
    404
  );
  next(err);
};

// Handle unhandled promise rejections
export const handleUnhandledRejection = () => {
  process.on("unhandledRejection", (err: Error) => {
    console.log("UNHANDLED REJECTION! 💥 Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
  });
};

// Handle uncaught exceptions
export const handleUncaughtException = () => {
  process.on("uncaughtException", (err: Error) => {
    console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
  });
};

// Validation error formatter
export const formatValidationErrors = (
  errors: any[]
): Array<{ field: string; message: string }> => {
  return errors.map((error) => ({
    field: error.path || error.field || "unknown",
    message: error.message || "Invalid value",
  }));
};

// Custom error classes for specific scenarios
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message: string = "You are not authorized to perform this action"
  ) {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request") {
    super(message, 400);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(message, 500);
  }
}

// Rate limiting error handler
export const handleRateLimitError = (req: Request, res: Response): void => {
  res.status(429).json({
    success: false,
    message: "Too many requests from this IP, please try again later.",
  });
};

// File upload error handler
export const handleFileUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size allowed is 5MB.",
    });
  }

  if (error.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      message: "Too many files. Maximum 10 files allowed.",
    });
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      message: "Unexpected field in file upload.",
    });
  }

  next(error);
};
