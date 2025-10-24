import mongoose, { Document, Schema } from "mongoose";

export interface IProductVariant {
  size?: string;
  color?: string;
  sku: string;
  price: number;
  stock: number;
  images?: {
    public_id: string;
    url: string;
  }[];
}

export interface IProduct extends Document {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: mongoose.Types.ObjectId;
  subcategory?: mongoose.Types.ObjectId;
  brand?: string;
  images: {
    public_id: string;
    url: string;
  }[];
  videos?: {
    public_id: string;
    url: string;
  }[];
  variants: IProductVariant[];
  basePrice: number;
  discountPrice?: number;
  totalStock: number;
  specifications?: { [key: string]: string };
  tags: string[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  averageRating: number;
  totalReviews: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productVariantSchema = new Schema<IProductVariant>(
  {
    size: {
      type: String,
      trim: true,
      uppercase: true,
    },
    color: {
      type: String,
      trim: true,
      lowercase: true,
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    price: {
      type: Number,
      required: [true, "Variant price is required"],
      min: [0, "Price must be positive"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock must be non-negative"],
      validate: {
        validator: Number.isInteger,
        message: "Stock must be an integer",
      },
    },
    images: [
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
  },
  { _id: true }
);

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      required: [true, "Product slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug can only contain lowercase letters, numbers, and hyphens",
      ],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [50, "Brand name cannot exceed 50 characters"],
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
      required: [true, "At least one product image is required"],
      validate: {
        validator: function (images: any[]) {
          return images.length >= 1 && images.length <= 10;
        },
        message: "Product must have between 1 and 10 images",
      },
    },
    videos: [
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
    variants: {
      type: [productVariantSchema],
      required: [true, "At least one product variant is required"],
      validate: {
        validator: function (variants: IProductVariant[]) {
          return variants.length >= 1;
        },
        message: "Product must have at least one variant",
      },
    },
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Base price must be positive"],
    },
    discountPrice: {
      type: Number,
      min: [0, "Discount price must be positive"],
      validate: {
        validator: function (this: IProduct, discountPrice: number) {
          return !discountPrice || discountPrice < this.basePrice;
        },
        message: "Discount price must be less than base price",
      },
    },
    totalStock: {
      type: Number,
      default: 0,
      min: [0, "Total stock must be non-negative"],
    },
    specifications: {
      type: Map,
      of: String,
      default: new Map(),
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags: string[]) {
          return tags.length <= 20;
        },
        message: "Cannot have more than 20 tags",
      },
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, "Review count cannot be negative"],
    },
    seoTitle: {
      type: String,
      trim: true,
      maxlength: [60, "SEO title cannot exceed 60 characters"],
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: [160, "SEO description cannot exceed 160 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
productSchema.index({ slug: 1 });
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isBestSeller: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ basePrice: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ "variants.sku": 1 }, { unique: true });

// Virtual for current price (considering discount)
productSchema.virtual("currentPrice").get(function () {
  return this.discountPrice || this.basePrice;
});

// Virtual for discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (!this.discountPrice) return 0;
  return Math.round(
    ((this.basePrice - this.discountPrice) / this.basePrice) * 100
  );
});

// Virtual for in stock status
productSchema.virtual("inStock").get(function () {
  return this.totalStock > 0;
});

// Virtual for reviews
productSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id",
  foreignField: "product",
});

// Pre-save middleware to generate slug if not provided
productSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
  next();
});

// Pre-save middleware to calculate total stock
productSchema.pre("save", function (next) {
  if (this.isModified("variants")) {
    this.totalStock = this.variants.reduce(
      (total, variant) => total + variant.stock,
      0
    );
  }
  next();
});

// Pre-save middleware to set SEO fields if not provided
productSchema.pre("save", function (next) {
  if (!this.seoTitle) {
    this.seoTitle = this.name.substring(0, 60);
  }
  if (!this.seoDescription) {
    this.seoDescription =
      this.shortDescription?.substring(0, 160) ||
      this.description.substring(0, 160);
  }
  next();
});

// Static method to find products by category
productSchema.statics.findByCategory = function (
  categoryId: string,
  options: any = {}
) {
  const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
  const skip = (page - 1) * limit;

  return this.find({ category: categoryId, isActive: true })
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Static method to search products
productSchema.statics.searchProducts = function (
  query: string,
  options: any = {}
) {
  const {
    page = 1,
    limit = 20,
    sort = { score: { $meta: "textScore" } },
  } = options;
  const skip = (page - 1) * limit;

  return this.find(
    {
      $text: { $search: query },
      isActive: true,
    },
    { score: { $meta: "textScore" } }
  )
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Instance method to update rating
productSchema.methods.updateRating = async function () {
  const Review = mongoose.model("Review");
  const result = await Review.aggregate([
    { $match: { product: this._id, isApproved: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    this.averageRating = Math.round(result[0].averageRating * 10) / 10;
    this.totalReviews = result[0].totalReviews;
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }

  await this.save();
};

export default mongoose.model<IProduct>("Product", productSchema);
