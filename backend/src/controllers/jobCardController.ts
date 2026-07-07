import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES, JOB_STATUS_FLOW } from '../utils/constants';
import { logActivity } from '../utils/auditLogger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { WhatsAppTemplates, sendQuickWhatsApp } from '../services/whatsappService';
import { smsJobCreated, smsVehicleReady } from '../services/events/jobEvents';
import { smsInvoiceGenerated } from '../services/events/invoiceEvents';
import { v4 as uuidv4 } from 'uuid';


// ─── LIST ─────────────────────────────────────────
export const getJobCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, job_type, search, date_from, date_to, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];

    if (status) { conds.push('combined.status = ?'); params.push(status); }
    if (job_type) { conds.push('combined.job_type = ?'); params.push(job_type); }
    if (date_from) { conds.push('combined.created_at >= ?'); params.push(date_from); }
    if (date_to) { conds.push('combined.created_at <= ?'); params.push(`${date_to} 23:59:59`); }
    if (search) {
      conds.push('(combined.customer_name LIKE ? OR combined.customer_phone LIKE ? OR combined.job_code LIKE ? OR combined.reg_number LIKE ?)');
      const t = `%${search}%`; params.push(t, t, t, t);
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const subquery = `
      SELECT 
        j.id,
        j.job_code,
        j.booking_id,
        j.customer_id,
        j.vehicle_id,
        j.job_type,
        j.status,
        j.date_in,
        j.expected_out,
        j.date_out,
        j.total_amount,
        j.balance_due,
        j.created_at,
        c.full_name as customer_name,
        c.phone as customer_phone,
        CONCAT(v.make, ' ', v.model) as vehicle_name,
        v.reg_number,
        s.full_name as created_by_name,
        (SELECT COUNT(*) FROM job_services WHERE job_card_id = j.id) as service_item_count
      FROM job_cards j
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN vehicles v ON j.vehicle_id = v.id
      LEFT JOIN staff s ON j.created_by = s.id
      WHERE j.deleted_at IS NULL
    `;

    const countQuery = `SELECT COUNT(*) as total FROM (${subquery}) as combined ${where}`;
    const [countR] = await pool.query<RowDataPacket[]>(countQuery, params);

    const selectQuery = `SELECT * FROM (${subquery}) as combined ${where} ORDER BY combined.created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await pool.query<RowDataPacket[]>(selectQuery, [...params, Number(limit), offset]);

    const mappedRows = rows.map((r) => ({
      ...r,
      services: Array(r.service_item_count || 0).fill({}),
    }));

    res.json({ success: true, data: mappedRows, meta: { total: countR[0].total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(countR[0].total / Number(limit)) } });
  } catch (error) {
    console.error('Get job cards error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch job cards.' } });
  }
};

// ─── PIPELINE SUMMARY ─────────────────────────────
export const getPipelineSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count FROM job_cards WHERE deleted_at IS NULL GROUP BY status`
    );
    const summary: Record<string, number> = {};
    rows.forEach((r) => { summary[r.status] = r.count; });
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Pipeline summary error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch pipeline.' } });
  }
};

