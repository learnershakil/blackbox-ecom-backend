import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { config } from "dotenv";
import { beforeAll, afterEach, afterAll, vi } from "vitest";

// Load environment variables for testing
config({ path: ".env.test" });

let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect to the in-memory database
  await mongoose.connect(mongoUri);

  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_EXPIRES_IN = "7d";
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-api-key";
  process.env.CLOUDINARY_API_SECRET = "test-api-secret";
});

// Cleanup after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

// Global test utilities
global.testUtils = {
  clearDatabase: async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  },

  createTestUser: async (userData = {}) => {
    const { User } = await import("../models");
    const defaultUser = {
      name: "Test User",
      email: "learnershakil@gmail.com",
      password: "password123",
      role: "user",
      isEmailVerified: true,
      ...userData,
    };
    return await User.create(defaultUser);
  },

  createTestAdmin: async (userData = {}) => {
    const { User } = await import("../models");
    const defaultAdmin = {
      name: "Test Admin",
      email: "admin@example.com",
      password: "password123",
      role: "admin",
      isEmailVerified: true,
      ...userData,
    };
    return await User.create(defaultAdmin);
  },

  createTestProduct: async (productData: any = {}) => {
    const { Product, Category } = await import("../models");

    // Create a test category if not provided
    let category = productData.category;
    if (!category) {
      const testCategory = await Category.create({
        name: "Test Category",
        slug: "test-category",
        description: "Test category description",
        isActive: true,
      });
      category = testCategory._id;
    }

    const defaultProduct = {
      name: "Test Product",
      slug: "test-product",
      description: "Test product description",
      category,
      images: [
        {
          public_id: "test-image-1",
          url: "https://test-cloudinary.com/image1.jpg",
        },
      ],
      variants: [
        {
          sku: "TEST-001",
          price: 100,
          stock: 10,
        },
      ],
      basePrice: 100,
      totalStock: 10,
      tags: ["test"],
      isFeatured: false,
      isBestSeller: false,
      isActive: true,
      averageRating: 0,
      totalReviews: 0,
      ...productData,
    };
    return await Product.create(defaultProduct);
  },
};

// Mock external services for testing
vi.mock("../config/cloudinary", () => ({
  uploadToCloudinary: vi.fn().mockResolvedValue({
    public_id: "test-public-id",
    url: "https://test-cloudinary-url.com/image.jpg",
  }),
  deleteFromCloudinary: vi.fn().mockResolvedValue({ result: "ok" }),
}));

vi.mock("../config/email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("../config/razorpay", () => ({
  instance: {
    orders: {
      create: vi.fn().mockResolvedValue({
        id: "order_test123",
        amount: 1000,
        currency: "INR",
      }),
    },
    payments: {
      fetch: vi.fn().mockResolvedValue({
        id: "pay_test123",
        status: "captured",
      }),
    },
  },
}));

// Extend global types
declare global {
  var testUtils: {
    clearDatabase: () => Promise<void>;
    createTestUser: (userData?: any) => Promise<any>;
    createTestAdmin: (userData?: any) => Promise<any>;
    createTestProduct: (productData?: any) => Promise<any>;
  };
}

// Export testHelpers for direct import
export const testHelpers = global.testUtils;
