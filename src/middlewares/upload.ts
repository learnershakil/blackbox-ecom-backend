import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";
import { Request, Response, NextFunction, RequestHandler } from "express";
import * as path from "path";

// Configure Cloudinary (should be done in config, but ensuring it's set)
if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed!"));
  }
};

// Cloudinary storage for different types of uploads
const createCloudinaryStorage = (folder: string, transformation?: any) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `blackbox-commerce/${folder}`,
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      transformation: transformation || [
        { width: 1000, height: 1000, crop: "limit", quality: "auto" },
      ],
    } as any,
  });
};

// Different storage configurations
const productImageStorage = createCloudinaryStorage("products", [
  { width: 800, height: 800, crop: "fill", quality: "auto" },
]);

const categoryImageStorage = createCloudinaryStorage("categories", [
  { width: 400, height: 400, crop: "fill", quality: "auto" },
]);

const bannerImageStorage = createCloudinaryStorage("banners", [
  { width: 1200, height: 600, crop: "fill", quality: "auto" },
]);

const userAvatarStorage = createCloudinaryStorage("avatars", [
  { width: 300, height: 300, crop: "fill", quality: "auto", gravity: "face" },
]);

const reviewImageStorage = createCloudinaryStorage("reviews", [
  { width: 600, height: 600, crop: "fill", quality: "auto" },
]);

// Multer configurations
const createMulterConfig = (storage: CloudinaryStorage) => {
  return multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
      files: 10, // Maximum 10 files
    },
  });
};

// Product image upload middleware
export const uploadProductImages: RequestHandler = createMulterConfig(
  productImageStorage
).array("images", 10);

// Single product image upload
export const uploadSingleProductImage: RequestHandler =
  createMulterConfig(productImageStorage).single("image");

// Category image upload middleware
export const uploadCategoryImage: RequestHandler =
  createMulterConfig(categoryImageStorage).single("image");

// Banner image upload middleware
export const uploadBannerImage: RequestHandler =
  createMulterConfig(bannerImageStorage).single("image");

// User avatar upload middleware
export const uploadUserAvatar: RequestHandler =
  createMulterConfig(userAvatarStorage).single("avatar");

// Review images upload middleware
export const uploadReviewImages: RequestHandler = createMulterConfig(
  reviewImageStorage
).array("images", 5);

// Generic single image upload
export const uploadSingleImage: RequestHandler = createMulterConfig(
  createCloudinaryStorage("general")
).single("image");

// Generic multiple images upload
export const uploadMultipleImages: RequestHandler = createMulterConfig(
  createCloudinaryStorage("general")
).array("images", 10);

// Error handling middleware for multer
export const handleMulterError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 10 files.",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected field in file upload.",
      });
    }
  }

  if (error.message && error.message.includes("Only image files")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
};

// Utility function to delete image from Cloudinary
export const deleteCloudinaryImage = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    throw error;
  }
};

// Utility function to extract public ID from Cloudinary URL
export const extractPublicIdFromUrl = (url: string): string => {
  const parts = url.split("/");
  const filename = parts[parts.length - 1];
  const publicId = filename.split(".")[0];

  // Include folder path if present
  const folderIndex = url.indexOf("blackbox-commerce/");
  if (folderIndex !== -1) {
    const folderPath = url.substring(folderIndex, url.lastIndexOf("/"));
    return `${folderPath}/${publicId}`;
  }

  return publicId;
};

// Middleware to process uploaded files and add file info to request
export const processUploadedFiles = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.files || req.file) {
    // Process multiple files
    if (req.files && Array.isArray(req.files)) {
      req.body.uploadedFiles = req.files.map((file: any) => ({
        url: file.path,
        publicId: file.filename,
        originalName: file.originalname,
        size: file.size,
      }));
    }

    // Process single file
    if (req.file) {
      req.body.uploadedFile = {
        url: (req.file as any).path,
        publicId: (req.file as any).filename,
        originalName: req.file.originalname,
        size: req.file.size,
      };
    }
  }

  next();
};

// Optional: Middleware to validate image dimensions
export const validateImageDimensions = (
  minWidth?: number,
  minHeight?: number,
  maxWidth?: number,
  maxHeight?: number
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file && !req.files) {
      return next();
    }

    try {
      // For this middleware, we'll skip actual dimension validation
      // as Cloudinary handles transformations automatically
      // This is a placeholder for future enhancement if needed
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Invalid image dimensions",
      });
    }
  };
};