// ─── GET BY ID ────────────────────────────────────
export const getJobCardById = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT j.*, 
              c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
              c.alt_phone as customer_alt_phone, c.dob as customer_dob, c.address as customer_address,
              c.city as customer_city, c.notes as customer_notes,
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.make as vehicle_make, v.model as vehicle_model,
              v.reg_number, v.year as vehicle_year,
              v.fuel_type as vehicle_fuel_type, v.color as vehicle_color, v.notes as vehicle_notes,
              s.full_name as created_by_name
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       LEFT JOIN staff s ON j.created_by = s.id
       WHERE j.id = ? AND j.deleted_at IS NULL`, [req.params.id]
    );
    if (rows.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }


    // Fetch services
    const [services] = await pool.query<RowDataPacket[]>('SELECT * FROM job_services WHERE job_card_id = ?', [req.params.id]);

    // Fetch status log
    const [statusLog] = await pool.query<RowDataPacket[]>(
      `SELECT l.*, s.full_name as staff_name FROM job_status_log l LEFT JOIN staff s ON l.changed_by = s.id WHERE l.job_card_id = ? ORDER BY l.created_at DESC`,
      [req.params.id]
    );

    // Fetch concerns
    const [concerns] = await pool.query<RowDataPacket[]>('SELECT * FROM customer_concerns WHERE job_card_id = ?', [req.params.id]);

    res.json({ success: true, data: { ...rows[0], services, statusLog, concerns } });
  } catch (error) {
    console.error('Get job card error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch job card.' } });
  }
};

// ─── CREATE ───────────────────────────────────────
export const createJobCard = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const code = await generateCode('job');
    const d = req.body;
    const staffId = (req as any).staff?.id;
    const public_token = uuidv4();

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO job_cards (job_code, booking_id, customer_id, vehicle_id, job_type,
        expected_out, assigned_staff, internal_notes, created_by, status, public_token, insurance_company, insurance_expiry, gst_applicable,
        advance_booking_id, advance_amount, amount_paid, balance_due)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, 1, ?, ?, ?, ?)`,
      [code, d.booking_id || null, d.customer_id, d.vehicle_id, d.job_type || 'walkin',
       d.expected_out || null, d.assigned_staff ? JSON.stringify(d.assigned_staff) : null,
       d.internal_notes || null, staffId, public_token, d.insurance_company || null, d.insurance_expiry || null,
       d.advance_booking_id || null, d.advance_amount || 0.00, d.advance_amount || 0.00, -(d.advance_amount || 0.00)]
    );

    const jobCardId = result.insertId;

    // If booking_id provided, mark booking as converted
    if (d.booking_id) {
      await connection.query('UPDATE bookings SET status = "converted" WHERE id = ?', [d.booking_id]);
    }

    // If advance_booking_id provided, mark advance booking as converted
    if (d.advance_booking_id) {
      await connection.query('UPDATE advance_bookings SET status = "converted" WHERE id = ?', [d.advance_booking_id]);
    }

    // Insert concerns if provided
    if (d.concerns && Array.isArray(d.concerns)) {
      for (const concern of d.concerns) {
        await connection.query(
          'INSERT INTO customer_concerns (job_card_id, concern_text) VALUES (?, ?)',
          [jobCardId, concern]
        );
      }
    }

    // Insert services if provided
    if (d.services && Array.isArray(d.services)) {
      for (const svc of d.services) {
        const lineTotal = Number(svc.unit_price || 0) * Number(svc.quantity || 1);
        const taxPct = svc.tax_pct !== undefined ? Number(svc.tax_pct) : 18.00;
        const itemType = svc.item_type || 'labor';

        await connection.query(
          `INSERT INTO job_services (job_card_id, service_name, service_type, package_tier, description, sqft_used, ml_used, unit_price, quantity, line_total, tax_pct, item_type, inventory_item_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [jobCardId, svc.service_name, svc.service_type || 'other', svc.package_tier || 'basic', svc.description || null,
           svc.sqft_used || 0, svc.ml_used || 0, svc.unit_price || 0, svc.quantity || 1, lineTotal, taxPct, itemType, svc.inventory_item_id || null]
        );
      }
    }

    // Log initial status
    await connection.query(
      'INSERT INTO job_status_log (job_card_id, old_status, new_status, changed_by, notes) VALUES (?, NULL, "in_progress", ?, "Job card created")',
      [jobCardId, staffId]
    );

    // Record advance payment in payments table if provided
    if (d.advance_amount && Number(d.advance_amount) > 0) {
      await connection.query(
        `INSERT INTO payments (job_card_id, customer_id, payment_type, amount, payment_mode, reference_no, received_by, notes)
         VALUES (?, ?, 'advance', ?, ?, ?, ?, 'Advance payment on job card creation')`,
        [jobCardId, d.customer_id, Number(d.advance_amount), d.advance_payment_mode || 'cash', d.advance_payment_ref || null, staffId]
      );
    }

    await connection.commit();

    // Recalculate totals after committing (since recalculateJobCardTotals uses pool.query)
    await recalculateJobCardTotals(jobCardId);

    await logActivity(
      staffId || null,
      'create_job_card',
      'job_card',
      jobCardId,
      `Created Job Card ${code} (Type: ${d.job_type || 'walkin'})`,
      req.ip,
      req.headers['user-agent']
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT j.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       WHERE j.id = ?`,
      [jobCardId]
    );

    // ── SMS: Job Created ──────────────────────────────
    try {
      const jc = rows[0];
      if (jc?.customer_phone) {
        await smsJobCreated({
          phone: jc.customer_phone,
          customer_name: jc.customer_name || 'Customer',
          job_code: code,
          vehicle: jc.vehicle_name || '',
        });
      }
    } catch (smsErr) {
      console.error('[JobCard] SMS job created error (non-blocking):', smsErr);
    }
    // ─────────────────────────────────────────────────────

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    await connection.rollback();
    console.error('Create job card error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create job card.' } });
  } finally {
    connection.release();
  }
};

// ─── UPDATE ───────────────────────────────────────
export const updateJobCard = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query<RowDataPacket[]>('SELECT * FROM job_cards WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) {
      connection.release();
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } });
      return;
    }
    const jc = existing[0];
    const d = req.body;

    // 1. Update job_cards table fields
    const fields: string[] = []; const vals: any[] = [];
    const allowed = ['expected_out', 'qc_notes', 'delivery_notes', 'internal_notes', 'km_reading', 'insurance_company', 'insurance_expiry', 'certificate_url'];
    for (const f of allowed) {
      if (d[f] !== undefined) { fields.push(`${f} = ?`); vals.push(d[f]); }
    }
    if (d.assigned_staff !== undefined) { fields.push('assigned_staff = ?'); vals.push(JSON.stringify(d.assigned_staff)); }
    if (fields.length > 0) {
      vals.push(req.params.id);
      await connection.query(`UPDATE job_cards SET ${fields.join(', ')} WHERE id = ?`, vals);
    }

    // 2. Update customer details if provided
    if (d.customer_name || d.customer_phone) {
      const custFields: string[] = []; const custVals: any[] = [];
      if (d.customer_name) { custFields.push('full_name = ?'); custVals.push(d.customer_name); }
      if (d.customer_phone) { custFields.push('phone = ?'); custVals.push(d.customer_phone); }
      custVals.push(jc.customer_id);
      await connection.query(`UPDATE customers SET ${custFields.join(', ')} WHERE id = ?`, custVals);
    }

    // 3. Update vehicle details if provided
    if (d.vehicle_make || d.vehicle_model || d.reg_number || d.vehicle_color !== undefined || d.vehicle_fuel_type) {
      const vehFields: string[] = []; const vehVals: any[] = [];
      if (d.vehicle_make) { vehFields.push('make = ?'); vehVals.push(d.vehicle_make); }
      if (d.vehicle_model) { vehFields.push('model = ?'); vehVals.push(d.vehicle_model); }
      if (d.reg_number) { vehFields.push('reg_number = ?'); vehVals.push(d.reg_number); }
      if (d.vehicle_color !== undefined) { vehFields.push('color = ?'); vehVals.push(d.vehicle_color); }
      if (d.vehicle_fuel_type) {
        const fuel = d.vehicle_fuel_type === 'ev' ? 'electric' : d.vehicle_fuel_type;
        vehFields.push('fuel_type = ?');
        vehVals.push(fuel);
      }
      vehVals.push(jc.vehicle_id);
      await connection.query(`UPDATE vehicles SET ${vehFields.join(', ')} WHERE id = ?`, vehVals);
    }

    await connection.commit();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM job_cards WHERE id = ?', [req.params.id]);

    const staffId = (req as any).staff?.id || null;
    await logActivity(
      staffId,
      'update_job_card',
      'job_card',
      Number(req.params.id),
      `Updated Job Card ${jc.job_code}`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    await connection.rollback();
    console.error('Update job card error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update job card.' } });
  } finally {
    connection.release();
  }
};

