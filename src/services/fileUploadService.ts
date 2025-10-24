import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from "cloudinary";
import { Readable } from "stream";
import { config } from "dotenv";
import Logger from "../utils/logger";

config();

export interface CloudinaryConfig {
  cloud_name: string;
  api_key: string;
  api_secret: string;
  secure: boolean;
}

export interface UploadOptions {
  folder?: string;
  public_id?: string;
  overwrite?: boolean;
  resource_type?: "image" | "video" | "raw" | "auto";
  format?: string;
  transformation?: any[];
  quality?: string | number;
  width?: number;
  height?: number;
  crop?: string;
  tags?: string[];
}

export interface UploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  bytes: number;
  created_at: string;
}

export interface DeleteResult {
  result: string;
}

export class FileUploadService {
  private static instance: FileUploadService;

  private constructor() {
    this.configureCloudinary();
  }

  public static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  private configureCloudinary(): void {
    const config: CloudinaryConfig = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
      api_key: process.env.CLOUDINARY_API_KEY || "",
      api_secret: process.env.CLOUDINARY_API_SECRET || "",
      secure: true,
    };

    cloudinary.config(config);

    Logger.info("Cloudinary configured", {
      cloud_name: config.cloud_name,
      has_api_key: !!config.api_key,
      has_api_secret: !!config.api_secret,
    });
  }

  /**
   * Upload file from buffer
   */
  public async uploadFromBuffer(
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: options.folder || "blackbox-commerce",
        public_id: options.public_id,
        overwrite: options.overwrite ?? true,
        resource_type: options.resource_type || "auto",
        format: options.format,
        transformation: options.transformation,
        quality: options.quality || "auto",
        width: options.width,
        height: options.height,
        crop: options.crop,
        tags: options.tags || ["blackbox-commerce"],
      };

      // Remove undefined values
      Object.keys(uploadOptions).forEach(
        (key) =>
          uploadOptions[key as keyof typeof uploadOptions] === undefined &&
          delete uploadOptions[key as keyof typeof uploadOptions]
      );

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined
        ) => {
          if (error) {
            Logger.error("File upload failed", {
              error: error.message,
              options: uploadOptions,
            });
            reject(new Error(`Upload failed: ${error.message}`));
          } else if (result) {
            Logger.info("File uploaded successfully", {
              public_id: result.public_id,
              url: result.secure_url,
              format: result.format,
              bytes: result.bytes,
            });

            resolve({
              public_id: result.public_id,
              secure_url: result.secure_url,
              url: result.url,
              width: result.width,
              height: result.height,
              format: result.format,
              resource_type: result.resource_type,
              bytes: result.bytes,
              created_at: result.created_at,
            });
          } else {
            reject(new Error("Upload failed: No result returned"));
          }
        }
      );

      // Convert buffer to stream and pipe to upload
      const stream = Readable.from(buffer);
      stream.pipe(uploadStream);
    });
  }

  /**
   * Upload file from URL
   */
  public async uploadFromUrl(
    url: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const uploadOptions = {
        folder: options.folder || "blackbox-commerce",
        public_id: options.public_id,
        overwrite: options.overwrite ?? true,
        resource_type: options.resource_type || "auto",
        format: options.format,
        transformation: options.transformation,
        quality: options.quality || "auto",
        width: options.width,
        height: options.height,
        crop: options.crop,
        tags: options.tags || ["blackbox-commerce"],
      };

      // Remove undefined values
      Object.keys(uploadOptions).forEach(
        (key) =>
          uploadOptions[key as keyof typeof uploadOptions] === undefined &&
          delete uploadOptions[key as keyof typeof uploadOptions]
      );

      const result = await cloudinary.uploader.upload(url, uploadOptions);

      Logger.info("File uploaded from URL successfully", {
        source_url: url,
        public_id: result.public_id,
        url: result.secure_url,
        format: result.format,
        bytes: result.bytes,
      });

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        resource_type: result.resource_type,
        bytes: result.bytes,
        created_at: result.created_at,
      };
    } catch (error: any) {
      Logger.error("File upload from URL failed", {
        error: error.message,
        url,
        options,
      });
      throw new Error(`Upload from URL failed: ${error.message}`);
    }
  }

  /**
   * Delete file by public_id
   */
  public async deleteFile(
    publicId: string,
    resourceType: "image" | "video" | "raw" = "image"
  ): Promise<DeleteResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });

      Logger.info("File deleted successfully", {
        public_id: publicId,
        result: result.result,
      });

      return {
        result: result.result,
      };
    } catch (error: any) {
      Logger.error("File deletion failed", {
        error: error.message,
        public_id: publicId,
        resource_type: resourceType,
      });
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple files
   */
  public async deleteMultipleFiles(
    publicIds: string[],
    resourceType: "image" | "video" | "raw" = "image"
  ): Promise<{ deleted: Record<string, string>; deleted_counts: any }> {
    try {
      const result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType,
      });

      Logger.info("Multiple files deleted", {
        count: publicIds.length,
        deleted_count: Object.keys(result.deleted).length,
      });

      return result;
    } catch (error: any) {
      Logger.error("Multiple file deletion failed", {
        error: error.message,
        public_ids: publicIds,
        resource_type: resourceType,
      });
      throw new Error(`Bulk delete failed: ${error.message}`);
    }
  }

  /**
   * Get file information
   */
  public async getFileInfo(
    publicId: string,
    resourceType: "image" | "video" | "raw" = "image"
  ): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });

      Logger.debug("File info retrieved", {
        public_id: publicId,
        format: result.format,
        bytes: result.bytes,
      });

      return result;
    } catch (error: any) {
      Logger.error("Failed to get file info", {
        error: error.message,
        public_id: publicId,
        resource_type: resourceType,
      });
      throw new Error(`Get file info failed: ${error.message}`);
    }
  }

  /**
   * Generate optimized URL with transformations
   */
  public generateOptimizedUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      quality?: string | number;
      format?: string;
      crop?: string;
      gravity?: string;
      fetch_format?: string;
    } = {}
  ): string {
    const transformations = [];

    if (options.width || options.height) {
      const sizeTransform = [];
      if (options.width) sizeTransform.push(`w_${options.width}`);
      if (options.height) sizeTransform.push(`h_${options.height}`);
      if (options.crop) sizeTransform.push(`c_${options.crop}`);
      if (options.gravity) sizeTransform.push(`g_${options.gravity}`);
      transformations.push(sizeTransform.join(","));
    }

    if (options.quality) {
      transformations.push(`q_${options.quality}`);
    }

    if (options.format) {
      transformations.push(`f_${options.format}`);
    }

    if (options.fetch_format) {
      transformations.push(`f_${options.fetch_format}`);
    }

    const transformString =
      transformations.length > 0 ? transformations.join("/") + "/" : "";

    return cloudinary.url(publicId, {
      secure: true,
      transformation: transformString,
    });
  }

  /**
   * Upload product image with optimization
   */
  public async uploadProductImage(
    buffer: Buffer,
    productId: string,
    imageIndex: number = 0
  ): Promise<UploadResult> {
    const options: UploadOptions = {
      folder: "blackbox-commerce/products",
      public_id: `product_${productId}_${imageIndex}`,
      overwrite: true,
      resource_type: "image",
      quality: "auto:good",
      width: 1200,
      height: 1200,
      crop: "limit",
      tags: ["product", "blackbox-commerce", productId],
      transformation: [
        { width: 1200, height: 1200, crop: "limit", quality: "auto:good" },
        { fetch_format: "auto" },
      ],
    };

    return this.uploadFromBuffer(buffer, options);
  }

  /**
   * Upload user avatar
   */
  public async uploadUserAvatar(
    buffer: Buffer,
    userId: string
  ): Promise<UploadResult> {
    const options: UploadOptions = {
      folder: "blackbox-commerce/users/avatars",
      public_id: `avatar_${userId}`,
      overwrite: true,
      resource_type: "image",
      quality: "auto:good",
      width: 300,
      height: 300,
      crop: "fill",
      tags: ["avatar", "blackbox-commerce", userId],
      transformation: [
        { width: 300, height: 300, crop: "fill", gravity: "face" },
      ],
    };

    return this.uploadFromBuffer(buffer, options);
  }

  /**
   * Upload category image
   */
  public async uploadCategoryImage(
    buffer: Buffer,
    categoryId: string
  ): Promise<UploadResult> {
    const options: UploadOptions = {
      folder: "blackbox-commerce/categories",
      public_id: `category_${categoryId}`,
      overwrite: true,
      resource_type: "image",
      quality: "auto:good",
      width: 800,
      height: 600,
      crop: "fill",
      tags: ["category", "blackbox-commerce", categoryId],
    };

    return this.uploadFromBuffer(buffer, options);
  }

  /**
   * Validate configuration
   */
  public validateConfiguration(): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      Logger.error("Cloudinary configuration missing", {
        has_cloud_name: !!cloudName,
        has_api_key: !!apiKey,
        has_api_secret: !!apiSecret,
      });
      return false;
    }

    Logger.info("Cloudinary configuration validated");
    return true;
  }
}

// Export singleton instance
export const fileUploadService = FileUploadService.getInstance();
export default FileUploadService;
