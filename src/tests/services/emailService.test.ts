import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "../../services/emailService";

// Mock nodemailer
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        response: "250 OK",
      }),
      verify: vi.fn().mockResolvedValue(true),
    })),
  },
}));

// Mock Logger to avoid console output during tests
vi.mock("../../utils/logger", () => ({
  default: {
    email: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("EmailService", () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    emailService = EmailService.getInstance();

    // Reset the transporter to the default mock for each test
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        response: "250 OK",
      }),
      verify: vi.fn().mockResolvedValue(true),
    };

    (emailService as any).transporter = mockTransporter;
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = EmailService.getInstance();
      const instance2 = EmailService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      const emailOptions = {
        to: "learnershakil@gmail.com",
        subject: "Test Email",
        html: "<h1>Test Email</h1>",
        text: "Test Email",
      };

      const result = await emailService.sendEmail(emailOptions);

      expect(result).toBe(true);
    });

    it("should handle email sending errors", async () => {
      // Mock transporter to throw error
      const errorTransporter = {
        sendMail: vi.fn().mockRejectedValue(new Error("SMTP Error")),
        verify: vi.fn().mockResolvedValue(true),
      };

      (emailService as any).transporter = errorTransporter;

      const emailOptions = {
        to: "learnershakil@gmail.com",
        subject: "Test Email",
        html: "<h1>Test Email</h1>",
      };

      const result = await emailService.sendEmail(emailOptions);

      expect(result).toBe(false);
    });

    it("should send email to multiple recipients", async () => {
      const emailOptions = {
        to: ["learnershakil@gmail.com", "test2@example.com"],
        subject: "Test Email",
        html: "<h1>Test Email</h1>",
      };

      const result = await emailService.sendEmail(emailOptions);

      expect(result).toBe(true);
    });

    it("should include attachments", async () => {
      const emailOptions = {
        to: "learnershakil@gmail.com",
        subject: "Test Email with Attachment",
        html: "<h1>Test Email</h1>",
        attachments: [
          {
            filename: "test.txt",
            content: Buffer.from("Test file content"),
            contentType: "text/plain",
          },
        ],
      };

      const result = await emailService.sendEmail(emailOptions);

      expect(result).toBe(true);
    });
  });

  describe("sendWelcomeEmail", () => {
    it("should send welcome email with user data", async () => {
      const userData = {
        firstName: "Shakil",
        email: "learnershakil@gmail.com",
      };

      const result = await emailService.sendWelcomeEmail(
        "learnershakil@gmail.com",
        userData
      );

      expect(result).toBe(true);
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email", async () => {
      const userData = {
        firstName: "Shakil",
        resetToken: "reset-token-123",
      };

      const result = await emailService.sendPasswordResetEmail(
        "learnershakil@gmail.com",
        userData
      );

      expect(result).toBe(true);
    });
  });

  describe("sendOrderConfirmationEmail", () => {
    it("should send order confirmation email", async () => {
      const orderData = {
        firstName: "Shakil",
        orderId: "order-123",
        totalAmount: 99.99,
        orderDate: "2025-07-16",
      };

      const result = await emailService.sendOrderConfirmationEmail(
        "learnershakil@gmail.com",
        orderData
      );

      expect(result).toBe(true);
    });
  });

  describe("verifyConnection", () => {
    it("should verify SMTP connection", async () => {
      const isConnected = await emailService.verifyConnection();
      expect(isConnected).toBe(true);
    });

    it("should handle connection errors", async () => {
      // Mock transporter to throw error on verify
      (emailService as any).transporter.verify = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      const isConnected = await emailService.verifyConnection();
      expect(isConnected).toBe(false);
    });
  });
});
