import { Router, Request, Response } from 'express';
import pool, { saveCustomerAndVehicleFromJobDetails } from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ERROR_CODES } from '../utils/constants';
import { sendQuickWhatsApp } from '../services/whatsappService';

const router = Router();

router.use(authMiddleware);

// ─── GET / ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, date, from, to, search } = req.query;
    const conds: string[] = [];
    const params: any[] = [];

    if (status) {
      conds.push('status = ?');
      params.push(status);
    }
    if (date) {
      conds.push('booking_date = ?');
      params.push(date);
    }
    if (from) {
      conds.push('booking_date >= ?');
      params.push(from);
    }
    if (to) {
      conds.push('booking_date <= ?');
      params.push(`${to} 23:59:59`);
    }
    if (search) {
      conds.push('(customer_name LIKE ? OR mobile LIKE ? OR car_number LIKE ? OR booking_ref LIKE ?)');
      const t = `%${search}%`;
      params.push(t, t, t, t);
    }

    const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const query = `
      SELECT * FROM advance_bookings
      ${whereClause}
      ORDER BY booking_date ASC, booking_time ASC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── GET /today ────────────────────────────────────
router.get('/today', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM advance_bookings
       WHERE booking_date = CURDATE() AND status != 'cancelled'
       ORDER BY booking_time ASC`
    );
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── GET /:id ──────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM advance_bookings WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found' } });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── POST / ────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      customer_name, mobile, car_number, booking_date, booking_time,
      car_make, car_model, concerns, notes, status = 'pending'
    } = req.body;

    if (!customer_name || !mobile || !car_number || !booking_date || !booking_time) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'customer_name, mobile, car_number, booking_date, booking_time are required' } });
      return;
    }

    // Autosave customer and vehicle profiles
    await saveCustomerAndVehicleFromJobDetails(pool, {
      customer_name,
      mobile,
      car_number,
      car_make,
      car_model
    });

    // Generate booking_ref
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const [cnt] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as c FROM advance_bookings WHERE DATE(created_at) = CURDATE()'
    );
    const booking_ref = `GOC-BK${yy}${mm}${dd}-${String(cnt[0].c + 1).padStart(3, '0')}`;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO advance_bookings
       (booking_ref, customer_name, mobile, car_number, car_make, car_model, concerns, booking_date, booking_time, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [booking_ref, customer_name, mobile, car_number, car_make || null, car_model || null, concerns || null, booking_date, booking_time, status, notes || null]
    );

    // Send confirmation SMS
    const msg = `Dear ${customer_name}, your booking at God of Ceramic is confirmed. Date: ${booking_date}, Time: ${booking_time}. Car: ${car_number}. Ref: ${booking_ref}. We will remind you before your appointment.`;
    sendQuickWhatsApp(mobile, msg).catch(e => console.error('SMS sending err:', e));

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        booking_ref,
        message: 'Booking confirmed'
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── PUT /:id ──────────────────────────────────────
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM advance_bookings WHERE id = ?', [id]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found' } });
      return;
    }

    const d = req.body;
    const fields: string[] = [];
    const params: any[] = [];
    const allowed = [
      'customer_name', 'mobile', 'car_number', 'car_make', 'car_model',
      'concerns', 'booking_date', 'booking_time', 'status', 'notes'
    ];

    for (const f of allowed) {
      if (d[f] !== undefined) {
        fields.push(`${f} = ?`);
        params.push(d[f]);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update' } });
      return;
    }

    params.push(id);
    await pool.query(`UPDATE advance_bookings SET ${fields.join(', ')} WHERE id = ?`, params);
    const [updated] = await pool.query<RowDataPacket[]>('SELECT * FROM advance_bookings WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── PATCH /:id/status ──────────────────────────────
router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'status is required' } });
      return;
    }

    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM advance_bookings WHERE id = ?', [id]);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found' } });
      return;
    }

    await pool.query('UPDATE advance_bookings SET status = ? WHERE id = ?', [status, id]);

    if (status === 'cancelled') {
      const booking = existing[0];
      const msg = `Dear ${booking.customer_name}, your booking Ref: ${booking.booking_ref} at God of Ceramic has been cancelled. If this was a mistake, please contact us.`;
      sendQuickWhatsApp(booking.mobile, msg).catch(e => console.error('SMS sending err:', e));
    }

    res.json({ success: true, data: { message: 'Status updated' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

// ─── DELETE /:id ────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM advance_bookings WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Booking not found' } });
      return;
    }
    res.json({ success: true, data: { message: 'Booking deleted' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

export default router;
