import { Router, Request, Response } from "express";

const router: Router = Router();

// Mock authentication middleware for testing
const mockAuth = (req: any, res: Response, next: any) => {
  // For now, just pass through - we'll implement proper auth later
  (req as any).user = { id: "test-user", role: "user" }; // Mock user
  next();
};

// Mock admin middleware
const mockAdminAuth = (req: any, res: Response, next: any) => {
  (req as any).user = { id: "test-admin", role: "admin" }; // Mock admin
  next();
};

// ================================
// AUTH ROUTES (/api/auth/*)
// ================================
const authRouter = Router();

authRouter.post("/register", (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      user: {
        id: "mock-user-id",
        firstName: req.body.firstName || "Shakil",
        lastName: req.body.lastName || "Ahmad",
        email: req.body.email || "learnershakil@gmail.com",
        role: "user",
      },
      token: "mock-jwt-token",
    },
  });
});

authRouter.post("/login", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: "mock-user-id",
        firstName: "Shakil",
        lastName: "Ahmad",
        email: req.body.email || "learnershakil@gmail.com",
        role: "user",
      },
      token: "mock-jwt-token",
    },
  });
});

authRouter.post("/logout", mockAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

authRouter.get("/profile", mockAuth, (req: any, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      user: (req as any).user,
    },
  });
});

authRouter.post("/forgot-password", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Password reset email sent",
  });
});

authRouter.post("/reset-password/:token", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Password reset successful",
  });
});

// ================================
// USER ROUTES (/api/users/*)
// ================================
const userRouter = Router();

userRouter.get("/addresses", mockAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      addresses: [
        {
          id: "addr-1",
          type: "home",
          street: "123 Main St",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA",
          isDefault: true,
        },
      ],
    },
  });
});

userRouter.post("/addresses", mockAuth, (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: "Address added successfully",
    data: {
      address: {
        id: "new-address-id",
        ...req.body,
      },
    },
  });
});

// ================================
// PRODUCT ROUTES (/api/products/*)
// ================================
const productRouter = Router();

productRouter.get("/", (req: Request, res: Response) => {
  const { page = 1, limit = 10, category, search } = req.query;

  res.status(200).json({
    success: true,
    data: {
      products: [
        {
          id: "prod-1",
          name: "Sample Product",
          description: "A great product",
          price: 99.99,
          category: "electronics",
          images: ["https://example.com/image1.jpg"],
          stock: 50,
          isActive: true,
        },
      ],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: 1,
        pages: 1,
      },
    },
  });
});

productRouter.get("/:id", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      product: {
        id: req.params.id,
        name: "Sample Product",
        description: "A great product",
        price: 99.99,
        category: "electronics",
        images: ["https://example.com/image1.jpg"],
        stock: 50,
        isActive: true,
      },
    },
  });
});

productRouter.post("/", mockAdminAuth, (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: "Product created successfully",
    data: {
      product: {
        id: "new-product-id",
        ...req.body,
      },
    },
  });
});

// ================================
// CATEGORY ROUTES (/api/categories/*)
// ================================
const categoryRouter = Router();

categoryRouter.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      categories: [
        {
          id: "cat-1",
          name: "Electronics",
          slug: "electronics",
          description: "Electronic products",
          isActive: true,
        },
      ],
    },
  });
});

// ================================
// CART ROUTES (/api/cart/*)
// ================================
const cartRouter = Router();

cartRouter.get("/", mockAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      cart: {
        items: [
          {
            productId: "prod-1",
            quantity: 2,
            price: 99.99,
          },
        ],
        total: 199.98,
      },
    },
  });
});

cartRouter.post("/add", mockAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Item added to cart",
  });
});

// ================================
// ORDER ROUTES (/api/orders/*)
// ================================
const orderRouter = Router();

orderRouter.get("/", mockAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      orders: [
        {
          id: "order-1",
          status: "pending",
          total: 199.98,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  });
});

orderRouter.post("/", mockAuth, (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: {
      order: {
        id: "new-order-id",
        status: "pending",
        total: req.body.total || 0,
      },
    },
  });
});

// ================================
// REVIEW ROUTES (/api/reviews/*)
// ================================
const reviewRouter = Router();

reviewRouter.get("/product/:productId", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      reviews: [
        {
          id: "review-1",
          productId: req.params.productId,
          rating: 5,
          comment: "Great product!",
          user: "Shakil Ahmad",
        },
      ],
    },
  });
});

// ================================
// COUPON ROUTES (/api/coupons/*)
// ================================
const couponRouter = Router();

couponRouter.post("/validate", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      valid: true,
      discount: 10,
      coupon: {
        code: req.body.code,
        type: "percentage",
        value: 10,
      },
    },
  });
});

// ================================
// BANNER ROUTES (/api/banners/*)
// ================================
const bannerRouter = Router();

bannerRouter.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      banners: [
        {
          id: "banner-1",
          title: "Welcome Banner",
          imageUrl: "https://example.com/banner.jpg",
          isActive: true,
        },
      ],
    },
  });
});

// ================================
// ADMIN ROUTES (/api/admin/*)
// ================================
const adminRouter = Router();

adminRouter.get("/dashboard", mockAdminAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalUsers: 100,
        totalProducts: 50,
        totalOrders: 25,
        revenue: 5000,
      },
    },
  });
});

// ================================
// WISHLIST ROUTES (/api/wishlist/*)
// ================================
const wishlistRouter = Router();

wishlistRouter.get("/", mockAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      wishlist: [
        {
          productId: "prod-1",
          addedAt: new Date().toISOString(),
        },
      ],
    },
  });
});

// ================================
// REGISTER ALL ROUTES
// ================================
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/products", productRouter);
router.use("/categories", categoryRouter);
router.use("/cart", cartRouter);
router.use("/orders", orderRouter);
router.use("/reviews", reviewRouter);
router.use("/coupons", couponRouter);
router.use("/banners", bannerRouter);
router.use("/admin", adminRouter);
router.use("/wishlist", wishlistRouter);

// API Health check route
router.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    routes: {
      auth: "/api/auth",
      users: "/api/users",
      products: "/api/products",
      categories: "/api/categories",
      cart: "/api/cart",
      orders: "/api/orders",
      reviews: "/api/reviews",
      coupons: "/api/coupons",
      banners: "/api/banners",
      admin: "/api/admin",
      wishlist: "/api/wishlist",
    },
  });
});

export default router;
