import mongoose, { Document, Schema } from "mongoose";

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  name: string;
  image: string;
  variant?: {
    size?: string;
    color?: string;
  };
  price: number;
  quantity: number;
  subtotal: number;
}

export interface IShippingAddress {
  fullName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IOrder extends Document {
  _id: string;
  orderNumber: string;
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  couponCode?: string;
  paymentMethod: "razorpay" | "cod";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentDetails?: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  };
  orderStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  trackingNumber?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    image: {
      type: String,
      required: [true, "Product image is required"],
    },
    variant: {
      size: {
        type: String,
        trim: true,
      },
      color: {
        type: String,
        trim: true,
      },
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price must be positive"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: [0, "Subtotal must be positive"],
    },
  },
  { _id: false }
);

const shippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[0-9]{10,15}$/, "Please enter a valid phone number"],
    },
    addressLine1: {
      type: String,
      required: [true, "Address line 1 is required"],
      trim: true,
      maxlength: [200, "Address line 1 cannot exceed 200 characters"],
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [200, "Address line 2 cannot exceed 200 characters"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [50, "City cannot exceed 50 characters"],
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      maxlength: [50, "State cannot exceed 50 characters"],
    },
    postalCode: {
      type: String,
      required: [true, "Postal code is required"],
      trim: true,
      match: [/^[0-9]{5,10}$/, "Please enter a valid postal code"],
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      default: "India",
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      unique: true,
      uppercase: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    items: {
      type: [orderItemSchema],
      required: [true, "Order items are required"],
      validate: {
        validator: function (items: IOrderItem[]) {
          return items.length > 0;
        },
        message: "Order must have at least one item",
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, "Shipping address is required"],
    },
    billingAddress: {
      type: shippingAddressSchema,
    },
    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: [0, "Subtotal must be positive"],
    },
    shippingCost: {
      type: Number,
      required: [true, "Shipping cost is required"],
      min: [0, "Shipping cost must be non-negative"],
    },
    taxAmount: {
      type: Number,
      required: [true, "Tax amount is required"],
      min: [0, "Tax amount must be non-negative"],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount amount must be non-negative"],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount must be positive"],
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod"],
      required: [true, "Payment method is required"],
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentDetails: {
      razorpayOrderId: {
        type: String,
        trim: true,
      },
      razorpayPaymentId: {
        type: String,
        trim: true,
      },
      razorpaySignature: {
        type: String,
        trim: true,
      },
    },
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    trackingNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    estimatedDelivery: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ user: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ "paymentDetails.razorpayOrderId": 1 });
orderSchema.index({ trackingNumber: 1 });

// Virtual for total items count
orderSchema.virtual("totalItems").get(function () {
  if (!this.items || !Array.isArray(this.items)) {
    return 0;
  }
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for can cancel
orderSchema.virtual("canCancel").get(function () {
  return (
    ["pending", "processing"].includes(this.orderStatus) && !this.cancelledAt
  );
});

// Virtual for is delivered
orderSchema.virtual("isDelivered").get(function () {
  return this.orderStatus === "delivered" && this.deliveredAt;
});

// Pre-save middleware to generate order number
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model("Order").countDocuments();
    const orderNumber = `BB${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, "0")}`;
    this.orderNumber = orderNumber;
  }
  next();
});

// Pre-save middleware to calculate subtotal
orderSchema.pre("save", function (next) {
  if (this.isModified("items") && this.items && Array.isArray(this.items)) {
    this.subtotal = this.items.reduce(
      (total, item) => total + item.subtotal,
      0
    );
  }
  next();
});

// Pre-save middleware to set delivered date
orderSchema.pre("save", function (next) {
  if (
    this.isModified("orderStatus") &&
    this.orderStatus === "delivered" &&
    !this.deliveredAt
  ) {
    this.deliveredAt = new Date();
  }
  next();
});

// Pre-save middleware to set cancelled date
orderSchema.pre("save", function (next) {
  if (
    this.isModified("orderStatus") &&
    this.orderStatus === "cancelled" &&
    !this.cancelledAt
  ) {
    this.cancelledAt = new Date();
  }
  next();
});

// Static method to find orders by user
orderSchema.statics.findByUser = function (userId: string, options: any = {}) {
  const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
  const skip = (page - 1) * limit;

  return this.find({ user: userId })
    .populate("user", "name email")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function (
  status: string,
  options: any = {}
) {
  const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
  const skip = (page - 1) * limit;

  return this.find({ orderStatus: status })
    .populate("user", "name email")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Instance method to cancel order
orderSchema.methods.cancelOrder = function (reason: string) {
  if (!this.canCancel) {
    throw new Error("Order cannot be cancelled");
  }

  this.orderStatus = "cancelled";
  this.cancelledAt = new Date();
  this.cancellationReason = reason;

  return this.save();
};

export default mongoose.model<IOrder>("Order", orderSchema);
