

import { Router, Request, Response } from 'express';
import { getJobCards, getJobCardById, createJobCard, updateJobCard, updateJobStatus, addJobService, deleteJobService, deleteJobCard, getPipelineSummary } from '../controllers/jobCardController';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate, validateQuery } from '../middleware/validate';
import { createJobCardSchema, updateJobCardSchema, updateJobStatusSchema, addJobServiceSchema, jobFiltersSchema } from '../validations/jobCardValidation';
import { uploadPhoto } from '../middleware/upload';
import pool from '../utils/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ERROR_CODES } from '../utils/constants';
import { generateInvoicePDF } from '../services/pdfService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

router.use(authMiddleware);

// Pipeline summary (before /:id)
router.get('/pipeline', getPipelineSummary);

// ─── New Job Card v2 Routes ────────────────────────────────
import {
  searchServiceCatalog,
  getServiceCatalogCategories,
  completeJob,
  updateJobService,
  dispatchJobCard
} from '../controllers/jobCardController';

// Service catalog (before /:id)
router.get('/service-catalog', searchServiceCatalog);
router.get('/service-catalog/categories', getServiceCatalogCategories);

// List
router.get('/concern-presets', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM concern_presets WHERE is_active=1 ORDER BY sort_order`
    );
    res.json({ success: true, data: rows });
  } catch(e) {
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Server error' } });
  }
});

router.get('/:id/invoice-data', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Fetch job card
    const [jc] = await pool.query<RowDataPacket[]>(
      `SELECT j.*, c.full_name as customer_name, c.phone as customer_phone,
              CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number
       FROM job_cards j
       LEFT JOIN customers c ON j.customer_id = c.id
       LEFT JOIN vehicles v ON j.vehicle_id = v.id
       WHERE j.id = ? AND j.deleted_at IS NULL`, [id]
    );
    if (jc.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Not found' } });
      return;
    }
    // Fetch services
    const [services] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM job_services WHERE job_card_id = ?`, [id]
    );
    
    // Fetch invoice (tax_invoice)
    const [invoices] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM invoices WHERE job_card_id = ? AND invoice_type = 'tax_invoice' AND deleted_at IS NULL ORDER BY id DESC`, [id]
    );
    
    // Fetch estimate (estimate)
    const [estimates] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM invoices WHERE job_card_id = ? AND invoice_type = 'estimate' AND deleted_at IS NULL ORDER BY id DESC`, [id]
    );
    
    // Fetch concerns
    const [concerns] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM customer_concerns WHERE job_card_id = ?`, [id]
    );
    
    res.json({
      success: true,
      data: {
        jobCard: jc[0],
        services,
        invoice: invoices[0] || null,
        estimate: estimates[0] || null,
        concerns
      }
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Server error' } });
  }
});

router.get('/', validateQuery(jobFiltersSchema), getJobCards);

router.get('/:id', getJobCardById);

// Create
router.post('/', validate(createJobCardSchema), createJobCard);

// Update details
router.put('/:id', validate(updateJobCardSchema), updateJobCard);

// Status transition
router.patch('/:id/status', validate(updateJobStatusSchema), updateJobStatus);

// Services
router.post('/:id/services', validate(addJobServiceSchema), addJobService);
router.delete('/:id/services/:serviceId', deleteJobService);

// ─── Photo Upload ─────────────────────────────────
router.post('/:id/photos', uploadPhoto.array('photos', 10), async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.id;
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM job_cards WHERE id = ? AND deleted_at IS NULL', [jobId]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Job card not found.' } }); return; }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No photos uploaded.' } }); return; }

    const staffId = (req as any).staff?.id;
    const stage = req.body.stage || 'before';

    for (const file of files) {
      const photoUrl = `/uploads/photos/${file.filename}`;
      await pool.query<ResultSetHeader>(
        'INSERT INTO job_photos (job_card_id, file_url, stage, uploaded_by) VALUES (?, ?, ?, ?)',
        [jobId, photoUrl, stage, staffId]
      );
    }

    const [photos] = await pool.query<RowDataPacket[]>('SELECT * FROM job_photos WHERE job_card_id = ? ORDER BY created_at DESC', [jobId]);
    res.status(201).json({ success: true, data: photos });
  } catch (error) {
    console.error('Upload photos error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to upload photos.' } });
  }
});

// ─── List Photos ──────────────────────────────────
router.get('/:id/photos', async (req: Request, res: Response): Promise<void> => {
  try {
    const [photos] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM job_photos WHERE job_card_id = ? ORDER BY stage ASC, created_at ASC', [req.params.id]
    );
    res.json({ success: true, data: photos });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch photos.' } });
  }
});

// ─── Invoice HTML (for PDF download) ──────────────
router.get('/:id/invoice-html', async (req: Request, res: Response): Promise<void> => {
  try {
    // Find the latest invoice for this job card
    const [invoices] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM invoices WHERE job_card_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1', [req.params.id]
    );
    if (invoices.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'No invoice found for this job card.' } }); return; }

    const pdfUrl = await generateInvoicePDF(invoices[0].id);
    res.json({ success: true, data: { pdf_url: pdfUrl } });
  } catch (error) {
    console.error('Invoice HTML error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to generate invoice.' } });
  }
});

// Complete job (create invoice/estimate)
router.post('/:id/complete', completeJob);

// Update service line item
router.put('/:id/services/:serviceId', updateJobService);

// Dispatch bill via WhatsApp/SMS
router.post('/:id/dispatch', dispatchJobCard);

// Delete job card — admin only
router.delete('/:id', rbac('admin'), deleteJobCard);

// ─── Job Card Media Upload Setup ──────────────────
const mediaUploadDir = path.resolve(__dirname, '../../../uploads/job-media');
if (!fs.existsSync(mediaUploadDir)) {
  fs.mkdirSync(mediaUploadDir, { recursive: true });
}

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, mediaUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|mp4|mov|avi|mkv/;
    cb(null, ok.test(path.extname(file.originalname).toLowerCase()));
  }
});

router.post('/:id/media', mediaUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { media_type } = req.body;
    if (!['before_image', 'during_image', 'after_image', 'qc_image', 'video'].includes(media_type)) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid media_type' } });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No file uploaded' } });
      return;
    }
    const file_path = `/uploads/job-media/${req.file.filename}`;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO job_card_media (job_card_id, job_type, media_type, file_path, original_name, file_size)
       VALUES (?, 'regular', ?, ?, ?, ?)`,
      [id, media_type, file_path, req.file.originalname, req.file.size]
    );
    res.json({ success: true, data: { id: result.insertId, file_path, message: 'Uploaded' } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Upload failed' } });
  }
});

