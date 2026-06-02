/**
 * GOC Studio — Marketing / Follow-up SMS Events
 */
import { queueSMS } from '../smsQueue';
import { SMS_EVENTS } from '../../config/smsEvents';

export async function smsServiceFollowup30Days(customer: {
  phone: string;
  full_name: string;
}): Promise<void> {
  try {
    await queueSMS({
      phone: customer.phone,
      eventKey: SMS_EVENTS.SERVICE_FOLLOWUP_30D,
      payload: {
        customerName: customer.full_name,
      },
    });
  } catch (err) {
    console.error('[MarketingEvents] smsServiceFollowup30Days error:', err);
  }
}
