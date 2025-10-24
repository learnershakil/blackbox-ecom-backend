import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

/**
 * Enhanced 404 handler for API routes that provides helpful suggestions
 */
export const apiNotFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { originalUrl, method } = req;

  // Only handle API routes
  if (!originalUrl.startsWith("/api/")) {
    return next();
  }

  const suggestions: string[] = [];
  const pathSegments = originalUrl.toLowerCase().split("/").filter(Boolean);

  // Common API routes for suggestions
  const apiRoutes = {
    auth: [
      "/api/auth/register",
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/profile",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
      "/api/auth/change-password",
    ],
    products: [
      "/api/products",
      "/api/products/search",
      "/api/products/featured",
      "/api/products/{id}",
      "/api/products/{id}/reviews",
    ],
    categories: [
      "/api/categories",
      "/api/categories/tree",
      "/api/categories/{id}",
    ],
    cart: [
      "/api/cart",
      "/api/cart/add",
      "/api/cart/update",
      "/api/cart/remove",
      "/api/cart/clear",
    ],
    orders: [
      "/api/orders",
      "/api/orders/my-orders",
      "/api/orders/{id}",
      "/api/orders/{id}/cancel",
    ],
    reviews: ["/api/reviews", "/api/reviews/product/{id}", "/api/reviews/{id}"],
    users: ["/api/users/profile", "/api/users/addresses", "/api/users/orders"],
    wishlist: ["/api/wishlist", "/api/wishlist/add", "/api/wishlist/remove"],
    coupons: ["/api/coupons/active", "/api/coupons/validate"],
    banners: ["/api/banners/active"],
    admin: [
      "/api/admin/dashboard",
      "/api/admin/users",
      "/api/admin/orders",
      "/api/admin/products",
      "/api/admin/categories",
    ],
  };

  // Extract the main resource from the URL
  const resource = pathSegments[1]; // After 'api'

  // Find suggestions based on the resource
  if (resource && apiRoutes[resource as keyof typeof apiRoutes]) {
    suggestions.push(...apiRoutes[resource as keyof typeof apiRoutes]);
  } else {
    // If resource not found, suggest some common routes
    const commonSuggestions = [
      "/api/auth/login",
      "/api/auth/register",
      "/api/products",
      "/api/categories",
      "/api/orders",
    ];
    suggestions.push(...commonSuggestions);
  }

  // Construct helpful error message
  let message = `API endpoint '${method} ${originalUrl}' not found.`;

  if (suggestions.length > 0) {
    message += `\n\nDid you mean one of these:`;
    suggestions.slice(0, 5).forEach((suggestion) => {
      message += `\n  • ${suggestion}`;
    });
  }

  message += `\n\nFor complete API documentation, visit: ${req.protocol}://${req.get("host")}/docs`;

  // Add common troubleshooting tips
  const tips = [
    "Check if the HTTP method (GET, POST, PUT, DELETE) is correct",
    "Ensure all required parameters are included",
    "Verify the endpoint URL spelling and format",
    "Check if authentication is required for this endpoint",
  ];

  message += `\n\nTroubleshooting tips:`;
  tips.forEach((tip) => {
    message += `\n  • ${tip}`;
  });

  const error = new AppError(message, 404);
  next(error);
};

/**
 * Middleware to handle method not allowed errors
 */
export const methodNotAllowedHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // This would be called if a route exists but method is not allowed
  const error = new AppError(
    `Method ${req.method} is not allowed for ${req.originalUrl}. Check the API documentation for supported methods.`,
    405
  );
  next(error);
};

/**
 * Rate limit exceeded handler
 */
export const rateLimitHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(
    "Rate limit exceeded. Please try again later. Check the X-RateLimit-* headers for details.",
    429
  );
  next(error);
};
