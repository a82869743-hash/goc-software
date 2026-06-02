import pool from './db';
import { RowDataPacket } from 'mysql2';

/**
 * GOC Code Generator
 * Generates sequential codes like GOC-CUST-0001, GOC-LEAD-0001, etc.
 */

interface CodeConfig {
  table: string;
  column: string;
  prefix: string;
  padLength: number;
}

const CODE_CONFIGS: Record<string, CodeConfig> = {
  customer: { table: 'customers', column: 'customer_code', prefix: 'GOC-CUST-', padLength: 4 },
  vehicle: { table: 'vehicles', column: 'vehicle_code', prefix: 'GOC-VEH-', padLength: 4 },
  lead: { table: 'leads', column: 'lead_code', prefix: 'GOC-LEAD-', padLength: 4 },
  booking: { table: 'bookings', column: 'booking_code', prefix: 'GOC-BKG-', padLength: 4 },
  job: { table: 'job_cards', column: 'job_code', prefix: 'GOC-JC-', padLength: 4 },
  quotation: { table: 'quotations', column: 'quotation_code', prefix: 'GOC-QT-', padLength: 4 },
  inventory: { table: 'inventory_items', column: 'item_code', prefix: 'GOC-MAT-', padLength: 4 },
  staff: { table: 'staff', column: 'staff_code', prefix: 'GOC-STF-', padLength: 2 },
};

export const generateCode = async (type: keyof typeof CODE_CONFIGS): Promise<string> => {
  const config = CODE_CONFIGS[type];
  if (!config) {
    throw new Error(`Unknown code type: ${type}`);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${config.column} FROM ${config.table} ORDER BY id DESC LIMIT 1`
  );

  let nextNum = 1;
  if (rows.length > 0) {
    const lastCode = rows[0][config.column] as string;
    const lastNum = parseInt(lastCode.replace(config.prefix, ''), 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${config.prefix}${String(nextNum).padStart(config.padLength, '0')}`;
};

/**
 * Invoice code is special — resets per financial year: GOC-INV-2526-0001
 */
export const generateInvoiceCode = async (): Promise<string> => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  // Financial year starts in April (month 4)
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const fyCode = `${String(fyStart).slice(2)}${String(fyEnd).slice(2)}`;
  const prefix = `GOC-INV-${fyCode}-`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT invoice_code FROM invoices WHERE invoice_code LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (rows.length > 0) {
    const lastCode = rows[0].invoice_code as string;
    const lastNum = parseInt(lastCode.replace(prefix, ''), 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
};
