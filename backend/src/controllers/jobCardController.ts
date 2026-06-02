import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES, JOB_STATUS_FLOW } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { WhatsAppTemplates, sendQuickWhatsApp } from '../services/whatsappService';
import { smsJobCreated, smsVehicleReady } from '../services/events/jobEvents';
import { smsInvoiceGenerated } from '../services/events/invoiceEvents';
import { v4 as uuidv4 } from 'uuid';


// ─── LIST ─────────────────────────────────────────
export const getJobCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, job_type, search, date_from, date_to, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = ['j.deleted_at IS NULL'];
    const params: any[] = [];

    if (status) { conds.push('j.status = ?'); params.push(status); }
    if (job_type) { conds.push('j.job_type = ?'); params.push(job_type); }
    if (date_from) { conds.push('j.created_at >= ?'); params.push(date_from); }
    if (date_to) { conds.push('j.created_at <= ?'); params.push(`${date_to} 23:59:59`); }
    if (search) {
      conds.push('(c.full_name LIKE ? OR c.phone LIKE ? OR j.job_code LIKE ?)');
      const t = `%${search}%`; params.push(t, t, t);
    }

    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM job_cards j LEFT JOIN customers c ON j.customer_id = c.id WHERE ${where}`, params
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT j.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number,
              s.full_name as created_by_name
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       LEFT JOIN staff s ON j.created_by = s.id
       WHERE ${where} ORDER BY j.id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ success: true, data: rows, meta: { total: countR[0].total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(countR[0].total / Number(limit)) } });
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
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number, v.year as vehicle_year,
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
  try {
    const code = await generateCode('job');
    const d = req.body;
    const staffId = (req as any).staff?.id;
    const public_token = uuidv4();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO job_cards (job_code, booking_id, customer_id, vehicle_id, job_type,
        expected_out, assigned_staff, internal_notes, created_by, status, public_token, insurance_company, insurance_expiry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`,
      [code, d.booking_id || null, d.customer_id, d.vehicle_id, d.job_type || 'walkin',
       d.expected_out || null, d.assigned_staff ? JSON.stringify(d.assigned_staff) : null,
       d.internal_notes || null, staffId, public_token, d.insurance_company || null, d.insurance_expiry || null]
    );

    // If booking_id provided, mark booking as converted
    if (d.booking_id) {
      await pool.query('UPDATE bookings SET status = "converted" WHERE id = ?', [d.booking_id]);
    }

    // Insert concerns if provided
    if (d.concerns && Array.isArray(d.concerns)) {
      for (const concern of d.concerns) {
        await pool.query(
          'INSERT INTO customer_concerns (job_card_id, concern_text) VALUES (?, ?)',
          [result.insertId, concern]
        );
      }
    }

    // Log initial status
    await pool.query(
      'INSERT INTO job_status_log (job_card_id, old_status, new_status, changed_by, notes) VALUES (?, NULL, "in_progress", ?, "Job card created")',
      [result.insertId, staffId]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT j.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       WHERE j.id = ?`,
      [result.insertId]
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
    console.error('Create job card error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create job card.' } });
  }
};

// ─── UPDATE ───────────────────────────────────────
export const updateJobCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM job_cards WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }

    const d = req.body;
    const fields: string[] = []; const vals: any[] = [];
    const allowed = ['expected_out', 'qc_notes', 'delivery_notes', 'internal_notes'];
    for (const f of allowed) {
      if (d[f] !== undefined) { fields.push(`${f} = ?`); vals.push(d[f]); }
    }
    if (d.assigned_staff !== undefined) { fields.push('assigned_staff = ?'); vals.push(JSON.stringify(d.assigned_staff)); }
    if (fields.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update.' } }); return; }

    vals.push(req.params.id);
    await pool.query(`UPDATE job_cards SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM job_cards WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update job card error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update job card.' } });
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

    // Log the transition
    await pool.query(
      'INSERT INTO job_status_log (job_card_id, old_status, new_status, changed_by, notes) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, current, new_status, staffId, notes || null]
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

    // If status is changed to in_progress, trigger inventory deduction
    if (new_status === 'in_progress') {
      const jobId = req.params.id;
      const [services] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM job_services WHERE job_card_id = ?', [jobId]
      );

      for (const service of services) {
        let matchedCategory = '';
        let quantityUsed = 0;
        
        if (service.service_type === 'ppf' || service.service_name.toLowerCase().includes('ppf')) {
          matchedCategory = 'ppf_roll';
          quantityUsed = Number(service.sqft_used) || 50;
        } else if (service.service_type === 'ceramic' || service.service_name.toLowerCase().includes('ceramic')) {
          matchedCategory = 'ceramic';
          quantityUsed = Number(service.ml_used) || 50;
        }

        if (matchedCategory) {
          const [invItems] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM inventory_items WHERE category = ? AND deleted_at IS NULL LIMIT 1',
            [matchedCategory]
          );

          if (invItems.length > 0) {
            const item = invItems[0];
            const wastage = Math.round(quantityUsed * 0.05 * 100) / 100;
            const totalDeducted = quantityUsed + wastage;

            let ppfRollId: number | null = null;
            if (matchedCategory === 'ppf_roll') {
              const [rolls] = await pool.query<RowDataPacket[]>(
                'SELECT * FROM ppf_rolls WHERE inventory_item_id = ? AND status = "available" LIMIT 1',
                [item.id]
              );
              if (rolls.length > 0) {
                const roll = rolls[0];
                ppfRollId = roll.id;

                const newUsed = Number(roll.used_sqft) + totalDeducted;
                const newBalance = Math.max(0, Number(roll.total_sqft) - newUsed);
                const newRollStatus = newBalance <= 5 ? 'exhausted' : 'partial';

                await pool.query(
                  'UPDATE ppf_rolls SET used_sqft = ?, balance_sqft = ?, status = ? WHERE id = ?',
                  [newUsed, newBalance, newRollStatus, roll.id]
                );
              }
            }

            await pool.query(
              `INSERT INTO inventory_usage (inventory_item_id, ppf_roll_id, job_card_id, qty_used, wastage_qty, total_deducted, used_by, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                item.id, ppfRollId, jobId, quantityUsed, wastage, totalDeducted,
                staffId, `Auto-deducted on job status IN_PROGRESS for ${service.service_name}`
              ]
            );

            await pool.query(
              'UPDATE inventory_items SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?',
              [totalDeducted, item.id]
            );
          }
        }
      }
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

// ─── ADD SERVICE ──────────────────────────────────
export const addJobService = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.id;
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM job_cards WHERE id = ? AND deleted_at IS NULL', [jobId]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }

    const d = req.body;
    const lineTotal = d.unit_price * d.quantity;
    const taxPct = d.tax_pct !== undefined ? Number(d.tax_pct) : 18.00;
    const itemType = d.item_type || 'labor';

    await pool.query<ResultSetHeader>(
      `INSERT INTO job_services (job_card_id, service_name, service_type, package_tier, description, sqft_used, ml_used, unit_price, quantity, line_total, tax_pct, item_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, d.service_name, d.service_type || 'other', d.package_tier || 'basic', d.description || null,
       d.sqft_used || 0, d.ml_used || 0, d.unit_price, d.quantity || 1, lineTotal, taxPct, itemType]
    );

    // Recalculate total_amount on job card
    const [jcRows] = await pool.query<RowDataPacket[]>('SELECT gst_applicable, completion_type, amount_paid FROM job_cards WHERE id = ?', [jobId]);
    const jc = jcRows[0];
    const useGST = jc.completion_type === 'invoice' && jc.gst_applicable;

    const [allServices] = await pool.query<RowDataPacket[]>('SELECT * FROM job_services WHERE job_card_id = ?', [jobId]);
    const subtotal = allServices.reduce((s: number, sv: RowDataPacket) => s + Number(sv.line_total), 0);
    
    let gst_amount = 0;
    if (useGST) {
      for (const sv of allServices) {
        const itemGST = Number(sv.line_total) * (Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00) / 100);
        gst_amount += itemGST;
      }
      gst_amount = Math.round(gst_amount * 100) / 100;
    }
    const finalTotal = subtotal + gst_amount;
    const balance_due = finalTotal - Number(jc.amount_paid || 0);

    await pool.query('UPDATE job_cards SET total_amount = ?, balance_due = ? WHERE id = ?', [finalTotal, balance_due, jobId]);

    // Sync with invoices table if exists
    const [invRows] = await pool.query<RowDataPacket[]>('SELECT id, invoice_type, apply_gst FROM invoices WHERE job_card_id = ? AND deleted_at IS NULL', [jobId]);
    if (invRows.length > 0) {
      for (const inv of invRows) {
        const invUseGST = inv.invoice_type === 'tax_invoice' && inv.apply_gst;
        let invGst = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        if (invUseGST) {
          for (const sv of allServices) {
            invGst += Number(sv.line_total) * (Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00) / 100);
          }
          invGst = Math.round(invGst * 100) / 100;
          cgstAmount = Math.round((invGst / 2) * 100) / 100;
          sgstAmount = Math.round((invGst / 2) * 100) / 100;
          invGst = cgstAmount + sgstAmount;
        }
        const invTotal = subtotal + invGst;
        const cgstRate = invUseGST && subtotal > 0 ? Math.round((cgstAmount / subtotal) * 100 * 100) / 100 : 0;
        const sgstRate = invUseGST && subtotal > 0 ? Math.round((sgstAmount / subtotal) * 100 * 100) / 100 : 0;

        await pool.query(
          `UPDATE invoices SET subtotal = ?, taxable_amount = ?, cgst_rate = ?, cgst_amount = ?,
                  sgst_rate = ?, sgst_amount = ?, total_amount = ?, balance_due = ? - amount_paid
           WHERE id = ?`,
          [subtotal, subtotal, cgstRate, cgstAmount, sgstRate, sgstAmount, invTotal, invTotal, inv.id]
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
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM job_services WHERE id = ? AND job_card_id = ?', [serviceId, jobId]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Service not found.' } }); return; }

    await pool.query('DELETE FROM job_services WHERE id = ?', [serviceId]);

    // Recalculate total_amount on job card
    const [jcRows] = await pool.query<RowDataPacket[]>('SELECT gst_applicable, completion_type, amount_paid FROM job_cards WHERE id = ?', [jobId]);
    const jc = jcRows[0];
    const useGST = jc.completion_type === 'invoice' && jc.gst_applicable;

    const [allServices] = await pool.query<RowDataPacket[]>('SELECT * FROM job_services WHERE job_card_id = ?', [jobId]);
    const subtotal = allServices.reduce((s: number, sv: RowDataPacket) => s + Number(sv.line_total), 0);
    
    let gst_amount = 0;
    if (useGST) {
      for (const sv of allServices) {
        const itemGST = Number(sv.line_total) * (Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00) / 100);
        gst_amount += itemGST;
      }
      gst_amount = Math.round(gst_amount * 100) / 100;
    }
    const finalTotal = subtotal + gst_amount;
    const balance_due = finalTotal - Number(jc.amount_paid || 0);

    await pool.query('UPDATE job_cards SET total_amount = ?, balance_due = ? WHERE id = ?', [finalTotal, balance_due, jobId]);

    // Sync with invoices table if exists
    const [invRows] = await pool.query<RowDataPacket[]>('SELECT id, invoice_type, apply_gst FROM invoices WHERE job_card_id = ? AND deleted_at IS NULL', [jobId]);
    if (invRows.length > 0) {
      for (const inv of invRows) {
        const invUseGST = inv.invoice_type === 'tax_invoice' && inv.apply_gst;
        let invGst = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        if (invUseGST) {
          for (const sv of allServices) {
            invGst += Number(sv.line_total) * (Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00) / 100);
          }
          invGst = Math.round(invGst * 100) / 100;
          cgstAmount = Math.round((invGst / 2) * 100) / 100;
          sgstAmount = Math.round((invGst / 2) * 100) / 100;
          invGst = cgstAmount + sgstAmount;
        }
        const invTotal = subtotal + invGst;
        const cgstRate = invUseGST && subtotal > 0 ? Math.round((cgstAmount / subtotal) * 100 * 100) / 100 : 0;
        const sgstRate = invUseGST && subtotal > 0 ? Math.round((sgstAmount / subtotal) * 100 * 100) / 100 : 0;

        await pool.query(
          `UPDATE invoices SET subtotal = ?, taxable_amount = ?, cgst_rate = ?, cgst_amount = ?,
                  sgst_rate = ?, sgst_amount = ?, total_amount = ?, balance_due = ? - amount_paid
           WHERE id = ?`,
          [subtotal, subtotal, cgstRate, cgstAmount, sgstRate, sgstAmount, invTotal, invTotal, inv.id]
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

    res.json({ success: true, data: { message: 'Service removed.' } });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to remove service.' } });
  }
};

