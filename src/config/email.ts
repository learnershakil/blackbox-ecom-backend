import nodemailer from "nodemailer";
import Settings from "../models/Settings";

// Create transporter for Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Email template interface
export interface IEmailTemplate {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

// Send email function
export const sendEmail = async (emailData: IEmailTemplate): Promise<void> => {
  try {
    const transporter = createTransporter();
    
    // Try to get settings from database, fallback to environment variables
    let fromName = "BlackBox Commerce";
    let fromEmail = process.env.GMAIL_EMAIL!;
    let replyToEmail = process.env.GMAIL_EMAIL!;
    
    try {
      const settings = await Settings.getSettings();
      fromName = settings.emailSettings.fromName || fromName;
      fromEmail = settings.emailSettings.fromEmail || fromEmail;
      replyToEmail = settings.emailSettings.replyToEmail || replyToEmail;
    } catch (error) {
      console.log("⚠️ Database not available, using environment variables for email settings");
    }

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      replyTo: replyToEmail,
      attachments: emailData.attachments || [],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    console.log("📧 Email sent to:", emailData.to);
  } catch (error) {
    console.error("❌ Email sending error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Convenience functions for common emails
export const sendWelcomeEmail = async (userName: string, userEmail: string) => {
  const welcomeTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to BlackBox Commerce</title>
    </head>
    <body>
      <h1>Welcome ${userName}!</h1>
      <p>Thank you for joining BlackBox Commerce.</p>
      <p>Your account: ${userEmail}</p>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: userEmail,
    subject: "Welcome to BlackBox Commerce! 🎉",
    html: welcomeTemplate,
  });
};

export const sendPasswordResetEmail = async (
  userEmail: string,
  userName: string,
  resetUrl: string
) => {
  const resetTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body>
      <h1>Password Reset Request</h1>
      <p>Hello ${userName},</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 10 minutes.</p>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: userEmail,
    subject: "Reset Your Password - BlackBox Commerce",
    html: resetTemplate,
  });
};

export default { sendEmail, sendWelcomeEmail, sendPasswordResetEmail };
