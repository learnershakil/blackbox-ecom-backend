import mongoose, { Document, Schema, Model } from "mongoose";

export interface ISettings extends Document {
  _id: string;
  siteName: string;
  siteDescription?: string;
  siteLogo?: {
    public_id: string;
    url: string;
  };
  favicon?: {
    public_id: string;
    url: string;
  };
  contactEmail: string;
  supportEmail: string;
  phoneNumber?: string;
  address?: string;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  paymentSettings: {
    razorpayEnabled: boolean;
    codEnabled: boolean;
    freeShippingThreshold?: number;
    shippingCost?: number;
  };
  emailSettings: {
    fromName: string;
    fromEmail: string;
    replyToEmail: string;
  };
  seoSettings: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  getEnabledPaymentMethods(): string[];
  calculateShippingCost(orderValue: number): number;
  getSocialMediaLinks(): Array<{ platform: string; url: string }>;
}

export interface ISettingsModel extends Model<ISettings> {
  getSettings(): Promise<ISettings>;
  updateSettings(updates: Partial<ISettings>): Promise<ISettings>;
}

const settingsSchema = new Schema<ISettings, ISettingsModel>(
  {
    siteName: {
      type: String,
      required: [true, "Site name is required"],
      trim: true,
      maxlength: [100, "Site name cannot exceed 100 characters"],
      default: "BlackBox Commerce",
    },
    siteDescription: {
      type: String,
      trim: true,
      maxlength: [500, "Site description cannot exceed 500 characters"],
    },
    siteLogo: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    favicon: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address",
      ],
    },
    supportEmail: {
      type: String,
      required: [true, "Support email is required"],
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address",
      ],
    },
    phoneNumber: {
      type: String,
      trim: true,
      match: [/^[0-9+\-\s()]+$/, "Please enter a valid phone number"],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },
    socialMedia: {
      facebook: {
        type: String,
        trim: true,
        match: [
          /^https?:\/\/(www\.)?facebook\.com\/.*/,
          "Please enter a valid Facebook URL",
        ],
      },
      twitter: {
        type: String,
        trim: true,
        match: [
          /^https?:\/\/(www\.)?twitter\.com\/.*/,
          "Please enter a valid Twitter URL",
        ],
      },
      instagram: {
        type: String,
        trim: true,
        match: [
          /^https?:\/\/(www\.)?instagram\.com\/.*/,
          "Please enter a valid Instagram URL",
        ],
      },
      youtube: {
        type: String,
        trim: true,
        match: [
          /^https?:\/\/(www\.)?youtube\.com\/.*/,
          "Please enter a valid YouTube URL",
        ],
      },
    },
    paymentSettings: {
      razorpayEnabled: {
        type: Boolean,
        default: true,
      },
      codEnabled: {
        type: Boolean,
        default: true,
      },
      freeShippingThreshold: {
        type: Number,
        min: [0, "Free shipping threshold must be non-negative"],
        default: 500,
      },
      shippingCost: {
        type: Number,
        min: [0, "Shipping cost must be non-negative"],
        default: 50,
      },
    },
    emailSettings: {
      fromName: {
        type: String,
        required: [true, "From name is required"],
        trim: true,
        maxlength: [100, "From name cannot exceed 100 characters"],
        default: "BlackBox Commerce",
      },
      fromEmail: {
        type: String,
        required: [true, "From email is required"],
        lowercase: true,
        trim: true,
        match: [
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
          "Please enter a valid email address",
        ],
      },
      replyToEmail: {
        type: String,
        required: [true, "Reply to email is required"],
        lowercase: true,
        trim: true,
        match: [
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
          "Please enter a valid email address",
        ],
      },
    },
    seoSettings: {
      metaTitle: {
        type: String,
        trim: true,
        maxlength: [60, "Meta title cannot exceed 60 characters"],
      },
      metaDescription: {
        type: String,
        trim: true,
        maxlength: [160, "Meta description cannot exceed 160 characters"],
      },
      metaKeywords: {
        type: String,
        trim: true,
        maxlength: [255, "Meta keywords cannot exceed 255 characters"],
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure only one settings document exists
settingsSchema.index({}, { unique: true });

// Pre-save middleware to ensure singleton pattern
settingsSchema.pre("save", async function (next) {
  if (this.isNew) {
    const existingSettings = await mongoose.model("Settings").findOne();
    if (existingSettings) {
      const error = new Error(
        "Settings document already exists. Use update instead."
      );
      return next(error);
    }
  }
  next();
});

// Static method to get settings (singleton)
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();

  if (!settings) {
    // Create default settings if none exist
    settings = await this.create({
      siteName: "BlackBox Commerce",
      contactEmail: "contact@blackboxcommerce.com",
      supportEmail: "support@blackboxcommerce.com",
      emailSettings: {
        fromName: "BlackBox Commerce",
        fromEmail: "noreply@blackboxcommerce.com",
        replyToEmail: "contact@blackboxcommerce.com",
      },
    });
  }

  return settings;
};

// Static method to update settings
settingsSchema.statics.updateSettings = async function (
  updates: Partial<ISettings>
) {
  let settings = await this.findOne();

  if (!settings) {
    settings = await this.create(updates);
  } else {
    Object.assign(settings, updates);
    await settings.save();
  }

  return settings;
};

// Instance method to get payment methods
settingsSchema.methods.getEnabledPaymentMethods = function () {
  const methods: string[] = [];

  if (this.paymentSettings.razorpayEnabled) {
    methods.push("razorpay");
  }

  if (this.paymentSettings.codEnabled) {
    methods.push("cod");
  }

  return methods;
};

// Instance method to calculate shipping cost
settingsSchema.methods.calculateShippingCost = function (orderValue: number) {
  if (
    this.paymentSettings.freeShippingThreshold &&
    orderValue >= this.paymentSettings.freeShippingThreshold
  ) {
    return 0;
  }

  return this.paymentSettings.shippingCost || 0;
};

// Instance method to get social media links
settingsSchema.methods.getSocialMediaLinks = function () {
  return Object.entries(this.socialMedia || {})
    .filter(([_, url]) => url)
    .map(([platform, url]) => ({ platform, url }));
};

export default mongoose.model<ISettings, ISettingsModel>(
  "Settings",
  settingsSchema
);
