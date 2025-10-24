import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  _id: string;
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  comment: string;
  images?: {
    public_id: string;
    url: string;
  }[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  helpfulBy: mongoose.Types.ObjectId[];
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer",
      },
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Review title cannot exceed 100 characters"],
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true,
      minlength: [10, "Comment must be at least 10 characters"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    images: {
      type: [
        {
          public_id: {
            type: String,
            required: true,
          },
          url: {
            type: String,
            required: true,
          },
        },
      ],
      validate: {
        validator: function (images: any[]) {
          return images.length <= 5;
        },
        message: "Cannot upload more than 5 images",
      },
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: [0, "Helpful count cannot be negative"],
    },
    helpfulBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isApproved: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
reviewSchema.index({ product: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ order: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ isApproved: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ helpfulCount: -1 });

// Compound index to prevent duplicate reviews
reviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true });

// Virtual for review age
reviewSchema.virtual("reviewAge").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
});

// Virtual for star display
reviewSchema.virtual("starDisplay").get(function () {
  return "★".repeat(this.rating) + "☆".repeat(5 - this.rating);
});

// Pre-save middleware to verify purchase
reviewSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      const Order = mongoose.model("Order");
      const order = await Order.findOne({
        _id: this.order,
        user: this.user,
        "items.product": this.product,
        orderStatus: "delivered",
      });

      this.isVerifiedPurchase = !!order;
      next();
    } catch (error) {
      next(error as Error);
    }
  } else {
    next();
  }
});

// Post-save middleware to update product rating
reviewSchema.post("save", async function () {
  try {
    const Product = mongoose.model("Product");
    const product = await Product.findById(this.product);
    if (product && typeof product.updateRating === "function") {
      await product.updateRating();
    }
  } catch (error) {
    console.error("Error updating product rating:", error);
  }
});

// Post-remove middleware to update product rating
reviewSchema.post(
  "deleteOne",
  { document: true, query: false },
  async function () {
    try {
      const Product = mongoose.model("Product");
      const product = await Product.findById(this.product);
      if (product && typeof product.updateRating === "function") {
        await product.updateRating();
      }
    } catch (error) {
      console.error("Error updating product rating:", error);
    }
  }
);

// Static method to find reviews by product
reviewSchema.statics.findByProduct = function (
  productId: string,
  options: any = {}
) {
  const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
  const skip = (page - 1) * limit;

  return this.find({ product: productId, isApproved: true })
    .populate("user", "name avatar")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Static method to find reviews by user
reviewSchema.statics.findByUser = function (userId: string, options: any = {}) {
  const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
  const skip = (page - 1) * limit;

  return this.find({ user: userId })
    .populate("product", "name images slug")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Static method to get rating summary
reviewSchema.statics.getRatingSummary = async function (productId: string) {
  const result = await this.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        isApproved: true,
      },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const summary = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalReviews = 0;
  let totalRating = 0;

  result.forEach((item) => {
    summary[item._id as keyof typeof summary] = item.count;
    totalReviews += item.count;
    totalRating += item._id * item.count;
  });

  return {
    summary,
    totalReviews,
    averageRating:
      totalReviews > 0 ? Math.round((totalRating / totalReviews) * 10) / 10 : 0,
  };
};

// Instance method to mark as helpful
reviewSchema.methods.markHelpful = function (userId: string) {
  if (!this.helpfulBy.includes(userId)) {
    this.helpfulBy.push(userId);
    this.helpfulCount += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to unmark as helpful
reviewSchema.methods.unmarkHelpful = function (userId: string) {
  const index = this.helpfulBy.indexOf(userId);
  if (index > -1) {
    this.helpfulBy.splice(index, 1);
    this.helpfulCount = Math.max(0, this.helpfulCount - 1);
    return this.save();
  }
  return Promise.resolve(this);
};

export default mongoose.model<IReview>("Review", reviewSchema);
