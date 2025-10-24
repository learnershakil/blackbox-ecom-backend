import mongoose, { Document, Schema } from "mongoose";

export interface ICartItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  variant?: {
    size?: string;
    color?: string;
  };
  price: number;
}

export interface ICart extends Document {
  _id: string;
  user: mongoose.Types.ObjectId;
  items: ICartItem[];
  totalItems: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      max: [10, "Quantity cannot exceed 10"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    variant: {
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
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be positive"],
    },
  },
  { _id: false }
);

const cartSchema = new Schema<ICart>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      unique: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
    totalItems: {
      type: Number,
      default: 0,
      min: [0, "Total items cannot be negative"],
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: [0, "Total amount cannot be negative"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
cartSchema.index({ user: 1 });
cartSchema.index({ "items.product": 1 });
cartSchema.index({ updatedAt: -1 });

// Virtual for is empty
cartSchema.virtual("isEmpty").get(function () {
  return this.items.length === 0;
});

// Pre-save middleware to calculate totals
cartSchema.pre("save", function (next) {
  if (this.isModified("items")) {
    if (this.items && Array.isArray(this.items)) {
      this.totalItems = this.items.reduce(
        (total, item) => total + item.quantity,
        0
      );
      this.totalAmount = this.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );

      // Round to 2 decimal places
      this.totalAmount = Math.round(this.totalAmount * 100) / 100;
    } else {
      // If items is not a valid array, set defaults
      this.totalItems = 0;
      this.totalAmount = 0;
    }
  }
  next();
});

// Static method to find cart by user
cartSchema.statics.findByUser = function (userId: string) {
  return this.findOne({ user: userId }).populate({
    path: "items.product",
    select: "name slug images basePrice discountPrice totalStock isActive",
  });
};

// Instance method to add item to cart
cartSchema.methods.addItem = function (
  productId: string,
  quantity: number,
  variant: any = {},
  price: number
) {
  const existingItemIndex = this.items.findIndex((item: any) => {
    return (
      item.product.toString() === productId &&
      JSON.stringify(item.variant) === JSON.stringify(variant)
    );
  });

  if (existingItemIndex > -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity = Math.min(
      this.items[existingItemIndex].quantity + quantity,
      10 // Max quantity limit
    );
    this.items[existingItemIndex].price = price; // Update price in case it changed
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity: Math.min(quantity, 10),
      variant,
      price,
    });
  }

  return this.save();
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = function (
  productId: string,
  quantity: number,
  variant: any = {}
) {
  const itemIndex = this.items.findIndex((item: any) => {
    return (
      item.product.toString() === productId &&
      JSON.stringify(item.variant) === JSON.stringify(variant)
    );
  });

  if (itemIndex > -1) {
    if (quantity <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = Math.min(quantity, 10);
    }
    return this.save();
  }

  throw new Error("Item not found in cart");
};

// Instance method to remove item from cart
cartSchema.methods.removeItem = function (
  productId: string,
  variant: any = {}
) {
  const itemIndex = this.items.findIndex((item: any) => {
    return (
      item.product.toString() === productId &&
      JSON.stringify(item.variant) === JSON.stringify(variant)
    );
  });

  if (itemIndex > -1) {
    this.items.splice(itemIndex, 1);
    return this.save();
  }

  throw new Error("Item not found in cart");
};

// Instance method to clear cart
cartSchema.methods.clearCart = function () {
  this.items = [];
  return this.save();
};

// Instance method to get cart summary
cartSchema.methods.getSummary = function () {
  return {
    totalItems: this.totalItems,
    totalAmount: this.totalAmount,
    itemsCount: this.items.length,
    isEmpty: this.isEmpty,
  };
};

export default mongoose.model<ICart>("Cart", cartSchema);
