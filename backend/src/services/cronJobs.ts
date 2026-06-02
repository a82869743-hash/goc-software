import cron from 'node-cron';
import { WhatsAppTemplates, getTodayBirthdays, getLeadsForFollowUp } from './whatsappService';
import { createNotification } from './notificationService';
import pool from '../utils/db';
import { RowDataPacket } from 'mysql2';
import { smsBookingReminder } from './events/bookingEvents';
import { smsServiceFollowup30Days } from './events/marketingEvents';
import { processPendingSMS } from './smsService';

/**
 * GOC Studio — Cron Jobs Service
 * Scheduled automated tasks for birthday wishes, lead follow-ups, and low stock alerts.
 */

export function initCronJobs(): void {
  console.log('🕐 Initializing cron jobs...');

  // ─── Daily Birthday Wishes — 09:00 AM IST ────────────────
  cron.schedule('0 9 * * *', async () => {
    console.log('🎂 Running birthday wishes cron...');
    try {
      const birthdays = await getTodayBirthdays();
      for (const customer of birthdays) {
        await WhatsAppTemplates.birthdayWish(customer.phone, customer.full_name);
        console.log(`  ✅ Birthday wish sent to ${customer.full_name}`);
      }
      console.log(`🎂 Birthday wishes completed: ${birthdays.length} sent`);
    } catch (error) {
      console.error('❌ Birthday cron error:', error);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── Lead Follow-Up: 1 Day — 10:00 AM IST ────────────────
  cron.schedule('0 10 * * *', async () => {
    console.log('📞 Running 1-day lead follow-up cron...');
    try {
      const leads = await getLeadsForFollowUp(1);
      for (const lead of leads) {
        await WhatsAppTemplates.leadFollowUp(lead.phone, lead.full_name, '1');
        console.log(`  ✅ 1-day follow-up sent to ${lead.full_name}`);
      }
      console.log(`📞 1-day follow-ups completed: ${leads.length} sent`);
    } catch (error) {
      console.error('❌ 1-day follow-up cron error:', error);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── Lead Follow-Up: 3 Days — 11:00 AM IST ───────────────
  cron.schedule('0 11 * * *', async () => {
    console.log('📞 Running 3-day lead follow-up cron...');
    try {
      const leads = await getLeadsForFollowUp(3);
      for (const lead of leads) {
        await WhatsAppTemplates.leadFollowUp(lead.phone, lead.full_name, '3');
        console.log(`  ✅ 3-day follow-up sent to ${lead.full_name}`);
      }
      console.log(`📞 3-day follow-ups completed: ${leads.length} sent`);
    } catch (error) {
      console.error('❌ 3-day follow-up cron error:', error);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── Low Stock Check — 08:30 AM IST ──────────────────────
  cron.schedule('30 8 * * *', async () => {
    console.log('📦 Running low stock check cron...');
    try {
      const [items] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, current_stock, min_threshold FROM inventory_items
         WHERE current_stock <= min_threshold AND deleted_at IS NULL`
      );
      if (items.length > 0) {
        // Notify all managers and owners
        const [managers] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM staff WHERE role IN ('admin', 'manager') AND status = 'active' AND deleted_at IS NULL`
        );
        for (const mgr of managers) {
          await createNotification({
            staffId: mgr.id,
            type: 'low_stock',
            title: `⚠️ ${items.length} items are low on stock`,
            body: items.map((i: any) => `${i.name}: ${i.current_stock} remaining (min: ${i.min_threshold})`).join('\n'),
            referenceType: 'inventory',
          });
        }
        console.log(`📦 Low stock alert sent for ${items.length} items to ${managers.length} managers`);
      }
    } catch (error) {
      console.error('❌ Low stock cron error:', error);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── Customer Auto-Status Update — 09:30 AM IST ───────────
  cron.schedule('30 9 * * *', async () => {
    console.log('👥 Running customer auto-status update cron...');
    try {
      await pool.query(
        `UPDATE customers
         SET status = 'inactive'
         WHERE status = 'active'
           AND last_visit < DATE_SUB(CURDATE(), INTERVAL 180 DAY)
           AND deleted_at IS NULL`
      );
      console.log('👥 Customer auto-status update completed.');
    } catch (error) {
      console.error('❌ Customer auto-status cron error:', error);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── SMS Queue Worker — Every Minute ──────────────────
  cron.schedule('* * * * *', async () => {
    try {
      await processPendingSMS();
    } catch (error) {
      console.error('❌ SMS queue worker error:', error);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── SMS Booking Reminder — 8:00 AM IST (day before) ──
  cron.schedule('0 8 * * *', async () => {
    console.log('📅 Running SMS booking reminder cron...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

      const [bookings] = await pool.query<RowDataPacket[]>(
        `SELECT b.*, c.full_name as customer_name, c.phone as customer_phone,
                CONCAT(v.make, ' ', v.model) as vehicle_name
         FROM bookings b
         LEFT JOIN customers c ON b.customer_id = c.id
         LEFT JOIN vehicles v ON b.vehicle_id = v.id
         WHERE DATE(b.booking_date) = ?
           AND b.status NOT IN ('cancelled', 'completed')
           AND b.deleted_at IS NULL
           AND c.phone IS NOT NULL`,
        [tomorrowStr]
      );

      for (const booking of bookings) {
        await smsBookingReminder({
          phone: booking.customer_phone,
          customer_name: booking.customer_name || 'Customer',
          booking_date: new Date(booking.booking_date).toLocaleDateString('en-IN'),
          time_slot: booking.time_slot || '',
        });
      }
      console.log(`📅 Booking reminders queued: ${bookings.length}`);
    } catch (error) {
      console.error('❌ Booking reminder SMS cron error:', error);
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── SMS 30-Day Service Follow-up — 10:30 AM IST ──────
  cron.schedule('30 10 * * *', async () => {
    console.log('🔄 Running 30-day service follow-up SMS cron...');
    try {
      const [customers] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT c.id, c.full_name, c.phone
         FROM job_cards j
         LEFT JOIN customers c ON j.customer_id = c.id
         WHERE j.status = 'delivered'
           AND DATE(j.date_out) = DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           AND j.deleted_at IS NULL
           AND c.phone IS NOT NULL
           AND c.deleted_at IS NULL`
      );

      for (const customer of customers) {
        await smsServiceFollowup30Days({
          phone: customer.phone,
          full_name: customer.full_name || 'Customer',
        });
      }
      console.log(`🔄 30-day follow-up SMS queued: ${customers.length}`);
    } catch (error) {
      console.error('❌ 30-day follow-up SMS cron error:', error);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('✅ Cron jobs initialized successfully');
}

