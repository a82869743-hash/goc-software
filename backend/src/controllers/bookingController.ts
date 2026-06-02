import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { smsBookingConfirmation } from '../services/events/bookingEvents';


/** GET /bookings — List with filters + pagination */
export const getBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, date_from, date_to, search, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = ['b.deleted_at IS NULL'];
    const params: any[] = [];

    if (status) { conds.push('b.status = ?'); params.push(status); }
    if (date_from) { conds.push('b.booking_date >= ?'); params.push(date_from); }
    if (date_to) { conds.push('b.booking_date <= ?'); params.push(date_to); }
    if (search) {
      conds.push('(c.full_name LIKE ? OR c.phone LIKE ? OR b.booking_code LIKE ?)');
      const t = `%${search}%`; params.push(t, t, t);
    }

    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM bookings b LEFT JOIN customers c ON b.customer_id = c.id WHERE ${where}`, params
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number,
              s.full_name as created_by_name
       FROM bookings b
       LEFT JOIN customers c ON b.customer_id = c.id
       LEFT JOIN vehicles v ON b.vehicle_id = v.id
       LEFT JOIN staff s ON b.created_by = s.id
       WHERE ${where} ORDER BY b.booking_date DESC, b.time_slot ASC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ success: true, data: rows, meta: { total: countR[0].total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(countR[0].total / Number(limit)) } });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch bookings.' } });
  }
};

/** GET /bookings/calendar?date_from=&date_to= — Bookings grouped by date for calendar view */
export const getCalendar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date_from, date_to } = req.query as any;
    if (!date_from || !date_to) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'date_from and date_to required.' } }); return; }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.id, b.booking_code, b.booking_date, b.time_slot, b.service_type, b.package_tier, b.status,
              c.full_name as customer_name, CONCAT(v.make, ' ', v.model) as vehicle_name
       FROM bookings b
       LEFT JOIN customers c ON b.customer_id = c.id
       LEFT JOIN vehicles v ON b.vehicle_id = v.id
       WHERE b.deleted_at IS NULL AND b.booking_date BETWEEN ? AND ?
       ORDER BY b.booking_date ASC, b.time_slot ASC`,
      [date_from, date_to]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch calendar.' } });
  }
};

/** GET /bookings/:id */
export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number
       FROM bookings b
       LEFT JOIN customers c ON b.customer_id = c.id
       LEFT JOIN vehicles v ON b.vehicle_id = v.id
       WHERE b.id = ? AND b.deleted_at IS NULL`, [req.params.id]
    );
    if (rows.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found.' } }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch booking.' } });
  }
};

/** POST /bookings — Create */
export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = await generateCode('booking');
    const d = req.body;
    const staffId = (req as any).staff?.id;

    // Check slot not double-booked
    const [conflict] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM bookings WHERE booking_date = ? AND time_slot = ? AND status = "scheduled" AND deleted_at IS NULL',
      [d.booking_date, d.time_slot]
    );
    if (conflict.length > 0) {
      res.status(409).json({ success: false, error: { code: ERROR_CODES.CONFLICT, message: `Slot ${d.time_slot} on ${d.booking_date} is already booked.` } });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO bookings (booking_code, customer_id, vehicle_id, lead_id, booking_date, time_slot,
        service_type, package_tier, est_duration_hrs, advance_amount, advance_mode, assigned_staff, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, d.customer_id, d.vehicle_id, d.lead_id || null, d.booking_date, d.time_slot,
       d.service_type, d.package_tier || 'basic', d.est_duration_hrs || 4, d.advance_amount || 0,
       d.advance_mode || null, d.assigned_staff ? JSON.stringify(d.assigned_staff) : null, d.notes || null, staffId]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name
       FROM bookings b 
       LEFT JOIN customers c ON b.customer_id = c.id 
       LEFT JOIN vehicles v ON b.vehicle_id = v.id
       WHERE b.id = ?`,
      [result.insertId]
    );

    // ── SMS: Booking Confirmation ──────────────────────
    try {
      const bookingData = rows[0];
      if (bookingData?.customer_phone) {
        await smsBookingConfirmation({
          phone: bookingData.customer_phone,
          customer_name: bookingData.customer_name || 'Customer',
          booking_date: bookingData.booking_date
            ? new Date(bookingData.booking_date).toLocaleDateString('en-IN')
            : 'N/A',
          time_slot: bookingData.time_slot || '',
          vehicle: bookingData.vehicle_name || '',
        });
      }
    } catch (smsErr) {
      console.error('[Booking] SMS booking confirmation error (non-blocking):', smsErr);
    }
    // ─────────────────────────────────────────────────────

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create booking.' } });
  }
};

/** PUT /bookings/:id — Update */
export const updateBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found.' } }); return; }

    const d = req.body;
    const fields: string[] = []; const vals: any[] = [];
    const allowed = ['customer_id', 'vehicle_id', 'booking_date', 'time_slot', 'service_type', 'package_tier', 'est_duration_hrs', 'advance_amount', 'advance_mode', 'notes', 'status'];
    for (const f of allowed) {
      if (d[f] !== undefined) {
        fields.push(`${f} = ?`);
        vals.push(d[f]);
      }
    }
    if (d.assigned_staff !== undefined) { fields.push('assigned_staff = ?'); vals.push(JSON.stringify(d.assigned_staff)); }
    if (fields.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update.' } }); return; }

    vals.push(req.params.id);
    await pool.query(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update booking.' } });
  }
};

/** DELETE /bookings/:id — Soft delete */
export const deleteBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM bookings WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found.' } }); return; }
    await pool.query('UPDATE bookings SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Booking deleted.' } });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete booking.' } });
  }
};

