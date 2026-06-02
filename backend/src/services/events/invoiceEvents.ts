/**
 * GOC Studio — Invoice SMS Events
 */
import { queueSMS } from '../smsQueue';
import { SMS_EVENTS } from '../../config/smsEvents';

export async function smsInvoiceGenerated(invoice: {
  phone: string;
  customer_name: string;
  invoice_code: string;
  total_amount: number | string;
}): Promise<void> {
  try {
    await queueSMS({
      phone: invoice.phone,
      eventKey: SMS_EVENTS.INVOICE_GENERATED,
      payload: {
        customerName: invoice.customer_name,
        invoiceNo: invoice.invoice_code,
        amount: `Rs.${Number(invoice.total_amount).toLocaleString('en-IN')}`,
      },
    });
  } catch (err) {
    console.error('[InvoiceEvents] smsInvoiceGenerated error:', err);
  }
}
