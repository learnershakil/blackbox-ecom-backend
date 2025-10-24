import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import Logger from "../utils/logger";

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: string;
  dueDate?: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  company: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
  };
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    tax?: number;
  }>;
  subtotal: number;
  tax: number;
  discount?: number;
  shipping?: number;
  total: number;
  paymentMethod?: string;
  notes?: string;
}

export interface OrderReportData {
  title: string;
  dateRange: {
    from: string;
    to: string;
  };
  orders: Array<{
    orderNumber: string;
    customerName: string;
    date: string;
    total: number;
    status: string;
    paymentMethod: string;
  }>;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
}

export class PDFService {
  private static instance: PDFService;

  private constructor() {}

  public static getInstance(): PDFService {
    if (!PDFService.instance) {
      PDFService.instance = new PDFService();
    }
    return PDFService.instance;
  }

  /**
   * Generate invoice PDF
   */
  public async generateInvoice(invoiceData: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(buffers);
          Logger.info("Invoice PDF generated", {
            invoice_number: invoiceData.invoiceNumber,
            customer: invoiceData.customer.name,
            total: invoiceData.total,
          });
          resolve(pdfBuffer);
        });

        doc.on("error", (error) => {
          Logger.error("Invoice PDF generation failed", {
            error: error.message,
            invoice_number: invoiceData.invoiceNumber,
          });
          reject(error);
        });

        // Header
        this.generateInvoiceHeader(doc, invoiceData);

        // Customer and company info
        this.generateInvoiceCustomerInfo(doc, invoiceData);

        // Invoice table
        this.generateInvoiceTable(doc, invoiceData);

        // Footer
        this.generateInvoiceFooter(doc, invoiceData);

        doc.end();
      } catch (error: any) {
        Logger.error("Invoice PDF generation error", {
          error: error.message,
          invoice_number: invoiceData.invoiceNumber,
        });
        reject(error);
      }
    });
  }

  private generateInvoiceHeader(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceData
  ): void {
    doc.fillColor("#333333").fontSize(20).text("INVOICE", 50, 50);

    doc
      .fontSize(10)
      .text(`Invoice Number: ${invoice.invoiceNumber}`, 350, 50)
      .text(`Invoice Date: ${invoice.invoiceDate}`, 350, 65)
      .text(`Order Number: ${invoice.orderNumber}`, 350, 80);

    if (invoice.dueDate) {
      doc.text(`Due Date: ${invoice.dueDate}`, 350, 95);
    }

    // Line under header
    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(50, 120)
      .lineTo(550, 120)
      .stroke();
  }

  private generateInvoiceCustomerInfo(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceData
  ): void {
    let currentY = 140;

    // Company info (left side)
    doc.fillColor("#333333").fontSize(12).text("From:", 50, currentY);

    doc
      .fontSize(10)
      .text(invoice.company.name, 50, currentY + 20)
      .text(invoice.company.address.line1, 50, currentY + 35);

    if (invoice.company.address.line2) {
      doc.text(invoice.company.address.line2, 50, currentY + 50);
      currentY += 15;
    }

    doc.text(
      `${invoice.company.address.city}, ${invoice.company.address.state} ${invoice.company.address.postalCode}`,
      50,
      currentY + 50
    );
    doc.text(invoice.company.address.country, 50, currentY + 65);

    if (invoice.company.phone) {
      doc.text(`Phone: ${invoice.company.phone}`, 50, currentY + 80);
    }
    if (invoice.company.email) {
      doc.text(`Email: ${invoice.company.email}`, 50, currentY + 95);
    }
    if (invoice.company.taxId) {
      doc.text(`Tax ID: ${invoice.company.taxId}`, 50, currentY + 110);
    }

    // Customer info (right side)
    doc.fontSize(12).text("Bill To:", 300, 140);

    doc
      .fontSize(10)
      .text(invoice.customer.name, 300, 160)
      .text(invoice.customer.email, 300, 175);

    if (invoice.customer.phone) {
      doc.text(`Phone: ${invoice.customer.phone}`, 300, 190);
    }

    doc.text(invoice.customer.address.line1, 300, 205);
    if (invoice.customer.address.line2) {
      doc.text(invoice.customer.address.line2, 300, 220);
      currentY += 15;
    }

    doc.text(
      `${invoice.customer.address.city}, ${invoice.customer.address.state} ${invoice.customer.address.postalCode}`,
      300,
      220
    );
    doc.text(invoice.customer.address.country, 300, 235);
  }

  private generateInvoiceTable(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceData
  ): void {
    let currentY = 280;
    const tableTop = currentY;

    // Table headers
    doc
      .fillColor("#333333")
      .fontSize(10)
      .text("Item", 50, tableTop)
      .text("Qty", 200, tableTop)
      .text("Unit Price", 250, tableTop)
      .text("Total", 350, tableTop);

    // Table header line
    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(50, tableTop + 20)
      .lineTo(550, tableTop + 20)
      .stroke();

    currentY = tableTop + 30;

    // Table rows
    invoice.items.forEach((item) => {
      doc
        .fontSize(9)
        .text(item.name, 50, currentY, { width: 140 })
        .text(item.quantity.toString(), 200, currentY)
        .text(`₹${item.unitPrice.toFixed(2)}`, 250, currentY)
        .text(`₹${item.total.toFixed(2)}`, 350, currentY);

      if (item.description) {
        currentY += 15;
        doc
          .fillColor("#666666")
          .fontSize(8)
          .text(item.description, 50, currentY, { width: 140 });
      }

      currentY += 25;
    });

    // Totals section
    const totalsY = currentY + 20;

    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(300, totalsY)
      .lineTo(550, totalsY)
      .stroke();

    doc
      .fillColor("#333333")
      .fontSize(10)
      .text("Subtotal:", 400, totalsY + 10)
      .text(`₹${invoice.subtotal.toFixed(2)}`, 480, totalsY + 10);

    if (invoice.discount && invoice.discount > 0) {
      doc
        .text("Discount:", 400, totalsY + 25)
        .text(`-₹${invoice.discount.toFixed(2)}`, 480, totalsY + 25);
    }

    if (invoice.shipping && invoice.shipping > 0) {
      doc
        .text("Shipping:", 400, totalsY + 40)
        .text(`₹${invoice.shipping.toFixed(2)}`, 480, totalsY + 40);
    }

    doc
      .text("Tax:", 400, totalsY + 55)
      .text(`₹${invoice.tax.toFixed(2)}`, 480, totalsY + 55);

    // Total line
    doc
      .strokeColor("#333333")
      .lineWidth(2)
      .moveTo(400, totalsY + 75)
      .lineTo(550, totalsY + 75)
      .stroke();

    doc
      .fontSize(12)
      .text("Total:", 400, totalsY + 85)
      .text(`₹${invoice.total.toFixed(2)}`, 480, totalsY + 85);
  }

  private generateInvoiceFooter(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceData
  ): void {
    const footerY = doc.page.height - 100;

    if (invoice.paymentMethod) {
      doc
        .fontSize(10)
        .text(`Payment Method: ${invoice.paymentMethod}`, 50, footerY);
    }

    if (invoice.notes) {
      doc
        .fontSize(9)
        .text("Notes:", 50, footerY + 20)
        .text(invoice.notes, 50, footerY + 35, { width: 500 });
    }

    // Thank you message
    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("Thank you for your business!", 50, footerY + 60);
  }

  /**
   * Generate order report PDF
   */
  public async generateOrderReport(
    reportData: OrderReportData
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(buffers);
          Logger.info("Order report PDF generated", {
            title: reportData.title,
            orders_count: reportData.orders.length,
            total_revenue: reportData.summary.totalRevenue,
          });
          resolve(pdfBuffer);
        });

        doc.on("error", (error) => {
          Logger.error("Order report PDF generation failed", {
            error: error.message,
            title: reportData.title,
          });
          reject(error);
        });

        // Header
        this.generateReportHeader(doc, reportData);

        // Summary
        this.generateReportSummary(doc, reportData);

        // Orders table
        this.generateOrdersTable(doc, reportData);

        doc.end();
      } catch (error: any) {
        Logger.error("Order report PDF generation error", {
          error: error.message,
          title: reportData.title,
        });
        reject(error);
      }
    });
  }

  private generateReportHeader(
    doc: PDFKit.PDFDocument,
    report: OrderReportData
  ): void {
    doc.fillColor("#333333").fontSize(18).text(report.title, 50, 50);

    doc
      .fontSize(12)
      .text(
        `Report Period: ${report.dateRange.from} to ${report.dateRange.to}`,
        50,
        80
      );

    doc
      .fontSize(10)
      .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 100);

    // Line under header
    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(50, 120)
      .lineTo(550, 120)
      .stroke();
  }

  private generateReportSummary(
    doc: PDFKit.PDFDocument,
    report: OrderReportData
  ): void {
    const summaryY = 140;

    doc.fillColor("#333333").fontSize(14).text("Summary", 50, summaryY);

    doc
      .fontSize(11)
      .text(`Total Orders: ${report.summary.totalOrders}`, 50, summaryY + 25)
      .text(
        `Total Revenue: ₹${report.summary.totalRevenue.toFixed(2)}`,
        200,
        summaryY + 25
      )
      .text(
        `Average Order Value: ₹${report.summary.averageOrderValue.toFixed(2)}`,
        350,
        summaryY + 25
      );

    // Line after summary
    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(50, summaryY + 50)
      .lineTo(550, summaryY + 50)
      .stroke();
  }

  private generateOrdersTable(
    doc: PDFKit.PDFDocument,
    report: OrderReportData
  ): void {
    let currentY = 220;
    const tableTop = currentY;

    // Table headers
    doc
      .fillColor("#333333")
      .fontSize(10)
      .text("Order #", 50, tableTop)
      .text("Customer", 120, tableTop)
      .text("Date", 220, tableTop)
      .text("Total", 280, tableTop)
      .text("Status", 340, tableTop)
      .text("Payment", 420, tableTop);

    // Table header line
    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    currentY = tableTop + 25;

    // Table rows
    report.orders.forEach((order, index) => {
      // Alternate row colors
      if (index % 2 === 0) {
        doc
          .rect(45, currentY - 5, 510, 20)
          .fillColor("#f8f9fa")
          .fill();
      }

      doc
        .fillColor("#333333")
        .fontSize(9)
        .text(order.orderNumber, 50, currentY)
        .text(order.customerName, 120, currentY, { width: 90 })
        .text(order.date, 220, currentY)
        .text(`₹${order.total.toFixed(2)}`, 280, currentY)
        .text(order.status, 340, currentY)
        .text(order.paymentMethod, 420, currentY);

      currentY += 20;

      // Add new page if needed
      if (currentY > doc.page.height - 100) {
        doc.addPage();
        currentY = 50;
      }
    });
  }

  /**
   * Save PDF to file
   */
  public async savePDFToFile(
    pdfBuffer: Buffer,
    filename: string,
    directory?: string
  ): Promise<string> {
    try {
      const dir = directory || path.join(process.cwd(), "storage", "pdfs");

      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, pdfBuffer);

      Logger.info("PDF saved to file", {
        filename,
        filepath,
        size: pdfBuffer.length,
      });

      return filepath;
    } catch (error: any) {
      Logger.error("Failed to save PDF to file", {
        error: error.message,
        filename,
        directory,
      });
      throw new Error(`Failed to save PDF: ${error.message}`);
    }
  }

  /**
   * Create PDF stream
   */
  public createPDFStream(pdfBuffer: Buffer): Readable {
    return Readable.from(pdfBuffer);
  }
}

// Export singleton instance
export const pdfService = PDFService.getInstance();
export default PDFService;
