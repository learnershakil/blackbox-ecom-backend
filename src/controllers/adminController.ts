import { Request, Response } from "express";
import {
  User,
  Product,
  Order,
  Category,
  Review,
  Coupon,
  Banner,
} from "../models";
import { AuthenticatedRequest } from "../types/express";

// Dashboard Statistics
export const getDashboardStats = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
      activeCategories,
      totalReviews,
      activeCoupons,
      activeBanners,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.countDocuments({ status: "pending" }),
      Order.countDocuments({ status: "completed" }),
      Category.countDocuments({ isActive: true }),
      Review.countDocuments(),
      Coupon.countDocuments({ isActive: true }),
      Banner.countDocuments({ isActive: true }),
    ]);

    // Get monthly revenue for last 12 months
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Get top selling products
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 1,
          totalSold: 1,
          revenue: 1,
          name: "$product.name",
          image: "$product.images.0",
          price: "$product.price",
        },
      },
    ]);

    // Get recent orders
    const recentOrders = await Order.find()
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("orderNumber totalAmount status createdAt");

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          pendingOrders,
          completedOrders,
          activeCategories,
          totalReviews,
          activeCoupons,
          activeBanners,
        },
        monthlyRevenue,
        topProducts,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get dashboard statistics",
    });
  }
};

// User Management
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;

    const query: any = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (status) {
      query.isActive = status === "active";
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -resetPasswordToken -resetPasswordExpire")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get users",
    });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -resetPasswordToken -resetPasswordExpire")
      .populate("addresses");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user's order statistics
    const orderStats = await Order.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("orderNumber totalAmount status createdAt");

    res.json({
      success: true,
      data: {
        user,
        stats: orderStats[0] || {
          totalOrders: 0,
          totalSpent: 0,
          completedOrders: 0,
        },
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user details",
    });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select("-password -resetPasswordToken -resetPasswordExpire");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: { user },
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be user or admin",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password -resetPasswordToken -resetPasswordExpire");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: `User role updated to ${role} successfully`,
      data: { user },
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // Check if user has orders
    const orderCount = await Order.countDocuments({ user: userId });
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete user with existing orders. Deactivate instead.",
      });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

// System Reports
export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    const matchStage: any = {
      status: "completed",
    };

    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    let groupStage: any = {
      _id: null,
      totalRevenue: { $sum: "$totalAmount" },
      totalOrders: { $sum: 1 },
      averageOrderValue: { $avg: "$totalAmount" },
    };

    if (groupBy === "day") {
      groupStage._id = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    } else if (groupBy === "month") {
      groupStage._id = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    } else if (groupBy === "year") {
      groupStage._id = {
        year: { $year: "$createdAt" },
      };
    }

    const salesData = await Order.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    res.json({
      success: true,
      data: { salesData },
    });
  } catch (error) {
    console.error("Get sales report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate sales report",
    });
  }
};

export const getProductReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage: any = {
      status: "completed",
    };

    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const productStats = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
          orderCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 1,
          totalSold: 1,
          totalRevenue: 1,
          orderCount: 1,
          productName: "$product.name",
          productImage: "$product.images.0",
          productPrice: "$product.price",
          currentStock: "$product.stock",
        },
      },
      { $sort: { totalSold: -1 } },
    ]);

    res.json({
      success: true,
      data: { productStats },
    });
  } catch (error) {
    console.error("Get product report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate product report",
    });
  }
};

export const getUserReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage: any = {};

    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const userStats = await User.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          newUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Get top customers
    const topCustomers = await Order.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$user",
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 1,
          totalOrders: 1,
          totalSpent: 1,
          userName: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          userEmail: "$user.email",
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        userStats,
        topCustomers,
      },
    });
  } catch (error) {
    console.error("Get user report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate user report",
    });
  }
};
