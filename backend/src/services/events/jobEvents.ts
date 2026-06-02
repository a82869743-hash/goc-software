/**
 * GOC Studio — Job Card SMS Events
 */
import { queueSMS } from '../smsQueue';
import { SMS_EVENTS } from '../../config/smsEvents';

export async function smsJobCreated(job: {
  phone: string;
  customer_name: string;
  job_code: string;
  vehicle?: string;
}): Promise<void> {
  try {
    await queueSMS({
      phone: job.phone,
      eventKey: SMS_EVENTS.JOB_CREATED,
      payload: {
        customerName: job.customer_name,
        jobCode: job.job_code,
        vehicle: job.vehicle || 'Your vehicle',
      },
    });
  } catch (err) {
    console.error('[JobEvents] smsJobCreated error:', err);
  }
}

export async function smsVehicleReady(job: {
  phone: string;
  customer_name: string;
  job_code: string;
  vehicle?: string;
}): Promise<void> {
  try {
    await queueSMS({
      phone: job.phone,
      eventKey: SMS_EVENTS.VEHICLE_READY,
      payload: {
        customerName: job.customer_name,
        jobCode: job.job_code,
        vehicle: job.vehicle || 'Your vehicle',
      },
    });
  } catch (err) {
    console.error('[JobEvents] smsVehicleReady error:', err);
  }
}
