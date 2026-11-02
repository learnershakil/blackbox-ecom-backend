import { Request, Response, NextFunction } from "express";
import { Order, Cart, Product, Coupon } from "../models";
import { Types } from "mongoose";

// Create new order
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const {
      shippingAddress,
      billingAddress,
      paymentMethod,
      couponCode,
      notes,
    } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Validate stock for all items
    for (const item of cart.items) {
      const product = item.product as any;
      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is no longer available`,
        });
      }

      if (product.totalStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Only ${product.totalStock} items available`,
        });
      }
    }

    // Calculate order totals
    const subtotal = cart.totalAmount;
    let discount = 0;
    let couponId = null;

    // Apply coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gt: new Date() },
      });

      if (coupon) {
        // Check usage limits
        if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
          // Check minimum order value
          if (
            !coupon.minimumOrderValue ||
            subtotal >= coupon.minimumOrderValue
          ) {
            couponId = coupon._id;

            if (coupon.type === "percentage") {
              discount = Math.min(
                (subtotal * coupon.value) / 100,
                coupon.maximumDiscountAmount || subtotal
              );
            } else {
              discount = Math.min(coupon.value, subtotal);
            }
          }
        }
      }
    }

    const shippingCost = subtotal >= 500 ? 0 : 50; // Free shipping above ₹500
    const taxAmount = Math.round((subtotal - discount) * 0.18 * 100) / 100; // 18% GST
    const totalAmount = subtotal - discount + shippingCost + taxAmount;

    // Create order
    const order = new Order({
      user: userId,
      items: cart.items.map((item) => ({
        product: item.product._id,
        name: (item.product as any).name,
        image: (item.product as any).images?.[0]?.url || "",
        quantity: item.quantity,
        price: item.price,
        variant: item.variant,
        subtotal: item.price * item.quantity,
      })),
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      subtotal,
      discountAmount: discount,
      shippingCost,
      taxAmount,
      totalAmount,
      paymentMethod,
      couponCode: couponCode || undefined,
      notes,
      orderStatus: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { totalStock: -item.quantity },
      });
    }

    // Update coupon usage if applied
    if (couponCode && couponId) {
      await Coupon.findByIdAndUpdate(couponId, {
        $inc: { usedCount: 1 },
      });
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    // Populate order before sending response
    const populatedOrder = await Order.findById(order._id)
      .populate("items.product", "name slug images")
      .populate("user", "name email");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: populatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

// Get user's orders
export const getUserOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: userId })
      .populate("items.product", "name slug images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single order
export const getOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    let order;

    if (userRole === "admin") {
      order = await Order.findById(id);
    } else {
      order = await Order.findOne({ _id: id, user: userId });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Populate order details
    await order.populate([
      { path: "items.product", select: "name slug images" },
      { path: "user", select: "name email phone" },
    ]);

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order
export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: id, user: userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!["pending", "processing"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
    }

    // Update order status
    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { totalStock: item.quantity },
      });
    }

    // Restore coupon usage if applicable
    if (order.couponCode) {
      const coupon = await Coupon.findOne({ code: order.couponCode });
      if (coupon) {
        await Coupon.findByIdAndUpdate(coupon._id, {
          $inc: { usedCount: -1 },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get all orders
export const getAllOrders = async (
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

    if (req.query.status) {
      filter.orderStatus = req.query.status;
    }

    if (req.query.paymentMethod) {
      filter.paymentMethod = req.query.paymentMethod;
    }

    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate as string),
        $lte: new Date(req.query.endDate as string),
      };
    }

    const orders = await Order.find(filter)
      .populate("items.product", "name slug")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Update order status
export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Validate status transition
    const validTransitions: { [key: string]: string[] } = {
      pending: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[order.orderStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.orderStatus} to ${status}`,
      });
    }

    // Update order
    order.orderStatus = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;

    // Set timestamps
    switch (status) {
      case "shipped":
        // No specific timestamp field for shipped in the model
        break;
      case "delivered":
        order.deliveredAt = new Date();
        break;
      case "cancelled":
        order.cancelledAt = new Date();
        break;
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Get order statistics (Admin)
export const getOrderStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { period = "30d" } = req.query;

    let startDate = new Date();
    switch (period) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const stats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          averageOrderValue: { $avg: "$totalAmount" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "pending"] }, 1, 0] },
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "processing"] }, 1, 0] },
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "shipped"] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] },
          },
        },
      },
    ]);

    // Daily sales trend
    const dailyStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: stats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          pendingOrders: 0,
          processingOrders: 0,
          shippedOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
        },
        dailyTrend: dailyStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
