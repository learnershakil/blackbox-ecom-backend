// Export all services
export {
  EmailService,
  emailService,
  type EmailConfig,
  type EmailTemplate,
  type EmailOptions,
} from "./emailService";
export {
  PaymentService,
  paymentService,
  type PaymentOrder,
  type PaymentVerification,
  type RefundRequest,
  type WebhookEvent,
} from "./paymentService";
export {
  FileUploadService,
  fileUploadService,
  type CloudinaryConfig,
  type UploadOptions,
  type UploadResult,
  type DeleteResult,
} from "./fileUploadService";
export {
  PDFService,
  pdfService,
  type InvoiceData,
  type OrderReportData,
} from "./pdfService";

// Re-export for convenience
import { EmailService } from "./emailService";
import { PaymentService } from "./paymentService";
import { FileUploadService } from "./fileUploadService";
import { PDFService } from "./pdfService";

export const Email = EmailService;
export const Payment = PaymentService;
export const FileUpload = FileUploadService;
export const PDF = PDFService;
