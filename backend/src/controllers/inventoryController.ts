import { Request, Response } from 'express';
import pool from '../utils/db';
import { generateCode } from '../utils/codes';
import { ERROR_CODES } from '../utils/constants';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── LIST ─────────────────────────────────────────
export const getInventoryItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, low_stock, search, page = 1, limit = 20 } = req.query as any;
    const conds: string[] = ['i.deleted_at IS NULL'];
    const params: any[] = [];
    if (category) { conds.push('i.category = ?'); params.push(category); }
    if (low_stock === 'true' || low_stock === '1') { conds.push('i.current_stock <= i.min_threshold'); }
    if (search) { conds.push('(i.name LIKE ? OR i.item_code LIKE ? OR i.brand LIKE ?)'); const t = `%${search}%`; params.push(t, t, t); }
    const where = conds.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const [countR] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM inventory_items i WHERE ${where}`, params);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.*, (i.current_stock <= i.min_threshold) as is_low_stock
       FROM inventory_items i WHERE ${where} ORDER BY i.id DESC LIMIT ? OFFSET ?`, [...params, Number(limit), offset]);

    res.json({ success: true, data: rows, meta: { total: countR[0].total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(countR[0].total / Number(limit)) } });
  } catch (error) { console.error('Get inventory error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch inventory.' } }); }
};

// ─── GET BY ID ────────────────────────────────────
export const getInventoryItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Item not found.' } }); return; }
    // Get recent usage history
    const [usage] = await pool.query<RowDataPacket[]>(
      `SELECT iu.*, s.full_name as staff_name, j.job_code
       FROM inventory_usage iu LEFT JOIN staff s ON iu.used_by = s.id LEFT JOIN job_cards j ON iu.job_card_id = j.id
       WHERE iu.inventory_item_id = ? ORDER BY iu.created_at DESC LIMIT 20`, [req.params.id]);
    res.json({ success: true, data: { ...rows[0], usage } });
  } catch (error) { console.error('Get inventory item error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── CREATE ───────────────────────────────────────
export const createInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = await generateCode('inventory');
    const d = req.body;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO inventory_items (item_code, name, category, brand, unit, current_stock, min_threshold, purchase_price, selling_price, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, d.name, d.category, d.brand || null, d.unit, d.current_stock || 0, d.min_threshold || 10, d.purchase_price || 0, d.selling_price || 0, d.location || null, d.notes || null]);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) { console.error('Create inventory error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to create item.' } }); }
};

