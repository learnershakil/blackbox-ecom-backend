import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";
import { Request, Response, NextFunction, RequestHandler } from "express";

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://blackbox-commerce.com",
      "https://www.blackbox-commerce.com",
      "https://admin.blackbox-commerce.com",
    ];

    // In development, allow any localhost origin
    if (process.env.NODE_ENV === "development") {
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control",
    "Pragma",
  ],
  exposedHeaders: ["X-Total-Count"], // For pagination
  maxAge: 86400, // 24 hours
};

// Security headers configuration with Helmet
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.cloudinary.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
};

// MongoDB injection sanitizer
const mongoSanitizeConfig = {
  replaceWith: "_",
  onSanitize: ({ req, key }: { req: Request; key: string }) => {
    console.warn(`MongoDB injection attempt detected: ${key}`);
  },
};

// HPP (HTTP Parameter Pollution) protection
const hppConfig = {
  whitelist: [
    "sort",
    "fields",
    "page",
    "limit",
    "category",
    "tags",
    "rating",
    "price",
    "brand",
    "size",
    "color",
  ],
};

// Custom security headers middleware
export const customSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Remove powered by header
  res.removeHeader("X-Powered-By");

  // Add custom security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  // API-specific headers
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  next();
};

// Input sanitization middleware
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Sanitize request body, query, and params
  if (req.body) {
    req.body = JSON.parse(
      JSON.stringify(req.body).replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ""
      )
    );
  }

  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === "string") {
        req.query[key] = (req.query[key] as string).replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ""
        );
      }
    });
  }

  next();
};

// Request size limiter
export const requestSizeLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const contentLength = parseInt(req.get("Content-Length") || "0");
  const maxSize = 50 * 1024 * 1024; // 50MB limit

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: "Request entity too large",
    });
  }

  next();
};

// IP whitelist middleware (for admin routes)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP =
      req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

    // In development, skip IP checking
    if (process.env.NODE_ENV === "development") {
      return next();
    }

    if (allowedIPs.includes(clientIP as string)) {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: "Access denied from this IP address",
      });
    }
  };
};

// Security audit logger
export const securityLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const securityEvents = [
    "login",
    "logout",
    "password-reset",
    "admin-access",
    "user-creation",
    "user-deletion",
    "role-change",
  ];

  const path = req.path.toLowerCase();
  const method = req.method;

  // Log security-sensitive operations
  if (securityEvents.some((event) => path.includes(event))) {
    console.log(
      `Security Event: ${method} ${path} from ${req.ip} at ${new Date().toISOString()}`
    );
  }

  next();
};

// Apply all security middleware
export const applySecurity: RequestHandler[] = [
  helmet(helmetConfig),
  cors(corsOptions),
  customSecurityHeaders,
  mongoSanitize(mongoSanitizeConfig),
  xss(),
  hpp(hppConfig),
  sanitizeInput,
  requestSizeLimiter,
  securityLogger,
];

// Development-specific security (less strict)
export const applyDevSecurity = [
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
  (cors as any)({
    origin: true, // Allow all origins in development
    credentials: true,
  }),
  mongoSanitize(),
  xss(),
  (hpp as any)(hppConfig),
];

// Production security (strict)
export const applyProdSecurity = [
  helmet(helmetConfig),
  (cors as any)(corsOptions),
  customSecurityHeaders,
  mongoSanitize(mongoSanitizeConfig),
  xss(),
  (hpp as any)(hppConfig),
  sanitizeInput,
  requestSizeLimiter,
  securityLogger,
];

// Conditional security based on environment
export const conditionalSecurity =
  process.env.NODE_ENV === "production" ? applyProdSecurity : applyDevSecurity;

// Security middleware for file uploads
export const uploadSecurity = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Validate file types more strictly
  if (req.file || req.files) {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    const files = req.files
      ? Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat()
      : [req.file];

    for (const file of files) {
      if (file && !allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `File type ${file.mimetype} is not allowed`,
        });
      }
    }
  }

  next();
};
