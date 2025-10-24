import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

// Rate limit message
const rateLimitMessage = {
  success: false,
  message: "Too many requests from this IP, please try again later.",
};

// Custom handler for rate limit exceeded
const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json(rateLimitMessage);
};

// General API rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: rateLimitMessage,
  handler: rateLimitHandler,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiting for authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message:
      "Too many authentication attempts, please try again after 15 minutes.",
  },
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiting for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: "Too many password reset attempts, please try again after 1 hour.",
  },
  handler: rateLimitHandler,
});

// Rate limiting for registration
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 registration attempts per hour
  message: {
    success: false,
    message: "Too many registration attempts, please try again after 1 hour.",
  },
  handler: rateLimitHandler,
});

// Rate limiting for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 upload requests per windowMs
  message: {
    success: false,
    message: "Too many file upload attempts, please try again later.",
  },
  handler: rateLimitHandler,
});

// Rate limiting for search operations
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 search requests per minute
  message: {
    success: false,
    message: "Too many search requests, please slow down.",
  },
  handler: rateLimitHandler,
});

// Rate limiting for order creation
export const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 orders per 15 minutes
  message: {
    success: false,
    message: "Too many order attempts, please try again later.",
  },
  handler: rateLimitHandler,
});

// Rate limiting for review creation
export const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 reviews per hour
  message: {
    success: false,
    message: "Too many review submissions, please try again later.",
  },
  handler: rateLimitHandler,
});

// Rate limiting for cart operations
export const cartLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 cart operations per minute
  message: {
    success: false,
    message: "Too many cart operations, please slow down.",
  },
  handler: rateLimitHandler,
});

// Rate limiting for admin operations
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for admin users
  message: {
    success: false,
    message: "Admin rate limit exceeded, please try again later.",
  },
  handler: rateLimitHandler,
});

// Strict rate limiting for sensitive admin operations
export const strictAdminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Very limited for sensitive operations
  message: {
    success: false,
    message:
      "Rate limit for sensitive operations exceeded, please try again later.",
  },
  handler: rateLimitHandler,
});

// Custom rate limiter factory
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      message:
        options.message || "Rate limit exceeded, please try again later.",
    },
    handler: rateLimitHandler,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Rate limiter for specific user actions
export const userActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 actions per 5 minutes per user
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return (req as any).user?.id || req.ip;
  },
  message: {
    success: false,
    message: "Too many actions from this account, please slow down.",
  },
  handler: rateLimitHandler,
});

// Dynamic rate limiter based on user type
export const dynamicLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;

  if (!user) {
    // Unauthenticated users get stricter limits
    return generalLimiter(req, res, next);
  }

  if (user.role === "admin") {
    // Admin users get higher limits
    return adminLimiter(req, res, next);
  }

  // Regular authenticated users
  return userActionLimiter(req, res, next);
};