// ─── STATUS TRANSITION ────────────────────────────
export const updateJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM job_cards WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }

    const current = existing[0].status;
    const { new_status, notes } = req.body;

    const allowed = JOB_STATUS_FLOW[current] || [];
    if (!allowed.includes(new_status)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: `Cannot transition from '${current}' to '${new_status}'. Allowed: ${allowed.join(', ')}` } });
      return;
    }

    const staffId = (req as any).staff?.id;

    // Update status with timestamp for car_in and delivered
    const extras: string[] = ['status = ?'];
    const evals: any[] = [new_status];
    if (new_status === 'car_in') { extras.push('date_in = NOW()'); }
    if (new_status === 'delivered') { extras.push('date_out = NOW()'); }

    evals.push(req.params.id);
    await pool.query(`UPDATE job_cards SET ${extras.join(', ')} WHERE id = ?`, evals);

    // Sync connector commission details
    await syncJobCardCommission(pool, req.params.id);

    // Log the transition
    await pool.query(
      'INSERT INTO job_status_log (job_card_id, old_status, new_status, changed_by, notes) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, current, new_status, staffId, notes || null]
    );

    await logActivity(
      staffId || null,
      'update_job_status',
      'job_card',
      Number(req.params.id),
      `Transitioned Job Card ${existing[0].job_code} status from '${current}' to '${new_status}'`,
      req.ip,
      req.headers['user-agent']
    );

    // If status is changed to delivered, update customer metrics
    if (new_status === 'delivered') {
      const customerId = existing[0].customer_id;
      const [revRows] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(SUM(total_amount), 0) as total_rev, COUNT(*) as visits FROM job_cards WHERE customer_id = ? AND status = "delivered" AND deleted_at IS NULL AND id != ?',
        [customerId, req.params.id]
      );
      
      const currentAmount = Number(existing[0].total_amount);
      const totalRev = Number(revRows[0].total_rev) + currentAmount;
      const totalVisits = Number(revRows[0].visits) + 1;
      
      const [cust] = await pool.query<RowDataPacket[]>('SELECT status FROM customers WHERE id = ?', [customerId]);
      const newCustStatus = cust.length > 0 && cust[0].status === 'vip' ? 'vip' : 'active';
      
      await pool.query(
        'UPDATE customers SET total_revenue = ?, total_visits = ?, last_visit = CURDATE(), status = ? WHERE id = ?',
        [totalRev, totalVisits, newCustStatus, customerId]
      );
    }

    // If status is changed to ready or delivered, trigger inventory deduction
    if (['ready', 'delivered'].includes(new_status)) {
      await deductInventoryForJobCard(pool, req.params.id, false, staffId);
    }

    // If status is changed to ready, trigger WhatsApp
    if (new_status === 'ready') {
      const jobId = req.params.id;
      const [jobData] = await pool.query<RowDataPacket[]>(
        `SELECT j.*, c.full_name as customer_name, c.phone as customer_phone,
                CONCAT(v.make, ' ', v.model) as vehicle_name
         FROM job_cards j
         LEFT JOIN customers c ON j.customer_id = c.id
         LEFT JOIN vehicles v ON j.vehicle_id = v.id
         WHERE j.id = ?`,
        [jobId]
      );
      if (jobData.length > 0) {
        const jd = jobData[0];
        if (jd.customer_phone && jd.customer_name) {
          try {
            await WhatsAppTemplates.carReady(
              jd.customer_phone,
              jd.customer_name,
              jd.vehicle_name || 'Vehicle',
              staffId
            );
          } catch (err) {
            console.error('Failed to trigger READY WhatsApp notice:', err);
          }

          // ── SMS: Vehicle Ready ────────────────────────
          try {
            if (jd.customer_phone) {
              await smsVehicleReady({
                phone: jd.customer_phone,
                customer_name: jd.customer_name || 'Customer',
                job_code: jd.job_code,
                vehicle: jd.vehicle_name || '',
              });
            }
          } catch (smsErr) {
            console.error('[JobCard] SMS vehicle ready error (non-blocking):', smsErr);
          }
          // ─────────────────────────────────────────────────
        }

      }
    }

    // SMS/WhatsApp on status change
    try {
      const [jcRows] = await pool.query<RowDataPacket[]>(
        `SELECT j.*, c.full_name as customer_name, c.phone as customer_phone, v.reg_number
         FROM job_cards j
         LEFT JOIN customers c ON j.customer_id = c.id
         LEFT JOIN vehicles v ON j.vehicle_id = v.id
         WHERE j.id = ?`,
        [req.params.id]
      );
      if (jcRows[0]) {
        const jc = jcRows[0];
        const mobile = jc.customer_phone;
        const statusLabels: Record<string, string> = {
          scheduled: 'Scheduled',
          car_in: 'Received / Car In',
          washing: 'Washing Stage',
          in_progress: 'Work in Progress',
          qc: 'Quality Check',
          rework: 'Reworking Stage',
          ready: 'Ready for Delivery',
          estimate: 'Estimate Generated',
          delivered: 'Delivered',
          cancelled: 'Cancelled'
        };
        const label = statusLabels[new_status] || new_status;
        const token = jc.public_token;
        const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
        const trackUrl = token ? `${baseUrl}/track/${token}` : '';
        const msg = `Dear ${jc.customer_name || 'Customer'}, your car ${jc.reg_number || 'vehicle'} status at God of Ceramic: ${label}.${trackUrl ? ' Track: ' + trackUrl : ''} Ref: ${jc.job_code}`;
        
        if (mobile) {
          await sendQuickWhatsApp(mobile, msg).catch(e =>
            console.error('Status SMS/WhatsApp err:', e)
          );
        }
      }
    } catch (smsErr) {
      console.error('Status SMS error (non-blocking):', smsErr);
    }

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM job_cards WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update status.' } });
  }
};

