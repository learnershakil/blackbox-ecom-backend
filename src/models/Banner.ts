import mongoose, { Document, Schema } from "mongoose";

export interface IBanner extends Document {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image: {
    public_id: string;
    url: string;
  };
  link?: string;
  buttonText?: string;
  position: "hero" | "featured" | "category" | "promotional";
  order: number;
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    title: {
      type: String,
      required: [true, "Banner title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [200, "Subtitle cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      public_id: {
        type: String,
        required: [true, "Image public_id is required"],
      },
      url: {
        type: String,
        required: [true, "Image URL is required"],
      },
    },
    link: {
      type: String,
      trim: true,
      validate: {
        validator: function (link: string) {
          if (!link) return true;
          // Allow relative URLs and absolute URLs
          const urlPattern = /^(https?:\/\/)|(\/)/;
          return urlPattern.test(link);
        },
        message: "Please enter a valid URL (starting with http, https, or /)",
      },
    },
    buttonText: {
      type: String,
      trim: true,
      maxlength: [50, "Button text cannot exceed 50 characters"],
      default: "Shop Now",
    },
    position: {
      type: String,
      enum: ["hero", "featured", "category", "promotional"],
      required: [true, "Banner position is required"],
      default: "promotional",
    },
    order: {
      type: Number,
      required: [true, "Banner order is required"],
      min: [0, "Order must be non-negative"],
      validate: {
        validator: Number.isInteger,
        message: "Order must be an integer",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      validate: {
        validator: function (this: IBanner, validUntil: Date) {
          return !validUntil || !this.validFrom || validUntil > this.validFrom;
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
bannerSchema.index({ position: 1, order: 1 });
bannerSchema.index({ isActive: 1 });
bannerSchema.index({ validFrom: 1, validUntil: 1 });
bannerSchema.index({ createdAt: -1 });

// Compound index to ensure unique order within position
bannerSchema.index({ position: 1, order: 1 }, { unique: true });

// Virtual for is valid
bannerSchema.virtual("isValid").get(function () {
  if (!this.isActive) return false;

  const now = new Date();
  const validFrom = this.validFrom || new Date(0);
  const validUntil = this.validUntil || new Date("2099-12-31");

  return now >= validFrom && now <= validUntil;
});

// Virtual for is expired
bannerSchema.virtual("isExpired").get(function () {
  return this.validUntil && new Date() > this.validUntil;
});

// Virtual for days remaining
bannerSchema.virtual("daysRemaining").get(function () {
  if (!this.validUntil) return null;

  const now = new Date();
  const diffTime = this.validUntil.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
});

// Pre-save middleware to handle order conflicts
bannerSchema.pre("save", async function (next) {
  if (this.isModified("order") || this.isModified("position")) {
    try {
      // Check if another banner exists with same position and order
      const existingBanner = await mongoose.model("Banner").findOne({
        position: this.position,
        order: this.order,
        _id: { $ne: this._id },
      });

      if (existingBanner) {
        // Increment order of existing banners
        await mongoose.model("Banner").updateMany(
          {
            position: this.position,
            order: { $gte: this.order },
            _id: { $ne: this._id },
          },
          { $inc: { order: 1 } }
        );
      }

      next();
    } catch (error) {
      next(error as Error);
    }
  } else {
    next();
  }
});

// Pre-remove middleware to reorder remaining banners
bannerSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      // Decrement order of banners with higher order in same position
      await mongoose.model("Banner").updateMany(
        {
          position: this.position,
          order: { $gt: this.order },
        },
        { $inc: { order: -1 } }
      );

      next();
    } catch (error) {
      next(error as Error);
    }
  }
);

// Static method to find active banners by position
bannerSchema.statics.findActiveByPosition = function (position: string) {
  const now = new Date();
  return this.find({
    position,
    isActive: true,
    $and: [
      {
        $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }],
      },
      {
        $or: [
          { validUntil: { $exists: false } },
          { validUntil: { $gte: now } },
        ],
      },
    ],
  }).sort({ order: 1 });
};

// Static method to find all active banners
bannerSchema.statics.findAllActive = function () {
  const now = new Date();
  return this.find({
    isActive: true,
    $and: [
      {
        $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }],
      },
      {
        $or: [
          { validUntil: { $exists: false } },
          { validUntil: { $gte: now } },
        ],
      },
    ],
  }).sort({ position: 1, order: 1 });
};

// Static method to reorder banners
bannerSchema.statics.reorderBanners = async function (
  position: string,
  bannerIds: string[]
) {
  const updatePromises = bannerIds.map((id, index) =>
    this.findByIdAndUpdate(id, { order: index }, { new: true })
  );

  return Promise.all(updatePromises);
};

// Instance method to move banner up
bannerSchema.methods.moveUp = async function () {
  if (this.order === 0) return this; // Already at top

  const Banner = mongoose.model("Banner");

  // Find banner with order one less
  const upperBanner = await Banner.findOne({
    position: this.position,
    order: this.order - 1,
  });

  if (upperBanner) {
    // Swap orders
    const tempOrder = this.order;
    this.order = upperBanner.order;
    upperBanner.order = tempOrder;

    await upperBanner.save();
    await this.save();
  }

  return this;
};

// Instance method to move banner down
bannerSchema.methods.moveDown = async function () {
  const Banner = mongoose.model("Banner");

  // Find banner with order one more
  const lowerBanner = await Banner.findOne({
    position: this.position,
    order: this.order + 1,
  });

  if (lowerBanner) {
    // Swap orders
    const tempOrder = this.order;
    this.order = lowerBanner.order;
    lowerBanner.order = tempOrder;

    await lowerBanner.save();
    await this.save();
  }

  return this;
};

export default mongoose.model<IBanner>("Banner", bannerSchema);
