import { Router, Request, Response } from 'express';
import pool from '../utils/db';
import { RowDataPacket } from 'mysql2';
import { ERROR_CODES } from '../utils/constants';

const router = Router();

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Received / Scheduled',
  car_in: 'Car In / Gate Entry',
  washing: 'Washing Bay',
  in_progress: 'Work In Progress',
  qc: 'Quality Control Check',
  rework: 'Undergoing Rework',
  ready: 'Ready for Delivery',
  estimate: 'Estimate Generated',
  delivered: 'Delivered / Dispatched',
  cancelled: 'Cancelled',
  invoiced: 'Invoiced'
};

const REGULAR_STEPS = [
  { key: 'in_progress', label: 'Work In Progress' },
  { key: 'ready', label: 'Ready' },
  { key: 'estimate', label: 'Estimate' },
  { key: 'delivered', label: 'Final Delivered' }
];

const QUICK_STEPS = [
  { key: 'scheduled', label: 'Received' },
  { key: 'car_in', label: 'Car In' },
  { key: 'washing', label: 'Washing' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'qc', label: 'QC' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' }
];

// ─── GET /job-card/:token ──────────────────────────
router.get('/job-card/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    // 1. Try regular job cards first
    const [jcRows] = await pool.query<RowDataPacket[]>(
      `SELECT j.*, c.full_name as owner_name, c.phone as mobile,
              CONCAT(v.make, ' ', v.model) as car_details, v.reg_number
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       WHERE j.public_token = ? AND j.deleted_at IS NULL`,
      [token]
    );

    let source = 'regular';
    let jc = jcRows[0];

    // 2. Try quick job cards if not found
    if (!jc) {
      const [quickRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM quick_job_cards WHERE public_token = ?',
        [token]
      );
      if (quickRows.length > 0) {
        jc = quickRows[0];
        source = 'quick';
      }
    }

    if (!jc) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found' } });
      return;
    }

    // 3. Fetch services
    let services: any[] = [];
    if (source === 'regular') {
      const [svcRows] = await pool.query<RowDataPacket[]>(
        'SELECT service_name, quantity as qty, unit_price as rate, line_total as amount FROM job_services WHERE job_card_id = ?',
        [jc.id]
      );
      services = svcRows;
    } else {
      const [svcRows] = await pool.query<RowDataPacket[]>(
        'SELECT service_name, qty, rate, amount FROM quick_job_card_services WHERE job_card_id = ?',
        [jc.id]
      );
      services = svcRows;
    }

    // 4. Fetch invoice & estimate
    let invoice: any = null;
    let estimate: any = null;

    if (source === 'regular') {
      const [invRows] = await pool.query<RowDataPacket[]>(
        `SELECT invoice_code as invoice_no, subtotal, cgst_amount + sgst_amount as gst_amount, total_amount
         FROM invoices WHERE job_card_id = ? AND invoice_type = 'tax_invoice' AND deleted_at IS NULL`,
        [jc.id]
      );
      invoice = invRows[0] || null;

      const [estRows] = await pool.query<RowDataPacket[]>(
        `SELECT invoice_code as estimate_no, subtotal, total_amount
         FROM invoices WHERE job_card_id = ? AND invoice_type = 'estimate' AND deleted_at IS NULL`,
        [jc.id]
      );
      estimate = estRows[0] || null;
    } else {
      const [invRows] = await pool.query<RowDataPacket[]>(
        'SELECT invoice_no, subtotal, gst_amount, total_amount FROM quick_job_card_invoices WHERE job_card_id = ?',
        [jc.id]
      );
      invoice = invRows[0] || null;

      const [estRows] = await pool.query<RowDataPacket[]>(
        'SELECT estimate_no, subtotal, total_amount FROM quick_job_card_estimates WHERE job_card_id = ?',
        [jc.id]
      );
      estimate = estRows[0] || null;
    }

    // 5. Build status steps
    const steps = source === 'regular' ? REGULAR_STEPS : QUICK_STEPS;
    const stepOrder = steps.map(s => s.key);

    const currentStatus = jc.status;
    let curIdx = stepOrder.indexOf(currentStatus);
    
    // If invoiced, treat as delivered for the progress bar
    if (currentStatus === 'invoiced') {
      curIdx = stepOrder.indexOf('delivered');
    }

    // Backward compatibility for regular job cards with old statuses
    if (source === 'regular' && curIdx === -1) {
      if (['scheduled', 'car_in', 'washing'].includes(currentStatus)) {
        curIdx = 0; // map to Work in Progress
      } else if (['qc', 'rework'].includes(currentStatus)) {
        curIdx = 1; // map to Ready
      }
    }

    const statusSteps = steps.map((s, i) => ({
      ...s,
      done: i <= curIdx,
      current: i === curIdx
    }));

    res.json({
      success: true,
      data: {
        job_no: jc.job_code || jc.job_no,
        owner_name: jc.owner_name,
        reg_no: jc.reg_number || jc.reg_no,
        car_name: jc.car_details || jc.car_name || `${jc.car_make || ''} ${jc.car_model || ''}`.trim() || 'Vehicle',
        status: jc.status,
        status_label: STATUS_LABELS[jc.status] || jc.status,
        created_at: jc.created_at,
        updated_at: jc.updated_at,
        services,
        invoice,
        estimate,
        status_steps: statusSteps,
        source
      }
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: e.message } });
  }
});

export default router;