const recalculateJobCardTotals = async (jobId: string | number): Promise<void> => {
  const [jcRows] = await pool.query<RowDataPacket[]>('SELECT gst_applicable, completion_type, amount_paid, card_charges FROM job_cards WHERE id = ?', [jobId]);
  if (jcRows.length === 0) return;
  const jc = jcRows[0];
  const useGST = jc.gst_applicable;
  const isInvoice = jc.completion_type === 'invoice';

  const [allServices] = await pool.query<RowDataPacket[]>('SELECT * FROM job_services WHERE job_card_id = ?', [jobId]);
  const subtotal = allServices.reduce((s: number, sv: RowDataPacket) => s + Number(sv.line_total), 0);
  
  let gst_amount = 0;
  if (useGST) {
    if (isInvoice) {
      // GST-inclusive: back-calculate tax from line_total
      for (const sv of allServices) {
        const taxPct = Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00);
        gst_amount += Number(sv.line_total) - (Number(sv.line_total) / (1 + taxPct / 100));
      }
    } else {
      // GST-exclusive: calculate tax on top of line_total
      for (const sv of allServices) {
        const taxPct = Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00);
        gst_amount += Number(sv.line_total) * (taxPct / 100);
      }
    }
    gst_amount = Math.round(gst_amount * 100) / 100;
  }

  const cardCharges = Number(jc.card_charges || 0);
  const finalTotal = (isInvoice ? subtotal : (subtotal + gst_amount)) + cardCharges;
  const balance_due = finalTotal - Number(jc.amount_paid || 0);

  await pool.query('UPDATE job_cards SET total_amount = ?, balance_due = ? WHERE id = ?', [finalTotal, balance_due, jobId]);

  // Sync with invoices table if exists
  const [invRows] = await pool.query<RowDataPacket[]>('SELECT id, invoice_type, apply_gst, card_charges FROM invoices WHERE job_card_id = ? AND deleted_at IS NULL', [jobId]);
  if (invRows.length > 0) {
    for (const inv of invRows) {
      const invUseGST = inv.apply_gst;
      const invIsInvoice = inv.invoice_type === 'tax_invoice';
      let invGst = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      if (invUseGST) {
        if (invIsInvoice) {
          // GST-inclusive: back-calculate tax from line_total
          for (const sv of allServices) {
            const taxPct = Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00);
            invGst += Number(sv.line_total) - (Number(sv.line_total) / (1 + taxPct / 100));
          }
        } else {
          // GST-exclusive: calculate tax on top of line_total
          for (const sv of allServices) {
            const taxPct = Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00);
            invGst += Number(sv.line_total) * (taxPct / 100);
          }
        }
        invGst = Math.round(invGst * 100) / 100;
        cgstAmount = Math.round((invGst / 2) * 100) / 100;
        sgstAmount = Math.round((invGst / 2) * 100) / 100;
        invGst = cgstAmount + sgstAmount;
      }
      
      const invCardCharges = Number(inv.card_charges || 0);
      const invTotal = (invIsInvoice ? subtotal : (subtotal + invGst)) + invCardCharges;
      const invTaxable = invIsInvoice ? (subtotal - invGst) : subtotal;
      const cgstRate = invUseGST && invTaxable > 0 ? Math.round((cgstAmount / invTaxable) * 100 * 100) / 100 : 0;
      const sgstRate = invUseGST && invTaxable > 0 ? Math.round((sgstAmount / invTaxable) * 100 * 100) / 100 : 0;

      await pool.query(
        `UPDATE invoices SET subtotal = ?, taxable_amount = ?, cgst_rate = ?, cgst_amount = ?,
                sgst_rate = ?, sgst_amount = ?, total_amount = ?, balance_due = ? - amount_paid
         WHERE id = ?`,
        [subtotal, invTaxable, cgstRate, cgstAmount, sgstRate, sgstAmount, invTotal, invTotal, inv.id]
      );

      // Update invoice_items too!
      await pool.query('DELETE FROM invoice_items WHERE invoice_id = ?', [inv.id]);
      for (const sv of allServices) {
        await pool.query(
          `INSERT INTO invoice_items (invoice_id, description, hsn_sac, qty, unit, rate, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [inv.id, sv.service_name, '998714', sv.quantity || 1, 'job', sv.unit_price, Number(sv.line_total)]
        );
      }
    }
  }

  // Auto-sync connector commission for the job card
  await syncJobCardCommission(pool, jobId);
};

// ─── ADD SERVICE ──────────────────────────────────
export const addJobService = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.id;
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id, status FROM job_cards WHERE id = ? AND deleted_at IS NULL', [jobId]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }

    if (existing[0].status === 'delivered') {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Cannot modify services on a delivered job card.' } });
      return;
    }

    const d = req.body;
    const lineTotal = d.unit_price * d.quantity;
    const taxPct = d.tax_pct !== undefined ? Number(d.tax_pct) : 18.00;
    const itemType = d.item_type || 'labor';

    await pool.query<ResultSetHeader>(
      `INSERT INTO job_services (job_card_id, service_name, service_type, package_tier, description, sqft_used, ml_used, unit_price, quantity, line_total, tax_pct, item_type, inventory_item_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, d.service_name, d.service_type || 'other', d.package_tier || 'basic', d.description || null,
       d.sqft_used || 0, d.ml_used || 0, d.unit_price, d.quantity || 1, lineTotal, taxPct, itemType, d.inventory_item_id || null]
    );

    await recalculateJobCardTotals(jobId);

    const [services] = await pool.query<RowDataPacket[]>('SELECT * FROM job_services WHERE job_card_id = ?', [jobId]);
    res.status(201).json({ success: true, data: services });
  } catch (error) {
    console.error('Add service error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to add service.' } });
  }
};