router.post('/:id/media/:mediaId/rotate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, mediaId } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT rotation FROM job_card_media WHERE id=? AND job_card_id=? AND job_type='regular'`,
      [mediaId, id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Media item not found' } });
      return;
    }
    const newRotation = ((rows[0].rotation || 0) + 90) % 360;
    await pool.query(
      `UPDATE job_card_media SET rotation=? WHERE id=? AND job_card_id=? AND job_type='regular'`,
      [newRotation, mediaId, id]
    );
    res.json({ success: true, data: { rotation: newRotation, message: 'Rotated successfully' } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Rotation failed' } });
  }
});

router.get('/:id/media', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM job_card_media WHERE job_card_id=? AND job_type='regular' ORDER BY uploaded_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Server error' } });
  }
});

router.delete('/:id/media/:mediaId', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM job_card_media WHERE id=? AND job_card_id=? AND job_type='regular'`,
      [req.params.mediaId, req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Not found' } });
      return;
    }
    const full = path.resolve(__dirname, '../../../', rows[0].file_path.substring(1));
    if (fs.existsSync(full)) fs.unlinkSync(full);
    await pool.query(`DELETE FROM job_card_media WHERE id=?`, [req.params.mediaId]);
    res.json({ success: true, data: { message: 'Deleted' } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Server error' } });
  }
});

// ─── Certificate Upload ────────────────────────────
router.post('/:id/certificate', mediaUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No file uploaded' } });
      return;
    }
    const file_path = `/uploads/job-media/${req.file.filename}`;
    await pool.query('UPDATE job_cards SET certificate_url = ? WHERE id = ?', [file_path, id]);
    res.json({ success: true, data: { certificate_url: file_path, message: 'Certificate uploaded successfully' } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Certificate upload failed' } });
  }
});

export default router;
