/**
 * GOC Studio — Payment SMS Events
 */
import { queueSMS } from '../smsQueue';
import { SMS_EVENTS } from '../../config/smsEvents';

export async function smsPaymentReceived(payment: {
  phone: string;
  customer_name: string;
  amount: number | string;
  invoice_code?: string;
}): Promise<void> {
  try {
    await queueSMS({
      phone: payment.phone,
      eventKey: SMS_EVENTS.PAYMENT_RECEIVED,
      payload: {
        customerName: payment.customer_name,
        amount: `Rs.${Number(payment.amount).toLocaleString('en-IN')}`,
        invoiceNo: payment.invoice_code || 'N/A',
      },
    });
  } catch (err) {
    console.error('[PaymentEvents] smsPaymentReceived error:', err);
  }
}