// ─── DELETE SERVICE ───────────────────────────────
export const deleteJobService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: jobId, serviceId } = req.params;
    const [existingJob] = await pool.query<RowDataPacket[]>('SELECT status FROM job_cards WHERE id = ? AND deleted_at IS NULL', [jobId]);
    if (existingJob.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }
    
    if (existingJob[0].status === 'delivered') {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Cannot modify services on a delivered job card.' } });
      return;
    }

    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM job_services WHERE id = ? AND job_card_id = ?', [serviceId, jobId]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Service not found.' } }); return; }

    await pool.query('DELETE FROM job_services WHERE id = ?', [serviceId]);

    await recalculateJobCardTotals(jobId);

    res.json({ success: true, data: { message: 'Service removed.' } });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to remove service.' } });
  }
};

// ─── SOFT DELETE ──────────────────────────────────
export const deleteJobCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id, job_code FROM job_cards WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }
    await pool.query('UPDATE job_cards SET deleted_at = NOW() WHERE id = ?', [req.params.id]);

    const staffId = (req as any).staff?.id || null;
    await logActivity(
      staffId,
      'delete_job_card',
      'job_card',
      Number(req.params.id),
      `Deleted Job Card ${existing[0].job_code}`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, data: { message: 'Job card deleted.' } });
  } catch (error) {
    console.error('Delete job card error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete job card.' } });
  }
};

// ─── SERVICE CATALOG SEARCH ───────────────────────────────
export const searchServiceCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, category, service_type } = req.query as any;
    const conds: string[] = ['is_active = 1'];
    const params: any[] = [];

    if (q) { conds.push('name LIKE ?'); params.push(`%${q}%`); }
    if (category) { conds.push('category = ?'); params.push(category); }
    if (service_type) { conds.push('service_type = ?'); params.push(service_type); }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM service_catalog WHERE ${conds.join(' AND ')} ORDER BY category, name LIMIT 30`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Search service catalog error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to search catalog.' } });
  }
};

// ─── SERVICE CATALOG CATEGORIES ───────────────────────────
export const getServiceCatalogCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT category, COUNT(*) as count FROM service_catalog WHERE is_active = 1 GROUP BY category ORDER BY category`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get catalog categories error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch categories.' } });
  }
};

