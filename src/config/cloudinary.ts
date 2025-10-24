import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Helper function to upload image to Cloudinary
export const uploadToCloudinary = async (
  file: Express.Multer.File,
  folder: string = "blackbox-commerce"
): Promise<{ public_id: string; url: string }> => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: "auto",
      transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
    });

    return {
      public_id: result.public_id,
      url: result.secure_url,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
};

// Helper function to upload multiple images
export const uploadMultipleToCloudinary = async (
  files: Express.Multer.File[],
  folder: string = "blackbox-commerce"
): Promise<{ public_id: string; url: string }[]> => {
  try {
    const uploadPromises = files.map((file) =>
      uploadToCloudinary(file, folder)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error("Multiple Cloudinary upload error:", error);
    throw new Error("Failed to upload images to Cloudinary");
  }
};

// Helper function to delete image from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new Error("Failed to delete image from Cloudinary");
  }
};

// Helper function to delete multiple images
export const deleteMultipleFromCloudinary = async (
  publicIds: string[]
): Promise<void> => {
  try {
    const deletePromises = publicIds.map((id) => deleteFromCloudinary(id));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Multiple Cloudinary delete error:", error);
    throw new Error("Failed to delete images from Cloudinary");
  }
};

// Helper function to get optimized image URL
export const getOptimizedImageUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  } = {}
): string => {
  const { width, height, quality = "auto:good", format = "auto" } = options;

  const transformations: any[] = [{ quality, fetch_format: format }];

  if (width || height) {
    transformations.push({ width, height, crop: "fill" });
  }

  return cloudinary.url(publicId, {
    transformation: transformations,
    secure: true,
  });
};

export default cloudinary;
