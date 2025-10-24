import Razorpay from "razorpay";
import crypto from "crypto";
import { config } from "dotenv";
import Logger from "../utils/logger";

config();

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
  created_at: number;
}

export interface PaymentVerification {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RefundRequest {
  payment_id: string;
  amount?: number;
  speed?: "normal" | "optimum";
  notes?: Record<string, string>;
}

export interface WebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: any;
  created_at: number;
}

export class PaymentService {
  private razorpay: Razorpay;
  private static instance: PaymentService;

  private constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Create payment order
   */
  public async createOrder(
    amount: number,
    currency: string = "INR",
    receipt?: string,
    notes?: Record<string, string>
  ): Promise<PaymentOrder> {
    try {
      const options = {
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt: receipt || `order_${Date.now()}`,
        notes: notes || {},
      };

      const order = await this.razorpay.orders.create(options);

      Logger.payment("Order created", order.id, amount, {
        currency,
        receipt: options.receipt,
      });

      return {
        id: order.id,
        amount: Number(order.amount) / 100, // Convert back to rupees
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        created_at: order.created_at,
      };
    } catch (error: any) {
      Logger.error("Failed to create payment order", {
        error: error.message,
        amount,
        currency,
        receipt,
      });
      throw new Error(`Payment order creation failed: ${error.message}`);
    }
  }

  /**
   * Verify payment signature
   */
  public verifyPaymentSignature(verification: PaymentVerification): boolean {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        verification;

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
        .update(body.toString())
        .digest("hex");

      const isValid = expectedSignature === razorpay_signature;

      Logger.payment(
        isValid
          ? "Payment signature verified"
          : "Payment signature verification failed",
        razorpay_order_id,
        undefined,
        {
          payment_id: razorpay_payment_id,
          signature_valid: isValid,
        }
      );

      return isValid;
    } catch (error: any) {
      Logger.error("Payment signature verification error", {
        error: error.message,
        verification,
      });
      return false;
    }
  }

  /**
   * Fetch payment details
   */
  public async getPayment(paymentId: string): Promise<any> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);

      Logger.payment(
        "Payment details fetched",
        payment.order_id,
        Number(payment.amount) / 100,
        {
          payment_id: paymentId,
          status: payment.status,
        }
      );

      return {
        id: payment.id,
        order_id: payment.order_id,
        amount: Number(payment.amount) / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        created_at: payment.created_at,
      };
    } catch (error: any) {
      Logger.error("Failed to fetch payment details", {
        error: error.message,
        payment_id: paymentId,
      });
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }
  }

  /**
   * Fetch order details
   */
  public async getOrder(orderId: string): Promise<PaymentOrder> {
    try {
      const order = await this.razorpay.orders.fetch(orderId);

      Logger.payment(
        "Order details fetched",
        orderId,
        Number(order.amount) / 100,
        {
          status: order.status,
        }
      );

      return {
        id: order.id,
        amount: Number(order.amount) / 100,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        created_at: order.created_at,
      };
    } catch (error: any) {
      Logger.error("Failed to fetch order details", {
        error: error.message,
        order_id: orderId,
      });
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
  }

  /**
   * Create refund
   */
  public async createRefund(refundRequest: RefundRequest): Promise<any> {
    try {
      const options: any = {
        amount: refundRequest.amount
          ? Math.round(refundRequest.amount * 100)
          : undefined,
        speed: refundRequest.speed || "normal",
        notes: refundRequest.notes || {},
      };

      const refund = await this.razorpay.payments.refund(
        refundRequest.payment_id,
        options
      );

      Logger.payment(
        "Refund created",
        refund.payment_id,
        Number(refund.amount) / 100,
        {
          refund_id: refund.id,
          status: refund.status,
        }
      );

      return {
        id: refund.id,
        payment_id: refund.payment_id,
        amount: Number(refund.amount) / 100,
        currency: refund.currency,
        status: refund.status,
        created_at: refund.created_at,
      };
    } catch (error: any) {
      Logger.error("Failed to create refund", {
        error: error.message,
        payment_id: refundRequest.payment_id,
        amount: refundRequest.amount,
      });
      throw new Error(`Refund creation failed: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  public verifyWebhookSignature(
    payload: string,
    signature: string,
    secret?: string
  ): boolean {
    try {
      const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || "";
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      Logger.securityEvent(
        isValid ? "Webhook signature verified" : "Invalid webhook signature",
        isValid ? "low" : "high",
        { signature_valid: isValid }
      );

      return isValid;
    } catch (error: any) {
      Logger.error("Webhook signature verification error", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Process webhook event
   */
  public async processWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      const { entity, event: eventType, payload } = event;

      Logger.payment(
        `Webhook event received: ${eventType}`,
        payload.payment?.entity?.order_id || "unknown",
        undefined,
        {
          entity,
          event: eventType,
        }
      );

      switch (eventType) {
        case "payment.captured":
          await this.handlePaymentCaptured(payload.payment.entity);
          break;
        case "payment.failed":
          await this.handlePaymentFailed(payload.payment.entity);
          break;
        case "order.paid":
          await this.handleOrderPaid(payload.order.entity);
          break;
        case "refund.created":
          await this.handleRefundCreated(payload.refund.entity);
          break;
        default:
          Logger.info(`Unhandled webhook event: ${eventType}`, { payload });
      }
    } catch (error: any) {
      Logger.error("Webhook event processing failed", {
        error: error.message,
        event,
      });
      throw error;
    }
  }

  private async handlePaymentCaptured(payment: any): Promise<void> {
    Logger.payment("Payment captured", payment.order_id, payment.amount / 100, {
      payment_id: payment.id,
      method: payment.method,
    });
    // Implement your business logic here
    // e.g., update order status, send confirmation email, etc.
  }

  private async handlePaymentFailed(payment: any): Promise<void> {
    Logger.payment("Payment failed", payment.order_id, payment.amount / 100, {
      payment_id: payment.id,
      error_code: payment.error_code,
      error_description: payment.error_description,
    });
    // Implement your business logic here
    // e.g., update order status, notify customer, etc.
  }

  private async handleOrderPaid(order: any): Promise<void> {
    Logger.payment("Order paid", order.id, order.amount / 100, {
      status: order.status,
    });
    // Implement your business logic here
    // e.g., fulfill order, update inventory, etc.
  }

  private async handleRefundCreated(refund: any): Promise<void> {
    Logger.payment("Refund created", refund.payment_id, refund.amount / 100, {
      refund_id: refund.id,
      status: refund.status,
    });
    // Implement your business logic here
    // e.g., update order status, notify customer, etc.
  }

  /**
   * Get payment methods
   */
  public getPaymentMethods(): string[] {
    return [
      "card",
      "netbanking",
      "wallet",
      "emi",
      "upi",
      "cardless_emi",
      "paylater",
    ];
  }

  /**
   * Validate webhook configuration
   */
  public validateConfiguration(): boolean {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      Logger.error("Razorpay configuration missing", {
        has_key_id: !!keyId,
        has_key_secret: !!keySecret,
      });
      return false;
    }

    Logger.info("Razorpay configuration validated");
    return true;
  }
}

// Export singleton instance
export const paymentService = PaymentService.getInstance();
export default PaymentService;
