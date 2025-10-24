import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { User, Product, Category, Order } from "../../models";

describe("E-commerce Integration Tests", () => {
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let categoryId: string;
  let productId: string;

  beforeEach(async () => {
    // Set JWT secret for tests
    process.env.JWT_SECRET = "test-secret";
    await global.testUtils.clearDatabase();

    // Create and authenticate user
    const user = await global.testUtils.createTestUser();
    userId = user._id.toString();
    const userLoginResponse = await request(app).post("/api/auth/login").send({
      email: "learnershakil@gmail.com",
      password: "password123",
    });
    userToken = userLoginResponse.body.data.token;

    // Create and authenticate admin
    await global.testUtils.createTestAdmin();
    const adminLoginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@example.com",
      password: "password123",
    });
    adminToken = adminLoginResponse.body.data.token;

    // Create test category
    const category = await Category.create({
      name: "Electronics",
      slug: "electronics",
      description: "Electronic products",
    });
    categoryId = category._id.toString();

    // Create test product
    const product = await Product.create({
      name: "Smartphone",
      slug: "smartphone",
      description: "Latest smartphone with advanced features",
      category: categoryId,
      basePrice: 599.99,
      variants: [
        {
          sku: "PHONE-001",
          price: 599.99,
          stock: 50,
        },
      ],
      totalStock: 50,
      tags: ["electronics", "mobile"],
      isFeatured: true,
      isBestSeller: false,
      isActive: true,
      averageRating: 0,
      totalReviews: 0,
      images: [
        {
          public_id: "test-smartphone-1",
          url: "https://test-cloudinary.com/smartphone1.jpg",
        },
      ],
    });
    productId = product._id.toString();
  });

  describe("Complete User Journey", () => {
    it("should complete full e-commerce user journey", async () => {
      // 1. Browse products
      const productsResponse = await request(app)
        .get("/api/products")
        .expect(200);

      expect(productsResponse.body.success).toBe(true);
      expect(productsResponse.body.data.products.length).toBeGreaterThan(0);

      // 2. Get product details
      const productResponse = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(productResponse.body.success).toBe(true);
      expect(productResponse.body.data.product.name).toBe("Smartphone");

      // 3. Add product to cart
      const cartResponse = await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          productId: productId,
          quantity: 2,
          variant: {
            sku: "PHONE-001",
          },
        })
        .expect(200);

      expect(cartResponse.body.success).toBe(true);

      // 4. Get cart
      const getCartResponse = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(getCartResponse.body.success).toBe(true);
      expect(getCartResponse.body.data.items.length).toBe(1);
      expect(getCartResponse.body.data.items[0].quantity).toBe(2);

      // 5. Add shipping address
      const addressResponse = await request(app)
        .post("/api/users/addresses")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          fullName: "Shakil Doe",
          phoneNumber: "1234567890",
          addressLine1: "123 Main Street",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "USA",
          isDefault: true,
        })
        .expect(201);

      expect(addressResponse.body.success).toBe(true);

      // 6. Create order
      const orderResponse = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: {
            fullName: "Shakil Ahmad",
            phoneNumber: "1234567890",
            addressLine1: "123 Main Street",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "USA",
          },
          paymentMethod: "razorpay",
        })
        .expect(201);

      expect(orderResponse.body.success).toBe(true);
      expect(orderResponse.body.data.orderStatus).toBe("pending");

      // 7. Verify order was created
      const ordersResponse = await request(app)
        .get("/api/orders/my-orders")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(ordersResponse.body.success).toBe(true);
      expect(ordersResponse.body.data.orders.length).toBe(1);

      // 8. Verify cart is cleared after order
      const emptyCartResponse = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(emptyCartResponse.body.data.items.length).toBe(0);
    });

    it("should handle wishlist functionality", async () => {
      // Add product to wishlist
      const addWishlistResponse = await request(app)
        .post("/api/wishlist/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ productId: productId })
        .expect(201);

      expect(addWishlistResponse.body.success).toBe(true);

      // Get wishlist
      const wishlistResponse = await request(app)
        .get("/api/wishlist")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(wishlistResponse.body.success).toBe(true);
      expect(wishlistResponse.body.data.products.length).toBe(1);
      expect(wishlistResponse.body.data.products[0]._id).toBe(productId);

      // Remove from wishlist
      const removeWishlistResponse = await request(app)
        .delete(`/api/wishlist/remove/${productId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(removeWishlistResponse.body.success).toBe(true);

      // Verify wishlist is empty
      const emptyWishlistResponse = await request(app)
        .get("/api/wishlist")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(emptyWishlistResponse.body.data.products.length).toBe(0);
    });

    it("should handle product reviews", async () => {
      // Create an order first (usually required for reviews)
      await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          productId: productId,
          quantity: 1,
          variant: { sku: "PHONE-001" },
        });

      await request(app)
        .post("/api/users/addresses")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          fullName: "Shakil Ahmad",
          phoneNumber: "1234567890",
          addressLine1: "123 Main Street",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "USA",
          isDefault: true,
        });

      const orderResponse = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: {
            fullName: "Shakil Ahmad",
            phoneNumber: "1234567890",
            addressLine1: "123 Main Street",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "USA",
          },
          paymentMethod: "razorpay",
        })
        .expect(201);

      // Update order status to delivered (required for reviews)
      // First: pending → processing
      await request(app)
        .patch(`/api/orders/${orderResponse.body.data._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "processing" })
        .expect(200);

      // Second: processing → shipped
      await request(app)
        .patch(`/api/orders/${orderResponse.body.data._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "shipped" })
        .expect(200);

      // Third: shipped → delivered
      await request(app)
        .patch(`/api/orders/${orderResponse.body.data._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "delivered" })
        .expect(200);

      // Add product review
      const reviewResponse = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          productId: productId,
          rating: 5,
          comment: "Excellent product! Highly recommended.",
          orderId: orderResponse.body.data._id,
        })
        .expect(201);

      expect(reviewResponse.body.success).toBe(true);
      expect(reviewResponse.body.data.rating).toBe(5);

      // Get product reviews
      const reviewsResponse = await request(app)
        .get(`/api/reviews/product/${productId}`)
        .expect(200);

      expect(reviewsResponse.body.success).toBe(true);
      expect(reviewsResponse.body.data.reviews.length).toBe(1);
      expect(reviewsResponse.body.data.reviews[0].rating).toBe(5);

      // Verify product rating updated
      const updatedProductResponse = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(updatedProductResponse.body.data.product.averageRating).toBe(5);
      expect(updatedProductResponse.body.data.product.totalReviews).toBe(1);
    });
  });

  describe("Admin Management Flow", () => {
    it("should handle complete admin product management", async () => {
      // Create new category
      const categoryResponse = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Clothing",
          slug: "clothing",
          description: "Fashion and clothing items",
        })
        .expect(201);

      const newCategoryId = categoryResponse.body.data._id;

      // Create new product
      const productResponse = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Designer T-Shirt",
          slug: "designer-t-shirt",
          description: "Premium quality designer t-shirt",
          category: newCategoryId,
          basePrice: 49.99,
          variants: [
            {
              sku: "TSHIRT-S-BLACK",
              size: "S",
              color: "Black",
              price: 49.99,
              stock: 20,
            },
            {
              sku: "TSHIRT-M-BLACK",
              size: "M",
              color: "Black",
              price: 49.99,
              stock: 30,
            },
          ],
          totalStock: 50,
          tags: ["clothing", "fashion", "tshirt"],
          isFeatured: true,
          isActive: true,
          images: [
            {
              public_id: "test-tshirt-1",
              url: "https://test-cloudinary.com/tshirt1.jpg",
            },
          ],
        })
        .expect(201);

      const newProductId = productResponse.body.data.product._id;

      // Update product
      const updateResponse = await request(app)
        .put(`/api/products/${newProductId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          basePrice: 59.99,
          isBestSeller: true,
        })
        .expect(200);

      expect(updateResponse.body.data.product.basePrice).toBe(59.99);
      expect(updateResponse.body.data.product.isBestSeller).toBe(true);

      // Get all products (admin view)
      const allProductsResponse = await request(app)
        .get("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(allProductsResponse.body.success).toBe(true);
      expect(allProductsResponse.body.data.products.length).toBeGreaterThan(1);

      // Delete product
      const deleteResponse = await request(app)
        .delete(`/api/products/${newProductId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      // Verify product is deleted
      await request(app).get(`/api/products/${newProductId}`).expect(404);
    });

    it("should handle order management", async () => {
      // First create an order as user
      await request(app)
        .post("/api/cart/add")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          productId: productId,
          quantity: 1,
          variant: { sku: "PHONE-001" },
        });

      await request(app)
        .post("/api/users/addresses")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          fullName: "Shakil Doe",
          phoneNumber: "1234567890",
          addressLine1: "123 Main Street",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "USA",
          isDefault: true,
        });

      const orderResponse = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: {
            fullName: "Shakil Doe",
            phoneNumber: "1234567890",
            addressLine1: "123 Main Street",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "USA",
          },
          paymentMethod: "razorpay",
        })
        .expect(201);

      const orderId = orderResponse.body.data._id;

      // Admin get all orders
      const allOrdersResponse = await request(app)
        .get("/api/orders")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(allOrdersResponse.body.success).toBe(true);
      expect(allOrdersResponse.body.data.orders.length).toBe(1);

      // Admin update order status
      const updateOrderResponse = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          status: "processing",
        })
        .expect(200);

      expect(updateOrderResponse.body.success).toBe(true);
      expect(updateOrderResponse.body.data.orderStatus).toBe("processing");

      // Get updated order
      const updatedOrderResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(updatedOrderResponse.body.data.orderStatus).toBe("processing");
    });

    it("should handle user management", async () => {
      // Get all users
      const usersResponse = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(usersResponse.body.success).toBe(true);
      expect(usersResponse.body.data.users.length).toBeGreaterThan(1);

      // Get specific user
      const userResponse = await request(app)
        .get(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(userResponse.body.success).toBe(true);
      expect(userResponse.body.data.user._id).toBe(userId);

      // Search users
      const searchResponse = await request(app)
        .get("/api/users?search=learnershakil@gmail.com")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.users.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid product IDs gracefully", async () => {
      await request(app).get("/api/products/invalid-id").expect(400);

      await request(app)
        .get("/api/products/507f1f77bcf86cd799439011")
        .expect(404);
    });

    it("should handle authentication errors", async () => {
      await request(app).get("/api/cart").expect(401);

      await request(app)
        .get("/api/cart")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("should handle authorization errors", async () => {
      await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Test Product",
          slug: "test-product",
        })
        .expect(403);
    });

    it("should handle validation errors", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "",
          email: "invalid-email",
          password: "123",
        })
        .expect(400);
    });
  });

  describe("API Health and Status", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("running");
    });

    it("should handle 404 for non-existent routes", async () => {
      await request(app).get("/api/non-existent-route").expect(404);
    });
  });
});
