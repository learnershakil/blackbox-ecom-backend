import { Request, Response, NextFunction } from "express";
import { Review, Product, Order } from "../models";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { Types } from "mongoose";

// Create review for a product
export const createReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { productId, rating, comment, title } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user has purchased this product
    const hasPurchased = await Order.findOne({
      user: userId,
      "items.product": productId,
      orderStatus: "delivered",
    });

    if (!hasPurchased) {
      return res.status(400).json({
        success: false,
        message: "You can only review products you have purchased",
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    // Handle image uploads
    let images: { public_id: string; url: string }[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(
          file,
          "blackbox-commerce/reviews"
        );
        images.push(result);
      }
    }

    // Create review
    const review = new Review({
      user: userId,
      product: productId,
      order: hasPurchased._id,
      rating,
      comment,
      title,
      images,
      isVerifiedPurchase: true,
    });

    await review.save();

    // Update product rating statistics
    await updateProductRatingStats(productId);

    // Populate review before sending response
    const populatedReview = await Review.findById(review._id)
      .populate("user", "name avatar")
      .populate("product", "name slug");

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};

// Get reviews for a product
export const getProductReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = { product: productId };

    if (req.query.rating) {
      filter.rating = parseInt(req.query.rating as string);
    }

    if (req.query.verified === "true") {
      filter.isVerifiedPurchase = true;
    }

    if (req.query.withImages === "true") {
      filter.images = { $ne: [] };
    }

    // Sort options
    let sort: any = {};
    switch (req.query.sortBy) {
      case "rating-high":
        sort = { rating: -1, createdAt: -1 };
        break;
      case "rating-low":
        sort = { rating: 1, createdAt: -1 };
        break;
      case "helpful":
        sort = { helpfulCount: -1, createdAt: -1 };
        break;
      case "oldest":
        sort = { createdAt: 1 };
        break;
      default:
        sort = { createdAt: -1 }; // newest first
    }

    const reviews = await Review.find(filter)
      .populate("user", "name avatar")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(filter);

    // Get rating distribution
    const ratingStats = await Review.aggregate([
      { $match: { product: new Types.ObjectId(productId) } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const ratingDistribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    ratingStats.forEach((stat) => {
      ratingDistribution[stat._id as keyof typeof ratingDistribution] =
        stat.count;
    });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalReviews: total,
          limit,
        },
        ratingDistribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single review
export const getReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id)
      .populate("user", "name avatar")
      .populate("product", "name slug images");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// Update review (only by review owner)
export const updateReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { rating, comment, title } = req.body;

    const review = await Review.findOne({ _id: id, user: userId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you are not authorized to update it",
      });
    }

    // Handle new image uploads
    let newImages: { public_id: string; url: string }[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(
          file,
          "blackbox-commerce/reviews"
        );
        newImages.push(result);
      }
    }

    // Update review
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    if (title !== undefined) review.title = title;
    if (newImages.length > 0) {
      review.images = [...review.images, ...newImages];
    }

    await review.save();

    // Update product rating statistics if rating changed
    if (rating !== undefined) {
      await updateProductRatingStats(review.product.toString());
    }

    // Populate review before sending response
    const populatedReview = await Review.findById(review._id)
      .populate("user", "name avatar")
      .populate("product", "name slug");

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};

// Delete review (by owner or admin)
export const deleteReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { id } = req.params;

    let review;
    if (userRole === "admin" || userRole === "super_admin") {
      review = await Review.findById(id);
    } else {
      review = await Review.findOne({ _id: id, user: userId });
    }

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you are not authorized to delete it",
      });
    }

    // Delete images from Cloudinary
    if (review.images && review.images.length > 0) {
      for (const image of review.images) {
        await deleteFromCloudinary(image.public_id);
      }
    }

    const productId = review.product.toString();
    await Review.findByIdAndDelete(id);

    // Update product rating statistics
    await updateProductRatingStats(productId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Delete review image
export const deleteReviewImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { imageId } = req.body; // public_id of the image

    const review = await Review.findOne({ _id: id, user: userId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you are not authorized to modify it",
      });
    }

    const imageIndex = review.images.findIndex(
      (img) => img.public_id === imageId
    );
    if (imageIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Image not found in review",
      });
    }

    // Remove image from Cloudinary
    await deleteFromCloudinary(imageId);

    // Remove image from review
    review.images.splice(imageIndex, 1);
    await review.save();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// Mark review as helpful
export const markReviewHelpful = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user already marked this review as helpful
    const hasMarkedHelpful = review.helpfulBy.includes(
      new Types.ObjectId(userId)
    );

    if (hasMarkedHelpful) {
      // Remove helpful mark
      review.helpfulBy = review.helpfulBy.filter(
        (uid) => uid.toString() !== userId
      );
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add helpful mark
      review.helpfulBy.push(new Types.ObjectId(userId));
      review.helpfulCount += 1;
    }

    await review.save();

    res.status(200).json({
      success: true,
      message: hasMarkedHelpful
        ? "Helpful mark removed"
        : "Review marked as helpful",
      data: {
        helpfulCount: review.helpfulCount,
        isHelpful: !hasMarkedHelpful,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user's own reviews
export const getUserReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ user: userId })
      .populate("product", "name slug images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalReviews: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get all reviews with filters
export const getAllReviews = async (
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

    if (req.query.rating) {
      filter.rating = parseInt(req.query.rating as string);
    }

    if (req.query.verified === "true") {
      filter.isVerifiedPurchase = true;
    }

    if (req.query.approved === "false") {
      filter.isApproved = false;
    }

    if (req.query.product) {
      filter.product = req.query.product;
    }

    const reviews = await Review.find(filter)
      .populate("user", "name email avatar")
      .populate("product", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalReviews: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Moderate review (approve/reject)
export const moderateReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // action: 'approve' | 'reject'

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (action === "reject") {
      // Delete the review and its images
      if (review.images && review.images.length > 0) {
        for (const image of review.images) {
          await deleteFromCloudinary(image.public_id);
        }
      }

      await Review.findByIdAndDelete(id);

      // Update product rating statistics
      await updateProductRatingStats(review.product.toString());

      res.status(200).json({
        success: true,
        message: "Review rejected and deleted",
      });
    } else {
      // Approve the review
      review.isApproved = true;
      await review.save();

      res.status(200).json({
        success: true,
        message: "Review approved",
        data: review,
      });
    }
  } catch (error) {
    next(error);
  }
};

// Helper function to update product rating statistics
async function updateProductRatingStats(productId: string) {
  const stats = await Review.aggregate([
    { $match: { product: new Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        ratingBreakdown: {
          $push: "$rating",
        },
      },
    },
  ]);

  if (stats.length > 0) {
    const { averageRating, totalReviews } = stats[0];

    await Product.findByIdAndUpdate(productId, {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalReviews,
    });
  } else {
    // No reviews, reset to defaults
    await Product.findByIdAndUpdate(productId, {
      averageRating: 0,
      totalReviews: 0,
    });
  }
}
