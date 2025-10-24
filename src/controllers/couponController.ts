import { Request, Response, NextFunction } from "express";
import { Coupon, Product, Category } from "../models";
import { Types } from "mongoose";

// Get all coupons (Admin)
export const getAllCoupons = async (
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

    if (req.query.search) {
      filter.$or = [
        { code: { $regex: req.query.search, $options: "i" } },
        { name: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const coupons = await Coupon.find(filter)
      .populate("applicableProducts", "name slug")
      .populate("applicableCategories", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Coupon.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        coupons,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCoupons: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single coupon (Admin)
export const getCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id)
      .populate("applicableProducts", "name slug images")
      .populate("applicableCategories", "name slug");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    res.status(200).json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    next(error);
  }
};

// Create coupon (Admin)
export const createCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      code,
      name,
      description,
      type,
      value,
      minimumOrderValue,
      maximumDiscountAmount,
      usageLimit,
      applicableProducts,
      applicableCategories,
      validFrom,
      validUntil,
      isActive,
    } = req.body;

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    // Validate applicable products
    if (applicableProducts && applicableProducts.length > 0) {
      const products = await Product.find({ _id: { $in: applicableProducts } });
      if (products.length !== applicableProducts.length) {
        return res.status(400).json({
          success: false,
          message: "Some specified products do not exist",
        });
      }
    }

    // Validate applicable categories
    if (applicableCategories && applicableCategories.length > 0) {
      const categories = await Category.find({
        _id: { $in: applicableCategories },
      });
      if (categories.length !== applicableCategories.length) {
        return res.status(400).json({
          success: false,
          message: "Some specified categories do not exist",
        });
      }
    }

    // Validate dates
    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);

    if (fromDate >= untilDate) {
      return res.status(400).json({
        success: false,
        message: "Valid from date must be before valid until date",
      });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      name,
      description,
      type,
      value,
      minimumOrderValue: minimumOrderValue || 0,
      maximumDiscountAmount,
      usageLimit,
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
      validFrom: fromDate,
      validUntil: untilDate,
      isActive: isActive !== false,
    });

    await coupon.save();

    // Populate before sending response
    const populatedCoupon = await Coupon.findById(coupon._id)
      .populate("applicableProducts", "name slug")
      .populate("applicableCategories", "name slug");

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: populatedCoupon,
    });
  } catch (error) {
    next(error);
  }
};

// Update coupon (Admin)
export const updateCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Check if code is being updated and already exists
    if (updateData.code && updateData.code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({
        code: updateData.code.toUpperCase(),
        _id: { $ne: id },
      });

      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }

      updateData.code = updateData.code.toUpperCase();
    }

    // Validate applicable products if being updated
    if (updateData.applicableProducts) {
      const products = await Product.find({
        _id: { $in: updateData.applicableProducts },
      });
      if (products.length !== updateData.applicableProducts.length) {
        return res.status(400).json({
          success: false,
          message: "Some specified products do not exist",
        });
      }
    }

    // Validate applicable categories if being updated
    if (updateData.applicableCategories) {
      const categories = await Category.find({
        _id: { $in: updateData.applicableCategories },
      });
      if (categories.length !== updateData.applicableCategories.length) {
        return res.status(400).json({
          success: false,
          message: "Some specified categories do not exist",
        });
      }
    }

    // Validate dates if being updated
    if (updateData.validFrom || updateData.validUntil) {
      const fromDate = new Date(updateData.validFrom || coupon.validFrom);
      const untilDate = new Date(updateData.validUntil || coupon.validUntil);

      if (fromDate >= untilDate) {
        return res.status(400).json({
          success: false,
          message: "Valid from date must be before valid until date",
        });
      }
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("applicableProducts", "name slug")
      .populate("applicableCategories", "name slug");

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: updatedCoupon,
    });
  } catch (error) {
    next(error);
  }
};

// Delete coupon (Admin)
export const deleteCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Check if coupon is currently being used in any active orders
    const { Order } = await import("../models");
    const activeOrders = await Order.countDocuments({
      couponCode: coupon.code,
      orderStatus: { $in: ["pending", "processing", "shipped"] },
    });

    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete coupon that is being used in active orders",
      });
    }

    await Coupon.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Validate coupon for user
export const validateCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.params;
    const { cartTotal, productIds } = req.body;

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    })
      .populate("applicableProducts", "_id")
      .populate("applicableCategories", "_id");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });
    }

    // Check if coupon is valid (date range)
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({
        success: false,
        message: "Coupon has expired or is not yet valid",
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit exceeded",
      });
    }

    // Check minimum order value
    if (coupon.minimumOrderValue && cartTotal < coupon.minimumOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ₹${coupon.minimumOrderValue} required`,
      });
    }

    // Check product/category applicability
    if (
      coupon.applicableProducts.length > 0 ||
      coupon.applicableCategories.length > 0
    ) {
      let isApplicable = false;

      // Check if any cart products are in applicable products
      if (coupon.applicableProducts.length > 0) {
        const applicableProductIds = coupon.applicableProducts.map((p) =>
          p._id.toString()
        );
        isApplicable = productIds.some((id: string) =>
          applicableProductIds.includes(id)
        );
      }

      // Check if any cart products are in applicable categories
      if (!isApplicable && coupon.applicableCategories.length > 0) {
        const applicableCategoryIds = coupon.applicableCategories.map((c) =>
          c._id.toString()
        );
        const products = await Product.find({ _id: { $in: productIds } });
        isApplicable = products.some((product) =>
          applicableCategoryIds.includes(product.category.toString())
        );
      }

      if (!isApplicable) {
        return res.status(400).json({
          success: false,
          message: "Coupon is not applicable to items in your cart",
        });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === "percentage") {
      discountAmount = (cartTotal * coupon.value) / 100;
      if (coupon.maximumDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maximumDiscountAmount);
      }
    } else {
      discountAmount = Math.min(coupon.value, cartTotal);
    }

    res.status(200).json({
      success: true,
      message: "Coupon is valid",
      data: {
        coupon: {
          id: coupon._id,
          code: coupon.code,
          name: coupon.name,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value,
        },
        discountAmount,
        finalTotal: cartTotal - discountAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get active coupons for user
export const getActiveCoupons = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        { usageLimit: { $exists: false } },
        { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
      ],
    })
      .select(
        "code name description type value minimumOrderValue maximumDiscountAmount validUntil"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    next(error);
  }
};

// Get coupon usage statistics (Admin)
export const getCouponStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Get usage statistics
    const { Order } = await import("../models");
    const usageStats = await Order.aggregate([
      {
        $match: { couponCode: coupon.code },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          averageOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    // Get monthly usage trend
    const monthlyUsage = await Order.aggregate([
      {
        $match: { couponCode: coupon.code },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
          discount: { $sum: "$discountAmount" },
        },
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 },
      },
      {
        $limit: 12,
      },
    ]);

    const stats = usageStats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      averageOrderValue: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        coupon: {
          code: coupon.code,
          name: coupon.name,
          usedCount: coupon.usedCount,
          usageLimit: coupon.usageLimit,
          usagePercentage: coupon.usageLimit
            ? (coupon.usedCount / coupon.usageLimit) * 100
            : 0,
        },
        statistics: stats,
        monthlyTrend: monthlyUsage,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Toggle coupon status (Admin)
export const toggleCouponStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
      data: {
        id: coupon._id,
        code: coupon.code,
        isActive: coupon.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};