// ─── SOFT DELETE ──────────────────────────────────
export const deleteJobCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM job_cards WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }
    await pool.query('UPDATE job_cards SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
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
    const { completion_type, gst_applicable, payment_mode, notes } = req.body;
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

    const [services] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM job_services WHERE job_card_id = ?', [jobId]
    );

    const subtotal = services.reduce((s: number, sv: RowDataPacket) => s + Number(sv.line_total), 0);
    const useGST = completion_type === 'invoice' && gst_applicable;
    
    let gst_amount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;

    if (useGST) {
      for (const sv of services) {
        const itemGST = Number(sv.line_total) * (Number(sv.tax_pct !== undefined ? sv.tax_pct : 18.00) / 100);
        gst_amount += itemGST;
      }
      gst_amount = Math.round(gst_amount * 100) / 100;
      cgstAmount = Math.round((gst_amount / 2) * 100) / 100;
      sgstAmount = Math.round((gst_amount / 2) * 100) / 100;
      gst_amount = cgstAmount + sgstAmount;
    }
    const total_amount = subtotal + gst_amount;

    // Generate doc number
    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = completion_type === 'invoice' ? 'GOC-INV' : 'GOC-EST';
    const [lastDoc] = await conn.query<RowDataPacket[]>(
      `SELECT invoice_code FROM invoices WHERE invoice_type = ? ORDER BY id DESC LIMIT 1`,
      [completion_type === 'invoice' ? 'tax_invoice' : 'estimate']
    );
    let seq = 1;
    if (lastDoc.length > 0 && lastDoc[0].invoice_code) {
      const parts = lastDoc[0].invoice_code.split('-');
      seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
    }
    const docNumber = `${prefix}-${yy}${mm}${dd}-${String(seq).padStart(3, '0')}`;
    const invType = completion_type === 'invoice' ? 'tax_invoice' : 'estimate';

    const [existing] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM invoices WHERE job_card_id = ? AND invoice_type = ? AND deleted_at IS NULL', [jobId, invType]
    );

    if (existing.length === 0) {
      const cgstRate = useGST && subtotal > 0 ? Math.round((cgstAmount / subtotal) * 100 * 100) / 100 : 0;
      const sgstRate = useGST && subtotal > 0 ? Math.round((sgstAmount / subtotal) * 100 * 100) / 100 : 0;

      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO invoices (invoice_code, job_card_id, customer_id, invoice_type, invoice_date, due_date,
          subtotal, discount_amount, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, apply_gst,
          total_amount, amount_paid, balance_due, customer_gstin, status, notes, created_by)
         VALUES (?, ?, ?, ?, CURDATE(), NULL, ?, 0, ?, ?, ?, ?, ?, 0, 0, ?, ?, 0, ?, NULL, 'draft', ?, ?)`,
        [
          docNumber, jobId, jc.customer_id, invType,
          subtotal, subtotal,
          cgstRate, cgstAmount, sgstRate, sgstAmount,
          useGST ? 1 : 0, total_amount, total_amount, notes || null, staffId
        ]
      );

      const invoiceId = result.insertId;

      for (const sv of services) {
        const itemAmount = Number(sv.line_total);
        await conn.query(
          `INSERT INTO invoice_items (invoice_id, description, hsn_sac, qty, unit, rate, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [invoiceId, sv.service_name, '998714', sv.quantity || 1, 'job', sv.unit_price, itemAmount]
        );
      }
    }

    const balance_due = total_amount - Number(jc.amount_paid || 0);

    await conn.query(
      `UPDATE job_cards SET completion_type = ?, gst_applicable = ?, total_amount = ?, balance_due = ? WHERE id = ?`,
      [completion_type, useGST ? 1 : 0, total_amount, balance_due, jobId]
    );

    await conn.commit();

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
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM job_services WHERE id = ? AND job_card_id = ?', [serviceId, jobId]
    );
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Service line item not found.' } });
      return;
    }
    const d = req.body;
    const line_total = Number(d.unit_price) * Number(d.quantity || 1);
    await pool.query(
      `UPDATE job_services SET service_name=?, service_type=?, package_tier=?, description=?,
       sqft_used=?, ml_used=?, unit_price=?, quantity=?, line_total=?, hsn_sac=?, tax_pct=?, discount_pct=?
       WHERE id = ?`,
      [d.service_name, d.service_type, d.package_tier || 'basic', d.description || null,
       d.sqft_used || 0, d.ml_used || 0, d.unit_price, d.quantity || 1, line_total,
       d.hsn_sac || null, d.tax_pct || 0, d.discount_pct || 0, serviceId]
    );
    const [totals] = await pool.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(line_total),0) as total FROM job_services WHERE job_card_id=?', [jobId]
    );
    await pool.query(
      'UPDATE job_cards SET total_amount=?, balance_due=?-amount_paid WHERE id=?',
      [totals[0].total, totals[0].total, jobId]
    );
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

