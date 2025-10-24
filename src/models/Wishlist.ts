import mongoose, { Document, Schema } from "mongoose";

export interface IWishlist extends Document {
  _id: string;
  user: mongoose.Types.ObjectId;
  products: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const wishlistSchema = new Schema<IWishlist>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      unique: true,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
wishlistSchema.index({ user: 1 });
wishlistSchema.index({ products: 1 });
wishlistSchema.index({ updatedAt: -1 });

// Virtual for products count
wishlistSchema.virtual("productsCount").get(function () {
  return this.products.length;
});

// Virtual for is empty
wishlistSchema.virtual("isEmpty").get(function () {
  return this.products.length === 0;
});

// Static method to find wishlist by user
wishlistSchema.statics.findByUser = function (userId: string) {
  return this.findOne({ user: userId }).populate({
    path: "products",
    select:
      "name slug images basePrice discountPrice averageRating totalReviews isActive",
    match: { isActive: true },
  });
};

// Instance method to add product to wishlist
wishlistSchema.methods.addProduct = function (productId: string) {
  if (!this.products.includes(productId)) {
    this.products.push(productId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to remove product from wishlist
wishlistSchema.methods.removeProduct = function (productId: string) {
  const index = this.products.indexOf(productId);
  if (index > -1) {
    this.products.splice(index, 1);
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to toggle product in wishlist
wishlistSchema.methods.toggleProduct = function (productId: string) {
  const index = this.products.indexOf(productId);
  if (index > -1) {
    this.products.splice(index, 1);
  } else {
    this.products.push(productId);
  }
  return this.save();
};

// Instance method to clear wishlist
wishlistSchema.methods.clearWishlist = function () {
  this.products = [];
  return this.save();
};

// Instance method to check if product is in wishlist
wishlistSchema.methods.hasProduct = function (productId: string) {
  return this.products.includes(productId);
};

export default mongoose.model<IWishlist>("Wishlist", wishlistSchema);