/** GET /bookings/slots?date=YYYY-MM-DD — Available slots for a date */
export const getAvailableSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.query as any;
    if (!date) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'date required.' } }); return; }

    const allSlots = ['09:00', '11:00', '14:00', '16:00'];
    const [booked] = await pool.query<RowDataPacket[]>(
      'SELECT time_slot FROM bookings WHERE booking_date = ? AND status = "scheduled" AND deleted_at IS NULL',
      [date]
    );
    const bookedSlots = booked.map((r) => r.time_slot);
    const available = allSlots.map((slot) => ({ slot, booked: bookedSlots.includes(slot) }));
    res.json({ success: true, data: available });
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch slots.' } });
  }
};

/** POST /bookings/:id/convert-to-job — Convert booking to job card */
export const convertToJobCard = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const staffId = (req as any).staff?.id;
    const { insurance_company, insurance_expiry, concerns } = req.body;

    // 1. Get booking details
    const [bookingRows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL', [id]
    );
    if (bookingRows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found.' } });
      connection.release();
      return;
    }

    const booking = bookingRows[0];
    if (booking.status === 'converted') {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Booking is already converted to a job card.' } });
      connection.release();
      return;
    }
    if (booking.status === 'cancelled') {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Cancelled booking cannot be converted.' } });
      connection.release();
      return;
    }

    // 2. Generate new job card code
    const jobCode = await generateCode('job');
    const publicToken = uuidv4();

    // 3. Create job card
    // Advance amount is carried forward to amount_paid, total_amount defaults to 0 (will update as services are added)
    const [jobResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO job_cards (job_code, booking_id, customer_id, vehicle_id, job_type, status,
        expected_out, assigned_staff, total_amount, amount_paid, balance_due, internal_notes, created_by, public_token,
        insurance_company, insurance_expiry)
       VALUES (?, ?, ?, ?, 'booked', 'scheduled', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobCode, booking.id, booking.customer_id, booking.vehicle_id,
        booking.booking_date,
        JSON.stringify(booking.assigned_staff || []),
        booking.advance_amount || 0,
        -(booking.advance_amount || 0), // balance_due is initially negative of paid advance since total_amount is 0
        booking.notes || null,
        staffId,
        publicToken,
        insurance_company || null,
        insurance_expiry || null
      ]
    );

    const newJobId = jobResult.insertId;

    // 4. Create corresponding job service line item
    await connection.query(
      `INSERT INTO job_services (job_card_id, service_name, service_type, package_tier, description, unit_price, quantity, line_total)
       VALUES (?, ?, 'other', ?, 'Carried forward from booking', ?, 1, ?)`,
      [newJobId, booking.service_type, booking.package_tier || 'basic', Number(booking.advance_amount) || 0, Number(booking.advance_amount) || 0]
    );

    // Update job card's total_amount and balance_due
    await connection.query(
      'UPDATE job_cards SET total_amount = ?, balance_due = ? - amount_paid WHERE id = ?',
      [Number(booking.advance_amount) || 0, Number(booking.advance_amount) || 0, newJobId]
    );

    // 5. Update booking status to converted
    await connection.query(
      'UPDATE bookings SET status = "converted" WHERE id = ?', [id]
    );

    // 6. Log status change in job status log
    await connection.query(
      'INSERT INTO job_status_log (job_card_id, old_status, new_status, changed_by, notes) VALUES (?, NULL, "scheduled", ?, "Job card created from Booking")',
      [newJobId, staffId]
    );

    // 7. Insert concerns if provided
    if (concerns && Array.isArray(concerns) && concerns.length > 0) {
      for (const concern of concerns) {
        await connection.query(
          'INSERT INTO customer_concerns (job_card_id, concern_text) VALUES (?, ?)',
          [newJobId, concern]
        );
      }
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      data: {
        message: 'Successfully converted booking to job card.',
        job_card_id: newJobId,
        job_code: jobCode,
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Convert booking error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to convert booking.' } });
  } finally {
    connection.release();
  }
};

/** PUT /bookings/:id/reschedule — Reschedule booking */
export const rescheduleBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { booking_date, time_slot, notes } = req.body;

    if (!booking_date || !time_slot) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'booking_date and time_slot required.' } });
      return;
    }

    // Check slot conflict
    const [conflict] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM bookings WHERE booking_date = ? AND time_slot = ? AND status = "scheduled" AND id != ? AND deleted_at IS NULL',
      [booking_date, time_slot, id]
    );
    if (conflict.length > 0) {
      res.status(409).json({ success: false, error: { code: ERROR_CODES.CONFLICT, message: `Slot ${time_slot} on ${booking_date} is already booked.` } });
      return;
    }

    // Update booking
    await pool.query(
      'UPDATE bookings SET booking_date = ?, time_slot = ?, notes = COALESCE(?, notes) WHERE id = ? AND deleted_at IS NULL',
      [booking_date, time_slot, notes || null, id]
    );

    const [updated] = await pool.query<RowDataPacket[]>('SELECT * FROM bookings WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to reschedule booking.' } });
  }
};

/** PUT /bookings/:id/cancel — Cancel booking with reason */
export const cancelBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL', [id]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found.' } });
      return;
    }

    const notesUpdate = cancellation_reason ? `${existing[0].notes || ''}\nCancelled Reason: ${cancellation_reason}` : existing[0].notes;
    await pool.query(
      'UPDATE bookings SET status = "cancelled", notes = ? WHERE id = ?',
      [notesUpdate, id]
    );

    const [updated] = await pool.query<RowDataPacket[]>('SELECT * FROM bookings WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to cancel booking.' } });
  }
};
