import { Request, Response, NextFunction } from "express";
import { Banner } from "../models";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { Types } from "mongoose";

// Get all banners
export const getAllBanners = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};

    if (req.query.status === "active") {
      filter.isActive = true;
    } else if (req.query.status === "inactive") {
      filter.isActive = false;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.position) {
      filter.position = req.query.position;
    }

    const banners = await Banner.find(filter)
      .sort({ position: 1, order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Banner.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        banners,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalBanners: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get active banners for public display
export const getActiveBanners = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { position } = req.query;
    const now = new Date();

    // Build filter for active banners
    const filter: any = {
      isActive: true,
      $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }],
    };

    // Add end date filter
    filter.$and = [
      {
        $or: [
          { validUntil: { $exists: false } },
          { validUntil: { $gte: now } },
        ],
      },
    ];

    if (position) {
      filter.position = position;
    }

    const banners = await Banner.find(filter)
      .select("title subtitle image link type position order")
      .sort({ position: 1, order: 1 });

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

// Get single banner
export const getBanner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

// Create banner (Admin)
export const createBanner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      subtitle,
      description,
      link,
      type,
      position,
      order,
      validFrom,
      validUntil,
      isActive,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    // Upload image to Cloudinary
    const imageResult = await uploadToCloudinary(
      req.file,
      "blackbox-commerce/banners"
    );

    // Parse dates if provided
    const parsedStartDate = validFrom ? new Date(validFrom) : undefined;
    const parsedEndDate = validUntil ? new Date(validUntil) : undefined;

    // Validate dates
    if (parsedStartDate && parsedEndDate && parsedStartDate >= parsedEndDate) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    const banner = new Banner({
      title,
      subtitle,
      description,
      image: imageResult,
      link,
      type: type || "promotional",
      position: position || "hero",
      order: order || 0,
      validFrom: parsedStartDate,
      validUntil: parsedEndDate,
      isActive: isActive !== false,
    });

    await banner.save();

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

// Update banner (Admin)
export const updateBanner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Handle new image upload
    if (req.file) {
      // Delete old image
      if (banner.image?.public_id) {
        await deleteFromCloudinary(banner.image.public_id);
      }

      // Upload new image
      updateData.image = await uploadToCloudinary(
        req.file,
        "blackbox-commerce/banners"
      );
    }

    // Parse dates if provided
    if (updateData.validFrom) {
      updateData.validFrom = new Date(updateData.validFrom);
    }
    if (updateData.validUntil) {
      updateData.validUntil = new Date(updateData.validUntil);
    }

    // Validate dates
    const startDate = updateData.validFrom || banner.validFrom;
    const endDate = updateData.validUntil || banner.validUntil;

    if (startDate && endDate && startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    const updatedBanner = await Banner.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: updatedBanner,
    });
  } catch (error) {
    next(error);
  }
};

// Delete banner (Admin)
export const deleteBanner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Delete image from Cloudinary
    if (banner.image?.public_id) {
      await deleteFromCloudinary(banner.image.public_id);
    }

    await Banner.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Toggle banner status (Admin)
export const toggleBannerStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? "activated" : "deactivated"} successfully`,
      data: {
        id: banner._id,
        title: banner.title,
        isActive: banner.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Reorder banners (Admin)
export const reorderBanners = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bannerOrders } = req.body; // Array of { id, order }

    if (!Array.isArray(bannerOrders)) {
      return res.status(400).json({
        success: false,
        message: "bannerOrders must be an array",
      });
    }

    const updatePromises = bannerOrders.map(({ id, order }) =>
      Banner.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Banners reordered successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get banners by position
export const getBannersByPosition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { position } = req.params;
    const now = new Date();

    const banners = await Banner.find({
      position,
      isActive: true,
      $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }],
      $and: [
        {
          $or: [
            { validUntil: { $exists: false } },
            { validUntil: { $gte: now } },
          ],
        },
      ],
    })
      .select("title subtitle image link type order")
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

// Get banner analytics (Admin)
export const getBannerAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // For now, return basic analytics
    // In a real implementation, you would track clicks and impressions
    const analytics = {
      banner: {
        id: banner._id,
        title: banner.title,
        position: banner.position,
        isActive: banner.isActive,
        createdAt: banner.createdAt,
      },
      stats: {
        totalImpressions: 0, // Would be tracked from frontend
        totalClicks: 0, // Would be tracked from frontend
        clickThroughRate: 0,
        lastImpression: null,
        lastClick: null,
      },
    };

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk update banner status (Admin)
export const bulkUpdateBannerStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bannerIds, isActive } = req.body;

    if (!Array.isArray(bannerIds) || bannerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "bannerIds must be a non-empty array",
      });
    }

    await Banner.updateMany({ _id: { $in: bannerIds } }, { isActive });

    res.status(200).json({
      success: true,
      message: `${bannerIds.length} banners ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    next(error);
  }
};
