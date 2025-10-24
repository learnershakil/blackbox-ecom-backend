import mongoose, { Document, Schema } from "mongoose";

export interface ICategory extends Document {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: {
    public_id: string;
    url: string;
  };
  parentCategory?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    slug: {
      type: String,
      required: [true, "Category slug is required"],
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
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    isActive: {
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
categorySchema.index({ slug: 1 });
categorySchema.index({ name: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1 });

// Virtual for subcategories
categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory",
});

// Virtual for products count
categorySchema.virtual("productsCount", {
  ref: "Product",
  localField: "_id",
  foreignField: "category",
  count: true,
});

// Pre-save middleware to generate slug if not provided
categorySchema.pre("save", function (next) {
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

// Pre-remove middleware to handle cascade delete
categorySchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      // Remove all subcategories
      await mongoose.model("Category").deleteMany({ parentCategory: this._id });

      // Update products to remove category reference
      await mongoose
        .model("Product")
        .updateMany({ category: this._id }, { $unset: { category: 1 } });

      next();
    } catch (error) {
      next(error as Error);
    }
  }
);

// Static method to find root categories
categorySchema.statics.findRootCategories = function () {
  return this.find({ parentCategory: null, isActive: true })
    .populate("subcategories")
    .sort({ name: 1 });
};

// Static method to find category hierarchy
categorySchema.statics.findCategoryHierarchy = async function (
  categoryId: string
) {
  const category = await this.findById(categoryId).populate("parentCategory");
  if (!category) return null;

  const hierarchy = [category];
  let parent = category.parentCategory;

  while (parent) {
    hierarchy.unshift(parent);
    parent = await this.findById(parent.parentCategory);
  }

  return hierarchy;
};

export default mongoose.model<ICategory>("Category", categorySchema);
