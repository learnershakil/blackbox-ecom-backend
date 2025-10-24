import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import Logger from "../utils/logger";

config();

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  private transporter: Transporter;
  private static instance: EmailService;

  private constructor() {
    this.transporter = this.createTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private createTransporter(): Transporter {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    };

    return nodemailer.createTransport(config);
  }

  /**
   * Send email
   */
  public async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions: SendMailOptions = {
        from: `${process.env.EMAIL_FROM_NAME || "BlackBox Commerce"} <${process.env.EMAIL_FROM || "noreply@blackbox-commerce.com"}>`,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        cc: options.cc
          ? Array.isArray(options.cc)
            ? options.cc.join(", ")
            : options.cc
          : undefined,
        bcc: options.bcc
          ? Array.isArray(options.bcc)
            ? options.bcc.join(", ")
            : options.bcc
          : undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        })),
      };

      const result = await this.transporter.sendMail(mailOptions);

      Logger.email(
        "Email sent successfully",
        options.to.toString(),
        undefined,
        {
          messageId: result.messageId,
          subject: options.subject,
        }
      );

      return true;
    } catch (error: any) {
      Logger.error("Failed to send email", {
        error: error.message,
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }

  /**
   * Load email template
   */
  private loadTemplate(templateName: string): string {
    try {
      const templatePath = path.join(
        __dirname,
        "../templates/emails",
        `${templateName}.html`
      );
      return fs.readFileSync(templatePath, "utf8");
    } catch (error) {
      Logger.warn(`Template ${templateName} not found, using fallback`, {
        error,
      });
      return this.getFallbackTemplate(templateName);
    }
  }

  /**
   * Replace placeholders in template
   */
  private replacePlaceholders(
    template: string,
    data: Record<string, string>
  ): string {
    let result = template;
    Object.keys(data).forEach((key) => {
      const placeholder = new RegExp(`{{${key}}}`, "g");
      result = result.replace(placeholder, data[key]);
    });
    return result;
  }

  /**
   * Get fallback template when file doesn't exist
   */
  private getFallbackTemplate(templateName: string): string {
    const baseTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>{{title}}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
          .header { background: #333; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>BlackBox Commerce</h1>
          </div>
          <div class="content">
            {{content}}
          </div>
          <div class="footer">
            <p>&copy; 2025 BlackBox Commerce. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    switch (templateName) {
      case "welcome":
        return baseTemplate.replace(
          "{{content}}",
          `
          <h2>Welcome to BlackBox Commerce!</h2>
          <p>Hi {{firstName}},</p>
          <p>Thank you for joining BlackBox Commerce. We're excited to have you on board!</p>
          <p>Your account has been successfully created with email: {{email}}</p>
          <a href="{{loginUrl}}" class="button">Login to Your Account</a>
          <p>If you have any questions, feel free to contact our support team.</p>
        `
        );
      case "order-confirmation":
        return baseTemplate.replace(
          "{{content}}",
          `
          <h2>Order Confirmation</h2>
          <p>Hi {{firstName}},</p>
          <p>Thank you for your order! Here are the details:</p>
          <p><strong>Order ID:</strong> {{orderId}}</p>
          <p><strong>Total Amount:</strong> ₹{{totalAmount}}</p>
          <p><strong>Order Date:</strong> {{orderDate}}</p>
          <a href="{{orderUrl}}" class="button">View Order Details</a>
          <p>We'll notify you once your order is shipped.</p>
        `
        );
      case "password-reset":
        return baseTemplate.replace(
          "{{content}}",
          `
          <h2>Password Reset Request</h2>
          <p>Hi {{firstName}},</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <a href="{{resetUrl}}" class="button">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
        );
      default:
        return baseTemplate.replace(
          "{{content}}",
          `
          <h2>{{title}}</h2>
          <p>{{message}}</p>
        `
        );
    }
  }

  /**
   * Send welcome email
   */
  public async sendWelcomeEmail(
    to: string,
    userData: { firstName: string; email: string }
  ): Promise<boolean> {
    const template = this.loadTemplate("welcome");
    const html = this.replacePlaceholders(template, {
      title: "Welcome to BlackBox Commerce",
      firstName: userData.firstName,
      email: userData.email,
      loginUrl:
        `${process.env.FRONTEND_URL}/login` || "http://localhost:3000/login",
    });

    return this.sendEmail({
      to,
      subject: "Welcome to BlackBox Commerce!",
      html,
    });
  }

  /**
   * Send order confirmation email
   */
  public async sendOrderConfirmationEmail(
    to: string,
    orderData: {
      firstName: string;
      orderId: string;
      totalAmount: number;
      orderDate: string;
    }
  ): Promise<boolean> {
    const template = this.loadTemplate("order-confirmation");
    const html = this.replacePlaceholders(template, {
      title: "Order Confirmation",
      firstName: orderData.firstName,
      orderId: orderData.orderId,
      totalAmount: orderData.totalAmount.toString(),
      orderDate: orderData.orderDate,
      orderUrl:
        `${process.env.FRONTEND_URL}/orders/${orderData.orderId}` ||
        `http://localhost:3000/orders/${orderData.orderId}`,
    });

    return this.sendEmail({
      to,
      subject: `Order Confirmation - ${orderData.orderId}`,
      html,
    });
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(
    to: string,
    userData: { firstName: string; resetToken: string }
  ): Promise<boolean> {
    const template = this.loadTemplate("password-reset");
    const html = this.replacePlaceholders(template, {
      title: "Password Reset Request",
      firstName: userData.firstName,
      resetUrl:
        `${process.env.FRONTEND_URL}/reset-password?token=${userData.resetToken}` ||
        `http://localhost:3000/reset-password?token=${userData.resetToken}`,
    });

    return this.sendEmail({
      to,
      subject: "Password Reset Request",
      html,
    });
  }

  /**
   * Send order shipped email
   */
  public async sendOrderShippedEmail(
    to: string,
    orderData: {
      firstName: string;
      orderId: string;
      trackingNumber?: string;
    }
  ): Promise<boolean> {
    const template = this.loadTemplate("order-shipped");
    const html = this.replacePlaceholders(template, {
      title: "Order Shipped",
      firstName: orderData.firstName,
      orderId: orderData.orderId,
      trackingNumber: orderData.trackingNumber || "N/A",
      orderUrl:
        `${process.env.FRONTEND_URL}/orders/${orderData.orderId}` ||
        `http://localhost:3000/orders/${orderData.orderId}`,
    });

    return this.sendEmail({
      to,
      subject: `Order Shipped - ${orderData.orderId}`,
      html,
    });
  }

  /**
   * Verify email configuration
   */
  public async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      Logger.info("Email service connection verified");
      return true;
    } catch (error: any) {
      Logger.error("Email service connection failed", { error: error.message });
      return false;
    }
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();
export default EmailService;