// ─── COMPLETE JOB (create invoice/estimate) ───────────────
export const completeJob = async (req: Request, res: Response): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const jobId = req.params.id;
    const { completion_type, gst_applicable, payment_mode, notes, gst_pct } = req.body;
    const staffId = (req as any).staff?.id;

    const [jcRows] = await conn.query<RowDataPacket[]>(
      `SELECT j.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       WHERE j.id = ? AND j.deleted_at IS NULL`, [jobId]
     );
    if (jcRows.length === 0) {
      await conn.rollback();
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } });
      return;
    }
    const jc = jcRows[0];

    if (gst_pct !== undefined && completion_type === 'invoice') {
      await conn.query('UPDATE job_services SET tax_pct = ? WHERE job_card_id = ?', [Number(gst_pct), jobId]);
    }

    const [services] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM job_services WHERE job_card_id = ?', [jobId]
    );

    const subtotal = services.reduce((s: number, sv: RowDataPacket) => s + Number(sv.line_total), 0);
    const isInvoice = completion_type === 'invoice';
    const useGST = gst_applicable; // GST applied if checked

    let gst_amount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;

    if (useGST) {
      if (isInvoice) {
        // GST-inclusive: back-calculate tax from line_total
        for (const sv of services) {
          const taxPct = Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00);
          gst_amount += Number(sv.line_total) - (Number(sv.line_total) / (1 + taxPct / 100));
        }
      } else {
        // GST-exclusive: calculate tax on top of line_total
        for (const sv of services) {
          const taxPct = Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00);
          gst_amount += Number(sv.line_total) * (taxPct / 100);
        }
      }
      gst_amount = Math.round(gst_amount * 100) / 100;
      cgstAmount = Math.round((gst_amount / 2) * 100) / 100;
      sgstAmount = Math.round((gst_amount / 2) * 100) / 100;
      gst_amount = cgstAmount + sgstAmount;
    }
    // Total amount is subtotal for inclusive invoice, subtotal + GST for exclusive estimate
    let total_amount = isInvoice ? subtotal : (subtotal + gst_amount);
    const taxable_amount = isInvoice ? (subtotal - gst_amount) : subtotal;

    // Apply 2.5% card charges if payment is made by card
    let card_charges = 0;
    if (payment_mode === 'card') {
      card_charges = Math.round((total_amount * 0.025) * 100) / 100;
      total_amount += card_charges;
    }

    // Generate doc number
    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = isInvoice ? 'GOC-INV' : 'GOC-EST';
    const [lastDoc] = await conn.query<RowDataPacket[]>(
      `SELECT invoice_code FROM invoices WHERE invoice_type = ? ORDER BY id DESC LIMIT 1`,
      [isInvoice ? 'tax_invoice' : 'estimate']
    );
    let seq = 1;
    if (lastDoc.length > 0 && lastDoc[0].invoice_code) {
      const parts = lastDoc[0].invoice_code.split('-');
      seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
    }
    const docNumber = `${prefix}-${yy}${mm}${dd}-${String(seq).padStart(3, '0')}`;
    const invType = isInvoice ? 'tax_invoice' : 'estimate';

    const [existing] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM invoices WHERE job_card_id = ? AND invoice_type = ? AND deleted_at IS NULL', [jobId, invType]
    );

    let invoiceId: number;

    if (existing.length === 0) {
      const cgstRate = useGST && taxable_amount > 0 ? Math.round((cgstAmount / taxable_amount) * 100 * 100) / 100 : 0;
      const sgstRate = useGST && taxable_amount > 0 ? Math.round((sgstAmount / taxable_amount) * 100 * 100) / 100 : 0;

      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO invoices (invoice_code, job_card_id, customer_id, invoice_type, invoice_date, due_date,
          subtotal, discount_amount, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, apply_gst,
          total_amount, amount_paid, balance_due, card_charges, customer_gstin, status, notes, created_by)
         VALUES (?, ?, ?, ?, CURDATE(), NULL, ?, 0, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          docNumber, jobId, jc.customer_id, invType,
          subtotal, taxable_amount,
          cgstRate, cgstAmount, sgstRate, sgstAmount,
          useGST ? 1 : 0, total_amount, Number(jc.amount_paid || 0), total_amount - Number(jc.amount_paid || 0),
          card_charges, isInvoice ? 'paid' : 'draft', notes || null, staffId
        ]
      );

      invoiceId = result.insertId;

      for (const sv of services) {
        const itemAmount = Number(sv.line_total);
        await conn.query(
          `INSERT INTO invoice_items (invoice_id, description, hsn_sac, qty, unit, rate, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [invoiceId, sv.service_name, '998714', sv.quantity || 1, 'job', sv.unit_price, itemAmount]
        );
      }
    } else {
      invoiceId = existing[0].id;
    }

    if (isInvoice) {
      const remaining = total_amount - Number(jc.amount_paid || 0);
      if (remaining > 0) {
        await conn.query(
          `INSERT INTO payments (invoice_id, job_card_id, customer_id, payment_type, amount, payment_mode, received_by, notes)
           VALUES (?, ?, ?, 'final', ?, ?, ?, 'Auto-recorded on invoice generation')`,
          [invoiceId, jobId, jc.customer_id, remaining, payment_mode || 'cash', staffId]
        );
      }

      await conn.query(
        `UPDATE invoices SET amount_paid = total_amount, balance_due = 0, status = 'paid' WHERE id = ?`,
        [invoiceId]
      );

      await conn.query(
        `UPDATE job_cards SET completion_type = ?, gst_applicable = ?, total_amount = ?, amount_paid = total_amount, balance_due = 0, card_charges = ? WHERE id = ?`,
        [completion_type, useGST ? 1 : 0, total_amount, card_charges, jobId]
      );
    } else {
      const balance_due = total_amount - Number(jc.amount_paid || 0);
      await conn.query(
        `UPDATE job_cards SET completion_type = ?, gst_applicable = ?, total_amount = ?, balance_due = ?, card_charges = ? WHERE id = ?`,
        [completion_type, useGST ? 1 : 0, total_amount, balance_due, card_charges, jobId]
      );
    }

    if (completion_type === 'invoice') {
      await deductInventoryForJobCard(conn, jobId, false, staffId);
    }

    // Auto-sync connector commission for the job card (under transaction context)
    await syncJobCardCommission(conn, jobId);

    await conn.commit();

    await logActivity(
      staffId || null,
      'complete_job_card',
      'job_card',
      Number(jobId),
      `Completed Job Card ${jc.job_code} with document ${docNumber} (${completion_type})`,
      req.ip,
      req.headers['user-agent']
    );

    // ── SMS: Invoice Generated ────────────────────────
    try {
      if (jc.customer_phone) {
        await smsInvoiceGenerated({
          phone: jc.customer_phone,
          customer_name: jc.customer_name || 'Customer',
          invoice_code: docNumber,
          total_amount: total_amount,
        });
      }
    } catch (smsErr) {
      console.error('[JobCard] SMS invoice generated error (non-blocking):', smsErr);
    }
    // ─────────────────────────────────────────────────────

    res.json({ success: true, data: { message: `${completion_type === 'invoice' ? 'Invoice' : 'Estimate'} created: ${docNumber}`, doc_number: docNumber, total_amount } });
  } catch (error) {
    await conn.rollback();
    console.error('Complete job error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to complete job.' } });
  } finally {
    conn.release();
  }
};

// ─── UPDATE SERVICE LINE ITEM ─────────────────────────────
export const updateJobService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: jobId, serviceId } = req.params;
    const [existingJob] = await pool.query<RowDataPacket[]>('SELECT status FROM job_cards WHERE id = ? AND deleted_at IS NULL', [jobId]);
    if (existingJob.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }
    
    if (existingJob[0].status === 'delivered') {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Cannot modify services on a delivered job card.' } });
      return;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM job_services WHERE id = ? AND job_card_id = ?', [serviceId, jobId]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Service line item not found.' } });
      return;
    }
    const d = req.body;
    const line_total = Number(d.unit_price) * Number(d.quantity || 1);
    const taxPct = d.tax_pct !== undefined ? Number(d.tax_pct) : 18.00;

    await pool.query(
      `UPDATE job_services SET service_name=?, service_type=?, package_tier=?, description=?,
       sqft_used=?, ml_used=?, unit_price=?, quantity=?, line_total=?, hsn_sac=?, tax_pct=?, discount_pct=?, item_type=?, inventory_item_id=?
       WHERE id = ?`,
      [d.service_name, d.service_type, d.package_tier || 'basic', d.description || null,
       d.sqft_used || 0, d.ml_used || 0, d.unit_price, d.quantity || 1, line_total,
       d.hsn_sac || null, taxPct, d.discount_pct || 0, d.item_type || 'labor', d.inventory_item_id || null, serviceId]
    );

    await recalculateJobCardTotals(jobId);

    const [services] = await pool.query<RowDataPacket[]>('SELECT * FROM job_services WHERE job_card_id=?', [jobId]);
    res.json({ success: true, data: services });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update service.' } });
  }
};

// ─── DISPATCH (WhatsApp / SMS) ────────────────────────────
export const dispatchJobCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.id;
    const { dispatch_type } = req.body;
    const staffId = (req as any).staff?.id;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT j.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       WHERE j.id = ? AND j.deleted_at IS NULL`, [jobId]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } });
      return;
    }
    const jc = rows[0];
    const phone = jc.customer_phone;
    if (!phone) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Customer has no phone number.' } });
      return;
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const trackUrl = jc.public_token ? `${baseUrl}/track/${jc.public_token}` : '';
    const msg = `Dear ${jc.customer_name}, your ${jc.vehicle_name || 'vehicle'} (${jc.reg_number || 'N/A'}) job card at GOC Studio is: ${jc.status?.toUpperCase()}. Total: ₹${Number(jc.total_amount).toLocaleString('en-IN')}.${trackUrl ? ' Track: ' + trackUrl : ''} Ref: ${jc.job_code}`;

    try {
      await sendQuickWhatsApp(phone, msg);
      if (dispatch_type === 'whatsapp') {
        await pool.query('UPDATE job_cards SET dispatch_whatsapp = 1 WHERE id = ?', [jobId]);
      }
    } catch (sendErr) {
      console.error('WhatsApp send error (non-blocking):', sendErr);
    }

    res.json({ success: true, data: { message: 'Dispatch sent successfully.' } });
  } catch (error) {
    console.error('Dispatch error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to dispatch.' } });
  }
};

