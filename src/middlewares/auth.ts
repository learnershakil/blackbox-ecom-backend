const jwt = require("jsonwebtoken");
import { Request, Response, NextFunction } from "express";
import { User } from "../models";
import { JWTPayload } from "../types/express";
import { JWTUtil } from "../utils/jwt";

// Generate JWT token
export const generateToken = (payload: {
  id: string;
  email: string;
  role: string;
}): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    issuer: "blackbox-commerce",
    audience: "blackbox-commerce-users",
  });
};

// Verify JWT token
export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
};

// Generate refresh token
export const generateRefreshToken = (payload: {
  id: string;
  email: string;
  role: string;
}): string => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
    issuer: "blackbox-commerce",
    audience: "blackbox-commerce-refresh",
  });
};

// Verify refresh token
export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JWTPayload;
};

// Authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<any> | void> => {
  try {
    let token: string | undefined;

    // Get token from header or cookie
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = JWTUtil.verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. User not found.",
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error: any) {
    // Handle JWTUtil specific errors
    if (
      error.message === "Invalid access token" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid token.",
      });
    }

    if (
      error.message === "Access token expired" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Token expired.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: error.message,
    });
  }
};

// Authorization middleware for specific roles
export const authorize = (...roles: string[]) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): Response<any> | void => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. User not authenticated.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

// Optional authentication middleware (for routes that work with or without auth)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Get token from header or cookie
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        // Verify token
        const decoded = verifyToken(token);

        // Get user from database
        const user = await User.findById(decoded.id);
        if (user) {
          req.user = user;
        }
      } catch (error) {
        // Ignore token errors for optional auth
        console.log("Optional auth token error:", error);
      }
    }

    next();
  } catch (error) {
    // For optional auth, continue even if there's an error
    next();
  }
};

// Admin middleware (shorthand for authorize admin roles)
export const adminOnly = authorize("admin", "super_admin");

// Super admin middleware
export const superAdminOnly = authorize("super_admin");

export default {
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticate,
  authorize,
  optionalAuth,
  adminOnly,
  superAdminOnly,
};
