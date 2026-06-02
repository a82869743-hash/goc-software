import { Request, Response } from 'express';
import pool from '../utils/db';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket } from 'mysql2';

/**
 * Get all settings as key-value pairs
 */
export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT setting_key, setting_value, description FROM app_settings ORDER BY setting_key');
    // Convert to map
    const settings: Record<string, { value: string; description: string }> = {};
    for (const r of rows) { settings[r.setting_key] = { value: r.setting_value, description: r.description }; }
    res.json({ success: true, data: settings });
  } catch (error) { console.error('Get settings error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Update a single setting (upsert)
 */
export const updateSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Key and value required.' } }); return; }
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = COALESCE(VALUES(description), description)`,
      [key, String(value), description || null]);
    res.json({ success: true, data: { key, value: String(value) } });
  } catch (error) { console.error('Update setting error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/**
 * Batch update settings
 */
export const batchUpdateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const entries = req.body.settings;
    if (!Array.isArray(entries) || entries.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Settings array required.' } }); return; }
    for (const { key, value, description } of entries) {
      if (!key || value === undefined) continue;
      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = COALESCE(VALUES(description), description)`,
        [key, String(value), description || null]);
    }
    res.json({ success: true, data: { message: `${entries.length} settings updated.` } });
  } catch (error) { console.error('Batch settings error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};
