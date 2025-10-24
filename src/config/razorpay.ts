const Razorpay = require("razorpay");
import * as crypto from "crypto";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Interface for order creation
export interface IRazorpayOrderOptions {
  amount: number; // Amount in smallest currency unit (e.g., paisa for INR)
  currency?: string;
  receipt?: string;
  notes?: Record<string, any>;
}

// Interface for payment verification
export interface IRazorpayPaymentVerification {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// Create Razorpay order
export const createRazorpayOrder = async (options: IRazorpayOrderOptions) => {
  try {
    const orderOptions = {
      amount: Math.round(options.amount * 100), // Convert to paisa
      currency: options.currency || "INR",
      receipt: options.receipt || `order_${Date.now()}`,
      notes: options.notes || {},
    };

    const order = await razorpay.orders.create(orderOptions);
    return order;
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    throw new Error("Failed to create Razorpay order");
  }
};

// Verify Razorpay payment signature
export const verifyRazorpayPayment = (
  verification: IRazorpayPaymentVerification
): boolean => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      verification;

    // Create signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest("hex");

    // Compare signatures
    return generated_signature === razorpay_signature;
  } catch (error) {
    console.error("Razorpay signature verification error:", error);
    return false;
  }
};

// Verify webhook signature
export const verifyWebhookSignature = (
  webhookBody: string,
  webhookSignature: string
): boolean => {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(webhookBody)
      .digest("hex");

    return expectedSignature === webhookSignature;
  } catch (error) {
    console.error("Webhook signature verification error:", error);
    return false;
  }
};

// Fetch payment details
export const fetchPaymentDetails = async (paymentId: string) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error("Razorpay payment fetch error:", error);
    throw new Error("Failed to fetch payment details");
  }
};

// Capture payment (for authorized payments)
export const capturePayment = async (paymentId: string, amount: number) => {
  try {
    const captureResponse = await razorpay.payments.capture(
      paymentId,
      Math.round(amount * 100), // Convert to paisa
      "INR"
    );
    return captureResponse;
  } catch (error) {
    console.error("Razorpay payment capture error:", error);
    throw new Error("Failed to capture payment");
  }
};

// Refund payment
export const refundPayment = async (
  paymentId: string,
  amount?: number,
  notes?: Record<string, any>
) => {
  try {
    const refundOptions: any = {};

    if (amount) {
      refundOptions.amount = Math.round(amount * 100); // Convert to paisa
    }

    if (notes) {
      refundOptions.notes = notes;
    }

    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    return refund;
  } catch (error) {
    console.error("Razorpay refund error:", error);
    throw new Error("Failed to process refund");
  }
};

// Get refund details
export const fetchRefundDetails = async (refundId: string) => {
  try {
    const refund = await razorpay.refunds.fetch(refundId);
    return refund;
  } catch (error) {
    console.error("Razorpay refund fetch error:", error);
    throw new Error("Failed to fetch refund details");
  }
};

// Convert amount to paisa (smallest currency unit)
export const convertToPaisa = (amount: number): number => {
  return Math.round(amount * 100);
};

// Convert amount from paisa to rupees
export const convertFromPaisa = (amount: number): number => {
  return Math.round((amount / 100) * 100) / 100; // Round to 2 decimal places
};

// Generate receipt ID
export const generateReceiptId = (prefix: string = "BB"): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
};

// Validate webhook event
export const validateWebhookEvent = (event: any): boolean => {
  const requiredFields = ["entity", "account_id", "event", "created_at"];
  return requiredFields.every((field) => event.hasOwnProperty(field));
};

export default razorpay;
