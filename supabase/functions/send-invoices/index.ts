import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceData {
  id: string;
  invoice_number: string;
  driver_email: string;
  driver_name: string;
  period_start: string;
  period_end: string;
  total_parcels: number;
  parcel_rate: number;
  total_amount: number;
}

interface SendInvoicesRequest {
  invoices: InvoiceData[];
  admin_email: string;
  company_id: string;
}

const generateInvoicePDF = (invoice: InvoiceData): string => {
  return `
INVOICE ${invoice.invoice_number}

Date: ${new Date().toLocaleDateString()}
Due Date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}

BILL TO:
${invoice.driver_name}
${invoice.driver_email}

INVOICE DETAILS:
Period: ${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}
Total Parcels Delivered: ${invoice.total_parcels}
Rate per Parcel: £${invoice.parcel_rate.toFixed(2)}

TOTAL AMOUNT: £${invoice.total_amount.toFixed(2)}

Please remit payment within 30 days.

Thank you for your service!
  `.trim();
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoices, admin_email }: SendInvoicesRequest = await req.json();

    console.log(`Processing ${invoices.length} invoices`);

    // Send individual invoices to drivers
    const emailPromises = invoices.map(async (invoice) => {
      const invoiceContent = generateInvoicePDF(invoice);
      
      return resend.emails.send({
        from: "DriveOn Manager <onboarding@resend.dev>",
        to: [invoice.driver_email],
        subject: `Invoice ${invoice.invoice_number} - Payment Due`,
        text: invoiceContent,
        attachments: [
          {
            filename: `invoice-${invoice.invoice_number}.txt`,
            content: Buffer.from(invoiceContent).toString('base64'),
          },
        ],
      });
    });

    // Wait for all individual emails to be sent
    const emailResults = await Promise.allSettled(emailPromises);
    
    const successfulEmails = emailResults.filter(result => result.status === 'fulfilled').length;
    const failedEmails = emailResults.filter(result => result.status === 'rejected').length;

    console.log(`Emails sent: ${successfulEmails} successful, ${failedEmails} failed`);

    // Create ZIP file content (simplified text format for demo)
    const zipContent = invoices.map(invoice => {
      return `=== INVOICE ${invoice.invoice_number} ===\n${generateInvoicePDF(invoice)}\n\n`;
    }).join('');

    // Send ZIP backup to admin
    const adminEmailResult = await resend.emails.send({
      from: "DriveOn Manager <onboarding@resend.dev>",
      to: [admin_email],
      subject: `Invoice Backup - ${invoices.length} Invoices Generated`,
      text: `Invoice batch generated successfully.\n\nSummary:\n- Total invoices: ${invoices.length}\n- Period: ${invoices[0]?.period_start} to ${invoices[0]?.period_end}\n- Total amount: £${invoices.reduce((sum, inv) => sum + inv.total_amount, 0).toFixed(2)}`,
      attachments: [
        {
          filename: `invoices-backup-${new Date().toISOString().split('T')[0]}.txt`,
          content: Buffer.from(zipContent).toString('base64'),
        },
      ],
    });

    console.log("Admin backup email sent:", adminEmailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invoices processed successfully",
        stats: {
          total_invoices: invoices.length,
          successful_emails: successfulEmails,
          failed_emails: failedEmails,
          admin_backup_sent: adminEmailResult.id ? true : false
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invoices function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);