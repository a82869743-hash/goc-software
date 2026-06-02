import React from 'react';

export interface InvoiceTemplateProps {
  jobCard: {
    job_no: string;
    reg_no: string;
    car_name?: string;
    car_make?: string;
    car_model?: string;
    owner_name: string;
    mobile?: string;
    insurance_company?: string;
    insurance_expiry?: string;
    km_reading?: number;
    created_at: string;
  };
  customer?: {
    customer_name?: string;
    mobile_no?: string;
    email?: string;
    gstin?: string;
    company_name?: string;
  };
  services: Array<{
    service_name: string;
    hsn_sac?: string;
    qty: number;
    rate: number;
    amount: number;
    tax_pct?: number;
  }>;
  invoice?: {
    invoice_no: string;
    subtotal: number;
    gst_amount: number;
    total_amount: number;
    payment_mode?: string;
    created_at?: string;
    cgst_rate?: number;
    cgst_amount?: number;
    sgst_rate?: number;
    sgst_amount?: number;
  };
  estimate?: {
    estimate_no: string;
    subtotal: number;
    total_amount: number;
    payment_mode?: string;
  };
  concerns?: Array<{ concern_text: string }>;
  type: 'invoice' | 'estimate';
  source?: 'regular' | 'quick';
  studioName?: string;
  studioAddress?: string;
  studioPhone?: string;
  studioGstin?: string;
}

export function numberToWords(num: number): string {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.floor(num);
  if (n === 0) return 'Zero Rupees Only';

  const g = (amount: number, suffix: string) => {
    if (amount === 0) return '';
    let temp = '';
    if (amount > 19) {
      temp += b[Math.floor(amount / 10)] + ' ' + a[amount % 10];
    } else {
      temp += a[amount];
    }
    return temp + suffix + ' ';
  };

  let words = '';
  // Crores
  words += g(Math.floor(n / 10000000), 'Crore');
  // Lakhs
  words += g(Math.floor((n / 100000) % 100), 'Lakh');
  // Thousands
  words += g(Math.floor((n / 1000) % 100), 'Thousand');
  // Hundreds
  words += g(Math.floor((n / 100) % 10), 'Hundred');
  // Tens and ones
  const rem = n % 100;
  if (rem > 0) {
    if (words !== '') words += 'and ';
    if (rem > 19) {
      words += b[Math.floor(rem / 10)] + ' ' + a[rem % 10];
    } else {
      words += a[rem];
    }
  }

  return (words.trim() + ' Rupees Only').replace(/\s+/g, ' ');
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(n);
}

