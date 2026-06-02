import pool from '../utils/db';
import { RowDataPacket } from 'mysql2';
import path from 'path';
import fs from 'fs';

/**
 * GOC Studio — PDF Generation Service
 * Generates professional Tax Invoices and Quotation PDFs using Puppeteer.
 */

const PDF_DIR = path.resolve(__dirname, '../../../uploads/pdfs');

// Ensure PDF directory exists
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

function getPuppeteerLaunchOptions() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.USERPROFILE}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
  ];
  
  let executablePath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      executablePath = p;
      break;
    }
  }

  const launchOptions: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--single-process'
    ]
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }
  return launchOptions;
}

// ── Shared Styles ───────────────────────────────────────────
const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm 18mm; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #CC0000; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark { width: 50px; height: 50px; background: linear-gradient(135deg, #CC0000, #FF3333); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 800; }
  .brand-text h1 { font-size: 20px; font-weight: 800; color: #CC0000; letter-spacing: 1px; }
  .brand-text p { font-size: 10px; color: #666; margin-top: 2px; }
  .doc-type { text-align: right; }
  .doc-type h2 { font-size: 22px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 2px; }
  .doc-type .doc-number { font-size: 13px; color: #CC0000; font-weight: 600; margin-top: 4px; }
  .doc-type .doc-date { font-size: 11px; color: #666; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .info-box { background: #f8f8f8; border-radius: 8px; padding: 14px 16px; border: 1px solid #e5e5e5; }
  .info-box h3 { font-size: 10px; font-weight: 700; color: #CC0000; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
  .info-label { color: #888; }
  .info-value { font-weight: 500; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { background: #1a1a1a; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; padding: 10px 12px; text-align: left; font-weight: 600; }
  thead th:first-child { border-radius: 6px 0 0 0; }
  thead th:last-child { border-radius: 0 6px 0 0; text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 11px; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody td:last-child { text-align: right; font-weight: 600; }
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-box { width: 280px; background: #f8f8f8; border-radius: 8px; overflow: hidden; border: 1px solid #e5e5e5; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 11px; }
  .totals-row.grand { background: #CC0000; color: white; font-size: 14px; font-weight: 700; padding: 12px 16px; }
  .terms-section { margin-top: 20px; }
  .terms-section h3 { font-size: 11px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .terms-section p, .terms-section li { font-size: 10px; color: #666; line-height: 1.6; }
  .terms-section ul { padding-left: 16px; }
  .footer { position: absolute; bottom: 18mm; left: 18mm; right: 18mm; border-top: 1px solid #e5e5e5; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #999; }
  .stamp-area { text-align: right; margin-top: 32px; }
  .stamp-label { font-size: 10px; color: #888; border-top: 1px dashed #ccc; padding-top: 6px; display: inline-block; min-width: 180px; text-align: center; }
`;

// ── Number to Words (Indian) ────────────────────────────────
function numberToWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n === 0) return 'Zero';
  const num = Math.floor(n);
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
}

function formatCurrency(n: number): string {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── GENERATE INVOICE PDF ────────────────────────────────────
export async function generateInvoicePDF(invoiceId: number): Promise<string> {
  // Fetch invoice data
  const [invoiceRows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
            c.address as customer_address, c.city as customer_city, j.job_code,
            CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number, v.color as vehicle_color
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN job_cards j ON i.job_card_id = j.id
     LEFT JOIN vehicles v ON j.vehicle_id = v.id
     WHERE i.id = ?`, [invoiceId]);

  if (invoiceRows.length === 0) throw new Error('Invoice not found');
  const inv = invoiceRows[0];

  const [items] = await pool.query<RowDataPacket[]>('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

  const studioName = process.env.STUDIO_NAME || 'God of Ceramic';
  const studioAddress = process.env.STUDIO_ADDRESS || 'Near Akshar Chowk, Alkapuri, Vadodara, Gujarat 390007';
  const studioPhone = process.env.STUDIO_PHONE || '+919999999999';
  const studioGstin = process.env.STUDIO_GSTIN || '24XXXXX1234X1ZX';

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><style>${sharedStyles}</style></head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <div class="brand-mark">G</div>
            <div class="brand-text">
              <h1>${studioName.toUpperCase()}</h1>
              <p>${studioAddress}</p>
              <p>Phone: ${studioPhone} | GSTIN: ${studioGstin}</p>
            </div>
          </div>
          <div class="doc-type">
            <h2>${inv.invoice_type === 'tax_invoice' ? 'Tax Invoice' : inv.invoice_type === 'proforma' ? 'Proforma Invoice' : 'Estimate'}</h2>
            <div class="doc-number">${inv.invoice_code}</div>
            <div class="doc-date">Date: ${formatDate(inv.invoice_date)}</div>
            ${inv.due_date ? `<div class="doc-date">Due: ${formatDate(inv.due_date)}</div>` : ''}
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Bill To</h3>
            <div class="info-row"><span class="info-label">Name</span><span class="info-value">${inv.customer_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${inv.customer_phone || '-'}</span></div>
            <div class="info-row"><span class="info-label">Email</span><span class="info-value">${inv.customer_email || '-'}</span></div>
            <div class="info-row"><span class="info-label">Address</span><span class="info-value">${inv.customer_address || '-'}, ${inv.customer_city || ''}</span></div>
            ${inv.customer_gstin ? `<div class="info-row"><span class="info-label">GSTIN</span><span class="info-value">${inv.customer_gstin}</span></div>` : ''}
          </div>
          <div class="info-box">
            <h3>Job Details</h3>
            <div class="info-row"><span class="info-label">Job Card</span><span class="info-value">${inv.job_code || '-'}</span></div>
            <div class="info-row"><span class="info-label">Vehicle</span><span class="info-value">${inv.vehicle_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Reg No.</span><span class="info-value">${inv.reg_number || '-'}</span></div>
            <div class="info-row"><span class="info-label">Color</span><span class="info-value">${inv.vehicle_color || '-'}</span></div>
            <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="text-transform:uppercase">${inv.status}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:5%">#</th>
              <th style="width:35%">Description</th>
              <th style="width:12%">HSN/SAC</th>
              <th style="width:10%">Qty</th>
              <th style="width:8%">Unit</th>
              <th style="width:15%">Rate</th>
              <th style="width:15%">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.description}</td>
                <td>${item.hsn_sac}</td>
                <td>${item.qty}</td>
                <td>${item.unit}</td>
                <td>${formatCurrency(item.rate)}</td>
                <td>${formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(inv.subtotal)}</span></div>
            ${inv.discount_amount > 0 ? `<div class="totals-row"><span>Discount</span><span>- ${formatCurrency(inv.discount_amount)}</span></div>` : ''}
            <div class="totals-row"><span>Taxable Amount</span><span>${formatCurrency(inv.taxable_amount)}</span></div>
            ${inv.apply_gst ? `
              <div class="totals-row"><span>CGST @ ${inv.cgst_rate}%</span><span>${formatCurrency(inv.cgst_amount)}</span></div>
              <div class="totals-row"><span>SGST @ ${inv.sgst_rate}%</span><span>${formatCurrency(inv.sgst_amount)}</span></div>
            ` : ''}
            <div class="totals-row grand"><span>Grand Total</span><span>${formatCurrency(inv.total_amount)}</span></div>
          </div>
        </div>

        <p style="font-size:10px; color:#666; font-style:italic; margin-bottom: 16px;">
          Amount in words: <strong>${numberToWords(inv.total_amount)} Rupees Only</strong>
        </p>

        ${inv.amount_paid > 0 ? `
        <div style="background:#eafbea; border:1px solid #4caf50; border-radius:6px; padding:8px 14px; margin-bottom:16px; font-size:11px;">
          <strong>Payment Received:</strong> ${formatCurrency(inv.amount_paid)} | 
          <strong>Balance Due:</strong> ${formatCurrency(inv.balance_due)}
        </div>` : ''}

        <div class="terms-section">
          <h3>Terms & Conditions</h3>
          <ul>
            <li>Payment is due within 7 days from the invoice date.</li>
            <li>All services are covered under our standard warranty policy.</li>
            <li>For queries, contact us at ${studioPhone}.</li>
            ${inv.notes ? `<li>${inv.notes}</li>` : ''}
          </ul>
        </div>

        <div class="stamp-area">
          <div class="stamp-label">Authorized Signatory<br/>${studioName}</div>
        </div>

        <div class="footer">
          <span>This is a computer-generated document. No signature is required.</span>
          <span>${studioName} | ${studioPhone}</span>
        </div>
      </div>
    </body></html>
  `;

  // Write HTML and generate PDF using puppeteer
  const fileName = `invoice_${inv.invoice_code.replace(/\//g, '-')}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  try {
    const puppeteer = await import('puppeteer');
    const launchFn = puppeteer.default?.launch || puppeteer.launch;
    const browser = await launchFn(getPuppeteerLaunchOptions());
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
  } catch (err) {
    // Fallback: save HTML if puppeteer fails
    console.warn('Puppeteer not available, saving HTML fallback:', err);
    const htmlFileName = fileName.replace('.pdf', '.html');
    const htmlPath = path.join(PDF_DIR, htmlFileName);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    const pdfUrl = `/uploads/pdfs/${htmlFileName}`;
    await pool.query('UPDATE invoices SET pdf_url = ? WHERE id = ?', [pdfUrl, invoiceId]);
    return pdfUrl;
  }

  const pdfUrl = `/uploads/pdfs/${fileName}`;
  await pool.query('UPDATE invoices SET pdf_url = ? WHERE id = ?', [pdfUrl, invoiceId]);
  return pdfUrl;
}

// ── GENERATE QUOTATION PDF ──────────────────────────────────
export async function generateQuotationPDF(quotationId: number): Promise<string> {
  const [quotationRows] = await pool.query<RowDataPacket[]>(
    `SELECT q.*, c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
            c.address as customer_address, c.city as customer_city,
            CONCAT(v.make, ' ', v.model) as vehicle_name, v.reg_number, v.color as vehicle_color
     FROM quotations q
     LEFT JOIN customers c ON q.customer_id = c.id
     LEFT JOIN vehicles v ON q.vehicle_id = v.id
     WHERE q.id = ?`, [quotationId]);

  if (quotationRows.length === 0) throw new Error('Quotation not found');
  const qt = quotationRows[0];

  const [zones] = await pool.query<RowDataPacket[]>('SELECT * FROM quotation_zones WHERE quotation_id = ?', [quotationId]);

  const studioName = process.env.STUDIO_NAME || 'God of Ceramic';
  const studioAddress = process.env.STUDIO_ADDRESS || 'Near Akshar Chowk, Alkapuri, Vadodara, Gujarat 390007';
  const studioPhone = process.env.STUDIO_PHONE || '+919999999999';

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><style>${sharedStyles}
      .zone-card { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px; padding: 8px 12px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
      .zone-name { font-weight: 600; color: #1a1a1a; }
      .zone-detail { color: #666; font-size: 10px; }
      .validity-badge { display: inline-block; background: #fff3cd; color: #856404; border: 1px solid #ffc107; border-radius: 4px; padding: 4px 10px; font-size: 10px; font-weight: 600; }
    </style></head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <div class="brand-mark">G</div>
            <div class="brand-text">
              <h1>${studioName.toUpperCase()}</h1>
              <p>${studioAddress}</p>
              <p>Phone: ${studioPhone}</p>
            </div>
          </div>
          <div class="doc-type">
            <h2>Quotation</h2>
            <div class="doc-number">${qt.quotation_code}</div>
            <div class="doc-date">Date: ${formatDate(qt.created_at)}</div>
            <div style="margin-top:6px;">
              <span class="validity-badge">Valid Until: ${formatDate(qt.valid_until)}</span>
            </div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Prepared For</h3>
            <div class="info-row"><span class="info-label">Name</span><span class="info-value">${qt.customer_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${qt.customer_phone || '-'}</span></div>
            <div class="info-row"><span class="info-label">Email</span><span class="info-value">${qt.customer_email || '-'}</span></div>
            <div class="info-row"><span class="info-label">Address</span><span class="info-value">${qt.customer_address || '-'}, ${qt.customer_city || ''}</span></div>
          </div>
          <div class="info-box">
            <h3>Vehicle Details</h3>
            <div class="info-row"><span class="info-label">Vehicle</span><span class="info-value">${qt.vehicle_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Reg No.</span><span class="info-value">${qt.reg_number || '-'}</span></div>
            <div class="info-row"><span class="info-label">Color</span><span class="info-value">${qt.vehicle_color || '-'}</span></div>
            <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="text-transform:uppercase">${qt.status}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:5%">#</th>
              <th style="width:25%">Zone</th>
              <th style="width:15%">Material</th>
              <th style="width:15%">Grade</th>
              <th style="width:10%">Sq.Ft</th>
              <th style="width:15%">Rate/Sqft</th>
              <th style="width:15%">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${zones.map((z: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${z.zone_label}</td>
                <td>${z.material_brand || '-'}</td>
                <td>${z.material_grade || '-'}</td>
                <td>${z.sqft}</td>
                <td>${formatCurrency(z.rate_per_sqft)}</td>
                <td>${formatCurrency(z.line_total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(qt.subtotal)}</span></div>
            ${qt.discount_amount > 0 ? `<div class="totals-row"><span>Discount${qt.discount_type === 'percentage' ? ' (' + qt.discount_value + '%)' : ''}</span><span>- ${formatCurrency(qt.discount_amount)}</span></div>` : ''}
            ${qt.apply_gst ? `<div class="totals-row"><span>GST @ 18%</span><span>${formatCurrency(qt.gst_amount)}</span></div>` : ''}
            <div class="totals-row grand"><span>Grand Total</span><span>${formatCurrency(qt.grand_total)}</span></div>
          </div>
        </div>

        <p style="font-size:10px; color:#666; font-style:italic; margin-bottom: 16px;">
          Amount in words: <strong>${numberToWords(qt.grand_total)} Rupees Only</strong>
        </p>

        <div class="terms-section">
          <h3>Terms & Conditions</h3>
          <ul>
            <li>This quotation is valid until ${formatDate(qt.valid_until)}.</li>
            <li>50% advance payment required at the time of booking.</li>
            <li>PPF warranty: Brand standard warranty applicable.</li>
            <li>Ceramic coating warranty: As per package selected.</li>
            <li>Estimated completion: 3–5 working days (subject to vehicle condition).</li>
            ${qt.terms ? `<li>${qt.terms}</li>` : ''}
            ${qt.notes ? `<li>Note: ${qt.notes}</li>` : ''}
          </ul>
        </div>

        <div class="stamp-area">
          <div class="stamp-label">Authorized Signatory<br/>${studioName}</div>
        </div>

        <div class="footer">
          <span>This is a computer-generated document.</span>
          <span>${studioName} | ${studioPhone}</span>
        </div>
      </div>
    </body></html>
  `;

  const fileName = `quotation_${qt.quotation_code}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  try {
    const puppeteer = await import('puppeteer');
    const launchFn = puppeteer.default?.launch || puppeteer.launch;
    const browser = await launchFn(getPuppeteerLaunchOptions());
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
  } catch (err) {
    console.warn('Puppeteer not available, saving HTML fallback:', err);
    const htmlFileName = fileName.replace('.pdf', '.html');
    const htmlPath = path.join(PDF_DIR, htmlFileName);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    const pdfUrl = `/uploads/pdfs/${htmlFileName}`;
    await pool.query('UPDATE quotations SET pdf_url = ? WHERE id = ?', [pdfUrl, quotationId]);
    return pdfUrl;
  }

  const pdfUrl = `/uploads/pdfs/${fileName}`;
  await pool.query('UPDATE quotations SET pdf_url = ? WHERE id = ?', [pdfUrl, quotationId]);
  return pdfUrl;
}
