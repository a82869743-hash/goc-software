/**
 * GOC Studio — Booking SMS Events
 */
import { queueSMS } from '../smsQueue';
import { SMS_EVENTS } from '../../config/smsEvents';

export async function smsBookingConfirmation(booking: {
  phone: string;
  customer_name: string;
  booking_date: string;
  time_slot?: string;
  vehicle?: string;
}): Promise<void> {
  try {
    await queueSMS({
      phone: booking.phone,
      eventKey: SMS_EVENTS.BOOKING_CONFIRMATION,
      payload: {
        customerName: booking.customer_name,
        bookingDate: booking.booking_date,
        timeSlot: booking.time_slot || 'N/A',
        vehicle: booking.vehicle || 'Your vehicle',
      },
    });
  } catch (err) {
    console.error('[BookingEvents] smsBookingConfirmation error:', err);
  }
}

export async function smsBookingReminder(booking: {
  phone: string;
  customer_name: string;
  booking_date: string;
  time_slot?: string;
}): Promise<void> {
  try {
    await queueSMS({
      phone: booking.phone,
      eventKey: SMS_EVENTS.BOOKING_REMINDER,
      payload: {
        customerName: booking.customer_name,
        bookingDate: booking.booking_date,
        timeSlot: booking.time_slot || 'N/A',
      },
    });
  } catch (err) {
    console.error('[BookingEvents] smsBookingReminder error:', err);
  }
}