export default function InvoiceTemplate({
  jobCard,
  customer,
  services,
  invoice,
  estimate,
  concerns = [],
  type,
  source = 'regular',
  studioName = 'God of Ceramic',
  studioAddress = 'Near Akshar Chowk, Alkapuri, Vadodara, Gujarat 390007',
  studioPhone = '+919999999999',
  studioGstin = '24XXXXX1234X1ZX'
}: InvoiceTemplateProps) {
  const isInvoice = type === 'invoice';
  const docNo = isInvoice ? (invoice?.invoice_no || '—') : (estimate?.estimate_no || '—');
  const docDate = isInvoice ? (invoice?.created_at || jobCard.created_at) : jobCard.created_at;
  const paymentMode = isInvoice ? (invoice?.payment_mode || 'cash') : (estimate?.payment_mode || 'cash');

  const subtotalVal = isInvoice ? (invoice?.subtotal || 0) : (estimate?.subtotal || 0);
  const gstVal = isInvoice ? (invoice?.gst_amount || 0) : 0;
  const totalVal = isInvoice ? (invoice?.total_amount || 0) : (estimate?.total_amount || 0);

  const carName = jobCard.car_name || `${jobCard.car_make || ''} ${jobCard.car_model || ''}`.trim() || '—';

  return (
    <div
      style={{
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
        color: '#1a1a1a',
        backgroundColor: '#ffffff',
        padding: '30px',
        maxWidth: '850px',
        margin: '0 auto',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
    >
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
        @page {
          size: A4;
          margin: 15mm;
        }
      `}</style>

      {/* TOP HEADER BLOCK */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #CC0000', paddingBottom: '20px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '36px', height: '36px', backgroundColor: '#000000', borderRadius: '4px', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '20px', fontFamily: 'monospace' }}>G</span>
            </div>
            <span style={{ fontWeight: 900, fontSize: '24px', letterSpacing: '-0.5px', textTransform: 'uppercase', color: '#000000' }}>
              {studioName}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.5', fontFamily: 'monospace' }}>
            {studioAddress}<br />
            Phone: {studioPhone}<br />
            {studioGstin ? `GSTIN: ${studioGstin}` : ''}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', color: '#CC0000', letterSpacing: '-0.5px' }}>
            {isInvoice ? 'TAX INVOICE' : 'ESTIMATE'}
          </h1>
          <div style={{ display: 'inline-block', backgroundColor: '#000000', color: '#ffffff', padding: '6px 12px', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', borderRadius: '3px' }}>
            No: <span style={{ color: '#ff4d4d' }}>{docNo}</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#4b5563', fontFamily: 'monospace' }}>
            Date: {formatDate(docDate)}
          </div>
        </div>
      </div>

      {/* CUSTOMER & VEHICLE DETAILS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px', marginBottom: '20px' }}>
        <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '20px' }}>
          <h2 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', margin: '0 0 10px 0', fontWeight: 'bold' }}>
            BILL TO:
          </h2>
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '16px' }}>
              {customer?.customer_name || jobCard.owner_name}
            </p>
            <p style={{ margin: '0 0 4px 0', fontFamily: 'monospace', color: '#4b5563' }}>
              Phone: {customer?.mobile_no || jobCard.mobile || '—'}
            </p>
            {customer?.email && (
              <p style={{ margin: '0 0 4px 0', fontFamily: 'monospace', color: '#4b5563' }}>
                Email: {customer.email}
              </p>
            )}
            {customer?.gstin && (
              <p style={{ margin: '0 0 4px 0', fontFamily: 'monospace', color: '#CC0000', fontWeight: 'bold' }}>
                GSTIN: {customer.gstin}
              </p>
            )}
          </div>
        </div>

        <div style={{ paddingLeft: '10px' }}>
          <h2 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', margin: '0 0 10px 0', fontWeight: 'bold' }}>
            VEHICLE DETAILS:
          </h2>
          <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Reg No:</span>
              <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{jobCard.reg_no}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Vehicle:</span>
              <span style={{ fontWeight: 'bold' }}>{carName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Job No:</span>
              <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{jobCard.job_no}</span>
            </div>
            {jobCard.km_reading !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>KM Reading:</span>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{jobCard.km_reading.toLocaleString()} km</span>
              </div>
            )}
            {jobCard.insurance_company && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Insurance:</span>
                <span style={{ fontWeight: 'bold' }}>
                  {jobCard.insurance_company} {jobCard.insurance_expiry ? `(Exp: ${formatDate(jobCard.insurance_expiry)})` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CUSTOMER CONCERNS (IF ANY) */}
      {concerns.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '12px', border: '1px solid #fed7d7', backgroundColor: '#fff5f5', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#c53030', margin: '0 0 6px 0', fontWeight: 'bold' }}>
            REPORTED CONCERNS:
          </h3>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#2d3748', lineHeight: '1.5' }}>
            {concerns.map((c, i) => (
              <li key={i} style={{ marginBottom: '2px' }}>{c.concern_text}</li>
            ))}
          </ul>
        </div>
      )}

      {/* SERVICES TABLE */}
      <div style={{ marginBottom: '30px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000000', backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#4b5563', width: '40px' }}>#</th>
              <th style={{ padding: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#4b5563' }}>Service / Item</th>
              <th style={{ padding: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#4b5563', width: '80px' }}>HSN</th>
              <th style={{ padding: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#4b5563', textAlign: 'right', width: '60px' }}>Qty</th>
              <th style={{ padding: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#4b5563', textAlign: 'right', width: '110px' }}>Rate</th>
              <th style={{ padding: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#4b5563', textAlign: 'right', width: '120px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px', fontFamily: 'monospace', color: '#6b7280' }}>{i + 1}</td>
                <td style={{ padding: '10px', fontWeight: 'bold' }}>{svc.service_name}</td>
                <td style={{ padding: '10px', fontFamily: 'monospace', color: '#4b5563' }}>{svc.hsn_sac || '—'}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{Number(svc.qty)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(Number(svc.rate))}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(Number(svc.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CALCULATIONS, PAYMENT & FOOTER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.6', borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TERMS & CONDITIONS:
            </p>
            <ol style={{ margin: 0, paddingLeft: '15px', color: '#6b7280' }}>
              <li>Services rendered are non-refundable.</li>
              <li>Warranty is valid only if regular service schedules are maintained.</li>
              <li>Vehicles must be collected within 3 days of completion notification.</li>
            </ol>
            <p style={{ margin: '15px 0 0 0', fontWeight: 'bold', fontSize: '12px' }}>
              Payment Mode: <span style={{ textTransform: 'uppercase', color: '#CC0000' }}>{paymentMode}</span>
            </p>
          </div>
        </div>

        <div>
          <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
              <span>Subtotal:</span>
              <span style={{ fontFamily: 'monospace' }}>{formatCurrency(subtotalVal)}</span>
            </div>
            {isInvoice && (
              invoice?.cgst_amount !== undefined ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                    <span>CGST ({invoice.cgst_rate}%):</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(invoice.cgst_amount || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                    <span>SGST ({invoice.sgst_rate}%):</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(invoice.sgst_amount || 0)}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                  <span>GST ({gstVal > 0 ? '18%' : '0%'}):</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(gstVal)}</span>
                </div>
              )
            )}
            <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '16px', color: '#CC0000' }}>
              <span>TOTAL:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '18px' }}>{formatCurrency(totalVal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '15px', fontSize: '12px', fontStyle: 'italic', color: '#4b5563' }}>
        <strong>Amount in Words:</strong> {numberToWords(totalVal)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '50px' }}>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          This is a computer generated document.
        </div>
        <div style={{ textAlign: 'center', borderTop: '1px solid #000000', width: '200px', paddingTop: '6px' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>For {studioName}</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Authorised Signatory
          </p>
        </div>
      </div>
    </div>
  );
}