// ─── INVENTORY DEDUCTION HELPER ─────────────────────
export const deductInventoryForJobCard = async (conn: any, jobId: number | string, isQuick: boolean = false, staffId?: number): Promise<void> => {
  try {
    let checkSql = 'SELECT inventory_deducted, status, completion_type FROM job_cards WHERE id = ?';
    if (isQuick) {
      checkSql = 'SELECT inventory_deducted, status FROM quick_job_cards WHERE id = ?';
    }
    const [jcRows] = await conn.query(checkSql, [jobId]);
    if (jcRows.length === 0) return;
    const jc = jcRows[0];
    if (jc.inventory_deducted === 1) return;

    let svcSql = 'SELECT * FROM job_services WHERE job_card_id = ?';
    if (isQuick) {
      svcSql = 'SELECT * FROM quick_job_card_services WHERE job_card_id = ?';
    }
    const [services] = await conn.query(svcSql, [jobId]);

    for (const service of services) {
      let itemId = service.inventory_item_id;
      let matchedCategory = '';

      if (!itemId) {
        if (service.service_type === 'ppf' || service.service_name.toLowerCase().includes('ppf')) {
          matchedCategory = 'ppf_roll';
        } else if (service.service_type === 'ceramic' || service.service_name.toLowerCase().includes('ceramic')) {
          matchedCategory = 'ceramic';
        }
        if (matchedCategory) {
          const [invItems] = await conn.query(
            'SELECT id, category FROM inventory_items WHERE category = ? AND deleted_at IS NULL LIMIT 1',
            [matchedCategory]
          );
          if (invItems.length > 0) {
            itemId = invItems[0].id;
          }
        }
      }

      if (itemId) {
        const [itemRows] = await conn.query('SELECT category FROM inventory_items WHERE id = ?', [itemId]);
        if (itemRows.length > 0) {
          const itemCategory = itemRows[0].category;

          if (itemCategory === 'ppf_roll') {
            const qtyToDeduct = Number(service.sqft_used) || Number(service.quantity) || Number(service.qty) || 50;
            const wastage = Math.round(qtyToDeduct * 0.05 * 100) / 100;
            const totalDeducted = qtyToDeduct + wastage;

            const [rolls] = await conn.query(
              'SELECT * FROM ppf_rolls WHERE inventory_item_id = ? AND status = "available" LIMIT 1',
              [itemId]
            );
            let ppfRollId = null;
            if (rolls.length > 0) {
              const roll = rolls[0];
              ppfRollId = roll.id;
              const newUsed = Number(roll.used_sqft) + totalDeducted;
              const newBalance = Math.max(0, Number(roll.total_sqft) - newUsed);
              const newRollStatus = newBalance <= 5 ? 'exhausted' : 'partial';

              await conn.query(
                'UPDATE ppf_rolls SET used_sqft = ?, balance_sqft = ?, status = ? WHERE id = ?',
                [newUsed, newBalance, newRollStatus, roll.id]
              );
            }

            await conn.query(
              'UPDATE inventory_items SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?',
              [totalDeducted, itemId]
            );

            await conn.query(
              `INSERT INTO inventory_usage (inventory_item_id, ppf_roll_id, job_card_id, qty_used, wastage_qty, total_deducted, used_by, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                itemId, ppfRollId, isQuick ? null : jobId, qtyToDeduct, wastage, totalDeducted,
                staffId || null, `Auto-deducted PPF roll on job completion/delivery for ${service.service_name}`
              ]
            );
          } else {
            const qtyToDeduct = Number(service.quantity) || Number(service.qty) || 1;
            await conn.query(
              'UPDATE inventory_items SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?',
              [qtyToDeduct, itemId]
            );

            await conn.query(
              `INSERT INTO inventory_usage (inventory_item_id, job_card_id, qty_used, wastage_qty, total_deducted, used_by, notes)
               VALUES (?, ?, ?, 0, ?, ?, ?)`,
              [
                itemId, isQuick ? null : jobId, qtyToDeduct, qtyToDeduct,
                staffId || null, `Auto-deducted on job completion/delivery for ${service.service_name}`
              ]
            );
          }
        }
      }
    }

    let updateSql = 'UPDATE job_cards SET inventory_deducted = 1 WHERE id = ?';
    if (isQuick) {
      updateSql = 'UPDATE quick_job_cards SET inventory_deducted = 1 WHERE id = ?';
    }
    await conn.query(updateSql, [jobId]);
  } catch (err) {
    console.error('❌ deductInventoryForJobCard error:', err);
  }
};

/**
 * Automatically syncs connector commission details for a Job Card based on Customer's referral link.
 */
export const syncJobCardCommission = async (conn: any, jobId: string | number): Promise<void> => {
  try {
    // 1. Fetch Job Card and Customer's connector link
    const [jcRows] = await conn.query(
      `SELECT j.id, j.total_amount, j.customer_id, j.status, c.connector_id
       FROM job_cards j
       JOIN customers c ON j.customer_id = c.id
       WHERE j.id = ? AND j.deleted_at IS NULL`,
      [jobId]
    );

    if (jcRows.length === 0) return;
    const jc = jcRows[0];

    // 2. If customer has a connector
    if (jc.connector_id) {
      const [connectorRows] = await conn.query(
        'SELECT commission_type, commission_value FROM connectors WHERE id = ? AND deleted_at IS NULL',
        [jc.connector_id]
      );

      if (connectorRows.length === 0) return;
      const connDetails = connectorRows[0];

      let commPct: number | null = null;
      let commAmount = 0;
      const jobAmount = Number(jc.total_amount || 0);

      if (connDetails.commission_type === 'percentage') {
        commPct = Number(connDetails.commission_value || 0);
        commAmount = Math.round((commPct / 100) * jobAmount * 100) / 100;
      } else {
        commAmount = Number(connDetails.commission_value || 0);
      }

      // Check if commission record already exists
      const [existing] = await conn.query(
        'SELECT id, status FROM connector_commissions WHERE job_card_id = ?',
        [jobId]
      );

      let commStatus: 'pending' | 'approved' | 'paid' = 'pending';
      if (jc.status === 'delivered') {
        commStatus = 'approved';
      }

      if (existing.length > 0) {
        const comm = existing[0];
        // Only update if it hasn't been marked as paid
        if (comm.status !== 'paid') {
          const nextStatus = jc.status === 'delivered' ? 'approved' : comm.status;
          await conn.query(
            `UPDATE connector_commissions 
             SET connector_id = ?, customer_id = ?, job_amount = ?, commission_pct = ?, commission_amount = ?, status = ? 
             WHERE id = ?`,
            [jc.connector_id, jc.customer_id, jobAmount, commPct, commAmount, nextStatus, comm.id]
          );
        }
      } else {
        // Create new pending/approved commission record
        await conn.query(
          `INSERT INTO connector_commissions (connector_id, job_card_id, customer_id, job_amount, commission_pct, commission_amount, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [jc.connector_id, jobId, jc.customer_id, jobAmount, commPct, commAmount, commStatus]
        );
      }
    } else {
      // Customer doesn't have a connector. Remove any unpaid commissions for this job card.
      await conn.query(
        'DELETE FROM connector_commissions WHERE job_card_id = ? AND status != "paid"',
        [jobId]
      );
    }
  } catch (err) {
    console.error('❌ syncJobCardCommission error:', err);
  }
};


