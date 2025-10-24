import mongoose, { Document, Schema } from "mongoose";

export interface ICoupon extends Document {
  _id: string;
  code: string;
  name: string;
  description?: string;
  type: "percentage" | "fixed";
  value: number;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
  usageLimit?: number;
  usedCount: number;
  applicableProducts?: mongoose.Types.ObjectId[];
  applicableCategories?: mongoose.Types.ObjectId[];
  isActive: boolean;
  validFrom: Date;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, "Coupon code must be at least 3 characters"],
      maxlength: [20, "Coupon code cannot exceed 20 characters"],
      match: [
        /^[A-Z0-9]+$/,
        "Coupon code can only contain uppercase letters and numbers",
      ],
    },
    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
      maxlength: [100, "Coupon name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Coupon type is required"],
    },
    value: {
      type: Number,
      required: [true, "Coupon value is required"],
      min: [0, "Coupon value must be positive"],
      validate: {
        validator: function (this: ICoupon, value: number) {
          if (this.type === "percentage") {
            return value > 0 && value <= 100;
          }
          return value > 0;
        },
        message:
          "For percentage coupons, value must be between 0 and 100. For fixed coupons, value must be positive.",
      },
    },
    minimumOrderValue: {
      type: Number,
      min: [0, "Minimum order value must be non-negative"],
      default: 0,
    },
    maximumDiscountAmount: {
      type: Number,
      min: [0, "Maximum discount amount must be positive"],
      validate: {
        validator: function (this: ICoupon, maxDiscount: number) {
          // Only validate for percentage coupons
          if (this.type === "percentage" && maxDiscount) {
            return maxDiscount > 0;
          }
          return true;
        },
        message:
          "Maximum discount amount must be positive for percentage coupons",
      },
    },
    usageLimit: {
      type: Number,
      min: [1, "Usage limit must be at least 1"],
      validate: {
        validator: Number.isInteger,
        message: "Usage limit must be an integer",
      },
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"],
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    validFrom: {
      type: Date,
      required: [true, "Valid from date is required"],
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: [true, "Valid until date is required"],
      validate: {
        validator: function (this: ICoupon, validUntil: Date) {
          return validUntil > this.validFrom;
        },
        message: "Valid until date must be after valid from date",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ type: 1 });
couponSchema.index({ createdAt: -1 });

// Virtual for is expired
couponSchema.virtual("isExpired").get(function () {
  return new Date() > this.validUntil;
});

// Virtual for is valid
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.validFrom &&
    now <= this.validUntil &&
    (!this.usageLimit || this.usedCount < this.usageLimit)
  );
});

// Virtual for usage percentage
couponSchema.virtual("usagePercentage").get(function () {
  if (!this.usageLimit) return 0;
  return Math.round((this.usedCount / this.usageLimit) * 100);
});

// Virtual for remaining uses
couponSchema.virtual("remainingUses").get(function () {
  if (!this.usageLimit) return null;
  return Math.max(0, this.usageLimit - this.usedCount);
});

// Pre-save middleware to ensure valid dates
couponSchema.pre("save", function (next) {
  const now = new Date();

  // Set validFrom to now if it's in the past and this is a new coupon
  if (this.isNew && this.validFrom < now) {
    this.validFrom = now;
  }

  // Ensure validUntil is after validFrom
  if (this.validUntil <= this.validFrom) {
    const error = new Error("Valid until date must be after valid from date");
    return next(error);
  }

  next();
});

// Static method to find valid coupons
couponSchema.statics.findValidCoupons = function () {
  const now = new Date();
  return this.find({
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $or: [
      { usageLimit: { $exists: false } },
      { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
    ],
  }).sort({ createdAt: -1 });
};

// Static method to find coupon by code
couponSchema.statics.findByCode = function (code: string) {
  return this.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });
};

// Instance method to validate coupon for order
couponSchema.methods.validateForOrder = function (
  orderValue: number,
  productIds: string[] = [],
  categoryIds: string[] = []
) {
  const errors: string[] = [];

  // Check if coupon is valid
  if (!this.isValid) {
    if (!this.isActive) errors.push("Coupon is not active");
    if (this.isExpired) errors.push("Coupon has expired");
    if (this.usageLimit && this.usedCount >= this.usageLimit)
      errors.push("Coupon usage limit exceeded");
  }

  // Check minimum order value
  if (this.minimumOrderValue && orderValue < this.minimumOrderValue) {
    errors.push(`Minimum order value of ₹${this.minimumOrderValue} required`);
  }

  // Check applicable products
  if (this.applicableProducts && this.applicableProducts.length > 0) {
    const hasApplicableProduct = productIds.some((id) =>
      this.applicableProducts!.some((prodId: any) => prodId.toString() === id)
    );
    if (!hasApplicableProduct) {
      errors.push("Coupon is not applicable to any products in your order");
    }
  }

  // Check applicable categories
  if (this.applicableCategories && this.applicableCategories.length > 0) {
    const hasApplicableCategory = categoryIds.some((id) =>
      this.applicableCategories!.some((catId: any) => catId.toString() === id)
    );
    if (!hasApplicableCategory) {
      errors.push("Coupon is not applicable to any categories in your order");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Instance method to calculate discount
couponSchema.methods.calculateDiscount = function (orderValue: number) {
  if (this.type === "percentage") {
    let discount = (orderValue * this.value) / 100;
    if (this.maximumDiscountAmount) {
      discount = Math.min(discount, this.maximumDiscountAmount);
    }
    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  } else {
    return Math.min(this.value, orderValue);
  }
};

// Instance method to increment usage count
couponSchema.methods.incrementUsage = function () {
  this.usedCount += 1;
  return this.save();
};

// Instance method to decrement usage count (for refunds)
couponSchema.methods.decrementUsage = function () {
  this.usedCount = Math.max(0, this.usedCount - 1);
  return this.save();
};

export default mongoose.model<ICoupon>("Coupon", couponSchema);
