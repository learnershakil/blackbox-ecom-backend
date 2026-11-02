import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { Cart, Coupon } from "../../models";
import { testHelpers } from "../setup";

const shippingAddress = {
  fullName: "Test User",
  phoneNumber: "9876543210",
  addressLine1: "123 Test Street",
  city: "Lucknow",
  state: "Uttar Pradesh",
  postalCode: "226001",
  country: "India",
};

describe("Order Controller - coupon validity window", () => {
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    await global.testUtils.clearDatabase();

    const user = await global.testUtils.createTestUser();
    userId = user._id.toString();

    const userLoginResponse = await request(app).post("/api/auth/login").send({
      email: "learnershakil@gmail.com",
      password: "password123",
    });
    userToken = userLoginResponse.body.data.token;

    const product = await testHelpers.createTestProduct();

    // Cart with 2 x ₹100 = ₹200 subtotal
    await Cart.create({
      user: userId,
      items: [{ product: product._id, quantity: 2, price: 100 }],
    });
  });

  it("does not apply a coupon whose validity has not started yet", async () => {
    const now = Date.now();
    await Coupon.create({
      code: "FUTURE50",
      name: "Future Sale",
      type: "percentage",
      value: 50,
      isActive: true,
      validFrom: new Date(now + 2 * 24 * 60 * 60 * 1000),
      validUntil: new Date(now + 9 * 24 * 60 * 60 * 1000),
    });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        shippingAddress,
        paymentMethod: "cod",
        couponCode: "FUTURE50",
      })
      .expect(201);

    expect(response.body.data.discountAmount).toBe(0);
    // ₹200 subtotal + ₹50 shipping (below ₹500) + 18% GST on ₹200 = ₹286
    expect(response.body.data.totalAmount).toBe(286);

    const coupon = await Coupon.findOne({ code: "FUTURE50" });
    expect(coupon?.usedCount).toBe(0);
  });

  it("still applies a coupon that is currently valid", async () => {
    const now = Date.now();
    await Coupon.create({
      code: "ACTIVE10",
      name: "Active Sale",
      type: "percentage",
      value: 10,
      isActive: true,
      validFrom: new Date(now - 24 * 60 * 60 * 1000),
      validUntil: new Date(now + 7 * 24 * 60 * 60 * 1000),
    });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        shippingAddress,
        paymentMethod: "cod",
        couponCode: "ACTIVE10",
      })
      .expect(201);

    expect(response.body.data.discountAmount).toBe(20);
    // ₹200 - ₹20 discount + ₹50 shipping + 18% GST on ₹180 = ₹262.40
    expect(response.body.data.totalAmount).toBe(262.4);

    const coupon = await Coupon.findOne({ code: "ACTIVE10" });
    expect(coupon?.usedCount).toBe(1);
  });
});