// ─── UPDATE ───────────────────────────────────────
export const updateInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM inventory_items WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Item not found.' } }); return; }
    const d = req.body;
    const fields: string[] = []; const vals: any[] = [];
    const simple = ['name', 'category', 'brand', 'unit', 'current_stock', 'min_threshold', 'purchase_price', 'selling_price', 'location', 'notes'];
    for (const f of simple) { if (d[f] !== undefined) { fields.push(`${f} = ?`); vals.push(d[f]); } }
    if (fields.length === 0) { res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'No fields.' } }); return; }
    vals.push(req.params.id);
    await pool.query(`UPDATE inventory_items SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) { console.error('Update inventory error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── DELETE ───────────────────────────────────────
export const deleteInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM inventory_items WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Item not found.' } }); return; }
    await pool.query('UPDATE inventory_items SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Item deleted.' } });
  } catch (error) { console.error('Delete inventory error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── LOG USAGE ────────────────────────────────────
export const logUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const d = req.body;
    const staffId = (req as any).staff?.id;
    const [item] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ? AND deleted_at IS NULL', [d.inventory_item_id]);
    if (item.length === 0) { res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Item not found.' } }); return; }
    const totalDeducted = d.qty_used + (d.wastage_qty || 0);
    await pool.query(
      'INSERT INTO inventory_usage (inventory_item_id, job_card_id, qty_used, wastage_qty, total_deducted, used_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [d.inventory_item_id, d.job_card_id || null, d.qty_used, d.wastage_qty || 0, totalDeducted, staffId, d.notes || null]);
    // Deduct from stock
    await pool.query('UPDATE inventory_items SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?', [totalDeducted, d.inventory_item_id]);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ?', [d.inventory_item_id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) { console.error('Log usage error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

// ─── SUMMARY ──────────────────────────────────────
export const getInventorySummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [cats] = await pool.query<RowDataPacket[]>(
      `SELECT category, COUNT(*) as count, COALESCE(SUM(current_stock * purchase_price), 0) as value
       FROM inventory_items WHERE deleted_at IS NULL GROUP BY category`);
    const [low] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM inventory_items WHERE deleted_at IS NULL AND current_stock <= min_threshold');
    res.json({ success: true, data: { categories: cats, low_stock_count: low[0].count } });
  } catch (error) { console.error('Inventory summary error:', error); res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed.' } }); }
};

/** GET /inventory/reorder-suggestions — Get reorder suggestions based on consumption rate */
export const getReorderSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const [items] = await pool.query<RowDataPacket[]>(
      'SELECT id, item_code, name, category, current_stock, min_threshold, purchase_price FROM inventory_items WHERE deleted_at IS NULL'
    );

    const [usage] = await pool.query<RowDataPacket[]>(
      `SELECT inventory_item_id, COALESCE(SUM(qty_used), 0) as total_used
       FROM inventory_usage
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY inventory_item_id`
    );

    const usageMap: Record<number, number> = {};
    for (const u of usage) {
      usageMap[u.inventory_item_id] = Number(u.total_used);
    }

    const suggestions = items.map((item) => {
      const totalUsed30Days = usageMap[item.id] || 0;
      const dailyConsumption = totalUsed30Days / 30;
      const daysLeft = dailyConsumption > 0 ? Number(item.current_stock) / dailyConsumption : 999;

      let recommendReorder = false;
      let reason = '';
      let suggestedQty = 0;

      if (Number(item.current_stock) <= Number(item.min_threshold)) {
        recommendReorder = true;
        reason = `Stock is below safety threshold (${item.current_stock} <= ${item.min_threshold}).`;
        suggestedQty = Math.max(50, Number(item.min_threshold) * 2 - Number(item.current_stock));
      } else if (daysLeft <= 7) {
        recommendReorder = true;
        reason = `High consumption rate. Projected stock out in ${daysLeft.toFixed(1)} days.`;
        suggestedQty = Math.max(50, Math.round(dailyConsumption * 30));
      }

      return {
        id: item.id,
        item_code: item.item_code,
        name: item.name,
        category: item.category,
        current_stock: Number(item.current_stock),
        min_threshold: Number(item.min_threshold),
        daily_consumption: +dailyConsumption.toFixed(2),
        days_left: daysLeft === 999 ? 'No usage' : +daysLeft.toFixed(1),
        recommend_reorder: recommendReorder,
        reason,
        suggested_qty: Math.round(suggestedQty),
        estimated_cost: +(Math.round(suggestedQty) * Number(item.purchase_price)).toFixed(2),
      };
    });

    res.json({
      success: true,
      data: suggestions.filter((s) => s.recommend_reorder),
    });
  } catch (error) {
    console.error('Get reorder suggestions error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch reorder suggestions.' } });
  }
};

/** POST /inventory/purchase — Record new stock purchase */
export const recordPurchase = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { inventory_item_id, qty_added, purchase_price, supplier, purchase_date, notes } = req.body;

    if (!inventory_item_id || !qty_added || !purchase_price || !purchase_date) {
      res.status(400).json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'inventory_item_id, qty_added, purchase_price, and purchase_date are required.' } });
      connection.release();
      return;
    }

    const [item] = await connection.query<RowDataPacket[]>(
      'SELECT id, current_stock FROM inventory_items WHERE id = ? AND deleted_at IS NULL',
      [inventory_item_id]
    );
    if (item.length === 0) {
      res.status(404).json({ success: false, error: { code: ERROR_CODES.NOT_FOUND, message: 'Inventory item not found.' } });
      connection.release();
      return;
    }

    await connection.query(
      `INSERT INTO inventory_purchases (inventory_item_id, qty_added, purchase_price, supplier, purchase_date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [inventory_item_id, qty_added, purchase_price, supplier || null, purchase_date, notes || null]
    );

    await connection.query(
      `UPDATE inventory_items
       SET current_stock = current_stock + ?, purchase_price = ?
       WHERE id = ?`,
      [qty_added, purchase_price, inventory_item_id]
    );

    await connection.commit();

    const [updated] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM inventory_items WHERE id = ?', [inventory_item_id]
    );

    res.status(201).json({
      success: true,
      data: updated[0],
    });
  } catch (error) {
    await connection.rollback();
    console.error('Record purchase error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to record purchase.' } });
  } finally {
    connection.release();
  }
};

/** GET /inventory/purchases — List all stock purchases */
export const getPurchaseHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { item_id } = req.query;

    let query = `
      SELECT ip.*, ii.name as item_name, ii.item_code, ii.category
      FROM inventory_purchases ip
      JOIN inventory_items ii ON ip.inventory_item_id = ii.id
    `;
    const params: any[] = [];

    if (item_id) {
      query += ' WHERE ip.inventory_item_id = ?';
      params.push(item_id);
    }

    query += ' ORDER BY ip.purchase_date DESC, ip.created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get purchase history error:', error);
    res.status(500).json({ success: false, error: { code: ERROR_CODES.SERVER_ERROR, message: 'Failed to fetch purchase history.' } });
  }
};
