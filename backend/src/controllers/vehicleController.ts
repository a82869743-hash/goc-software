import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/** GET /vehicles?customer_id=X — List vehicles for a customer */
export const getVehicles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customer_id } = req.query;
    if (!customer_id) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'customer_id required.' } }); return; }
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM vehicles WHERE customer_id = ? ORDER BY is_primary DESC, created_at DESC', [customer_id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch vehicles.' } });
  }
};

/** GET /vehicles/:id */
export const getVehicleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Vehicle not found.' } }); return; }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch vehicle.' } });
  }
};

/** POST /vehicles — Create */
export const createVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = await generateCode('vehicle');
    const d = req.body;

    // Verify customer exists
    const [cust] = await pool.query<RowDataPacket[]>('SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL', [d.customer_id]);
    if (cust.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Customer not found.' } }); return; }

    // If primary, unset other primaries
    if (d.is_primary) {
      await pool.query('UPDATE vehicles SET is_primary = FALSE WHERE customer_id = ?', [d.customer_id]);
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO vehicles (vehicle_code, customer_id, make, model, year, fuel_type, color, reg_number, vin, is_primary, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, d.customer_id, d.make, d.model, d.year, d.fuel_type || 'petrol', d.color || null, d.reg_number || null, d.vin || null, d.is_primary || false, d.notes || null]
    );
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM vehicles WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create vehicle.' } });
  }
};

/** PUT /vehicles/:id — Update */
export const updateVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Vehicle not found.' } }); return; }

    const d = req.body;
    if (d.is_primary) {
      await pool.query('UPDATE vehicles SET is_primary = FALSE WHERE customer_id = ?', [existing[0].customer_id]);
    }

    const fields: string[] = []; const vals: any[] = [];
    const allowed = ['make', 'model', 'year', 'fuel_type', 'color', 'reg_number', 'vin', 'is_primary', 'notes'];
    for (const f of allowed) { if (d[f] !== undefined) { fields.push(`${f} = ?`); vals.push(d[f]); } }
    if (fields.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields to update.' } }); return; }

    vals.push(req.params.id);
    await pool.query(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to update vehicle.' } });
  }
};

/** DELETE /vehicles/:id — Hard delete */
export const deleteVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM vehicles WHERE id = ?', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Vehicle not found.' } }); return; }
    await pool.query('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Vehicle deleted.' } });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to delete vehicle.' } });
  }
};

/** GET /vehicles/:id/history — Return vehicle service history */
export const getVehicleHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify vehicle exists
    const [vehicle] = await pool.query<RowDataPacket[]>('SELECT id FROM vehicles WHERE id = ?', [id]);
    if (vehicle.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Vehicle not found.' } });
      return;
    }

    // Get all job cards for this vehicle
    const [jobCards] = await pool.query<RowDataPacket[]>(
      `SELECT jc.*, s.full_name as technician_name
       FROM job_cards jc
       LEFT JOIN staff s ON jc.created_by = s.id
       WHERE jc.vehicle_id = ?
       ORDER BY jc.created_at DESC`,
      [id]
    );

    // Get all job services for those job cards
    const jobCardIds = jobCards.map(jc => jc.id);
    let services: RowDataPacket[] = [];
    if (jobCardIds.length > 0) {
      const placeholders = jobCardIds.map(() => '?').join(', ');
      [services] = await pool.query<RowDataPacket[]>(
        `SELECT js.*
         FROM job_services js
         WHERE js.job_card_id IN (${placeholders})`,
        jobCardIds
      );
    }

    // Attach services to each job card
    const jobCardsWithServices = jobCards.map(jc => ({
      ...jc,
      services: services.filter(s => s.job_card_id === jc.id),
    }));

    res.json({
      success: true,
      data: jobCardsWithServices,
    });
  } catch (error) {
    console.error('Get vehicle history error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch vehicle history.' } });
  }
};
